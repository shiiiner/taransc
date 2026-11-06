import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileAudio, 
  FileVideo, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  PlayCircle,
  Zap,
  Mic
} from 'lucide-react';
import { parseSrt } from '../utils/persianNormalizer';
import { SrtReferenceItem } from '../types/caption';

export type TranscriptionEngine = 'gemini-3.8-flash' | 'gemini-3.5-transcribe';

interface MediaDropzoneProps {
  onMediaSelected: (file: File, srtItems?: SrtReferenceItem[], srtFileName?: string, engine?: TranscriptionEngine) => void;
  onUseSampleAudio: () => void;
  isProcessing: boolean;
  processingStage: string;
  processingProgress: number;
  processingError?: string | null;
  onRetry?: (engine?: TranscriptionEngine) => void;
  onCancel?: () => void;
}

export const MediaDropzone: React.FC<MediaDropzoneProps> = ({
  onMediaSelected,
  onUseSampleAudio,
  isProcessing,
  processingStage,
  processingProgress,
  processingError,
  onRetry,
  onCancel,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<TranscriptionEngine>('gemini-3.8-flash');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [srtItems, setSrtItems] = useState<SrtReferenceItem[] | null>(null);
  const [dragOverMedia, setDragOverMedia] = useState(false);
  const [dragOverSrt, setDragOverSrt] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    let timer: any;
    if (isProcessing) {
      setElapsedSec(0);
      timer = setInterval(() => {
        setElapsedSec(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSec(0);
    }
    return () => clearInterval(timer);
  }, [isProcessing]);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);

  const handleMediaFileChange = (file: File) => {
    setErrorMsg(null);
    const audioExts = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'];
    const videoExts = ['mp4', 'mov', 'webm', 'mkv'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!audioExts.includes(ext) && !videoExts.includes(ext) && !file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      setErrorMsg('فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل صوتی (MP3, WAV, M4A, AAC, FLAC) یا ویدئویی (MP4, MOV, WebM) انتخاب کنید.');
      return;
    }

    setMediaFile(file);
  };

  const handleSrtFileChange = async (file: File) => {
    try {
      const text = await file.text();
      const items = parseSrt(text);
      if (items.length === 0) {
        setErrorMsg('فایل SRT حاوی زیرنویس معتبری نبود.');
        return;
      }
      setSrtFile(file);
      setSrtItems(items);
    } catch {
      setErrorMsg('خطا در خواندن فایل SRT.');
    }
  };

  const handleStartProcessing = () => {
    if (!mediaFile) {
      setErrorMsg('لطفاً ابتدا فایل صوتی یا ویدئویی را انتخاب کنید.');
      return;
    }
    onMediaSelected(mediaFile, srtItems || undefined, srtFile?.name, selectedEngine);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Intro Box */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 text-xs font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>پشتیبانی از مدل فوق‌سریع Gemini 3.8 Flash و Gemini 3.5 Transcribe</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          آماده‌سازی تخصصی زیرنویس و کپشن فارسی
        </h2>
        <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
          فایل ویدئو یا صوت فارسی خود را وارد کنید تا متن دقیق کلمات با زمان‌بندی صدم‌ثانیه‌ای استخراج شده و جمله‌بندی هوشمند متناسب با After Effects آماده شود.
        </p>
      </div>

      {/* Main Upload Container */}
      <div className="bg-[#121622] rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-6">
        {/* Engine Selector */}
        <div className="space-y-2 pb-2 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span>انتخاب موتور هوش مصنوعی برای تبدیل صوت و زمان‌بندی:</span>
            </label>
            <span className="text-[11px] text-cyan-400 font-medium">سریع & بدون گیر کردن</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Option 1: Gemini 3.8 Flash (Recommended) */}
            <div
              onClick={() => !isProcessing && setSelectedEngine('gemini-3.8-flash')}
              className={`p-3.5 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                selectedEngine === 'gemini-3.8-flash'
                  ? 'bg-gradient-to-br from-cyan-950/60 to-blue-950/40 border-cyan-500/80 ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-950/30'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">Gemini 3.8 Flash</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          پیشنهادی
                        </span>
                      </div>
                      <span className="text-[11px] text-cyan-300 font-mono-numbers">فوق‌سریع (۳ تا ۵ ثانیه) • پایداری بالا</span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedEngine === 'gemini-3.8-flash' ? 'border-cyan-400 bg-cyan-500' : 'border-slate-600'
                  }`}>
                    {selectedEngine === 'gemini-3.8-flash' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                  پاسخ‌دهی آنی بدون گیر کردن روی ۵۰٪، سهمیه بسیار بالاتر، درک عمیق زبان و اصطلاحات فارسی همراه با برچسب‌های زمانی صدم‌ثانیه‌ای کلمات.
                </p>
              </div>
            </div>

            {/* Option 2: Gemini 3.5 Transcribe */}
            <div
              onClick={() => !isProcessing && setSelectedEngine('gemini-3.5-transcribe')}
              className={`p-3.5 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                selectedEngine === 'gemini-3.5-transcribe'
                  ? 'bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border-indigo-500/80 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-950/30'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">Gemini 3.5 Transcribe</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          مدل صوتی
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono-numbers">Native Audio Annotations</span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    selectedEngine === 'gemini-3.5-transcribe' ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                  }`}>
                    {selectedEngine === 'gemini-3.5-transcribe' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                  مدل اختصاصی استخراج گفتار گوگل (سهمیه ۳ درخواست در دقیقه؛ در صورت پر شدن ترافیک، به طور هوشمند به Flash سوییچ می‌کند).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Media Dropzone */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            ۱. انتخاب یا رهاسازی فایل صوتی / ویدئویی <span className="text-cyan-400">*</span>
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOverMedia(true); }}
            onDragLeave={() => setDragOverMedia(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverMedia(false);
              if (e.dataTransfer.files?.[0]) handleMediaFileChange(e.dataTransfer.files[0]);
            }}
            onClick={() => !isProcessing && mediaInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
              dragOverMedia
                ? 'border-cyan-400 bg-cyan-950/20'
                : mediaFile
                ? 'border-emerald-600/70 bg-emerald-950/10'
                : 'border-slate-700 hover:border-slate-500 bg-slate-900/40 hover:bg-slate-900/80'
            }`}
          >
            <input
              ref={mediaInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.mp4,.mov,.webm"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleMediaFileChange(e.target.files[0])}
              disabled={isProcessing}
            />

            {mediaFile ? (
              <div className="flex items-center gap-4 text-right w-full max-w-md bg-slate-800/80 p-3.5 rounded-lg border border-slate-700">
                <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  {mediaFile.type.startsWith('video') || mediaFile.name.match(/\.(mp4|mov|webm)$/i) ? (
                    <FileVideo className="w-6 h-6" />
                  ) : (
                    <FileAudio className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100 truncate">{mediaFile.name}</p>
                  <p className="text-xs text-slate-400 font-mono-numbers">
                    {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB • {mediaFile.type || 'رسانه'}
                  </p>
                </div>
                <span className="text-xs text-cyan-400 hover:underline">تغییر فایل</span>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-cyan-400 shadow-inner">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    فایل صوتی یا ویدئویی را اینجا بکشید یا <span className="text-cyan-400 font-semibold underline">کلیک کنید</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    پشتیبانی از فرمت‌های صوتی: <span className="font-mono text-slate-300">MP3, WAV, M4A, AAC, FLAC</span> و ویدئویی: <span className="font-mono text-slate-300">MP4, MOV, WebM</span>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Step 2: Optional SRT Reference File */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300">
              ۲. فایل SRT مرجع و اصلاح‌شده (اختیاری)
            </label>
            <span className="text-[11px] text-slate-400">برای مقایسه املایی و همترازی</span>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOverSrt(true); }}
            onDragLeave={() => setDragOverSrt(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverSrt(false);
              if (e.dataTransfer.files?.[0]) handleSrtFileChange(e.dataTransfer.files[0]);
            }}
            onClick={() => !isProcessing && srtInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition flex items-center justify-between gap-3 ${
              dragOverSrt
                ? 'border-indigo-400 bg-indigo-950/20'
                : srtFile
                ? 'border-indigo-600/70 bg-indigo-950/10'
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/30'
            }`}
          >
            <input
              ref={srtInputRef}
              type="file"
              accept=".srt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleSrtFileChange(e.target.files[0])}
              disabled={isProcessing}
            />

            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-indigo-400" />
              <div className="text-right">
                {srtFile ? (
                  <div>
                    <p className="text-xs font-medium text-slate-200">{srtFile.name}</p>
                    <p className="text-[10px] text-indigo-300 font-mono-numbers">
                      {srtItems?.length || 0} خط زیرنویس مرجع بارگذاری شد
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    اگر زیرنویس اصلاح‌شده دارید، فایل <span className="font-mono text-indigo-300">.SRT</span> را اضافه کنید تا اختلاف‌ها هایلایت شوند.
                  </p>
                )}
              </div>
            </div>

            {srtFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSrtFile(null);
                  setSrtItems(null);
                }}
                className="text-xs text-rose-400 hover:underline px-2"
              >
                حذف
              </button>
            )}
          </div>
        </div>

        {/* Error Alert from client validation */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Server / Transcription Processing Error with Retry */}
        {processingError && !isProcessing && (
          <div className="p-4 bg-rose-950/50 border border-rose-700/80 rounded-xl space-y-3">
            <div className="flex items-start gap-3 text-rose-200 text-xs leading-relaxed">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-bold text-rose-100">خطا در پردازش یا رونویسی فایل:</p>
                <p className="text-rose-300/90">{processingError}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-900/60">
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(selectedEngine)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-800 hover:bg-rose-700 text-white transition shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تلاش مجدد رونویسی ({selectedEngine === 'gemini-3.8-flash' ? 'با Gemini Flash' : 'با Transcribe'})</span>
                </button>
              )}
              <button
                type="button"
                onClick={onUseSampleAudio}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
              >
                <PlayCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>تست با نمونه صوتی فارسی (آفلاین / دمو)</span>
              </button>
            </div>
          </div>
        )}

        {/* Progress Display */}
        {isProcessing && (
          <div className="p-5 bg-slate-900/95 rounded-xl border border-cyan-800/70 shadow-2xl shadow-cyan-950/40 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="font-bold text-slate-100 truncate">{processingStage}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400 font-mono-numbers px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700">
                  ⏱️ {elapsedSec} ثانیه
                </span>
                <span className="font-mono-numbers text-cyan-400 font-extrabold text-sm">{Math.round(processingProgress)}%</span>
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/60">
              <div
                className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${Math.max(5, Math.min(100, processingProgress))}%` }}
              />
            </div>

            {/* Visual Audio Activity Indicator */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/70 text-[11px]">
              <div className="flex items-center gap-2 text-slate-400">
                <div className="flex items-end gap-1 h-3.5">
                  <div className="w-1 bg-cyan-400 rounded-full animate-pulse h-3" />
                  <div className="w-1 bg-cyan-300 rounded-full animate-pulse h-2 delay-75" />
                  <div className="w-1 bg-blue-400 rounded-full animate-pulse h-3.5 delay-150" />
                  <div className="w-1 bg-indigo-400 rounded-full animate-pulse h-2 delay-100" />
                </div>
                <span>
                  {selectedEngine === 'gemini-3.8-flash'
                    ? elapsedSec < 10
                      ? 'مدل فوق‌سریع Gemini 3.8 Flash در حال استخراج و تحلیل کلمات گفتار فارسی...'
                      : 'هوش مصنوعی در حال اعتبارسنجی زمان‌بندی دقیق صدم‌ثانیه‌ای کلمات...'
                    : elapsedSec < 15
                    ? 'مدل Gemini 3.5 Transcribe در حال واکاوی سیگنال صوتی و واژگان فارسی...'
                    : elapsedSec < 35
                    ? 'هوش مصنوعی در حال استخراج برچسب‌های زمانی صدم‌ثانیه‌ای هر کلمه (Word Timestamps)...'
                    : 'در حال نهایی‌سازی واژه‌ها و اعتبارسنجی دقیق زمان شروع و پایان...'}
                </span>
              </div>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-950/60 border border-rose-800/60 transition"
                >
                  لغو پردازش
                </button>
              )}
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {/* Quick Demo Button */}
          <button
            type="button"
            onClick={onUseSampleAudio}
            disabled={isProcessing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition border border-slate-700/60 disabled:opacity-50"
          >
            <PlayCircle className="w-4 h-4 text-cyan-400" />
            <span>تست فوری با نمونه صوتی فارسی</span>
          </button>

          {/* Start Processing Button */}
          <button
            type="button"
            onClick={handleStartProcessing}
            disabled={!mediaFile || isProcessing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition shadow-lg shadow-cyan-950/60 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4 text-cyan-200" />
            <span>شروع تبدیل صوت و آماده‌سازی زیرنویس</span>
          </button>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="bg-[#121622]/50 border border-slate-800/80 rounded-xl p-4">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center mb-2.5 border border-cyan-800/50">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-200 mb-1">تایم‌استمپ واقعی کلمات</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            استخراج مستقیم زمان شروع و پایان هر کلمه از API رسمی بدون هرگونه زمان ساختگی یا فرضی.
          </p>
        </div>

        <div className="bg-[#121622]/50 border border-slate-800/80 rounded-xl p-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center mb-2.5 border border-indigo-800/50">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-200 mb-1">جمله‌بندی هوشمند فارسی</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            گروه‌بندی عبارات بر اساس مکث‌ها و دستور زبان بدون تغییر ترتیب کلمات یا حذف واژه‌ها.
          </p>
        </div>

        <div className="bg-[#121622]/50 border border-slate-800/80 rounded-xl p-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center mb-2.5 border border-emerald-800/50">
            <FileText className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-slate-200 mb-1">خروجی مستقیم Caption Studio</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            فرمت JSON سازگار صددرصد با اسکریپت افتر افکتس برای ساخت موشن کپشن‌های شبکه‌های اجتماعی.
          </p>
        </div>
      </div>
    </div>
  );
};
