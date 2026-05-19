import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestEnv } from '../../test-helpers.js';

setupTestEnv();

const { isSupportedAudioUpload, validateTranscriptionUpload } = await import('./agents.js');

test('transcription upload validator accepts supported audio formats', () => {
  const audio = new File(['voice'], 'clip.webm', { type: 'audio/webm' });

  assert.equal(isSupportedAudioUpload(audio), true);
  assert.deepEqual(validateTranscriptionUpload(audio), { ok: true });
});

test('transcription upload validator rejects unsupported file types', () => {
  const audio = new File(['voice'], 'clip.exe', { type: 'application/octet-stream' });

  assert.equal(isSupportedAudioUpload(audio), false);
  assert.deepEqual(validateTranscriptionUpload(audio), {
    ok: false,
    status: 400,
    error: 'Unsupported audio file type. Upload MP3, WAV, M4A, MP4, OGG, or WEBM audio.',
  });
});

test('transcription upload validator rejects files over 12 MB', () => {
  const audio = new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'clip.webm', { type: 'audio/webm' });

  assert.deepEqual(validateTranscriptionUpload(audio), {
    ok: false,
    status: 400,
    error: 'Audio file is too large. Keep voice clips under 12 MB.',
  });
});
