import { NextRequest } from "next/server";
import { z } from "zod";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest, validateQueryParams } from "@/lib/api";
import { createGitHubClient } from "@/lib/github/client";

const createIssueSchema = z.object({
  conversationSlug: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  labels: z.array(z.string()).optional(),
});

const linkIssueSchema = z.object({
  conversationSlug: z.string().min(1),
  issueNumber: z.number().int().positive(),
});

const listIssuesSchema = z.object({
  state: z.enum(["open", "closed", "all"]).default("open"),
  labels: z.string().optional(),
});

// GET /api/mailbox/conversations/github/issues - List repository issues
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    if (!mailbox.githubInstallationId || !mailbox.githubRepoOwner || !mailbox.githubRepoName) {
      return apiError("GitHub integration not configured", 400);
    }

    const validation = validateQueryParams(request, listIssuesSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { state, labels } = validation.data;

    try {
      const github = createGitHubClient(mailbox.githubInstallationId);
      
      const { data: issues } = await github.rest.issues.listForRepo({
        owner: mailbox.githubRepoOwner,
        repo: mailbox.githubRepoName,
        state,
        labels: labels ? labels.split(",") : undefined,
        per_page: 50,
        sort: "updated",
        direction: "desc",
      });

      const formattedIssues = issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        url: issue.html_url,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        labels: issue.labels.map(label => typeof label === "string" ? label : label.name),
        assignees: issue.assignees?.map(assignee => ({
          login: assignee.login,
          avatar_url: assignee.avatar_url,
        })),
      }));

      return apiSuccess({ data: formattedIssues });
    } catch (githubError) {
      console.error("GitHub API error:", githubError);
      return apiError("Failed to fetch GitHub issues", 500);
    }
  } catch (error) {
    console.error("List GitHub issues error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to list GitHub issues", 500);
  }
}

// POST /api/mailbox/conversations/github/issues - Create GitHub issue
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    if (!mailbox.githubInstallationId || !mailbox.githubRepoOwner || !mailbox.githubRepoName) {
      return apiError("GitHub integration not configured", 400);
    }

    const validation = await validateRequest(request, createIssueSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { conversationSlug, title, body, labels } = validation.data;

    try {
      const github = createGitHubClient(mailbox.githubInstallationId);
      
      const { data: issue } = await github.rest.issues.create({
        owner: mailbox.githubRepoOwner,
        repo: mailbox.githubRepoName,
        title,
        body,
        labels,
      });

      // TODO: Update conversation with GitHub issue info
      // await updateConversationGithubIssue(conversationSlug, issue.number, issue.html_url);

      return apiSuccess({ 
        data: {
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
        },
        message: "GitHub issue created successfully"
      });
    } catch (githubError) {
      console.error("GitHub API error:", githubError);
      return apiError("Failed to create GitHub issue", 500);
    }
  } catch (error) {
    console.error("Create GitHub issue error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to create GitHub issue", 500);
  }
}

export const { GET: handleGET, POST: handlePOST } = createMethodHandler({ GET, POST });
export { handleGET as GET, handlePOST as POST };