/**
 * Native Word Annotations Parser for Gemini 3.5 Transcribe
 * Extracts and validates word-level timestamps from audioTranscription.words
 * in response.candidates[].content.parts[].
 */

import { WordItem } from '../types/caption';

export interface RawGenAIWordInfo {
  word?: string;
  startOffset?: string;
  endOffset?: string;
  speakerLabel?: string;
}

export interface RawGenAIPart {
  audioTranscription?: {
    text?: string;
    words?: RawGenAIWordInfo[];
    startOffset?: string;
    endOffset?: string;
  };
  text?: string;
  inlineData?: unknown;
  fileData?: unknown;
}

export interface RawGenAICandidate {
  content?: {
    parts?: RawGenAIPart[];
  };
}

export interface RawGenAIResponse {
  candidates?: RawGenAICandidate[];
  text?: string;
}

export interface ParseTranscriptionResult {
  success: boolean;
  words: WordItem[];
  validCount: number;
  invalidCount: number;
  transcriptText: string;
  error?: string;
}

/**
 * Converts a protobuf Duration string like "0.450s" or "12.345678s" to numeric seconds.
 * Returns null if string is missing, invalid, or negative.
 */
export function parseOffsetToSeconds(offsetStr?: string | null): number | null {
  if (!offsetStr || typeof offsetStr !== 'string') return null;
  const trimmed = offsetStr.trim();
  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)s?$/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (isNaN(num) || num < 0) return null;
  return Number(num.toFixed(3));
}

/**
 * Extracts and strictly validates native word annotations from Gemini response.
 * Halts with error if no valid word annotations exist.
 * Never invents 0 or 0.3s fake defaults.
 */
export function parseNativeWordAnnotations(response: RawGenAIResponse): ParseTranscriptionResult {
  const rawWords: RawGenAIWordInfo[] = [];
  let transcriptText = '';

  for (const candidate of response.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.audioTranscription) {
        if (part.audioTranscription.text && !transcriptText) {
          transcriptText = part.audioTranscription.text;
        }
        if (Array.isArray(part.audioTranscription.words)) {
          rawWords.push(...part.audioTranscription.words);
        }
      }
    }
  }

  if (rawWords.length === 0) {
    return {
      success: false,
      words: [],
      validCount: 0,
      invalidCount: 0,
      transcriptText,
      error: 'هیچ برچسب زمانی کلمه‌به‌کلمه معتبری (Word Annotations) در پاسخ مدل gemini-3.5-transcribe یافت نشد.',
    };
  }

  const processedWords: WordItem[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rawWords.length; i++) {
    const raw = rawWords[i];
    const wordText = String(raw.word || '').trim();
    if (!wordText) continue;

    const startSec = parseOffsetToSeconds(raw.startOffset);
    const endSec = parseOffsetToSeconds(raw.endOffset);

    let isValid = true;
    let validationStatus: WordItem['validationStatus'] = 'valid';

    if (startSec === null) {
      isValid = false;
      validationStatus = 'missing_start';
    } else if (endSec === null) {
      isValid = false;
      validationStatus = 'missing_end';
    } else if (startSec < 0) {
      isValid = false;
      validationStatus = 'negative';
    } else if (endSec <= startSec) {
      isValid = false;
      validationStatus = 'end_before_start';
    }

    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    processedWords.push({
      id: processedWords.length,
      w: wordText,
      originalW: wordText,
      // Strictly store parsed time or -1 if missing/invalid. Never fabricate 0 or 0.3s defaults!
      s: startSec !== null ? startSec : -1,
      originalS: startSec !== null ? startSec : -1,
      e: endSec !== null ? endSec : -1,
      originalE: endSec !== null ? endSec : -1,
      isValid,
      validationStatus,
      hasTimingIssue: !isValid,
    });
  }

  // Must have at least one valid word annotation to succeed
  if (validCount === 0 || processedWords.length === 0) {
    return {
      success: false,
      words: processedWords,
      validCount: 0,
      invalidCount,
      transcriptText,
      error: 'هیچ کلمه‌ای با زمان‌بندی معتبر استخراج نشد. تمام زمان‌ها ناموجود یا نامعتبر بودند.',
    };
  }

  return {
    success: true,
    words: processedWords,
    validCount,
    invalidCount,
    transcriptText,
  };
}
