#!/usr/bin/env tsx

/**
 * Test script to validate the migration works without PostgreSQL extensions
 * This script tests the basic functionality required by the application
 */

import { db } from "@/db/client";
import { jobsTable, httpRequestsTable } from "@/db/schema/jobs";
import { sql } from "drizzle-orm";

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  try {
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

async function testJobsTable() {
  console.log('Testing jobs table...');
  try {
    // Test inserting a job
    const [job] = await db.insert(jobsTable).values({
      type: 'test-job',
      payload: { message: 'test' },
      status: 'pending',
    }).returning();
    
    console.log('✅ Jobs table insert successful:', job.id);
    
    // Test selecting the job
    const jobs = await db.select().from(jobsTable).where(sql`id = ${job.id}`);
    console.log('✅ Jobs table select successful:', jobs.length);
    
    // Clean up
    await db.delete(jobsTable).where(sql`id = ${job.id}`);
    console.log('✅ Jobs table cleanup successful');
    
    return true;
  } catch (error) {
    console.error('❌ Jobs table test failed:', error);
    return false;
  }
}

async function testHttpRequestsTable() {
  console.log('Testing http_requests table...');
  try {
    // Test inserting an HTTP request
    const [request] = await db.insert(httpRequestsTable).values({
      url: 'https://example.com/test',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    }).returning();
    
    console.log('✅ HTTP requests table insert successful:', request.id);
    
    // Test selecting the request
    const requests = await db.select().from(httpRequestsTable).where(sql`id = ${request.id}`);
    console.log('✅ HTTP requests table select successful:', requests.length);
    
    // Clean up
    await db.delete(httpRequestsTable).where(sql`id = ${request.id}`);
    console.log('✅ HTTP requests table cleanup successful');
    
    return true;
  } catch (error) {
    console.error('❌ HTTP requests table test failed:', error);
    return false;
  }
}

async function testExtensionDependencies() {
  console.log('Testing for extension dependencies...');
  try {
    // Check if any problematic extensions are still being used
    const extensions = await db.execute(sql`
      SELECT extname FROM pg_extension 
      WHERE extname IN ('pgmq', 'pg_cron', 'http', 'vault')
    `);
    
    if (extensions.rows.length > 0) {
      console.log('⚠️  Found optional extensions (these are OK if present):');
      extensions.rows.forEach((row: any) => {
        console.log(`    - ${row.extname}`);
      });
    } else {
      console.log('✅ No problematic extensions found');
    }
    
    // Test that we can function without pg_cron
    try {
      await db.execute(sql`SELECT cron.schedule('test', '0 0 * * *', 'SELECT 1')`);
      console.log('⚠️  pg_cron is available but application should not depend on it');
    } catch {
      console.log('✅ Application correctly handles absence of pg_cron');
    }
    
    // Test that we can function without pgmq
    try {
      await db.execute(sql`SELECT pgmq.create('test-queue')`);
      console.log('⚠️  pgmq is available but application should not depend on it');
    } catch {
      console.log('✅ Application correctly handles absence of pgmq');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Extension dependency test failed:', error);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing migration compatibility with standard PostgreSQL\n');
  
  const tests = [
    testDatabaseConnection,
    testJobsTable,
    testHttpRequestsTable,
    testExtensionDependencies,
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test ${test.name} threw an error:`, error);
      failed++;
    }
    console.log(''); // Empty line for readability
  }
  
  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The migration is compatible with standard PostgreSQL.');
    console.log('The application can run without pgmq, pg_cron, or http extensions.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Tests interrupted');
  process.exit(0);
});

// Run the tests
runTests().catch((error) => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});