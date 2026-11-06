/**
 * Persian text normalization, SRT parser, and sequential alignment utilities.
 * Implements Priority 3: Uses SRT as sentence boundary reference, maintains real audio timestamps,
 * tags srtBlockIndex, detects deleted/added/mismatched words, and flags uncertain alignment.
 */

import { WordItem, SentenceCue, SrtReferenceItem, AlignmentDiffItem } from '../types/caption';

/**
 * Normalizes Persian/Arabic characters to canonical Persian representations.
 * Handles Yeh, Kaf, Heh, Alef variants, diacritics, and ZWNJ.
 */
export function normalizePersian(text: string, keepZwnj: boolean = true): string {
  if (!text) return '';

  let normalized = text
    // Normalize Alefs
    .replace(/[آأإٱ]/g, 'ا')
    // Normalize Yeh
    .replace(/[يىئ]/g, 'ی')
    // Normalize Kaf
    .replace(/[كك]/g, 'ک')
    // Normalize Heh
    .replace(/[ةۀ]/g, 'ه')
    // Normalize Vav variants
    .replace(/[ؤ]/g, 'و')
    // Remove Arabic diacritics (harakat / tanween / tashdid / sukun)
    .replace(/[\u064B-\u0652\u0670]/g, '')
    // Remove Tatweel (kashida)
    .replace(/\u0640/g, '')
    // Convert Arabic numerals to standard
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));

  if (!keepZwnj) {
    normalized = normalized.replace(/\u200c/g, ' ');
  } else {
    normalized = normalized.replace(/\u200c+/g, '\u200c');
  }

  return normalized.trim();
}

/**
 * Strip punctuation from word for pure phonetic comparison
 */
export function cleanPunctuation(text: string): string {
  return text.replace(/[.,،؛:!؟?()\[\]{}"'«»\-—_/\\]/g, '').trim();
}

/**
 * Compute Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));

  for (let i = 0; i <= an; ++i) matrix[0][i] = i;
  for (let j = 0; j <= bn; ++j) matrix[j][0] = j;

  for (let j = 1; j <= bn; ++j) {
    for (let i = 1; i <= an; ++i) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,       // deletion
        matrix[j][i - 1] + 1,       // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  return matrix[bn][an];
}

/**
 * Similarity ratio between 0 and 1
 */
export function wordSimilarity(w1: string, w2: string): number {
  const n1 = cleanPunctuation(normalizePersian(w1, false));
  const n2 = cleanPunctuation(normalizePersian(w2, false));
  if (!n1 && !n2) return 1;
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1;

  const maxLen = Math.max(n1.length, n2.length);
  const dist = levenshteinDistance(n1, n2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Parse an SRT subtitle file content into structured items
 */
export function parseSrt(srtContent: string): SrtReferenceItem[] {
  const normalizedSrt = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalizedSrt.split(/\n\s*\n/);
  const items: SrtReferenceItem[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIndex = 1;
    if (lines[0].includes('-->')) {
      timeLineIndex = 0;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
    const startTime = parseSrtTimestamp(startStr);
    const endTime = parseSrtTimestamp(endStr);

    const textLines = lines.slice(timeLineIndex + 1).map(l => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    const text = textLines.join(' ');

    if (text) {
      items.push({
        index: items.length + 1,
        startTime,
        endTime,
        text,
      });
    }
  }

  return items;
}

/**
 * Convert SRT timestamp (00:01:23,456) to seconds
 */
export function parseSrtTimestamp(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const milliseconds = parseInt(match[4].padEnd(3, '0').slice(0, 3), 10);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Format seconds to SRT timestamp format 00:00:00,000
 */
export function formatSrtTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds - Math.floor(seconds)) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
}

export interface SrtAlignmentResult {
  updatedWords: WordItem[];
  proposedCues: SentenceCue[];
  diffs: AlignmentDiffItem[];
  overallMatchRate: number;
  isUncertain: boolean;
  uncertainWarningFa?: string;
  matchedBlocksCount: number;
  totalSrtBlocks: number;
}

/**
 * Priority 3: Sequential SRT alignment algorithm.
 * Uses SRT as sentence boundary reference, tags srtBlockIndex on words, preserves audio timestamps,
 * and detects deleted/added/mismatched words.
 */
export function alignWordsWithSrtReference(
  words: WordItem[],
  srtItems: SrtReferenceItem[]
): SrtAlignmentResult {
  if (words.length === 0 || srtItems.length === 0) {
    return {
      updatedWords: words,
      proposedCues: [],
      diffs: [],
      overallMatchRate: 0,
      isUncertain: true,
      uncertainWarningFa: 'کلمات یا فایل SRT خالی است.',
      matchedBlocksCount: 0,
      totalSrtBlocks: srtItems.length,
    };
  }

  const updatedWords: WordItem[] = words.map(w => ({ ...w }));
  const diffs: AlignmentDiffItem[] = [];
  const proposedCues: SentenceCue[] = [];

  let wordCursor = 0;
  let totalMatches = 0;
  let matchedBlocksCount = 0;

  for (let srtIdx = 0; srtIdx < srtItems.length; srtIdx++) {
    const srtItem = srtItems[srtIdx];
    const srtTokens = srtItem.text.split(/\s+/).filter(Boolean);

    if (srtTokens.length === 0) continue;

    // Remaining words in audio
    if (wordCursor >= updatedWords.length) {
      // These SRT words are missing in audio
      for (const token of srtTokens) {
        diffs.push({
          wordId: -1,
          transcribedWord: '',
          referenceWord: token,
          status: 'missing',
          similarity: 0,
        });
      }
      continue;
    }

    const blockAssignedWordIds: number[] = [];
    let blockMatches = 0;

    // We align srtTokens sequentially against updatedWords starting at wordCursor
    let srtTokenPtr = 0;

    while (srtTokenPtr < srtTokens.length && wordCursor < updatedWords.length) {
      const currentWord = updatedWords[wordCursor];
      const srtToken = srtTokens[srtTokenPtr];

      const sim = wordSimilarity(currentWord.w, srtToken);

      if (sim >= 0.75) {
        // High confidence match
        currentWord.srtDiff = 'match';
        currentWord.srtSuggestedWord = srtToken;
        currentWord.srtBlockIndex = srtItem.index;
        blockAssignedWordIds.push(currentWord.id);
        diffs.push({
          wordId: currentWord.id,
          transcribedWord: currentWord.w,
          referenceWord: srtToken,
          status: 'match',
          similarity: sim,
        });
        totalMatches++;
        blockMatches++;
        wordCursor++;
        srtTokenPtr++;
      } else if (sim >= 0.45) {
        // Spelling difference or minor inflection
        currentWord.srtDiff = 'mismatch';
        currentWord.srtSuggestedWord = srtToken;
        currentWord.srtBlockIndex = srtItem.index;
        blockAssignedWordIds.push(currentWord.id);
        diffs.push({
          wordId: currentWord.id,
          transcribedWord: currentWord.w,
          referenceWord: srtToken,
          status: 'mismatch',
          similarity: sim,
        });
        wordCursor++;
        srtTokenPtr++;
      } else {
        // Check lookahead: is currentWord an extra word in audio (e.g. repetition/hesitation)?
        const nextTokenSim = srtTokenPtr + 1 < srtTokens.length ? wordSimilarity(currentWord.w, srtTokens[srtTokenPtr + 1]) : 0;
        const nextWordSim = wordCursor + 1 < updatedWords.length ? wordSimilarity(updatedWords[wordCursor + 1].w, srtToken) : 0;

        if (nextWordSim >= 0.5) {
          // currentWord was an extra spoken word in audio not written in SRT
          currentWord.srtDiff = 'missing_in_srt';
          currentWord.srtBlockIndex = srtItem.index;
          blockAssignedWordIds.push(currentWord.id);
          diffs.push({
            wordId: currentWord.id,
            transcribedWord: currentWord.w,
            status: 'added',
            similarity: 0,
          });
          wordCursor++;
        } else if (nextTokenSim >= 0.5) {
          // srtToken was deleted or omitted in audio
          diffs.push({
            wordId: -1,
            transcribedWord: '',
            referenceWord: srtToken,
            status: 'missing',
            similarity: 0,
          });
          srtTokenPtr++;
        } else {
          // Fallback: assign to this block with mismatch
          currentWord.srtDiff = 'mismatch';
          currentWord.srtSuggestedWord = srtToken;
          currentWord.srtBlockIndex = srtItem.index;
          blockAssignedWordIds.push(currentWord.id);
          diffs.push({
            wordId: currentWord.id,
            transcribedWord: currentWord.w,
            referenceWord: srtToken,
            status: 'mismatch',
            similarity: sim,
          });
          wordCursor++;
          srtTokenPtr++;
        }
      }
    }

    if (blockAssignedWordIds.length > 0) {
      const firstW = updatedWords.find(w => w.id === blockAssignedWordIds[0])!;
      const lastW = updatedWords.find(w => w.id === blockAssignedWordIds[blockAssignedWordIds.length - 1])!;

      const isBlockConfident = blockMatches / srtTokens.length >= 0.5;
      if (isBlockConfident) matchedBlocksCount++;

      proposedCues.push({
        id: `cue-${proposedCues.length}`,
        cueIndex: proposedCues.length,
        s: firstW.s,
        e: lastW.e,
        wordIds: blockAssignedWordIds,
        lines: [blockAssignedWordIds.map((_, i) => i)],
        note: isBlockConfident ? undefined : 'همترازی این بلوک با SRT قطعی نیست',
      });
    }
  }

  // If remaining audio words exist beyond the last SRT block, attach or create a final cue
  if (wordCursor < updatedWords.length) {
    const trailingIds: number[] = [];
    while (wordCursor < updatedWords.length) {
      const w = updatedWords[wordCursor];
      w.srtDiff = 'missing_in_srt';
      trailingIds.push(w.id);
      wordCursor++;
    }

    if (proposedCues.length > 0) {
      const lastCue = proposedCues[proposedCues.length - 1];
      lastCue.wordIds.push(...trailingIds);
      const lastW = updatedWords.find(w => w.id === lastCue.wordIds[lastCue.wordIds.length - 1])!;
      lastCue.e = lastW.e;
      lastCue.lines = [lastCue.wordIds.map((_, i) => i)];
    } else {
      const firstW = updatedWords.find(w => w.id === trailingIds[0])!;
      const lastW = updatedWords.find(w => w.id === trailingIds[trailingIds.length - 1])!;
      proposedCues.push({
        id: 'cue-0',
        cueIndex: 0,
        s: firstW.s,
        e: lastW.e,
        wordIds: trailingIds,
        lines: [trailingIds.map((_, i) => i)],
      });
    }
  }

  const overallMatchRate = words.length > 0 ? Math.round((totalMatches / words.length) * 100) : 0;
  const isUncertain = overallMatchRate < 60 || matchedBlocksCount < srtItems.length * 0.6;

  let uncertainWarningFa: string | undefined;
  if (isUncertain) {
    uncertainWarningFa = `نرخ تطابق همترازی با فایل SRT مرجع ${overallMatchRate}٪ است و همترازی در برخی جملات قطعی نیست. لطفاً نشانگرهای زرد را بررسی کنید.`;
  }

  return {
    updatedWords,
    proposedCues,
    diffs,
    overallMatchRate,
    isUncertain,
    uncertainWarningFa,
    matchedBlocksCount,
    totalSrtBlocks: srtItems.length,
  };
}
