#!/usr/bin/env node

/**
 * Contract testing for SWR API endpoints
 * Validates that API responses match exactly what SWR hooks expect
 */

const BASE_URL = 'http://localhost:3010/api';

// Define expected contracts based on SWR hook types
const contracts = {
  dashboardEvents: {
    endpoint: '/mailbox/latest-events',
    method: 'GET',
    expectedType: 'array',
    itemSchema: {
      id: 'string',
      conversationSlug: 'string', 
      timestamp: 'string',
      title: 'string',
      description: 'string|undefined',
      type: ['email', 'chat', 'ai_reply', 'bad_reply', 'good_reply', 'escalation'],
      emailFrom: 'string|undefined',
      isVip: 'boolean',
      value: 'number|undefined'
    }
  },
  
  dashboardMetrics: {
    endpoint: '/mailbox/dashboard-metrics',
    method: 'GET',
    expectedType: 'object',
    schema: {
      totalConversations: 'number',
      openConversations: 'number', 
      resolvedToday: 'number',
      averageResponseTime: 'number',
      satisfaction: 'number'
    }
  },
  
  conversations: {
    endpoint: '/mailbox/conversations',
    method: 'GET',
    expectedType: 'array',
    itemSchema: {
      id: 'number',
      slug: 'string',
      subject: 'string',
      status: 'string',
      createdAt: 'string',
      updatedAt: 'string',
      lastUserEmailCreatedAt: 'string|null',
      lastReadAt: 'string|null',
      emailFrom: 'string|null',
      emailFromName: 'string|null',
      assignedToId: 'string|null',
      assignedToAI: 'boolean',
      isPrompt: 'boolean|null',
      isVisitor: 'boolean|null',
      closedAt: 'string|null',
      source: 'string|null',
      recentMessageText: 'string|null',
      recentMessageAt: 'string|null',
      messageCount: 'number',
      unreadCount: 'number',
      customerInfo: 'object|null'
    }
  },
  
  conversationMessages: {
    endpoint: '/conversation/test-slug/messages',
    method: 'GET',
    expectedType: 'array',
    itemSchema: {
      id: 'string',
      content: 'string',
      createdAt: 'string', 
      updatedAt: 'string',
      type: ['user', 'ai', 'system'],
      metadata: 'object|undefined'
    }
  },
  
  sendMessage: {
    endpoint: '/conversation/test-slug/send-message',
    method: 'POST',
    requestBody: {
      content: 'test message',
      type: 'user'
    },
    expectedType: 'object',
    schema: {
      id: 'string',
      content: 'string',
      createdAt: 'string',
      updatedAt: 'string', 
      type: ['user', 'ai', 'system'],
      metadata: 'object|undefined'
    }
  },
  
  updateConversationStatus: {
    endpoint: '/conversation/update-status',
    method: 'PATCH',
    requestBody: {
      conversationId: 1,
      status: 'open',
      assignedToId: null
    },
    expectedType: 'object',
    schema: {
      id: 'number',
      status: 'string',
      assignedToId: 'string|null',
      closedAt: 'string|null',
      updatedAt: 'string'
    }
  },
  
  presenceData: {
    endpoint: '/presence/test-channel',
    method: 'GET',
    expectedType: 'array',
    itemSchema: {
      id: 'string',
      name: 'string'
    }
  }
};

class ContractTester {
  constructor() {
    this.results = {};
    this.totalTests = 0;
    this.passedTests = 0;
  }

  validateType(value, expectedType, fieldName = '') {
    const actualType = this.getActualType(value);
    
    if (Array.isArray(expectedType)) {
      // Enum validation
      if (!expectedType.includes(value)) {
        return {
          valid: false,
          error: `${fieldName}: Expected one of [${expectedType.join(', ')}], got "${value}"`
        };
      }
      return { valid: true };
    }
    
    if (expectedType.includes('|')) {
      // Union type validation
      const allowedTypes = expectedType.split('|');
      const isValid = allowedTypes.some(type => {
        if (type === 'undefined') return value === undefined;
        if (type === 'null') return value === null;
        return this.getActualType(value) === type;
      });
      
      if (!isValid) {
        return {
          valid: false,
          error: `${fieldName}: Expected ${expectedType}, got ${actualType}`
        };
      }
      return { valid: true };
    }
    
    // Simple type validation
    if (actualType !== expectedType) {
      return {
        valid: false,
        error: `${fieldName}: Expected ${expectedType}, got ${actualType}`
      };
    }
    
    return { valid: true };
  }
  
  getActualType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
  
  validateSchema(data, schema, itemName = '') {
    const errors = [];
    
    for (const [field, expectedType] of Object.entries(schema)) {
      this.totalTests++;
      const fieldPath = itemName ? `${itemName}.${field}` : field;
      
      if (!(field in data)) {
        errors.push(`Missing required field: ${fieldPath}`);
        continue;
      }
      
      const validation = this.validateType(data[field], expectedType, fieldPath);
      if (validation.valid) {
        this.passedTests++;
      } else {
        errors.push(validation.error);
      }
    }
    
    return errors;
  }
  
  async testContract(name, contract) {
    console.log(`\n🧪 Testing ${name} contract`);
    console.log(`   ${contract.method} ${contract.endpoint}`);
    
    try {
      const response = await fetch(`${BASE_URL}${contract.endpoint}`, {
        method: contract.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: contract.requestBody ? JSON.stringify(contract.requestBody) : undefined
      });
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${parseError.message}`);
      }
      
      if (!response.ok) {
        console.log(`   ⚠️ HTTP ${response.status}: ${response.statusText}`);
        if (response.status === 404) {
          console.log(`   💡 This might be expected for test data`);
        }
        this.results[name] = { 
          status: 'http_error', 
          httpStatus: response.status,
          message: response.statusText 
        };
        return;
      }
      
      const errors = [];
      
      // Validate response type
      this.totalTests++;
      if (contract.expectedType === 'array' && Array.isArray(data)) {
        this.passedTests++;
        console.log(`   ✅ Response is array`);
        
        // Validate array items if present
        if (data.length > 0 && contract.itemSchema) {
          console.log(`   📝 Validating ${data.length} items...`);
          data.slice(0, 3).forEach((item, index) => { // Test first 3 items
            const itemErrors = this.validateSchema(item, contract.itemSchema, `item[${index}]`);
            errors.push(...itemErrors);
          });
        } else if (data.length === 0) {
          console.log(`   📝 Empty array (expected for test environment)`);
        }
      } else if (contract.expectedType === 'object' && typeof data === 'object' && !Array.isArray(data)) {
        this.passedTests++;
        console.log(`   ✅ Response is object`);
        
        // Validate object schema
        if (contract.schema) {
          const objectErrors = this.validateSchema(data, contract.schema);
          errors.push(...objectErrors);
        }
      } else {
        errors.push(`Expected ${contract.expectedType}, got ${this.getActualType(data)}`);
      }
      
      // Report results
      if (errors.length === 0) {
        console.log(`   🎉 Contract fully satisfied`);
        this.results[name] = { status: 'passed' };
      } else {
        console.log(`   ❌ Contract violations found:`);
        errors.slice(0, 5).forEach(error => console.log(`      - ${error}`));
        if (errors.length > 5) {
          console.log(`      ... and ${errors.length - 5} more errors`);
        }
        this.results[name] = { status: 'failed', errors };
      }
      
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
      this.results[name] = { status: 'error', error: error.message };
    }
  }
  
  printSummary() {
    console.log(`\n📋 Contract Test Summary\n`);
    
    const passed = Object.values(this.results).filter(r => r.status === 'passed').length;
    const failed = Object.values(this.results).filter(r => r.status === 'failed').length;
    const errors = Object.values(this.results).filter(r => r.status === 'error').length;
    const httpErrors = Object.values(this.results).filter(r => r.status === 'http_error').length;
    const total = Object.keys(this.results).length;
    
    console.log(`Results by endpoint:`);
    Object.entries(this.results).forEach(([name, result]) => {
      const status = result.status === 'passed' ? '✅' : 
                    result.status === 'failed' ? '❌' : 
                    result.status === 'http_error' ? '⚠️' : '🔴';
      console.log(`  ${status} ${name}`);
    });
    
    console.log(`\n📊 Overall Results:`);
    console.log(`  Total endpoints tested: ${total}`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  ⚠️ HTTP errors: ${httpErrors}`);
    console.log(`  🔴 Test errors: ${errors}`);
    console.log(`  🧪 Field tests: ${this.passedTests}/${this.totalTests} passed`);
    
    const successRate = ((passed / total) * 100).toFixed(1);
    console.log(`  📈 Success rate: ${successRate}%`);
    
    if (passed === total) {
      console.log(`\n🎉 All contracts satisfied! APIs are ready for SWR integration.`);
    } else if (passed >= total * 0.8) {
      console.log(`\n✅ Most contracts satisfied. Minor issues to address.`);
    } else {
      console.log(`\n⚠️ Significant contract violations found. Review needed.`);
    }
    
    // SWR integration assessment
    console.log(`\n🔗 SWR Integration Assessment:`);
    const criticalEndpoints = ['dashboardEvents', 'dashboardMetrics', 'conversations', 'conversationMessages'];
    const criticalPassed = criticalEndpoints.filter(ep => this.results[ep]?.status === 'passed').length;
    
    if (criticalPassed === criticalEndpoints.length) {
      console.log(`  🟢 All critical SWR endpoints working correctly`);
      console.log(`  🚀 Ready for production SWR integration`);
    } else {
      console.log(`  🟡 ${criticalPassed}/${criticalEndpoints.length} critical endpoints working`);
      console.log(`  🔧 Review failed endpoints before SWR deployment`);
    }
  }
  
  async runAllTests() {
    console.log(`🔍 Starting API Contract Validation\n`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`Purpose: Validate API responses match SWR hook expectations`);
    
    for (const [name, contract] of Object.entries(contracts)) {
      await this.testContract(name, contract);
    }
    
    this.printSummary();
  }
}

// Main execution
async function main() {
  try {
    const healthCheck = await fetch(`${BASE_URL}/health`);
    console.log(`✅ Server is running at ${BASE_URL}`);
  } catch (error) {
    console.log(`❌ Server is not running at ${BASE_URL}`);
    console.log(`Note: Some tests may still pass with 404 errors (expected for test data)`);
    console.log(`To start server: npm run dev\n`);
  }

  const tester = new ContractTester();
  await tester.runAllTests();
}

main().catch(console.error);