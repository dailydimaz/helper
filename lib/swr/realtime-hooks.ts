"use client";

import useSWR, { mutate } from "swr";
import useSWRMutation from "swr/mutation";
import { useCallback, useRef } from "react";
import { apiClient, ApiError } from "@/lib/client";
import type { ConversationListItem } from "@/app/types/global";

// Types for different data structures
export type DashboardEvent = {
  id: string;
  conversationSlug: string;
  timestamp: string;
  title: string;
  description?: string;
  type: "email" | "chat" | "ai_reply" | "bad_reply" | "good_reply" | "escalation";
  emailFrom?: string;
  isVip: boolean;
  value?: number;
};

export type ConversationMessage = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  type: "user" | "ai" | "system";
  metadata?: Record<string, any>;
};

// Use the existing ConversationListItem type
export type Conversation = ConversationListItem;

export type DashboardMetrics = {
  totalConversations: number;
  openConversations: number;
  resolvedToday: number;
  averageResponseTime: number;
  satisfaction: number;
};

// Configuration for polling intervals
export const POLLING_INTERVALS = {
  ACTIVE_CONVERSATIONS: 3000, // 3 seconds for active conversations
  DASHBOARD_EVENTS: 5000, // 5 seconds for dashboard events  
  DASHBOARD_METRICS: 30000, // 30 seconds for dashboard metrics
  GENERAL_DATA: 60000, // 60 seconds for general data
  PRESENCE: 10000, // 10 seconds for presence updates
} as const;

// Helper to check if window is visible (for performance optimization)
const useVisibilityPolling = (interval: number, enabled = true) => {
  if (typeof window === 'undefined') return interval;
  return enabled && !document.hidden ? interval : 0;
};

// Hook for dashboard events (replaces dashboard realtime)
export function useRealtimeDashboardEvents() {
  const { data, error, isLoading, mutate } = useSWR<DashboardEvent[]>(
    "/mailbox/latest-events",
    (url) => apiClient.get(url),
    {
      refreshInterval: POLLING_INTERVALS.DASHBOARD_EVENTS,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      onError: (error) => {
        console.warn('[SWR] Error fetching dashboard events:', error);
      },
    }
  );

  const addOptimisticEvent = useCallback((event: DashboardEvent) => {
    mutate((currentData) => {
      if (!currentData) return [event];
      return [event, ...currentData].slice(0, 50); // Keep only latest 50 events
    }, false);
  }, [mutate]);

  return {
    events: data || [],
    error,
    isLoading,
    mutate,
    addOptimisticEvent,
    refresh: () => mutate(),
  };
}

// Hook for dashboard metrics
export function useRealtimeDashboardMetrics() {
  const { data, error, isLoading, mutate } = useSWR<DashboardMetrics>(
    "/mailbox/dashboard-metrics",
    (url) => apiClient.get(url),
    {
      refreshInterval: POLLING_INTERVALS.DASHBOARD_METRICS,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return {
    metrics: data,
    error,
    isLoading,
    refresh: () => mutate(),
  };
}

// Hook for conversations list (replaces conversation list realtime)
export function useRealtimeConversations(filters?: {
  status?: string[];
  category?: string;
  assignedToId?: string | null;
}) {
  const filterKey = filters ? JSON.stringify(filters) : "all";
  const cacheKey = `/mailbox/conversations?filters=${encodeURIComponent(filterKey)}`;
  const refreshInterval = useVisibilityPolling(POLLING_INTERVALS.ACTIVE_CONVERSATIONS);
  
  const { data, error, isLoading, mutate } = useSWR<Conversation[]>(
    cacheKey,
    (url) => apiClient.get(url),
    {
      refreshInterval,
      revalidateOnFocus: true,
      dedupingInterval: 1000,
      errorRetryCount: 3,
      errorRetryInterval: 3000,
      onError: (error) => {
        console.warn('[SWR] Error fetching conversations:', error);
      },
    }
  );

  const updateOptimisticConversation = useCallback((conversationId: number, updates: Partial<Conversation>) => {
    mutate((currentData) => {
      if (!currentData) return undefined;
      return currentData.map(conv => 
        conv.id === conversationId ? { ...conv, ...updates } : conv
      );
    }, false);
  }, [mutate]);

  const removeOptimisticConversation = useCallback((conversationId: number) => {
    mutate((currentData) => {
      if (!currentData) return undefined;
      return currentData.filter(conv => conv.id !== conversationId);
    }, false);
  }, [mutate]);

  return {
    conversations: data || [],
    error,
    isLoading,
    mutate,
    updateOptimisticConversation,
    removeOptimisticConversation,
    refresh: () => mutate(),
  };
}

// Hook for conversation messages (replaces message realtime)
export function useRealtimeMessages(conversationSlug: string) {
  const refreshInterval = useVisibilityPolling(POLLING_INTERVALS.ACTIVE_CONVERSATIONS, !!conversationSlug);
  
  const { data, error, isLoading, mutate } = useSWR<ConversationMessage[]>(
    conversationSlug ? `/conversation/${conversationSlug}/messages` : null,
    (url) => apiClient.get(url),
    {
      refreshInterval,
      revalidateOnFocus: true,
      dedupingInterval: 1000,
      errorRetryCount: 5,
      errorRetryInterval: 2000,
      onError: (error) => {
        console.warn('[SWR] Error fetching messages for conversation:', conversationSlug, error);
      },
    }
  );

  const addOptimisticMessage = useCallback((message: ConversationMessage) => {
    mutate((currentData) => {
      if (!currentData) return [message];
      return [...currentData, message];
    }, false);
  }, [mutate]);

  const updateOptimisticMessage = useCallback((messageId: string, updates: Partial<ConversationMessage>) => {
    mutate((currentData) => {
      if (!currentData) return undefined;
      return currentData.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
    }, false);
  }, [mutate]);

  return {
    messages: data || [],
    error,
    isLoading,
    mutate,
    addOptimisticMessage,
    updateOptimisticMessage,
    refresh: () => mutate(),
  };
}

// Hook for presence (replaces realtime presence)
export function useRealtimePresence(channelName: string) {
  const { data, error, isLoading, mutate } = useSWR<{ id: string; name: string }[]>(
    channelName ? `/presence/${channelName}` : null,
    (url) => apiClient.get(url),
    {
      refreshInterval: POLLING_INTERVALS.PRESENCE,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      errorRetryCount: 2,
      errorRetryInterval: 10000,
      onError: (error) => {
        console.warn('[SWR] Error fetching presence for channel:', channelName, error);
      },
    }
  );

  return {
    users: data || [],
    error,
    isLoading,
    refresh: () => mutate(),
  };
}

// Hook for sending messages with optimistic updates
export function useSendMessage(conversationSlug: string) {
  const messagesKey = `/conversation/${conversationSlug}/messages`;
  
  const { trigger, isMutating } = useSWRMutation(
    `/conversation/${conversationSlug}/send-message`,
    async (url: string, { arg }: { arg: { content: string; type: "user" | "ai" | "system" } }) => {
      return apiClient.post(url, arg);
    },
    {
      onSuccess: () => {
        // Refresh messages after successful send
        mutate(messagesKey);
      },
    }
  );

  return {
    sendMessage: trigger,
    isSending: isMutating,
  };
}

// Hook for updating conversation status with optimistic updates
export function useUpdateConversationStatus() {
  const { trigger, isMutating } = useSWRMutation(
    "/conversation/update-status",
    async (url: string, { arg }: { arg: { conversationId: number; status: string; assignedToId?: string | null } }) => {
      return apiClient.patch(url, arg);
    }
  );

  return {
    updateStatus: trigger,
    isUpdating: isMutating,
  };
}

// Global refresh function for manual refreshes
export function useGlobalRefresh() {
  const refreshAll = useCallback(() => {
    // This will refresh all SWR caches
    mutate(() => true);
  }, []);

  return { refreshAll };
}

// Manual polling control
export function usePollingControl() {
  const intervalRef = useRef<NodeJS.Timeout>();

  const startPolling = useCallback((key: string, interval: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      mutate(key);
    }, interval);
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  return { startPolling, stopPolling };
}