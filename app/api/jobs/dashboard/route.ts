import { NextRequest, NextResponse } from 'next/server';
import { getJobSystemStats, jobQueue } from '@/lib/jobs';
import { db } from '@/db/client';
import { jobsTable } from '@/db/schema/jobs';
import { sql, desc, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get basic job system stats
    const stats = await getJobSystemStats();

    // Get job performance over time
    const timeWindow = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const jobPerformance = await db
      .select({
        type: jobsTable.type,
        status: jobsTable.status,
        count: sql<number>`cast(count(*) as int)`,
        avgAttempts: sql<number>`cast(avg(attempts) as float)`,
        maxAttempts: sql<number>`cast(max(attempts) as int)`,
        lastRun: sql<Date>`max(updated_at)`,
      })
      .from(jobsTable)
      .where(sql`${jobsTable.createdAt} >= ${timeWindow}`)
      .groupBy(jobsTable.type, jobsTable.status)
      .orderBy(desc(sql<number>`cast(count(*) as int)`));

    // Get recent job activity
    const recentJobs = await db
      .select({
        id: jobsTable.id,
        type: jobsTable.type,
        status: jobsTable.status,
        attempts: jobsTable.attempts,
        lastError: jobsTable.lastError,
        createdAt: jobsTable.createdAt,
        updatedAt: jobsTable.updatedAt,
        scheduledFor: jobsTable.scheduledFor,
      })
      .from(jobsTable)
      .where(sql`${jobsTable.createdAt} >= ${timeWindow}`)
      .orderBy(desc(jobsTable.updatedAt))
      .limit(limit);

    // Get job type distribution
    const jobTypeDistribution = await db
      .select({
        type: jobsTable.type,
        total: sql<number>`cast(count(*) as int)`,
        pending: sql<number>`cast(sum(case when status = 'pending' then 1 else 0 end) as int)`,
        processing: sql<number>`cast(sum(case when status = 'processing' then 1 else 0 end) as int)`,
        completed: sql<number>`cast(sum(case when status = 'completed' then 1 else 0 end) as int)`,
        failed: sql<number>`cast(sum(case when status = 'dead_letter' then 1 else 0 end) as int)`,
      })
      .from(jobsTable)
      .where(sql`${jobsTable.createdAt} >= ${timeWindow}`)
      .groupBy(jobsTable.type)
      .orderBy(desc(sql<number>`cast(count(*) as int)`));

    // Get hourly job activity for the past 24 hours
    const hourlyActivity = await db
      .select({
        hour: sql<string>`to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00')`,
        completed: sql<number>`cast(sum(case when status = 'completed' then 1 else 0 end) as int)`,
        failed: sql<number>`cast(sum(case when status = 'dead_letter' then 1 else 0 end) as int)`,
        pending: sql<number>`cast(sum(case when status = 'pending' then 1 else 0 end) as int)`,
      })
      .from(jobsTable)
      .where(sql`${jobsTable.createdAt} >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}`)
      .groupBy(sql`date_trunc('hour', created_at)`)
      .orderBy(asc(sql`date_trunc('hour', created_at)`));

    // Calculate performance metrics
    const totalJobs = jobPerformance.reduce((sum, job) => sum + job.count, 0);
    const successRate = totalJobs > 0 
      ? jobPerformance
          .filter(job => job.status === 'completed')
          .reduce((sum, job) => sum + job.count, 0) / totalJobs
      : 0;

    const avgProcessingTime = stats.queue.metrics.avgProcessingTime;
    const systemHealth = {
      status: successRate > 0.95 ? 'healthy' : successRate > 0.85 ? 'warning' : 'critical',
      successRate: Math.round(successRate * 100 * 100) / 100, // Round to 2 decimal places
      avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      pendingJobs: stats.queue.pending,
      deadLetterJobs: stats.queue.dead_letter,
    };

    // Get top failing job types
    const topFailingJobs = jobPerformance
      .filter(job => job.status === 'dead_letter')
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(job => ({
        type: job.type,
        failures: job.count,
        avgAttempts: Math.round(job.avgAttempts * 100) / 100,
        maxAttempts: job.maxAttempts,
        lastFailure: job.lastRun,
      }));

    return NextResponse.json({
      success: true,
      data: {
        systemHealth,
        stats,
        performance: {
          totalJobs,
          successRate: systemHealth.successRate,
          avgProcessingTime: systemHealth.avgProcessingTime,
          jobPerformance: jobPerformance.slice(0, 20), // Top 20
          topFailingJobs,
        },
        activity: {
          recent: recentJobs.slice(0, 50), // Most recent 50
          hourly: hourlyActivity,
          distribution: jobTypeDistribution.slice(0, 15), // Top 15 job types
        },
        runtime: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Failed to get job dashboard data:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve job dashboard data',
      details: error instanceof Error ? error.message : String(error),
    }, {
      status: 500,
    });
  }
}