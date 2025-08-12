import { db } from "@/db/client";
import { jobsTable } from "@/db/schema/jobs";
import { conversationMessages, conversations, files } from "@/db/schema";
import { eq, and, isNotNull, isNull, lte, sql } from "drizzle-orm";

/**
 * Clean up dangling files that are no longer referenced
 */
export const cleanupDanglingFiles = async (payload: {
  dryRun?: boolean;
  olderThanDays?: number;
}) => {
  const { dryRun = false, olderThanDays = 1 } = payload;
  
  console.log(`Cleanup dangling files (dry run: ${dryRun}, older than ${olderThanDays} days)`);
  
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  // Find files that are not referenced by any conversation message and are older than cutoff
  const danglingFiles = await db
    .select({
      id: files.id,
      name: files.name,
      size: files.size,
      createdAt: files.createdAt,
    })
    .from(files)
    .leftJoin(conversationMessages, eq(files.id, sql`ANY(${conversationMessages.fileIds})`))
    .where(
      and(
        isNull(conversationMessages.id), // Not referenced by any message
        lte(files.createdAt, cutoffDate),
        isNull(files.deletedAt)
      )
    )
    .limit(100); // Process in batches
  
  if (danglingFiles.length === 0) {
    console.log("No dangling files found");
    return { deletedCount: 0, totalSize: 0 };
  }
  
  const totalSize = danglingFiles.reduce((sum, file) => sum + (file.size || 0), 0);
  const fileIds = danglingFiles.map(f => f.id);
  
  console.log(`Found ${danglingFiles.length} dangling files (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
  
  if (!dryRun) {
    // Soft delete the files
    await db
      .update(files)
      .set({ deletedAt: new Date() })
      .where(sql`${files.id} = ANY(${fileIds})`);
    
    console.log(`Soft deleted ${danglingFiles.length} dangling files`);
  } else {
    console.log("Dry run - no files actually deleted");
  }
  
  return {
    deletedCount: dryRun ? 0 : danglingFiles.length,
    totalSize,
    files: danglingFiles.map(f => ({ id: f.id, name: f.name, size: f.size }))
  };
};

/**
 * Clean up old completed jobs
 */
export const cleanupOldJobs = async (payload: {
  olderThanHours?: number;
  batchSize?: number;
}) => {
  const { olderThanHours = 24 * 7, batchSize = 1000 } = payload; // Default 7 days
  
  console.log(`Cleaning up jobs older than ${olderThanHours} hours`);
  
  const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  
  // Delete completed jobs older than cutoff
  const result = await db
    .delete(jobsTable)
    .where(
      and(
        eq(jobsTable.status, 'completed'),
        lte(jobsTable.updatedAt, cutoffDate)
      )
    )
    .returning({ id: jobsTable.id });
  
  const deletedCount = result.length;
  console.log(`Deleted ${deletedCount} old completed jobs`);
  
  // Also clean up very old failed jobs (keep them longer for debugging)
  const oldFailedCutoff = new Date(Date.now() - (olderThanHours * 4) * 60 * 60 * 1000);
  const failedResult = await db
    .delete(jobsTable)
    .where(
      and(
        eq(jobsTable.status, 'dead_letter'),
        lte(jobsTable.updatedAt, oldFailedCutoff)
      )
    )
    .returning({ id: jobsTable.id });
  
  const deletedFailedCount = failedResult.length;
  console.log(`Deleted ${deletedFailedCount} old dead letter jobs`);
  
  return {
    deletedCompletedCount: deletedCount,
    deletedFailedCount: deletedFailedCount,
    totalDeleted: deletedCount + deletedFailedCount
  };
};

/**
 * Database maintenance and optimization
 */
export const performDatabaseMaintenance = async (payload: {
  vacuum?: boolean;
  analyze?: boolean;
}) => {
  const { vacuum = false, analyze = true } = payload;
  
  console.log(`Database maintenance (vacuum: ${vacuum}, analyze: ${analyze})`);
  
  const results: string[] = [];
  
  if (analyze) {
    try {
      await db.execute(sql`ANALYZE;`);
      results.push("ANALYZE completed");
      console.log("✓ Database ANALYZE completed");
    } catch (error) {
      console.error("✗ Database ANALYZE failed:", error);
      results.push(`ANALYZE failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  if (vacuum) {
    try {
      // Use VACUUM (without FULL) for better performance
      await db.execute(sql`VACUUM;`);
      results.push("VACUUM completed");
      console.log("✓ Database VACUUM completed");
    } catch (error) {
      console.error("✗ Database VACUUM failed:", error);
      results.push(`VACUUM failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  return { operations: results };
};