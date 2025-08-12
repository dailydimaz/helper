import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import mime from "mime";
import { z } from "zod";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { db } from "@/db/client";
import { files } from "@/db/schema";
import { generateKey, getFileUrl, ATTACHMENTS_PATH, INLINE_PATH } from "@/lib/data/files";
import { createTempDownloadToken } from "@/lib/files/security";
import { initializeStorage } from "@/lib/files/storage";
import { protectedProcedure } from "@/trpc/trpc";

export const filesRouter = {
  initiateUpload: protectedProcedure
    .input(
      z.object({
        file: z.object({
          fileName: z.string(),
          fileSize: z.number(),
          isInline: z.boolean(),
        }),
        conversationSlug: z.string().min(1),
      }),
    )
    .mutation(
      async ({
        input: {
          file: { fileName, fileSize, isInline },
          // We include the conversation slug in the URL purely for debugging purposes,
          // so it shouldn't be relied on for anything else.
          // We can't authorize it since, unlike sending a reply on an existing conversation,
          // the new conversation modal conversation won't exist yet (and its slug is generated on the frontend).
          conversationSlug: unauthorizedConversationSlug,
        },
        ctx: { user },
      }) => {
        // Initialize storage
        await initializeStorage();
        
        const isPublic = isInline;
        const contentType = mime.getType(fileName) ?? "application/octet-stream";
        
        const basePath = isInline ? INLINE_PATH : ATTACHMENTS_PATH;
        const key = generateKey([basePath, unauthorizedConversationSlug], fileName);

        const fileRecord = await db
          .insert(files)
          .values({
            name: fileName,
            mimetype: contentType,
            size: fileSize,
            isInline,
            isPublic,
            key,
          })
          .returning()
          .then(takeUniqueOrThrow);

        // Create a temporary upload token
        const uploadToken = await createTempDownloadToken(fileRecord.slug, user.id, 60); // 60 minutes

        return {
          file: {
            slug: fileRecord.slug,
            name: fileRecord.name,
            key: fileRecord.key,
          },
          isPublic,
          uploadToken,
          uploadUrl: `/api/files/upload/${fileRecord.slug}`,
        };
      },
    ),
  getFileUrl: protectedProcedure.input(z.object({ slug: z.string() })).query(async ({ input: { slug } }) => {
    const file = await db.query.files.findFirst({ where: eq(files.slug, slug) });
    if (!file) throw new Error("File not found");
    return getFileUrl(file);
  }),
} satisfies TRPCRouterRecord;
