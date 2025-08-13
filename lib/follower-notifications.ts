import { db } from "@/db/client";
import { 
  conversationFollowers, 
  followerNotifications,
  FollowerNotificationType 
} from "@/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";

interface NotificationData {
  conversationId: number;
  type: FollowerNotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  excludeUserId?: string; // Don't notify the user who triggered the action
}

export async function createFollowerNotifications({
  conversationId,
  type,
  title,
  message,
  metadata = {},
  excludeUserId,
}: NotificationData) {
  try {
    // Get all followers of the conversation
    const followersQuery = db.query.conversationFollowers.findMany({
      where: and(
        eq(conversationFollowers.conversationId, conversationId),
        excludeUserId ? ne(conversationFollowers.userId, excludeUserId) : undefined
      ),
      with: {
        user: {
          columns: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    const conversationFollowersData = await followersQuery;

    if (conversationFollowersData.length === 0) {
      return { success: true, notificationsCreated: 0 };
    }

    // Create notifications for all followers
    const notificationPromises = conversationFollowersData.map(async (follower) => {
      return db.insert(followerNotifications).values({
        followerId: follower.id,
        conversationId,
        userId: follower.userId,
        type,
        title,
        message,
        metadata,
        status: "pending",
        emailSent: false,
      });
    });

    await Promise.all(notificationPromises);

    console.log(`Created ${conversationFollowersData.length} follower notifications for conversation ${conversationId}`);
    
    return { 
      success: true, 
      notificationsCreated: conversationFollowersData.length,
      followers: conversationFollowersData 
    };
  } catch (error) {
    console.error("Error creating follower notifications:", error);
    return { success: false, error };
  }
}

// Helper functions for specific notification types
export async function notifyFollowersNewMessage(
  conversationId: number,
  messageContent: string,
  senderName?: string,
  excludeUserId?: string
) {
  return createFollowerNotifications({
    conversationId,
    type: "new_message",
    title: "New message in followed conversation",
    message: `${senderName || "Someone"} sent a new message: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? "..." : ""}`,
    metadata: { senderName, messagePreview: messageContent.substring(0, 200) },
    excludeUserId,
  });
}

export async function notifyFollowersStatusChange(
  conversationId: number,
  oldStatus: string,
  newStatus: string,
  changedByName?: string,
  excludeUserId?: string
) {
  return createFollowerNotifications({
    conversationId,
    type: "status_change",
    title: "Conversation status changed",
    message: `${changedByName || "Someone"} changed the status from "${oldStatus}" to "${newStatus}"`,
    metadata: { oldStatus, newStatus, changedByName },
    excludeUserId,
  });
}

export async function notifyFollowersAssignmentChange(
  conversationId: number,
  oldAssignee?: string,
  newAssignee?: string,
  changedByName?: string,
  excludeUserId?: string
) {
  const message = oldAssignee 
    ? `${changedByName || "Someone"} reassigned the conversation from ${oldAssignee} to ${newAssignee || "unassigned"}`
    : `${changedByName || "Someone"} assigned the conversation to ${newAssignee || "someone"}`;

  return createFollowerNotifications({
    conversationId,
    type: "assignment_change",
    title: "Conversation assignment changed",
    message,
    metadata: { oldAssignee, newAssignee, changedByName },
    excludeUserId,
  });
}

export async function notifyFollowersNewNote(
  conversationId: number,
  noteContent: string,
  authorName?: string,
  excludeUserId?: string
) {
  return createFollowerNotifications({
    conversationId,
    type: "new_note",
    title: "New note added to followed conversation",
    message: `${authorName || "Someone"} added a note: ${noteContent.substring(0, 100)}${noteContent.length > 100 ? "..." : ""}`,
    metadata: { authorName, notePreview: noteContent.substring(0, 200) },
    excludeUserId,
  });
}

// Get pending notifications for a user
export async function getPendingNotificationsForUser(userId: string) {
  return db.query.followerNotifications.findMany({
    where: and(
      eq(followerNotifications.userId, userId),
      eq(followerNotifications.status, "pending")
    ),
    with: {
      conversation: {
        columns: {
          id: true,
          slug: true,
          subject: true,
          status: true,
        },
      },
    },
    orderBy: (followerNotifications, { desc }) => [desc(followerNotifications.createdAt)],
    limit: 50,
  });
}

// Mark notifications as sent
export async function markNotificationsAsSent(notificationIds: string[]) {
  return db
    .update(followerNotifications)
    .set({
      status: "sent",
      sentAt: new Date(),
      emailSent: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(followerNotifications.status, "pending"),
        // Use IN operator for multiple IDs
        notificationIds.length > 0 
          ? inArray(followerNotifications.id, notificationIds)
          : eq(followerNotifications.id, "")
      )
    );
}