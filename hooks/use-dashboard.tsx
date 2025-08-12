"use client";
import { useMemo } from "react";
import useSWR from "swr";
import { useApi } from "./use-api";

export function useDashboardStats(period: string, customStartDate?: Date, customEndDate?: Date) {
  const url = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (customStartDate) params.set("customStartDate", customStartDate.toISOString());
    if (customEndDate) params.set("customEndDate", customEndDate.toISOString());
    return `/dashboard/stats?${params.toString()}`;
  }, [period, customStartDate, customEndDate]);

  const { data, error, isLoading, mutate } = useSWR(url);

  return {
    stats: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useDashboardReactions(period: string, customStartDate?: Date, customEndDate?: Date) {
  const url = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (customStartDate) params.set("customStartDate", customStartDate.toISOString());
    if (customEndDate) params.set("customEndDate", customEndDate.toISOString());
    return `/dashboard/reactions?${params.toString()}`;
  }, [period, customStartDate, customEndDate]);

  const { data, error, isLoading, mutate } = useSWR(url);

  return {
    reactions: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useDashboardStatusByType(period: string, customStartDate?: Date, customEndDate?: Date) {
  const url = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (customStartDate) params.set("customStartDate", customStartDate.toISOString());
    if (customEndDate) params.set("customEndDate", customEndDate.toISOString());
    return `/dashboard/status-by-type?${params.toString()}`;
  }, [period, customStartDate, customEndDate]);

  const { data, error, isLoading, mutate } = useSWR(url);

  return {
    statusData: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useDashboardAlerts() {
  const { data, error, isLoading, mutate } = useSWR("/dashboard/alerts");

  return {
    alerts: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useRealtimeEvents() {
  const { data, error, isLoading, mutate } = useSWR("/dashboard/events", {
    refreshInterval: 5000, // Poll every 5 seconds for real-time data
  });

  return {
    events: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}