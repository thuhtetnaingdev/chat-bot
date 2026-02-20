/**
 * Image compression utility for IndexedDB storage
 * Compresses images to reduce storage size while maintaining quality
 */

export async function compressImage(
  base64Image: string,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions
      let width = img.width
      let height = img.height

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = width * ratio
        height = height * ratio
      }

      // Create canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to base64 with compression
      const compressed = canvas.toDataURL('image/jpeg', quality)
      resolve(compressed)
    }

    img.onerror = () => {
      // If compression fails, return original
      resolve(base64Image)
    }

    img.src = base64Image
  })
}

/**
 * Compress multiple images
 */
export async function compressImages(images: string[]): Promise<string[]> {
  return Promise.all(images.map(img => compressImage(img)))
}

/**
 * Get image size in bytes
 */
export function getImageSize(base64Image: string): number {
  // Remove data URI prefix
  const base64 = base64Image.split(',')[1] || base64Image
  // Base64 is 4/3 the size of binary
  return Math.ceil((base64.length * 3) / 4)
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
