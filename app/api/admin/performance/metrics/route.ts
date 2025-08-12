import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { PerformanceMonitor } from "@/lib/database/optimizations";

interface PerformanceMetrics {
  database: {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
    errorRate: number;
    connections: {
      total: number;
      idle: number;
      waiting: number;
    };
  };
  api: {
    totalRequests: number;
    averageResponseTime: number;
    slowRequests: number;
    errorRate: number;
    cacheHitRate: number;
  };
  frontend: {
    bundleSize: number;
    loadTime: number;
    renderTime: number;
    memoryUsage: number;
  };
}

// GET /api/admin/performance/metrics
async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const performanceMonitor = PerformanceMonitor.getInstance();
    
    // Get database performance metrics
    const dbMetrics = performanceMonitor.getPerformanceReport();
    const dbHealth = await db.healthCheck();
    const poolStats = db.getPoolStats();

    // Get API performance metrics
    const apiMetrics = performanceMonitor.getPerformanceReport();
    
    // Calculate cache hit rate (mock data for now - you'd track this in a real implementation)
    const cacheHitRate = Math.floor(Math.random() * 30) + 70; // 70-100%
    
    // Frontend metrics (these would typically come from client-side monitoring)
    const frontendMetrics = {
      bundleSize: 2.5 * 1024 * 1024, // 2.5MB
      loadTime: Math.floor(Math.random() * 1000) + 1500, // 1.5-2.5s
      renderTime: Math.floor(Math.random() * 200) + 100, // 100-300ms
      memoryUsage: Math.floor(Math.random() * 50) * 1024 * 1024 + 50 * 1024 * 1024, // 50-100MB
    };

    const metrics: PerformanceMetrics = {
      database: {
        totalQueries: dbMetrics.totalQueries,
        averageDuration: dbMetrics.averageDuration,
        slowQueries: dbMetrics.slowQueries,
        errorRate: dbMetrics.errorRate,
        connections: {
          total: poolStats.totalCount || 0,
          idle: poolStats.idleCount || 0,
          waiting: poolStats.waitingCount || 0,
        },
      },
      api: {
        totalRequests: apiMetrics.totalQueries, // Using same counter for simplicity
        averageResponseTime: apiMetrics.averageDuration,
        slowRequests: apiMetrics.slowQueries,
        errorRate: apiMetrics.errorRate,
        cacheHitRate,
      },
      frontend: frontendMetrics,
    };

    return apiSuccess(metrics, {
      cache: { maxAge: 30 }, // Cache for 30 seconds
    });
  } catch (error: any) {
    console.error("Performance metrics error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get performance metrics", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };