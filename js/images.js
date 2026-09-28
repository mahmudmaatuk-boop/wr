// Downscale camera photos before storing: raw iPhone shots are several MB each.

const FULL_MAX = 1600;
const THUMB_MAX = 400;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Couldn't read “${file.name || 'image'}”.`)); };
    img.src = url; // <img> applies EXIF orientation, so no manual rotation is needed.
  });
}

function scaleTo(img, max, quality) {
  const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * ratio));
  const h = Math.max(1, Math.round(img.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve({ blob: b, width: w, height: h }) : reject(new Error('Image compression failed.'))),
      'image/jpeg', quality);
  });
}

/** File → { blob, thumb, width, height } ready to store. */
export async function processImage(file) {
  const img = await loadImage(file);
  const full = await scaleTo(img, FULL_MAX, 0.82);
  const thumb = await scaleTo(img, THUMB_MAX, 0.75);
  return { blob: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
}
