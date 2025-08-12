import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { filesTable } from "@/db/schema/files";
import { storeFile, initializeStorage } from "@/lib/files/storage";
import { validateFile } from "@/lib/files/validation";
import { verifyTempDownloadToken, checkDownloadRateLimit } from "@/lib/files/security";
import { captureExceptionAndLog } from "@/lib/shared/sentry";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const uploadToken = request.headers.get("authorization")?.replace("Bearer ", "");
    
    if (!uploadToken) {
      return NextResponse.json({ error: "Upload token required" }, { status: 401 });
    }
    
    // Verify upload token
    const tokenData = await verifyTempDownloadToken(uploadToken);
    if (!tokenData.valid || tokenData.slug !== slug) {
      return NextResponse.json({ error: "Invalid upload token" }, { status: 401 });
    }
    
    // Rate limiting
    const clientId = tokenData.userId ? `user-${tokenData.userId}` : request.ip || "unknown";
    if (!checkDownloadRateLimit(clientId)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    
    // Get file record
    const fileRecord = await db.query.filesTable.findFirst({
      where: eq(filesTable.slug, slug),
    });
    
    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    
    // Check if file is already uploaded
    if (fileRecord.messageId || fileRecord.noteId) {
      return NextResponse.json({ error: "File already attached" }, { status: 400 });
    }
    
    // Get file data from form
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    
    // Validate file
    const validation = validateFile({
      name: file.name,
      size: file.size,
      mimetype: file.type,
    });
    
    if (!validation.isValid) {
      return NextResponse.json({ 
        error: "File validation failed", 
        details: validation.errors 
      }, { status: 400 });
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File size exceeds ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB limit` 
      }, { status: 400 });
    }
    
    // Check file matches record
    if (file.name !== fileRecord.name || file.size !== fileRecord.size) {
      return NextResponse.json({ 
        error: "File does not match upload record" 
      }, { status: 400 });
    }
    
    // Initialize storage
    await initializeStorage();
    
    // Convert file to buffer and store
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await storeFile(fileRecord.key, buffer, {
      mimetype: fileRecord.mimetype,
      isPublic: fileRecord.isPublic,
    });
    
    // Update file record
    await db
      .update(filesTable)
      .set({ updatedAt: new Date() })
      .where(eq(filesTable.slug, slug));
    
    return NextResponse.json({
      success: true,
      file: {
        slug: fileRecord.slug,
        name: fileRecord.name,
        size: fileRecord.size,
        mimetype: fileRecord.mimetype,
      },
    });
    
  } catch (error) {
    captureExceptionAndLog(error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Upload failed", 
        message: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: "Upload failed" 
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}