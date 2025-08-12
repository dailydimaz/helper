import mime from "mime";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_COUNT = 10;

// Allowed mime types - comprehensive list for various use cases
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/rtf",
  
  // Text files
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
  
  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/gzip",
  "application/x-tar",
  
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",
  
  // Video
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/avi",
  "video/quicktime",
]);

// Dangerous file extensions to block
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "pif", "scr", "vbs", "js", "jar", "app", "deb", "pkg", "dmg",
  "php", "asp", "jsp", "py", "rb", "pl", "sh", "ps1", "msi", "dll", "sys", "bin"
]);

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface FileInfo {
  name: string;
  size: number;
  mimetype?: string;
}

/**
 * Validates file extension against dangerous types
 */
export const validateFileExtension = (filename: string): FileValidationResult => {
  const extension = filename.split(".").pop()?.toLowerCase();
  
  if (!extension) {
    return {
      isValid: false,
      errors: ["File must have an extension"],
    };
  }
  
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return {
      isValid: false,
      errors: [`File type '.${extension}' is not allowed for security reasons`],
    };
  }
  
  return { isValid: true, errors: [] };
};

/**
 * Validates file mimetype
 */
export const validateMimeType = (filename: string, detectedMimeType?: string): FileValidationResult => {
  // Get mimetype from filename if not provided
  const expectedMimeType = mime.getType(filename);
  const mimeTypeToCheck = detectedMimeType || expectedMimeType;
  
  if (!mimeTypeToCheck) {
    return {
      isValid: false,
      errors: ["Could not determine file type"],
    };
  }
  
  if (!ALLOWED_MIME_TYPES.has(mimeTypeToCheck)) {
    return {
      isValid: false,
      errors: [`File type '${mimeTypeToCheck}' is not supported`],
    };
  }
  
  // Check if detected mimetype matches expected mimetype
  const warnings: string[] = [];
  if (detectedMimeType && expectedMimeType && detectedMimeType !== expectedMimeType) {
    warnings.push(`File extension suggests '${expectedMimeType}' but detected '${detectedMimeType}'`);
  }
  
  return { 
    isValid: true, 
    errors: [],
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

/**
 * Validates file size
 */
export const validateFileSize = (size: number, filename: string): FileValidationResult => {
  if (size <= 0) {
    return {
      isValid: false,
      errors: [`File '${filename}' appears to be empty`],
    };
  }
  
  if (size > MAX_FILE_SIZE) {
    const sizeMB = Math.round(size / 1024 / 1024);
    const limitMB = Math.round(MAX_FILE_SIZE / 1024 / 1024);
    return {
      isValid: false,
      errors: [`File '${filename}' size (${sizeMB}MB) exceeds the ${limitMB}MB limit`],
    };
  }
  
  return { isValid: true, errors: [] };
};

/**
 * Validates filename for security issues
 */
export const validateFilename = (filename: string): FileValidationResult => {
  const errors: string[] = [];
  
  // Check for empty filename
  if (!filename || filename.trim().length === 0) {
    errors.push("Filename cannot be empty");
  }
  
  // Check filename length
  if (filename.length > 255) {
    errors.push("Filename is too long (max 255 characters)");
  }
  
  // Check for path traversal attempts
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    errors.push("Filename contains invalid characters");
  }
  
  // Check for reserved names (Windows)
  const reservedNames = ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"];
  const nameWithoutExt = filename.split(".")[0].toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    errors.push("Filename is reserved and cannot be used");
  }
  
  // Check for control characters
  if (/[\x00-\x1f\x80-\x9f]/.test(filename)) {
    errors.push("Filename contains invalid control characters");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates a single file
 */
export const validateFile = (
  file: FileInfo,
  options: {
    detectedMimeType?: string;
    allowedMimeTypes?: string[];
    maxSize?: number;
  } = {}
): FileValidationResult => {
  const { detectedMimeType, allowedMimeTypes, maxSize = MAX_FILE_SIZE } = options;
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate filename
  const filenameResult = validateFilename(file.name);
  errors.push(...filenameResult.errors);
  
  // Validate file extension
  const extensionResult = validateFileExtension(file.name);
  errors.push(...extensionResult.errors);
  
  // Validate mimetype
  const mimeResult = validateMimeType(file.name, detectedMimeType);
  errors.push(...mimeResult.errors);
  if (mimeResult.warnings) {
    warnings.push(...mimeResult.warnings);
  }
  
  // Check against custom allowed mimetypes if provided
  if (allowedMimeTypes && allowedMimeTypes.length > 0) {
    const mimeType = detectedMimeType || mime.getType(file.name);
    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      errors.push(`File type '${mimeType}' is not allowed in this context`);
    }
  }
  
  // Validate file size
  const sizeResult = validateFileSize(file.size, file.name);
  errors.push(...sizeResult.errors);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

/**
 * Validates multiple files including total size limit
 */
export const validateFiles = (
  files: FileInfo[],
  existingFiles: FileInfo[] = [],
  options: {
    maxCount?: number;
    maxTotalSize?: number;
    allowedMimeTypes?: string[];
  } = {}
): FileValidationResult => {
  const { 
    maxCount = MAX_FILE_COUNT, 
    maxTotalSize = MAX_TOTAL_SIZE,
    allowedMimeTypes
  } = options;
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check file count
  const totalCount = files.length + existingFiles.length;
  if (totalCount > maxCount) {
    errors.push(`Cannot upload more than ${maxCount} files total (currently ${totalCount})`);
  }
  
  // Validate each file
  for (const file of files) {
    const fileResult = validateFile(file, { allowedMimeTypes });
    errors.push(...fileResult.errors);
    if (fileResult.warnings) {
      warnings.push(...fileResult.warnings);
    }
  }
  
  // Check total size
  const newFilesSize = files.reduce((sum, file) => sum + file.size, 0);
  const existingFilesSize = existingFiles.reduce((sum, file) => sum + file.size, 0);
  const totalSize = newFilesSize + existingFilesSize;
  
  if (totalSize > maxTotalSize) {
    const totalSizeMB = Math.round(totalSize / 1024 / 1024);
    const limitMB = Math.round(maxTotalSize / 1024 / 1024);
    errors.push(`Total file size (${totalSizeMB}MB) exceeds the ${limitMB}MB limit`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};

/**
 * Sanitizes a filename for safe storage
 */
export const sanitizeFilename = (filename: string): string => {
  // Replace invalid characters with underscores
  let sanitized = filename.replace(/[^\w.-]/g, "_");
  
  // Remove any path components
  sanitized = sanitized.replace(/(^.*[\\/])/, "");
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf("."));
    const name = sanitized.substring(0, sanitized.lastIndexOf("."));
    sanitized = name.substring(0, 255 - ext.length) + ext;
  }
  
  // Ensure it doesn't start with a dot or dash
  if (sanitized.startsWith(".") || sanitized.startsWith("-")) {
    sanitized = "file_" + sanitized;
  }
  
  return sanitized || "unnamed_file";
};

export { MAX_FILE_SIZE, MAX_TOTAL_SIZE, MAX_FILE_COUNT, ALLOWED_MIME_TYPES };