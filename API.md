# API Documentation

This document provides comprehensive documentation for the Helper AI REST API. The API follows RESTful principles and uses JSON for data exchange.

## Base URL

**Development:** `http://localhost:3000/api`
**Production:** `https://yourdomain.com/api`

## Authentication

The API uses JWT (JSON Web Token) authentication with HTTP-only cookies for secure session management.

### Authentication Flow

1. **Login:** POST `/auth/login` with email/password
2. **Session:** JWT token stored in HTTP-only cookie
3. **Verification:** Token automatically included in subsequent requests
4. **Logout:** POST `/auth/logout` to clear session

### Headers

All authenticated requests automatically include the session cookie. No manual token management required.

```http
Cookie: auth-token=<jwt-token>
Content-Type: application/json
```

### Permission Levels

- **`user`** - Basic authenticated user
- **`staff`** - Staff member with conversation access  
- **`admin`** - Full administrative access

## Standard Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

## Authentication Endpoints

### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "permissions": "admin",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z"
  },
  "message": "Login successful"
}
```

### Get Current User
```http
GET /api/auth/me
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "permissions": "admin",
    "isActive": true
  }
}
```

### Register New User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword",
  "displayName": "New User"
}
```

### Logout
```http
POST /api/auth/logout
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Admin Endpoints

All admin endpoints require `admin` permissions.

### Conversations

#### List Conversations
```http
GET /api/adm/conversations
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `perPage` - Items per page (default: 20)
- `q` - Search query (searches subject)
- `status` - Filter by status: `open`, `closed`, `pending`
- `countOnly` - Return only total count (boolean)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv-uuid",
      "slug": "conv-slug-123",
      "subject": "Help with integration",
      "toEmailAddress": "support@company.com",
      "fromName": "Customer Name",
      "status": "open",
      "messageCount": 5,
      "assignedToId": "user-uuid",
      "assignedTo": {
        "id": "user-uuid",
        "email": "agent@company.com",
        "displayName": "Agent Name"
      },
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T12:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Get Conversation Details
```http
GET /api/adm/conversations/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "conv-uuid",
    "slug": "conv-slug-123",
    "subject": "Help with integration",
    "status": "open",
    "messages": [
      {
        "id": "msg-uuid",
        "role": "user",
        "content": "I need help with the API integration",
        "fromName": "Customer Name",
        "createdAt": "2025-01-15T10:00:00Z"
      },
      {
        "id": "msg-uuid-2",
        "role": "staff",
        "content": "I'd be happy to help with that!",
        "fromName": "Agent Name",
        "createdAt": "2025-01-15T10:15:00Z"
      }
    ],
    "assignedTo": {
      "id": "user-uuid",
      "displayName": "Agent Name"
    }
  }
}
```

### Users

#### List Users
```http
GET /api/adm/users
```

**Query Parameters:**
- `page`, `perPage` - Pagination
- `q` - Search by email or name
- `active` - Filter by active status

#### Update User
```http
PUT /api/adm/users/{id}
```

**Request Body:**
```json
{
  "displayName": "Updated Name",
  "permissions": "staff",
  "isActive": true
}
```

### Saved Replies

#### List Saved Replies
```http
GET /api/adm/saved-replies
```

#### Create Saved Reply
```http
POST /api/adm/saved-replies
```

**Request Body:**
```json
{
  "name": "Welcome Message",
  "content": "Welcome to our support! How can I help you today?",
  "isShared": true
}
```

#### Update Saved Reply
```http
PUT /api/adm/saved-replies/{id}
```

#### Delete Saved Reply
```http
DELETE /api/adm/saved-replies/{id}
```

## Chat Widget Endpoints

### Start New Conversation
```http
POST /api/chat/conversation
```

**Request Body:**
```json
{
  "message": "Hello, I need help with...",
  "customerInfo": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "metadata": {
      "page": "/pricing",
      "userAgent": "Mozilla/5.0..."
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationSlug": "conv-slug-123",
    "sessionToken": "session-token"
  }
}
```

### Send Message
```http
POST /api/chat/conversation/{slug}
```

**Request Body:**
```json
{
  "message": "Thanks for the help!",
  "sessionToken": "session-token"
}
```

### List Customer Conversations
```http
GET /api/chat/conversations
```

**Headers:**
```http
X-Session-Token: session-token
```

### Get Conversation Messages
```http
GET /api/chat/conversation/{slug}
```

## File Management

### Upload File
```http
POST /api/files/upload/{slug}
```

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` - File to upload
- `sessionToken` - Widget session token (for widget uploads)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file-uuid",
    "filename": "document.pdf",
    "size": 1024000,
    "mimeType": "application/pdf",
    "url": "/api/files/file-uuid"
  }
}
```

### Get File
```http
GET /api/files/{slug}
```

**Response:** File binary data with appropriate headers

### File Preview
```http
GET /api/files/{slug}/preview
```

**Response:** Thumbnail/preview image for supported file types

## Messages

### Send Message (Admin)
```http
POST /api/messages
```

**Request Body:**
```json
{
  "conversationId": "conv-uuid",
  "content": "Thank you for contacting support...",
  "role": "staff",
  "attachments": ["file-uuid-1", "file-uuid-2"]
}
```

### Update Message
```http
PUT /api/messages/{id}
```

### Get Message Details
```http
GET /api/messages/{id}
```

## Webhook Endpoints

### GitHub Webhook
```http
POST /api/webhooks/github
```

**Headers:**
```http
X-GitHub-Event: issues
X-GitHub-Delivery: uuid
X-Hub-Signature-256: signature
```

### Slack Event
```http
POST /api/webhooks/slack/event
```

### Gmail Webhook
```http
POST /api/webhooks/gmail
```

## Health & Monitoring

### Health Check (Detailed)
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T12:00:00Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "pass",
      "message": "Database connection successful",
      "responseTime": 45
    },
    "filesystem": {
      "status": "pass",
      "message": "Filesystem access verified"
    },
    "memory": {
      "status": "pass",
      "message": "Memory usage: 512MB RSS, 256MB heap"
    }
  }
}
```

### Basic Health Check
```http
GET /api/health/basic
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00Z",
  "uptime": 3600.5,
  "version": "1.0.0"
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Request validation failed |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found |
| `VALIDATION_ERROR` | 422 | Data validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authentication:** 5 requests/minute per IP
- **Widget API:** 100 requests/minute per session
- **Admin API:** 1000 requests/minute per user
- **File uploads:** 10 files/minute per user

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642678800
```

## Pagination

List endpoints support pagination with these parameters:

- `page` - Page number (1-based, default: 1)  
- `perPage` - Items per page (default: 20, max: 100)

Pagination info is included in successful responses:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Search & Filtering

Many endpoints support search and filtering:

### Search Parameters
- `q` - General search query
- `status` - Filter by status
- `dateFrom`, `dateTo` - Date range filtering
- `assignedTo` - Filter by assigned user

### Example
```http
GET /api/adm/conversations?q=integration&status=open&dateFrom=2025-01-01
```

## Data Types

### Common Types

**UUID:** Standard UUID v4 format
```
123e4567-e89b-12d3-a456-426614174000
```

**DateTime:** ISO 8601 format in UTC
```
2025-01-15T12:30:00.000Z
```

**Status Values:**
- Conversations: `open`, `closed`, `pending`, `spam`
- Messages: `sent`, `delivered`, `failed`
- Files: `uploaded`, `processing`, `ready`, `failed`

## SDK Integration

For easier integration, consider using the official SDKs:

### JavaScript/TypeScript
```bash
npm install @helperai/sdk
```

```typescript
import { HelperAI } from '@helperai/sdk';

const helper = new HelperAI({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-domain.com/api'
});

const conversations = await helper.conversations.list();
```

### Widget Integration
```html
<script src="https://your-domain.com/widget/embed.js"></script>
<script>
  HelperAI.init({
    widgetId: 'your-widget-id',
    position: 'bottom-right'
  });
</script>
```

## Testing

### Development
```bash
# Test API endpoints
pnpm tsx scripts/test-api-endpoints.ts

# Run API tests
pnpm test tests/api/
```

### Example cURL Commands

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

**Get Conversations:**
```bash
curl -X GET http://localhost:3000/api/adm/conversations \
  -b "auth-token=your-jwt-token"
```

---

For additional help or questions about the API, please refer to:
- [Development Guide](./README.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Migration Guide](./MIGRATION.md)