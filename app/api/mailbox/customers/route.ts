import { NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq, like, or } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateQueryParams } from "@/lib/api";
import { db } from "@/db/client";
import { platformCustomersTable } from "@/db/schema/platformCustomers";

const listCustomersSchema = z.object({
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

// GET /api/mailbox/customers - List customers
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = validateQueryParams(request, listCustomersSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { search, limit, offset } = validation.data;

    let whereConditions = [];

    if (search) {
      whereConditions.push(
        or(
          like(platformCustomersTable.email, `%${search}%`),
          like(platformCustomersTable.name, `%${search}%`)
        )
      );
    }

    const customers = await db
      .select({
        id: platformCustomersTable.id,
        email: platformCustomersTable.email,
        name: platformCustomersTable.name,
        createdAt: platformCustomersTable.createdAt,
        updatedAt: platformCustomersTable.updatedAt,
      })
      .from(platformCustomersTable)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(platformCustomersTable.updatedAt))
      .limit(limit)
      .offset(offset);

    return apiSuccess({ data: customers });
  } catch (error) {
    console.error("List customers error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to list customers", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };