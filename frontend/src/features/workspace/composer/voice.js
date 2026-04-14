import { getErrorMessage } from '../../../lib/utils';

const LIVE_DICTATION_WATCHDOG_MS = 5000;
const DEFAULT_MAX_RECORDING_MS = 45000;
const SILENCE_THRESHOLD = 0.018;
const DEFAULT_SILENCE_GRACE_MS = 1800;

export function composeVoiceDraft(baseDraft, committed, interim) {
  return [baseDraft, committed, interim].filter(Boolean).join(baseDraft ? '\n\n' : ' ');
}

export function joinVoiceSegments(left, right) {
  if (!left) {
    return right;
  }

  return `${left} ${right}`.replace(/\s+/g, ' ').trim();
}

export function getSpeechErrorMessage(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'Microphone access was blocked. Allow mic access in the browser and try again.';
  }

  if (code === 'no-speech') {
    return 'No speech was detected. Try again a little closer to the microphone.';
  }

  if (code === 'audio-capture') {
    return 'No microphone was found for voice dictation.';
  }

  if (code === 'network') {
    return 'Voice dictation hit a network issue. Try again in a moment.';
  }

  return 'Prymal could not capture the command cleanly. Try again or type it.';
}

export function getMediaAccessErrorMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Microphone access was blocked. Allow mic access in the browser and try again.';
  }

  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No microphone was found for voice input.';
  }

  if (error?.name === 'NotReadableError') {
    return 'The microphone is already in use by another app or browser tab.';
  }

  return 'Prymal could not access the microphone. Check your browser permissions and try again.';
}

export function getVoiceTranscriptionErrorMessage(error) {
  if (/OPENAI_API_KEY/i.test(error?.message ?? '')) {
    return 'Voice recording worked, but backend transcription is not configured yet. Add a real OPENAI_API_KEY in backend/.env and restart the backend.';
  }

  return getErrorMessage(error, 'Prymal could not turn that voice clip into text.');
}

export function scheduleSpeechWatchdog({
  speechWatchdogRef,
  getIsListening,
  getVoiceMode,
  mediaRecordingSupported,
  onFallback,
}) {
  clearSpeechWatchdog(speechWatchdogRef);

  speechWatchdogRef.current = setTimeout(() => {
    if (!getIsListening() || getVoiceMode() !== 'speech') {
      return;
    }

    if (mediaRecordingSupported) {
      onFallback?.();
    }
  }, LIVE_DICTATION_WATCHDOG_MS);
}

export function clearSpeechWatchdog(speechWatchdogRef) {
  if (speechWatchdogRef.current) {
    clearTimeout(speechWatchdogRef.current);
    speechWatchdogRef.current = null;
  }
}

export function clearRecordingTimeout(recordingTimeoutRef) {
  if (recordingTimeoutRef.current) {
    clearTimeout(recordingTimeoutRef.current);
    recordingTimeoutRef.current = null;
  }
}

export function clearRecordingSnapshotInterval(recordingSnapshotIntervalRef) {
  if (recordingSnapshotIntervalRef.current) {
    clearInterval(recordingSnapshotIntervalRef.current);
    recordingSnapshotIntervalRef.current = null;
  }
}

export function resizeComposer(textarea) {
  if (!textarea) {
    return;
  }

  textarea.style.height = '0px';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 148)}px`;
}

export function startRecordingSilenceMonitor({
  stream,
  mediaRecorderRef,
  recordingSilenceIntervalRef,
  recordingSilenceSinceRef,
  silenceGraceMs = DEFAULT_SILENCE_GRACE_MS,
}) {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
    return;
  }

  const audioContext = new window.AudioContext();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);

  clearRecordingSnapshotInterval(recordingSilenceIntervalRef);
  recordingSilenceIntervalRef.current = setInterval(() => {
    if (mediaRecorderRef.current?.state !== 'recording') {
      clearRecordingSnapshotInterval(recordingSilenceIntervalRef);
      void audioContext.close().catch(() => {});
      return;
    }

    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let index = 0; index < data.length; index += 1) {
      const normalized = (data[index] - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / data.length);
    const now = Date.now();

    if (rms > SILENCE_THRESHOLD) {
      recordingSilenceSinceRef.current = null;
      return;
    }

    if (!recordingSilenceSinceRef.current) {
      recordingSilenceSinceRef.current = now;
      return;
    }

    if (now - recordingSilenceSinceRef.current >= silenceGraceMs) {
      clearRecordingSnapshotInterval(recordingSilenceIntervalRef);
      recordingSilenceSinceRef.current = null;
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // Ignore double-stop edge cases from browsers.
      }
      void audioContext.close().catch(() => {});
    }
  }, 250);
}

export function resolveRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

export function stopMediaStream(streamRef) {
  const stream = streamRef.current;

  if (stream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }

  streamRef.current = null;
}

export function getVoiceLanguageCode(language) {
  if (language?.toLowerCase().startsWith('en-us')) {
    return 'en-us';
  }

  return 'en';
}

export function getVoiceReplyRate(rate) {
  if (rate === 'slow') return 0.88;
  if (rate === 'fast') return 1.12;
  return 1;
}

export function getVoiceReplyPitch(pitch) {
  if (pitch === 'grounded') return 0.88;
  if (pitch === 'bright') return 1.08;
  return 0.96;
}

export function getVoiceReplyCharacterLimit(length) {
  if (length === 'short') return 220;
  if (length === 'long') return 680;
  return 360;
}

export function getVoiceSilenceGraceMs(mode) {
  return mode === 'brief' ? 1200 : 2600;
}

export function getVoiceMaxRecordingMs(mode) {
  return mode === 'brief' ? 20000 : DEFAULT_MAX_RECORDING_MS;
}

export function getRealtimeSilenceDurationMs(mode) {
  return mode === 'brief' ? 240 : 520;
}
