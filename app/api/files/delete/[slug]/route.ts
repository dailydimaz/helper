import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { filesTable } from "@/db/schema/files";
import { deleteFile } from "@/lib/files/storage";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { slug } = params;

    // Get file record
    const fileRecord = await db.query.filesTable.findFirst({
      where: eq(filesTable.slug, slug),
    });

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // TODO: Add permission checks based on conversation/note ownership
    // For now, we'll allow deletion by any authenticated user

    // Delete physical file
    try {
      await deleteFile(fileRecord.key, { isPublic: fileRecord.isPublic });
    } catch (error) {
      console.warn(`Failed to delete physical file ${fileRecord.key}:`, error);
      // Continue with database cleanup even if physical file deletion fails
    }

    // Delete database record
    await db.delete(filesTable).where(eq(filesTable.slug, slug));

    return NextResponse.json({ 
      success: true,
      message: "File deleted successfully" 
    });

  } catch (error) {
    captureExceptionAndLog(error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Failed to delete file", 
        message: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: "Failed to delete file" 
    }, { status: 500 });
  }
}