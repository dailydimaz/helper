"use client";
import { useMemo } from "react";
import useSWR from "swr";

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR("/adm/me");

  const user = useMemo(() => {
    if (error || isLoading) return null;
    return data?.data; // Match consistent API response structure
  }, [data, error, isLoading]);

  const status = useMemo(() => {
    if (error) return "unauthenticated";
    if (isLoading) return "loading";
    return "authenticated";
  }, [error, isLoading]) as "loading" | "unauthenticated" | "authenticated";

  return { user, status, reload: mutate };
}