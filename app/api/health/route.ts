import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { env } from "@/lib/env";

interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: HealthCheckResult;
    environment: HealthCheckResult;
    filesystem: HealthCheckResult;
    memory: HealthCheckResult;
  };
}

interface HealthCheckResult {
  status: "pass" | "fail" | "warn";
  message: string;
  responseTime?: number;
  details?: any;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Test database connection and basic query
    await db.execute("SELECT 1 as health_check");
    
    // Test table existence (core tables)
    const tables = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'conversations', 'conversation_messages')
    `);
    
    const responseTime = Date.now() - start;
    
    if (tables.rows.length < 3) {
      return {
        status: "warn",
        message: "Missing core database tables",
        responseTime,
        details: { tablesFound: tables.rows.length }
      };
    }
    
    return {
      status: "pass",
      message: "Database connection successful",
      responseTime,
      details: { tablesCount: tables.rows.length }
    };
  } catch (error) {
    return {
      status: "fail",
      message: "Database connection failed",
      responseTime: Date.now() - start,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

function checkEnvironment(): HealthCheckResult {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'OPENAI_API_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    return {
      status: "fail",
      message: "Missing required environment variables",
      details: { missing: missingVars }
    };
  }
  
  const warnings = [];
  
  // Check for development defaults
  if (process.env.JWT_SECRET?.includes('development')) {
    warnings.push('Using development JWT secret');
  }
  
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    warnings.push('Monitoring not configured');
  }
  
  return {
    status: warnings.length > 0 ? "warn" : "pass",
    message: warnings.length > 0 ? "Environment configured with warnings" : "Environment properly configured",
    details: warnings.length > 0 ? { warnings } : undefined
  };
}

async function checkFilesystem(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Check if file storage directories exist and are writable
    const storageDir = path.join(process.cwd(), 'file-storage');
    const privateDir = path.join(storageDir, 'private');
    const publicDir = path.join(storageDir, 'public');
    
    await fs.access(storageDir);
    await fs.access(privateDir);
    await fs.access(publicDir);
    
    // Test write capability
    const testFile = path.join(storageDir, 'health-check.tmp');
    await fs.writeFile(testFile, 'health check');
    await fs.unlink(testFile);
    
    return {
      status: "pass",
      message: "Filesystem access verified",
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      status: "fail",
      message: "Filesystem access failed",
      responseTime: Date.now() - start,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

function checkMemory(): HealthCheckResult {
  const used = process.memoryUsage();
  const totalMB = Math.round(used.rss / 1024 / 1024);
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  
  const status = totalMB > 1024 ? "warn" : "pass"; // Warn if using > 1GB
  
  return {
    status,
    message: `Memory usage: ${totalMB}MB RSS, ${heapUsedMB}MB heap`,
    details: {
      rss: totalMB,
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      external: Math.round(used.external / 1024 / 1024)
    }
  };
}

async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Run all health checks in parallel
    const [database, environment, filesystem, memory] = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkEnvironment()),
      checkFilesystem(),
      Promise.resolve(checkMemory())
    ]);
    
    const checks = { database, environment, filesystem, memory };
    
    // Determine overall status
    const hasFailures = Object.values(checks).some(check => check.status === "fail");
    const hasWarnings = Object.values(checks).some(check => check.status === "warn");
    
    let overallStatus: HealthCheck['status'];
    if (hasFailures) {
      overallStatus = "unhealthy";
    } else if (hasWarnings) {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }
    
    const healthCheck: HealthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "unknown",
      checks
    };
    
    // Return appropriate HTTP status
    const httpStatus = hasFailures ? 503 : 200;
    
    return Response.json(healthCheck, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error("Health check error:", error);
    return Response.json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "unknown",
      checks: {
        system: {
          status: "fail",
          message: "Health check system failure",
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    }, { status: 503 });
  }
}

export const { GET: handler } = createMethodHandler({ GET });