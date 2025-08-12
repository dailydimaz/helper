import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

const STORAGE_BASE_PATH = env.NODE_ENV === "production" ? "/tmp/file-storage" : "./file-storage";
const PUBLIC_PATH = path.join(STORAGE_BASE_PATH, "public");
const PRIVATE_PATH = path.join(STORAGE_BASE_PATH, "private");

export interface StorageFile {
  path: string;
  mimetype: string;
  size: number;
}

/**
 * Ensures storage directories exist
 */
export const ensureStorageDirectories = async () => {
  await fs.mkdir(PUBLIC_PATH, { recursive: true });
  await fs.mkdir(PRIVATE_PATH, { recursive: true });
};

/**
 * Generates a secure file path with UUID and sanitized filename
 */
export const generateStoragePath = (basePathParts: string[], fileName: string): string => {
  const sanitizedFileName = fileName.replace(/(^.*[\\/])|[^\w.-]/g, "_");
  const uuid = crypto.randomUUID();
  return path.join(...basePathParts, uuid, sanitizedFileName);
};

/**
 * Stores a file in the local filesystem
 */
export const storeFile = async (
  filePath: string,
  data: Buffer,
  options: {
    mimetype?: string;
    isPublic?: boolean;
  } = {}
): Promise<StorageFile> => {
  const { mimetype = "application/octet-stream", isPublic = false } = options;
  const basePath = isPublic ? PUBLIC_PATH : PRIVATE_PATH;
  const fullPath = path.join(basePath, filePath);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  
  // Write file
  await fs.writeFile(fullPath, data);
  
  return {
    path: filePath,
    mimetype,
    size: data.length,
  };
};

/**
 * Retrieves a file from the local filesystem
 */
export const retrieveFile = async (
  filePath: string,
  options: { isPublic?: boolean } = {}
): Promise<Buffer> => {
  const { isPublic = false } = options;
  const basePath = isPublic ? PUBLIC_PATH : PRIVATE_PATH;
  const fullPath = path.join(basePath, filePath);
  
  try {
    return await fs.readFile(fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
};

/**
 * Checks if a file exists
 */
export const fileExists = async (
  filePath: string,
  options: { isPublic?: boolean } = {}
): Promise<boolean> => {
  const { isPublic = false } = options;
  const basePath = isPublic ? PUBLIC_PATH : PRIVATE_PATH;
  const fullPath = path.join(basePath, filePath);
  
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Deletes a file from the local filesystem
 */
export const deleteFile = async (
  filePath: string,
  options: { isPublic?: boolean } = {}
): Promise<void> => {
  const { isPublic = false } = options;
  const basePath = isPublic ? PUBLIC_PATH : PRIVATE_PATH;
  const fullPath = path.join(basePath, filePath);
  
  try {
    await fs.unlink(fullPath);
    
    // Try to remove empty parent directories
    const parentDir = path.dirname(fullPath);
    try {
      const files = await fs.readdir(parentDir);
      if (files.length === 0) {
        await fs.rmdir(parentDir);
      }
    } catch {
      // Directory not empty or other error, ignore
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};

/**
 * Deletes multiple files
 */
export const deleteFiles = async (
  filePaths: string[],
  options: { isPublic?: boolean } = {}
): Promise<void> => {
  const { isPublic = false } = options;
  
  await Promise.all(
    filePaths.map((filePath) =>
      deleteFile(filePath, { isPublic }).catch((error) => {
        console.warn(`Failed to delete file ${filePath}:`, error);
      })
    )
  );
};

/**
 * Gets file stats
 */
export const getFileStats = async (
  filePath: string,
  options: { isPublic?: boolean } = {}
): Promise<{ size: number; createdAt: Date; modifiedAt: Date }> => {
  const { isPublic = false } = options;
  const basePath = isPublic ? PUBLIC_PATH : PRIVATE_PATH;
  const fullPath = path.join(basePath, filePath);
  
  const stats = await fs.stat(fullPath);
  
  return {
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
  };
};

/**
 * Gets the absolute path to a file (for internal use)
 */
export const getAbsolutePath = (
  filePath: string,
  options: { isPublic?: boolean } = {}
): string => {
  const { isPublic = false } = options;
  const basePath = isPublic ? PUBLIC_PATH : PRIVATE_PATH;
  return path.join(basePath, filePath);
};

/**
 * Initialize storage system
 */
export const initializeStorage = async () => {
  await ensureStorageDirectories();
};