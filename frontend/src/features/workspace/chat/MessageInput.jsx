// ─────────────────────────────────────────────────────────────────
// features/workspace/chat/MessageInput.jsx
// Composer textarea, slash-command menu, file attachments, voice
// status bar, and send controls.
// All state is owned by WorkspaceStudio; this component is presentational.
// ─────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { Button } from '../../../components/ui';
import { motion, MotionPanel, MotionPresence } from '../../../components/motion';
import { AttachIcon, MicIcon } from './icons';
import SlashCommandMenu from './SlashCommandMenu';

const SLASH_MENU_ID = 'composer-slash-menu';

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
  isFirstRun,
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
  layout = 'stacked',
}) {
  const composerClassName = `workspace-studio__composer${isFirstRun ? ' workspace-studio__composer--first-run' : ''}${layout === 'inline' ? ' workspace-studio__composer--inline' : ''}`;
  const placeholder = isFirstRun
    ? 'Ask me to generate content, automate a task, or analyse something'
    : `Message ${activeAgent.name}... Type / for prompts, clear, settings, and more.`;
  const metaCopy = isFirstRun
    ? 'Credits are checked before each run. Start with one practical business task.'
    : hasConversationContent
      ? 'Type / for prompts, clear chat, settings, and toggles.'
      : 'Try a starter prompt or open / commands.';
  const activeCommand = filteredCommands[commandIndex] ?? filteredCommands[0] ?? null;
  const activeDescendantId = commandMenuOpen && activeCommand ? `slash-cmd-${activeCommand.name}` : undefined;
  const fileInputId = 'workspace-composer-file-input';

  useEffect(() => {
    if (!commandMenuOpen || !activeDescendantId) {
      return;
    }

    document.getElementById(activeDescendantId)?.scrollIntoView({ block: 'nearest' });
  }, [activeDescendantId, commandMenuOpen]);

  const composerField = (
    <div className="workspace-studio__composer-field">
      <textarea
        ref={composerRef}
        value={draft}
        onChange={onDraftChange}
        onKeyDown={onComposerKeyDown}
        placeholder={placeholder}
        rows={1}
        className="field field--textarea"
        aria-expanded={commandMenuOpen}
        aria-controls={commandMenuOpen ? SLASH_MENU_ID : undefined}
        aria-activedescendant={activeDescendantId}
        aria-autocomplete={commandMenuOpen ? 'list' : undefined}
        aria-haspopup={commandMenuOpen ? 'listbox' : undefined}
      />
      <SlashCommandMenu
        open={commandMenuOpen}
        commands={filteredCommands}
        commandIndex={commandIndex}
        commandFilter={commandFilter}
        listboxId={SLASH_MENU_ID}
        onApply={onApplySlashCommand}
      />
    </div>
  );

  return (
    <MotionPanel className={composerClassName}>
      <MotionPresence initial={false}>
        {attachedFiles.length > 0 ? (
          <div key="attachments" className="workspace-studio__attachments">
            {attachedFiles.map((f) => (
              f.isImage ? (
                <div key={f.name} className="workspace-studio__attachment-image">
                  <img
                    src={f.previewUrl}
                    alt={f.name}
                    className="workspace-studio__attachment-preview"
                    width={80}
                    height={80}
                    loading="lazy"
                    decoding="async"
                  />
                  <button
                    type="button"
                    className="workspace-studio__attachment-image-remove"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => onRemoveFile(f.name)}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
              ) : (
                <div key={f.name} className="workspace-studio__attachment-chip">
                  <span>{f.isPdf ? '📄 ' : ''}{f.name}</span>
                  <button
                    type="button"
                    className="workspace-studio__attachment-chip-remove"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => onRemoveFile(f.name)}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
              )
            ))}
          </div>
        ) : null}
      </MotionPresence>

      <input
        id={fileInputId}
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.html,.xml,.pdf,image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="workspace-studio__file-input"
        onChange={onFileAttach}
      />

      <div className={layout === 'inline' ? 'workspace-studio__composer-row' : 'workspace-studio__composer-field'}>
        {layout === 'inline' ? (
          <>
            <button
              type="button"
              className={`workspace-studio__action-chip workspace-studio__action-chip--composer${attachedFiles.length > 0 ? ' is-active' : ''}`}
              onClick={onAttachClick}
              aria-label="Attach file"
              aria-controls={fileInputId}
              title="Attach text, markdown, CSV, JSON, PDF, or image files"
            >
              <AttachIcon />
            </button>
            {composerField}
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
              className="workspace-studio__composer-send"
              onClick={() => onSend()}
              disabled={(!draft.trim() && attachedFiles.length === 0) || isStreaming}
            >
              Send
            </Button>
          </>
        ) : (
          <>
            <textarea
              ref={composerRef}
              value={draft}
              onChange={onDraftChange}
              onKeyDown={onComposerKeyDown}
              placeholder={placeholder}
              rows={1}
              className="field field--textarea"
              aria-expanded={commandMenuOpen}
              aria-controls={commandMenuOpen ? SLASH_MENU_ID : undefined}
              aria-activedescendant={activeDescendantId}
              aria-autocomplete={commandMenuOpen ? 'list' : undefined}
              aria-haspopup={commandMenuOpen ? 'listbox' : undefined}
            />
            <SlashCommandMenu
              open={commandMenuOpen}
              commands={filteredCommands}
              commandIndex={commandIndex}
              commandFilter={commandFilter}
              listboxId={SLASH_MENU_ID}
              onApply={onApplySlashCommand}
            />
          </>
        )}
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
        <div className="workspace-studio__composer-meta" title="Execution credits and AI video credits are tracked separately and checked server-side before each run.">
          {metaCopy}{' '}
          | {activeSettings.useLore ? 'LORE enabled' : 'LORE disabled'} | {activeSettings.responseLength} response | {activeSettings.tone} tone | {activeSettings.voiceInputMode} voice
          {voiceMode === 'realtime' ? ' | 🎙 Live' : null}
          {voiceMode === 'recording' ? ' | ⏺ Recording' : null}
          {attachedFiles.length > 0 ? ` | ${attachedFiles.length} file${attachedFiles.length > 1 ? 's' : ''} attached` : ''}
        </div>
        {layout === 'stacked' ? (
          <div className="workspace-studio__composer-cta">
            <button
              type="button"
              className={`workspace-studio__action-chip workspace-studio__action-chip--composer${attachedFiles.length > 0 ? ' is-active' : ''}`}
              onClick={onAttachClick}
              aria-label="Attach file"
              aria-controls={fileInputId}
              title="Attach text, markdown, CSV, JSON, PDF, or image files"
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
              className="workspace-studio__composer-send"
              onClick={() => onSend()}
              disabled={(!draft.trim() && attachedFiles.length === 0) || isStreaming}
            >
              Send
            </Button>
          </div>
        ) : null}
      </div>
    </MotionPanel>
  );
}
