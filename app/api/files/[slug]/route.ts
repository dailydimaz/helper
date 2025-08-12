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
    
    // Verify token matches file
    if (tokenData.fileId !== fileRecord.id) {
      return NextResponse.json({ error: "Token does not match file" }, { status: 403 });
    }
    
    // Check if file is public (double-check against token)
    if (fileRecord.isPublic !== tokenData.isPublic) {
      return NextResponse.json({ error: "File visibility mismatch" }, { status: 403 });
    }
    
    try {
      // Retrieve file from storage
      const fileBuffer = await retrieveFile(fileRecord.key, { isPublic: fileRecord.isPublic });
      
      // Sanitize content type
      const contentType = sanitizeContentType(fileRecord.mimetype);
      
      // Get security headers
      const securityHeaders = getFileSecurityHeaders(contentType);
      
      // Set appropriate headers
      const headers = {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Content-Disposition": `${tokenData.purpose === "download" ? "attachment" : "inline"}; filename="${encodeURIComponent(fileRecord.name)}"`,
        "Last-Modified": fileRecord.updatedAt.toUTCString(),
        "ETag": `"${fileRecord.id}-${fileRecord.updatedAt.getTime()}"`,
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
      
      // Handle range requests for large files
      const range = request.headers.get("range");
      if (range && fileBuffer.length > 1024 * 1024) { // Only for files > 1MB
        const match = range.match(/bytes=(\d+)-(\d*)/);
        if (match) {
          const start = parseInt(match[1]);
          const end = match[2] ? parseInt(match[2]) : fileBuffer.length - 1;
          const chunkSize = end - start + 1;
          
          if (start >= 0 && start < fileBuffer.length && end < fileBuffer.length) {
            const chunk = fileBuffer.subarray(start, end + 1);
            
            return new NextResponse(chunk, {
              status: 206,
              headers: {
                ...headers,
                "Content-Range": `bytes ${start}-${end}/${fileBuffer.length}`,
                "Content-Length": chunkSize.toString(),
                "Accept-Ranges": "bytes",
              },
            });
          }
        }
      }
      
      return new NextResponse(fileBuffer, { headers });
      
    } catch (storageError) {
      if (storageError instanceof Error && storageError.message.includes("not found")) {
        return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
      }
      throw storageError;
    }
    
  } catch (error) {
    captureExceptionAndLog(error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Failed to serve file", 
        message: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: "Failed to serve file" 
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