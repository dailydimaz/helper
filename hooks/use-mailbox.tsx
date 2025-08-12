"use client";
import useSWR from "swr";
import { useApi } from "./use-api";

export function useMailbox() {
  const { data, error, isLoading, mutate } = useSWR("/mailbox");

  return {
    mailbox: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useMailboxOpenCount() {
  const { data, error, isLoading, mutate } = useSWR("/mailbox/open-count");

  return {
    openCount: data?.data || { all: 0, mine: 0, assigned: 0, unassigned: 0 },
    isLoading,
    error,
    mutate,
  };
}

export function useMailboxActions() {
  const { put } = useApi();

  const updateMailbox = async (data: any) => {
    return await put("/mailbox", data);
  };

  return {
    updateMailbox,
  };
}