const TOKEN_LINE_PATTERN = /^\d{1,3}(?:,\d{3})*(?:\.\d+)?\s+tokens$/i;
const BADGE_LINE_PATTERNS = [
  /^schema (validated|repaired|failed)$/i,
  /^sentinel (verified|repaired|held for review)$/i,
];
const TRACE_ACTION_PATTERN = /^(open|why this source won)$/i;
const TRACE_TOOL_PATTERN = /^[a-z][a-z0-9 /_-]*\s*\|\s*[a-z][a-z0-9 /_-]*\s*\|\s*[a-z][a-z0-9 /_-]*$/i;

export function buildMessagePresentation({ content = '', agentId = '' } = {}) {
  const normalizedContent = normalizeMessageContent(content);

  if (!normalizedContent) {
    return {
      agentId,
      markdown: '',
      markdownBlocks: [],
      structuredData: null,
      structuredRaw: null,
      traceSources: [],
    };
  }

  const traceExtraction = extractResearchTrace(normalizedContent);
  const withoutTrace = stripStandaloneArtifactLines(traceExtraction.cleanedText);
  const structuredExtraction = extractStructuredPayload(withoutTrace);
  const markdown = stripStandaloneArtifactLines(structuredExtraction.cleanedText);

  return {
    agentId,
    markdown,
    markdownBlocks: tokenizeMarkdownWithTables(markdown),
    structuredData: structuredExtraction.parsed,
    structuredRaw: structuredExtraction.raw,
    traceSources: traceExtraction.sources,
  };
}

export function getSpeechPreviewText({ content = '', agentId = '' } = {}) {
  const presentation = buildMessagePresentation({ content, agentId });
  const spokenBlocks = presentation.markdownBlocks
    .map((block) => {
      if (block.type === 'text') {
        return stripMarkdownSyntax(block.content);
      }

      if (block.type === 'table') {
        return block.rows
          .slice(0, 2)
          .map((row) =>
            block.headers
              .map((header, index) => {
                const value = row[index];
                return value ? `${header}: ${value}` : null;
              })
              .filter(Boolean)
              .join(', '),
          )
          .filter(Boolean)
          .join('. ');
      }

      return '';
    })
    .filter(Boolean);

  if (spokenBlocks.length > 0) {
    return collapseInlineWhitespace(spokenBlocks.join('. '));
  }

  const structuredSummary = extractStructuredSummary(presentation.structuredData);
  if (structuredSummary) {
    return collapseInlineWhitespace(structuredSummary);
  }

  return '';
}

export function tokenizeMarkdownWithTables(markdown = '') {
  const source = normalizeMessageContent(markdown);
  if (!source) return [];

  const lines = source.split('\n');
  const blocks = [];
  const markdownBuffer = [];
  let index = 0;
  let inCodeFence = false;

  const flushMarkdown = () => {
    const text = trimMarkdownChunk(markdownBuffer.join('\n'));
    markdownBuffer.length = 0;
    if (text) {
      blocks.push({ type: 'text', content: text });
    }
  };

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith('```')) {
      inCodeFence = !inCodeFence;
      markdownBuffer.push(line);
      index += 1;
      continue;
    }

    if (!inCodeFence && looksLikeTableRow(line) && isTableSeparator(lines[index + 1] ?? '')) {
      flushMarkdown();
      const tableLines = [line, lines[index + 1]];
      index += 2;

      while (index < lines.length && looksLikeTableRow(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      const parsedTable = parseMarkdownTable(tableLines);
      if (parsedTable) {
        blocks.push({ type: 'table', ...parsedTable });
        continue;
      }

      markdownBuffer.push(...tableLines);
      continue;
    }

    markdownBuffer.push(line);
    index += 1;
  }

  flushMarkdown();
  return blocks;
}

function extractResearchTrace(content) {
  const lines = content.split('\n');
  const toolIndexes = lines
    .map((line, index) => (TRACE_TOOL_PATTERN.test(line.trim()) ? index : -1))
    .filter((index) => index !== -1);

  if (toolIndexes.length === 0) {
    return { cleanedText: content, sources: [] };
  }

  const firstToolIndex = toolIndexes[0];
  let sectionStart = firstToolIndex;
  for (let index = firstToolIndex - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (!line) {
      break;
    }
    sectionStart = index;
    break;
  }

  const traceLines = lines.slice(sectionStart);
  const markerCount = traceLines.filter((line) => {
    const trimmed = line.trim();
    return TRACE_TOOL_PATTERN.test(trimmed) || TRACE_ACTION_PATTERN.test(trimmed);
  }).length;

  if (markerCount < 2) {
    return { cleanedText: content, sources: [] };
  }

  const sources = [];
  for (let index = 0; index < traceLines.length; index += 1) {
    const trimmed = traceLines[index].trim();
    if (!TRACE_TOOL_PATTERN.test(trimmed)) continue;

    const title = findPreviousContentLine(traceLines, index);
    if (!title) continue;

    const detailLines = [];
    for (let nextIndex = index + 1; nextIndex < traceLines.length; nextIndex += 1) {
      const detailLine = traceLines[nextIndex].trim();
      if (TRACE_TOOL_PATTERN.test(detailLine)) break;
      if (!detailLine || TRACE_ACTION_PATTERN.test(detailLine) || detailLine === title) continue;
      detailLines.push(detailLine);
    }

    if (sources.some((source) => source.title === title)) continue;

    sources.push({
      title,
      mode: trimmed,
      snippet: collapseInlineWhitespace(detailLines.join(' ')),
    });
  }

  return {
    cleanedText: trimMarkdownChunk(lines.slice(0, sectionStart).join('\n')),
    sources,
  };
}

function extractStructuredPayload(content) {
  const fencedBlocks = Array.from(content.matchAll(/```json\s*([\s\S]*?)```/gi));
  for (let index = fencedBlocks.length - 1; index >= 0; index -= 1) {
    const match = fencedBlocks[index];
    const raw = match[1].trim();
    const parsed = tryParseStructuredJson(raw);
    if (!parsed) continue;

    return {
      cleanedText: trimMarkdownChunk(`${content.slice(0, match.index)}\n\n${content.slice(match.index + match[0].length)}`),
      parsed,
      raw,
    };
  }

  const paragraphBlocks = getParagraphBlocks(content);
  for (let index = paragraphBlocks.length - 1; index >= 0; index -= 1) {
    const block = paragraphBlocks[index];
    const parsed = tryParseStructuredJson(block.text.trim());
    if (!parsed) continue;

    return {
      cleanedText: trimMarkdownChunk(`${content.slice(0, block.start)}\n\n${content.slice(block.end)}`),
      parsed,
      raw: block.text.trim(),
    };
  }

  return { cleanedText: content, parsed: null, raw: null };
}

function tryParseStructuredJson(candidate) {
  if (!candidate || (!candidate.startsWith('{') && !candidate.startsWith('['))) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.agent === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function stripStandaloneArtifactLines(content) {
  const filteredLines = content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (TOKEN_LINE_PATTERN.test(trimmed)) return false;
      if (BADGE_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;
      return true;
    });

  return trimMarkdownChunk(filteredLines.join('\n'));
}

function parseMarkdownTable(lines) {
  const rows = lines.map(splitTableCells).filter(Boolean);
  if (rows.length < 3) return null;

  const headers = rows[0];
  const bodyRows = rows
    .slice(2)
    .map((row) => normalizeRowLength(row, headers.length))
    .filter((row) => row.some((cell) => cell));

  return {
    headers,
    rows: bodyRows,
  };
}

function splitTableCells(line) {
  if (!looksLikeTableRow(line)) return null;

  let working = line.trim();
  if (working.startsWith('|')) working = working.slice(1);
  if (working.endsWith('|')) working = working.slice(0, -1);

  return working.split('|').map((cell) => cell.trim());
}

function normalizeRowLength(row, targetLength) {
  const nextRow = row.slice(0, targetLength);
  while (nextRow.length < targetLength) {
    nextRow.push('');
  }
  return nextRow;
}

function looksLikeTableRow(line = '') {
  if (!line || !line.includes('|')) return false;
  const cells = splitTableLikeCells(line);
  return cells.length >= 2;
}

function splitTableLikeCells(line) {
  let working = String(line).trim();
  if (working.startsWith('|')) working = working.slice(1);
  if (working.endsWith('|')) working = working.slice(0, -1);
  return working.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line = '') {
  const cells = splitTableLikeCells(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function getParagraphBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let offset = 0;
  let blockStart = null;
  let blockLines = [];

  lines.forEach((line, index) => {
    const lineLength = line.length + (index < lines.length - 1 ? 1 : 0);
    if (!line.trim()) {
      if (blockStart != null) {
        blocks.push({
          start: blockStart,
          end: offset,
          text: blockLines.join('\n'),
        });
        blockStart = null;
        blockLines = [];
      }
      offset += lineLength;
      return;
    }

    if (blockStart == null) {
      blockStart = offset;
    }

    blockLines.push(line);
    offset += lineLength;
  });

  if (blockStart != null) {
    blocks.push({
      start: blockStart,
      end: content.length,
      text: blockLines.join('\n'),
    });
  }

  return blocks;
}

function findPreviousContentLine(lines, startIndex) {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const value = lines[index].trim();
    if (!value) return null;
    if (!TRACE_ACTION_PATTERN.test(value)) {
      return value;
    }
  }
  return null;
}

function extractStructuredSummary(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';

  return [
    parsed.summary,
    parsed.executiveSummary,
    parsed.answer,
    parsed.recommendation,
    parsed.nextAction,
  ].find((value) => typeof value === 'string' && value.trim()) ?? '';
}

function stripMarkdownSyntax(content) {
  return collapseInlineWhitespace(
    String(content)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1')
      .replace(/(^|\n)\s*[-*+]\s+/g, '$1')
      .replace(/(^|\n)\s*\d+\.\s+/g, '$1')
      .replace(/[>*_~]/g, ' '),
  );
}

function normalizeMessageContent(content) {
  return String(content ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
}

function trimMarkdownChunk(content) {
  return String(content ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[\s\n]+|[\s\n]+$/g, '');
}

function collapseInlineWhitespace(content) {
  return String(content ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
