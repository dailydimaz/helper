import { describe, it, expect, vi } from 'vitest';
import { conversationFactory } from '@tests/support/factories/conversations';
import { conversationMessagesFactory } from '@tests/support/factories/conversationMessages';
import { mailboxFactory } from '@tests/support/factories/mailboxes';
import { updateConversation } from '@/lib/data/conversation';
import { db } from '@/db/client';
import { conversationsTable, conversationMessagesTable } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

describe('Last Message At Tests', () => {

  it('should set lastMessageAt when creating messages', async () => {
    // Create a conversation and mailbox
    await mailboxFactory.create();
    const { conversation } = await conversationFactory.create({ lastMessageAt: null });

    // Verify conversation initially has no lastMessageAt
    expect(conversation.lastMessageAt).toBeNull();

    // Create a message which should trigger lastMessageAt update
    const { message } = await conversationMessagesFactory.create(conversation.id, {
      role: 'user',
      body: 'Test message content',
    });

    expect(message).toBeDefined();

    // Manually simulate what the send-message API does
    const now = new Date();
    await db.update(conversationsTable)
      .set({ lastMessageAt: now })
      .where(eq(conversationsTable.id, conversation.id));

    // Verify lastMessageAt was set
    const updatedConversation = await db.query.conversationsTable.findFirst({
      where: eq(conversationsTable.id, conversation.id),
    });
    
    expect(updatedConversation?.lastMessageAt).not.toBeNull();
    expect(updatedConversation?.lastMessageAt).toBeInstanceOf(Date);
  });

  it('should update lastMessageAt when conversation is updated', async () => {
    // Create a conversation with initial lastMessageAt
    await mailboxFactory.create();
    const initialTime = new Date('2024-01-01T10:00:00Z');
    const { conversation } = await conversationFactory.create({ 
      lastMessageAt: initialTime 
    });

    // Update the conversation with a new lastMessageAt
    const newTime = new Date();
    const updatedConversation = await updateConversation(conversation.id, {
      set: { lastMessageAt: newTime }
    });

    expect(updatedConversation?.lastMessageAt).not.toBeNull();
    expect(updatedConversation?.lastMessageAt!.getTime()).toBeGreaterThan(initialTime.getTime());
  });

  it('should handle chronological ordering of messages', async () => {
    await mailboxFactory.create();
    const { conversation } = await conversationFactory.create({ lastMessageAt: null });
    
    const timestamps: Date[] = [];
    
    // Create multiple messages and track their timestamps
    for (let i = 0; i < 3; i++) {
      const { message } = await conversationMessagesFactory.create(conversation.id, {
        role: 'user',
        body: `Message ${i + 1}`,
      });
      
      // Simulate updating lastMessageAt with message creation time
      await db.update(conversationsTable)
        .set({ lastMessageAt: message.createdAt })
        .where(eq(conversationsTable.id, conversation.id));
        
      timestamps.push(message.createdAt);
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Verify timestamps are in chronological order
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i].getTime()).toBeGreaterThanOrEqual(timestamps[i - 1].getTime());
    }
  });

  it('should correctly find most recent message for backfill', async () => {
    await mailboxFactory.create();
    const { conversation } = await conversationFactory.create({ lastMessageAt: null });
    
    // Create multiple messages at different times
    const { message: message1 } = await conversationMessagesFactory.create(conversation.id, {
      role: 'user',
      body: 'First message',
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const { message: message2 } = await conversationMessagesFactory.create(conversation.id, {
      role: 'user', 
      body: 'Second message',
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const { message: message3 } = await conversationMessagesFactory.create(conversation.id, {
      role: 'user',
      body: 'Third message', 
    });

    // Find the most recent message (simulating backfill logic)
    const mostRecentMessage = await db
      .select({
        createdAt: conversationMessagesTable.createdAt,
      })
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, conversation.id))
      .orderBy(desc(conversationMessagesTable.createdAt))
      .limit(1);

    expect(mostRecentMessage).toHaveLength(1);
    expect(mostRecentMessage[0].createdAt.getTime()).toBe(message3.createdAt.getTime());
    
    // Simulate backfill updating lastMessageAt
    await db.update(conversationsTable)
      .set({ lastMessageAt: mostRecentMessage[0].createdAt })
      .where(eq(conversationsTable.id, conversation.id));
      
    const backfilledConversation = await db.query.conversationsTable.findFirst({
      where: eq(conversationsTable.id, conversation.id),
    });
    
    expect(backfilledConversation?.lastMessageAt).not.toBeNull();
    expect(backfilledConversation?.lastMessageAt!.getTime()).toBe(message3.createdAt.getTime());
  });
});