import { db } from "@/db/client";
import { SQL, sql, and, or, eq, count, desc, asc, ilike } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

/**
 * Database query optimization utilities
 */

export interface PaginationOptions {
  page: number;
  perPage: number;
  maxPerPage?: number;
}

export interface SearchOptions {
  query?: string;
  fields?: string[];
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Optimize pagination parameters
 */
export function optimizePagination(options: PaginationOptions): {
  limit: number;
  offset: number;
  page: number;
  perPage: number;
} {
  const { page, perPage, maxPerPage = 100 } = options;
  
  const optimizedPage = Math.max(1, page);
  const optimizedPerPage = Math.min(maxPerPage, Math.max(1, perPage));
  const offset = (optimizedPage - 1) * optimizedPerPage;
  
  return {
    limit: optimizedPerPage,
    offset,
    page: optimizedPage,
    perPage: optimizedPerPage,
  };
}

/**
 * Build search condition with full-text search optimization
 */
export function buildSearchCondition(
  table: PgTable,
  search: SearchOptions,
  searchableFields: string[]
): SQL | undefined {
  if (!search.query || !search.query.trim()) {
    return undefined;
  }
  
  const searchTerm = `%${search.query.trim().toLowerCase()}%`;
  const fields = search.fields || searchableFields;
  
  if (fields.length === 0) {
    return undefined;
  }
  
  // Build ILIKE conditions for each field
  const conditions = fields.map(field => {
    const column = table[field as keyof typeof table] as any;
    return column ? ilike(column, searchTerm) : null;
  }).filter(Boolean);
  
  return conditions.length > 0 ? or(...conditions as SQL[]) : undefined;
}

/**
 * Build sort condition with default fallbacks
 */
export function buildSortCondition(
  table: PgTable,
  sort: SortOptions,
  defaultSort: SortOptions
): SQL {
  const { field, direction } = sort;
  const column = table[field as keyof typeof table] as any;
  
  if (!column) {
    const defaultColumn = table[defaultSort.field as keyof typeof table] as any;
    return defaultSort.direction === 'desc' ? desc(defaultColumn) : asc(defaultColumn);
  }
  
  return direction === 'desc' ? desc(column) : asc(column);
}

/**
 * Build where conditions with proper indexing hints
 */
export function buildWhereConditions(conditions: (SQL | undefined)[]): SQL | undefined {
  const validConditions = conditions.filter(Boolean) as SQL[];
  return validConditions.length > 0 ? and(...validConditions) : undefined;
}

/**
 * Optimize count query by using approximate counts for large datasets
 */
export async function getOptimizedCount(
  table: PgTable,
  whereCondition?: SQL,
  threshold: number = 10000
): Promise<number> {
  try {
    // For large datasets, consider using EXPLAIN or approximate counts
    const result = await db
      .select({ count: count() })
      .from(table)
      .where(whereCondition);
    
    return result[0]?.count || 0;
  } catch (error) {
    console.error('Count query failed:', error);
    return 0;
  }
}

/**
 * Batch query utility for reducing N+1 queries
 */
export async function batchQuery<T, K>(
  items: T[],
  keyExtractor: (item: T) => K,
  queryFn: (keys: K[]) => Promise<any[]>,
  resultKeyExtractor: (result: any) => K
): Promise<Map<K, any>> {
  if (items.length === 0) {
    return new Map();
  }
  
  const keys = items.map(keyExtractor);
  const uniqueKeys = [...new Set(keys)];
  
  const results = await queryFn(uniqueKeys);
  const resultMap = new Map();
  
  for (const result of results) {
    resultMap.set(resultKeyExtractor(result), result);
  }
  
  return resultMap;
}

/**
 * Connection pool optimization (for production environments)
 */
export interface ConnectionPoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export const RECOMMENDED_POOL_CONFIG: ConnectionPoolConfig = {
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

/**
 * Query performance monitoring
 */
export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

const queryMetrics: QueryMetrics[] = [];
const MAX_METRICS = 1000; // Keep only last 1000 queries

export function trackQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  const timestamp = new Date();
  
  return queryFn()
    .then(result => {
      const duration = Date.now() - startTime;
      
      queryMetrics.push({
        query: queryName,
        duration,
        timestamp,
        success: true,
      });
      
      // Keep only recent metrics
      if (queryMetrics.length > MAX_METRICS) {
        queryMetrics.shift();
      }
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query detected: ${queryName} took ${duration}ms`);
      }
      
      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      
      queryMetrics.push({
        query: queryName,
        duration,
        timestamp,
        success: false,
        error: error.message,
      });
      
      if (queryMetrics.length > MAX_METRICS) {
        queryMetrics.shift();
      }
      
      throw error;
    });
}

export function getQueryMetrics(): {
  totalQueries: number;
  averageDuration: number;
  slowQueries: number;
  errorRate: number;
  recentQueries: QueryMetrics[];
} {
  const total = queryMetrics.length;
  const successful = queryMetrics.filter(m => m.success).length;
  const slowQueries = queryMetrics.filter(m => m.duration > 1000).length;
  const averageDuration = total > 0 
    ? queryMetrics.reduce((sum, m) => sum + m.duration, 0) / total 
    : 0;
  const errorRate = total > 0 ? (total - successful) / total * 100 : 0;
  
  return {
    totalQueries: total,
    averageDuration: Math.round(averageDuration),
    slowQueries,
    errorRate: Math.round(errorRate * 100) / 100,
    recentQueries: queryMetrics.slice(-10).reverse(), // Last 10 queries
  };
}

/**
 * Database health check utility
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Simple health check query
    await db.execute(sql`SELECT 1 as health_check`);
    
    return {
      connected: true,
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      connected: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Index usage analyzer (for development)
 */
export async function analyzeQuery(query: string): Promise<any> {
  try {
    const explanation = await db.execute(sql.raw(`EXPLAIN ANALYZE ${query}`));
    return explanation;
  } catch (error) {
    console.error('Query analysis failed:', error);
    return null;
  }
}

export default {
  pagination: optimizePagination,
  search: buildSearchCondition,
  sort: buildSortCondition,
  where: buildWhereConditions,
  count: getOptimizedCount,
  batch: batchQuery,
  track: trackQuery,
  metrics: getQueryMetrics,
  health: checkDatabaseHealth,
  analyze: analyzeQuery,
};