import React from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  AlertOctagon,
  ArrowRight
} from 'lucide-react';
import { QualityCheckIssue } from '../types/caption';

interface QualityControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: QualityCheckIssue[];
  wordCount: number;
  cueCount: number;
  onSelectWord?: (wordId: number) => void;
  onSelectCue?: (cueIndex: number) => void;
}

export const QualityControlModal: React.FC<QualityControlModalProps> = ({
  isOpen,
  onClose,
  issues,
  wordCount,
  cueCount,
  onSelectWord,
  onSelectCue,
}) => {
  if (!isOpen) return null;

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');
  const infos = issues.filter(i => i.type === 'info');

  const isAllValid = errors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div 
        className="bg-[#121622] border border-slate-700/80 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isAllValid
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                : 'bg-amber-950/80 text-amber-400 border-amber-800/60'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">کنترل کیفیت و ارزیابی زیرنویس (QC)</h3>
              <p className="text-xs text-slate-400">
                بررسی صحت زمان‌بندی، ترتیب کلمات و تطابق خروجی با استاندارد Caption Studio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Summary Banner */}
        <div className={`p-4 rounded-xl border flex items-center justify-between ${
          isAllValid
            ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
            : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            {isAllValid ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0" />
            )}
            <div>
              <p className="text-sm font-bold">
                {isAllValid
                  ? 'تمامی معیارهای کیفی تأیید شدند و آماده خروجی نهایی است.'
                  : `${errors.length} خطای بحرانی در زمان‌بندی یا جمله‌بندی یافت شد.`}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                مجموع کلمات: {wordCount} • تعداد جملات: {cueCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono-numbers">
            {errors.length > 0 && (
              <span className="bg-rose-500/20 text-rose-300 px-2 py-1 rounded-md border border-rose-800">
                {errors.length} خطا
              </span>
            )}
            {warnings.length > 0 && (
              <span className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded-md border border-amber-800">
                {warnings.length} هشدار
              </span>
            )}
            {infos.length > 0 && (
              <span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-md border border-indigo-800">
                {infos.length} مغایرت SRT
              </span>
            )}
          </div>
        </div>

        {/* Issues List Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {issues.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              هیچ مغایرت یا مشکلی در زمان‌بندی و ترتیب کلمات یافت نشد.
            </div>
          ) : (
            issues.map((issue) => {
              const isError = issue.type === 'error';
              const isWarning = issue.type === 'warning';

              return (
                <div
                  key={issue.id}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                    isError
                      ? 'bg-rose-950/20 border-rose-800/50 text-rose-200'
                      : isWarning
                      ? 'bg-amber-950/20 border-amber-800/50 text-amber-200'
                      : 'bg-indigo-950/20 border-indigo-800/50 text-indigo-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isError ? (
                      <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                    )}
                    <span>{issue.messageFa}</span>
                  </div>

                  {/* Jump button if linked to word or cue */}
                  {(issue.wordId !== undefined || issue.cueIndex !== undefined) && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (issue.wordId !== undefined && onSelectWord) onSelectWord(issue.wordId);
                        else if (issue.cueIndex !== undefined && onSelectCue) onSelectCue(issue.cueIndex);
                      }}
                      className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 hover:underline shrink-0 flex items-center gap-1"
                    >
                      <span>مشاهده در متن</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            برای خروجی دقیق، توصیه می‌شود تمام خطاهای قرمز قبل از اکسپورت اصلاح شوند.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
