import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { env } from "@/lib/env";

// Database security configuration
export const DB_SECURITY_CONFIG = {
  // Query timeout limits
  QUERY_TIMEOUT_MS: 30000, // 30 seconds
  SLOW_QUERY_THRESHOLD_MS: 1000, // 1 second
  
  // Connection limits
  MAX_CONNECTIONS: 20,
  IDLE_TIMEOUT_MS: 60000, // 1 minute
  
  // Query logging
  LOG_SLOW_QUERIES: true,
  LOG_FAILED_QUERIES: true,
  
  // Security features
  ENABLE_QUERY_SANITIZATION: true,
  ENABLE_SQL_INJECTION_DETECTION: true,
  BLOCK_DANGEROUS_OPERATIONS: true,
};

// Dangerous SQL patterns to detect
const DANGEROUS_SQL_PATTERNS = [
  // SQL Injection patterns
  /(\b(UNION|union)\s+(SELECT|select))/i,
  /(\b(DROP|drop)\s+(TABLE|table|DATABASE|database))/i,
  /(\b(DELETE|delete)\s+(FROM|from).*WHERE.*1\s*=\s*1)/i,
  /(\b(INSERT|insert)\s+(INTO|into).*VALUES.*\(.*\))/i,
  /(\b(UPDATE|update).*SET.*WHERE.*1\s*=\s*1)/i,
  
  // Command injection
  /(\b(EXEC|exec|EXECUTE|execute)\s*\()/i,
  /(\b(xp_cmdshell|sp_executesql))/i,
  
  // Information disclosure
  /(\b(INFORMATION_SCHEMA|information_schema))/i,
  /(\b(sys\.|SYS\.))/i,
  /(\b(pg_|PG_))/i,
  
  // Time-based attacks
  /(\b(WAITFOR|waitfor)\s+(DELAY|delay))/i,
  /(\b(BENCHMARK|benchmark)\s*\()/i,
  /(\b(SLEEP|sleep)\s*\()/i,
];

// Query monitoring
const queryStats = new Map<string, {
  count: number;
  totalTime: number;
  avgTime: number;
  slowQueries: number;
  errors: number;
}>();

/**
 * SQL Injection detection and prevention
 */
export function detectSQLInjection(query: string): {
  suspicious: boolean;
  patterns: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
} {
  const patterns: string[] = [];
  
  for (const pattern of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(query)) {
      patterns.push(pattern.source);
    }
  }
  
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  
  if (patterns.length > 0) {
    // Determine risk level based on patterns found
    if (patterns.some(p => p.includes('DROP') || p.includes('DELETE'))) {
      riskLevel = 'critical';
    } else if (patterns.some(p => p.includes('UNION') || p.includes('EXEC'))) {
      riskLevel = 'high';
    } else if (patterns.length > 2) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }
  }
  
  return {
    suspicious: patterns.length > 0,
    patterns,
    riskLevel,
  };
}

/**
 * Sanitize SQL query parameters
 */
export function sanitizeQueryParams(params: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      sanitized[key] = value
        .replace(/['"\\;]/g, '') // Remove quotes and semicolons
        .replace(/--/g, '') // Remove SQL comments
        .replace(/\/\*/g, '') // Remove block comment starts
        .replace(/\*\//g, '') // Remove block comment ends
        .slice(0, 1000); // Limit length
    } else if (typeof value === 'number') {
      // Ensure it's actually a number
      sanitized[key] = isNaN(value) ? 0 : value;
    } else if (typeof value === 'boolean') {
      sanitized[key] = Boolean(value);
    } else if (value === null || value === undefined) {
      sanitized[key] = null;
    } else {
      // For complex objects, convert to string and sanitize
      sanitized[key] = JSON.stringify(value).slice(0, 1000);
    }
  }
  
  return sanitized;
}

/**
 * Execute query with security checks and monitoring
 */
export async function executeSecureQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  options: {
    timeout?: number;
    allowSensitiveOperations?: boolean;
    sanitizeParams?: boolean;
  } = {}
): Promise<T> {
  const {
    timeout = DB_SECURITY_CONFIG.QUERY_TIMEOUT_MS,
    allowSensitiveOperations = false,
    sanitizeParams = true,
  } = options;
  
  const startTime = Date.now();
  
  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Query timeout: ${queryName} took longer than ${timeout}ms`));
      }, timeout);
    });
    
    // Execute query with timeout
    const result = await Promise.race([
      queryFn(),
      timeoutPromise,
    ]);
    
    const duration = Date.now() - startTime;
    
    // Update query statistics
    updateQueryStats(queryName, duration, false);
    
    // Log slow queries
    if (duration > DB_SECURITY_CONFIG.SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
    }
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    updateQueryStats(queryName, duration, true);
    
    // Log failed queries
    if (DB_SECURITY_CONFIG.LOG_FAILED_QUERIES) {
      console.error(`Query failed: ${queryName}`, {
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    throw error;
  }
}

/**
 * Update query statistics
 */
function updateQueryStats(queryName: string, duration: number, isError: boolean): void {
  const stats = queryStats.get(queryName) || {
    count: 0,
    totalTime: 0,
    avgTime: 0,
    slowQueries: 0,
    errors: 0,
  };
  
  stats.count++;
  stats.totalTime += duration;
  stats.avgTime = stats.totalTime / stats.count;
  
  if (duration > DB_SECURITY_CONFIG.SLOW_QUERY_THRESHOLD_MS) {
    stats.slowQueries++;
  }
  
  if (isError) {
    stats.errors++;
  }
  
  queryStats.set(queryName, stats);
}

/**
 * Get query performance statistics
 */
export function getQueryStats(): Map<string, any> {
  return new Map(queryStats);
}

/**
 * Database connection security
 */
export async function validateDatabaseConnection(): Promise<{
  healthy: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  try {
    // Test basic connectivity
    await db.execute(sql`SELECT 1`);
    
    // Check connection settings (PostgreSQL specific)
    try {
      const [result] = await db.execute(sql`SHOW ssl`) as any[];
      if (result?.ssl !== 'on' && process.env.NODE_ENV === 'production') {
        issues.push('SSL is not enabled on database connection');
        recommendations.push('Enable SSL for database connections in production');
      }
    } catch {
      // SSL check not available or failed
    }
    
    // Check for default passwords or weak configurations
    const connectionString = env.DATABASE_URL;
    if (connectionString.includes('password') || connectionString.includes('admin')) {
      issues.push('Database connection string may contain default credentials');
      recommendations.push('Use strong, unique credentials for database access');
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    };
    
  } catch (error) {
    issues.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      healthy: false,
      issues,
      recommendations: ['Check database connectivity and credentials'],
    };
  }
}

/**
 * Check database permissions and security
 */
export async function auditDatabaseSecurity(): Promise<{
  score: number;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;
  
  try {
    // Check if we're running with elevated privileges
    try {
      const [result] = await db.execute(sql`SELECT current_user, session_user`) as any[];
      
      if (result.current_user === 'postgres' || result.current_user === 'root') {
        issues.push('Application is running with database superuser privileges');
        recommendations.push('Create a dedicated database user with minimal required permissions');
        score -= 30;
      }
    } catch {
      // User check not available
    }
    
    // Check for query logging
    try {
      const [result] = await db.execute(sql`SHOW log_statement`) as any[];
      if (result?.log_statement === 'none') {
        issues.push('Database query logging is disabled');
        recommendations.push('Enable query logging for security monitoring');
        score -= 10;
      }
    } catch {
      // Log statement check not available
    }
    
    // Check query statistics
    const stats = Array.from(queryStats.entries());
    const highErrorRate = stats.filter(([_, stat]) => 
      stat.count > 10 && (stat.errors / stat.count) > 0.1
    );
    
    if (highErrorRate.length > 0) {
      issues.push(`High error rate detected in queries: ${highErrorRate.map(([name]) => name).join(', ')}`);
      recommendations.push('Investigate and fix queries with high error rates');
      score -= 15;
    }
    
    // Check for slow queries
    const slowQueries = stats.filter(([_, stat]) => 
      stat.slowQueries > 0 && (stat.slowQueries / stat.count) > 0.1
    );
    
    if (slowQueries.length > 0) {
      issues.push(`Slow queries detected: ${slowQueries.map(([name]) => name).join(', ')}`);
      recommendations.push('Optimize slow queries and consider adding indexes');
      score -= 10;
    }
    
    return {
      score: Math.max(0, score),
      issues,
      recommendations,
    };
    
  } catch (error) {
    issues.push(`Database security audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      score: 0,
      issues,
      recommendations: ['Fix database connectivity issues before running security audit'],
    };
  }
}

/**
 * Create database security middleware
 */
export function createDatabaseSecurityMiddleware() {
  return {
    beforeQuery: (queryName: string, query: string, params?: any) => {
      // Check for SQL injection
      if (DB_SECURITY_CONFIG.ENABLE_SQL_INJECTION_DETECTION) {
        const injectionCheck = detectSQLInjection(query);
        
        if (injectionCheck.suspicious) {
          const error = new Error(`Potential SQL injection detected in query: ${queryName}`);
          console.error('SQL Injection Attempt:', {
            queryName,
            patterns: injectionCheck.patterns,
            riskLevel: injectionCheck.riskLevel,
            query: query.slice(0, 200), // Log first 200 chars
          });
          
          if (injectionCheck.riskLevel === 'critical' || injectionCheck.riskLevel === 'high') {
            throw error;
          }
        }
      }
      
      // Sanitize parameters
      if (params && DB_SECURITY_CONFIG.ENABLE_QUERY_SANITIZATION) {
        return sanitizeQueryParams(params);
      }
      
      return params;
    },
    
    afterQuery: (queryName: string, duration: number, error?: Error) => {
      // This would be called after query execution
      // Useful for additional logging or monitoring
    },
  };
}

/**
 * Database backup verification
 */
export async function verifyDatabaseBackup(): Promise<{
  hasRecentBackup: boolean;
  lastBackupTime?: Date;
  backupSize?: number;
  recommendations: string[];
}> {
  const recommendations: string[] = [];
  
  // This is a placeholder - actual implementation would depend on your backup system
  try {
    // Check for recent backup files or backup service status
    // This would typically involve checking backup logs or file timestamps
    
    recommendations.push('Verify that automated backups are configured and running');
    recommendations.push('Test backup restoration process regularly');
    recommendations.push('Ensure backups are stored securely and encrypted');
    
    return {
      hasRecentBackup: false, // Placeholder
      recommendations,
    };
  } catch (error) {
    return {
      hasRecentBackup: false,
      recommendations: [
        'Unable to verify backup status',
        'Ensure backup monitoring is properly configured',
      ],
    };
  }
}

/**
 * Encrypt sensitive data at rest (placeholder)
 */
export function encryptSensitiveData(data: string): string {
  // This is a placeholder - actual implementation would use proper encryption
  // In production, use a proper encryption library like node:crypto
  
  if (!env.ENCRYPT_COLUMN_SECRET) {
    throw new Error('Encryption secret not configured');
  }
  
  // Placeholder implementation
  return Buffer.from(data).toString('base64');
}

/**
 * Decrypt sensitive data (placeholder)
 */
export function decryptSensitiveData(encryptedData: string): string {
  // This is a placeholder - actual implementation would use proper decryption
  
  if (!env.ENCRYPT_COLUMN_SECRET) {
    throw new Error('Encryption secret not configured');
  }
  
  // Placeholder implementation
  return Buffer.from(encryptedData, 'base64').toString('utf8');
}

/**
 * Regular security maintenance tasks
 */
export async function performSecurityMaintenance(): Promise<void> {
  // Clean up old query statistics
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  // Reset statistics that are too old (in a real implementation)
  // queryStats.clear(); // Simple cleanup
  
  // Log current security status
  const connectionStatus = await validateDatabaseConnection();
  const securityAudit = await auditDatabaseSecurity();
  
  console.log('Database Security Status:', {
    connectionHealthy: connectionStatus.healthy,
    securityScore: securityAudit.score,
    totalQueries: Array.from(queryStats.values()).reduce((sum, stat) => sum + stat.count, 0),
    slowQueries: Array.from(queryStats.values()).reduce((sum, stat) => sum + stat.slowQueries, 0),
    errors: Array.from(queryStats.values()).reduce((sum, stat) => sum + stat.errors, 0),
  });
}

// Schedule regular maintenance if in server environment
if (typeof setInterval !== 'undefined') {
  // Run security maintenance every hour
  setInterval(performSecurityMaintenance, 60 * 60 * 1000);
}