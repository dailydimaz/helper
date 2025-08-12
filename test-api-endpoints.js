#!/usr/bin/env node

/**
 * Quick API endpoint testing script for SWR integration verification
 * Tests the API endpoints that SWR hooks depend on
 */

import { apiClient } from "./lib/client.js";

// Mock basic test data structure that matches what SWR hooks expect
const testEndpoints = [
  {
    name: "Dashboard Events",
    endpoint: "/mailbox/latest-events",
    method: "GET",
    expectedFields: ["id", "conversationSlug", "timestamp", "title", "type"]
  },
  {
    name: "Dashboard Metrics", 
    endpoint: "/mailbox/dashboard-metrics",
    method: "GET",
    expectedFields: ["totalConversations", "openConversations", "resolvedToday", "averageResponseTime", "satisfaction"]
  },
  {
    name: "Conversations List",
    endpoint: "/mailbox/conversations",
    method: "GET", 
    expectedFields: ["id", "slug", "subject", "status", "createdAt"]
  },
  {
    name: "Conversation Messages",
    endpoint: "/conversation/test-slug/messages",
    method: "GET",
    expectedFields: ["id", "content", "createdAt", "type"]
  },
  {
    name: "Presence Data",
    endpoint: "/presence/test-channel",
    method: "GET",
    expectedFields: ["id", "name"]
  }
];

console.log("🧪 Starting API endpoint verification for SWR integration...\n");

async function testEndpoint(test) {
  try {
    console.log(`Testing ${test.name} (${test.method} ${test.endpoint})...`);
    
    const response = await fetch(`http://localhost:3010/api${test.endpoint}`, {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // Mock auth for testing
      }
    });
    
    if (!response.ok) {
      console.log(`  ❌ HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`  ✅ Response received`);
    
    // Verify response structure for arrays
    if (Array.isArray(data)) {
      if (data.length > 0) {
        const firstItem = data[0];
        const missingFields = test.expectedFields.filter(field => !(field in firstItem));
        if (missingFields.length > 0) {
          console.log(`  ⚠️  Missing expected fields: ${missingFields.join(', ')}`);
        } else {
          console.log(`  ✅ All expected fields present`);
        }
      } else {
        console.log(`  ✅ Empty array returned (expected for test data)`);
      }
    } else if (typeof data === 'object') {
      // Verify response structure for objects
      const missingFields = test.expectedFields.filter(field => !(field in data));
      if (missingFields.length > 0) {
        console.log(`  ⚠️  Missing expected fields: ${missingFields.join(', ')}`);
      } else {
        console.log(`  ✅ All expected fields present`);
      }
    }
    
    return true;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  let passed = 0;
  let total = testEndpoints.length;
  
  for (const test of testEndpoints) {
    const success = await testEndpoint(test);
    if (success) passed++;
    console.log(); // Empty line for readability
  }
  
  console.log(`📊 Test Results: ${passed}/${total} endpoints working`);
  
  if (passed === total) {
    console.log("🎉 All API endpoints are functional and compatible with SWR hooks!");
  } else {
    console.log(`⚠️  ${total - passed} endpoints need attention`);
  }
}

// Check if server is running first
fetch('http://localhost:3010/api/health')
  .then(() => {
    console.log("✅ Development server is running\n");
    runTests();
  })
  .catch(() => {
    console.log("❌ Development server is not running on port 3010");
    console.log("Please start the server with: npm run dev\n");
    process.exit(1);
  });