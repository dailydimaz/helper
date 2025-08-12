import z from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
});

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
  displayName: z.string().optional(),
});

// User management schemas
export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
  displayName: z.string().min(1).max(255).optional(),
  permissions: z.enum(['member', 'admin']).default('member'),
});

export const updateUserSchema = createUserSchema.partial();

// Conversation schemas
export const createConversationSchema = z.object({
  conversation: z.object({
    to_email_address: z.string().email(),
    subject: z.string(),
    cc: z.array(z.string().email()),
    bcc: z.array(z.string().email()),
    message: z.string().optional(),
    file_slugs: z.array(z.string()),
    conversation_slug: z.string(),
  }),
});

export const updateConversationSchema = z.object({
  status: z.enum(["open", "closed", "spam"]).optional(),
  assignedToId: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  assignedToAI: z.boolean().optional(),
});

export const bulkUpdateConversationsSchema = z.object({
  conversationFilter: z.union([z.array(z.number()), z.object({})]), // Simplified for now
  status: z.enum(["open", "closed", "spam"]).optional(),
  assignedToId: z.string().optional(),
  assignedToAI: z.boolean().optional(),
  message: z.string().optional(),
});

// Saved Replies schemas
export const createSavedReplySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  content: z.string().min(1).trim(),
});

export const updateSavedReplySchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  content: z.string().min(1).trim().optional(),
  isActive: z.boolean().optional(),
});

// Query schemas
export const conversationSearchSchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  perPage: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10),
  q: z.string().optional(),
  status: z.array(z.enum(["open", "closed", "spam"])).optional(),
  assignee: z.array(z.string()).optional(),
  sort: z.enum(["newest", "oldest", "highest_value"]).optional(),
});

export const savedRepliesSearchSchema = z.object({
  onlyActive: z.string().optional().transform((val) => val !== "false"),
  search: z.string().optional(),
});

// Message schemas
export const createMessageSchema = z.object({
  body: z.string().min(1).max(10000),
  subject: z.string().max(255).optional(),
  toEmail: z.string().email(),
  conversationId: z.number().int().positive(),
  fromName: z.string().max(255).optional(),
});

export const updateMessageSchema = z.object({
  body: z.string().min(1).max(10000).optional(),
  subject: z.string().max(255).optional(),
});

export const messageSearchSchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  perPage: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10),
  q: z.string().optional(),
  conversationId: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  countOnly: z.string().optional().transform((val) => val === "true"),
});

// Issue Group schemas
export const createIssueGroupSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  keywords: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  isActive: z.boolean().default(true),
});

export const updateIssueGroupSchema = createIssueGroupSchema.partial();