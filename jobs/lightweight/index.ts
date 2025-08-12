// Lightweight job handlers for the simplified queue system
import { generateFilePreview } from "./generateFilePreview";
import { embeddingFaq } from "./embeddingFaq";
import { postEmailToGmail } from "./postEmailToGmail";
import { handleAutoResponse } from "./handleAutoResponse";

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
  cleanupDanglingFiles,
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

  // Scheduled/cron jobs
  bulkEmbeddingClosedConversations,
  cleanupDanglingFiles,
  checkAssignedTicketResponseTimes,
  checkVipResponseTimes,
  renewMailboxWatches,
  scheduledWebsiteCrawl,
  generateDailyReports,
  generateWeeklyReports,
} as const;

export type JobType = keyof typeof lightweightJobs;