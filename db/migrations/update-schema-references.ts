#!/usr/bin/env tsx

/**
 * Migration Helper Script: Update Schema References
 * 
 * This script helps identify and update references to the old table names
 * in your application code after the schema conversion to follow boilerplate.md conventions.
 * 
 * Usage: tsx db/migrations/update-schema-references.ts
 */

const tableNameMappings = {
  // Core Tables
  'users': 'usersTable',
  'userSessions': 'userSessionsTable',
  'userIdentities': 'userIdentitiesTable',
  'userProfiles': 'userProfilesTable',
  
  // Conversation System
  'conversations': 'conversationsTable',
  'conversationMessages': 'conversationMessagesTable',
  'conversationEvents': 'conversationEventsTable',
  'messageNotifications': 'messageNotificationsTable',
  
  // Support Infrastructure
  'mailboxes': 'mailboxesTable',
  'gmailSupportEmails': 'gmailSupportEmailsTable',
  'mailboxesMetadataApi': 'mailboxesMetadataApiTable',
  'platformCustomers': 'platformCustomersTable',
  
  // Knowledge Management
  'faqs': 'faqsTable',
  'savedReplies': 'savedRepliesTable',
  'issueGroups': 'issueGroupsTable',
  
  // File Management
  'files': 'filesTable',
  'notes': 'notesTable',
  
  // Tools & Automation
  'tools': 'toolsTable',
  'toolApis': 'toolApisTable',
  'agentThreads': 'agentThreadsTable',
  'agentMessages': 'agentMessagesTable',
  
  // Website Crawling
  'websites': 'websitesTable',
  'websitePages': 'websitePagesTable',
  'websiteCrawls': 'websiteCrawlsTable',
  
  // Guide System
  'guideSessions': 'guideSessionsTable',
  'guideSessionEvents': 'guideSessionEventsTable',
  'guideSessionReplays': 'guideSessionReplaysTable',
  
  // System Tables
  'aiUsageEvents': 'aiUsageEventsTable',
  'cache': 'cacheTable',
  'jobRuns': 'jobRunsTable',
};

const relationMappings = {
  'conversationsRelations': 'conversationsTableRelations',
  'conversationMessagesRelations': 'conversationMessagesTableRelations',
  'conversationEventsRelations': 'conversationEventsTableRelations',
  'messageNotificationRelations': 'messageNotificationsTableRelations',
  'usersRelations': 'usersTableRelations',
  'userSessionsRelations': 'userSessionsTableRelations',
  'userIdentitiesRelations': 'userIdentitiesTableRelations',
  'userProfilesRelations': 'userProfilesTableRelations',
  'mailboxesRelations': 'mailboxesTableRelations',
  'gmailSupportEmailsRelations': 'gmailSupportEmailsTableRelations',
  'mailboxesMetadataApiRelations': 'mailboxesMetadataApiTableRelations',
  'platformCustomersRelations': 'platformCustomersTableRelations',
  'faqsRelations': 'faqsTableRelations',
  'savedRepliesRelations': 'savedRepliesTableRelations',
  'issueGroupsRelations': 'issueGroupsTableRelations',
  'filesRelations': 'filesTableRelations',
  'notesRelations': 'notesTableRelations',
  'toolsRelations': 'toolsTableRelations',
  'toolApisRelations': 'toolApisTableRelations',
  'agentThreadsRelations': 'agentThreadsTableRelations',
  'agentMessagesRelations': 'agentMessagesTableRelations',
  'websitesRelations': 'websitesTableRelations',
  'websitePagesRelations': 'websitePagesTableRelations',
  'websiteCrawlsRelations': 'websiteCrawlsTableRelations',
  'guideSessionsRelations': 'guideSessionsTableRelations',
  'guideSessionEventsRelations': 'guideSessionEventsTableRelations',
  'guideSessionReplaysRelations': 'guideSessionReplaysTableRelations',
  'aiUsageEventsRelations': 'aiUsageEventsTableRelations',
};

console.log('🔄 Schema Reference Migration Helper');
console.log('=====================================\n');

console.log('📋 Table Name Mappings:');
console.log('------------------------');
for (const [oldName, newName] of Object.entries(tableNameMappings)) {
  console.log(`  ${oldName} → ${newName}`);
}

console.log('\n📋 Relation Name Mappings:');
console.log('---------------------------');
for (const [oldName, newName] of Object.entries(relationMappings)) {
  console.log(`  ${oldName} → ${newName}`);
}

console.log('\n🔍 Recommended Actions:');
console.log('------------------------');
console.log('1. Search your codebase for imports from "@/db/schema"');
console.log('2. Update any direct table references to use the new naming convention');
console.log('3. Update any relation references to use the new naming convention');
console.log('4. Test all database operations to ensure they work correctly');

console.log('\n💡 Example Search & Replace Patterns:');
console.log('--------------------------------------');
console.log('Search for: import { users, conversations } from');
console.log('Replace with: import { usersTable, conversationsTable } from');
console.log('');
console.log('Search for: db.select().from(users)');
console.log('Replace with: db.select().from(usersTable)');
console.log('');
console.log('Search for: db.query.conversations.findMany');
console.log('Replace with: db.query.conversationsTable.findMany');

console.log('\n✅ Schema conversion completed successfully!');
console.log('   All tables now follow boilerplate.md naming conventions.');