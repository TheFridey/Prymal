import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../../../../lib/utils';
import {
  clearRecordingSnapshotInterval,
  clearRecordingTimeout,
  clearSpeechWatchdog,
  composeVoiceDraft,
  getMediaAccessErrorMessage,
  getVoiceMaxRecordingMs,
  getVoiceSilenceGraceMs,
  getVoiceTranscriptionErrorMessage,
  joinVoiceSegments,
  resolveRecordingMimeType,
  startRecordingSilenceMonitor,
  stopMediaStream,
} from '../../composer/voice';
import {
  DEFAULT_VOICE_DEBUG_STATE,
  detectVoiceSupport,
  startRealtimeSession,
  transcribeVoiceBlob,
} from './voiceRuntime';

/**
 * Owns all voice input state, refs, and recording/transcription logic.
 *
 * @param {object} params
 * @param {object} params.activeAgent
 * @param {object} params.activeSettings
 * @param {object} params.composerRef
 * @param {function} params.notify
 * @param {object} params.draftRef          — live ref to current draft text
 * @param {function} params.setDraft
 * @param {function} params.onAutoSend      — called with final transcript when voiceAutoSend=true
 */
export function useVoiceInput({
  activeAgent,
  activeSettings,
  composerRef,
  notify,
  draftRef,
  setDraft,
  onAutoSend,
  preferRealtime = true,
}) {
  // ── capability detection ──────────────────────────────────────────────────
  const {
    realtimeAvailable,
    recordingAvailable,
    browserSpeechSupported,
    voiceSupported,
  } = detectVoiceSupport();

  // ── state ─────────────────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceMode, setVoiceMode] = useState(null);
  const [voiceDebug, setVoiceDebug] = useState(DEFAULT_VOICE_DEBUG_STATE);

  // ── refs ──────────────────────────────────────────────────────────────────
  const recognitionRef = useRef(null);
  const speechWatchdogRef = useRef(null);
  const realtimeStopRef = useRef(null);
  const realtimeTranscriptBufferRef = useRef('');
  const realtimeCompletedTranscriptRef = useRef('');
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const speechFallbackRollingTranscriptRef = useRef('');
  const speechFallbackRollingBusyRef = useRef(false);
  const speechFallbackRollingSequenceRef = useRef(0);
  const recordingTimeoutRef = useRef(null);
  const recordingSnapshotIntervalRef = useRef(null);
  const recordingSilenceIntervalRef = useRef(null);
  const recordingSilenceSinceRef = useRef(null);
  const voiceDraftBaseRef = useRef('');
  const voiceCommittedRef = useRef('');
  const voiceInterimRef = useRef('');
  const speechManualStopRef = useRef(false);
  const isListeningRef = useRef(false);
  const voiceModeRef = useRef(null);

  // ── stable refs for settings & callbacks ─────────────────────────────────
  const activeSettingsRef = useRef(activeSettings);
  activeSettingsRef.current = activeSettings;
  const onAutoSendRef = useRef(onAutoSend);
  onAutoSendRef.current = onAutoSend;

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  // ── cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    clearSpeechWatchdog(speechWatchdogRef);
    clearRecordingTimeout(recordingTimeoutRef);
    clearRecordingSnapshotInterval(recordingSnapshotIntervalRef);
    clearRecordingSnapshotInterval(recordingSilenceIntervalRef);
    cleanupRealtimeSession();
    recognitionRef.current?.stop?.();
    mediaRecorderRef.current?.stop?.();
    stopMediaStream(mediaStreamRef);
  }, []);

  // ── helpers ───────────────────────────────────────────────────────────────
  function cleanupRealtimeSession({ preserveDraft = false } = {}) {
    const stopRealtime = realtimeStopRef.current;
    realtimeStopRef.current = null;
    stopRealtime?.();
    realtimeTranscriptBufferRef.current = '';
    realtimeCompletedTranscriptRef.current = '';

    if (!preserveDraft) setVoiceInterim('');
    setIsListening(false);
    setVoiceMode(null);
    setVoiceDebug((current) => ({
      ...current,
      state: preserveDraft ? 'realtime-complete' : 'realtime-stopped',
      lastEvent: preserveDraft ? 'realtime.cleanup.preserve-draft' : 'realtime.cleanup',
    }));
  }

  async function transcribeAudioBlob(blob, fileName) {
    return transcribeVoiceBlob({
      blob,
      fileName,
      agentName: activeAgent?.name,
      voiceInputLanguage: activeSettingsRef.current.voiceInputLanguage,
    });
  }

  async function startRealtimeTranscription() {
    voiceDraftBaseRef.current = draftRef.current.trim();
    voiceCommittedRef.current = '';
    voiceInterimRef.current = '';
    realtimeTranscriptBufferRef.current = '';
    realtimeCompletedTranscriptRef.current = '';
    setVoiceMode('realtime');
    setIsListening(true);
    setVoiceInterim('Connecting live transcription...');
    composerRef.current?.focus();
    setVoiceDebug((current) => ({
      ...current,
      preferredMode: preferRealtime ? 'realtime' : 'recording',
      activeMode: 'realtime',
      transport: 'webrtc',
      state: 'connecting',
      lastEvent: 'realtime.start',
      detail: '',
    }));

    try {
      const realtimeSession = await startRealtimeSession({
        agentId: activeAgent?.id,
        agentName: activeAgent?.name,
        voiceInputLanguage: activeSettingsRef.current.voiceInputLanguage,
        onTranscript: ({ text, isFinal }) => {
          const nextText = String(text ?? '').trim();

          if (!nextText) {
            return;
          }

          if (!isFinal) {
            realtimeTranscriptBufferRef.current = nextText;
            voiceInterimRef.current = nextText;
            setVoiceInterim(nextText);
            setDraft(
              composeVoiceDraft(
                voiceDraftBaseRef.current,
                realtimeCompletedTranscriptRef.current,
                nextText,
              ),
            );
            return;
          }

          realtimeCompletedTranscriptRef.current = joinVoiceSegments(
            realtimeCompletedTranscriptRef.current,
            nextText,
          );
          voiceCommittedRef.current = realtimeCompletedTranscriptRef.current;
          realtimeTranscriptBufferRef.current = '';
          voiceInterimRef.current = '';

          const finalDraft = composeVoiceDraft(
            voiceDraftBaseRef.current,
            realtimeCompletedTranscriptRef.current,
            '',
          ).trim();

          setDraft(finalDraft);
          cleanupRealtimeSession({ preserveDraft: true });

          if (activeSettingsRef.current.voiceAutoSend && finalDraft) {
            setVoiceInterim('Sending voice prompt...');
            void onAutoSendRef.current?.(finalDraft).finally(() => {
              setVoiceInterim('');
            });
          } else {
            setVoiceInterim('');
          }
        },
        onError: (error) => {
          setVoiceDebug((current) => ({
            ...current,
            state: 'error',
            lastEvent: 'realtime.error',
            detail: error?.code ?? getErrorMessage(error),
          }));
          notify({
            type: 'error',
            title: 'Live transcription failed',
            message:
              error?.code === 'MIC_PERMISSION_DENIED'
                ? getMediaAccessErrorMessage(error?.cause ?? error)
                : getErrorMessage(error, 'Prymal could not start live transcription.'),
          });
        },
        onStateChange: (state) => {
          setVoiceDebug((current) => ({
            ...current,
            state,
            lastEvent: `realtime.${state}`,
            detail: state === 'active' ? 'WebRTC session established.' : current.detail,
          }));

          if (state === 'active') {
            setVoiceInterim(realtimeTranscriptBufferRef.current || 'Listening live...');
          }

          if (state === 'closed' && voiceModeRef.current === 'realtime') {
            setIsListening(false);
            setVoiceMode(null);
            if (!realtimeCompletedTranscriptRef.current.trim()) {
              setVoiceInterim('');
            }
          }
        },
      });

      realtimeStopRef.current = realtimeSession.stop;
    } catch (error) {
      cleanupRealtimeSession();

      if (recordingAvailable && error?.code !== 'MIC_PERMISSION_DENIED') {
        notify({
          type: 'info',
          title: 'Switching capture mode',
          message: 'Live voice was unavailable, so Prymal is falling back to recording plus transcription.',
        });
        await startRecordedTranscription();
      }
    }
  }

  async function updateRecordedLiveTranscript(recorder, mimeType) {
    if (speechFallbackRollingBusyRef.current) return;

    const parts = [...mediaChunksRef.current];
    if (!parts.length) return;

    const blob = new Blob(parts, { type: recorder?.mimeType || mimeType || resolveRecordingMimeType() || 'audio/webm' });
    if (!blob.size || blob.size < 12 * 1024) return;

    const sequence = speechFallbackRollingSequenceRef.current + 1;
    speechFallbackRollingSequenceRef.current = sequence;
    speechFallbackRollingBusyRef.current = true;

    try {
      const transcript = await transcribeAudioBlob(blob, `prymal-voice-live-${sequence}.webm`);
      if (!transcript || sequence !== speechFallbackRollingSequenceRef.current) return;
      speechFallbackRollingTranscriptRef.current = transcript;
      setDraft(composeVoiceDraft(voiceDraftBaseRef.current, transcript, ''));
      setVoiceInterim('Listening live...');
    } catch {
      // Rolling transcription retries on the next recorder snapshot.
    }
    finally {
      speechFallbackRollingBusyRef.current = false;
    }
  }

  async function startRecordedTranscription() {
    try {
      setVoiceMode('recording');
      setIsListening(true);
      setVoiceInterim('Requesting microphone access...');
      composerRef.current?.focus();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = resolveRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];
      speechFallbackRollingTranscriptRef.current = '';
      speechFallbackRollingBusyRef.current = false;
      speechFallbackRollingSequenceRef.current = 0;
      voiceDraftBaseRef.current = draftRef.current.trim();
      voiceCommittedRef.current = '';
      voiceInterimRef.current = '';
      setVoiceInterim('Preparing recorder...');

      recorder.onstart = () => {
        setVoiceMode('recording');
        setIsListening(true);
        setVoiceInterim('Listening live... Speak naturally. Prymal will keep listening until you pause.');
        clearRecordingTimeout(recordingTimeoutRef);
        clearRecordingSnapshotInterval(recordingSnapshotIntervalRef);
        clearRecordingSnapshotInterval(recordingSilenceIntervalRef);
        recordingSilenceSinceRef.current = null;
        startRecordingSilenceMonitor({
          stream,
          mediaRecorderRef,
          recordingSilenceIntervalRef,
          recordingSilenceSinceRef,
          silenceGraceMs: getVoiceSilenceGraceMs(activeSettingsRef.current.voiceInputMode),
        });
        recordingSnapshotIntervalRef.current = setInterval(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            try {
              mediaRecorderRef.current.requestData();
            } catch {
              // Ignore transient recorder snapshot failures while the stream settles.
            }
          }
        }, 1200);
        recordingTimeoutRef.current = setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
        }, getVoiceMaxRecordingMs(activeSettingsRef.current.voiceInputMode));
      };

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
          void updateRecordedLiveTranscript(recorder, mimeType);
        }
      };

      recorder.onerror = () => {
        clearRecordingTimeout(recordingTimeoutRef);
        clearRecordingSnapshotInterval(recordingSnapshotIntervalRef);
        clearRecordingSnapshotInterval(recordingSilenceIntervalRef);
        recordingSilenceSinceRef.current = null;
        setIsListening(false);
        setVoiceMode(null);
        setVoiceInterim('');
        stopMediaStream(mediaStreamRef);
        notify({ type: 'error', title: 'Voice recording failed', message: 'Prymal could not capture audio from the microphone.' });
      };

      recorder.onstop = async () => {
        clearRecordingTimeout(recordingTimeoutRef);
        clearRecordingSnapshotInterval(recordingSnapshotIntervalRef);
        clearRecordingSnapshotInterval(recordingSilenceIntervalRef);
        recordingSilenceSinceRef.current = null;
        const blob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });

        mediaRecorderRef.current = null;
        mediaChunksRef.current = [];
        setIsListening(false);
        setVoiceMode(null);

        if (!blob.size) {
          setVoiceInterim('');
          stopMediaStream(mediaStreamRef);
          notify({ type: 'error', title: 'Voice recording empty', message: 'No audio was captured. Try again a little closer to the microphone.' });
          return;
        }

        setVoiceInterim('Transcribing audio...');
        try {
          const transcript =
            (await transcribeAudioBlob(blob, 'prymal-voice-final.webm')) ||
            speechFallbackRollingTranscriptRef.current.trim();

          if (!transcript) throw new Error('No transcript text was returned.');

          const nextDraft = composeVoiceDraft(voiceDraftBaseRef.current, transcript, '').trim();
          setDraft(nextDraft);
          voiceInterimRef.current = '';
          if (activeSettingsRef.current.voiceAutoSend && nextDraft) {
            setVoiceInterim('Sending voice prompt...');
            await onAutoSendRef.current?.(nextDraft);
          } else {
            setVoiceInterim('');
          }
        } catch (error) {
          setVoiceInterim('');
          notify({ type: 'error', title: 'Transcription failed', message: getVoiceTranscriptionErrorMessage(error) });
        } finally {
          stopMediaStream(mediaStreamRef);
        }
      };

      recorder.start(1200);
    } catch (error) {
      clearRecordingTimeout(recordingTimeoutRef);
      setIsListening(false);
      setVoiceMode(null);
      setVoiceInterim('');
      stopMediaStream(mediaStreamRef);
      notify({ type: 'error', title: 'Microphone blocked', message: getMediaAccessErrorMessage(error) });
    }
  }

  async function toggleListening() {
    const preferredMode = preferRealtime && realtimeAvailable
      ? 'realtime'
      : recordingAvailable
        ? 'recording-live'
        : browserSpeechSupported
          ? 'speech'
          : 'unsupported';

    setVoiceDebug((current) => ({
      ...current,
      preferredMode,
      lastEvent: 'voice.toggle',
    }));

    if (!voiceSupported) {
      notify({ type: 'error', title: 'Voice unavailable', message: 'This browser does not support live voice or recorded microphone transcription.' });
      return;
    }

    if (isListening) {
      if (voiceMode === 'realtime') {
        cleanupRealtimeSession();
      } else if (voiceMode === 'speech') {
        speechManualStopRef.current = true;
        recognitionRef.current?.stop();
      } else if (voiceMode === 'recording') {
        clearRecordingTimeout(recordingTimeoutRef);
        mediaRecorderRef.current?.stop();
      }
      return;
    }

    if (preferRealtime && realtimeAvailable) {
      await startRealtimeTranscription();
      return;
    }

    if (recordingAvailable) {
      await startRecordedTranscription();
      return;
    }
  }

  function resetInterim() {
    setVoiceInterim('');
    voiceInterimRef.current = '';
  }

  return {
    isListening,
    voiceInterim,
    voiceMode,
    voiceDebug,
    voiceSupported,
    showVoiceStatus: Boolean(isListening || voiceInterim),
    toggleListening,
    resetInterim,
    cleanupOnUnmount: () => {
      cleanupRealtimeSession();
      recognitionRef.current?.stop?.();
      mediaRecorderRef.current?.stop?.();
    },
  };
}
