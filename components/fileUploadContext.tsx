import React, { createContext, useContext, useState } from "react";
import { assertDefined } from "@/components/utils/assert";
import { captureExceptionAndLog } from "@/lib/shared/sentry";

export enum UploadStatus {
  UPLOADING = "uploading",
  UPLOADED = "uploaded",
  FAILED = "failed",
}

export type UnsavedFileInfo = {
  file: File;
  blobUrl: string;
  status: UploadStatus;
  url: string | null;
  slug: string | null;
  inline: boolean;
};
type OnUpload = { upload: Promise<UnsavedFileInfo>; blobUrl: string };

const TOTAL_FILE_SIZE_LIMIT = 26210000; // 25MiB in bytes (the limit imposed by Gmail)

const FileUploadContext = createContext<{
  unsavedFiles: UnsavedFileInfo[];
  readyFiles: UnsavedFileInfo[];
  failedAttachmentsExist: boolean;
  uploading: boolean;
  hasReadyFileAttachments: boolean;
  onUpload: (file: File, { inline }: { inline: boolean }) => OnUpload;
  onDelete: (file: File) => void;
  onRetry: (file: File) => OnUpload;
  resetFiles: (files: UnsavedFileInfo[]) => void;
} | null>(null);

const generateUnsavedFileInfo = (file: File, inline: boolean): UnsavedFileInfo => ({
  file,
  inline,
  status: UploadStatus.UPLOADING,
  blobUrl: URL.createObjectURL(file),
  url: null,
  slug: null,
});

export const FileUploadProvider = ({
  conversationSlug,
  children,
}: {
  // `conversationSlug` is required for file uploads, but it's marked as optional
  // so that other usages of the editor can be wrapped in this component,
  // which allows FileUploadContext be non-nullable.
  conversationSlug?: string | null;
  children: React.ReactNode;
}) => {
  const [unsavedFiles, setUnsavedFiles] = useState<UnsavedFileInfo[]>([]);
  const resetFiles = (files: UnsavedFileInfo[]) => {
    for (const file of unsavedFiles) URL.revokeObjectURL(file.blobUrl);
    setUnsavedFiles(files.map((f) => ({ ...f, blobUrl: URL.createObjectURL(f.file) })));
  };

  const onRetry = (file: File): OnUpload => {
    const updatedFileInfo: UnsavedFileInfo = {
      ...assertDefined(unsavedFiles.find((f) => f.file === file)),
      status: UploadStatus.UPLOADING,
    };
    setUnsavedFiles((prevFiles) => prevFiles.map((f) => (f.file === updatedFileInfo.file ? updatedFileInfo : f)));
    return performUpload(updatedFileInfo);
  };
  const onDelete = (file: File): void => {
    setUnsavedFiles((prevFiles) =>
      prevFiles.flatMap((f) => {
        if (f.file === file) {
          URL.revokeObjectURL(f.blobUrl);
          return [];
        }
        return [f];
      }),
    );
  };
  const onUpload = (file: File, { inline }: { inline: boolean }): OnUpload => {
    const unsavedFileInfo = generateUnsavedFileInfo(file, inline);
    setUnsavedFiles((prevFiles) => [...prevFiles, unsavedFileInfo]);
    return performUpload(unsavedFileInfo);
  };
  const performUpload = (unsavedFileInfo: UnsavedFileInfo): OnUpload => {
    const totalFileSize = unsavedFiles
      .filter(
        (f) =>
          (f.status === UploadStatus.UPLOADING || f.status === UploadStatus.UPLOADED) &&
          !f.inline &&
          f.file !== unsavedFileInfo.file,
      )
      .reduce((acc, f) => acc + f.file.size, 0);
    const upload = new Promise<UnsavedFileInfo>(async (resolve, reject) => {
      try {
        if (totalFileSize + unsavedFileInfo.file.size > TOTAL_FILE_SIZE_LIMIT)
          throw new Error("Attachments cannot exceed 25MB in total");
        // Spread out uploads to avoid initiating many uploads all at once
        await new Promise((resolve) =>
          setTimeout(resolve, (unsavedFiles.filter((f) => f.status === UploadStatus.UPLOADING).length + 1) * 200),
        );
        
        // Initiate upload through API
        const initiateResponse = await fetch("/api/files/initiate-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationSlug: assertDefined(conversationSlug, "Conversation ID must be provided"),
            file: {
              fileName: unsavedFileInfo.file.name,
              fileSize: unsavedFileInfo.file.size,
              isInline: unsavedFileInfo.inline,
            },
          }),
        });

        if (!initiateResponse.ok) {
          const errorData = await initiateResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Initiate upload failed with status ${initiateResponse.status}`);
        }

        const { file, uploadToken, uploadUrl, isPublic } = await initiateResponse.json();
        
        // Upload file to our API endpoint
        const formData = new FormData();
        formData.append("file", unsavedFileInfo.file);
        
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
          headers: {
            "Authorization": `Bearer ${uploadToken}`,
          },
        });
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed with status ${uploadResponse.status}`);
        }

        let url;
        if (isPublic) {
          url = `/api/files/public/${encodeURIComponent(file.key)}`;
        } else {
          // Get signed URL for private files
          const urlResponse = await fetch(`/api/files/url/${file.slug}`, {
            method: "GET",
          });
          
          if (!urlResponse.ok) {
            const errorData = await urlResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to get file URL with status ${urlResponse.status}`);
          }
          
          const urlData = await urlResponse.json();
          url = urlData.url;
        }

        const updatedFile: UnsavedFileInfo = {
          slug: file.slug,
          url,
          status: UploadStatus.UPLOADED,
          file: unsavedFileInfo.file,
          blobUrl: unsavedFileInfo.blobUrl,
          inline: unsavedFileInfo.inline,
        };
        setUnsavedFiles((prevFiles) => prevFiles.map((f) => (f.file === unsavedFileInfo.file ? updatedFile : f)));
        resolve(updatedFile);
      } catch (e) {
        setUnsavedFiles((prevFiles) =>
          prevFiles.map((f) => (f.file === unsavedFileInfo.file ? { ...f, status: UploadStatus.FAILED } : f)),
        );
        if (e instanceof Error && e.message) {
          captureExceptionAndLog(e);
          reject(e.message);
        } else reject(null);
      }
    });

    return { upload, blobUrl: unsavedFileInfo.blobUrl };
  };

  const uploading = unsavedFiles.filter((f) => f.status === UploadStatus.UPLOADING).length > 0;
  const failedAttachmentsExist = unsavedFiles.filter((f) => !f.inline && f.status === UploadStatus.FAILED).length > 0;
  const readyFiles = unsavedFiles.flatMap((f) => (f.status === UploadStatus.UPLOADED ? [f] : []));
  const hasReadyFileAttachments =
    unsavedFiles.filter((f) => !f.inline && f.status === UploadStatus.UPLOADED).length > 0;

  return (
    <FileUploadContext.Provider
      value={{
        unsavedFiles,
        readyFiles,
        failedAttachmentsExist,
        uploading,
        hasReadyFileAttachments,
        onUpload,
        resetFiles,
        onDelete,
        onRetry,
      }}
    >
      {children}
    </FileUploadContext.Provider>
  );
};

export const useFileUpload = () =>
  assertDefined(useContext(FileUploadContext), "Make sure FileUploadProvider is used.");
