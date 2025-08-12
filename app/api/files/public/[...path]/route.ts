import { NextRequest, NextResponse } from "next/server";
import { retrieveFile } from "@/lib/files/storage";
import { checkDownloadRateLimit, getFileSecurityHeaders, sanitizeContentType } from "@/lib/files/security";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import mime from "mime";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join("/");
    
    if (!filePath) {
      return NextResponse.json({ error: "File path required" }, { status: 400 });
    }
    
    // Rate limiting for public files
    const clientId = request.ip || "unknown";
    if (!checkDownloadRateLimit(clientId)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    
    // Basic path traversal protection
    if (filePath.includes("..") || filePath.includes("\\")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }
    
    try {
      // Retrieve file from public storage
      const fileBuffer = await retrieveFile(decodeURIComponent(filePath), { isPublic: true });
      
      // Determine content type from file extension
      const fileName = filePath.split("/").pop() || "file";
      const contentType = sanitizeContentType(mime.getType(fileName) || "application/octet-stream");
      
      // Get security headers
      const securityHeaders = getFileSecurityHeaders(contentType);
      
      // Set headers for public files
      const headers = {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable", // 1 year cache for public files
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        ...securityHeaders,
      };
      
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
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      throw storageError;
    }
    
  } catch (error) {
    captureExceptionAndLog(error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Failed to serve public file", 
        message: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: "Failed to serve public file" 
    }, { status: 500 });
  }
}

export async function HEAD(request: NextRequest, context: { params: { path: string[] } }) {
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