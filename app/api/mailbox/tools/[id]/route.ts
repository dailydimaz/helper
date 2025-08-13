import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { toolsTable } from "@/db/schema/tools";

const updateToolSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.any()).optional(),
});

// GET /api/mailbox/tools/[id] - Get tool by ID
async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const toolId = parseInt(id);
    
    if (isNaN(toolId)) {
      return apiError("Invalid tool ID", 400);
    }

    const [tool] = await db
      .select()
      .from(toolsTable)
      .where(and(
        eq(toolsTable.id, toolId),
        eq(toolsTable.unused_mailboxId, mailbox.id)
      ));

    if (!tool) {
      return apiError("Tool not found", 404);
    }

    return apiSuccess({ data: tool });
  } catch (error) {
    console.error("Get tool error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get tool", 500);
  }
}

// PATCH /api/mailbox/tools/[id] - Update tool
async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const toolId = parseInt(id);
    
    if (isNaN(toolId)) {
      return apiError("Invalid tool ID", 400);
    }

    const validation = await validateRequest(request, updateToolSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;

    const [updatedTool] = await db
      .update(toolsTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(
        eq(toolsTable.id, toolId),
        eq(toolsTable.unused_mailboxId, mailbox.id)
      ))
      .returning();

    if (!updatedTool) {
      return apiError("Tool not found", 404);
    }

    return apiSuccess({ data: updatedTool });
  } catch (error) {
    console.error("Update tool error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to update tool", 500);
  }
}

export const { GET: handleGET, PATCH: handlePATCH } = createMethodHandler({ GET, PATCH });
export { handleGET as GET, handlePATCH as PATCH };