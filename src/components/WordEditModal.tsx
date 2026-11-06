import React, { useState } from 'react';
import { 
  X, 
  Play, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  Clock, 
  Edit3,
  Sparkles
} from 'lucide-react';
import { WordItem } from '../types/caption';

interface WordEditModalProps {
  word: WordItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedWord: WordItem) => void;
  onPlayWordAudio: (start: number, end: number) => void;
}

export const WordEditModal: React.FC<WordEditModalProps> = ({
  word,
  isOpen,
  onClose,
  onSave,
  onPlayWordAudio,
}) => {
  if (!isOpen || !word) return null;

  const [text, setText] = useState(word.w);
  const [startTime, setStartTime] = useState(word.s);
  const [endTime, setEndTime] = useState(word.e);

  const duration = Math.max(0, endTime - startTime);
  const hasTimingError = startTime < 0 || endTime <= startTime;

  const handleAdjustStart = (delta: number) => {
    const newStart = Math.max(0, Number((startTime + delta).toFixed(3)));
    setStartTime(newStart);
  };

  const handleAdjustEnd = (delta: number) => {
    const newEnd = Math.max(startTime + 0.02, Number((endTime + delta).toFixed(3)));
    setEndTime(newEnd);
  };

  const handleRevert = () => {
    if (word.originalW) setText(word.originalW);
    if (typeof word.originalS === 'number') setStartTime(word.originalS);
    if (typeof word.originalE === 'number') setEndTime(word.originalE);
  };

  const handleApplySrtSuggestion = () => {
    if (word.srtSuggestedWord) {
      setText(word.srtSuggestedWord);
    }
  };

  const handleSave = () => {
    onSave({
      ...word,
      w: text.trim(),
      s: Number(startTime.toFixed(3)),
      e: Number(endTime.toFixed(3)),
      isEdited: true,
      hasTimingIssue: hasTimingError,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div 
        className="bg-[#121622] border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">ویرایش کلمه و زمان‌بندی</h3>
              <p className="text-[11px] text-slate-400 font-mono-numbers">شناسه کلمه: #{word.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Word Text Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            متن و املای کلمه:
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white font-medium focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />

          {/* SRT Suggestion Button if available */}
          {word.srtSuggestedWord && word.srtSuggestedWord !== text && (
            <div className="mt-2 p-2 bg-indigo-950/40 border border-indigo-800/60 rounded-lg flex items-center justify-between text-xs text-indigo-300">
              <span>پیشنهاد SRT مرجع: <strong className="text-white font-semibold">«{word.srtSuggestedWord}»</strong></span>
              <button
                type="button"
                onClick={handleApplySrtSuggestion}
                className="text-[11px] font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded transition"
              >
                جایگزینی
              </button>
            </div>
          )}
        </div>

        {/* Word Timestamps (Start & End) */}
        <div className="grid grid-cols-2 gap-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          {/* Start Time */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-400">زمان شروع (ثانیه)</span>
              <span className="text-[10px] text-cyan-400 font-mono-numbers">{startTime.toFixed(3)}s</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAdjustStart(-0.05)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-mono text-slate-200"
                title="۰.۰۵ ثانیه قبل‌تر"
              >
                -0.05
              </button>
              <input
                type="number"
                step="0.01"
                min="0"
                value={startTime}
                onChange={(e) => setStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-center font-mono-numbers text-white"
              />
              <button
                type="button"
                onClick={() => handleAdjustStart(0.05)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-mono text-slate-200"
                title="۰.۰۵ ثانیه بعدتر"
              >
                +0.05
              </button>
            </div>
          </div>

          {/* End Time */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-400">زمان پایان (ثانیه)</span>
              <span className="text-[10px] text-cyan-400 font-mono-numbers">{endTime.toFixed(3)}s</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAdjustEnd(-0.05)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-mono text-slate-200"
                title="۰.۰۵ ثانیه قبل‌تر"
              >
                -0.05
              </button>
              <input
                type="number"
                step="0.01"
                min="0"
                value={endTime}
                onChange={(e) => setEndTime(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-center font-mono-numbers text-white"
              />
              <button
                type="button"
                onClick={() => handleAdjustEnd(0.05)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-mono text-slate-200"
                title="۰.۰۵ ثانیه بعدتر"
              >
                +0.05
              </button>
            </div>
          </div>
        </div>

        {/* Duration & Warnings */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono-numbers">
            <Clock className="w-3.5 h-3.5" />
            <span>مدت ادای کلمه: {duration.toFixed(3)} ثانیه</span>
          </div>

          {/* Play Word Snippet Button */}
          <button
            type="button"
            onClick={() => onPlayWordAudio(startTime, endTime)}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium text-xs transition"
          >
            <Play className="w-3.5 h-3.5 fill-cyan-400" />
            <span>شنیدن این کلمه</span>
          </button>
        </div>

        {hasTimingError && (
          <div className="p-2.5 bg-rose-950/50 border border-rose-800/80 rounded-lg flex items-center gap-2 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>خطا: زمان پایان باید بعد از زمان شروع باشد و زمان شروع نمی‌تواند منفی باشد.</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleRevert}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازگردانی به زمان اولیه</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={hasTimingError || !text.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>ذخیره تغییرات</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
