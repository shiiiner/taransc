/**
 * Persian Caption Prep - Main Application
 * Specialized Persian Speech-to-Text & Caption Studio Pre-processor
 */

import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { MediaDropzone, TranscriptionEngine } from './components/MediaDropzone';
import { AudioPlayerWaveform } from './components/AudioPlayerWaveform';
import { SubtitleEditor } from './components/SubtitleEditor';
import { WordEditModal } from './components/WordEditModal';
import { QualityControlModal } from './components/QualityControlModal';
import { ExportModal } from './components/ExportModal';
import { WordItem, SentenceCue, SrtReferenceItem, ProjectState } from './types/caption';
import { extractAudioFromMedia } from './utils/audioExtractor';
import { alignWordsWithSrtReference } from './utils/persianNormalizer';
import { runQualityControl } from './utils/qcValidator';
import { downloadFile } from './utils/exportFormats';
import { AlertTriangle, AlertCircle, RefreshCw, CheckCircle2, Info, X, HelpCircle } from 'lucide-react';

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function App() {
  // Engine selection state
  const [activeEngine, setActiveEngine] = useState<string>('gemini-3.8-flash');

  // Priority 2: Distinct Original Media URL vs Extracted Audio URL
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [originalMediaUrl, setOriginalMediaUrl] = useState<string | null>(null);
  const [extractedAudioUrl, setExtractedAudioUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'audio' | 'video'>('audio');
  const [duration, setDuration] = useState<number>(0);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [loopActiveCue, setLoopActiveCue] = useState<boolean>(false);

  // Subtitle & Caption State
  const [words, setWords] = useState<WordItem[]>([]);
  const [cues, setCues] = useState<SentenceCue[]>([]);
  const [srtReference, setSrtReference] = useState<{ fileName: string; items: SrtReferenceItem[] } | null>(null);
  const [srtAlignmentWarning, setSrtAlignmentWarning] = useState<string | null>(null);
  const [singleLineMode, setSingleLineMode] = useState<boolean>(true);
  const [activeWordId, setActiveWordId] = useState<number | null>(null);
  const [activeCueIndex, setActiveCueIndex] = useState<number | null>(null);

  // Modals & UI Feedback
  const [editingWord, setEditingWord] = useState<WordItem | null>(null);
  const [isWordEditOpen, setIsWordEditOpen] = useState<boolean>(false);
  const [isQcOpen, setIsQcOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Processing Progress
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast(curr => (curr?.id === id ? null : curr));
    }, 4500);
  };

  // Audio / Video Element Ref (points to original media)
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const loadProjectInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate Quality Control Issues
  const qcIssues = runQualityControl(words, cues);

  // Synchronize active word & cue based on current playback time
  const handleTimeUpdate = () => {
    if (!mediaRef.current) return;
    const time = mediaRef.current.currentTime;
    setCurrentTime(time);

    // Find active word
    let currentWord: WordItem | null = null;
    for (const w of words) {
      if (time >= w.s && time <= w.e) {
        currentWord = w;
        break;
      }
    }
    setActiveWordId(currentWord ? currentWord.id : null);

    // Find active cue
    let currentCueIdx: number | null = null;
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      if (time >= cue.s && time <= cue.e) {
        currentCueIdx = i;
        break;
      }
    }
    setActiveCueIndex(currentCueIdx);

    // Handle cue looping if enabled
    if (loopActiveCue && currentCueIdx !== null) {
      const activeCue = cues[currentCueIdx];
      if (time >= activeCue.e) {
        mediaRef.current.currentTime = activeCue.s;
      }
    }
  };

  // Play / Pause transport toggle
  const handlePlayPause = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
    } else {
      mediaRef.current.play().catch(e => console.warn('Play error:', e));
      setIsPlaying(true);
    }
  };

  // Seek transport
  const handleSeek = (time: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Change playback speed
  const handleChangePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = rate;
    }
  };

  // Play specific cue
  const handlePlayCue = (cue: SentenceCue) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = cue.s;
    mediaRef.current.play().catch(e => console.warn(e));
    setIsPlaying(true);
  };

  // Play specific word
  const handlePlayWord = (word: WordItem) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = word.s;
    mediaRef.current.play().catch(e => console.warn(e));
    setIsPlaying(true);

    const durationMs = Math.max(200, (word.e - word.s) * 1000);
    setTimeout(() => {
      if (mediaRef.current && Math.abs(mediaRef.current.currentTime - word.e) < 0.2) {
        mediaRef.current.pause();
        setIsPlaying(false);
      }
    }, durationMs + 80);
  };

  // Edit Word
  const handleOpenWordEdit = (word: WordItem) => {
    setEditingWord(word);
    setIsWordEditOpen(true);
  };

  const handleSaveWordEdit = (updatedWord: WordItem) => {
    const updatedWords = words.map(w => (w.id === updatedWord.id ? updatedWord : w));
    setWords(updatedWords);

    // Synchronize affected cue bounds
    const updatedCues = cues.map(cue => {
      if (cue.wordIds.includes(updatedWord.id)) {
        const firstW = updatedWords.find(w => w.id === cue.wordIds[0]);
        const lastW = updatedWords.find(w => w.id === cue.wordIds[cue.wordIds.length - 1]);
        return {
          ...cue,
          s: firstW ? firstW.s : cue.s,
          e: lastW ? lastW.e : cue.e,
        };
      }
      return cue;
    });

    setCues(updatedCues);
  };

  // Merge Cues
  const handleMergeCues = (firstCueIdx: number) => {
    if (firstCueIdx < 0 || firstCueIdx >= cues.length - 1) return;

    const cueA = cues[firstCueIdx];
    const cueB = cues[firstCueIdx + 1];

    const mergedWordIds = [...cueA.wordIds, ...cueB.wordIds];
    const mergedCue: SentenceCue = {
      id: cueA.id,
      cueIndex: firstCueIdx,
      s: cueA.s,
      e: cueB.e,
      wordIds: mergedWordIds,
      lines: [mergedWordIds.map((_, i) => i)],
    };

    const newCues = [
      ...cues.slice(0, firstCueIdx),
      mergedCue,
      ...cues.slice(firstCueIdx + 2),
    ].map((c, i) => ({ ...c, cueIndex: i, id: `cue-${i}` }));

    setCues(newCues);
  };

  // Split Cue at Word
  const handleSplitCueAtWord = (cueIndex: number, splitWordId: number) => {
    const targetCue = cues[cueIndex];
    if (!targetCue) return;

    const splitIdx = targetCue.wordIds.indexOf(splitWordId);
    if (splitIdx < 0 || splitIdx >= targetCue.wordIds.length - 1) return;

    const wordsFirstHalf = targetCue.wordIds.slice(0, splitIdx + 1);
    const wordsSecondHalf = targetCue.wordIds.slice(splitIdx + 1);

    const firstW1 = words.find(w => w.id === wordsFirstHalf[0]);
    const lastW1 = words.find(w => w.id === wordsFirstHalf[wordsFirstHalf.length - 1]);

    const firstW2 = words.find(w => w.id === wordsSecondHalf[0]);
    const lastW2 = words.find(w => w.id === wordsSecondHalf[wordsSecondHalf.length - 1]);

    const cue1: SentenceCue = {
      id: `cue-${cueIndex}`,
      cueIndex,
      s: firstW1 ? firstW1.s : targetCue.s,
      e: lastW1 ? lastW1.e : targetCue.e,
      wordIds: wordsFirstHalf,
      lines: [wordsFirstHalf.map((_, i) => i)],
    };

    const cue2: SentenceCue = {
      id: `cue-${cueIndex}-split`,
      cueIndex: cueIndex + 1,
      s: firstW2 ? firstW2.s : targetCue.s,
      e: lastW2 ? lastW2.e : targetCue.e,
      wordIds: wordsSecondHalf,
      lines: [wordsSecondHalf.map((_, i) => i)],
    };

    const newCues = [
      ...cues.slice(0, cueIndex),
      cue1,
      cue2,
      ...cues.slice(cueIndex + 1),
    ].map((c, i) => ({ ...c, cueIndex: i, id: `cue-${i}` }));

    setCues(newCues);
  };

  // Re-segment by target word count
  const handleReSegmentByCount = (targetCount: number) => {
    if (words.length === 0) return;

    const newCues: SentenceCue[] = [];
    let cueIndex = 0;

    for (let i = 0; i < words.length; i += targetCount) {
      const chunkWords = words.slice(i, i + targetCount);
      const wIds = chunkWords.map(w => w.id);
      newCues.push({
        id: `cue-${cueIndex}`,
        cueIndex,
        s: chunkWords[0].s,
        e: chunkWords[chunkWords.length - 1].e,
        wordIds: wIds,
        lines: [wIds.map((_, idx) => idx)],
      });
      cueIndex++;
    }

    setCues(newCues);
  };

  // Natural speech-pause segmentation fallback
  const segmentByNaturalPauses = (inputWords: WordItem[], maxWordsPerCue = 9): SentenceCue[] => {
    const resultCues: SentenceCue[] = [];
    let currentChunkIds: number[] = [];

    for (let i = 0; i < inputWords.length; i++) {
      const w = inputWords[i];
      currentChunkIds.push(w.id);

      const hasPunctuation = /[.؟!?،;]$/.test(w.w);
      const nextWord = i + 1 < inputWords.length ? inputWords[i + 1] : null;
      const pauseDuration = nextWord ? nextWord.s - w.e : 0;
      const hasSignificantPause = pauseDuration > 0.45;
      const reachedMaxWords = currentChunkIds.length >= maxWordsPerCue;

      if (i === inputWords.length - 1 || (currentChunkIds.length >= 4 && (hasPunctuation || hasSignificantPause)) || reachedMaxWords) {
        const firstW = inputWords.find(item => item.id === currentChunkIds[0])!;
        const lastW = inputWords.find(item => item.id === currentChunkIds[currentChunkIds.length - 1])!;

        resultCues.push({
          id: `cue-${resultCues.length}`,
          cueIndex: resultCues.length,
          s: firstW.s,
          e: lastW.e,
          wordIds: [...currentChunkIds],
          lines: [currentChunkIds.map((_, idx) => idx)],
        });
        currentChunkIds = [];
      }
    }

    return resultCues;
  };

  // Re-segment via Server Gemini 3.8
  const handleReSegmentWithGemini = async () => {
    if (words.length === 0) return;
    setIsProcessing(true);
    setProcessingStage('در حال جمله‌بندی مجدد با مدل Gemini 3.8...');
    setProcessingProgress(40);
    setProcessingError(null);

    try {
      const resp = await fetch('/api/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words, targetWordsPerLine: 7 }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);

      setCues(data.cues);
      if (data.words) setWords(data.words);
      setProcessingProgress(100);
      showToast('جمله‌بندی هوشمند فارسی با موفقیت به‌روزرسانی شد.', 'success');
    } catch (err: unknown) {
      const e = err as Error;
      setProcessingError(e.message);
      // In-app confirm modal instead of window.confirm
      setConfirmDialog({
        isOpen: true,
        title: 'خطا در جمله‌بندی هوشمند',
        message: `${e.message}\n\nآیا مایلید از الگوریتم جمله‌بندی طبیعی بر اساس مکث‌های گفتار و علائم نگارشی استفاده کنید؟`,
        confirmText: 'استفاده از مکث‌های طبیعی',
        cancelText: 'انصراف',
        onConfirm: () => {
          setCues(segmentByNaturalPauses(words, 8));
          setConfirmDialog(null);
          showToast('جمله‌بندی طبیعی بر اساس مکث‌ها اعمال شد.', 'info');
        },
        onCancel: () => setConfirmDialog(null),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Priority 1 & 2: Process Media File, Extract audio, and Transcribe
  const handleMediaSelected = async (
    file: File, 
    srtItems?: SrtReferenceItem[], 
    srtFileName?: string,
    engine: TranscriptionEngine = 'gemini-3.8-flash'
  ) => {
    setIsProcessing(true);
    setProcessingError(null);
    setSrtAlignmentWarning(null);
    setMediaFile(file);

    const isVid = file.type.startsWith('video') || Boolean(file.name.match(/\.(mp4|mov|webm)$/i));
    setMediaType(isVid ? 'video' : 'audio');

    // Priority 2: Create original media URL for playback
    const originalUrl = URL.createObjectURL(file);
    setOriginalMediaUrl(originalUrl);

    try {
      // 1. Extract audio & peaks
      const extracted = await extractAudioFromMedia(file, (stage, pct) => {
        setProcessingStage(stage);
        setProcessingProgress(Math.round(pct * 0.4)); // First 40%
      });

      setDuration(extracted.duration);
      setWaveformPeaks(extracted.waveformPeaks);
      setExtractedAudioUrl(extracted.objectUrl);

      // 2. Transcribe with selected engine
      const isFlash = engine === 'gemini-3.8-flash';
      setProcessingStage(
        isFlash
          ? 'در حال ارسال فایل صوت به مدل پرسرعت Gemini 3.8 Flash...'
          : 'در حال ارسال فایل صوت به سرور و مدل صوتی Gemini 3.5...'
      );
      setProcessingProgress(42);

      const formData = new FormData();
      const audioFileName = file.name.replace(/\.[^/.]+$/, '') + (file.type.startsWith('audio/') ? '' : '.wav');
      formData.append('audio', extracted.audioBlob, audioFileName);
      formData.append('engine', engine);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let dynamicProgress = 42;
      const progressSteps = isFlash
        ? [
            { pct: 48, msg: 'صوت به سرور رسید؛ در حال پردازش در مدل فوق‌سریع Gemini 3.8 Flash...' },
            { pct: 58, msg: 'استخراج هوشمند کلمات فارسی در حالت دقیق کلمه‌به‌کلمه (VERBATIM)...' },
            { pct: 68, msg: 'محاسبه زمان‌بندی صدم‌ثانیه‌ای هر کلمه (Word Timestamps)...' },
            { pct: 78, msg: 'اعتبارسنجی املایی و ساختار زمانی واژه‌ها...' },
          ]
        : [
            { pct: 48, msg: 'صوت به سرور رسید؛ در حال پردازش در مدل Gemini 3.5 Transcribe...' },
            { pct: 56, msg: 'رونویسی صوتی در حالت VERBATIM با زبان فارسی (fa-IR)...' },
            { pct: 65, msg: 'در حال استخراج زمان‌بندی دقیق صدم‌ثانیه‌ای کلمات (Native Word Timestamps)...' },
            { pct: 73, msg: 'در حال پردازش گفتار فارسی و برچسب‌های زمانی...' },
            { pct: 79, msg: 'نهایی‌سازی تحلیل صوتی و اعتبارسنجی کلمات...' },
          ];

      const progressInterval = setInterval(() => {
        dynamicProgress = Math.min(80, dynamicProgress + 1);
        setProcessingProgress(dynamicProgress);
        const match = progressSteps.find(s => s.pct === dynamicProgress);
        if (match) {
          setProcessingStage(match.msg);
        }
      }, 1000);

      let transcribeData: { success: boolean; error?: string; words?: WordItem[]; engineUsed?: string };
      try {
        const transcribeResp = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        transcribeData = await transcribeResp.json();
      } catch (fetchErr: unknown) {
        clearInterval(progressInterval);
        const fErr = fetchErr as Error;
        if (fErr.name === 'AbortError') {
          throw new Error('فرآیند رونویسی توسط کاربر متوقف شد.');
        }
        console.error('Fetch error calling /api/transcribe:', fetchErr);
        throw new Error('خطا در برقراری ارتباط با سرور. لطفاً مجدداً امتحان کنید یا از دکمه نمونه صوتی استفاده فرمایید.');
      } finally {
        clearInterval(progressInterval);
      }

      if (!transcribeData.success) {
        throw new Error(transcribeData.error || 'خطا در رونویسی صوت.');
      }

      if (transcribeData.engineUsed) {
        setActiveEngine(transcribeData.engineUsed);
      } else {
        setActiveEngine(engine);
      }

      let transcribedWords: WordItem[] = transcribeData.words || [];
      if (transcribedWords.length === 0) {
        throw new Error('هیچ کلمه‌ای از فایل صوتی دریافت نشد.');
      }

      // Priority 3: Align with SRT if provided and use SRT as sentence boundary reference
      if (srtItems && srtItems.length > 0) {
        setProcessingStage('در حال همترازی ترتیبی و تعیین مرزهای جملات از فایل SRT مرجع...');
        setProcessingProgress(80);

        const srtResult = alignWordsWithSrtReference(transcribedWords, srtItems);
        setWords(srtResult.updatedWords);
        setCues(srtResult.proposedCues);
        setSrtReference({ fileName: srtFileName || 'reference.srt', items: srtItems });

        if (srtResult.isUncertain && srtResult.uncertainWarningFa) {
          setSrtAlignmentWarning(srtResult.uncertainWarningFa);
        }
      } else {
        // Priority 4: Smart Persian Sentence Segmentation with Gemini 3.8
        setProcessingStage('در حال تشخیص مرز جملات و ساختاردهی با Gemini 3.8...');
        setProcessingProgress(85);

        try {
          const segmentResp = await fetch('/api/segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ words: transcribedWords, targetWordsPerLine: 7 }),
          });

          const segmentData = await segmentResp.json();
          if (!segmentData.success) {
            throw new Error(segmentData.error || 'خطا در جمله‌بندی زیرنویس.');
          }

          setWords(segmentData.words || transcribedWords);
          setCues(segmentData.cues);
        } catch (segmentErr: unknown) {
          console.warn('AI segmentation failed validation, falling back to natural speech pause segmentation:', segmentErr);
          setWords(transcribedWords);
          setCues(segmentByNaturalPauses(transcribedWords, 8));
          showToast('جمله‌بندی بر اساس مکث‌های طبیعی صوت اعمال شد.', 'info');
        }
      }

      setProcessingProgress(100);
      showToast('استخراج کلمات و تایم‌استمپ‌ها با موفقیت پایان یافت.', 'success');
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
      let friendlyMsg = err.message || 'خطا در پردازش فایل رسانه.';
      if (friendlyMsg.includes('Failed to fetch') || friendlyMsg.includes('NetworkError')) {
        friendlyMsg = 'خطا در اتصال به سرور (Failed to fetch). لطفاً مطمئن شوید حجم فایل صوتی متعارف است و اینترنت برقرار می‌باشد.';
      }
      setProcessingError(friendlyMsg);
      showToast(friendlyMsg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Demo Sample Audio
  const handleUseSampleAudio = async () => {
    setIsProcessing(true);
    setProcessingStage('در حال آماده‌سازی صوت و داده‌های آزمایشی فارسی...');
    setProcessingProgress(30);
    setProcessingError(null);
    setSrtAlignmentWarning(null);

    const sampleRate = 16000;
    const durationSec = 10;
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const buffer = audioContext.createBuffer(1, sampleRate * durationSec, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < channelData.length; i++) {
      const t = i / sampleRate;
      channelData[i] = 0.15 * Math.sin(2 * Math.PI * 220 * t) * Math.exp(-((t % 2) * 1.5)) +
                       0.05 * Math.sin(2 * Math.PI * 440 * t);
    }

    const { encodeMonoWav, computeWaveformPeaks } = await import('./utils/audioExtractor');
    const wavBlob = encodeMonoWav(channelData, sampleRate);
    const objUrl = URL.createObjectURL(wavBlob);

    setOriginalMediaUrl(objUrl);
    setExtractedAudioUrl(objUrl);
    setDuration(durationSec);
    setMediaType('audio');
    setWaveformPeaks(computeWaveformPeaks(channelData, 500));

    const sampleWords: WordItem[] = [
      { id: 0, w: 'سلام', s: 0.25, e: 0.65, originalW: 'سلام', originalS: 0.25, originalE: 0.65, isValid: true, validationStatus: 'valid' },
      { id: 1, w: 'دوستان', s: 0.70, e: 1.15, originalW: 'دوستان', originalS: 0.70, originalE: 1.15, isValid: true, validationStatus: 'valid' },
      { id: 2, w: 'عزیز،', s: 1.20, e: 1.60, originalW: 'عزیز،', originalS: 1.20, originalE: 1.60, isValid: true, validationStatus: 'valid' },
      { id: 3, w: 'به', s: 1.70, e: 1.90, originalW: 'به', originalS: 1.70, originalE: 1.90, isValid: true, validationStatus: 'valid' },
      { id: 4, w: 'نرم‌افزار', s: 1.95, e: 2.50, originalW: 'نرم‌افزار', originalS: 1.95, originalE: 2.50, isValid: true, validationStatus: 'valid' },
      { id: 5, w: 'آماده‌سازی', s: 2.55, e: 3.20, originalW: 'آماده‌سازی', originalS: 2.55, originalE: 3.20, isValid: true, validationStatus: 'valid' },
      { id: 6, w: 'زیرنویس', s: 3.25, e: 3.80, originalW: 'زیرنویس', originalS: 3.25, originalE: 3.80, isValid: true, validationStatus: 'valid' },
      { id: 7, w: 'فارسی', s: 3.85, e: 4.30, originalW: 'فارسی', originalS: 3.85, originalE: 4.30, isValid: true, validationStatus: 'valid' },
      { id: 8, w: 'خوش', s: 4.50, e: 4.80, originalW: 'خوش', originalS: 4.50, originalE: 4.80, isValid: true, validationStatus: 'valid' },
      { id: 9, w: 'آمدید.', s: 4.85, e: 5.30, originalW: 'آمدید.', originalS: 4.85, originalE: 5.30, isValid: true, validationStatus: 'valid' },
      { id: 10, w: 'این', s: 5.60, e: 5.85, originalW: 'این', originalS: 5.60, originalE: 5.85, isValid: true, validationStatus: 'valid' },
      { id: 11, w: 'ابزار', s: 5.90, e: 6.25, originalW: 'ابزار', originalS: 5.90, originalE: 6.25, isValid: true, validationStatus: 'valid' },
      { id: 12, w: 'خروجی', s: 6.30, e: 6.75, originalW: 'خروجی', originalS: 6.30, originalE: 6.75, isValid: true, validationStatus: 'valid' },
      { id: 13, w: 'دقیق', s: 6.80, e: 7.20, originalW: 'دقیق', originalS: 6.80, originalE: 7.20, isValid: true, validationStatus: 'valid' },
      { id: 14, w: 'برای', s: 7.25, e: 7.50, originalW: 'برای', originalS: 7.25, originalE: 7.50, isValid: true, validationStatus: 'valid' },
      { id: 15, w: 'کپشن', s: 7.55, e: 7.95, originalW: 'کپشن', originalS: 7.55, originalE: 7.95, isValid: true, validationStatus: 'valid' },
      { id: 16, w: 'استودیو', s: 8.00, e: 8.60, originalW: 'استودیو', originalS: 8.00, originalE: 8.60, isValid: true, validationStatus: 'valid' },
      { id: 17, w: 'تولید', s: 8.70, e: 9.10, originalW: 'تولید', originalS: 8.70, originalE: 9.10, isValid: true, validationStatus: 'valid' },
      { id: 18, w: 'می‌کند.', s: 9.15, e: 9.60, originalW: 'می‌کند.', originalS: 9.15, originalE: 9.60, isValid: true, validationStatus: 'valid' },
    ];

    const sampleCues: SentenceCue[] = [
      {
        id: 'cue-0',
        cueIndex: 0,
        s: 0.25,
        e: 5.30,
        wordIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        lines: [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
      },
      {
        id: 'cue-1',
        cueIndex: 1,
        s: 5.60,
        e: 9.60,
        wordIds: [10, 11, 12, 13, 14, 15, 16, 17, 18],
        lines: [[0, 1, 2, 3, 4, 5, 6, 7, 8]],
      },
    ];

    setWords(sampleWords);
    setCues(sampleCues);
    setProcessingProgress(100);
    setIsProcessing(false);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 3));
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        handleSeek(Math.min(duration, currentTime + 3));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration]);

  // Save Project State
  const handleSaveProject = () => {
    const project: ProjectState = {
      version: '2.0.0',
      savedAt: new Date().toISOString(),
      mediaName: mediaFile?.name || 'persian_captions_project',
      mediaDuration: duration,
      mediaType,
      words,
      cues,
      srtReference: srtReference || undefined,
      settings: {
        targetWordsPerLine: 7,
        singleLineMode,
        autoBreakPunctuations: true,
      },
    };

    downloadFile(
      JSON.stringify(project, null, 2),
      `${(mediaFile?.name || 'project').replace(/\.[^/.]+$/, '')}.cprep`,
      'application/json'
    );
  };

  // Load Project State
  const handleLoadProjectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const project: ProjectState = JSON.parse(text);

      if (!project.words || !project.cues) {
        throw new Error('فایل پروژه ساختار معتبری ندارد.');
      }

      setWords(project.words);
      setCues(project.cues);
      if (project.mediaDuration) setDuration(project.mediaDuration);
      if (project.mediaType) setMediaType(project.mediaType);
      if (project.settings?.singleLineMode !== undefined) {
        setSingleLineMode(project.settings.singleLineMode);
      }
      showToast('پروژه با موفقیت بازخوانی شد.', 'success');
    } catch (err: unknown) {
      const e = err as Error;
      showToast(`خطا در بازخوانی فایل پروژه: ${e.message}`, 'error');
    }
  };

  const resetProjectState = () => {
    setMediaFile(null);
    setOriginalMediaUrl(null);
    setExtractedAudioUrl(null);
    setWords([]);
    setCues([]);
    setSrtReference(null);
    setSrtAlignmentWarning(null);
    setCurrentTime(0);
    setDuration(0);
    setWaveformPeaks([]);
    setProcessingError(null);
    showToast('پروژه جدید با موفقیت آماده شد.', 'info');
  };

  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setProcessingStage('');
    setProcessingProgress(0);
    showToast('فرآیند پردازش متوقف شد.', 'info');
  };

  // Reset Project
  const handleNewProject = () => {
    if (words.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'آغاز پروژه جدید',
        message: 'آیا مطمئن هستید که می‌خواهید پروژه جدیدی را آغاز کنید؟ تغییرات ذخیره‌نشده از دست خواهند رفت.',
        confirmText: 'شروع پروژه جدید',
        cancelText: 'انصراف',
        onConfirm: () => {
          setConfirmDialog(null);
          resetProjectState();
        },
        onCancel: () => setConfirmDialog(null),
      });
      return;
    }
    resetProjectState();
  };

  return (
    <div className="min-h-screen bg-[#0b0d13] text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Hidden File Input for Loading Projects */}
      <input
        ref={loadProjectInputRef}
        type="file"
        accept=".cprep,.json"
        className="hidden"
        onChange={handleLoadProjectFile}
      />

      {/* Studio Header */}
      <Header
        onNewProject={handleNewProject}
        onSaveProject={handleSaveProject}
        onLoadProject={() => loadProjectInputRef.current?.click()}
        onOpenQc={() => setIsQcOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onReSegment={handleReSegmentWithGemini}
        qcIssuesCount={qcIssues.filter(i => i.type === 'error').length}
        wordCount={words.length}
        cueCount={cues.length}
        hasMedia={words.length > 0}
        isProcessing={isProcessing}
        activeEngine={activeEngine}
      />

      {/* SRT Alignment Uncertainty Alert Banner (Priority 3) */}
      {srtAlignmentWarning && (
        <div className="bg-amber-950/70 border-b border-amber-800/80 px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between">
          <div className="max-w-7xl mx-auto flex items-center gap-2 w-full">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{srtAlignmentWarning}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {words.length === 0 ? (
          <MediaDropzone
            onMediaSelected={handleMediaSelected}
            onUseSampleAudio={handleUseSampleAudio}
            isProcessing={isProcessing}
            processingStage={processingStage}
            processingProgress={processingProgress}
            processingError={processingError}
            onRetry={(engine) => mediaFile && handleMediaSelected(mediaFile, undefined, undefined, engine || (activeEngine as any))}
            onCancel={handleCancelProcessing}
          />
        ) : (
          <div className="flex flex-col h-full">
            {/* Priority 2: Video Preview & Waveform Transport Player */}
            <AudioPlayerWaveform
              originalMediaUrl={originalMediaUrl || ''}
              extractedAudioUrl={extractedAudioUrl || ''}
              mediaType={mediaType}
              duration={duration}
              waveformPeaks={waveformPeaks}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              cues={cues}
              words={words}
              activeCueIndex={activeCueIndex}
              activeWordId={activeWordId}
              playbackRate={playbackRate}
              onChangePlaybackRate={handleChangePlaybackRate}
              loopActiveCue={loopActiveCue}
              onToggleLoopCue={() => setLoopActiveCue(!loopActiveCue)}
              mediaRef={mediaRef}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Subtitle Editor Container */}
            <div className="max-w-7xl mx-auto w-full px-4 py-6">
              <SubtitleEditor
                words={words}
                cues={cues}
                activeWordId={activeWordId}
                activeCueIndex={activeCueIndex}
                currentTime={currentTime}
                onPlayCue={handlePlayCue}
                onPlayWord={handlePlayWord}
                onEditWord={handleOpenWordEdit}
                onMergeCues={handleMergeCues}
                onSplitCueAtWord={handleSplitCueAtWord}
                onUpdateCues={setCues}
                onReSegmentByCount={handleReSegmentByCount}
                singleLineMode={singleLineMode}
                onToggleSingleLineMode={() => setSingleLineMode(!singleLineMode)}
              />
            </div>
          </div>
        )}
      </main>

      {/* Word Edit Modal */}
      <WordEditModal
        word={editingWord}
        isOpen={isWordEditOpen}
        onClose={() => setIsWordEditOpen(false)}
        onSave={handleSaveWordEdit}
        onPlayWordAudio={(start, end) => {
          if (!mediaRef.current) return;
          mediaRef.current.currentTime = start;
          mediaRef.current.play().catch(e => console.warn(e));
          setTimeout(() => {
            if (mediaRef.current) mediaRef.current.pause();
          }, Math.max(200, (end - start) * 1000 + 80));
        }}
      />

      {/* Quality Control Modal */}
      <QualityControlModal
        isOpen={isQcOpen}
        onClose={() => setIsQcOpen(false)}
        issues={qcIssues}
        wordCount={words.length}
        cueCount={cues.length}
        onSelectWord={(wordId) => {
          const w = words.find(item => item.id === wordId);
          if (w) handleOpenWordEdit(w);
        }}
        onSelectCue={(cueIdx) => {
          const targetCue = cues[cueIdx];
          if (targetCue) handlePlayCue(targetCue);
        }}
      />

      {/* Priority 5: Final Export Modal with Safety Validation */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        words={words}
        cues={cues}
        mediaName={mediaFile?.name || 'persian_captions'}
        mediaDuration={duration}
        singleLineMode={singleLineMode}
        onSaveFullProject={handleSaveProject}
      />

      {/* Custom Confirmation Modal */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121622] border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-right" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onCancel?.();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 transition"
              >
                {confirmDialog.cancelText || 'انصراف'}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition shadow"
              >
                {confirmDialog.confirmText || 'تأیید'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Toast Banner */}
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-medium transition-all duration-300 max-w-md w-[92vw] sm:w-full"
          style={{
            backgroundColor:
              toast.type === 'error'
                ? '#2a1215'
                : toast.type === 'success'
                ? '#0d281e'
                : toast.type === 'warning'
                ? '#2e2009'
                : '#131b2e',
            borderColor:
              toast.type === 'error'
                ? '#f43f5e'
                : toast.type === 'success'
                ? '#10b981'
                : toast.type === 'warning'
                ? '#f59e0b'
                : '#38bdf8',
            color: '#f8fafc',
          }}
          dir="rtl"
        >
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-cyan-400 shrink-0" />}
          <span className="flex-1 text-slate-100">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-200 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
