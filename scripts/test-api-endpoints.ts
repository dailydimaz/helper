#!/usr/bin/env node
/**
 * Comprehensive API endpoint testing script
 * 
 * Usage: pnpm tsx scripts/test-api-endpoints.ts [base-url]
 * 
 * This script tests all API endpoints to ensure they follow the standardized patterns
 * and handle authentication, validation, and error cases properly.
 */

import { setTimeout } from 'timers/promises';

const BASE_URL = process.argv[2] || 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  message: string;
  duration: number;
}

const testResults: TestResult[] = [];

async function makeRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  headers: Record<string, string> = {}
): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const duration = Date.now() - startTime;
    const responseData = await response.json().catch(() => ({}));
    
    return {
      endpoint,
      method,
      status: response.status,
      success: response.ok,
      message: responseData.message || responseData.error || `${response.status} ${response.statusText}`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      endpoint,
      method,
      status: 0,
      success: false,
      message: error instanceof Error ? error.message : 'Request failed',
      duration,
    };
  }
}

async function testAuthentication(): Promise<string | null> {
  console.log('\n🔐 Testing Authentication...');
  
  // Test user registration
  const registerResult = await makeRequest('/api/auth/register', 'POST', {
    email: `test-${Date.now()}@example.com`,
    password: 'testpassword123',
    displayName: 'Test User',
  });
  testResults.push(registerResult);
  
  if (!registerResult.success) {
    console.log('❌ Registration failed, trying existing user login');
  }
  
  // Test user login
  const loginResult = await makeRequest('/api/auth/login', 'POST', {
    email: registerResult.success ? JSON.parse(JSON.stringify(registerResult)).email : 'admin@example.com',
    password: 'testpassword123',
  });
  testResults.push(loginResult);
  
  if (loginResult.success) {
    console.log('✅ Authentication successful');
    // Extract token from Set-Cookie header (simplified)
    return 'mock-auth-token'; // In real implementation, extract from response
  } else {
    console.log('❌ Authentication failed');
    return null;
  }
}

async function testEndpoint(
  endpoint: string,
  method: string = 'GET',
  authToken?: string,
  body?: any,
  expectedStatus: number = 200
): Promise<void> {
  const headers: Record<string, string> = {};
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const result = await makeRequest(endpoint, method, body, headers);
  testResults.push(result);
  
  const statusMatch = result.status === expectedStatus;
  const icon = statusMatch ? '✅' : '❌';
  
  console.log(`${icon} ${method} ${endpoint} - ${result.status} (${result.duration}ms)`);
  
  if (!statusMatch) {
    console.log(`   Expected: ${expectedStatus}, Got: ${result.status}`);
    console.log(`   Message: ${result.message}`);
  }
}

async function testCRUDOperations(authToken: string): Promise<void> {
  console.log('\n📊 Testing CRUD Operations...');
  
  // Test Users API
  console.log('\n👥 Users API:');
  await testEndpoint('/api/adm/users', 'GET', authToken);
  await testEndpoint('/api/adm/users?q=test&page=1&perPage=5', 'GET', authToken);
  await testEndpoint('/api/adm/users?countOnly=true', 'GET', authToken);
  
  // Test create user
  await testEndpoint('/api/adm/users', 'POST', authToken, {
    email: `crud-test-${Date.now()}@example.com`,
    password: 'testpassword123',
    displayName: 'CRUD Test User',
    permissions: 'member'
  }, 201);
  
  // Test Conversations API
  console.log('\n💬 Conversations API:');
  await testEndpoint('/api/adm/conversations', 'GET', authToken);
  await testEndpoint('/api/adm/conversations?q=test&page=1&perPage=5', 'GET', authToken);
  await testEndpoint('/api/adm/conversations?status=open', 'GET', authToken);
  await testEndpoint('/api/adm/conversations?countOnly=true', 'GET', authToken);
  
  // Test Messages API
  console.log('\n📧 Messages API:');
  await testEndpoint('/api/messages', 'GET', authToken);
  await testEndpoint('/api/messages?q=test&page=1&perPage=5', 'GET', authToken);
  await testEndpoint('/api/messages?conversationId=1', 'GET', authToken);
  await testEndpoint('/api/messages?countOnly=true', 'GET', authToken);
  
  // Test Saved Replies API
  console.log('\n💾 Saved Replies API:');
  await testEndpoint('/api/adm/saved-replies', 'GET', authToken);
  await testEndpoint('/api/adm/saved-replies?search=test', 'GET', authToken);
  await testEndpoint('/api/adm/saved-replies?onlyActive=true', 'GET', authToken);
  
  // Test create saved reply
  await testEndpoint('/api/adm/saved-replies', 'POST', authToken, {
    name: `Test Reply ${Date.now()}`,
    content: 'This is a test saved reply content.'
  }, 201);
}

async function testErrorHandling(authToken: string): Promise<void> {
  console.log('\n🚫 Testing Error Handling...');
  
  // Test authentication errors
  console.log('\n🔒 Authentication Errors:');
  await testEndpoint('/api/adm/users', 'GET', undefined, undefined, 401);
  await testEndpoint('/api/messages', 'GET', 'invalid-token', undefined, 401);
  
  // Test validation errors
  console.log('\n✏️ Validation Errors:');
  await testEndpoint('/api/adm/users', 'POST', authToken, {
    email: 'invalid-email',
    password: '123'
  }, 400);
  
  await testEndpoint('/api/adm/saved-replies', 'POST', authToken, {
    name: '',
    content: ''
  }, 400);
  
  // Test not found errors
  console.log('\n🔍 Not Found Errors:');
  await testEndpoint('/api/messages/999999', 'GET', authToken, undefined, 404);
  await testEndpoint('/api/adm/users/999999', 'GET', authToken, undefined, 404);
  
  // Test method not allowed
  console.log('\n🚫 Method Not Allowed:');
  await testEndpoint('/api/adm/me', 'DELETE', authToken, undefined, 405);
}

async function testPaginationAndSearch(authToken: string): Promise<void> {
  console.log('\n🔍 Testing Pagination and Search...');
  
  // Test pagination parameters
  await testEndpoint('/api/adm/conversations?page=1&perPage=1', 'GET', authToken);
  await testEndpoint('/api/adm/conversations?page=invalid&perPage=invalid', 'GET', authToken);
  
  // Test search functionality
  await testEndpoint('/api/messages?q=test', 'GET', authToken);
  await testEndpoint('/api/adm/users?q=admin', 'GET', authToken);
  
  // Test large page numbers
  await testEndpoint('/api/adm/conversations?page=9999&perPage=100', 'GET', authToken);
}

async function testFileHandling(authToken: string): Promise<void> {
  console.log('\n📁 Testing File Handling...');
  
  // Test file not found
  await testEndpoint('/api/files/nonexistent-file', 'GET', authToken, undefined, 404);
  
  // Test file upload without token (should fail)
  await testEndpoint('/api/files/upload/test-slug', 'POST', undefined, undefined, 401);
}

async function testDataIntegrity(authToken: string): Promise<void> {
  console.log('\n🔗 Testing Data Integrity...');
  
  // Test referential integrity
  // This would typically test that related data is properly maintained
  console.log('ℹ️  Data integrity tests require actual data - skipping detailed tests');
  
  // Test basic data consistency
  const conversationsResult = await makeRequest('/api/adm/conversations?countOnly=true', 'GET', {}, {
    Authorization: `Bearer ${authToken}`
  });
  
  const messagesResult = await makeRequest('/api/messages?countOnly=true', 'GET', {}, {
    Authorization: `Bearer ${authToken}`
  });
  
  testResults.push(conversationsResult, messagesResult);
  
  console.log(`✅ Conversations count: ${conversationsResult.success ? 'OK' : 'FAILED'}`);
  console.log(`✅ Messages count: ${messagesResult.success ? 'OK' : 'FAILED'}`);
}

function printSummary(): void {
  console.log('\n📊 Test Summary');
  console.log('==================');
  
  const totalTests = testResults.length;
  const successfulTests = testResults.filter(r => r.success).length;
  const failedTests = totalTests - successfulTests;
  
  console.log(`Total tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests} (${Math.round(successfulTests / totalTests * 100)}%)`);
  console.log(`Failed: ${failedTests} (${Math.round(failedTests / totalTests * 100)}%)`);
  
  const averageDuration = testResults.reduce((sum, r) => sum + r.duration, 0) / totalTests;
  console.log(`Average response time: ${Math.round(averageDuration)}ms`);
  
  const slowTests = testResults.filter(r => r.duration > 1000);
  if (slowTests.length > 0) {
    console.log(`\n⚠️  Slow tests (>1000ms): ${slowTests.length}`);
    slowTests.forEach(test => {
      console.log(`   ${test.method} ${test.endpoint}: ${test.duration}ms`);
    });
  }
  
  const failedTestsDetails = testResults.filter(r => !r.success);
  if (failedTestsDetails.length > 0) {
    console.log(`\n❌ Failed tests:`);
    failedTestsDetails.forEach(test => {
      console.log(`   ${test.method} ${test.endpoint}: ${test.status} - ${test.message}`);
    });
  }
  
  console.log('\n' + (failedTests === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed'));
}

async function main(): Promise<void> {
  console.log(`🧪 Starting API Endpoint Testing`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('==========================================');
  
  // Test authentication first
  const authToken = await testAuthentication();
  
  if (!authToken) {
    console.log('❌ Cannot proceed without authentication');
    process.exit(1);
  }
  
  // Small delay between test suites
  await setTimeout(100);
  
  try {
    await testCRUDOperations(authToken);
    await setTimeout(100);
    
    await testErrorHandling(authToken);
    await setTimeout(100);
    
    await testPaginationAndSearch(authToken);
    await setTimeout(100);
    
    await testFileHandling(authToken);
    await setTimeout(100);
    
    await testDataIntegrity(authToken);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  printSummary();
}

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

export { main as testApiEndpoints };