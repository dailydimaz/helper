"use client";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useApi } from "./use-api";

export function useMembers() {
  const { data, error, isLoading, mutate } = useSWR("/members");

  return {
    data: data?.data,
    members: data?.data?.members || [],
    isAdmin: data?.data?.isAdmin || false,
    isLoading,
    error,
    mutate,
  };
}

export function useMemberStats(period: string, customStartDate?: Date, customEndDate?: Date) {
  const url = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (customStartDate) params.set("customStartDate", customStartDate.toISOString());
    if (customEndDate) params.set("customEndDate", customEndDate.toISOString());
    return `/members/stats?${params.toString()}`;
  }, [period, customStartDate, customEndDate]);

  const { data, error, isLoading, mutate } = useSWR(url);

  return {
    stats: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useMemberActions() {
  const { put, delete: deleteReq } = useApi();

  const updateMember = async (data: any) => {
    return await put("/members", data);
  };

  const deleteMember = async (id: string) => {
    return await deleteReq(`/members/${id}`);
  };

  return {
    updateMember,
    deleteMember,
  };
}