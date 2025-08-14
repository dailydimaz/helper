#!/usr/bin/env tsx

/**
 * Backfill script to populate last_message_at field for existing conversations
 * Based on the most recent message in each conversation
 */

import { db } from "@/db/client";
import { conversationsTable, conversationMessagesTable } from "@/db/schema";
import { eq, isNull, sql, desc, max } from "drizzle-orm";

interface ConversationUpdate {
  id: number;
  lastMessageAt: Date;
}

async function backfillLastMessageAt() {
  console.log("🔄 Starting backfill of last_message_at field...");

  try {
    // Find conversations that don't have last_message_at set
    const conversationsToUpdate = await db
      .select({
        id: conversationsTable.id,
        slug: conversationsTable.slug,
      })
      .from(conversationsTable)
      .where(isNull(conversationsTable.lastMessageAt))
      .limit(1000); // Process in batches to avoid memory issues

    if (conversationsToUpdate.length === 0) {
      console.log("✅ No conversations need backfilling");
      return;
    }

    console.log(`📊 Found ${conversationsToUpdate.length} conversations to update`);

    // Process conversations in smaller batches
    const batchSize = 100;
    let processedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < conversationsToUpdate.length; i += batchSize) {
      const batch = conversationsToUpdate.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(conversationsToUpdate.length / batchSize)}`);

      const updates: ConversationUpdate[] = [];

      // Find the most recent message for each conversation in this batch
      for (const conversation of batch) {
        const mostRecentMessage = await db
          .select({
            createdAt: conversationMessagesTable.createdAt,
          })
          .from(conversationMessagesTable)
          .where(eq(conversationMessagesTable.conversationId, conversation.id))
          .orderBy(desc(conversationMessagesTable.createdAt))
          .limit(1);

        if (mostRecentMessage.length > 0) {
          updates.push({
            id: conversation.id,
            lastMessageAt: mostRecentMessage[0].createdAt,
          });
        }
      }

      // Apply updates for this batch
      if (updates.length > 0) {
        for (const update of updates) {
          await db
            .update(conversationsTable)
            .set({ lastMessageAt: update.lastMessageAt })
            .where(eq(conversationsTable.id, update.id));
        }
        updatedCount += updates.length;
      }

      processedCount += batch.length;
      console.log(`✅ Processed ${processedCount}/${conversationsToUpdate.length} conversations (${updatedCount} updated)`);
    }

    console.log(`🎉 Backfill completed! Updated ${updatedCount} out of ${processedCount} conversations`);
    
    // Verify the backfill by checking some statistics
    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        withLastMessage: sql<number>`count(${conversationsTable.lastMessageAt})`,
        withoutLastMessage: sql<number>`count(*) - count(${conversationsTable.lastMessageAt})`,
      })
      .from(conversationsTable);

    console.log("\n📊 Final Statistics:");
    console.log(`Total conversations: ${stats[0].total}`);
    console.log(`With last_message_at: ${stats[0].withLastMessage}`);
    console.log(`Without last_message_at: ${stats[0].withoutLastMessage}`);

  } catch (error) {
    console.error("❌ Error during backfill:", error);
    process.exit(1);
  }
}

// Run the backfill if this script is executed directly
const isMainModule = process.argv[1]?.endsWith('backfillLastMessageAt.ts');
if (isMainModule) {
  backfillLastMessageAt()
    .then(() => {
      console.log("✅ Backfill script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Backfill script failed:", error);
      process.exit(1);
    });
}

export { backfillLastMessageAt };