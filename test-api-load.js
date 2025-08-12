#!/usr/bin/env node

/**
 * Load testing for SWR API endpoints
 * Simulates realistic user behavior and polling patterns
 */

const BASE_URL = 'http://localhost:3010/api';

class LoadTester {
  constructor() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      responseTimes: [],
      errorsPerEndpoint: {},
      requestsPerEndpoint: {}
    };
    this.isRunning = false;
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const startTime = Date.now();
    this.stats.totalRequests++;
    
    if (!this.stats.requestsPerEndpoint[endpoint]) {
      this.stats.requestsPerEndpoint[endpoint] = 0;
    }
    this.stats.requestsPerEndpoint[endpoint]++;

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: body ? JSON.stringify(body) : undefined
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Read response to ensure complete request
      await response.text();
      
      this.stats.totalResponseTime += responseTime;
      this.stats.responseTimes.push(responseTime);
      this.stats.minResponseTime = Math.min(this.stats.minResponseTime, responseTime);
      this.stats.maxResponseTime = Math.max(this.stats.maxResponseTime, responseTime);

      if (response.ok) {
        this.stats.successfulRequests++;
        return { success: true, responseTime, status: response.status };
      } else {
        this.stats.failedRequests++;
        this.recordError(endpoint, `HTTP ${response.status}`);
        return { success: false, responseTime, status: response.status };
      }
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      this.stats.failedRequests++;
      this.stats.totalResponseTime += responseTime;
      this.stats.responseTimes.push(responseTime);
      this.recordError(endpoint, error.message);
      
      return { success: false, responseTime, error: error.message };
    }
  }

  recordError(endpoint, error) {
    if (!this.stats.errorsPerEndpoint[endpoint]) {
      this.stats.errorsPerEndpoint[endpoint] = {};
    }
    if (!this.stats.errorsPerEndpoint[endpoint][error]) {
      this.stats.errorsPerEndpoint[endpoint][error] = 0;
    }
    this.stats.errorsPerEndpoint[endpoint][error]++;
  }

  // Simulate a user polling dashboard events every 5 seconds
  async simulateDashboardUser(duration = 60000) {
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime && this.isRunning) {
      await this.makeRequest('/mailbox/latest-events');
      await this.makeRequest('/mailbox/dashboard-metrics');
      await this.sleep(5000); // 5 second polling interval
    }
  }

  // Simulate a user viewing conversation list (polls every 3 seconds)
  async simulateConversationUser(duration = 60000) {
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime && this.isRunning) {
      await this.makeRequest('/mailbox/conversations');
      await this.sleep(3000); // 3 second polling interval
    }
  }

  // Simulate a user actively chatting (polls messages every 3 seconds)
  async simulateActiveChatter(duration = 60000) {
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime && this.isRunning) {
      await this.makeRequest('/conversation/test-slug/messages');
      await this.makeRequest('/presence/test-channel');
      
      // Occasionally send a message
      if (Math.random() < 0.1) { // 10% chance
        await this.makeRequest('/conversation/test-slug/send-message', 'POST', {
          content: `Test message ${Date.now()}`,
          type: 'user'
        });
      }
      
      await this.sleep(3000); // 3 second polling interval
    }
  }

  // Simulate occasional status updates
  async simulateStatusUpdater(duration = 60000) {
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime && this.isRunning) {
      // Update status occasionally
      if (Math.random() < 0.05) { // 5% chance
        await this.makeRequest('/conversation/update-status', 'PATCH', {
          conversationId: Math.floor(Math.random() * 100) + 1,
          status: Math.random() < 0.5 ? 'open' : 'closed'
        });
      }
      
      await this.sleep(10000); // Check every 10 seconds
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculatePercentile(percentile) {
    const sorted = [...this.stats.responseTimes].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  printRealTimeStats() {
    const avgResponseTime = this.stats.totalRequests > 0 
      ? this.stats.totalResponseTime / this.stats.totalRequests 
      : 0;
    
    const successRate = this.stats.totalRequests > 0
      ? (this.stats.successfulRequests / this.stats.totalRequests) * 100
      : 0;

    const requestsPerSecond = this.stats.totalRequests / ((Date.now() - this.startTime) / 1000);

    console.clear();
    console.log(`🔄 Load Test in Progress...\n`);
    console.log(`📊 Real-time Stats:`);
    console.log(`   Total requests: ${this.stats.totalRequests}`);
    console.log(`   Success rate: ${successRate.toFixed(1)}%`);
    console.log(`   Avg response time: ${avgResponseTime.toFixed(1)}ms`);
    console.log(`   Min/Max response: ${this.stats.minResponseTime}ms / ${this.stats.maxResponseTime}ms`);
    console.log(`   Throughput: ${requestsPerSecond.toFixed(1)} req/s`);
    
    if (this.stats.responseTimes.length > 0) {
      console.log(`   95th percentile: ${this.calculatePercentile(95).toFixed(1)}ms`);
    }

    console.log(`\n📈 Requests per endpoint:`);
    Object.entries(this.stats.requestsPerEndpoint).forEach(([endpoint, count]) => {
      console.log(`   ${endpoint}: ${count}`);
    });

    if (Object.keys(this.stats.errorsPerEndpoint).length > 0) {
      console.log(`\n❌ Errors:`);
      Object.entries(this.stats.errorsPerEndpoint).forEach(([endpoint, errors]) => {
        console.log(`   ${endpoint}:`);
        Object.entries(errors).forEach(([error, count]) => {
          console.log(`     ${error}: ${count}`);
        });
      });
    }
  }

  async runLoadTest(users = 5, duration = 60000) {
    console.log(`🚀 Starting Load Test\n`);
    console.log(`Configuration:`);
    console.log(`   Concurrent users: ${users}`);
    console.log(`   Duration: ${duration / 1000} seconds`);
    console.log(`   Target: ${BASE_URL}\n`);

    this.isRunning = true;
    this.startTime = Date.now();

    // Start real-time stats display
    const statsInterval = setInterval(() => {
      this.printRealTimeStats();
    }, 2000);

    // Create user simulations
    const userPromises = [];
    
    for (let i = 0; i < users; i++) {
      const userType = i % 4; // Distribute user types
      
      switch (userType) {
        case 0:
          userPromises.push(this.simulateDashboardUser(duration));
          break;
        case 1:
          userPromises.push(this.simulateConversationUser(duration));
          break;
        case 2:
          userPromises.push(this.simulateActiveChatter(duration));
          break;
        case 3:
          userPromises.push(this.simulateStatusUpdater(duration));
          break;
      }
    }

    // Wait for all simulations to complete
    await Promise.all(userPromises);
    
    this.isRunning = false;
    clearInterval(statsInterval);
    
    // Final stats
    this.printFinalStats();
  }

  printFinalStats() {
    console.clear();
    console.log(`🏁 Load Test Complete!\n`);
    
    const duration = (Date.now() - this.startTime) / 1000;
    const avgResponseTime = this.stats.totalRequests > 0 
      ? this.stats.totalResponseTime / this.stats.totalRequests 
      : 0;
    
    const successRate = this.stats.totalRequests > 0
      ? (this.stats.successfulRequests / this.stats.totalRequests) * 100
      : 0;

    const requestsPerSecond = this.stats.totalRequests / duration;

    console.log(`📊 Final Results:`);
    console.log(`   Duration: ${duration.toFixed(1)} seconds`);
    console.log(`   Total requests: ${this.stats.totalRequests}`);
    console.log(`   Successful: ${this.stats.successfulRequests}`);
    console.log(`   Failed: ${this.stats.failedRequests}`);
    console.log(`   Success rate: ${successRate.toFixed(1)}%`);
    console.log(`   Average response time: ${avgResponseTime.toFixed(1)}ms`);
    console.log(`   Min response time: ${this.stats.minResponseTime}ms`);
    console.log(`   Max response time: ${this.stats.maxResponseTime}ms`);
    console.log(`   Throughput: ${requestsPerSecond.toFixed(1)} req/s`);

    if (this.stats.responseTimes.length > 0) {
      console.log(`\n📈 Response Time Percentiles:`);
      console.log(`   50th: ${this.calculatePercentile(50).toFixed(1)}ms`);
      console.log(`   95th: ${this.calculatePercentile(95).toFixed(1)}ms`);
      console.log(`   99th: ${this.calculatePercentile(99).toFixed(1)}ms`);
    }

    console.log(`\n🎯 Performance Assessment:`);
    if (successRate >= 99 && avgResponseTime < 200) {
      console.log(`   🟢 Excellent! Ready for high-traffic production use`);
    } else if (successRate >= 95 && avgResponseTime < 500) {
      console.log(`   🟡 Good performance, suitable for production`);
    } else if (successRate >= 90) {
      console.log(`   🟠 Acceptable but monitor for improvements`);
    } else {
      console.log(`   🔴 Poor performance, optimization needed`);
    }

    console.log(`\n📋 Requests by endpoint:`);
    Object.entries(this.stats.requestsPerEndpoint)
      .sort(([,a], [,b]) => b - a)
      .forEach(([endpoint, count]) => {
        const percentage = (count / this.stats.totalRequests * 100).toFixed(1);
        console.log(`   ${endpoint}: ${count} (${percentage}%)`);
      });

    if (Object.keys(this.stats.errorsPerEndpoint).length > 0) {
      console.log(`\n❌ Error Summary:`);
      Object.entries(this.stats.errorsPerEndpoint).forEach(([endpoint, errors]) => {
        console.log(`   ${endpoint}:`);
        Object.entries(errors).forEach(([error, count]) => {
          console.log(`     ${error}: ${count}`);
        });
      });
    } else {
      console.log(`\n✅ No errors encountered!`);
    }

    // SWR-specific analysis
    console.log(`\n🔗 SWR Integration Analysis:`);
    console.log(`   Dashboard polling (5s): ${this.stats.requestsPerEndpoint['/mailbox/latest-events'] || 0} requests`);
    console.log(`   Conversation polling (3s): ${this.stats.requestsPerEndpoint['/mailbox/conversations'] || 0} requests`);
    console.log(`   Message polling (3s): ${this.stats.requestsPerEndpoint['/conversation/test-slug/messages'] || 0} requests`);
    
    const pollingResponseTime = [
      '/mailbox/latest-events',
      '/mailbox/conversations', 
      '/conversation/test-slug/messages'
    ].reduce((sum, endpoint) => {
      return sum + (this.stats.requestsPerEndpoint[endpoint] || 0);
    }, 0);

    if (avgResponseTime < 200 && pollingResponseTime > 0) {
      console.log(`   🚀 SWR polling will provide excellent real-time experience`);
    } else if (avgResponseTime < 500) {
      console.log(`   ✅ SWR polling will provide good real-time experience`);
    } else {
      console.log(`   ⚠️ Consider optimizing for better SWR polling performance`);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const users = parseInt(args[0]) || 5;
  const duration = parseInt(args[1]) || 60;

  console.log(`⚡ API Load Testing Tool\n`);
  
  try {
    await fetch(`${BASE_URL}/health`);
    console.log(`✅ Server is available at ${BASE_URL}\n`);
  } catch (error) {
    console.log(`❌ Server is not running at ${BASE_URL}`);
    console.log(`Please start the development server first:\n  npm run dev\n`);
    console.log(`Note: Test will continue but may show connection errors\n`);
  }

  const tester = new LoadTester();
  await tester.runLoadTest(users, duration * 1000);
}

if (process.argv[1].endsWith('test-api-load.js')) {
  main().catch(console.error);
}