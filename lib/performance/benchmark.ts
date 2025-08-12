import { db } from '@/db/client';
import { PerformanceMonitor } from '@/lib/database/optimizations';
import { conversationsTable, conversationMessagesTable, usersTable } from '@/db/schema';
import { count, desc, eq, ilike, and, or } from 'drizzle-orm';

/**
 * Performance Benchmark System
 * Tests various operations and measures performance
 */

interface BenchmarkResult {
  name: string;
  duration: number;
  memory?: number;
  success: boolean;
  error?: string;
  details?: Record<string, any>;
}

interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  totalDuration: number;
  successRate: number;
  summary: string;
}

export class PerformanceBenchmark {
  private performanceMonitor = PerformanceMonitor.getInstance();
  private results: BenchmarkResult[] = [];

  /**
   * Run a single benchmark test
   */
  async runBenchmark<T>(
    name: string,
    testFn: () => Promise<T>,
    iterations: number = 1
  ): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = Date.now();
    let success = true;
    let error: string | undefined;
    let result: T | undefined;

    try {
      for (let i = 0; i < iterations; i++) {
        result = await testFn();
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    const duration = endTime - startTime;
    const memoryDelta = endMemory - startMemory;

    const benchmarkResult: BenchmarkResult = {
      name,
      duration: Math.round(duration / iterations), // Average per iteration
      memory: memoryDelta,
      success,
      error,
      details: {
        iterations,
        totalDuration: duration,
        result: success ? 'Success' : 'Failed',
      },
    };

    this.results.push(benchmarkResult);
    this.performanceMonitor.recordSlowQuery(`Benchmark: ${name}`, benchmarkResult.duration);

    return benchmarkResult;
  }

  /**
   * Database query benchmarks
   */
  async runDatabaseBenchmarks(): Promise<BenchmarkSuite> {
    console.log('🔍 Running database performance benchmarks...');
    
    const suiteResults: BenchmarkResult[] = [];

    // Test 1: Simple SELECT query
    suiteResults.push(await this.runBenchmark(
      'Simple SELECT query',
      async () => {
        return await db.select().from(usersTable).limit(10);
      },
      5
    ));

    // Test 2: JOIN query with pagination
    suiteResults.push(await this.runBenchmark(
      'JOIN query with pagination',
      async () => {
        return await db
          .select({
            id: conversationsTable.id,
            subject: conversationsTable.subject,
            messageCount: count(conversationMessagesTable.id),
          })
          .from(conversationsTable)
          .leftJoin(
            conversationMessagesTable,
            eq(conversationsTable.id, conversationMessagesTable.conversationId)
          )
          .groupBy(conversationsTable.id)
          .orderBy(desc(conversationsTable.createdAt))
          .limit(20)
          .offset(0);
      },
      3
    ));

    // Test 3: Complex search query
    suiteResults.push(await this.runBenchmark(
      'Complex search query',
      async () => {
        const searchTerm = 'test';
        return await db
          .select()
          .from(conversationsTable)
          .where(
            or(
              ilike(conversationsTable.subject, `%${searchTerm}%`),
              ilike(conversationsTable.emailFrom, `%${searchTerm}%`)
            )
          )
          .limit(50);
      },
      3
    ));

    // Test 4: Count query
    suiteResults.push(await this.runBenchmark(
      'Count query',
      async () => {
        const [result] = await db
          .select({ count: count() })
          .from(conversationsTable)
          .where(eq(conversationsTable.status, 'open'));
        return result.count;
      },
      5
    ));

    // Test 5: Transaction performance
    suiteResults.push(await this.runBenchmark(
      'Transaction performance',
      async () => {
        return await db.transaction(async (tx) => {
          const conversations = await tx.select().from(conversationsTable).limit(5);
          const messages = await tx.select().from(conversationMessagesTable).limit(10);
          return { conversations: conversations.length, messages: messages.length };
        });
      },
      3
    ));

    return this.createBenchmarkSuite('Database Operations', suiteResults);
  }

  /**
   * API endpoint benchmarks
   */
  async runApiBenchmarks(): Promise<BenchmarkSuite> {
    console.log('🌐 Running API performance benchmarks...');
    
    const suiteResults: BenchmarkResult[] = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Test 1: Health check endpoint
    suiteResults.push(await this.runBenchmark(
      'Health check endpoint',
      async () => {
        const response = await fetch(`${baseUrl}/api/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
      },
      10
    ));

    // Test 2: Authentication endpoint
    suiteResults.push(await this.runBenchmark(
      'Authentication check',
      async () => {
        const response = await fetch(`${baseUrl}/api/auth/me`, {
          credentials: 'include',
        });
        // Don't throw error for 401 as it's expected for unauthenticated requests
        return { status: response.status };
      },
      5
    ));

    return this.createBenchmarkSuite('API Endpoints', suiteResults);
  }

  /**
   * Memory and resource benchmarks
   */
  async runResourceBenchmarks(): Promise<BenchmarkSuite> {
    console.log('💾 Running resource usage benchmarks...');
    
    const suiteResults: BenchmarkResult[] = [];

    // Test 1: Memory allocation
    suiteResults.push(await this.runBenchmark(
      'Memory allocation test',
      async () => {
        const largeArray = new Array(100000).fill(0).map((_, i) => ({
          id: i,
          data: `test-data-${i}`,
          timestamp: new Date(),
        }));
        
        // Process the array
        const processed = largeArray
          .filter(item => item.id % 2 === 0)
          .map(item => ({ ...item, processed: true }));
        
        return processed.length;
      },
      3
    ));

    // Test 2: CPU intensive task
    suiteResults.push(await this.runBenchmark(
      'CPU intensive task',
      async () => {
        let result = 0;
        for (let i = 0; i < 1000000; i++) {
          result += Math.sqrt(i);
        }
        return result;
      },
      3
    ));

    // Test 3: Promise resolution
    suiteResults.push(await this.runBenchmark(
      'Promise resolution',
      async () => {
        const promises = Array.from({ length: 100 }, (_, i) =>
          new Promise(resolve => setTimeout(() => resolve(i), Math.random() * 10))
        );
        
        const results = await Promise.all(promises);
        return results.length;
      },
      5
    ));

    return this.createBenchmarkSuite('Resource Usage', suiteResults);
  }

  /**
   * Run all benchmark suites
   */
  async runAllBenchmarks(): Promise<{
    suites: BenchmarkSuite[];
    overall: {
      totalTests: number;
      successRate: number;
      averageDuration: number;
      recommendations: string[];
    };
  }> {
    const startTime = Date.now();
    console.log('🚀 Starting comprehensive performance benchmarks...\n');

    const suites: BenchmarkSuite[] = [];

    try {
      // Run all benchmark suites
      suites.push(await this.runDatabaseBenchmarks());
      suites.push(await this.runApiBenchmarks());
      suites.push(await this.runResourceBenchmarks());

      const totalDuration = Date.now() - startTime;
      const allResults = suites.flatMap(suite => suite.results);
      const totalTests = allResults.length;
      const successfulTests = allResults.filter(r => r.success).length;
      const successRate = (successfulTests / totalTests) * 100;
      const averageDuration = allResults.reduce((sum, r) => sum + r.duration, 0) / totalTests;

      // Generate recommendations
      const recommendations = this.generateRecommendations(allResults);

      console.log(`\n✅ Benchmark completed in ${totalDuration}ms`);
      console.log(`📊 Success rate: ${successRate.toFixed(1)}%`);
      console.log(`⏱️  Average test duration: ${averageDuration.toFixed(0)}ms`);

      return {
        suites,
        overall: {
          totalTests,
          successRate,
          averageDuration,
          recommendations,
        },
      };
    } catch (error) {
      console.error('❌ Benchmark suite failed:', error);
      throw error;
    }
  }

  /**
   * Generate performance recommendations based on benchmark results
   */
  private generateRecommendations(results: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];
    
    // Analyze slow operations
    const slowOperations = results.filter(r => r.duration > 1000);
    if (slowOperations.length > 0) {
      recommendations.push(`${slowOperations.length} operations are slower than 1s - consider optimization`);
    }
    
    // Analyze memory usage
    const highMemoryOps = results.filter(r => r.memory && r.memory > 50 * 1024 * 1024); // 50MB
    if (highMemoryOps.length > 0) {
      recommendations.push('High memory usage detected - implement memory optimization strategies');
    }
    
    // Analyze failure rate
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      recommendations.push(`${failures.length} operations failed - investigate error handling`);
    }
    
    // Database-specific recommendations
    const dbOperations = results.filter(r => r.name.includes('query') || r.name.includes('Transaction'));
    const slowDbOps = dbOperations.filter(r => r.duration > 500);
    if (slowDbOps.length > 0) {
      recommendations.push('Database queries are slow - consider adding indexes or query optimization');
    }
    
    // API-specific recommendations
    const apiOperations = results.filter(r => r.name.includes('endpoint') || r.name.includes('API'));
    const slowApiOps = apiOperations.filter(r => r.duration > 300);
    if (slowApiOps.length > 0) {
      recommendations.push('API responses are slow - implement caching and response optimization');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All benchmarks passed with good performance! 🎉');
    }
    
    return recommendations;
  }

  /**
   * Create a benchmark suite result
   */
  private createBenchmarkSuite(name: string, results: BenchmarkResult[]): BenchmarkSuite {
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const successfulTests = results.filter(r => r.success).length;
    const successRate = (successfulTests / results.length) * 100;
    
    let summary = `${successfulTests}/${results.length} tests passed`;
    if (successRate === 100) {
      summary += ' ✅';
    } else if (successRate >= 80) {
      summary += ' ⚠️';
    } else {
      summary += ' ❌';
    }

    return {
      name,
      results,
      totalDuration,
      successRate,
      summary,
    };
  }

  /**
   * Get benchmark results
   */
  getResults(): BenchmarkResult[] {
    return this.results;
  }

  /**
   * Clear benchmark results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        totalTests: this.results.length,
        successfulTests: this.results.filter(r => r.success).length,
        averageDuration: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
      },
    }, null, 2);
  }
}

// Export singleton instance
export const performanceBenchmark = new PerformanceBenchmark();