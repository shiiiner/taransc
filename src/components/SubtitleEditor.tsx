import React, { useState } from 'react';
import { 
  Play, 
  Merge, 
  Scissors, 
  Plus, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Sliders, 
  Check, 
  RotateCcw,
  AlignJustify,
  CornerDownLeft
} from 'lucide-react';
import { SentenceCue, WordItem } from '../types/caption';

interface SubtitleEditorProps {
  words: WordItem[];
  cues: SentenceCue[];
  activeWordId: number | null;
  activeCueIndex: number | null;
  currentTime: number;
  onPlayCue: (cue: SentenceCue) => void;
  onPlayWord: (word: WordItem) => void;
  onEditWord: (word: WordItem) => void;
  onMergeCues: (firstCueIndex: number) => void;
  onSplitCueAtWord: (cueIndex: number, wordId: number) => void;
  onUpdateCues: (updatedCues: SentenceCue[]) => void;
  onReSegmentByCount: (targetWords: number) => void;
  singleLineMode: boolean;
  onToggleSingleLineMode: () => void;
}

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  words,
  cues,
  activeWordId,
  activeCueIndex,
  currentTime,
  onPlayCue,
  onPlayWord,
  onEditWord,
  onMergeCues,
  onSplitCueAtWord,
  onUpdateCues,
  onReSegmentByCount,
  singleLineMode,
  onToggleSingleLineMode,
}) => {
  const [targetWordCount, setTargetWordCount] = useState<number>(7);
  const [hoveredSplitWordId, setHoveredSplitWordId] = useState<number | null>(null);

  // Map words by ID for fast lookup
  const wordMap = new Map<number, WordItem>();
  words.forEach(w => wordMap.set(w.id, w));

  const formatSec = (sec: number) => (isNaN(sec) ? '0.00' : sec.toFixed(2));

  return (
    <div className="space-y-4">
      {/* Editor Control Header */}
      <div className="bg-[#121622] p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Phrasing & Line Settings */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">طراحی جملات:</span>
          </div>

          {/* Single line vs multi-line */}
          <button
            onClick={onToggleSingleLineMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              singleLineMode
                ? 'bg-cyan-950/70 text-cyan-300 border-cyan-800/80'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <AlignJustify className="w-3 h-3" />
            <span>{singleLineMode ? 'حالت تک‌خطی (Caption Studio)' : 'حالت چندخطی'}</span>
          </button>
        </div>

        {/* Right: Quick Target Word Count Splitter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">تعداد کلمات هر جمله:</span>
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
            {[5, 7, 9, 12].map(count => (
              <button
                key={count}
                onClick={() => {
                  setTargetWordCount(count);
                  onReSegmentByCount(count);
                }}
                className={`px-2 py-0.5 rounded font-mono-numbers text-xs transition ${
                  targetWordCount === count
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`تنظیم جملات به طول حدود ${count} کلمه`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cues List */}
      <div className="space-y-3">
        {cues.map((cue, index) => {
          const cueWords = cue.wordIds.map(id => wordMap.get(id)).filter(Boolean) as WordItem[];
          const isCurrentCue = activeCueIndex === index;
          const cueStart = cueWords.length > 0 ? cueWords[0].s : cue.s;
          const cueEnd = cueWords.length > 0 ? cueWords[cueWords.length - 1].e : cue.e;
          const cueDuration = Math.max(0, cueEnd - cueStart);

          return (
            <div
              key={cue.id}
              className={`rounded-xl border transition-all duration-200 p-4 ${
                isCurrentCue
                  ? 'bg-[#151c2c] border-cyan-500/70 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/30'
                  : 'bg-[#11141e] border-slate-800/90 hover:border-slate-700/80'
              }`}
            >
              {/* Cue Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5 mb-3 text-xs">
                {/* Index & Timestamps */}
                <div className="flex items-center gap-3">
                  <span className="bg-slate-800 text-slate-300 font-mono-numbers font-bold px-2 py-0.5 rounded text-xs border border-slate-700">
                    #{index + 1}
                  </span>

                  <div className="flex items-center gap-1.5 font-mono-numbers text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-cyan-300 font-semibold">{formatSec(cueStart)}s</span>
                    <span className="text-slate-500">تا</span>
                    <span className="text-cyan-300 font-semibold">{formatSec(cueEnd)}s</span>
                    <span className="text-slate-500 text-[11px]">({formatSec(cueDuration)}s)</span>
                  </div>

                  <span className="text-slate-400 text-[11px] hidden sm:inline">
                    {cueWords.length} کلمه
                  </span>
                </div>

                {/* Cue Actions */}
                <div className="flex items-center gap-1.5">
                  {/* Play Sentence */}
                  <button
                    onClick={() => onPlayCue(cue)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 font-medium border border-cyan-800/60 transition"
                    title="پخش این جمله"
                  >
                    <Play className="w-3 h-3 fill-cyan-400" />
                    <span>پخش جمله</span>
                  </button>

                  {/* Merge with Next Cue */}
                  {index < cues.length - 1 && (
                    <button
                      onClick={() => onMergeCues(index)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition border border-slate-700/60"
                      title="ادغام این جمله با جمله بعدی"
                    >
                      <Merge className="w-3 h-3 text-slate-400" />
                      <span className="hidden md:inline">ادغام با بعد</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Words Flow Container */}
              <div className="flex flex-wrap items-center gap-1.5 leading-loose">
                {cueWords.map((word, wIdx) => {
                  const isActiveWord = activeWordId === word.id;
                  const isHoveredSplit = hoveredSplitWordId === word.id;
                  const hasTimingError = word.s < 0 || word.e <= word.s;
                  const isSrtMismatch = word.srtDiff === 'mismatch';

                  return (
                    <React.Fragment key={word.id}>
                      {/* Interactive Word Chip */}
                      <div
                        onClick={() => onEditWord(word)}
                        className={`group relative inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 select-none border ${
                          isActiveWord
                            ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300 shadow-md shadow-cyan-500/40 scale-105'
                            : hasTimingError
                            ? 'bg-rose-950/60 text-rose-200 border-rose-700'
                            : isSrtMismatch
                            ? 'bg-indigo-950/60 text-indigo-200 border-indigo-700'
                            : word.isEdited
                            ? 'bg-slate-800/90 text-amber-200 border-amber-600/60'
                            : 'bg-slate-800/60 hover:bg-slate-750 text-slate-100 border-slate-700/60 hover:border-slate-600'
                        }`}
                        title={`کلیک برای ویرایش • زمان: ${formatSec(word.s)}s تا ${formatSec(word.e)}s`}
                      >
                        {/* Word Text */}
                        <span>{word.w}</span>

                        {/* Timestamp badge */}
                        <span className={`text-[10px] font-mono-numbers px-1 rounded ${
                          isActiveWord ? 'bg-cyan-700/60 text-cyan-100' : 'text-slate-400 group-hover:text-slate-300'
                        }`}>
                          {formatSec(word.s)}
                        </span>

                        {/* Warnings Indicator */}
                        {hasTimingError && (
                          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                        )}

                        {/* Play snippet quick icon on hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayWord(word);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-cyan-300 transition"
                          title="پخش کلمه"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                        </button>
                      </div>

                      {/* Split Point between Words */}
                      {wIdx < cueWords.length - 1 && (
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredSplitWordId(word.id)}
                          onMouseLeave={() => setHoveredSplitWordId(null)}
                          onClick={() => onSplitCueAtWord(index, word.id)}
                          className={`w-3.5 h-6 rounded flex items-center justify-center transition-all ${
                            isHoveredSplit
                              ? 'bg-rose-600 text-white scale-125 z-10'
                              : 'text-slate-600 hover:text-rose-400 hover:bg-slate-800'
                          }`}
                          title="شکستن جمله از این نقطه (انتقال کلمات بعدی به جمله جدید)"
                        >
                          <Scissors className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* SRT Diff Warning Footer for Cue */}
              {cueWords.some(w => w.srtDiff === 'mismatch') && (
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center gap-2 text-xs text-indigo-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>برخی کلمات این جمله با متن مرجع SRT تفاوت املایی دارند (با پس‌زمینه نیلی مشخص شده است).</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
