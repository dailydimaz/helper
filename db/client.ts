import { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle, NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { PgTransaction } from "drizzle-orm/pg-core";
import { Pool, PoolConfig } from "pg";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
// Performance monitoring temporarily disabled

const fullSchema = { ...schema };

export const createDbClient = (url: string, options: PoolConfig = {}) => {
  // https://github.com/brianc/node-postgres/issues/2558
  const urlWithoutVerification = url.replace("?sslmode=require", "?sslmode=no-verify");
  
  // Simplified pool configuration for development
  const poolConfig: PoolConfig = {
    connectionString: urlWithoutVerification,
    // Minimal pool for development stability
    min: 0,
    max: 3,
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 10000, // 10 seconds
    acquireTimeoutMillis: 5000, // 5 seconds
    allowExitOnIdle: true,
    ...options,
  };
  
  const pool = new Pool(poolConfig);
  
  // Essential pool event monitoring
  pool.on('connect', (client) => {
    client.query('SET application_name = \'helperai\'');
  });
  
  pool.on('error', (err) => {
    console.error('Database pool error:', err);
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
        console.warn('Slow query detected:', { query: queryName, duration });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.warn('Slow query detected:', { query: `${queryName} (ERROR)`, duration });
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

// Graceful shutdown handling (only in Node.js runtime, not Edge Runtime)
if (typeof process !== 'undefined' && typeof process.on === 'function') {
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
