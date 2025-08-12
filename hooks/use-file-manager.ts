import { useState, useCallback } from 'react';
import { 
  initiateFileUpload, 
  uploadFile, 
  getFileUrl, 
  deleteFile, 
  uploadFileComplete 
} from '@/lib/files/api-client';

export interface FileManagerState {
  uploading: boolean;
  error: string | null;
  uploadProgress: Record<string, number>;
}

export interface UploadedFile {
  slug: string;
  url: string;
  name: string;
  size: number;
  mimetype: string;
  isPublic: boolean;
}

/**
 * Hook for managing file operations
 */
export const useFileManager = () => {
  const [state, setState] = useState<FileManagerState>({
    uploading: false,
    error: null,
    uploadProgress: {},
  });

  const setUploading = useCallback((uploading: boolean) => {
    setState(prev => ({ ...prev, uploading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setUploadProgress = useCallback((fileKey: string, progress: number) => {
    setState(prev => ({
      ...prev,
      uploadProgress: {
        ...prev.uploadProgress,
        [fileKey]: progress,
      },
    }));
  }, []);

  const clearUploadProgress = useCallback((fileKey: string) => {
    setState(prev => ({
      ...prev,
      uploadProgress: {
        ...prev.uploadProgress,
        [fileKey]: undefined,
      },
    }));
  }, []);

  /**
   * Upload a file with progress tracking
   */
  const uploadFileWithProgress = useCallback(async (
    conversationSlug: string,
    file: File,
    isInline = false,
    onProgress?: (progress: number) => void
  ): Promise<UploadedFile> => {
    const fileKey = `${file.name}-${Date.now()}`;
    
    try {
      setUploading(true);
      setError(null);
      setUploadProgress(fileKey, 0);

      // Use the complete upload workflow
      const result = await uploadFileComplete(conversationSlug, file, isInline);

      setUploadProgress(fileKey, 100);
      onProgress?.(100);

      return {
        slug: result.slug,
        url: result.url,
        name: file.name,
        size: file.size,
        mimetype: file.type,
        isPublic: result.isPublic,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setUploading(false);
      clearUploadProgress(fileKey);
    }
  }, [setUploading, setError, setUploadProgress, clearUploadProgress]);

  /**
   * Upload multiple files
   */
  const uploadMultipleFiles = useCallback(async (
    conversationSlug: string,
    files: File[],
    isInline = false,
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<UploadedFile[]> => {
    const results: UploadedFile[] = [];
    
    try {
      setUploading(true);
      setError(null);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        const result = await uploadFileWithProgress(
          conversationSlug,
          file,
          isInline,
          (progress) => onProgress?.(i, progress)
        );
        
        results.push(result);
      }

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Multiple upload failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setUploading(false);
    }
  }, [uploadFileWithProgress, setUploading, setError]);

  /**
   * Delete a file
   */
  const removeFile = useCallback(async (slug: string): Promise<void> => {
    try {
      setError(null);
      await deleteFile(slug);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [setError]);

  /**
   * Get file URL
   */
  const getFileUrlAsync = useCallback(async (slug: string): Promise<string> => {
    try {
      setError(null);
      return await getFileUrl(slug);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get file URL';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [setError]);

  /**
   * Clear any errors
   */
  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    // State
    uploading: state.uploading,
    error: state.error,
    uploadProgress: state.uploadProgress,
    
    // Actions
    uploadFile: uploadFileWithProgress,
    uploadMultipleFiles,
    removeFile,
    getFileUrl: getFileUrlAsync,
    clearError,
  };
};