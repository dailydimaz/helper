// Lightweight job handlers for the simplified queue system
import { generateFilePreview } from "./generateFilePreview";
import { embeddingFaq } from "./embeddingFaq";
import { postEmailToGmail } from "./postEmailToGmail";
import { handleAutoResponse } from "./handleAutoResponse";

// Import new job implementations
import { processEmailQueue, cleanupFailedEmails } from "./emailProcessing";
import { cleanupDanglingFiles as realCleanupDanglingFiles, cleanupOldJobs, performDatabaseMaintenance } from "./systemMaintenance";
import { sendPendingNotifications, cleanupOldNotifications, sendDigestNotifications } from "./notifications";

// Import stubs for remaining jobs
import {
  embeddingConversation,
  indexConversationMessage,
  generateConversationSummaryEmbeddings,
  mergeSimilarConversations,
  publishNewMessageEvent,
  notifyVipMessage,
  updateSuggestedActions,
  handleGmailWebhookEvent,
  importRecentGmailThreads,
  importGmailThreads,
  generateMailboxWeeklyReport,
  generateMailboxDailyReport,
  crawlWebsite,
  suggestKnowledgeBankChanges,
  closeInactiveConversations,
  closeInactiveConversationsForMailbox,
  autoAssignConversation,
  categorizeConversationToIssueGroup,
  publishRequestHumanSupport,
  handleSlackAgentMessage,
  bulkUpdateConversations,
  renewMailboxWatches,
  bulkEmbeddingClosedConversations,
  checkAssignedTicketResponseTimes,
  checkVipResponseTimes,
  generateDailyReports,
  generateWeeklyReports,
  scheduledWebsiteCrawl,
} from "./_stubs";

export const lightweightJobs = {
  // Event-triggered jobs
  generateFilePreview,
  embeddingConversation,
  indexConversationMessage,
  generateConversationSummaryEmbeddings,
  mergeSimilarConversations,
  publishNewMessageEvent,
  notifyVipMessage,
  postEmailToGmail,
  handleAutoResponse,
  bulkUpdateConversations,
  updateSuggestedActions,
  handleGmailWebhookEvent,
  embeddingFaq,
  importRecentGmailThreads,
  importGmailThreads,
  generateMailboxWeeklyReport,
  generateMailboxDailyReport,
  crawlWebsite,
  suggestKnowledgeBankChanges,
  closeInactiveConversations,
  closeInactiveConversationsForMailbox,
  autoAssignConversation,
  categorizeConversationToIssueGroup,
  publishRequestHumanSupport,
  handleSlackAgentMessage,

  // Email processing jobs
  processEmailQueue,
  cleanupFailedEmails,

  // Notification jobs
  sendPendingNotifications,
  cleanupOldNotifications,
  sendDigestNotifications,

  // System maintenance jobs
  cleanupDanglingFiles: realCleanupDanglingFiles,
  cleanupOldJobs,
  performDatabaseMaintenance,

  // Scheduled/cron jobs
  bulkEmbeddingClosedConversations,
  checkAssignedTicketResponseTimes,
  checkVipResponseTimes,
  renewMailboxWatches,
  scheduledWebsiteCrawl,
  generateDailyReports,
  generateWeeklyReports,
} as const;

export type JobType = keyof typeof lightweightJobs;