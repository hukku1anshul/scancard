export interface PreparedImage {
  data: string; // base64 without prefix
  mimeType: string;
  dataUrl: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });
}

/** Downscale + JPEG-compress an image (File/Blob or URL) for upload / thumbnails. */
export async function prepareImage(src: Blob | string, maxDim = 1600, quality = 0.88): Promise<PreparedImage> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = await loadImage(url);
    const w0 = img.naturalWidth || 1200;
    const h0 = img.naturalHeight || 700;
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { dataUrl, data: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  }
}
