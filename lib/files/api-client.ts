/**
 * Client-side utility functions for file operations
 */

export interface FileUploadResult {
  file: {
    id: number;
    slug: string;
    name: string;
    key: string;
    mimetype: string;
    size: number;
    isInline: boolean;
    isPublic: boolean;
  };
  uploadToken: string;
  uploadUrl: string;
  isPublic: boolean;
}

export interface FileUrlResult {
  url: string;
}

/**
 * Initiates a file upload and returns upload details
 */
export const initiateFileUpload = async (
  conversationSlug: string,
  file: {
    fileName: string;
    fileSize: number;
    isInline?: boolean;
  }
): Promise<FileUploadResult> => {
  const response = await fetch("/api/files/initiate-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationSlug,
      file,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Initiate upload failed with status ${response.status}`);
  }

  return response.json();
};

/**
 * Uploads a file using the upload token and URL
 */
export const uploadFile = async (
  uploadUrl: string,
  uploadToken: string,
  file: File
): Promise<void> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
    headers: {
      "Authorization": `Bearer ${uploadToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
  }
};

/**
 * Gets a URL for accessing a file
 */
export const getFileUrl = async (slug: string): Promise<string> => {
  const response = await fetch(`/api/files/url/${slug}`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to get file URL with status ${response.status}`);
  }

  const data: FileUrlResult = await response.json();
  return data.url;
};

/**
 * Deletes a file
 */
export const deleteFile = async (slug: string): Promise<void> => {
  const response = await fetch(`/api/files/delete/${slug}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete file with status ${response.status}`);
  }
};

/**
 * Complete file upload workflow
 */
export const uploadFileComplete = async (
  conversationSlug: string,
  file: File,
  isInline = false
): Promise<{
  slug: string;
  url: string;
  isPublic: boolean;
}> => {
  // Initiate upload
  const initResult = await initiateFileUpload(conversationSlug, {
    fileName: file.name,
    fileSize: file.size,
    isInline,
  });

  // Upload the file
  await uploadFile(initResult.uploadUrl, initResult.uploadToken, file);

  // Get the URL
  let url: string;
  if (initResult.isPublic) {
    url = `/api/files/public/${encodeURIComponent(initResult.file.key)}`;
  } else {
    url = await getFileUrl(initResult.file.slug);
  }

  return {
    slug: initResult.file.slug,
    url,
    isPublic: initResult.isPublic,
  };
};