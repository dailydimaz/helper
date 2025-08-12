import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  cleanupDanglingFiles, 
  cleanupOldJobs, 
  performDatabaseMaintenance 
} from '@/jobs/lightweight/systemMaintenance';
import { db } from '@/db/client';
import { jobsTable } from '@/db/schema/jobs';
import { files } from '@/db/schema';

// Mock the database
vi.mock('@/db/client', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

// Mock the schema
vi.mock('@/db/schema/jobs', () => ({
  jobsTable: {
    id: 'id',
    status: 'status',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@/db/schema', () => ({
  files: {
    id: 'id',
    name: 'name',
    size: 'size',
    createdAt: 'created_at',
    deletedAt: 'deleted_at',
  },
  conversationMessages: {
    id: 'id',
    fileIds: 'file_ids',
  },
}));

describe('System Maintenance Jobs', () => {
  const mockDb = db as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanupDanglingFiles', () => {
    it('should identify and clean up dangling files', async () => {
      const mockDanglingFiles = [
        { id: 1, name: 'file1.txt', size: 1024, createdAt: new Date('2023-01-01') },
        { id: 2, name: 'file2.pdf', size: 2048, createdAt: new Date('2023-01-02') },
        { id: 3, name: 'file3.jpg', size: 4096, createdAt: new Date('2023-01-03') },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockDanglingFiles),
            }),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await cleanupDanglingFiles({ dryRun: false, olderThanDays: 1 });

      expect(result.deletedCount).toBe(3);
      expect(result.totalSize).toBe(7168); // Sum of file sizes
      expect(result.files).toHaveLength(3);
      expect(mockDb.update).toHaveBeenCalledWith(files);
    });

    it('should perform dry run without actually deleting files', async () => {
      const mockDanglingFiles = [
        { id: 1, name: 'file1.txt', size: 1024, createdAt: new Date('2023-01-01') },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockDanglingFiles),
            }),
          }),
        }),
      });

      const result = await cleanupDanglingFiles({ dryRun: true, olderThanDays: 1 });

      expect(result.deletedCount).toBe(0);
      expect(result.totalSize).toBe(1024);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should handle no dangling files found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await cleanupDanglingFiles({});

      expect(result.deletedCount).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.files).toHaveLength(0);
    });

    it('should use default parameters', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await cleanupDanglingFiles({});

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('cleanupOldJobs', () => {
    it('should clean up old completed and dead letter jobs', async () => {
      const mockCompletedJobs = [
        { id: 1 }, { id: 2 }, { id: 3 }
      ];
      const mockFailedJobs = [
        { id: 4 }, { id: 5 }
      ];

      mockDb.delete
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue(mockCompletedJobs),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue(mockFailedJobs),
        });

      const result = await cleanupOldJobs({ olderThanHours: 168, batchSize: 1000 });

      expect(result.deletedCompletedCount).toBe(3);
      expect(result.deletedFailedCount).toBe(2);
      expect(result.totalDeleted).toBe(5);
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
      expect(mockDb.delete).toHaveBeenCalledWith(jobsTable);
    });

    it('should use default parameters', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });

      const result = await cleanupOldJobs({});

      expect(result.deletedCompletedCount).toBe(0);
      expect(result.deletedFailedCount).toBe(0);
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(cleanupOldJobs({})).rejects.toThrow('Database error');
    });
  });

  describe('performDatabaseMaintenance', () => {
    it('should perform ANALYZE operation successfully', async () => {
      mockDb.execute.mockResolvedValue(undefined);

      const result = await performDatabaseMaintenance({ analyze: true, vacuum: false });

      expect(result.operations).toContain('ANALYZE completed');
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('should perform VACUUM operation successfully', async () => {
      mockDb.execute.mockResolvedValue(undefined);

      const result = await performDatabaseMaintenance({ analyze: false, vacuum: true });

      expect(result.operations).toContain('VACUUM completed');
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('should perform both ANALYZE and VACUUM operations', async () => {
      mockDb.execute.mockResolvedValue(undefined);

      const result = await performDatabaseMaintenance({ analyze: true, vacuum: true });

      expect(result.operations).toContain('ANALYZE completed');
      expect(result.operations).toContain('VACUUM completed');
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });

    it('should handle ANALYZE failure gracefully', async () => {
      mockDb.execute.mockRejectedValue(new Error('ANALYZE failed'));

      const result = await performDatabaseMaintenance({ analyze: true, vacuum: false });

      expect(result.operations).toContain('ANALYZE failed: ANALYZE failed');
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle VACUUM failure gracefully', async () => {
      mockDb.execute.mockRejectedValue(new Error('VACUUM failed'));

      const result = await performDatabaseMaintenance({ analyze: false, vacuum: true });

      expect(result.operations).toContain('VACUUM failed: VACUUM failed');
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed success and failure', async () => {
      mockDb.execute
        .mockResolvedValueOnce(undefined) // ANALYZE succeeds
        .mockRejectedValueOnce(new Error('VACUUM failed')); // VACUUM fails

      const result = await performDatabaseMaintenance({ analyze: true, vacuum: true });

      expect(result.operations).toContain('ANALYZE completed');
      expect(result.operations).toContain('VACUUM failed: VACUUM failed');
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });

    it('should use default parameters (analyze only)', async () => {
      mockDb.execute.mockResolvedValue(undefined);

      const result = await performDatabaseMaintenance({});

      expect(result.operations).toContain('ANALYZE completed');
      expect(result.operations).not.toContain('VACUUM completed');
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });
});