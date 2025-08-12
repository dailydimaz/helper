import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { filesTable } from "@/db/schema/files";
import { conversationsTable } from "@/db/schema/conversations";
import { eq } from "drizzle-orm";
import { validateFile } from "@/lib/files/validation";
import { generateSecureFileKey, createTempDownloadToken } from "@/lib/files/security";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, RATE_LIMIT_CONFIGS, getClientId } from "@/lib/security/rateLimiting";
import { validateCSRFWithOrigin } from "@/lib/security/csrf";
import { applyCORSHeaders, CORS_CONFIGS } from "@/lib/security/cors";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for file uploads
    const rateLimitResult = rateLimit(request, 'FILE_UPLOAD');
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ 
        error: "Rate limit exceeded for file uploads",
        retryAfter: rateLimitResult.retryAfter 
      }, { status: 429 });
    }

    // CSRF protection
    const csrfValidation = await validateCSRFWithOrigin(request);
    if (!csrfValidation.valid) {
      return NextResponse.json({ 
        error: csrfValidation.error || "CSRF validation failed" 
      }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { conversationSlug, file } = body;

    if (!conversationSlug || !file) {
      return NextResponse.json({ 
        error: "Missing required fields: conversationSlug and file" 
      }, { status: 400 });
    }

    const { fileName, fileSize, isInline = false } = file;

    if (!fileName || !fileSize) {
      return NextResponse.json({ 
        error: "Missing required file fields: fileName and fileSize" 
      }, { status: 400 });
    }

    // Validate the conversation exists and user has access
    const conversation = await db.query.conversationsTable.findFirst({
      where: eq(conversationsTable.slug, conversationSlug),
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Validate file
    const validation = validateFile({
      name: fileName,
      size: fileSize,
    });

    if (!validation.isValid) {
      return NextResponse.json({ 
        error: "File validation failed", 
        details: validation.errors 
      }, { status: 400 });
    }

    // Determine if file should be public based on inline status
    const isPublic = isInline;

    // Generate secure file key
    const fileKey = generateSecureFileKey(
      ["conversations", conversationSlug], 
      fileName,
      { encrypt: !isPublic }
    );

    // Get mimetype from filename
    const mime = await import("mime");
    const mimetype = mime.getType(fileName) || "application/octet-stream";

    // Create file record in database
    const [fileRecord] = await db.insert(filesTable).values({
      name: fileName,
      key: fileKey,
      mimetype,
      size: fileSize,
      isInline,
      isPublic,
      // messageId and noteId will be set when the file is actually used
    }).returning();

    // Generate upload token
    const uploadToken = await createTempDownloadToken(fileRecord.slug!, user.id, 15);
    const uploadUrl = `/api/files/upload/${fileRecord.slug}`;

    const response = NextResponse.json({
      file: {
        id: fileRecord.id,
        slug: fileRecord.slug,
        name: fileRecord.name,
        key: fileRecord.key,
        mimetype: fileRecord.mimetype,
        size: fileRecord.size,
        isInline: fileRecord.isInline,
        isPublic: fileRecord.isPublic,
      },
      uploadToken,
      uploadUrl,
      isPublic,
    });

    // Apply CORS headers
    return applyCORSHeaders(request, response, CORS_CONFIGS.FILES);

  } catch (error) {
    captureExceptionAndLog(error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Failed to initiate upload", 
        message: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: "Failed to initiate upload" 
    }, { status: 500 });
  }
}