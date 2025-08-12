#!/usr/bin/env tsx

/**
 * Performance Testing Script
 * Run comprehensive performance tests and generate reports
 */

import { performanceBenchmark } from '@/lib/performance/benchmark';
import { PerformanceMonitor } from '@/lib/database/optimizations';
import { db } from '@/db/client';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 Starting comprehensive performance testing...\n');
  
  const startTime = Date.now();
  
  try {
    // Check database connectivity first
    console.log('🔌 Checking database connectivity...');
    const healthCheck = await db.healthCheck();
    
    if (!healthCheck.healthy) {
      console.error('❌ Database is not healthy:', healthCheck.error);
      process.exit(1);
    }
    
    console.log(`✅ Database is healthy (${healthCheck.responseTime}ms response time)\n`);
    
    // Clear previous results
    performanceBenchmark.clearResults();
    
    // Run comprehensive benchmarks
    const results = await performanceBenchmark.runAllBenchmarks();
    
    // Generate report
    console.log('\n📊 Performance Test Results:');
    console.log('='.repeat(50));
    
    results.suites.forEach(suite => {
      console.log(`\n${suite.name} (${suite.summary})`);
      console.log('-'.repeat(30));
      
      suite.results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const duration = `${result.duration}ms`;
        const memory = result.memory ? `${Math.round(result.memory / 1024 / 1024)}MB` : '';
        
        console.log(`  ${status} ${result.name.padEnd(25)} ${duration.padStart(8)} ${memory.padStart(8)}`);
        
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      });
    });
    
    // Overall summary
    console.log('\n📈 Overall Performance Summary:');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${results.overall.totalTests}`);
    console.log(`Success Rate: ${results.overall.successRate.toFixed(1)}%`);
    console.log(`Average Duration: ${results.overall.averageDuration.toFixed(0)}ms`);
    console.log(`Total Test Time: ${Date.now() - startTime}ms`);
    
    // Recommendations
    if (results.overall.recommendations.length > 0) {
      console.log('\n💡 Performance Recommendations:');
      console.log('='.repeat(50));
      results.overall.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    // Generate performance report file
    const reportDir = path.join(process.cwd(), 'performance-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `performance-report-${timestamp}.json`);
    
    const fullReport = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      suites: results.suites,
      overall: results.overall,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
      },
      database: healthCheck,
    };
    
    fs.writeFileSync(reportFile, JSON.stringify(fullReport, null, 2));
    console.log(`\n📁 Report saved to: ${reportFile}`);
    
    // Performance monitoring summary
    const performanceMonitor = PerformanceMonitor.getInstance();
    const metrics = performanceMonitor.getPerformanceReport();
    
    console.log('\n📊 Performance Monitor Summary:');
    console.log('='.repeat(50));
    console.log(`Total Queries Tracked: ${metrics.totalQueries}`);
    console.log(`Average Query Duration: ${metrics.averageDuration}ms`);
    console.log(`Slow Queries: ${metrics.slowQueries}`);
    console.log(`Error Rate: ${metrics.errorRate}%`);
    
    // Connection pool stats
    const poolStats = db.getPoolStats();
    console.log('\n🏊 Connection Pool Status:');
    console.log('='.repeat(50));
    console.log(`Total Connections: ${poolStats.totalCount}`);
    console.log(`Idle Connections: ${poolStats.idleCount}`);
    console.log(`Waiting Clients: ${poolStats.waitingCount}`);
    
    // Exit with appropriate code
    const hasFailures = results.overall.successRate < 100;
    const hasSlowQueries = metrics.slowQueries > 5;
    
    if (hasFailures || hasSlowQueries) {
      console.log('\n⚠️  Performance issues detected. Review the report for optimization opportunities.');
      process.exit(1);
    } else {
      console.log('\n🎉 All performance tests passed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Performance testing failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Performance testing interrupted...');
  await db.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Performance testing terminated...');
  await db.shutdown();
  process.exit(0);
});

// Run the performance test
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default main;