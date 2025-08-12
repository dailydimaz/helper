"use client";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import useSWR from "swr";

export function useTable({ pathname, perPage = 10 }: { pathname: string; perPage?: number }) {
  const query = useSearchParams();

  const dataURL = useMemo(() => {
    const p = new URL("https://example.com" + pathname);
    p.searchParams.set("perPage", perPage.toString());
    p.searchParams.set("page", query.get("page") || "1");
    if (query.get("q")) p.searchParams.set("q", query.get("q") as string);
    return p.pathname + p.search;
  }, [pathname, perPage, query]);

  const dataSwr = useSWR(dataURL);

  const paginateURL = useMemo(() => {
    const p = new URL("https://example.com" + pathname);
    if (query.get("q")) p.searchParams.set("q", query.get("q") as string);
    p.searchParams.set("countOnly", "true");
    return p.pathname + p.search;
  }, [pathname, query]);

  const paginateSwr = useSWR(paginateURL);

  return {
    data: dataSwr?.data?.data || [],
    isLoading: dataSwr.isLoading,
    error: dataSwr.error,
    totalLoading: paginateSwr.isLoading,
    total: paginateSwr?.data?.total || -1,
    perPage,
    mutate: async () => {
      await dataSwr.mutate();
      paginateSwr.mutate();
    },
  };
}