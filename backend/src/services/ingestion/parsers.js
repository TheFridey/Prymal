const TEXT_DECODER = new TextDecoder('utf-8', { fatal: false });

const TYPE_MAP = {
  '.txt': { sourceType: 'text', label: 'Plain text' },
  '.md': { sourceType: 'markdown', label: 'Markdown' },
  '.markdown': { sourceType: 'markdown', label: 'Markdown' },
  '.csv': { sourceType: 'csv', label: 'CSV' },
  '.pdf': { sourceType: 'pdf', label: 'PDF' },
  '.docx': { sourceType: 'docx', label: 'DOCX' },
};

export const SUPPORTED_UPLOAD_EXTENSIONS = Object.keys(TYPE_MAP);
export const SUPPORTED_UPLOAD_ACCEPT = SUPPORTED_UPLOAD_EXTENSIONS.join(',');

export function getUploadType(fileName = '') {
  const lowerName = fileName.toLowerCase();
  return TYPE_MAP[SUPPORTED_UPLOAD_EXTENSIONS.find((extension) => lowerName.endsWith(extension))] ?? null;
}

export async function parseUploadedFile(file) {
  const type = getUploadType(file?.name);

  if (!type) {
    const error = new Error('Supported upload types are TXT, MD, CSV, PDF, and DOCX.');
    error.status = 400;
    error.code = 'UNSUPPORTED_UPLOAD_TYPE';
    throw error;
  }

  const rawBuffer = await file.arrayBuffer();
  const rawText = await readTextByType(type.sourceType, rawBuffer);
  const text = normalizeText(rawText);

  if (!text.trim()) {
    const error = new Error('The uploaded file did not contain any readable text.');
    error.status = 400;
    error.code = 'EMPTY_UPLOAD';
    throw error;
  }

  return {
    sourceType: type.sourceType,
    text,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      parser: type.label,
      lineCount: text.split('\n').length,
    },
  };
}

async function readTextByType(sourceType, rawBuffer) {
  if (sourceType === 'pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(Buffer.from(rawBuffer));
    return result.text ?? '';
  }

  if (sourceType === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: Buffer.from(rawBuffer) });
    return result.value ?? '';
  }

  return TEXT_DECODER.decode(rawBuffer);
}

export function normalizeText(input) {
  return input
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
