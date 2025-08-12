import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { apiSuccess, apiError, createMethodHandler } from "@/lib/api";
import { PerformanceMonitor } from "@/lib/database/optimizations";

// GET /api/health - Health check endpoint
async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check database health
    const dbHealth = await db.healthCheck();
    const poolStats = db.getPoolStats();
    
    // Get performance metrics
    const performanceMonitor = PerformanceMonitor.getInstance();
    const metrics = performanceMonitor.getPerformanceReport();
    
    const responseTime = Date.now() - startTime;
    
    const healthData = {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime,
      database: {
        healthy: dbHealth.healthy,
        responseTime: dbHealth.responseTime,
        connections: {
          total: poolStats.totalCount,
          idle: poolStats.idleCount,
          waiting: poolStats.waitingCount,
        },
      },
      performance: {
        totalQueries: metrics.totalQueries,
        averageDuration: metrics.averageDuration,
        slowQueries: metrics.slowQueries,
        errorRate: metrics.errorRate,
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    };

    if (!dbHealth.healthy) {
      return apiError('System is unhealthy', 503, undefined, healthData);
    }

    return apiSuccess(healthData, {
      cache: { maxAge: 10, private: true }, // Cache for 10 seconds
    });
  } catch (error: any) {
    console.error("Health check error:", error);
    
    return apiError('Health check failed', 500, undefined, {
      error: error.message,
      responseTime: Date.now() - startTime,
    });
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };