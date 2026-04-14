// ─────────────────────────────────────────────────────────────────
// features/workspace/chat/MessageInput.jsx
// Composer textarea, slash-command menu, file attachments, voice
// status bar, and send controls.
// All state is owned by WorkspaceStudio; this component is presentational.
// ─────────────────────────────────────────────────────────────────

import { Button } from '../../../components/ui';
import { motion, MotionPanel, MotionPresence } from '../../../components/motion';
import { AttachIcon, MicIcon } from './icons';

export default function MessageInput({
  // Agent
  activeAgent,

  // Draft & files
  draft,
  attachedFiles,

  // Voice
  isListening,
  voiceInterim,
  voiceMode,
  voiceSupported,
  showVoiceStatus,

  // Settings
  activeSettings,
  hasConversationContent,
  isStreaming,

  // Slash commands
  commandMenuOpen,
  filteredCommands,
  commandIndex,
  commandFilter,

  // Refs (forwarded)
  composerRef,
  fileInputRef,

  // Callbacks
  onSend,
  onDraftChange,
  onComposerKeyDown,
  onFileAttach,
  onRemoveFile,
  onToggleListening,
  onApplySlashCommand,
  onAttachClick,
}) {
  return (
    <MotionPanel className="workspace-studio__composer">
      <MotionPresence initial={false}>
        {attachedFiles.length > 0 ? (
          <div key="attachments" className="workspace-studio__attachments">
            {attachedFiles.map((f) => (
              f.isImage ? (
                <div key={f.name} className="workspace-studio__attachment-image">
                  <img
                    src={f.previewUrl}
                    alt={f.name}
                    style={{ maxWidth: '80px', maxHeight: '80px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                  />
                  <button
                    type="button"
                    className="workspace-studio__attachment-image-remove"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => onRemoveFile(f.name)}
                  >✕</button>
                </div>
              ) : (
                <div key={f.name} className="workspace-studio__attachment-chip">
                  <span>{f.isPdf ? '📄 ' : ''}{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => onRemoveFile(f.name)}
                  >✕</button>
                </div>
              )
            ))}
          </div>
        ) : null}
      </MotionPresence>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.html,.xml,.pdf,image/png,image/jpeg,image/webp,image/gif"
        multiple
        style={{ display: 'none' }}
        onChange={onFileAttach}
      />

      <div className="workspace-studio__composer-field">
        <textarea
          ref={composerRef}
          value={draft}
          onChange={onDraftChange}
          onKeyDown={onComposerKeyDown}
          placeholder={`Message ${activeAgent.name}... Type / for prompts, clear, settings, and more.`}
          rows={1}
          className="field field--textarea"
        />
        {commandMenuOpen ? (
          <div className="workspace-studio__command-menu">
            {filteredCommands.length > 0 ? (
              filteredCommands.map((command, index) => (
                <button
                  key={command.name}
                  type="button"
                  className={`workspace-studio__command-item${index === commandIndex ? ' is-active' : ''}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onApplySlashCommand(command);
                  }}
                >
                  <span className="workspace-studio__command-name">/{command.name}</span>
                  <span className="workspace-studio__command-description">{command.description}</span>
                </button>
              ))
            ) : (
              <div className="workspace-studio__command-empty">No commands match &quot;/{commandFilter.trim()}&quot;.</div>
            )}
          </div>
        ) : null}
      </div>

      <MotionPresence initial={false}>
        {voiceSupported && showVoiceStatus ? (
          <motion.div
            key="voice-status"
            className={`workspace-studio__voice-status${isListening ? ' is-live' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.24 }}
          >
            <div className="workspace-studio__voice-indicator">
              <span className="workspace-studio__voice-dot" />
              <span>
                {isListening
                  ? voiceMode === 'recording'
                    ? `Recording for ${activeAgent.name}...`
                    : `Listening for ${activeAgent.name}...`
                  : voiceInterim === 'Transcribing audio...'
                    ? 'Transcribing voice note...'
                    : 'Voice dictation ready'}
              </span>
            </div>
            <div className="workspace-studio__voice-copy">
              {voiceInterim ||
                (isListening
                  ? voiceMode === 'recording'
                    ? 'Prymal is capturing your voice and updating the composer from rolling transcript snapshots.'
                    : 'Speak naturally. Prymal will write your words into the composer live.'
                  : 'Voice capture ready. Tap the mic again when you want to dictate another message.')}
            </div>
          </motion.div>
        ) : null}
      </MotionPresence>

      <div className="workspace-studio__composer-actions">
        <div className="workspace-studio__composer-meta">
          {hasConversationContent ? 'Type / for prompts, clear chat, settings, and toggles.' : 'Try a starter prompt or open / commands.'}{' '}
          | {activeSettings.useLore ? 'LORE enabled' : 'LORE disabled'} | {activeSettings.responseLength} response | {activeSettings.tone} tone | {activeSettings.voiceInputMode} voice
          {voiceMode === 'realtime' ? ' | 🎙 Live' : null}
          {voiceMode === 'recording' ? ' | ⏺ Recording' : null}
          {attachedFiles.length > 0 ? ` | ${attachedFiles.length} file${attachedFiles.length > 1 ? 's' : ''} attached` : ''}
        </div>
        <div className="workspace-studio__composer-cta">
          <button
            type="button"
            className={`workspace-studio__action-chip workspace-studio__action-chip--composer${attachedFiles.length > 0 ? ' is-active' : ''}`}
            onClick={onAttachClick}
            aria-label="Attach file"
            title="Attach a text, CSV, or JSON file"
          >
            <AttachIcon />
          </button>
          {voiceSupported ? (
            <button
              type="button"
              className={`workspace-studio__action-chip workspace-studio__action-chip--composer${isListening ? ' is-active' : ''}`}
              onClick={onToggleListening}
              aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
              aria-pressed={isListening}
            >
              <MicIcon />
            </button>
          ) : null}
          <Button
            tone="accent"
            onClick={() => onSend()}
            disabled={(!draft.trim() && attachedFiles.length === 0) || isStreaming}
          >
            Send
          </Button>
        </div>
      </div>
    </MotionPanel>
  );
}
