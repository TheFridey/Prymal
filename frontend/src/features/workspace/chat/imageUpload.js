export const WEBP_MIME_TYPE = 'image/webp';
export const WEBP_EXTENSION = 'webp';

export async function convertImageFileToWebpPayload(file, { quality = 0.92 } = {}) {
  if (!(file instanceof File) || !String(file.type ?? '').startsWith('image/')) {
    throw new Error('A valid image file is required.');
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext('2d');
  if (!context || canvas.width <= 0 || canvas.height <= 0) {
    throw new Error(`Could not convert ${file.name} to WEBP.`);
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const webpDataUrl = await canvasToDataUrl(canvas, quality);
  return {
    name: replaceImageExtension(file.name),
    mimeType: WEBP_MIME_TYPE,
    mediaType: WEBP_MIME_TYPE,
    base64: webpDataUrl.split(',')[1] ?? '',
    previewUrl: webpDataUrl,
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result ?? ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image conversion failed.'));
    image.src = dataUrl;
  });
}

function canvasToDataUrl(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('WEBP conversion failed.'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => resolve(String(event.target?.result ?? ''));
        reader.onerror = () => reject(new Error('WEBP conversion failed.'));
        reader.readAsDataURL(blob);
      },
      WEBP_MIME_TYPE,
      quality,
    );
  });
}

function replaceImageExtension(name) {
  const baseName = String(name ?? 'image')
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image';

  return `${baseName}.${WEBP_EXTENSION}`;
}
