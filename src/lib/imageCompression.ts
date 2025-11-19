import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

/**
 * Compresses an image file client-side before upload
 * Default: max 0.3MB, max dimension 1200px
 * Perfect for mobile uploads - reduces 10MB photos to ~200-300KB
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const defaultOptions = {
    maxSizeMB: 0.3, // Target 300KB max
    maxWidthOrHeight: 1200, // Good for reference images
    useWebWorker: true, // Don't block UI
    ...options,
  };

  try {
    const compressedFile = await imageCompression(file, defaultOptions);
    console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to compress image');
  }
}

/**
 * Validates image file type and size before compression
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Please upload a JPG, PNG, or WebP image' };
  }
  
  // Check if file is larger than 50MB (pre-compression limit)
  const maxSizeMB = 50;
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `Image must be smaller than ${maxSizeMB}MB` };
  }
  
  return { valid: true };
}
