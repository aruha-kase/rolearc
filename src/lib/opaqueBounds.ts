/**
 * Compute the opaque bounding box of an image as ratio insets (0–1).
 * Uses an offscreen canvas scaled down for performance.
 * Returns null if computation fails (CORS, fully transparent, etc.).
 */

const cache = new Map<string, OpaqueBounds | null>();

export interface OpaqueBounds {
  top: number;    // ratio from top edge
  right: number;  // ratio from right edge
  bottom: number; // ratio from bottom edge
  left: number;   // ratio from left edge
}

const MAX_ANALYSIS_SIZE = 256;
const ALPHA_THRESHOLD = 10;

export function computeOpaqueBounds(url: string): Promise<OpaqueBounds | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url)!);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) { cache.set(url, null); resolve(null); return; }

      const scale = Math.min(1, MAX_ANALYSIS_SIZE / Math.max(nw, nh));
      const sw = Math.round(nw * scale);
      const sh = Math.round(nh * scale);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) { cache.set(url, null); resolve(null); return; }

      try {
        ctx.drawImage(img, 0, 0, sw, sh);
        const data = ctx.getImageData(0, 0, sw, sh).data;

        let minX = sw, minY = sh, maxX = -1, maxY = -1;
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            if (data[(y * sw + x) * 4 + 3] > ALPHA_THRESHOLD) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < 0) {
          // Fully transparent – don't shrink
          cache.set(url, null);
          resolve(null);
          return;
        }

        const bounds: OpaqueBounds = {
          top: minY / sh,
          left: minX / sw,
          right: Math.max(0, (sw - maxX - 1) / sw),
          bottom: Math.max(0, (sh - maxY - 1) / sh),
        };

        // Only return if there's meaningful transparent margin (>2%)
        const hasMargin = bounds.top > 0.02 || bounds.right > 0.02 || bounds.bottom > 0.02 || bounds.left > 0.02;
        const result = hasMargin ? bounds : null;
        cache.set(url, result);
        resolve(result);
      } catch {
        // Canvas tainted (CORS) or other error
        cache.set(url, null);
        resolve(null);
      }
    };
    img.onerror = () => { cache.set(url, null); resolve(null); };
    img.src = url;
  });
}
