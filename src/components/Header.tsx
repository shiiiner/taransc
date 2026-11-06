import React from 'react';
import { 
  FileText, 
  Download, 
  ShieldCheck, 
  RotateCcw, 
  Save, 
  UploadCloud,
  Sparkles,
  AlertTriangle,
  Zap
} from 'lucide-react';

interface HeaderProps {
  onNewProject: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onOpenQc: () => void;
  onOpenExport: () => void;
  onReSegment: () => void;
  qcIssuesCount: number;
  wordCount: number;
  cueCount: number;
  hasMedia: boolean;
  isProcessing: boolean;
  activeEngine?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onNewProject,
  onSaveProject,
  onLoadProject,
  onOpenQc,
  onOpenExport,
  onReSegment,
  qcIssuesCount,
  wordCount,
  cueCount,
  hasMedia,
  isProcessing,
  activeEngine,
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#0e111a]/95 backdrop-blur sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Branding & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/30 ring-1 ring-cyan-400/20">
            <span className="font-bold text-white text-base tracking-wider font-mono">CP</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Persian Caption Prep</h1>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 font-medium px-2 py-0.5 rounded-full border border-cyan-800/60">
                After Effects / Caption Studio
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              آماده‌سازی تخصصی زیرنویس فارسی با زمان‌بندی کلمه‌به‌کلمه و جمله‌بندی هوشمند
            </p>
          </div>
        </div>

        {/* Stats & Project Info */}
        {hasMedia && (
          <div className="hidden md:flex items-center gap-3 text-xs bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">کلمات:</span>
              <span className="font-mono-numbers text-cyan-400 font-semibold">{wordCount}</span>
            </div>
            <div className="w-px h-3 bg-slate-800" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">جملات:</span>
              <span className="font-mono-numbers text-indigo-400 font-semibold">{cueCount}</span>
            </div>
            {activeEngine && (
              <>
                <div className="w-px h-3 bg-slate-800" />
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">موتور:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>{activeEngine.includes('flash') ? 'Gemini 3.8 Flash' : 'Gemini 3.5 Transcribe'}</span>
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasMedia && (
            <>
              {/* Re-segment Button */}
              <button
                onClick={onReSegment}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition border border-slate-700/60 disabled:opacity-50"
                title="جمله‌بندی مجدد هوشمند با Gemini 3.8"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">جمله‌بندی هوشمند</span>
              </button>

              {/* Quality Control Button */}
              <button
                onClick={onOpenQc}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
                  qcIssuesCount > 0
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:bg-amber-900/60'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40'
                }`}
                title="بررسی کنترل کیفیت زیرنویس"
              >
                {qcIssuesCount > 0 ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>کنترل کیفیت</span>
                    <span className="bg-amber-500/20 px-1.5 rounded text-[10px] font-mono-numbers font-bold text-amber-300">
                      {qcIssuesCount}
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">کنترل کیفیت (تأیید)</span>
                  </>
                )}
              </button>

              {/* Save Project */}
              <button
                onClick={onSaveProject}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition border border-slate-700/60"
                title="ذخیره پروژه ویرایش‌شده (JSON)"
              >
                <Save className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden xl:inline">ذخیره پروژه</span>
              </button>

              {/* Export Button */}
              <button
                onClick={onOpenExport}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white transition shadow-md shadow-cyan-950/50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>خروجی نهایی</span>
              </button>
            </>
          )}

          {/* Load Project */}
          <button
            onClick={onLoadProject}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition border border-slate-700/50"
            title="بازخوانی پروژه قبلی"
          >
            <UploadCloud className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">بازخوانی</span>
          </button>

          {/* New Project */}
          {hasMedia && (
            <button
              onClick={onNewProject}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="شروع پروژه جدید"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
