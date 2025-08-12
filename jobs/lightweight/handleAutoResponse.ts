import { and, eq, gt, inArray } from "drizzle-orm";
import type { ToolRequestBody } from "@helperai/client";
import { db } from "@/db/client";
import { conversationMessages, conversations } from "@/db/schema";
import { checkTokenCountAndSummarizeIfNeeded, generateDraftResponse, respondWithAI } from "@/lib/ai/chat";
import { cleanUpTextForAI } from "@/lib/ai/core";
import { updateConversation } from "@/lib/data/conversation";
import { ensureCleanedUpText, getTextWithConversationSubject } from "@/lib/data/conversationMessage";
import { getMailbox } from "@/lib/data/mailbox";
import { createMessageNotification } from "@/lib/data/messageNotifications";
import { upsertPlatformCustomer } from "@/lib/data/platformCustomer";
import { fetchMetadata } from "@/lib/data/retrieval";

export const handleAutoResponse = async (payload: {
  messageId: number;
  tools?: Record<string, ToolRequestBody>;
}) => {
  const { messageId, tools } = payload;
  
  const message = await db.query.conversationMessages.findFirst({
    where: eq(conversationMessages.id, messageId),
  });

  if (!message) {
    throw new Error(`Message ${messageId} not found`);
  }

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, message.conversationId),
  });

  if (!conversation) {
    throw new Error(`Conversation ${message.conversationId} not found`);
  }

  if (conversation.status === "spam") {
    console.log("Skipped - conversation is spam");
    return;
  }
  
  if (message.role === "staff") {
    console.log("Skipped - message is from staff");
    return;
  }

  const newerMessage = await db.query.conversationMessages.findFirst({
    columns: { id: true },
    where: and(
      eq(conversationMessages.conversationId, message.conversationId),
      inArray(conversationMessages.role, ["user", "staff", "ai_assistant"]),
      gt(conversationMessages.createdAt, message.createdAt),
    ),
  });

  if (newerMessage) {
    console.log("Skipped - newer message exists");
    return;
  }

  await ensureCleanedUpText(message);

  const customerMetadata = message.emailFrom ? await fetchMetadata(message.emailFrom) : null;
  if (customerMetadata) {
    await db
      .update(conversationMessages)
      .set({ metadata: customerMetadata ?? null })
      .where(eq(conversationMessages.id, messageId));

    if (message.emailFrom) {
      await upsertPlatformCustomer({
        email: message.emailFrom,
        customerMetadata: customerMetadata.metadata,
      });
    }
  }

  const mailbox = await getMailbox();
  if (!mailbox) {
    console.log("Skipped - mailbox not found");
    return;
  }

  if (!conversation.assignedToAI) {
    console.log("Skipped - not assigned to AI");
    return;
  }

  if (mailbox?.preferences?.autoRespondEmailToChat === "draft") {
    const aiDraft = await generateDraftResponse(conversation.id, mailbox, tools);
    console.log(`Draft response generated with ID: ${aiDraft.id}`);
    return;
  }

  const emailText = (await getTextWithConversationSubject(conversation, message)).trim();
  if (emailText.length === 0) {
    console.log("Skipped - email text is empty");
    return;
  }

  const messageText = cleanUpTextForAI(
    [conversation.subject ?? "", message.cleanedUpText ?? message.body ?? ""].join("\n\n"),
  );
  const processedText = await checkTokenCountAndSummarizeIfNeeded(messageText);

  const response = await respondWithAI({
    conversation,
    mailbox,
    tools,
    userEmail: message.emailFrom,
    message: {
      id: message.id.toString(),
      content: processedText,
      role: "user",
    },
    messageId: message.id,
    readPageTool: null,
    sendEmail: true,
    guideEnabled: false,
    reasoningEnabled: false,
    onResponse: async ({ platformCustomer, humanSupportRequested }) => {
      await db.transaction(async (tx) => {
        if (platformCustomer && !humanSupportRequested) {
          await createMessageNotification({
            messageId: message.id,
            conversationId: message.conversationId,
            platformCustomerId: platformCustomer.id,
            notificationText: `You have a new reply for ${conversation.subject ?? "(no subject)"}`,
            tx,
          });
        }

        if (!humanSupportRequested) {
          await updateConversation(
            message.conversationId,
            { set: { conversationProvider: "chat", status: "closed" } },
            tx,
          );
        }
      });
    },
  });

  // Consume the response to make sure we wait for the AI to generate it
  const reader = response.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    let responseContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        responseContent += chunk;
      }
    }

    console.log(`Auto response sent for message ${messageId}`);
  }
};