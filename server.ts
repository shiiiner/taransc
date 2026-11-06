import express, { Request, Response } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, AudioTranscriptionConfigMode } from '@google/genai';
import { parseNativeWordAnnotations, RawGenAIResponse } from './src/utils/nativeTranscriptionParser';
import { WordItem } from './src/types/caption';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Multer for audio uploads (stored in memory or temp dir up to 100MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Enable CORS and JSON parsing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Helper to get initialized GoogleGenAI client with v1alpha support
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('کلید GEMINI_API_KEY در متغیرهای محیطی یافت نشد. لطفاً در پنل تنظیمات AI Studio آن را بررسی کنید.');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1alpha',
    httpOptions: {
      apiVersion: 'v1alpha',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Retry helper with smart exponential backoff for transient 503/429
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 2000): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err as Error;
      const msg = lastError.message || '';
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('rate-limits');

      if (isTransient && attempt < maxRetries) {
        let waitMs = baseDelayMs * attempt;
        // Parse retry delay from Google API error (e.g. "retry in 9.11s" or "retryDelay": "9s")
        const retryMatch = msg.match(/retry in ([0-9.]+)s/i) || msg.match(/"retryDelay":\s*"([0-9.]+)s"/i);
        if (retryMatch && retryMatch[1]) {
          const parsedSec = parseFloat(retryMatch[1]);
          if (!isNaN(parsedSec)) {
            waitMs = Math.ceil(parsedSec * 1000) + 1200; // wait requested time + 1.2s buffer
          }
        } else if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          waitMs = 5000 * attempt;
        }

        console.warn(`[Gemini API] Attempt ${attempt} transient issue (${msg.slice(0, 70)}...). Waiting ${Math.round(waitMs / 1000)}s before retry...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

// High-speed, high-accuracy Persian Audio Transcription using Gemini 3.8 Flash
async function transcribeWithGeminiFlash(
  ai: GoogleGenAI,
  audioContent: { inlineData?: { mimeType: string; data: string }; fileData?: { fileUri: string; mimeType: string } }
): Promise<{ success: boolean; words: WordItem[]; transcriptText: string; error?: string; modelUsed?: string }> {
  const flashPrompt = `شما یک سیستم هوش مصنوعی فوق‌حرفه‌ای برای پیاده‌سازی و رونویسی دقیق گفتار فارسی (Speech-to-Text) با دقت زمانی صدم‌ثانیه برای تک‌تک واژه‌ها هستید.

وظیفه شما:
به صوت پیوست‌شده با بالاترین دقت گوش دهید. تمام کلمات گفته‌شده توسط گوینده را بدون کوچک‌ترین تغییر، حذف یا اضافه (حالت کاملاً کلمه‌به‌کلمه یا VERBATIM) استخراج کنید.
برای هر کلمه زمان دقیق شروع (startOffset) و پایان (endOffset) را بر حسب ثانیه عددی (اعشاری، مثلاً 0.45 یا 1.25) مشخص نمایید.

قوانین حیاتی:
۱. ترتیب کلمات باید دقیقاً همان ترتیب زمانی ادای کلمات در گفتار باشد.
۲. هیچ کلمه‌ای را حذف نکنید و تکرارها و مکث‌های گوینده را لحاظ کنید.
۳. زمان‌های شروع و پایان باید کاملاً صعودی و متناسب با ادای واژه‌ها در صوت باشد (startOffset < endOffset).

خروجی الزاماً یک ساختار JSON معتبر به فرمت زیر باشد:
{
  "transcript": "متن کامل پیوسته گفتار فارسی...",
  "words": [
    {
      "word": "سلام",
      "startOffset": 0.25,
      "endOffset": 0.65
    },
    {
      "word": "دوستان",
      "startOffset": 0.70,
      "endOffset": 1.15
    }
  ]
}`;

  const candidateModels = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
  ];
  let response: any = null;
  let modelUsed = candidateModels[0];
  let lastErr: any = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const m = candidateModels[i];
    try {
      console.log(`[Gemini Flash STT] Attempting model ${m}...`);
      response = await callWithRetry(() =>
        ai.models.generateContent({
          model: m,
          contents: [audioContent, { text: flashPrompt }],
          config: {
            responseMimeType: 'application/json',
          },
        }),
        2,
        1500
      );
      modelUsed = m;
      console.log(`[Gemini Flash STT] Success with model ${m}`);
      break;
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message || '';
      console.warn(`[Gemini Flash STT] Model ${m} failed (${msg.slice(0, 90)}). Trying next candidate in family...`);
      if (i < candidateModels.length - 1) {
        continue;
      }
      throw err;
    }
  }

  if (!response) {
    throw lastErr || new Error('خطا در فراخوانی مدل Flash.');
  }

  const rawText = response.text || '{}';
  let parsed: { transcript?: string; words?: Array<{ word?: string; w?: string; startOffset?: number | string; endOffset?: number | string; s?: number | string; e?: number | string }> };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  const rawWords = parsed.words || [];
  if (!Array.isArray(rawWords) || rawWords.length === 0) {
    return {
      success: false,
      words: [],
      transcriptText: parsed.transcript || '',
      error: 'مدل ساختار کلمات معتبری برای این فایل صوتی استخراج نکرد.',
      modelUsed,
    };
  }

  const resultWords: WordItem[] = [];
  let prevEnd = 0;

  for (let i = 0; i < rawWords.length; i++) {
    const item = rawWords[i];
    const wordText = (item.word || item.w || '').trim();
    if (!wordText) continue;

    let s = typeof item.startOffset === 'number' ? item.startOffset : typeof item.s === 'number' ? item.s : parseFloat(String(item.startOffset || item.s || 0));
    let e = typeof item.endOffset === 'number' ? item.endOffset : typeof item.e === 'number' ? item.e : parseFloat(String(item.endOffset || item.e || 0));

    if (isNaN(s) || s < 0) s = prevEnd;
    if (isNaN(e) || e <= s) e = s + 0.3;

    s = Number(s.toFixed(3));
    e = Number(e.toFixed(3));
    prevEnd = e;

    resultWords.push({
      id: i,
      w: wordText,
      s,
      e,
      originalW: wordText,
      originalS: s,
      originalE: e,
      isValid: true,
      validationStatus: 'valid',
    });
  }

  return {
    success: resultWords.length > 0,
    words: resultWords,
    transcriptText: parsed.transcript || resultWords.map(w => w.w).join(' '),
    modelUsed,
  };
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    hasApiKey: hasKey,
    time: new Date().toISOString(),
  });
});


/**
 * 1. Speech-to-Text Transcription with word-level timestamps
 * Supports both:
 * - gemini-3.8-flash: High speed (~3-5s), robust quota, intelligent Persian STT
 * - gemini-3.5-transcribe: Specialized native word timestamp model with auto-fallback
 */
app.post('/api/transcribe', (req: Request, res: Response, next) => {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      console.error('Multer file upload error:', err);
      res.header('Access-Control-Allow-Origin', '*');
      res.status(400).json({
        success: false,
        error: `خطا در دریافت فایل صوتی: ${err.message || 'حجم فایل بیش از حد مجاز است'}`,
      });
      return;
    }
    next();
  });
}, async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;
  let engine = (req.body?.engine || req.query?.engine || 'gemini-3.8-flash').toString();
  try {
    const ai = getGenAI();

    let mimeType = 'audio/wav';
    let base64Audio = '';

    if (req.file) {
      mimeType = req.file.mimetype || 'audio/wav';
      if (mimeType === 'audio/x-wav') mimeType = 'audio/wav';
      base64Audio = req.file.buffer.toString('base64');
    } else if (req.body.audioBase64) {
      base64Audio = req.body.audioBase64;
      mimeType = req.body.mimeType || 'audio/wav';
    } else {
      res.status(400).json({ success: false, error: 'فایل صوتی یا داده base64 ارسال نشده است.' });
      return;
    }

    console.log(`[Server] Transcribing with engine: ${engine}, size=${Math.round(base64Audio.length / 1024)} KB, mimeType=${mimeType}`);

    let audioPartOrFile: any;
    let uploadedFile: any = null;

    if (base64Audio.length > 8 * 1024 * 1024) {
      const tempDir = path.resolve('/tmp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      tempFilePath = path.join(tempDir, `audio_${Date.now()}.wav`);
      const buffer = Buffer.from(base64Audio, 'base64');
      fs.writeFileSync(tempFilePath, buffer);

      uploadedFile = await ai.files.upload({
        file: tempFilePath,
        config: {
          mimeType: mimeType,
        },
      });

      audioPartOrFile = {
        fileData: {
          fileUri: uploadedFile.uri,
          mimeType: uploadedFile.mimeType,
        },
      };
    } else {
      audioPartOrFile = {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      };
    }

    let resultWords: any[] = [];
    let transcriptText = '';
    let engineUsed = engine;

    if (engine === 'gemini-3.8-flash') {
      // Direct transcription via Gemini 3.8 Flash
      const flashResult = await transcribeWithGeminiFlash(ai, audioPartOrFile);
      if (!flashResult.success || flashResult.words.length === 0) {
        throw new Error(flashResult.error || 'هیچ کلمه‌ای توسط مدل Gemini 3.8 Flash استخراج نشد.');
      }
      resultWords = flashResult.words;
      transcriptText = flashResult.transcriptText;
      engineUsed = flashResult.modelUsed || 'gemini-3.8-flash';
    } else {
      // Attempt Gemini 3.5 Transcribe with native word timestamps
      try {
        const transcriptionConfig = {
          audioTranscriptionConfig: {
            languageCodes: ['fa-IR'],
            wordTimestamp: true,
            mode: AudioTranscriptionConfigMode.VERBATIM,
          },
        };

        const response = await callWithRetry(() =>
          ai.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: [audioPartOrFile],
            config: transcriptionConfig,
          })
        );

        const parseResult = parseNativeWordAnnotations(response as unknown as RawGenAIResponse);
        if (parseResult.success && parseResult.words.length > 0) {
          resultWords = parseResult.words;
          transcriptText = parseResult.transcriptText;
        } else {
          throw new Error(parseResult.error || 'هیچ برچسب زمانی کلمه‌به‌کلمه معتبری دریافت نشد.');
        }
      } catch (transcribeError: unknown) {
        console.warn('[Gemini 3.5 Transcribe] Failed or busy, falling back to Gemini 3.8 Flash:', (transcribeError as Error).message);
        // Seamless fallback to Gemini 3.8 Flash
        const fallbackResult = await transcribeWithGeminiFlash(ai, audioPartOrFile);
        if (fallbackResult.success && fallbackResult.words.length > 0) {
          resultWords = fallbackResult.words;
          transcriptText = fallbackResult.transcriptText;
          engineUsed = 'gemini-3.8-flash (جایگزین خودکار)';
        } else {
          throw transcribeError;
        }
      }
    }

    // Cleanup uploaded file if created
    if (uploadedFile?.name) {
      try {
        await ai.files.delete({ name: uploadedFile.name });
      } catch (cleanupErr) {
        console.warn('Files API cleanup notice:', cleanupErr);
      }
    }

    res.json({
      success: true,
      engineUsed,
      wordCount: resultWords.length,
      validWordCount: resultWords.length,
      invalidWordCount: 0,
      transcriptText,
      words: resultWords,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Detailed Error in /api/transcribe:', err.message);
    const requestedEngineName = engine.includes('flash') ? 'Gemini Flash' : 'Gemini 3.5 Transcribe';
    let userFriendlyError = err.message || `خطا در پردازش صوت با مدل ${requestedEngineName}.`;
    if (userFriendlyError.includes('429') || userFriendlyError.includes('RESOURCE_EXHAUSTED') || userFriendlyError.includes('Quota exceeded')) {
      userFriendlyError = `سقف مجاز تعداد درخواست در دقیقه (Rate Limit) برای مدل ${requestedEngineName} موقتاً پر شده است. لطفاً چند لحظه بعد مجدداً تلاش فرمایید.`;
    } else if (userFriendlyError.includes('503') || userFriendlyError.includes('high demand') || userFriendlyError.includes('UNAVAILABLE')) {
      userFriendlyError = `سرور مدل هوش مصنوعی (${requestedEngineName}) در حال حاضر با تقاضای بالای ترافیکی مواجه است (503). چند لحظه بعد مجدداً تلاش فرمایید.`;
    }
    res.status(500).json({
      success: false,
      error: userFriendlyError,
      rawError: err.message,
    });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.warn('Failed to delete temp file:', e);
      }
    }
  }
});

/**
 * 2. Smart Persian Sentence Segmentation with Gemini 3.8
 * Strictly enforces Priority 4 validation rules:
 * - Every single word ID (0 to N-1) must be used.
 * - Each ID used exactly once.
 * - Order of IDs must strictly match speech order.
 * - Never appends missing words to the end to mask errors.
 * - Returns explicit validation errors if model output violates constraints.
 */
app.post('/api/segment', async (req: Request, res: Response) => {
  try {
    const ai = getGenAI();
    const { words, targetWordsPerLine } = req.body;

    if (!words || !Array.isArray(words) || words.length === 0) {
      res.status(400).json({ success: false, error: 'آرایه کلمات معتبر ارسال نشده است.' });
      return;
    }

    const wordListBrief = words.map(w => ({ id: w.id, w: w.w, s: w.s, e: w.e }));
    const targetWords = targetWordsPerLine && targetWordsPerLine > 2 ? targetWordsPerLine : 7;

    const segmentationPrompt = `شما یک ویراستار و متخصص نگارش زیرنویس فارسی برای ویدیوهای حرفه‌ای و استودیو کپشن (After Effects) هستید.

وظیفه شما:
گروه‌بندی کلمات رونویسی‌شده زیر به جملات و عبارات طبیعی، معنادار و چشم‌نواز فارسی همراه با علائم نگارشی مناسب (مانند ویرگول «،»، نقطه «.»، علامت سوال «؟» و تعجب «!»).

لیست کلمات به ترتیب زمانی:
${JSON.stringify(wordListBrief)}

قوانین حیاتی و غیرقابل تغییر:
۱. اکیداً حق تغییر ترتیب کلمات، حذف کلمات، اضافه کردن کلمات جدید، یا تغییر زمان شروع و پایان را ندارید.
۲. تمام کلمه‌ها از شناسه (id) شماره ۰ تا ${words.length - 1} باید دقیقاً یک‌بار در آرایه‌های wordIds در cues قرار بگیرند. هیچ کلمه‌ای نباید جا بماند یا تکرار شود.
۳. ترتیب شناسه‌های wordIds در کل جملات باید صعودی و پیوسته باشد: [0, 1, 2], [3, 4, 5], ...
۴. اندازه مطلوب هر جمله حدود ${targetWords} کلمه (بین ۴ تا ۱۰ کلمه) باشد تا برای خواندن در ویدیو و زیرنویس ایده‌آل باشد.
۵. علائم نگارشی متداول فارسی (، . ؟ !) را به انتهای کلمات مناسب الصاق کنید یا در فیلد punctuations مشخص نمایید.
۶. شکستن جمله را در مکث‌های طبیعی زبان فارسی و مرز بندها قرار دهید.

فرمت پاسخ الزاماً JSON خالص به شکل زیر باشد:
{
  "cues": [
    {
      "cueIndex": 0,
      "wordIds": [0, 1, 2, 3],
      "punctuations": { "3": "." }
    }
  ]
}`;

    const segmentCandidates = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    let response: any = null;
    let segLastErr: any = null;

    for (let i = 0; i < segmentCandidates.length; i++) {
      const sm = segmentCandidates[i];
      try {
        response = await callWithRetry(() =>
          ai.models.generateContent({
            model: sm,
            contents: segmentationPrompt,
            config: {
              responseMimeType: 'application/json',
            },
          }),
          2,
          1500
        );
        break;
      } catch (err: any) {
        segLastErr = err;
        console.warn(`[Segmentation] Model ${sm} failed. Trying next candidate...`);
        if (i < segmentCandidates.length - 1) {
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw segLastErr || new Error('خطا در جمله‌بندی با هوش مصنوعی.');
    }

    const rawText = response.text || '{}';
    let parsed: { cues?: Array<{ cueIndex?: number; wordIds?: number[]; punctuations?: Record<string, string> }> };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    if (!parsed.cues || !Array.isArray(parsed.cues) || parsed.cues.length === 0) {
      res.status(422).json({
        success: false,
        error: 'مدل ساختار cues مورد انتظار را بازنگرداند.',
      });
      return;
    }

    // STRICT VALIDATION (Priority 4)
    const wordMap = new Map<number, (typeof words)[0]>();
    words.forEach(w => wordMap.set(w.id, { ...w }));

    const assignedIds = new Set<number>();
    const duplicateIds: number[] = [];
    let expectedNextId = 0;
    let hasOrderViolation = false;

    for (const cue of parsed.cues) {
      if (!Array.isArray(cue.wordIds) || cue.wordIds.length === 0) {
        continue;
      }
      for (const id of cue.wordIds) {
        if (!wordMap.has(id)) {
          res.status(422).json({
            success: false,
            error: `شناسه نامعتبر ${id} در خروجی جمله‌بندی یافت شد که در کلمات ورودی وجود ندارد.`,
          });
          return;
        }
        if (assignedIds.has(id)) {
          duplicateIds.push(id);
        }
        assignedIds.add(id);

        if (id !== expectedNextId) {
          hasOrderViolation = true;
        }
        expectedNextId = id + 1;
      }
    }

    // Check completeness
    const missingIds = words.map(w => w.id).filter(id => !assignedIds.has(id));
    if (missingIds.length > 0) {
      res.status(422).json({
        success: false,
        error: `خطای اعتبارسنجی جمله‌بندی: ${missingIds.length} کلمه (شناسه‌های ${missingIds.slice(0, 5).join(', ')}...) از خروجی حذف شده‌اند.`,
        canRetry: true,
      });
      return;
    }

    if (duplicateIds.length > 0) {
      res.status(422).json({
        success: false,
        error: `خطای اعتبارسنجی جمله‌بندی: شناسه‌های تکراری ${duplicateIds.join(', ')} در جملات قرار گرفته‌اند.`,
        canRetry: true,
      });
      return;
    }

    if (hasOrderViolation) {
      res.status(422).json({
        success: false,
        error: 'خطای اعتبارسنجی جمله‌بندی: ترتیب زمانی کلمات در جمله‌بندی نقض شده است.',
        canRetry: true,
      });
      return;
    }

    // All validation passed strictly. Apply punctuations and construct cues
    const updatedWords = words.map(w => ({ ...w }));
    const constructedCues = parsed.cues.map((c, idx) => {
      const wIds = (c.wordIds || []).filter(id => wordMap.has(id));
      if (wIds.length === 0) return null;

      if (c.punctuations) {
        for (const [wIdStr, punct] of Object.entries(c.punctuations)) {
          const wId = parseInt(wIdStr, 10);
          const targetW = updatedWords.find(w => w.id === wId);
          if (targetW && punct && !targetW.w.endsWith(punct)) {
            targetW.w = `${targetW.w}${punct}`;
          }
        }
      }

      const firstW = wordMap.get(wIds[0])!;
      const lastW = wordMap.get(wIds[wIds.length - 1])!;

      return {
        id: `cue-${idx}`,
        cueIndex: idx,
        s: Number(firstW.s.toFixed(3)),
        e: Number(lastW.e.toFixed(3)),
        wordIds: wIds,
        lines: [wIds.map((_, i) => i)],
      };
    }).filter(Boolean);

    res.json({
      success: true,
      cues: constructedCues,
      words: updatedWords,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error in /api/segment:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'خطا در جمله‌بندی هوشمند فارسی.',
    });
  }
});

// Global error handler to guarantee CORS headers on any unexpected error
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Unhandled server error:', err);
  res.header('Access-Control-Allow-Origin', '*');
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'خطای غیرمنتظره در سرور رخ داد.',
  });
});

// Setup Vite middleware in dev or static serving in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
