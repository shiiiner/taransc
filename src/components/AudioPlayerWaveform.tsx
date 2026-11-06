import React, { useRef, useEffect, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Repeat,
  Video as VideoIcon,
  Music,
  Eye,
  EyeOff
} from 'lucide-react';
import { SentenceCue, WordItem } from '../types/caption';

interface AudioPlayerWaveformProps {
  originalMediaUrl: string;
  extractedAudioUrl: string;
  mediaType: 'audio' | 'video';
  duration: number;
  waveformPeaks: number[];
  currentTime: number;
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  cues: SentenceCue[];
  words: WordItem[];
  activeCueIndex: number | null;
  activeWordId: number | null;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  loopActiveCue: boolean;
  onToggleLoopCue: () => void;
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;
  onTimeUpdate: () => void;
  onEnded: () => void;
}

export const AudioPlayerWaveform: React.FC<AudioPlayerWaveformProps> = ({
  originalMediaUrl,
  extractedAudioUrl,
  mediaType,
  duration,
  waveformPeaks,
  currentTime,
  isPlaying,
  onPlayPause,
  onSeek,
  cues,
  words,
  activeCueIndex,
  activeWordId,
  playbackRate,
  onChangePlaybackRate,
  loopActiveCue,
  onToggleLoopCue,
  mediaRef,
  onTimeUpdate,
  onEnded,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showVideoPreview, setShowVideoPreview] = useState<boolean>(true);

  // Format seconds to MM:SS.ms
  const formatTime = (sec: number): string => {
    if (isNaN(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  // Find active cue words for live caption preview on video
  const activeCue = activeCueIndex !== null ? cues[activeCueIndex] : null;
  const wordMap = new Map<number, WordItem>();
  words.forEach(w => wordMap.set(w.id, w));
  const activeCueWords = activeCue ? activeCue.wordIds.map(id => wordMap.get(id)).filter(Boolean) as WordItem[] : [];

  // Render canvas waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw background grid line
    ctx.strokeStyle = '#181e2b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const peaks = waveformPeaks && waveformPeaks.length > 0
      ? waveformPeaks
      : new Array(200).fill(0.3);

    const progressRatio = duration > 0 ? currentTime / duration : 0;
    const playheadX = Math.max(0, Math.min(width, progressRatio * width));

    // Draw cue boundaries
    if (duration > 0 && cues.length > 0) {
      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i];
        const cueStartX = (cue.s / duration) * width;
        const cueEndX = (cue.e / duration) * width;
        const isCurrentCue = i === activeCueIndex;

        // Highlight active cue segment
        if (isCurrentCue) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
          ctx.fillRect(cueStartX, 0, cueEndX - cueStartX, height);
        }

        // Cue boundary markers
        ctx.strokeStyle = isCurrentCue ? 'rgba(6, 182, 212, 0.7)' : 'rgba(71, 85, 105, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cueStartX, 0);
        ctx.lineTo(cueStartX, height);
        ctx.stroke();
      }
    }

    // Draw audio bars
    const barWidth = width / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const barHeight = Math.max(2, peak * (height * 0.85));
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      const isPlayed = x <= playheadX;

      if (isPlayed) {
        ctx.fillStyle = '#06b6d4'; // Cyan for played portion
      } else {
        ctx.fillStyle = '#334155'; // Slate for unplayed portion
      }

      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    }

    // Draw Playhead line
    ctx.strokeStyle = '#f43f5e'; // Rose / red playhead
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead handle top
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(playheadX, 4, 4, 0, Math.PI * 2);
    ctx.fill();

  }, [waveformPeaks, currentTime, duration, cues, activeCueIndex]);

  // Handle canvas click to seek
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="bg-[#121622] border-b border-slate-800 p-3 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Priority 2: Video Player with Live Caption Overlay (plays original media) */}
        {mediaType === 'video' && originalMediaUrl && showVideoPreview && (
          <div className="relative mx-auto max-w-xl bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl aspect-video group">
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={originalMediaUrl}
              onTimeUpdate={onTimeUpdate}
              onEnded={onEnded}
              onClick={onPlayPause}
              className="w-full h-full object-contain cursor-pointer"
              playsInline
            />

            {/* Live Subtitle Overlay on Video */}
            {activeCueWords.length > 0 && (
              <div 
                className="absolute bottom-4 inset-x-4 flex justify-center pointer-events-none"
                dir="rtl"
              >
                <div className="bg-black/75 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-center max-w-lg shadow-xl">
                  <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm sm:text-base font-semibold leading-relaxed">
                    {activeCueWords.map(w => {
                      const isActive = activeWordId === w.id;
                      return (
                        <span
                          key={w.id}
                          className={`px-1 rounded transition-colors ${
                            isActive
                              ? 'text-cyan-400 bg-cyan-950/80 underline decoration-cyan-400 decoration-2'
                              : 'text-white'
                          }`}
                        >
                          {w.w}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hidden Audio Player for audio files */}
        {mediaType === 'audio' && originalMediaUrl && (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={originalMediaUrl}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            className="hidden"
          />
        )}

        {/* Waveform Canvas & Time Bar */}
        <div className="relative group">
          <div
            ref={containerRef}
            className="w-full h-20 sm:h-24 bg-[#0a0d14] rounded-xl border border-slate-800/90 overflow-hidden cursor-pointer relative shadow-inner"
          >
            <canvas
              ref={canvasRef}
              width={1000}
              height={96}
              onClick={handleCanvasClick}
              className="w-full h-full block"
            />
          </div>

          {/* Time markers info floating */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-numbers px-1 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span className="text-slate-400">
              {activeCueIndex !== null ? `جمله فعال: #${activeCueIndex + 1}` : 'آماده پخش'}
            </span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Player Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Main Transport (Play / Pause / Skips) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSeek(Math.max(0, currentTime - 3))}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="۳ ثانیه به عقب (کلید میانبر J)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onPlayPause}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition shadow-lg shadow-cyan-950/40 flex items-center gap-2"
              title="پخش / توقف (کلید فاصله Space)"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
              <span className="text-xs">{isPlaying ? 'توقف' : 'پخش'}</span>
            </button>

            <button
              onClick={() => onSeek(Math.min(duration, currentTime + 3))}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="۳ ثانیه به جلو (کلید میانبر L)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Loop Cue Toggle */}
            <button
              onClick={onToggleLoopCue}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
                loopActiveCue
                  ? 'bg-cyan-950/70 border-cyan-700 text-cyan-300'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200'
              }`}
              title="تکرار مداوم جمله فعلی برای بررسی دقیق"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">لوپ جمله</span>
            </button>
          </div>

          {/* Speed, Media Type & Video Toggle Badges */}
          <div className="flex items-center gap-2">
            {/* Playback speed buttons */}
            <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60 text-xs font-mono-numbers">
              {[0.75, 1, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  onClick={() => onChangePlaybackRate(rate)}
                  className={`px-2 py-1 rounded-md transition ${
                    playbackRate === rate
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Toggle Video Preview Button */}
            {mediaType === 'video' && (
              <button
                onClick={() => setShowVideoPreview(!showVideoPreview)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
                  showVideoPreview
                    ? 'bg-indigo-950/70 border-indigo-800 text-indigo-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
                title="نمایش یا عدم نمایش کادر پیش‌نمایش تصویر ویدیو"
              >
                {showVideoPreview ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">تصویر ویدیو</span>
              </button>
            )}

            {/* Media type indicator */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
              {mediaType === 'video' ? (
                <>
                  <VideoIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span>ویدئوی اصلی</span>
                </>
              ) : (
                <>
                  <Music className="w-3.5 h-3.5 text-cyan-400" />
                  <span>صوت اصلی</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
