import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { filesTable } from "@/db/schema/files";
import { createSignedUrl } from "@/lib/files/security";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
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

    // Public files can be accessed directly
    if (fileRecord.isPublic) {
      const publicUrl = `/api/files/public/${encodeURIComponent(fileRecord.key)}`;
      return NextResponse.json({ url: publicUrl });
    }

    // For private files, create a signed URL
    const signedToken = await createSignedUrl({
      fileId: fileRecord.id,
      userId: user.id,
      slug: fileRecord.slug!,
      isPublic: fileRecord.isPublic,
    }, {
      expiresIn: 60 * 60, // 1 hour
      purpose: "preview",
    });

    const signedUrl = `/api/files/${slug}?token=${signedToken}`;

    return NextResponse.json({ url: signedUrl });

  } catch (error) {
    captureExceptionAndLog(error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Failed to generate file URL", 
        message: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: "Failed to generate file URL" 
    }, { status: 500 });
  }
}