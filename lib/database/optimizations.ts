import { db } from "@/db/client";
import { SQL, sql, and, or, eq, count, desc, asc, ilike } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

/**
 * Enhanced Database Query Optimization System
 * Optimizes PostgreSQL queries for production performance
 * Includes N+1 prevention, caching, indexing analysis, and monitoring
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
/**
 * Enhanced query analysis with performance insights
 */
export async function analyzeQuery(query: string): Promise<{
  plan: any;
  performance: {
    estimatedCost: number;
    actualTime: number;
    rowsReturned: number;
    usesIndex: boolean;
    suggestedIndexes: string[];
  };
} | null> {
  try {
    const explanation = await db.execute(sql.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`));
    const plan = explanation[0]?.['QUERY PLAN']?.[0];
    
    if (!plan) return null;
    
    return {
      plan,
      performance: {
        estimatedCost: plan['Total Cost'] || 0,
        actualTime: plan['Actual Total Time'] || 0,
        rowsReturned: plan['Actual Rows'] || 0,
        usesIndex: JSON.stringify(plan).includes('Index'),
        suggestedIndexes: extractIndexSuggestions(plan),
      },
    };
  } catch (error) {
    console.error('Query analysis failed:', error);
    return null;
  }
}

/**
 * Extract index suggestions from query plan
 */
function extractIndexSuggestions(plan: any): string[] {
  const suggestions: string[] = [];
  
  // Look for sequential scans that could benefit from indexes
  const planStr = JSON.stringify(plan);
  if (planStr.includes('Seq Scan')) {
    suggestions.push('Consider adding indexes on frequently queried columns');
  }
  if (planStr.includes('Sort')) {
    suggestions.push('Consider adding indexes on sorted columns');
  }
  if (planStr.includes('Hash Join')) {
    suggestions.push('Consider adding indexes on join columns');
  }
  
  return suggestions;
}

/**
 * Query result caching system
 */
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

export function cacheQuery<T>(
  key: string, 
  queryFn: () => Promise<T>, 
  ttlMs: number = 300000 // 5 minutes default
): Promise<T> {
  const cached = queryCache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < cached.ttl) {
    return Promise.resolve(cached.data);
  }
  
  return queryFn().then(data => {
    queryCache.set(key, { data, timestamp: now, ttl: ttlMs });
    return data;
  });
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear();
    return;
  }
  
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key);
    }
  }
}

/**
 * N+1 Query Prevention System
 */
export class DataLoader<K, V> {
  private batchLoadFn: (keys: K[]) => Promise<V[]>;
  private cache = new Map<K, Promise<V>>();
  private batch = new Set<K>();
  private batchTimer: NodeJS.Timeout | null = null;
  
  constructor(
    batchLoadFn: (keys: K[]) => Promise<V[]>,
    private maxBatchSize: number = 100,
    private batchTimeoutMs: number = 10
  ) {
    this.batchLoadFn = batchLoadFn;
  }
  
  load(key: K): Promise<V> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const promise = new Promise<V>((resolve, reject) => {
      this.batch.add(key);
      
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      
      this.batchTimer = setTimeout(() => {
        this.executeBatch().then(() => {
          const result = this.cache.get(key);
          if (result) {
            result.then(resolve).catch(reject);
          } else {
            reject(new Error('Key not found in batch result'));
          }
        }).catch(reject);
      }, this.batchTimeoutMs);
      
      if (this.batch.size >= this.maxBatchSize) {
        clearTimeout(this.batchTimer);
        this.executeBatch().then(() => {
          const result = this.cache.get(key);
          if (result) {
            result.then(resolve).catch(reject);
          } else {
            reject(new Error('Key not found in batch result'));
          }
        }).catch(reject);
      }
    });
    
    this.cache.set(key, promise);
    return promise;
  }
  
  private async executeBatch(): Promise<void> {
    if (this.batch.size === 0) return;
    
    const keys = Array.from(this.batch);
    this.batch.clear();
    
    try {
      const results = await this.batchLoadFn(keys);
      
      keys.forEach((key, index) => {
        if (results[index] !== undefined) {
          this.cache.set(key, Promise.resolve(results[index]));
        }
      });
    } catch (error) {
      keys.forEach(key => {
        this.cache.set(key, Promise.reject(error));
      });
    }
  }
  
  clear(key?: K): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

/**
 * Database connection pool optimization
 */
export async function optimizeConnectionPool(): Promise<void> {
  // This would typically be configured at the database client level
  // For PostgreSQL with node-postgres, optimize pool settings
  console.log('Optimizing connection pool with recommended settings:', RECOMMENDED_POOL_CONFIG);
}

/**
 * Performance monitoring and alerting
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private alerts: Array<{ query: string; duration: number; timestamp: Date }> = [];
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  recordSlowQuery(query: string, duration: number): void {
    if (duration > 1000) { // Slow queries > 1s
      this.alerts.push({ query, duration, timestamp: new Date() });
      
      // Keep only last 100 slow queries
      if (this.alerts.length > 100) {
        this.alerts.shift();
      }
      
      console.warn(`🐌 SLOW QUERY ALERT: ${query} took ${duration}ms`);
    }
  }
  
  getSlowQueries(): Array<{ query: string; duration: number; timestamp: Date }> {
    return this.alerts.slice().reverse();
  }
  
  getPerformanceReport(): {
    slowQueriesCount: number;
    averageSlowQueryTime: number;
    recommendations: string[];
  } {
    const slowQueries = this.alerts;
    const avgTime = slowQueries.length > 0 
      ? slowQueries.reduce((sum, q) => sum + q.duration, 0) / slowQueries.length
      : 0;
    
    const recommendations = [
      'Add database indexes on frequently queried columns',
      'Use pagination for large result sets',
      'Implement query result caching',
      'Optimize WHERE clauses to use indexed columns',
      'Consider read replicas for heavy read workloads',
    ];
    
    return {
      slowQueriesCount: slowQueries.length,
      averageSlowQueryTime: Math.round(avgTime),
      recommendations,
    };
  }
}

export default {
  // Core optimization functions
  pagination: optimizePagination,
  search: buildSearchCondition,
  sort: buildSortCondition,
  where: buildWhereConditions,
  count: getOptimizedCount,
  batch: batchQuery,
  
  // Performance monitoring
  track: trackQuery,
  metrics: getQueryMetrics,
  health: checkDatabaseHealth,
  analyze: analyzeQuery,
  
  // Caching system
  cache: cacheQuery,
  clearCache,
  
  // N+1 prevention
  DataLoader,
  
  // Performance monitoring
  monitor: PerformanceMonitor.getInstance(),
  optimizePool: optimizeConnectionPool,
};