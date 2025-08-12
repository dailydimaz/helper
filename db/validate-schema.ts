#!/usr/bin/env tsx

/**
 * Schema Validation Script
 * 
 * This script validates that all schema files follow the boilerplate.md conventions
 * and that all references are properly updated.
 */

import * as fs from 'fs';
import * as path from 'path';

const schemaDir = path.join(process.cwd(), 'db', 'schema');

function validateSchemaFile(filePath: string, filename: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  
  // Skip index.ts
  if (filename === 'index.ts') return issues;
  
  // Check for proper table naming (should end with 'Table')
  const tableExportRegex = /export const (\w+) = pgTable\(/g;
  let match;
  while ((match = tableExportRegex.exec(content)) !== null) {
    const tableName = match[1];
    if (!tableName.endsWith('Table')) {
      issues.push(`Table export '${tableName}' should end with 'Table' suffix`);
    }
  }
  
  // Check for proper relation naming (should end with 'TableRelations')
  const relationExportRegex = /export const (\w+) = relations\(/g;
  while ((match = relationExportRegex.exec(content)) !== null) {
    const relationName = match[1];
    if (!relationName.endsWith('TableRelations')) {
      issues.push(`Relation export '${relationName}' should end with 'TableRelations' suffix`);
    }
  }
  
  // Check for old table references in imports
  const oldTableNames = [
    'users', 'conversations', 'conversationMessages', 'conversationEvents',
    'messageNotifications', 'mailboxes', 'gmailSupportEmails', 'mailboxesMetadataApi',
    'platformCustomers', 'faqs', 'savedReplies', 'issueGroups', 'files', 'notes',
    'tools', 'toolApis', 'agentThreads', 'agentMessages', 'websites', 'websitePages',
    'websiteCrawls', 'guideSessions', 'guideSessionEvents', 'guideSessionReplays',
    'aiUsageEvents', 'cache', 'jobRuns'
  ];
  
  for (const oldName of oldTableNames) {
    // Skip if it's the file defining this table
    if (filename.startsWith(oldName.replace(/([A-Z])/g, '$1').toLowerCase())) continue;
    
    const importRegex = new RegExp(`import.*{[^}]*\\b${oldName}\\b[^}]*}.*from`, 'g');
    if (importRegex.test(content)) {
      issues.push(`Found import of old table name '${oldName}' - should be '${oldName}Table'`);
    }
  }
  
  return issues;
}

console.log('🔍 Validating Schema Files...');
console.log('===============================\n');

const files = fs.readdirSync(schemaDir);
let totalIssues = 0;

for (const filename of files) {
  if (!filename.endsWith('.ts')) continue;
  
  const filePath = path.join(schemaDir, filename);
  const issues = validateSchemaFile(filePath, filename);
  
  if (issues.length > 0) {
    console.log(`❌ ${filename}:`);
    for (const issue of issues) {
      console.log(`   - ${issue}`);
    }
    console.log();
    totalIssues += issues.length;
  } else {
    console.log(`✅ ${filename}`);
  }
}

console.log('\n' + '='.repeat(50));
if (totalIssues === 0) {
  console.log('🎉 All schema files are properly formatted!');
  console.log('   All tables follow boilerplate.md naming conventions.');
} else {
  console.log(`⚠️  Found ${totalIssues} issue(s) that need to be fixed.`);
}
console.log('='.repeat(50));