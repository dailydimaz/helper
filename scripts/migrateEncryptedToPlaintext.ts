/* eslint-disable no-console */
import { and, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { 
  conversationMessagesTable, 
  conversationsTable, 
  gmailSupportEmailsTable, 
  toolApisTable, 
  toolsTable 
} from "@/db/schema";
import { decryptFieldValue } from "@/db/lib/encryptedField";

const BATCH_SIZE = 1000;

export const migrateEncryptedToPlaintext = async () => {
  console.log("Starting migration of encrypted data to plaintext columns...");

  try {
    await migrateConversationMessages();
    await migrateConversations();
    await migrateTools();
    await migrateToolApis();
    await migrateGmailSupportEmails();

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
};

const migrateConversationMessages = async () => {
  console.log("🔄 Migrating conversation messages...");
  let processed = 0;
  let errors = 0;

  const batchSize = 50; // Smaller batch size for potentially large text fields
  let offset = 0;

  while (true) {
    const messagesToMigrate = await db
      .select({
        id: conversationMessagesTable.id,
        unused_body: conversationMessagesTable.unused_body,
        body: conversationMessagesTable.body,
        unused_cleanedUpText: conversationMessagesTable.unused_cleanedUpText,
        cleanedUpText: conversationMessagesTable.cleanedUpText,
      })
      .from(conversationMessagesTable)
      .where(
        and(
          or(
            and(isNotNull(conversationMessagesTable.unused_body), isNull(conversationMessagesTable.body)),
            and(isNotNull(conversationMessagesTable.unused_cleanedUpText), isNull(conversationMessagesTable.cleanedUpText))
          )
        )
      )
      .limit(batchSize)
      .offset(offset);

    if (messagesToMigrate.length === 0) break;

    for (const message of messagesToMigrate) {
      try {
        const updates: Partial<typeof conversationMessagesTable.$inferInsert> = {};
        
        // Migrate body if needed
        if (message.unused_body && !message.body) {
          updates.body = decryptFieldValue(message.unused_body);
        }
        
        // Migrate cleanedUpText if needed  
        if (message.unused_cleanedUpText && !message.cleanedUpText) {
          updates.cleanedUpText = decryptFieldValue(message.unused_cleanedUpText);
        }
        
        if (Object.keys(updates).length > 0) {
          await db
            .update(conversationMessagesTable)
            .set(updates)
            .where(eq(conversationMessagesTable.id, message.id));
        }
        
        processed++;
      } catch (error) {
        console.error(`Failed to migrate message ${message.id}:`, error);
        errors++;
      }
    }

    offset += batchSize;
    console.log(`  Migrated ${processed} conversation messages (${errors} errors)`);
  }

  console.log(`✅ Conversation messages migration complete: ${processed} processed, ${errors} errors`);
};

const migrateConversations = async () => {
  console.log("🔄 Migrating conversations...");
  let processed = 0;
  let errors = 0;

  const conversationsToMigrate = await db
    .select({
      id: conversationsTable.id,
      unused_subject: conversationsTable.unused_subject,
      subject: conversationsTable.subject,
    })
    .from(conversationsTable)
    .where(
      and(
        isNotNull(conversationsTable.unused_subject),
        isNull(conversationsTable.subject)
      )
    );

  for (const conversation of conversationsToMigrate) {
    try {
      if (conversation.unused_subject) {
        const decryptedSubject = decryptFieldValue(conversation.unused_subject);
        
        await db
          .update(conversationsTable)
          .set({ subject: decryptedSubject })
          .where(eq(conversationsTable.id, conversation.id));
          
        processed++;
      }
    } catch (error) {
      console.error(`Failed to migrate conversation ${conversation.id}:`, error);
      errors++;
    }
  }

  console.log(`✅ Conversations migration complete: ${processed} processed, ${errors} errors`);
};

const migrateTools = async () => {
  console.log("🔄 Migrating tools...");
  let processed = 0;
  let errors = 0;

  const toolsToMigrate = await db
    .select({
      id: toolsTable.id,
      unused_authenticationToken: toolsTable.unused_authenticationToken,
      authenticationToken: toolsTable.authenticationToken,
    })
    .from(toolsTable)
    .where(
      and(
        isNotNull(toolsTable.unused_authenticationToken),
        isNull(toolsTable.authenticationToken)
      )
    );

  for (const tool of toolsToMigrate) {
    try {
      if (tool.unused_authenticationToken) {
        const decryptedToken = decryptFieldValue(tool.unused_authenticationToken);
        
        await db
          .update(toolsTable)
          .set({ authenticationToken: decryptedToken })
          .where(eq(toolsTable.id, tool.id));
          
        processed++;
      }
    } catch (error) {
      console.error(`Failed to migrate tool ${tool.id}:`, error);
      errors++;
    }
  }

  console.log(`✅ Tools migration complete: ${processed} processed, ${errors} errors`);
};

const migrateToolApis = async () => {
  console.log("🔄 Migrating tool APIs...");
  let processed = 0;
  let errors = 0;

  const toolApisToMigrate = await db
    .select({
      id: toolApisTable.id,
      unused_authenticationToken: toolApisTable.unused_authenticationToken,
      authenticationToken: toolApisTable.authenticationToken,
    })
    .from(toolApisTable)
    .where(
      and(
        isNotNull(toolApisTable.unused_authenticationToken),
        isNull(toolApisTable.authenticationToken)
      )
    );

  for (const toolApi of toolApisToMigrate) {
    try {
      if (toolApi.unused_authenticationToken) {
        const decryptedToken = decryptFieldValue(toolApi.unused_authenticationToken);
        
        await db
          .update(toolApisTable)
          .set({ authenticationToken: decryptedToken })
          .where(eq(toolApisTable.id, toolApi.id));
          
        processed++;
      }
    } catch (error) {
      console.error(`Failed to migrate tool API ${toolApi.id}:`, error);
      errors++;
    }
  }

  console.log(`✅ Tool APIs migration complete: ${processed} processed, ${errors} errors`);
};

const migrateGmailSupportEmails = async () => {
  console.log("🔄 Migrating Gmail support emails...");
  let processed = 0;
  let errors = 0;

  const emailsToMigrate = await db
    .select({
      id: gmailSupportEmailsTable.id,
      unused_accessToken: gmailSupportEmailsTable.unused_accessToken,
      accessToken: gmailSupportEmailsTable.accessToken,
      unused_refreshToken: gmailSupportEmailsTable.unused_refreshToken,
      refreshToken: gmailSupportEmailsTable.refreshToken,
    })
    .from(gmailSupportEmailsTable)
    .where(
      and(
        or(
          and(isNotNull(gmailSupportEmailsTable.unused_accessToken), isNull(gmailSupportEmailsTable.accessToken)),
          and(isNotNull(gmailSupportEmailsTable.unused_refreshToken), isNull(gmailSupportEmailsTable.refreshToken))
        )
      )
    );

  for (const email of emailsToMigrate) {
    try {
      const updates: Partial<typeof gmailSupportEmailsTable.$inferInsert> = {};
      
      // Migrate access token if needed
      if (email.unused_accessToken && !email.accessToken) {
        updates.accessToken = decryptFieldValue(email.unused_accessToken);
      }
      
      // Migrate refresh token if needed
      if (email.unused_refreshToken && !email.refreshToken) {
        updates.refreshToken = decryptFieldValue(email.unused_refreshToken);
      }
      
      if (Object.keys(updates).length > 0) {
        await db
          .update(gmailSupportEmailsTable)
          .set(updates)
          .where(eq(gmailSupportEmailsTable.id, email.id));
      }
      
      processed++;
    } catch (error) {
      console.error(`Failed to migrate Gmail support email ${email.id}:`, error);
      errors++;
    }
  }

  console.log(`✅ Gmail support emails migration complete: ${processed} processed, ${errors} errors`);
};

// CLI entry point
if (process.argv[1] === new URL(import.meta.url).pathname) {
  migrateEncryptedToPlaintext()
    .then(() => {
      console.log("Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}
