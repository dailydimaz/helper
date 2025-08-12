"use client";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useApi } from "./use-api";

export function useSessions() {
  const searchParams = useSearchParams();
  
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (searchParams.get("search")) params.set("search", searchParams.get("search")!);
    if (searchParams.get("page")) params.set("page", searchParams.get("page")!);
    
    return `/sessions${params.toString() ? `?${params.toString()}` : ""}`;
  }, [searchParams]);

  const { data, error, isLoading, mutate } = useSWR(url);

  return {
    sessions: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useSession(sessionId: string) {
  const { data, error, isLoading, mutate } = useSWR(sessionId ? `/sessions/${sessionId}` : null);

  return {
    session: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useSessionTimeline(sessionId: string) {
  const { data, error, isLoading, mutate } = useSWR(sessionId ? `/sessions/${sessionId}/timeline` : null);

  return {
    timeline: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useSessionActions() {
  const { put, delete: deleteReq } = useApi();

  const updateSession = async (sessionId: string, data: any) => {
    return await put(`/sessions/${sessionId}`, data);
  };

  const deleteSession = async (sessionId: string) => {
    return await deleteReq(`/sessions/${sessionId}`);
  };

  return {
    updateSession,
    deleteSession,
  };
}