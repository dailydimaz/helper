#!/usr/bin/env node

/**
 * Performance testing script for SWR API endpoints
 * Tests response times and concurrent request handling
 */

const BASE_URL = 'http://localhost:3010/api';

// Mock authentication token for testing
const TEST_TOKEN = 'Bearer test-token';

class PerformanceTester {
  constructor() {
    this.results = {};
  }

  async testEndpoint(name, endpoint, method = 'GET', body = null, concurrent = 1) {
    console.log(`\n🧪 Testing ${name}`);
    console.log(`   Endpoint: ${method} ${endpoint}`);
    console.log(`   Concurrent requests: ${concurrent}`);

    const requests = [];
    const startTime = Date.now();

    // Create concurrent requests
    for (let i = 0; i < concurrent; i++) {
      const request = this.makeRequest(endpoint, method, body);
      requests.push(request);
    }

    try {
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrent;

      // Analyze responses
      const successCount = responses.filter(r => r.success).length;
      const responseTimes = responses.map(r => r.responseTime);
      const minTime = Math.min(...responseTimes);
      const maxTime = Math.max(...responseTimes);

      // Store results
      this.results[name] = {
        endpoint,
        concurrent,
        totalTime,
        avgTime,
        minTime,
        maxTime,
        successCount,
        successRate: (successCount / concurrent) * 100,
        requestsPerSecond: (concurrent / totalTime) * 1000
      };

      // Display results
      console.log(`   ✅ Success rate: ${successCount}/${concurrent} (${((successCount/concurrent)*100).toFixed(1)}%)`);
      console.log(`   ⏱️  Average response time: ${avgTime.toFixed(1)}ms`);
      console.log(`   📊 Response time range: ${minTime}ms - ${maxTime}ms`);
      console.log(`   🚀 Throughput: ${this.results[name].requestsPerSecond.toFixed(1)} req/s`);

      // Performance verdict
      if (avgTime < 200) {
        console.log(`   🟢 Excellent performance (< 200ms)`);
      } else if (avgTime < 500) {
        console.log(`   🟡 Good performance (< 500ms)`);
      } else {
        console.log(`   🔴 Slow performance (> 500ms)`);
      }

    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
      this.results[name] = { error: error.message };
    }
  }

  async makeRequest(endpoint, method, body) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': TEST_TOKEN
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Read response to ensure complete request
      const data = await response.text();
      
      return {
        success: response.ok,
        status: response.status,
        responseTime,
        dataSize: data.length
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        success: false,
        error: error.message,
        responseTime: endTime - startTime
      };
    }
  }

  printSummary() {
    console.log(`\n📊 Performance Test Summary\n`);
    console.log(`${'Endpoint'.padEnd(25)} ${'Avg Time'.padEnd(12)} ${'Success Rate'.padEnd(15)} ${'Throughput'.padEnd(12)} ${'Status'}`);
    console.log(`${''.padEnd(25, '-')} ${''.padEnd(12, '-')} ${''.padEnd(15, '-')} ${''.padEnd(12, '-')} ${''.padEnd(10, '-')}`);

    Object.entries(this.results).forEach(([name, result]) => {
      if (result.error) {
        console.log(`${name.padEnd(25)} ${'ERROR'.padEnd(12)} ${'0%'.padEnd(15)} ${'0'.padEnd(12)} ❌`);
      } else {
        const avgTime = `${result.avgTime.toFixed(0)}ms`;
        const successRate = `${result.successRate.toFixed(1)}%`;
        const throughput = `${result.requestsPerSecond.toFixed(1)} req/s`;
        const status = result.avgTime < 200 ? '🟢' : result.avgTime < 500 ? '🟡' : '🔴';
        
        console.log(`${name.padEnd(25)} ${avgTime.padEnd(12)} ${successRate.padEnd(15)} ${throughput.padEnd(12)} ${status}`);
      }
    });

    // Overall assessment
    const workingEndpoints = Object.values(this.results).filter(r => !r.error);
    const avgResponseTime = workingEndpoints.reduce((sum, r) => sum + r.avgTime, 0) / workingEndpoints.length;
    
    console.log(`\n🎯 Overall Performance Assessment:`);
    console.log(`   Working endpoints: ${workingEndpoints.length}/${Object.keys(this.results).length}`);
    console.log(`   Average response time: ${avgResponseTime.toFixed(1)}ms`);
    
    if (avgResponseTime < 200) {
      console.log(`   🎉 Excellent! Ready for production traffic`);
    } else if (avgResponseTime < 500) {
      console.log(`   ✅ Good performance, suitable for production`);
    } else {
      console.log(`   ⚠️ Performance needs optimization before production`);
    }
  }

  async runAllTests() {
    console.log(`🚀 Starting API Performance Tests\n`);
    console.log(`Target: ${BASE_URL}`);
    
    // Test single requests first
    await this.testEndpoint('Dashboard Events', '/mailbox/latest-events');
    await this.testEndpoint('Dashboard Metrics', '/mailbox/dashboard-metrics');
    await this.testEndpoint('Conversations List', '/mailbox/conversations');
    await this.testEndpoint('Conversation Messages', '/conversation/test-slug/messages');
    await this.testEndpoint('Presence Data', '/presence/test-channel');
    
    // Test concurrent requests (simulating multiple users)
    console.log(`\n🔄 Testing Concurrent Load (5 simultaneous requests)`);
    await this.testEndpoint('Dashboard Events (5x)', '/mailbox/latest-events', 'GET', null, 5);
    await this.testEndpoint('Conversations List (5x)', '/mailbox/conversations', 'GET', null, 5);
    
    // Test higher load
    console.log(`\n⚡ Testing High Load (10 simultaneous requests)`);
    await this.testEndpoint('Dashboard Events (10x)', '/mailbox/latest-events', 'GET', null, 10);
    
    this.printSummary();
  }
}

// Check if server is running and start tests
async function main() {
  try {
    const healthCheck = await fetch(`${BASE_URL}/health`);
    console.log(`✅ Server is running at ${BASE_URL}`);
  } catch (error) {
    console.log(`❌ Server is not running at ${BASE_URL}`);
    console.log(`Please start the development server first:\n  npm run dev`);
    process.exit(1);
  }

  const tester = new PerformanceTester();
  await tester.runAllTests();
}

main().catch(console.error);