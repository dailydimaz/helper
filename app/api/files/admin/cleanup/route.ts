import { NextRequest, NextResponse } from "next/server";
import { cleanupOrphanedFiles, getStorageStats } from "@/lib/files/cleanup";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // TODO: Add admin role check
    // For now, we'll allow any authenticated user to run cleanup

    const body = await request.json();
    const { olderThanHours = 24 } = body;

    console.log(`Starting manual file cleanup for files older than ${olderThanHours} hours`);

    const result = await cleanupOrphanedFiles(olderThanHours);

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      errors: result.errors,
      message: `Cleanup completed: ${result.deletedCount} files deleted`,
    });

  } catch (error) {
    captureExceptionAndLog(error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Cleanup failed", 
        message: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: "Cleanup failed" 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // TODO: Add admin role check
    // For now, we'll allow any authenticated user to view stats

    const stats = await getStorageStats();

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        totalSizeMB: Math.round(stats.totalSize / 1024 / 1024 * 100) / 100,
        orphanedSizeMB: Math.round(stats.orphanedSize / 1024 / 1024 * 100) / 100,
      },
    });

  } catch (error) {
    captureExceptionAndLog(error);
    
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: "Failed to get storage stats", 
        message: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: "Failed to get storage stats" 
    }, { status: 500 });
  }
}