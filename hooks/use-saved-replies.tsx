"use client";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useApi } from "./use-api";

export function useSavedReplies() {
  const searchParams = useSearchParams();
  
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (searchParams.get("search")) params.set("search", searchParams.get("search")!);
    if (searchParams.get("onlyActive")) params.set("onlyActive", searchParams.get("onlyActive")!);
    
    return `/saved-replies${params.toString() ? `?${params.toString()}` : ""}`;
  }, [searchParams]);

  const { data, error, isLoading, mutate } = useSWR(url);

  return {
    savedReplies: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useSavedReply(slug: string) {
  const { data, error, isLoading, mutate } = useSWR(slug ? `/saved-replies/${slug}` : null);

  return {
    savedReply: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useSavedReplyActions() {
  const { put, post, delete: deleteReq } = useApi();

  const updateSavedReply = async (slug: string, data: any) => {
    return await put(`/saved-replies/${slug}`, data);
  };

  const createSavedReply = async (data: any) => {
    return await post("/saved-replies", data);
  };

  const deleteSavedReply = async (slug: string) => {
    return await deleteReq(`/saved-replies/${slug}`);
  };

  const incrementUsage = async (slug: string) => {
    return await post(`/saved-replies/${slug}/increment-usage`);
  };

  return {
    updateSavedReply,
    createSavedReply,
    deleteSavedReply,
    incrementUsage,
  };
}