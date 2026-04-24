export function buildSlashCommands({
  activeAgent,
  promptCards,
  startNewChat,
  clearDraft,
  clearMessages,
  openSettings,
  focusPrompt,
  openImageBuilder,
  openVideoBuilder,
  toggleLore,
  toggleVoiceReplies,
  toggleVoiceAutoSend,
}) {
  if (!activeAgent) {
    return [];
  }

  const baseCommands = [
    {
      name: 'image',
      description: `Generate an image draft with ${activeAgent.name}`,
      run: () => openImageBuilder?.(),
    },
    {
      name: 'video',
      description: `Generate a short video draft with ${activeAgent.name}`,
      run: () => openVideoBuilder?.(),
    },
    {
      name: 'new',
      description: `Start a fresh ${activeAgent.name} chat`,
      run: startNewChat,
    },
    {
      name: 'clear',
      description: 'Clear the current draft and start a fresh thread',
      run: clearMessages,
    },
    {
      name: 'draft',
      description: 'Clear only the composer draft',
      run: clearDraft,
    },
    {
      name: 'settings',
      description: 'Open chat settings',
      run: openSettings,
    },
    {
      name: 'lore',
      description: 'Toggle LORE retrieval for this agent',
      run: toggleLore,
    },
    {
      name: 'voice',
      description: 'Toggle spoken replies from the agent',
      run: toggleVoiceReplies,
    },
    {
      name: 'autosend',
      description: 'Toggle auto-send for voice messages',
      run: toggleVoiceAutoSend,
    },
  ];

  const promptCommands = promptCards.map((prompt, index) => ({
    name: `prompt-${toSlashSlug(prompt, index + 1)}`,
    description: `Insert: ${prompt}`,
    run: () => focusPrompt(prompt),
  }));

  return [...promptCommands, ...baseCommands];
}

export function toSlashSlug(text, fallbackIndex) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 3)
    .join('-');

  return slug || `prompt-${fallbackIndex}`;
}

export function groupConversations(conversations, pinnedIds) {
  const pinnedSet = new Set(pinnedIds);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * oneDay;
  const pinned = [];
  const today = [];
  const recent = [];
  const earlier = [];

  for (const conversation of conversations) {
    if (pinnedSet.has(conversation.id)) {
      pinned.push(conversation);
      continue;
    }
    const age = now - new Date(conversation.lastActiveAt).getTime();
    if (age < oneDay) today.push(conversation);
    else if (age < sevenDays) recent.push(conversation);
    else earlier.push(conversation);
  }

  return [
    pinned.length ? { label: 'Pinned', items: pinned } : null,
    today.length ? { label: 'Today', items: today } : null,
    recent.length ? { label: 'Last 7 days', items: recent } : null,
    earlier.length ? { label: 'Earlier', items: earlier } : null,
  ].filter(Boolean);
}

export function extractImagePrompt(message) {
  const match = message.match(/^\/image(?:\s+(.+))$/i);
  return match?.[1]?.trim() || null;
}

export function extractVideoPrompt(message) {
  const match = message.match(/^\/video(?:\s+(.+))$/i);
  return match?.[1]?.trim() || null;
}

const VIDEO_DURATION_PATTERN = /\b(4|5|6|8|10|15)\s*(?:-|\u2013|\u2014)?\s*(?:s|sec|secs|second|seconds)\b/i;
const VIDEO_RESOLUTION_1080_PATTERN = /\b(?:1080p|full\s*hd)\b/i;
const VIDEO_RESOLUTION_720_PATTERN = /\b720p\b/i;
const VIDEO_ASPECT_VERTICAL_PATTERN = /\b(?:9\s*:\s*16|vertical|portrait)\b/i;
const VIDEO_ASPECT_HORIZONTAL_PATTERN = /\b(?:16\s*:\s*9|landscape|horizontal|widescreen)\b/i;

export function extractVideoRequest(message) {
  const prompt = extractVideoPrompt(message);

  if (!prompt) {
    return null;
  }

  return {
    prompt,
    durationSeconds: extractVideoDuration(prompt),
    resolution: extractVideoResolution(prompt),
    aspectRatio: extractVideoAspectRatio(prompt),
  };
}

function extractVideoDuration(prompt) {
  const match = String(prompt ?? '').match(VIDEO_DURATION_PATTERN);
  return match ? Number(match[1]) : 4;
}

function extractVideoResolution(prompt) {
  const normalized = String(prompt ?? '');

  if (VIDEO_RESOLUTION_1080_PATTERN.test(normalized)) {
    return '1080p';
  }

  if (VIDEO_RESOLUTION_720_PATTERN.test(normalized)) {
    return '720p';
  }

  return '720p';
}

function extractVideoAspectRatio(prompt) {
  const normalized = String(prompt ?? '');

  if (VIDEO_ASPECT_VERTICAL_PATTERN.test(normalized)) {
    return '9:16';
  }

  if (VIDEO_ASPECT_HORIZONTAL_PATTERN.test(normalized)) {
    return '16:9';
  }

  return '16:9';
}
