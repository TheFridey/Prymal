import { api } from '../../../../lib/api';
import { getVoiceLanguageCode } from '../../composer/voice';

const OPENAI_REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';

export const DEFAULT_VOICE_DEBUG_STATE = {
  preferredMode: '',
  activeMode: '',
  transport: '',
  state: 'idle',
  lastEvent: '',
  detail: '',
};

export function detectVoiceSupport() {
  const hasUserMedia =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const realtimeAvailable =
    typeof window !== 'undefined' &&
    typeof window.RTCPeerConnection !== 'undefined' &&
    hasUserMedia;

  const recordingAvailable =
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    hasUserMedia;

  return {
    realtimeAvailable,
    recordingAvailable,
    // Compatibility aliases for existing callers while the hook is refactored.
    realtimeTranscriptionSupported: realtimeAvailable,
    mediaRecordingSupported: recordingAvailable,
    browserSpeechSupported: false,
    voiceSupported: realtimeAvailable || recordingAvailable,
  };
}

export async function transcribeVoiceBlob({ blob, fileName, agentName, voiceInputLanguage }) {
  const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const file = new File([blob], fileName || `prymal-voice.${extension}`, { type: blob.type || 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('language', getVoiceLanguageCode(voiceInputLanguage));
  formData.append('prompt', `Transcribe a short prompt for ${agentName ?? 'a Prymal agent'}.`);
  const response = await api.post('/agents/transcribe', formData);
  return response?.text?.trim() ?? '';
}

export async function startRealtimeSession({
  agentId,
  agentName,
  voiceInputLanguage = 'en',
  onTranscript,
  onError,
  onStateChange,
}) {
  if (typeof window === 'undefined' || typeof window.RTCPeerConnection === 'undefined') {
    throw createRealtimeError(
      'WEBRTC_NOT_SUPPORTED',
      'This browser does not support WebRTC voice transcription.',
    );
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw createRealtimeError(
      'WEBRTC_NOT_SUPPORTED',
      'Microphone capture is unavailable in this browser.',
    );
  }

  let peer = null;
  let localStream = null;
  let dataChannel = null;
  let closed = false;
  let state = 'idle';

  const emitState = (nextState) => {
    if (state === nextState) {
      return;
    }

    state = nextState;
    onStateChange?.(nextState);
  };

  const stop = () => {
    if (closed) {
      return;
    }

    closed = true;

    try {
      dataChannel?.close();
    } catch {}

    try {
      peer?.close();
    } catch {}

    if (localStream) {
      for (const track of localStream.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
    }

    dataChannel = null;
    peer = null;
    localStream = null;
    emitState('closed');
  };

  try {
    emitState('connecting');

    let tokenResponse;
    try {
      tokenResponse = await api.post('/agents/realtime-token', agentId ? { agentId } : {});
    } catch (error) {
      throw createRealtimeError(
        'REALTIME_TOKEN_FAILED',
        error?.data?.error || error?.message || 'Prymal could not create a realtime token.',
        error,
      );
    }

    const ephemeralToken = tokenResponse?.token;

    if (!ephemeralToken) {
      throw createRealtimeError(
        'REALTIME_TOKEN_FAILED',
        'Prymal did not return a realtime token for WebRTC voice transcription.',
      );
    }

    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      throw createRealtimeError(
        'MIC_PERMISSION_DENIED',
        'Microphone access was blocked. Allow mic access in the browser and try again.',
        error,
      );
    }

    peer = new RTCPeerConnection();

    for (const track of localStream.getAudioTracks()) {
      peer.addTrack(track, localStream);
    }

    dataChannel = peer.createDataChannel('oai-events');

    dataChannel.addEventListener('open', () => {
      emitState('active');
    });

    dataChannel.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        const transcriptText =
          payload?.delta ??
          payload?.transcript ??
          payload?.text ??
          payload?.response?.transcript ??
          '';

        if (!transcriptText) {
          return;
        }

        if (payload.type === 'response.audio_transcript.delta') {
          onTranscript?.({ text: transcriptText, isFinal: false });
        }

        if (payload.type === 'response.audio_transcript.done') {
          onTranscript?.({ text: transcriptText, isFinal: true });
        }
      } catch {
        // Ignore malformed event payloads from the transport.
      }
    });

    dataChannel.addEventListener('error', () => {
      const error = createRealtimeError(
        'WEBRTC_NEGOTIATION_FAILED',
        `Prymal lost the realtime event channel${agentName ? ` for ${agentName}` : ''}.`,
      );
      onError?.(error);
      stop();
    });

    peer.addEventListener('connectionstatechange', () => {
      if (peer.connectionState === 'connected') {
        emitState('active');
      }

      if (peer.connectionState === 'failed') {
        const error = createRealtimeError(
          'WEBRTC_NEGOTIATION_FAILED',
          `Prymal could not maintain the realtime WebRTC session${agentName ? ` for ${agentName}` : ''}.`,
        );
        onError?.(error);
        stop();
      }

      if (peer.connectionState === 'closed' || peer.connectionState === 'disconnected') {
        stop();
      }
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${OPENAI_REALTIME_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ephemeralToken}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });

    const answerSdp = await sdpResponse.text();

    if (!sdpResponse.ok || !answerSdp.trim()) {
      throw createRealtimeError(
        'WEBRTC_NEGOTIATION_FAILED',
        answerSdp || 'OpenAI Realtime negotiation failed.',
      );
    }

    await peer.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    emitState('active');

    return { stop };
  } catch (error) {
    stop();
    onError?.(error);
    throw error;
  }
}

function createRealtimeError(code, message, cause = null) {
  const error = new Error(message);
  error.code = code;
  error.cause = cause;
  return error;
}
