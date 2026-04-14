// ─────────────────────────────────────────────────────────────────
// features/workspace/chat/ChatSettingsModal.jsx
// Per-agent chat settings modal: response style, voice, model override,
// LORE toggle, and custom instructions.
// All state is owned by WorkspaceStudio; this component is presentational.
// ─────────────────────────────────────────────────────────────────

import { Button, InlineNotice } from '../../../components/ui';
import { CloseIcon } from './icons';

export default function ChatSettingsModal({ activeAgent, activeSettings, onUpdateSettings, onClose }) {
  return (
    <div className="workspace-modal-backdrop" onClick={onClose}>
      <div className="workspace-modal" onClick={(event) => event.stopPropagation()}>
        <div className="workspace-modal__header">
          <div>
            <div className="workspace-modal__eyebrow">Chat settings</div>
            <h2 className="workspace-modal__title">{activeAgent.name} conversation profile</h2>
          </div>
          <button type="button" className="workspace-studio__ghost-icon" onClick={onClose} aria-label="Close chat settings">
            <CloseIcon />
          </button>
        </div>

        <div className="workspace-modal__grid">
          <label className="workspace-modal__field">
            <span>Response length</span>
            <select value={activeSettings.responseLength} onChange={(event) => onUpdateSettings({ responseLength: event.target.value })} className="field">
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </label>

          <label className="workspace-modal__field">
            <span>Tone</span>
            <select value={activeSettings.tone} onChange={(event) => onUpdateSettings({ tone: event.target.value })} className="field">
              <option value="official">Official</option>
              <option value="balanced">Balanced</option>
              <option value="casual">Casual</option>
            </select>
          </label>

          <label className="workspace-modal__field">
            <span>Model override</span>
            <select value={activeSettings.model} onChange={(event) => onUpdateSettings({ model: event.target.value })} className="field">
              <option value="">Auto (recommended)</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5 (fast)</option>
              <option value="claude-opus-4-6">Claude Opus 4.6 (most capable)</option>
            </select>
          </label>

          <label className="workspace-modal__toggle">
            <input type="checkbox" checked={activeSettings.useLore} onChange={(event) => onUpdateSettings({ useLore: event.target.checked })} />
            <span>Use LORE retrieval</span>
          </label>

          <label className="workspace-modal__toggle">
            <input type="checkbox" checked={activeSettings.voiceReplies} onChange={(event) => onUpdateSettings({ voiceReplies: event.target.checked })} />
            <span>Voice replies</span>
          </label>

          <label className="workspace-modal__toggle">
            <input type="checkbox" checked={activeSettings.voiceAutoSend} onChange={(event) => onUpdateSettings({ voiceAutoSend: event.target.checked })} />
            <span>Auto-send voice messages</span>
          </label>

          <label className="workspace-modal__field">
            <span>Voice input mode</span>
            <select value={activeSettings.voiceInputMode} onChange={(event) => onUpdateSettings({ voiceInputMode: event.target.value })} className="field">
              <option value="brief">Brief</option>
              <option value="continuous">Continuous</option>
            </select>
          </label>

          <label className="workspace-modal__field">
            <span>Voice input language</span>
            <select value={activeSettings.voiceInputLanguage} onChange={(event) => onUpdateSettings({ voiceInputLanguage: event.target.value })} className="field">
              <option value="en-GB">English (UK)</option>
              <option value="en-US">English (US)</option>
            </select>
          </label>

          <label className="workspace-modal__field">
            <span>Voice reply speed</span>
            <select value={activeSettings.voiceReplyRate} onChange={(event) => onUpdateSettings({ voiceReplyRate: event.target.value })} className="field">
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>

          <label className="workspace-modal__field">
            <span>Voice reply length</span>
            <select value={activeSettings.voiceReplyLength} onChange={(event) => onUpdateSettings({ voiceReplyLength: event.target.value })} className="field">
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </label>

          <label className="workspace-modal__field">
            <span>Voice reply tone</span>
            <select value={activeSettings.voiceReplyPitch} onChange={(event) => onUpdateSettings({ voiceReplyPitch: event.target.value })} className="field">
              <option value="grounded">Grounded</option>
              <option value="natural">Natural</option>
              <option value="bright">Bright</option>
            </select>
          </label>

          <label className="workspace-modal__field workspace-modal__field--full">
            <span>Custom instructions</span>
            <textarea
              value={activeSettings.customInstructions}
              onChange={(event) => onUpdateSettings({ customInstructions: event.target.value.slice(0, 1000) })}
              className="field field--textarea"
              rows={5}
              placeholder="Example: Keep recommendations decisive, reference our premium positioning, and avoid fluff."
            />
          </label>
        </div>

        <div className="workspace-modal__footer">
          <InlineNotice tone="default">
            These settings are applied per agent chat and sent into generation, not just stored visually.
          </InlineNotice>
          <Button tone="accent" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
