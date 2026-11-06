/**
 * Exporter functions for Caption Studio JSON, standard SRT, clean TXT, and Project JSON.
 */

import { WordItem, SentenceCue, CaptionStudioCue, CaptionStudioWord, ProjectState } from '../types/caption';
import { formatSrtTimestamp } from './persianNormalizer';

/**
 * Generate official Caption Studio JSON format compatible with After Effects script
 */
export function generateCaptionStudioJson(
  words: WordItem[],
  cues: SentenceCue[],
  singleLineMode: boolean = true
): CaptionStudioCue[] {
  const wordMap = new Map<number, WordItem>();
  for (const w of words) {
    wordMap.set(w.id, w);
  }

  const result: CaptionStudioCue[] = [];

  for (const cue of cues) {
    if (!cue.wordIds || cue.wordIds.length === 0) continue;

    const cueWords: CaptionStudioWord[] = [];
    for (const wId of cue.wordIds) {
      const w = wordMap.get(wId);
      if (w) {
        cueWords.push({
          w: w.w,
          s: Number(w.s.toFixed(3)),
          e: Number(w.e.toFixed(3)),
        });
      }
    }

    if (cueWords.length === 0) continue;

    const cueStart = cueWords[0].s;
    const cueEnd = cueWords[cueWords.length - 1].e;

    // Build lines (relative to cueWords array)
    let lines: number[][];
    if (singleLineMode || !cue.lines || cue.lines.length === 0) {
      lines = [cueWords.map((_, i) => i)];
    } else {
      lines = cue.lines;
    }

    result.push({
      s: Number(cueStart.toFixed(3)),
      e: Number(cueEnd.toFixed(3)),
      words: cueWords,
      lines,
    });
  }

  return result;
}

/**
 * Generate standard SRT subtitle text
 */
export function generateSrtContent(words: WordItem[], cues: SentenceCue[]): string {
  const wordMap = new Map<number, WordItem>();
  for (const w of words) {
    wordMap.set(w.id, w);
  }

  const blocks: string[] = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (!cue.wordIds || cue.wordIds.length === 0) continue;

    const cueWords = cue.wordIds.map(id => wordMap.get(id)).filter(Boolean) as WordItem[];
    if (cueWords.length === 0) continue;

    const startSec = cueWords[0].s;
    const endSec = cueWords[cueWords.length - 1].e;

    const text = cueWords.map(w => w.w).join(' ');

    blocks.push(
      `${i + 1}\n${formatSrtTimestamp(startSec)} --> ${formatSrtTimestamp(endSec)}\n${text}`
    );
  }

  return blocks.join('\n\n');
}

/**
 * Generate plain text transcript
 */
export function generatePlainText(words: WordItem[], cues: SentenceCue[]): string {
  const wordMap = new Map<number, WordItem>();
  for (const w of words) {
    wordMap.set(w.id, w);
  }

  return cues
    .map(cue => {
      const cueWords = cue.wordIds.map(id => wordMap.get(id)?.w).filter(Boolean);
      return cueWords.join(' ');
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
