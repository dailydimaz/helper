import { NextRequest } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { PerformanceMonitor } from "@/lib/database/optimizations";

interface SlowQuery {
  query: string;
  duration: number;
  timestamp: Date;
  type: 'database' | 'api';
}

// GET /api/admin/performance/slow-queries
async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const performanceMonitor = PerformanceMonitor.getInstance();
    const slowQueries = performanceMonitor.getSlowQueries();

    // Transform the slow queries into the expected format
    const formattedSlowQueries: SlowQuery[] = slowQueries.map(query => ({
      query: query.query,
      duration: query.duration,
      timestamp: query.timestamp,
      type: query.query.startsWith('API ') ? 'api' : 'database',
    }));

    return apiSuccess(formattedSlowQueries, {
      cache: { maxAge: 60 }, // Cache for 1 minute
    });
  } catch (error: any) {
    console.error("Slow queries error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get slow queries", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };