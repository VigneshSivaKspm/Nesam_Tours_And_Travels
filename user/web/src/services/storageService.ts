import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase';
import { withRetry, withTimeout } from '../utils/retry';

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_EDGE_PX = 512;

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Please choose an image file (JPG, PNG or WebP).';
  if (file.size > MAX_INPUT_BYTES) return 'That image is larger than 10 MB. Please choose a smaller one.';
  return null;
}

/** Downscales to a square-ish JPEG ≤ 512px so profile uploads stay ~50 KB. */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // unsupported format (e.g. HEIC on desktop) — upload as-is
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  return blob ?? file;
}

/** Uploads to customers/{uid}/profile/avatar.jpg and returns the download URL. */
export async function uploadProfilePhoto(
  uid: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);
  const blob = await resizeImage(file);
  const objectRef = ref(storage, `customers/${uid}/profile/avatar-${Date.now()}.jpg`);
  return withRetry(async () => {
    const task = uploadBytesResumable(objectRef, blob, { contentType: blob.type || 'image/jpeg' });
    task.on('state_changed', (s) => onProgress?.(Math.round((s.bytesTransferred / Math.max(1, s.totalBytes)) * 100)));
    await withTimeout(task.then(() => undefined), 60000, 'Photo upload timed out.').catch((err) => {
      task.cancel();
      throw err;
    });
    return getDownloadURL(objectRef);
  }, { retries: 2 });
}
