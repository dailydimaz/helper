#!/usr/bin/env tsx

/**
 * Setup script for the file storage system
 * This initializes the storage directories and verifies the setup
 */

import { initializeStorage, ensureStorageDirectories } from '../lib/files/storage';
import { getStorageStats, scheduleFileCleanup } from '../lib/files/cleanup';
import { validateFile } from '../lib/files/validation';

async function setupFileStorage() {
  console.log('🗂️  Initializing file storage system...');

  try {
    // Initialize storage directories
    await initializeStorage();
    console.log('✅ Storage directories created');

    // Test file validation
    const testValidation = validateFile({
      name: 'test.pdf',
      size: 1024 * 1024, // 1MB
      mimetype: 'application/pdf',
    });

    if (!testValidation.isValid) {
      throw new Error('File validation test failed');
    }
    console.log('✅ File validation working');

    // Get initial storage stats
    const stats = await getStorageStats();
    console.log(`📊 Initial storage stats:
    - Total files: ${stats.totalFiles}
    - Total size: ${Math.round(stats.totalSize / 1024 / 1024 * 100) / 100} MB
    - Orphaned files: ${stats.orphanedFiles}
    - Public files: ${stats.publicFiles}
    - Private files: ${stats.privateFiles}`);

    console.log('✅ File storage system setup complete!');
    console.log('
📁 Storage Structure:
  - Development: ./file-storage/
  - Public files: ./file-storage/public/
  - Private files: ./file-storage/private/

🔐 Security Features:
  - File type validation
  - Size limits (25MB per file)
  - Signed URLs for private files
  - Rate limiting
  - Security headers

🛠️ API Endpoints:
  - POST /api/files/initiate-upload
  - POST /api/files/upload/{slug}
  - GET /api/files/{slug}?token={jwt}
  - GET /api/files/public/{path}
  - DELETE /api/files/delete/{slug}

📖 Documentation: /lib/files/README.md
');

  } catch (error) {
    console.error('❌ File storage setup failed:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupFileStorage().catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

export { setupFileStorage };