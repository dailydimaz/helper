import { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle, NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import { Pool, PoolConfig } from "pg";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { PerformanceMonitor } from "@/lib/database/optimizations";

// Performance monitoring
const performanceMonitor = PerformanceMonitor.getInstance();

const fullSchema = { ...schema };

export const createDbClient = (url: string, options: PoolConfig = {}) => {
  // https://github.com/brianc/node-postgres/issues/2558
  const urlWithoutVerification = url.replace("?sslmode=require", "?sslmode=no-verify");
  
  // Optimized pool configuration for production performance
  const poolConfig: PoolConfig = {
    connectionString: urlWithoutVerification,
    // Connection pool optimization
    min: process.env.NODE_ENV === 'production' ? 5 : 2,
    max: process.env.NODE_ENV === 'production' ? 20 : 10,
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 5000, // 5 seconds
    acquireTimeoutMillis: 10000, // 10 seconds
    // Connection validation
    allowExitOnIdle: false,
    // Performance monitoring
    log: (msg) => {
      if (msg.includes('error') || msg.includes('timeout')) {
        console.error('Database pool error:', msg);
      }
    },
    ...options,
  };
  
  const pool = new Pool(poolConfig);
  
  // Pool event monitoring for performance insights
  pool.on('connect', (client) => {
    console.debug('New database connection established');
    client.query('SET application_name = \'helperai\'');
  });
  
  pool.on('acquire', () => {
    const activeConnections = pool.totalCount;
    const idleConnections = pool.idleCount;
    const waitingClients = pool.waitingCount;
    
    if (waitingClients > 5) {
      console.warn(`High connection contention: ${waitingClients} waiting clients`);
    }
    
    console.debug(`Pool status: Active: ${activeConnections}, Idle: ${idleConnections}, Waiting: ${waitingClients}`);
  });
  
  pool.on('error', (err) => {
    console.error('Database pool error:', err);
    performanceMonitor.recordSlowQuery('Database Pool Error', 0);
  });
  
  // Enhanced drizzle client with performance monitoring
  const drizzleClient = drizzle({
    client: pool,
    schema: fullSchema,
    casing: "snake_case",
    logger: {
      logQuery: (query, params) => {
        if (env.DRIZZLE_LOGGING) {
          console.log('📋 Query:', query);
          console.log('📋 Params:', params);
        }
      },
    },
  });
  
  // Add performance tracking methods to the client
  const enhancedClient = Object.assign(drizzleClient, {
    // Get pool statistics
    getPoolStats: () => ({
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    }),
    
    // Health check method
    healthCheck: async () => {
      const startTime = Date.now();
      try {
        await pool.query('SELECT 1 as health_check');
        const duration = Date.now() - startTime;
        return {
          healthy: true,
          responseTime: duration,
          connections: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        };
      } catch (error) {
        return {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime,
        };
      }
    },
    
    // Execute with performance tracking
    executeWithTracking: async <T>(queryName: string, queryFn: () => Promise<T>): Promise<T> => {
      const startTime = Date.now();
      try {
        const result = await queryFn();
        const duration = Date.now() - startTime;
        performanceMonitor.recordSlowQuery(queryName, duration);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        performanceMonitor.recordSlowQuery(`${queryName} (ERROR)`, duration);
        throw error;
      }
    },
    
    // Graceful shutdown
    shutdown: async () => {
      console.log('Shutting down database pool...');
      await pool.end();
      console.log('Database pool shutdown complete');
    },
  });
  
  return enhancedClient;
};

type DrizzleClientType = ReturnType<typeof createDbClient>;

declare global {
  // eslint-disable-next-line no-var
  var drizzleGlobal: DrizzleClientType | undefined;
}

const db = global.drizzleGlobal ?? createDbClient(env.DATABASE_URL);

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await db.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await db.shutdown();
    process.exit(0);
  });
}

export { db };

if (env.NODE_ENV !== "production") global.drizzleGlobal = db;

export type Transaction = PgTransaction<
  NodePgQueryResultHKT,
  typeof fullSchema,
  ExtractTablesWithRelations<typeof fullSchema>
>;

export type TransactionOrDb = Transaction | typeof db;
