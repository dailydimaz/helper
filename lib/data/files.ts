import { eq } from "drizzle-orm";
import { chunk } from "lodash-es";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { db, Transaction } from "@/db/client";
import { files } from "@/db/schema";
import { triggerEvent } from "@/jobs/trigger";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { storeFile, retrieveFile, deleteFiles as deleteStorageFiles, generateStoragePath, initializeStorage } from "@/lib/files/storage";
import { createSignedUrl, sanitizeContentType } from "@/lib/files/security";
import { env } from "@/lib/env";

// Storage paths for organizing files
export const ATTACHMENTS_PATH = "attachments";
export const PREVIEWS_PATH = "previews";
export const INLINE_PATH = "inline";

const MAX_KEYS_PER_DELETE = 1000;

export const getFileUrl = async (file: typeof files.$inferSelect, { preview = false }: { preview?: boolean } = {}) => {
  const key = preview ? file.previewKey : file.key;

  if (!key) throw new Error(`File ${file.id} has no ${preview ? "preview key" : "key"}`);

  try {
    if (file.isPublic) {
      // For public files, return direct URL to our file serving endpoint
      return `${env.NEXTAUTH_URL}/api/files/public/${encodeURIComponent(key)}`;
    }

    // For private files, create a signed URL
    const token = await createSignedUrl({
      fileId: file.id,
      slug: file.slug,
      isPublic: file.isPublic,
      purpose: preview ? "preview" : "download"
    }, {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      purpose: preview ? "preview" : "download"
    });
    
    return `${env.NEXTAUTH_URL}/api/files/${file.slug}?token=${token}`;
  } catch (e) {
    captureExceptionAndLog(e);
    return null;
  }
};

export const formatAttachments = async (attachments: (typeof files.$inferSelect)[]) => {
  return (
    await Promise.all(
      attachments.map(async (attachment) => {
        const url = await getFileUrl(attachment);
        return url
          ? [
              {
                name: attachment.name,
                url,
                contentType: attachment.mimetype,
              },
            ]
          : [];
      }),
    )
  ).flat();
};

export const downloadFile = async (file: typeof files.$inferSelect) => {
  try {
    const data = await retrieveFile(file.key, { isPublic: file.isPublic });
    return data;
  } catch (error) {
    throw new Error(`Failed to download file: ${file.key} (${(error as Error).message})`);
  }
};

export const uploadFile = async (
  key: string,
  data: Buffer,
  { mimetype, isPublic = false }: { mimetype?: string; isPublic?: boolean } = {},
) => {
  const storedFile = await storeFile(key, data, { mimetype, isPublic });
  return storedFile.path;
};

export const generateKey = (basePathParts: string[], fileName: string) => {
  return generateStoragePath(basePathParts, fileName);
};

export const finishFileUpload = async (
  {
    fileSlugs,
    messageId,
    noteId,
  }: {
    fileSlugs: string[];
    messageId?: number;
    noteId?: number;
  },
  tx: Transaction | typeof db = db,
) => {
  if (fileSlugs.length === 0) return;
  if (!messageId && !noteId) throw new Error("Either messageId or noteId must be provided");

  const fileIdsForPreview: number[] = [];

  await tx.transaction(async (tx) => {
    for (const slug of fileSlugs) {
      const file = await tx.query.files.findFirst({
        where: (files, { eq, isNull }) => eq(files.slug, slug) && isNull(files.messageId) && isNull(files.noteId),
      });

      if (!file) continue;

      await tx
        .update(files)
        .set(messageId ? { messageId } : { noteId })
        .where(eq(files.slug, slug))
        .execute();

      if (!file.isInline) fileIdsForPreview.push(file.id);
    }
  });

  if (fileIdsForPreview.length > 0) {
    await Promise.all(fileIdsForPreview.map((fileId) => triggerEvent("files/preview.generate", { fileId })));
  }
};

export const createAndUploadFile = async ({
  data,
  fileName,
  prefix,
  mimetype = "image/png",
  isInline = false,
  messageId,
  noteId,
}: {
  data: Buffer;
  fileName: string;
  prefix: string;
  mimetype?: string;
  isInline?: boolean;
  messageId?: number;
  noteId?: number;
}) => {
  // Initialize storage if needed
  await initializeStorage();
  
  const key = generateKey([prefix], fileName);
  const storedFile = await storeFile(key, data, {
    mimetype: sanitizeContentType(mimetype),
    isPublic: false,
  });

  const file = await db
    .insert(files)
    .values({
      name: fileName,
      mimetype: sanitizeContentType(mimetype),
      size: data.length,
      isInline,
      isPublic: false,
      key: storedFile.path,
      messageId,
      noteId,
    })
    .returning()
    .then(takeUniqueOrThrow);

  if (!isInline) {
    await triggerEvent("files/preview.generate", { fileId: file.id });
  }

  return file;
};

export const deleteFiles = async (keys: string[], isPublic: boolean) => {
  for (const chunkKeys of chunk(keys, MAX_KEYS_PER_DELETE)) {
    await deleteStorageFiles(chunkKeys, { isPublic });
  }
};
