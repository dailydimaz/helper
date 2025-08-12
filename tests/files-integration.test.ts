/**
 * Integration test for the complete file storage system
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { 
  initializeStorage, 
  storeFile, 
  retrieveFile, 
  deleteFile, 
  fileExists 
} from '../lib/files/storage';
import { 
  validateFile, 
  validateFiles 
} from '../lib/files/validation';
import { 
  generateSecureFileKey,
  createSignedUrl,
  verifySignedUrl,
  sanitizeContentType,
  getFileSecurityHeaders
} from '../lib/files/security';

describe('File Storage System Integration', () => {
  const testStorageDir = './test-file-storage';
  const testFile = Buffer.from('Hello, World! This is a test file.');
  const testFileName = 'test-file.txt';

  beforeAll(async () => {
    // Initialize storage for tests
    await initializeStorage();
  });

  afterAll(async () => {
    // Cleanup test storage
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Validation', () => {
    it('should validate acceptable files', () => {
      const result = validateFile({
        name: 'test.pdf',
        size: 1024 * 1024, // 1MB
        mimetype: 'application/pdf',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject files with dangerous extensions', () => {
      const result = validateFile({
        name: 'malicious.exe',
        size: 1024,
        mimetype: 'application/octet-stream',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("File type '.exe' is not allowed for security reasons");
    });

    it('should reject oversized files', () => {
      const result = validateFile({
        name: 'large.pdf',
        size: 50 * 1024 * 1024, // 50MB
        mimetype: 'application/pdf',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('exceeds the 25MB limit');
    });

    it('should validate multiple files with size limits', () => {
      const files = [
        { name: 'file1.pdf', size: 10 * 1024 * 1024 },
        { name: 'file2.pdf', size: 15 * 1024 * 1024 },
      ];

      const result = validateFiles(files);
      expect(result.isValid).toBe(true);
    });
  });

  describe('File Storage Operations', () => {
    const testKey = 'test/path/test-file.txt';

    it('should store and retrieve a file', async () => {
      await storeFile(testKey, testFile, {
        mimetype: 'text/plain',
        isPublic: false,
      });

      const exists = await fileExists(testKey, { isPublic: false });
      expect(exists).toBe(true);

      const retrieved = await retrieveFile(testKey, { isPublic: false });
      expect(retrieved.toString()).toBe(testFile.toString());
    });

    it('should store public files separately', async () => {
      const publicKey = 'public/test-file.txt';
      
      await storeFile(publicKey, testFile, {
        mimetype: 'text/plain',
        isPublic: true,
      });

      const exists = await fileExists(publicKey, { isPublic: true });
      expect(exists).toBe(true);

      const retrieved = await retrieveFile(publicKey, { isPublic: true });
      expect(retrieved.toString()).toBe(testFile.toString());
    });

    it('should delete files', async () => {
      const deleteKey = 'test/delete/test-file.txt';
      
      await storeFile(deleteKey, testFile, {
        mimetype: 'text/plain',
        isPublic: false,
      });

      let exists = await fileExists(deleteKey, { isPublic: false });
      expect(exists).toBe(true);

      await deleteFile(deleteKey, { isPublic: false });

      exists = await fileExists(deleteKey, { isPublic: false });
      expect(exists).toBe(false);
    });
  });

  describe('File Security', () => {
    it('should generate secure file keys', () => {
      const key1 = generateSecureFileKey(['test'], 'file.txt');
      const key2 = generateSecureFileKey(['test'], 'file.txt');
      
      expect(key1).not.toBe(key2); // Should be unique
      expect(key1).toContain('file.txt');
      expect(key1).toContain('test');
    });

    it('should sanitize content types', () => {
      expect(sanitizeContentType('image/jpeg')).toBe('image/jpeg');
      expect(sanitizeContentType('text/html; charset=utf-8')).toBe('text/html');
      expect(sanitizeContentType('unknown/type')).toBe('application/octet-stream');
    });

    it('should generate appropriate security headers', () => {
      const imageHeaders = getFileSecurityHeaders('image/jpeg');
      expect(imageHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(imageHeaders['Content-Security-Policy']).toContain('img-src');

      const pdfHeaders = getFileSecurityHeaders('application/pdf');
      expect(pdfHeaders['Content-Disposition']).toBe('attachment');
    });
  });
});

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret-for-jwt-signing-in-tests-only';