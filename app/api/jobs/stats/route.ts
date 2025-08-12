import { NextRequest, NextResponse } from 'next/server';
import { getJobSystemStats, jobQueue } from '@/lib/jobs';

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive job system statistics
    const stats = await getJobSystemStats();
    
    // Add additional runtime information
    const runtimeInfo = {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };

    // Get recent dead letter jobs for debugging
    const deadLetterJobs = await jobQueue.getDeadLetterJobs(10);

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        runtime: runtimeInfo,
        deadLetterJobs: deadLetterJobs.map(job => ({
          id: job.id,
          type: job.type,
          lastError: job.lastError,
          attempts: job.attempts,
          updatedAt: job.updatedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to get job system stats:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve job system statistics',
      details: error instanceof Error ? error.message : String(error),
    }, {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jobId } = body;

    switch (action) {
      case 'cleanup':
        const { olderThanHours = 24 * 7 } = body; // Default 7 days
        const deletedCount = await jobQueue.cleanupOldJobs(olderThanHours);
        
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${deletedCount} old jobs`,
          data: { deletedCount },
        });

      case 'retry':
        if (!jobId) {
          return NextResponse.json({
            success: false,
            error: 'Job ID is required for retry action',
          }, { status: 400 });
        }

        await jobQueue.retryDeadLetterJob(jobId);
        
        return NextResponse.json({
          success: true,
          message: `Job ${jobId} scheduled for retry`,
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Job action failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Job action failed',
      details: error instanceof Error ? error.message : String(error),
    }, {
      status: 500,
    });
  }
}