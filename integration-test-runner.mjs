#!/usr/bin/env node

/**
 * Comprehensive Integration Test Runner
 * Tests the migrated system without complex test database setup
 */

import { promises as fs } from 'fs';
import { join } from 'path';

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
const testResults = [];

// Color logging utilities
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️ ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️ ${message}`, colors.cyan);
}

// Test utilities
async function makeRequest(endpoint, options = {}) {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));
    
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: error.message,
      data: {},
      headers: {},
      error,
    };
  }
}

// Test categories
const testCategories = {
  HEALTH: 'Health Checks',
  AUTH: 'Authentication Flow',
  DATABASE: 'Database Operations',
  FILES: 'File Operations',
  JOBS: 'Job System',
  API: 'API Endpoints',
  SWR: 'SWR Integration',
};

function recordTest(category, name, result, details = {}) {
  testResults.push({
    category,
    name,
    passed: result,
    timestamp: new Date().toISOString(),
    details,
  });
  
  if (result) {
    logSuccess(`${category}: ${name}`);
  } else {
    logError(`${category}: ${name}`);
    if (details.error) {
      console.log(`   Error: ${details.error}`);
    }
  }
}

// Health Check Tests
async function testHealth() {
  log('\n📋 Running Health Check Tests...', colors.bright);
  
  try {
    const response = await makeRequest('/api/health');
    recordTest(testCategories.HEALTH, 'Health endpoint accessible', response.ok);
    
    if (response.ok) {
      const healthData = response.data;
      recordTest(testCategories.HEALTH, 'Database connectivity', 
        healthData.checks?.database?.status === 'pass',
        { details: healthData.checks?.database }
      );
      
      recordTest(testCategories.HEALTH, 'Environment configuration', 
        healthData.checks?.environment?.status !== 'fail',
        { details: healthData.checks?.environment }
      );
      
      recordTest(testCategories.HEALTH, 'Filesystem access', 
        healthData.checks?.filesystem?.status === 'pass',
        { details: healthData.checks?.filesystem }
      );
      
      recordTest(testCategories.HEALTH, 'Memory usage within limits', 
        healthData.checks?.memory?.status !== 'fail',
        { details: healthData.checks?.memory }
      );
    }
  } catch (error) {
    recordTest(testCategories.HEALTH, 'Health endpoint', false, { error: error.message });
  }
  
  // Basic health endpoint
  try {
    const response = await makeRequest('/api/health/basic');
    recordTest(testCategories.HEALTH, 'Basic health endpoint', response.status === 200);
  } catch (error) {
    recordTest(testCategories.HEALTH, 'Basic health endpoint', false, { error: error.message });
  }
}

// Authentication Tests
async function testAuthentication() {
  log('\n🔐 Running Authentication Tests...', colors.bright);
  
  // Test auth endpoints exist
  const authEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/me'];
  
  for (const endpoint of authEndpoints) {
    try {
      const response = await makeRequest(endpoint, { method: 'POST' });
      // We expect these to fail with 400/422 (validation error) rather than 404
      const exists = response.status !== 404;
      recordTest(testCategories.AUTH, `${endpoint} endpoint exists`, exists,
        { status: response.status, message: response.statusText }
      );
    } catch (error) {
      recordTest(testCategories.AUTH, `${endpoint} endpoint exists`, false, { error: error.message });
    }
  }
  
  // Test protected route behavior
  try {
    const response = await makeRequest('/api/adm/me');
    const isProtected = response.status === 401 || response.status === 403;
    recordTest(testCategories.AUTH, 'Protected routes require authentication', isProtected,
      { status: response.status, message: response.statusText }
    );
  } catch (error) {
    recordTest(testCategories.AUTH, 'Protected routes require authentication', false, { error: error.message });
  }
}

// Database Operations Tests
async function testDatabaseOperations() {
  log('\n💾 Running Database Operation Tests...', colors.bright);
  
  // Test if core API endpoints respond (indicates DB schema exists)
  const crudEndpoints = [
    { path: '/api/adm/conversations', name: 'Conversations' },
    { path: '/api/adm/users', name: 'Users' },
    { path: '/api/adm/saved-replies', name: 'Saved Replies' },
    { path: '/api/messages', name: 'Messages' },
  ];
  
  for (const endpoint of crudEndpoints) {
    try {
      const response = await makeRequest(endpoint.path);
      // We expect 401 (unauthorized) rather than 500 (database error) or 404 (not found)
      const schemaExists = response.status !== 500 && response.status !== 404;
      recordTest(testCategories.DATABASE, `${endpoint.name} schema exists`, schemaExists,
        { status: response.status, endpoint: endpoint.path }
      );
    } catch (error) {
      recordTest(testCategories.DATABASE, `${endpoint.name} schema exists`, false, 
        { error: error.message, endpoint: endpoint.path }
      );
    }
  }
  
  // Test search and pagination parameters are handled
  try {
    const response = await makeRequest('/api/adm/conversations?page=1&perPage=10&q=test');
    const handlesParams = response.status !== 500;
    recordTest(testCategories.DATABASE, 'Pagination parameters handled', handlesParams,
      { status: response.status }
    );
  } catch (error) {
    recordTest(testCategories.DATABASE, 'Pagination parameters handled', false, { error: error.message });
  }
}

// File Operations Tests
async function testFileOperations() {
  log('\n📁 Running File Operation Tests...', colors.bright);
  
  // Test file upload endpoints exist
  const fileEndpoints = [
    '/api/files/initiate-upload',
    '/api/files/upload',
    '/api/files/url',
  ];
  
  for (const endpoint of fileEndpoints) {
    try {
      const response = await makeRequest(endpoint, { method: 'POST' });
      const exists = response.status !== 404;
      recordTest(testCategories.FILES, `${endpoint} endpoint exists`, exists,
        { status: response.status, endpoint }
      );
    } catch (error) {
      recordTest(testCategories.FILES, `${endpoint} endpoint exists`, false, { error: error.message });
    }
  }
  
  // Test file storage directories
  try {
    await fs.access('./file-storage');
    await fs.access('./file-storage/private');
    await fs.access('./file-storage/public');
    recordTest(testCategories.FILES, 'File storage directories exist', true);
  } catch (error) {
    recordTest(testCategories.FILES, 'File storage directories exist', false, { error: error.message });
  }
}

// Job System Tests
async function testJobSystem() {
  log('\n⚙️ Running Job System Tests...', colors.bright);
  
  // Test job-related endpoints
  const jobEndpoints = [
    '/api/jobs',
    '/api/jobs/stats',
    '/api/jobs/dashboard',
    '/api/job',
  ];
  
  for (const endpoint of jobEndpoints) {
    try {
      const response = await makeRequest(endpoint);
      const exists = response.status !== 404;
      recordTest(testCategories.JOBS, `${endpoint} endpoint exists`, exists,
        { status: response.status, endpoint }
      );
    } catch (error) {
      recordTest(testCategories.JOBS, `${endpoint} endpoint exists`, false, { error: error.message });
    }
  }
  
  // Test lightweight job system files exist
  try {
    await fs.access('./jobs/lightweight');
    recordTest(testCategories.JOBS, 'Lightweight job system directory exists', true);
  } catch (error) {
    recordTest(testCategories.JOBS, 'Lightweight job system directory exists', false, { error: error.message });
  }
  
  // Check if job processor files exist
  const jobFiles = [
    './jobs/lightweight/index.ts',
    './jobs/lightweight/emailProcessing.ts',
    './jobs/lightweight/notifications.ts',
  ];
  
  for (const file of jobFiles) {
    try {
      await fs.access(file);
      recordTest(testCategories.JOBS, `Job file ${file} exists`, true);
    } catch (error) {
      recordTest(testCategories.JOBS, `Job file ${file} exists`, false, { error: error.message });
    }
  }
}

// API Endpoint Tests
async function testApiEndpoints() {
  log('\n🌐 Running API Endpoint Tests...', colors.bright);
  
  // Test core API endpoints
  const apiEndpoints = [
    { path: '/api/mailbox', name: 'Mailbox API' },
    { path: '/api/conversations', name: 'Conversations API' },
    { path: '/api/members', name: 'Members API' },
    { path: '/api/saved-replies', name: 'Saved Replies API' },
  ];
  
  for (const endpoint of apiEndpoints) {
    try {
      const response = await makeRequest(endpoint.path);
      const accessible = response.status !== 404 && response.status !== 500;
      recordTest(testCategories.API, `${endpoint.name} accessible`, accessible,
        { status: response.status, endpoint: endpoint.path }
      );
    } catch (error) {
      recordTest(testCategories.API, `${endpoint.name} accessible`, false, { error: error.message });
    }
  }
  
  // Test error handling
  try {
    const response = await makeRequest('/api/nonexistent-endpoint');
    const handles404 = response.status === 404;
    recordTest(testCategories.API, 'Handles 404 errors properly', handles404);
  } catch (error) {
    recordTest(testCategories.API, 'Handles 404 errors properly', false, { error: error.message });
  }
}

// SWR Integration Tests
async function testSWRIntegration() {
  log('\n🔄 Running SWR Integration Tests...', colors.bright);
  
  // Test SWR hook files exist
  const swrFiles = [
    './hooks/use-api.tsx',
    './hooks/use-user.ts',
    './hooks/use-conversations.tsx',
    './hooks/use-mailbox.tsx',
  ];
  
  for (const file of swrFiles) {
    try {
      await fs.access(file);
      recordTest(testCategories.SWR, `SWR hook ${file} exists`, true);
    } catch (error) {
      recordTest(testCategories.SWR, `SWR hook ${file} exists`, false, { error: error.message });
    }
  }
  
  // Test SWR provider exists
  try {
    await fs.access('./components/providers/swr-provider.tsx');
    recordTest(testCategories.SWR, 'SWR provider component exists', true);
  } catch (error) {
    recordTest(testCategories.SWR, 'SWR provider component exists', false, { error: error.message });
  }
}

// Report Generation
function generateReport() {
  log('\n📊 Generating Integration Test Report...', colors.bright);
  
  const summary = {
    total: testResults.length,
    passed: testResults.filter(t => t.passed).length,
    failed: testResults.filter(t => t.passed === false).length,
    categories: {},
  };
  
  // Group by category
  for (const result of testResults) {
    if (!summary.categories[result.category]) {
      summary.categories[result.category] = { total: 0, passed: 0, failed: 0 };
    }
    summary.categories[result.category].total++;
    if (result.passed) {
      summary.categories[result.category].passed++;
    } else {
      summary.categories[result.category].failed++;
    }
  }
  
  const successRate = Math.round((summary.passed / summary.total) * 100);
  
  const report = {
    timestamp: new Date().toISOString(),
    summary,
    successRate,
    results: testResults,
    recommendations: generateRecommendations(),
  };
  
  return report;
}

function generateRecommendations() {
  const recommendations = [];
  const failures = testResults.filter(t => !t.passed);
  
  // Health check failures
  const healthFailures = failures.filter(t => t.category === testCategories.HEALTH);
  if (healthFailures.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Health',
      issue: 'System health checks failing',
      action: 'Check database connection, environment variables, and filesystem permissions',
    });
  }
  
  // Authentication failures
  const authFailures = failures.filter(t => t.category === testCategories.AUTH);
  if (authFailures.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Authentication',
      issue: 'Authentication system issues detected',
      action: 'Verify JWT configuration and authentication API endpoints',
    });
  }
  
  // Database failures
  const dbFailures = failures.filter(t => t.category === testCategories.DATABASE);
  if (dbFailures.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Database',
      issue: 'Database operations failing',
      action: 'Run migrations, check schema, and verify Drizzle ORM configuration',
    });
  }
  
  // File system failures
  const fileFailures = failures.filter(t => t.category === testCategories.FILES);
  if (fileFailures.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Files',
      issue: 'File operations not functioning',
      action: 'Create file storage directories and check permissions',
    });
  }
  
  // Job system failures
  const jobFailures = failures.filter(t => t.category === testCategories.JOBS);
  if (jobFailures.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Jobs',
      issue: 'Job system incomplete',
      action: 'Verify lightweight job system implementation and cron setup',
    });
  }
  
  return recommendations;
}

async function saveReport(report) {
  const filename = `integration-test-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  const filepath = join(process.cwd(), filename);
  
  try {
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    logSuccess(`Report saved to ${filename}`);
    return filepath;
  } catch (error) {
    logError(`Failed to save report: ${error.message}`);
    return null;
  }
}

function printSummary(report) {
  log('\n📋 TEST SUMMARY', colors.bright);
  log('='.repeat(50), colors.bright);
  
  const { summary, successRate } = report;
  
  logInfo(`Total Tests: ${summary.total}`);
  logSuccess(`Passed: ${summary.passed}`);
  logError(`Failed: ${summary.failed}`);
  
  if (successRate >= 90) {
    logSuccess(`Success Rate: ${successRate}% - EXCELLENT`);
  } else if (successRate >= 75) {
    log(`Success Rate: ${successRate}% - GOOD`, colors.yellow);
  } else if (successRate >= 50) {
    logWarning(`Success Rate: ${successRate}% - NEEDS IMPROVEMENT`);
  } else {
    logError(`Success Rate: ${successRate}% - CRITICAL ISSUES`);
  }
  
  log('\n📋 By Category:', colors.bright);
  for (const [category, stats] of Object.entries(summary.categories)) {
    const rate = Math.round((stats.passed / stats.total) * 100);
    const status = rate === 100 ? '✅' : rate >= 50 ? '⚠️' : '❌';
    log(`${status} ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
  }
  
  if (report.recommendations.length > 0) {
    log('\n🔧 RECOMMENDATIONS', colors.bright);
    log('-'.repeat(50), colors.bright);
    for (const rec of report.recommendations) {
      const priorityColor = rec.priority === 'HIGH' ? colors.red : 
                           rec.priority === 'MEDIUM' ? colors.yellow : colors.cyan;
      log(`${rec.priority}`, priorityColor);
      log(`  Category: ${rec.category}`);
      log(`  Issue: ${rec.issue}`);
      log(`  Action: ${rec.action}`);
      log('');
    }
  }
}

// Main execution
async function main() {
  log('🚀 Starting Comprehensive Integration Tests', colors.bright);
  log('='.repeat(60), colors.bright);
  logInfo(`Testing against: ${baseUrl}`);
  
  try {
    await testHealth();
    await testAuthentication();
    await testDatabaseOperations();
    await testFileOperations();
    await testJobSystem();
    await testApiEndpoints();
    await testSWRIntegration();
    
    const report = generateReport();
    await saveReport(report);
    printSummary(report);
    
    // Exit with error code if too many tests failed
    if (report.successRate < 50) {
      process.exit(1);
    }
    
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as runIntegrationTests };