import { useRef, useState } from 'react';
import { api } from '../../../../lib/api';
import { consumeAgentStream } from '../../../../lib/agentStream';
import { findAgentByInvocation } from '../../../../lib/constants';
import { getErrorMessage } from '../../../../lib/utils';
import { extractImagePrompt } from '../../composer/commands';
import {
  getVoiceReplyCharacterLimit,
  getVoiceReplyPitch,
  getVoiceReplyRate,
} from '../../composer/voice';

/**
 * Owns streaming state and all send/image/file/audit actions.
 *
 * @param {object} params
 * @param {object} params.activeAgent
 * @param {Array}  params.unlockedAgents
 * @param {object} params.selectedConversationIds  — read-only snapshot
 * @param {object} params.settingsByAgent          — read-only snapshot
 * @param {function} params.setMessages            — from useConversationManager
 * @param {function} params.afterSendUpdate        — records conversationId after send
 * @param {object} params.queryClient
 * @param {function} params.notify
 * @param {function} params.navigate
 * @param {boolean} params.routeMode
 * @param {function} params.setDraft
 * @param {object} params.fileInputRef
 */
export function useChatSend({
  activeAgent,
  unlockedAgents,
  selectedConversationIds,
  settingsByAgent,
  setMessages,
  afterSendUpdate,
  queryClient,
  notify,
  navigate,
  routeMode,
  setDraft,
  fileInputRef,
}) {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [auditUrl, setAuditUrl] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [wrenEscalated, setWrenEscalated] = useState(false);

  // Stable refs so async callbacks always see the latest values without stale closures
  const selectedConversationIdsRef = useRef(selectedConversationIds);
  selectedConversationIdsRef.current = selectedConversationIds;
  const settingsByAgentRef = useRef(settingsByAgent);
  settingsByAgentRef.current = settingsByAgent;
  const activeAgentRef = useRef(activeAgent);
  activeAgentRef.current = activeAgent;
  const unlockedAgentsRef = useRef(unlockedAgents);
  unlockedAgentsRef.current = unlockedAgents;

  async function handleImageGeneration({ targetAgent, prompt }) {
    const settings = settingsByAgentRef.current[targetAgent.id] ?? {};
    const userContent = `/image ${prompt}`;

    setDraft('');
    setStreamingText('');
    setIsStreaming(true);
    setMessages((current) => [
      ...current,
      { id: `pending-user-${Date.now()}`, role: 'user', content: userContent },
    ]);

    try {
      const response = await api.post('/agents/generate-image', {
        agentId: targetAgent.id,
        conversationId: selectedConversationIdsRef.current[targetAgent.id] || undefined,
        prompt,
        quality: settings.responseLength === 'long' ? 'high' : settings.responseLength === 'short' ? 'low' : 'medium',
        size: '1024x1024',
        outputFormat: 'webp',
        background: 'auto',
      });

      setIsStreaming(false);
      setMessages((current) => [...current, response.message]);

      if (targetAgent.id === activeAgentRef.current?.id) {
        afterSendUpdate(targetAgent.id, response.conversationId);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['studio-conversations', targetAgent.id] }),
        response.conversationId
          ? queryClient.invalidateQueries({ queryKey: ['studio-messages', response.conversationId] })
          : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ['billing-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['viewer'] }),
      ]);

      notify({
        type: 'success',
        title: 'Image generated',
        message: `${targetAgent.name} created a new visual draft in this chat.`,
      });
    } catch (error) {
      setIsStreaming(false);
      notify({ type: 'error', title: 'Image generation failed', message: getErrorMessage(error) });
    }
  }

  async function handleSend(rawInput) {
    const input = (rawInput ?? '').trim();
    const agent = activeAgentRef.current;
    if (!agent || !input || isStreaming) return;

    const invokedAgent = findAgentByInvocation(input);
    const agents = unlockedAgentsRef.current;
    const targetAgent =
      invokedAgent && agents.some((a) => a.id === invokedAgent.id)
        ? agents.find((a) => a.id === invokedAgent.id) ?? agent
        : agent;

    const cleanedMessage = invokedAgent
      ? input.replace(new RegExp(`^hey\\s+${invokedAgent.name}`, 'i'), '').trim().replace(/^[:,.\\-\\s]+/, '')
      : input;
    const finalMessage = cleanedMessage || input;

    if (routeMode && targetAgent.id !== agent.id) {
      navigate(`/app/agents/${targetAgent.id}`);
      return;
    }

    if (/^\/image\s*$/i.test(finalMessage)) {
      notify({
        type: 'error',
        title: 'Image prompt missing',
        message: 'Add a prompt after /image so Prymal knows what to create.',
      });
      return;
    }

    const imagePrompt = extractImagePrompt(finalMessage);
    const isFirstMessage =
      !selectedConversationIdsRef.current[targetAgent.id] && /* messages.length === 0 — caller resets state */ true;

    if (imagePrompt) {
      await handleImageGeneration({ targetAgent, prompt: imagePrompt });
      return;
    }

    const textFiles = attachedFiles.filter((f) => f.isText);
    const attachmentPrefix = textFiles.length > 0
      ? textFiles.map((f) => `[Attached file: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n') + '\n\n'
      : '';
    const messageWithAttachments = attachmentPrefix ? `${attachmentPrefix}${finalMessage}` : finalMessage;

    const binaryAttachments = attachedFiles
      .filter((f) => f.isImage || f.isPdf)
      .map((f) => ({ base64: f.base64, mediaType: f.mediaType, name: f.name }));

    const attachmentNames = attachedFiles.map((f) => f.name);
    setDraft('');
    setAttachedFiles([]);
    setStreamingText('');
    setIsStreaming(true);
    setMessages((current) => [
      ...current,
      { id: `pending-user-${Date.now()}`, role: 'user', content: finalMessage, attachments: attachmentNames },
    ]);

    try {
      let fullText = '';
      const settings = settingsByAgentRef.current[targetAgent.id] ?? {};
      const response = await api.stream('/agents/chat', {
        method: 'POST',
        body: {
          agentId: targetAgent.id,
          conversationId: selectedConversationIdsRef.current[targetAgent.id] || undefined,
          message: messageWithAttachments,
          useLore: settings.useLore,
          model: settings.model || undefined,
          attachments: binaryAttachments.length > 0 ? binaryAttachments : undefined,
          preferences: {
            responseLength: settings.responseLength,
            tone: settings.tone,
            customInstructions: settings.customInstructions,
          },
        },
      });

      await consumeAgentStream(response, {
        onStarted: (event) => {
          if (targetAgent.id === activeAgentRef.current?.id && event.conversationId) {
            afterSendUpdate(targetAgent.id, event.conversationId);
          }
        },
        onChunk: (text) => {
          fullText += text;
          setStreamingText((current) => current + text);
        },
        onHold: (event) => {
          setStreamingText('');
          setIsStreaming(false);
          setMessages((current) => [
            ...current,
            {
              id: `hold-${Date.now()}`,
              role: 'assistant',
              content: '',
              _held: true,
              holdData: {
                message: event.message,
                concerns: event.sentinelConcerns ?? [],
                repairActions: event.sentinelRepairActions ?? [],
                conversationId: event.conversationId,
                agentId: event.agentId,
              },
            },
          ]);
          if (targetAgent.id === activeAgentRef.current?.id) {
            afterSendUpdate(targetAgent.id, event.conversationId);
          }
        },
        onDone: async (event) => {
          setStreamingText('');
          setIsStreaming(false);
          if (event.escalated) setWrenEscalated(true);

          setMessages((current) => [
            ...current,
            {
              id: event.messageId ?? `assistant-${Date.now()}`,
              role: 'assistant',
              content: fullText,
              tokensUsed: event.tokensUsed,
              schemaValidation: event.schemaValidation ?? null,
              sentinelReview: event.sentinelReview ?? null,
              metadata: {
                sources: event.sources ?? [],
                schemaValidation: event.schemaValidation ?? null,
                sentinelReview: event.sentinelReview ?? null,
              },
            },
          ]);

          if (targetAgent.id === activeAgentRef.current?.id) {
            afterSendUpdate(targetAgent.id, event.conversationId);
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['studio-conversations', targetAgent.id] }),
            event.conversationId
              ? queryClient.invalidateQueries({ queryKey: ['studio-messages', event.conversationId] })
              : Promise.resolve(),
            queryClient.invalidateQueries({ queryKey: ['billing-stats'] }),
            queryClient.invalidateQueries({ queryKey: ['viewer'] }),
          ]);

          if (
            isFirstMessage &&
            typeof window !== 'undefined' &&
            typeof window.prymalTrack === 'function'
          ) {
            window.prymalTrack('agent_first_message_sent', { agent: targetAgent.id });
          }

          if (
            settings.voiceReplies &&
            typeof window !== 'undefined' &&
            'speechSynthesis' in window &&
            fullText.trim()
          ) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(
              fullText.slice(0, getVoiceReplyCharacterLimit(settings.voiceReplyLength)),
            );
            utterance.rate = getVoiceReplyRate(settings.voiceReplyRate);
            utterance.pitch = getVoiceReplyPitch(settings.voiceReplyPitch);
            utterance.lang = settings.voiceInputLanguage || 'en-GB';
            window.speechSynthesis.speak(utterance);
          }
        },
      });
    } catch (error) {
      setIsStreaming(false);
      setStreamingText('');
      const conversationId = error?.conversationId || selectedConversationIdsRef.current[targetAgent.id];
      if (conversationId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['studio-conversations', targetAgent.id] }),
          queryClient.invalidateQueries({ queryKey: ['studio-messages', conversationId] }),
        ]);
      }
      if (error.code === 'RATE_LIMITED') {
        notify({
          type: 'warning',
          title: 'Chat limit reached',
          message: error.upgrade
            ? `You've used your plan's chat allowance. Upgrade to continue. Resets in ${error.retryAfter}s.`
            : `Too many requests. Please wait ${error.retryAfter}s before sending another message.`,
          action: error.upgrade ? { label: 'Upgrade plan', href: '/app/settings?tab=Billing' } : null,
        });
        return;
      }

      notify({ type: 'error', title: 'Chat failed', message: getErrorMessage(error) });
    }
  }

  function handleFileAttach(event) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html', 'application/xml', 'text/xml'];
    const TEXT_EXTENSIONS = /\.(txt|md|csv|json|html|xml)$/i;

    files.forEach((file) => {
      const isImage = IMAGE_TYPES.includes(file.type);
      const isPdf = file.type === 'application/pdf';
      const isText = TEXT_TYPES.includes(file.type) || TEXT_EXTENSIONS.test(file.name);

      if (!isImage && !isPdf && !isText) {
        notify({ type: 'error', title: 'Unsupported file type', message: `${file.name} — supported types: images, PDFs, text, CSV, JSON.` });
        return;
      }

      const maxBytes = isImage ? 10 * 1024 * 1024 : isPdf ? 5 * 1024 * 1024 : 500 * 1024;
      const limitLabel = isImage ? '10 MB' : isPdf ? '5 MB' : '500 KB';
      if (file.size > maxBytes) {
        notify({ type: 'error', title: 'File too large', message: `${file.name} exceeds the ${limitLabel} limit.` });
        return;
      }

      const reader = new FileReader();

      if (isImage) {
        reader.onload = (e) => {
          const dataUrl = e.target?.result ?? '';
          const base64 = dataUrl.split(',')[1] ?? '';
          setAttachedFiles((current) => {
            if (current.some((f) => f.name === file.name)) return current;
            return [...current, { name: file.name, type: file.type, base64, mediaType: file.type, isImage: true, previewUrl: dataUrl }];
          });
        };
        reader.readAsDataURL(file);
      } else if (isPdf) {
        reader.onload = (e) => {
          const buffer = e.target?.result;
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          setAttachedFiles((current) => {
            if (current.some((f) => f.name === file.name)) return current;
            return [...current, { name: file.name, type: file.type, base64, mediaType: 'application/pdf', isPdf: true }];
          });
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (e) => {
          const content = e.target?.result ?? '';
          setAttachedFiles((current) => {
            if (current.some((f) => f.name === file.name)) return current;
            return [...current, { name: file.name, type: file.type, content: String(content), isText: true }];
          });
        };
        reader.readAsText(file);
      }
    });

    event.target.value = '';
  }

  async function handleOracleAudit() {
    const url = auditUrl.trim();
    if (!url || isAuditing || isStreaming) return;

    let normalized = url;
    if (!/^https?:\/\//i.test(url)) normalized = `https://${url}`;

    try { new URL(normalized); } catch {
      notify({ type: 'error', title: 'Invalid URL', message: 'Enter a valid URL to audit.' });
      return;
    }

    setAuditUrl('');
    setIsAuditing(true);
    setIsStreaming(true);
    setStreamingText('');
    setMessages((current) => [
      ...current,
      { id: `audit-user-${Date.now()}`, role: 'user', content: `URL audit request: ${normalized}` },
    ]);

    try {
      let fullText = '';
      const response = await api.stream('/agents/oracle/audit', {
        method: 'POST',
        body: { url: normalized },
      });

      await consumeAgentStream(response, {
        onChunk: (text) => {
          fullText += text;
          setStreamingText((current) => current + text);
        },
        onDone: () => {
          setStreamingText('');
          setIsStreaming(false);
          setIsAuditing(false);
          setMessages((current) => [
            ...current,
            { id: `audit-assistant-${Date.now()}`, role: 'assistant', content: fullText },
          ]);
        },
        onError: (errorMessage) => {
          setStreamingText('');
          setIsStreaming(false);
          setIsAuditing(false);
          notify({ type: 'error', title: 'Audit failed', message: errorMessage });
        },
      });
    } catch (error) {
      setStreamingText('');
      setIsStreaming(false);
      setIsAuditing(false);
      notify({ type: 'error', title: 'Audit failed', message: error?.message ?? 'Unknown error.' });
    }
  }

  async function handleRequestReview(conversationId) {
    if (!conversationId) return;
    try {
      await api.post(`/agents/conversations/${conversationId}/request-review`, {});
      notify({ type: 'success', title: 'Review requested', message: 'Your request has been queued for the support team.' });
    } catch (error) {
      notify({ type: 'error', title: 'Request failed', message: getErrorMessage(error) });
    }
  }

  /** Called during startNewChat / clearCurrentConversation. */
  function resetSendState() {
    setStreamingText('');
    setAttachedFiles([]);
    setWrenEscalated(false);
  }

  return {
    streamingText,
    isStreaming,
    attachedFiles,
    setAttachedFiles,
    auditUrl,
    setAuditUrl,
    isAuditing,
    wrenEscalated,
    setWrenEscalated,
    handleSend,
    handleImageGeneration,
    handleFileAttach,
    handleOracleAudit,
    handleRequestReview,
    resetSendState,
  };
}
