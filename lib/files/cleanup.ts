/**
 * File cleanup utilities for managing orphaned and expired files
 */

import { db } from "@/db/client";
import { filesTable } from "@/db/schema/files";
import { deleteFile, deleteFiles } from "@/lib/files/storage";
import { and, isNull, lt, eq } from "drizzle-orm";

/**
 * Cleanup orphaned files that aren't attached to messages or notes
 * and are older than the specified age
 */
export const cleanupOrphanedFiles = async (
  olderThanHours: number = 24
): Promise<{ deletedCount: number; errors: string[] }> => {
  const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const errors: string[] = [];
  
  try {
    // Find orphaned files (no messageId or noteId) older than cutoff
    const orphanedFiles = await db.query.filesTable.findMany({
      where: and(
        isNull(filesTable.messageId),
        isNull(filesTable.noteId),
        lt(filesTable.createdAt, cutoffTime)
      ),
    });

    console.log(`Found ${orphanedFiles.length} orphaned files to cleanup`);

    // Delete files from storage and database
    for (const file of orphanedFiles) {
      try {
        // Delete physical file
        await deleteFile(file.key, { isPublic: file.isPublic });
        
        // Delete database record
        await db.delete(filesTable).where(eq(filesTable.id, file.id));
        
        console.log(`Cleaned up orphaned file: ${file.name} (${file.slug})`);
      } catch (error) {
        const errorMsg = `Failed to cleanup file ${file.name} (${file.slug}): ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      deletedCount: orphanedFiles.length - errors.length,
      errors,
    };

  } catch (error) {
    const errorMsg = `Cleanup operation failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    return {
      deletedCount: 0,
      errors: [errorMsg],
    };
  }
};

/**
 * Cleanup all files associated with a specific conversation
 */
export const cleanupConversationFiles = async (
  conversationId: number
): Promise<{ deletedCount: number; errors: string[] }> => {
  const errors: string[] = [];
  
  try {
    // Find all files associated with messages in this conversation
    const conversationFiles = await db.query.filesTable.findMany({
      where: eq(filesTable.messageId, conversationId), // This would need to be adjusted based on your schema relations
    });

    console.log(`Found ${conversationFiles.length} files to cleanup for conversation ${conversationId}`);

    // Delete files from storage and database
    for (const file of conversationFiles) {
      try {
        // Delete physical file
        await deleteFile(file.key, { isPublic: file.isPublic });
        
        // Delete database record
        await db.delete(filesTable).where(eq(filesTable.id, file.id));
        
        console.log(`Cleaned up conversation file: ${file.name} (${file.slug})`);
      } catch (error) {
        const errorMsg = `Failed to cleanup file ${file.name} (${file.slug}): ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      deletedCount: conversationFiles.length - errors.length,
      errors,
    };

  } catch (error) {
    const errorMsg = `Conversation cleanup operation failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    return {
      deletedCount: 0,
      errors: [errorMsg],
    };
  }
};

/**
 * Get statistics about file storage usage
 */
export const getStorageStats = async (): Promise<{
  totalFiles: number;
  totalSize: number;
  orphanedFiles: number;
  orphanedSize: number;
  publicFiles: number;
  privateFiles: number;
}> => {
  try {
    // Get all files
    const allFiles = await db.query.filesTable.findMany();
    
    // Get orphaned files
    const orphanedFiles = await db.query.filesTable.findMany({
      where: and(
        isNull(filesTable.messageId),
        isNull(filesTable.noteId)
      ),
    });

    const totalSize = allFiles.reduce((sum, file) => sum + file.size, 0);
    const orphanedSize = orphanedFiles.reduce((sum, file) => sum + file.size, 0);
    const publicFiles = allFiles.filter(f => f.isPublic).length;
    const privateFiles = allFiles.filter(f => !f.isPublic).length;

    return {
      totalFiles: allFiles.length,
      totalSize,
      orphanedFiles: orphanedFiles.length,
      orphanedSize,
      publicFiles,
      privateFiles,
    };
  } catch (error) {
    console.error("Failed to get storage stats:", error);
    return {
      totalFiles: 0,
      totalSize: 0,
      orphanedFiles: 0,
      orphanedSize: 0,
      publicFiles: 0,
      privateFiles: 0,
    };
  }
};

/**
 * Schedule regular cleanup of orphaned files
 * This should be called from a cron job or background task
 */
export const scheduleFileCleanup = () => {
  // Run cleanup every 6 hours
  const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
  
  const runCleanup = async () => {
    console.log("Starting scheduled file cleanup...");
    const result = await cleanupOrphanedFiles(24); // Cleanup files older than 24 hours
    console.log(`Cleanup completed: ${result.deletedCount} files deleted, ${result.errors.length} errors`);
    
    if (result.errors.length > 0) {
      console.error("Cleanup errors:", result.errors);
    }
  };

  // Run immediately
  runCleanup();

  // Then schedule regular cleanup
  setInterval(runCleanup, CLEANUP_INTERVAL);
};