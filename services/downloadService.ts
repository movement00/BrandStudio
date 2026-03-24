/**
 * Safe image download utility.
 *
 * Problem: Using <a href="data:image/png;base64,..."> with large images causes:
 * - iOS Safari: Navigates to data URL → crash / page unload
 * - Android Chrome: Out of memory on large images
 * - Desktop: Tab freeze on very large images
 *
 * Solution: Convert base64 → Blob → ObjectURL which is a short pointer,
 * not a megabyte-long string.
 */

export const downloadBase64Image = (base64: string, filename: string): void => {
  try {
    const byteChars = atob(base64);
    const byteNumbers = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('Download failed:', err);
  }
};

/**
 * Download multiple images with staggered timing to prevent browser blocking.
 */
export const downloadMultipleImages = async (
  items: Array<{ base64: string; filename: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  for (let i = 0; i < items.length; i++) {
    downloadBase64Image(items[i].base64, items[i].filename);
    onProgress?.(i + 1, items.length);
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
};
