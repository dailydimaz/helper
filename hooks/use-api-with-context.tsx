"use client";
import { useApp } from "./use-app";
import { useApi, useOptimizedApi, useRealTimeApi } from "./use-api";

/**
 * Wrapper hooks that provide basePath from app context for backward compatibility
 */
export const useApiWithContext = () => {
  const { basePath } = useApp();
  return useApi(basePath);
};

export const useOptimizedApiWithContext = () => {
  const { basePath } = useApp();
  return useOptimizedApi(basePath);
};

export const useRealTimeApiWithContext = () => {
  const { basePath } = useApp();
  return useRealTimeApi(basePath);
};