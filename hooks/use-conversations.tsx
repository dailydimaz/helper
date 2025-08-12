"use client";
import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useApi } from "./use-api";
import { mutate } from "swr";

export function useConversations() {
  const searchParams = useSearchParams();
  
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (searchParams.get("page")) params.set("page", searchParams.get("page")!);
    if (searchParams.get("q")) params.set("q", searchParams.get("q")!);
    if (searchParams.get("status")) params.set("status", searchParams.get("status")!);
    if (searchParams.get("assignee")) params.set("assignee", searchParams.get("assignee")!);
    
    return `/conversations${params.toString() ? `?${params.toString()}` : ""}`;
  }, [searchParams]);

  const { data, error, isLoading, mutate } = useSWR(url, {
    refreshInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  return {
    conversations: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useConversation(slug: string) {
  const { data, error, isLoading, mutate } = useSWR(slug ? `/conversations/${slug}` : null);

  return {
    conversation: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useInfiniteConversations(input: any) {
  const [pages, setPages] = useState<any[]>([]);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  
  const url = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, String(v)));
        } else {
          params.set(key, String(value));
        }
      }
    });
    return `/conversations${params.toString() ? `?${params.toString()}` : ""}`;  
  }, [input]);

  const { data, error, isLoading, mutate: mutateList } = useSWR(url, {
    refreshInterval: 5000, // Poll every 5 seconds for real-time updates
  });

  const conversations = useMemo(() => {
    if (!data?.data) return [];
    return Array.isArray(data.data) ? data.data : data.data.conversations || [];
  }, [data]);

  const { get } = useApi();
  
  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return;
    
    setIsFetchingNextPage(true);
    try {
      // For now, we'll simulate pagination by loading more data
      // In a real implementation, you'd modify the API to support cursor-based pagination
      const nextPageParams = new URLSearchParams();
      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => nextPageParams.append(key, String(v)));
          } else {
            nextPageParams.set(key, String(value));
          }
        }
      });
      nextPageParams.set('page', String((pages.length || 0) + 2));
      
      const nextPageData = await get(`/conversations?${nextPageParams.toString()}`);
      
      if (nextPageData?.data?.length === 0) {
        setHasNextPage(false);
      } else {
        setPages(prev => [...prev, nextPageData]);
      }
    } catch (error) {
      console.error('Failed to fetch next page:', error);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [hasNextPage, isFetchingNextPage, input, pages.length, get]);

  const allConversations = useMemo(() => {
    const mainConversations = conversations;
    const pageConversations = pages.flatMap(page => page?.data || []);
    return [...mainConversations, ...pageConversations];
  }, [conversations, pages]);

  return {
    data: {
      pages: [{ conversations: allConversations, nextCursor: hasNextPage ? 'next' : null }, ...pages],
    },
    conversations: allConversations,
    isLoading,
    isFetching: isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    mutate: mutateList,
  };
}

export function useConversationActions() {
  const { put, post } = useApi();

  const updateConversation = async (slug: string, data: any) => {
    const result = await put(`/conversations/${slug}`, data);
    // Invalidate related SWR keys
    await mutate(key => typeof key === 'string' && key.startsWith('/conversations'));
    return result;
  };

  const createConversation = async (data: any) => {
    const result = await post("/conversations", data);
    // Invalidate conversations list
    await mutate(key => typeof key === 'string' && key.startsWith('/conversations'));
    return result;
  };

  const bulkUpdateConversations = async (conversationFilter: any, status: string) => {
    const result = await put("/conversations/bulk-update", { conversationFilter, status });
    // Invalidate conversations list and counts
    await mutate(key => typeof key === 'string' && (key.startsWith('/conversations') || key.startsWith('/mailbox')));
    return result;
  };

  return {
    updateConversation,
    createConversation,
    bulkUpdateConversations,
  };
}