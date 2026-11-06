/**
 * Client-side audio processing, video-to-audio extraction, and waveform generator.
 * Uses Web Audio API for fast client-side extraction without heavyweight wasm downloads.
 */

export interface ExtractedAudioResult {
  audioBlob: Blob;
  waveformPeaks: number[];
  duration: number;
  sampleRate: number;
  objectUrl: string;
}

/**
 * Extract audio from video or audio File and convert to 16kHz mono WAV for optimal STT accuracy
 */
export async function extractAudioFromMedia(
  file: File,
  onProgress?: (stage: string, percent: number) => void
): Promise<ExtractedAudioResult> {
  onProgress?.('در حال خواندن فایل رسانه...', 10);

  const isAudioFile = file.type.startsWith('audio/') || Boolean(file.name.match(/\.(mp3|wav|m4a|aac|flac|ogg)$/i));

  const arrayBuffer = await file.arrayBuffer();
  onProgress?.('در حال رمزگشایی صوت در مرورگر...', 30);

  // Create an AudioContext for decoding safely across all browsers
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  let audioContext: AudioContext;
  try {
    audioContext = new AudioContextClass({ sampleRate: 16000 });
  } catch {
    audioContext = new AudioContextClass();
  }

  let audioBuffer: AudioBuffer;
  try {
    // Use arrayBuffer.slice(0) to prevent detachment
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    console.warn('AudioContext decode failed, attempting fallback:', err);
    try {
      await audioContext.close();
    } catch {
      // ignore
    }

    if (isAudioFile) {
      const fallbackUrl = URL.createObjectURL(file);
      return {
        audioBlob: file,
        waveformPeaks: generateSyntheticPeaks(600),
        duration: 0,
        sampleRate: 16000,
        objectUrl: fallbackUrl,
      };
    }
    throw new Error('قالب فایل برای استخراج صوتی پشتیبانی نمی‌شود یا فایل صدمه دیده است.');
  }

  onProgress?.('در حال پردازش کانال‌های صوتی و استخراج شکل موج...', 60);

  // Convert to Mono (average channels if multi-channel)
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const monoChannel = new Float32Array(length);

  for (let c = 0; c < numberOfChannels; c++) {
    const channelData = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      monoChannel[i] += channelData[i] / numberOfChannels;
    }
  }

  onProgress?.('در حال محاسبه شکل موج صوتی...', 80);
  const waveformPeaks = computeWaveformPeaks(monoChannel, 600);

  let finalAudioBlob: Blob;
  let objectUrl: string;

  if (isAudioFile) {
    // If user provided a compressed audio file (MP3, M4A, FLAC, etc.), use it directly
    // to preserve compact upload size and avoid 30MB+ uncompressed WAV uploads
    finalAudioBlob = file;
    objectUrl = URL.createObjectURL(file);
  } else {
    // For video files, encode extracted audio to 16-bit PCM WAV
    const wavBlob = encodeMonoWav(monoChannel, audioBuffer.sampleRate);
    finalAudioBlob = wavBlob;
    objectUrl = URL.createObjectURL(wavBlob);
  }

  try {
    await audioContext.close();
  } catch {
    // ignore
  }

  onProgress?.('استخراج صوت با موفقیت پایان یافت.', 100);

  return {
    audioBlob: finalAudioBlob,
    waveformPeaks,
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
    objectUrl,
  };
}

/**
 * Downsample audio buffer to N normalized peaks (0 to 1) for canvas waveform
 */
export function computeWaveformPeaks(channelData: Float32Array, numPeaks = 600): number[] {
  const step = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = new Array(numPeaks).fill(0);

  if (step <= 0) return peaks;

  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    const end = Math.min(start + step, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = Math.min(1, max);
  }

  return peaks;
}

function generateSyntheticPeaks(numPeaks: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    peaks.push(0.3 + 0.4 * Math.sin(i / 10) * Math.sin(i / 3));
  }
  return peaks;
}

/**
 * Encode Float32Array mono audio to 16-bit PCM WAV Blob
 */
export function encodeMonoWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type & format */
  writeString(view, 8, 'WAVEfmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw 1 = PCM) */
  view.setUint16(20, 1, true);
  /* channel count: 1 (mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
