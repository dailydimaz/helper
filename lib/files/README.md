# File Storage System

This directory contains the new file storage system that replaces Supabase Storage with a local filesystem-based solution.

## Architecture

The file storage system consists of three main components:

### 1. Storage Layer (`storage.ts`)
- **Purpose**: Handles physical file storage and retrieval
- **Features**:
  - Local filesystem storage in development
  - Configurable storage paths for production (can be mounted network drives, etc.)
  - Automatic directory creation
  - File existence checks and cleanup
  - Support for both public and private files

### 2. Validation Layer (`validation.ts`)
- **Purpose**: Validates file uploads for security and compliance
- **Features**:
  - Comprehensive MIME type validation
  - File size limits (25MB per file, 50MB total)
  - Filename security checks (path traversal protection)
  - Dangerous file extension blocking
  - Batch validation for multiple files

### 3. Security Layer (`security.ts`)
- **Purpose**: Handles access control and secure file serving
- **Features**:
  - JWT-based signed URLs for private files
  - Rate limiting for downloads
  - Content Security Policy headers
  - Temporary upload tokens
  - File integrity verification

## File Organization

Files are organized in the following structure:

```
file-storage/
├── public/          # Public files (accessible without authentication)
│   ├── attachments/
│   ├── inline/
│   └── previews/
└── private/         # Private files (require authentication)
    ├── attachments/
    ├── inline/
    └── previews/
```

Each file is stored with a UUID-based path to prevent conflicts and enhance security:
```
{type}/{conversation-slug}/{uuid}/{sanitized-filename}
```

## API Endpoints

### File Upload
- `POST /api/files/upload/[slug]`
- Requires Bearer token from `initiateUpload` TRPC call
- Accepts multipart form data with file

### File Download/Serving
- `GET /api/files/[slug]?token={jwt}`
- Private files require signed JWT token
- Supports range requests for large files
- Includes security headers

### Public File Serving
- `GET /api/files/public/[...path]`
- Direct access for public files
- Long-term caching headers
- Rate limited

### File Preview
- `GET /api/files/[slug]/preview?token={jwt}`
- Serves generated file previews (images)
- Cached for 24 hours
- Preview-specific JWT validation

## Security Features

### Access Control
- **Public Files**: Direct access via public endpoint
- **Private Files**: Require signed JWT tokens with expiration
- **Upload Tokens**: Temporary tokens for secure file uploads
- **Rate Limiting**: Prevents abuse of file serving endpoints

### File Validation
- **MIME Type Checking**: Only allowed file types accepted
- **Size Limits**: 25MB per file, 50MB total per conversation
- **Filename Sanitization**: Prevents path traversal attacks
- **Extension Blocking**: Dangerous extensions rejected

### Security Headers
- Content-Type validation and sanitization
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Content Security Policy for different file types
- Cache-Control headers optimized per file type

## Migration from Supabase Storage

The system maintains API compatibility with the existing Supabase-based file handling:

1. **File Upload Flow**: 
   - Frontend calls `initiateUpload` TRPC procedure
   - Gets upload URL and token instead of Supabase signed URL
   - Uploads file to our API endpoint instead of Supabase

2. **File Access**:
   - `getFileUrl()` now returns our API endpoints
   - Private files get signed JWT tokens
   - Public files get direct URLs to our public endpoint

3. **Database Schema**: No changes required to existing file records

## Environment Configuration

### Development
- Files stored in `./file-storage/` directory
- Automatic directory creation on startup
- Added to `.gitignore`

### Production
- Files stored in `/tmp/file-storage/` by default
- Can be configured to use persistent storage (mounted volumes, NFS, etc.)
- Consider using object storage adapters for cloud deployments

## Performance Considerations

### File Serving
- Range request support for large files (>1MB)
- Conditional requests (ETag, If-Modified-Since)
- Appropriate cache headers per file type
- Rate limiting to prevent abuse

### Storage
- UUID-based paths prevent directory listing attacks
- Automatic cleanup of empty directories
- Chunked deletion for large file sets

## Future Enhancements

1. **Cloud Storage Adapters**: Add support for S3, GCS, Azure Blob
2. **CDN Integration**: Optional CDN support for public files
3. **Virus Scanning**: Integration with antivirus scanning
4. **Image Processing**: Advanced image manipulation and optimization
5. **Backup/Sync**: Automatic backup to cloud storage

## Usage Examples

### Basic File Upload (Frontend)
```typescript
// Initiate upload
const { uploadToken, uploadUrl } = await trpc.mailbox.conversations.files.initiateUpload.mutate({
  conversationSlug: "conversation-123",
  file: { fileName: "document.pdf", fileSize: 1024000, isInline: false }
});

// Upload file
const formData = new FormData();
formData.append("file", fileObject);

await fetch(uploadUrl, {
  method: "POST",
  body: formData,
  headers: { "Authorization": `Bearer ${uploadToken}` }
});
```

### File Access (Backend)
```typescript
import { getFileUrl } from "@/lib/data/files";

// Get secure URL for private file
const url = await getFileUrl(fileRecord, { preview: false });
// Returns: /api/files/abc123?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

// Get public URL for public file  
const publicUrl = await getFileUrl(publicFileRecord);
// Returns: /api/files/public/inline/conversation-123/uuid/image.png
```

This system provides a secure, scalable, and maintainable file storage solution that can easily be adapted for different deployment environments.