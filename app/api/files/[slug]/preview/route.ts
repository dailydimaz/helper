import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { filesTable } from "@/db/schema/files";
import { retrieveFile } from "@/lib/files/storage";
import { verifySignedUrl, checkDownloadRateLimit, getFileSecurityHeaders, sanitizeContentType } from "@/lib/files/security";
import { captureExceptionAndLog } from "@/lib/shared/sentry";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const token = request.nextUrl.searchParams.get("token");
    
    if (!token) {
      return NextResponse.json({ error: "Access token required" }, { status: 401 });
    }
    
    // Verify signed URL token
    const tokenData = await verifySignedUrl(token);
    if (!tokenData || tokenData.slug !== slug) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }
    
    // Ensure this is a preview request
    if (tokenData.purpose !== "preview") {
      return NextResponse.json({ error: "Token not valid for preview access" }, { status: 403 });
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
    
    // Check if preview exists
    if (!fileRecord.previewKey) {
      return NextResponse.json({ error: "Preview not available" }, { status: 404 });
    }
    
    // Verify token matches file
    if (tokenData.fileId !== fileRecord.id) {
      return NextResponse.json({ error: "Token does not match file" }, { status: 403 });
    }
    
    try {
      // Retrieve preview from storage
      const previewBuffer = await retrieveFile(fileRecord.previewKey, { isPublic: fileRecord.isPublic });
      
      // Preview is always PNG format
      const contentType = "image/png";
      
      // Get security headers optimized for images
      const securityHeaders = getFileSecurityHeaders(contentType);
      
      // Set headers for preview
      const headers = {
        "Content-Type": contentType,
        "Content-Length": previewBuffer.length.toString(),
        "Content-Disposition": `inline; filename="preview_${encodeURIComponent(fileRecord.name)}.png"`,
        "Cache-Control": "private, max-age=86400", // 24 hour cache for previews
        "Last-Modified": fileRecord.updatedAt.toUTCString(),
        "ETag": `"preview-${fileRecord.id}-${fileRecord.updatedAt.getTime()}"`,
        ...securityHeaders,
      };
      
      // Handle conditional requests
      const ifNoneMatch = request.headers.get("if-none-match");
      if (ifNoneMatch === headers.ETag) {
        return new NextResponse(null, { status: 304, headers });
      }
      
      const ifModifiedSince = request.headers.get("if-modified-since");
      if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(fileRecord.updatedAt)) {
        return new NextResponse(null, { status: 304, headers });
      }
      
      return new NextResponse(previewBuffer, { headers });
      
    } catch (storageError) {
      if (storageError instanceof Error && storageError.message.includes("not found")) {
        return NextResponse.json({ error: "Preview not found in storage" }, { status: 404 });
      }
      throw storageError;
    }
    
  } catch (error) {
    captureExceptionAndLog(error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Failed to serve preview", 
        message: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: "Failed to serve preview" 
    }, { status: 500 });
  }
}

export async function HEAD(request: NextRequest, context: { params: { slug: string } }) {
  // HEAD requests should return the same headers as GET but without the body
  const response = await GET(request, context);
  
  if (response.status === 200) {
    return new NextResponse(null, {
      status: 200,
      headers: response.headers,
    });
  }
  
  return response;
}