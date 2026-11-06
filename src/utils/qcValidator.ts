/**
 * Quality Control and Validation Engine for Persian Subtitle Cues
 * Validates against all criteria in Section 8 of specification.
 */

import { WordItem, SentenceCue, QualityCheckIssue } from '../types/caption';

export function runQualityControl(words: WordItem[], cues: SentenceCue[]): QualityCheckIssue[] {
  const issues: QualityCheckIssue[] = [];

  if (words.length === 0) {
    issues.push({
      id: 'no-words',
      type: 'warning',
      category: 'empty',
      messageFa: 'هیچ کلمه‌ای در پروژه وجود ندارد.',
    });
    return issues;
  }

  // 1. Check each word's timing validity
  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (isNaN(word.s) || word.s < 0) {
      issues.push({
        id: `invalid-start-${word.id}`,
        type: 'error',
        category: 'timing',
        wordId: word.id,
        messageFa: `زمان شروع کلمه «${word.w}» نامعتبر است (${word.s}).`,
      });
    }

    if (isNaN(word.e) || word.e < word.s) {
      issues.push({
        id: `invalid-end-${word.id}`,
        type: 'error',
        category: 'timing',
        wordId: word.id,
        messageFa: `زمان پایان کلمه «${word.w}» (${word.e.toFixed(2)}s) کمتر از زمان شروع آن (${word.s.toFixed(2)}s) است.`,
      });
    }

    // Check chronological order between consecutive words
    if (i > 0) {
      const prevWord = words[i - 1];
      if (word.s < prevWord.s) {
        issues.push({
          id: `order-reversed-${word.id}`,
          type: 'warning',
          category: 'order',
          wordId: word.id,
          messageFa: `ترتیب زمانی بین کلمه «${prevWord.w}» و «${word.w}» معکوس شده است.`,
        });
      }
    }

    // Flag words manually edited or with warning flag
    if (word.hasTimingIssue) {
      issues.push({
        id: `timing-flag-${word.id}`,
        type: 'warning',
        category: 'timing',
        wordId: word.id,
        messageFa: `کلمه «${word.w}» دارای هشدار زمانبندی مشکوک است.`,
      });
    }

    if (word.srtDiff === 'mismatch') {
      issues.push({
        id: `srt-diff-${word.id}`,
        type: 'info',
        category: 'srt_diff',
        wordId: word.id,
        messageFa: `کلمه «${word.w}» با متن مرجع SRT تطابق کامل ندارد (پیشنهاد مرجع: «${word.srtSuggestedWord}»).`,
      });
    }
  }

  // 2. Cue assignment and completeness checks
  const assignedWordIds = new Set<number>();
  const duplicateWordIds = new Set<number>();

  for (let c = 0; c < cues.length; c++) {
    const cue = cues[c];

    if (!cue.wordIds || cue.wordIds.length === 0) {
      issues.push({
        id: `empty-cue-${cue.id}`,
        type: 'warning',
        category: 'empty',
        cueIndex: c,
        messageFa: `جمله شماره ${c + 1} خالی است و هیچ کلمه‌ای ندارد.`,
      });
      continue;
    }

    // Check word IDs inside this cue
    for (const wId of cue.wordIds) {
      if (assignedWordIds.has(wId)) {
        duplicateWordIds.add(wId);
      }
      assignedWordIds.add(wId);
    }

    // Check boundary coordination
    const firstWord = words.find(w => w.id === cue.wordIds[0]);
    const lastWord = words.find(w => w.id === cue.wordIds[cue.wordIds.length - 1]);

    if (firstWord && Math.abs(cue.s - firstWord.s) > 0.05) {
      issues.push({
        id: `cue-start-mismatch-${cue.id}`,
        type: 'warning',
        category: 'timing',
        cueIndex: c,
        messageFa: `زمان شروع جمله ${c + 1} (${cue.s.toFixed(2)}s) با زمان اولین کلمه («${firstWord.w}» - ${firstWord.s.toFixed(2)}s) هماهنگ نیست.`,
      });
    }

    if (lastWord && Math.abs(cue.e - lastWord.e) > 0.05) {
      issues.push({
        id: `cue-end-mismatch-${cue.id}`,
        type: 'warning',
        category: 'timing',
        cueIndex: c,
        messageFa: `زمان پایان جمله ${c + 1} (${cue.e.toFixed(2)}s) با زمان آخرین کلمه («${lastWord.w}» - ${lastWord.e.toFixed(2)}s) هماهنگ نیست.`,
      });
    }
  }

  // Check for duplicates
  if (duplicateWordIds.size > 0) {
    issues.push({
      id: 'duplicate-words-in-cues',
      type: 'error',
      category: 'assignment',
      messageFa: `${duplicateWordIds.size} کلمه در بیش از یک جمله تکرار شده‌اند! هر کلمه باید دقیقاً یک بار در خروجی باشد.`,
    });
  }

  // Check for unassigned words (dropped words)
  const missingWords: WordItem[] = [];
  for (const word of words) {
    if (!assignedWordIds.has(word.id)) {
      missingWords.push(word);
    }
  }

  if (missingWords.length > 0) {
    issues.push({
      id: 'unassigned-words',
      type: 'error',
      category: 'assignment',
      messageFa: `${missingWords.length} کلمه از جمله‌بندی جا مانده‌اند: «${missingWords.slice(0, 4).map(w => w.w).join(' ')}...»`,
    });
  }

  return issues;
}
