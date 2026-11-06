/**
 * Core type definitions for Persian Caption Prep & Caption Studio integration
 */

export interface WordItem {
  id: number;          // Unique sequential global word ID (0, 1, 2, ...)
  w: string;           // Word text (with or without attached punctuation)
  s: number;           // Start time in seconds
  e: number;           // End time in seconds
  confidence?: number; // Optional confidence score (0 to 1)
  originalW?: string;  // Original raw transcript word before edits
  originalS?: number;  // Original start time
  originalE?: number;  // Original end time
  isEdited?: boolean;  // Has user edited text or timing?
  hasTimingIssue?: boolean; // If s >= e or s < 0
  isValid?: boolean;   // Whether the word has strictly valid numeric timing
  validationStatus?: 'valid' | 'missing_start' | 'missing_end' | 'negative' | 'end_before_start';
  srtDiff?: 'match' | 'mismatch' | 'missing_in_srt' | 'extra'; // Comparison with SRT reference
  srtSuggestedWord?: string;
  srtBlockIndex?: number; // SRT cue index that this word corresponds to
}

export interface SentenceCue {
  id: string;          // Cue unique ID (e.g. "cue-0")
  cueIndex: number;    // 0-indexed cue number
  s: number;           // Cue start time in seconds (s of first word)
  e: number;           // Cue end time in seconds (e of last word)
  wordIds: number[];   // Ordered list of word IDs included in this cue
  lines?: number[][];  // Word indices relative to this cue's words array for multi-line layout
  note?: string;       // User note or warning flag
}

export interface CaptionStudioWord {
  w: string;
  s: number;
  e: number;
}

export interface CaptionStudioCue {
  s: number;
  e: number;
  words: CaptionStudioWord[];
  lines: number[][];
}

export interface SrtReferenceItem {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface AlignmentDiffItem {
  wordId: number;
  transcribedWord: string;
  referenceWord?: string;
  status: 'match' | 'mismatch' | 'missing' | 'added';
  similarity: number;
}

export interface QualityCheckIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: 'timing' | 'order' | 'assignment' | 'srt_diff' | 'empty';
  wordId?: number;
  cueIndex?: number;
  messageFa: string;
  details?: string;
}

export interface ProjectState {
  version: string;
  savedAt: string;
  mediaName: string;
  mediaDuration: number;
  mediaType: 'audio' | 'video';
  words: WordItem[];
  cues: SentenceCue[];
  srtReference?: {
    fileName: string;
    items: SrtReferenceItem[];
  };
  settings: {
    targetWordsPerLine: number;
    singleLineMode: boolean;
    autoBreakPunctuations: boolean;
  };
}
