import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  FileText, 
  FileCheck,
  AlertOctagon,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { WordItem, SentenceCue, QualityCheckIssue } from '../types/caption';
import { 
  generateCaptionStudioJson, 
  generateSrtContent, 
  generatePlainText, 
  downloadFile 
} from '../utils/exportFormats';
import { runQualityControl } from '../utils/qcValidator';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  words: WordItem[];
  cues: SentenceCue[];
  mediaName: string;
  mediaDuration: number;
  singleLineMode: boolean;
  onSaveFullProject: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  words,
  cues,
  mediaName,
  mediaDuration,
  singleLineMode,
  onSaveFullProject,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'caption_studio' | 'srt' | 'txt'>('caption_studio');
  const [copied, setCopied] = useState(false);

  // Run comprehensive validation (Priority 5)
  const qcIssues = runQualityControl(words, cues);
  const criticalErrors = qcIssues.filter(i => i.type === 'error');
  const warnings = qcIssues.filter(i => i.type === 'warning');
  const hasCriticalErrors = criticalErrors.length > 0;

  // Generate contents
  const captionStudioData = generateCaptionStudioJson(words, cues, singleLineMode);
  const jsonContent = JSON.stringify(captionStudioData, null, 2);
  const srtContent = generateSrtContent(words, cues);
  const txtContent = generatePlainText(words, cues);

  const baseFileName = (mediaName.replace(/\.[^/.]+$/, '') || 'persian_captions').trim();

  const handleCopy = () => {
    let contentToCopy = '';
    if (activeTab === 'caption_studio') contentToCopy = jsonContent;
    else if (activeTab === 'srt') contentToCopy = srtContent;
    else contentToCopy = txtContent;

    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (activeTab === 'caption_studio') {
      if (hasCriticalErrors) {
        return;
      }
      downloadFile(jsonContent, `${baseFileName}_caption_studio.json`, 'application/json');
    } else if (activeTab === 'srt') {
      downloadFile(srtContent, `${baseFileName}.srt`, 'text/plain;charset=utf-8');
    } else {
      downloadFile(txtContent, `${baseFileName}.txt`, 'text/plain;charset=utf-8');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div 
        className="bg-[#121622] border border-slate-700/80 rounded-2xl w-full max-w-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950/50">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">خروجی‌های نهایی زیرنویس</h3>
              <p className="text-xs text-slate-400">
                خروجی JSON اختصاصی Caption Studio، زیرنویس استاندارد SRT و متن ساده
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

        {/* Priority 5: Safety Validation Banner */}
        {hasCriticalErrors ? (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/80 rounded-xl space-y-1.5 text-xs text-rose-300">
            <div className="flex items-center gap-2 font-bold text-rose-200">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
              <span>خطای بحرانی در اعتبارسنجی: دانلود فایل Caption Studio غیرفعال شده است.</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pr-2 text-[11px] text-rose-300/90">
              {criticalErrors.map((err) => (
                <li key={err.id}>{err.messageFa}</li>
              ))}
            </ul>
          </div>
        ) : warnings.length > 0 ? (
          <div className="p-2.5 bg-amber-950/30 border border-amber-800/60 rounded-xl flex items-center gap-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>هشدار: {warnings.length} مورد مشکوک در زمان‌بندی وجود دارد اما ساختار برای اکسپورت قابل قبول است.</span>
          </div>
        ) : (
          <div className="p-2 bg-emerald-950/30 border border-emerald-800/50 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>تمامی زمان‌بندی‌ها، شناسه‌ها و مرز جملات معتبر بوده و با Caption Studio کاملاً سازگار است.</span>
          </div>
        )}

        {/* Format Selector Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
          <button
            onClick={() => setActiveTab('caption_studio')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold transition border-b-2 ${
              activeTab === 'caption_studio'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>JSON اسکریپت Caption Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('srt')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold transition border-b-2 ${
              activeTab === 'srt'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>استاندارد SRT</span>
          </button>

          <button
            onClick={() => setActiveTab('txt')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold transition border-b-2 ${
              activeTab === 'txt'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>متن خالص (TXT)</span>
          </button>
        </div>

        {/* Code / Text Preview Window */}
        <div className="flex-1 bg-[#0a0d14] rounded-xl border border-slate-800/90 p-4 font-mono text-xs overflow-auto max-h-72 text-left text-slate-200 select-all" dir="ltr">
          <pre className="whitespace-pre">
            {activeTab === 'caption_studio' && jsonContent}
            {activeTab === 'srt' && srtContent}
            {activeTab === 'txt' && txtContent}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            {activeTab === 'caption_studio' && (
              <span>این فایل منحصراً برای اسکریپت Caption Studio در After Effects تولید می‌شود.</span>
            )}
            {activeTab === 'srt' && <span>سازگار با انواع نرم‌افزارهای تدوین و پخش‌کننده‌ها.</span>}
            {activeTab === 'txt' && <span>متن پیوسته بدون زمان‌بندی برای مطالعه یا انتشار.</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 transition border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'کپی شد!' : 'کپی در حافظه'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={activeTab === 'caption_studio' && hasCriticalErrors}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white transition shadow-md shadow-cyan-950/50 ${
                activeTab === 'caption_studio' && hasCriticalErrors
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
              }`}
              title={
                activeTab === 'caption_studio' && hasCriticalErrors
                  ? 'ابتدا خطاهای بحرانی زمان‌بندی را برطرف کنید.'
                  : 'دانلود فایل'
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود فایل</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
