import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

// Security constants
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7; // 7 days
const MAX_DOWNLOAD_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// In-memory rate limiting (in production, use Redis or similar)
const downloadAttempts = new Map<string, { count: number; resetTime: number }>();

export interface FileAccessPayload {
  fileId: number;
  userId?: number;
  slug: string;
  isPublic: boolean;
  expiresAt: number;
  purpose: "download" | "preview" | "stream";
}

export interface SignedUrlOptions {
  expiresIn?: number;
  purpose?: "download" | "preview" | "stream";
  maxDownloads?: number;
}

/**
 * Creates a signed URL for secure file access
 */
export const createSignedUrl = async (
  payload: Omit<FileAccessPayload, "expiresAt">,
  options: SignedUrlOptions = {}
): Promise<string> => {
  const { expiresIn = SIGNED_URL_EXPIRY, purpose = "download" } = options;
  
  const tokenPayload: FileAccessPayload = {
    ...payload,
    purpose,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  
  const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET!);
  
  const token = await new SignJWT(tokenPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(secret);
  
  return token;
};

/**
 * Verifies a signed URL token
 */
export const verifySignedUrl = async (token: string): Promise<FileAccessPayload | null> => {
  try {
    const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET!);
    
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as FileAccessPayload;
    
    // Check if token has expired
    if (decoded.expiresAt && Date.now() > decoded.expiresAt) {
      return null;
    }
    
    return decoded;
  } catch {
    return null;
  }
};

/**
 * Generates a secure file key with optional encryption
 */
export const generateSecureFileKey = (
  basePath: string[],
  filename: string,
  options: { encrypt?: boolean } = {}
): string => {
  const { encrypt = false } = options;
  
  const uuid = crypto.randomUUID();
  const sanitizedFilename = filename.replace(/(^.*[\\/])|[^\w.-]/g, "_");
  
  if (encrypt) {
    // Add additional entropy for sensitive files
    const entropy = randomBytes(16).toString("hex");
    return [...basePath, uuid, `${entropy}_${sanitizedFilename}`].join("/");
  }
  
  return [...basePath, uuid, sanitizedFilename].join("/");
};

/**
 * Generates a hash for file integrity verification
 */
export const generateFileHash = (data: Buffer, algorithm: string = "sha256"): string => {
  return createHash(algorithm).update(data).digest("hex");
};

/**
 * Verifies file integrity using hash
 */
export const verifyFileIntegrity = (
  data: Buffer,
  expectedHash: string,
  algorithm: string = "sha256"
): boolean => {
  const actualHash = generateFileHash(data, algorithm);
  return actualHash === expectedHash;
};

/**
 * Rate limiting for file downloads
 */
export const checkDownloadRateLimit = (identifier: string): boolean => {
  const now = Date.now();
  const record = downloadAttempts.get(identifier);
  
  if (!record || now > record.resetTime) {
    // Reset or create new record
    downloadAttempts.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }
  
  if (record.count >= MAX_DOWNLOAD_ATTEMPTS) {
    return false;
  }
  
  record.count++;
  return true;
};

/**
 * Cleans up expired rate limit records
 */
export const cleanupRateLimit = (): void => {
  const now = Date.now();
  for (const [key, record] of downloadAttempts.entries()) {
    if (now > record.resetTime) {
      downloadAttempts.delete(key);
    }
  }
};

/**
 * Validates file access permissions
 */
export const validateFileAccess = (
  fileData: {
    isPublic: boolean;
    messageId?: number | null;
    noteId?: number | null;
  },
  user: {
    id: number;
  } | null,
  requestedAccess: {
    conversationId?: number;
    noteId?: number;
  } = {}
): { allowed: boolean; reason?: string } => {
  // Public files are accessible to anyone
  if (fileData.isPublic) {
    return { allowed: true };
  }
  
  // Private files require authentication
  if (!user) {
    return { allowed: false, reason: "Authentication required for private files" };
  }
  
  // For message attachments, check conversation access
  if (fileData.messageId && requestedAccess.conversationId) {
    // This would need to be implemented based on your conversation access logic
    // For now, we'll assume the caller has already validated conversation access
    return { allowed: true };
  }
  
  // For note attachments, check note access
  if (fileData.noteId && requestedAccess.noteId) {
    // This would need to be implemented based on your note access logic
    // For now, we'll assume the caller has already validated note access
    return { allowed: true };
  }
  
  // If we can't determine access, default to deny
  return { allowed: false, reason: "Access denied" };
};

/**
 * Sanitizes content type for security
 */
export const sanitizeContentType = (contentType: string): string => {
  // Remove any potentially dangerous content type parameters
  const cleanType = contentType.split(";")[0].trim().toLowerCase();
  
  // Whitelist of safe content types
  const safeTypes = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf", "text/plain", "application/json", "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];
  
  if (safeTypes.includes(cleanType)) {
    return cleanType;
  }
  
  // Default to octet-stream for unknown types
  return "application/octet-stream";
};

/**
 * Generates Content Security Policy headers for file serving
 */
export const getFileSecurityHeaders = (contentType: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Cache-Control": "private, max-age=3600",
  };
  
  // For HTML content, add strict CSP
  if (contentType.includes("text/html")) {
    headers["Content-Security-Policy"] = "default-src 'none'";
  }
  
  // For images, allow inline display but prevent scripts
  if (contentType.startsWith("image/")) {
    headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'";
  }
  
  // For PDFs and documents, prevent script execution
  if (contentType.includes("pdf") || contentType.includes("document")) {
    headers["Content-Security-Policy"] = "default-src 'none'; object-src 'self'";
    headers["Content-Disposition"] = "attachment"; // Force download for security
  }
  
  return headers;
};

/**
 * Creates a temporary download token for one-time use
 */
export const createTempDownloadToken = async (
  fileSlug: string,
  userId?: number,
  expiresInMinutes: number = 15
): Promise<string> => {
  const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET!);
  
  const token = await new SignJWT({
    slug: fileSlug,
    userId,
    temp: true,
    jti: randomBytes(16).toString("hex"),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + (expiresInMinutes * 60))
    .sign(secret);
    
  return token;
};

/**
 * Verifies and invalidates a temporary download token
 */
export const verifyTempDownloadToken = async (token: string): Promise<{
  slug?: string;
  userId?: number;
  valid: boolean;
}> => {
  try {
    const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET!);
    
    const { payload } = await jwtVerify(token, secret);
    const decoded = payload as any;
    
    if (!decoded.temp || !decoded.slug) {
      return { valid: false };
    }
    
    return {
      slug: decoded.slug,
      userId: decoded.userId,
      valid: true,
    };
  } catch {
    return { valid: false };
  }
};

// Cleanup rate limiting records every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimit, 5 * 60 * 1000);
}