"use client";
import { useMemo } from "react";
import useSWR from "swr";
import { useApi } from "./use-api";

export function useTeamSettings() {
  const { data, error, isLoading, mutate } = useSWR("/settings/team");

  return {
    team: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useKnowledgeSettings() {
  const { data, error, isLoading, mutate } = useSWR("/settings/knowledge");

  return {
    knowledge: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useKnowledgeBanks(search?: string) {
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    return `/settings/knowledge/banks${params.toString() ? `?${params.toString()}` : ""}`;
  }, [search]);

  const { data, error, isLoading, mutate } = useSWR(url);

  return {
    knowledgeBanks: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useIntegrations() {
  const { data, error, isLoading, mutate } = useSWR("/settings/integrations");

  return {
    integrations: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useGithubIntegration() {
  const { data, error, isLoading, mutate } = useSWR("/settings/integrations/github");

  return {
    github: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useSlackIntegration() {
  const { data, error, isLoading, mutate } = useSWR("/settings/integrations/slack");

  return {
    slack: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useChatWidgetSettings() {
  const { data, error, isLoading, mutate } = useSWR("/settings/chat");

  return {
    chatWidget: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useCustomerSettings() {
  const { data, error, isLoading, mutate } = useSWR("/settings/customers");

  return {
    customers: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function usePreferencesSettings() {
  const { data, error, isLoading, mutate } = useSWR("/settings/preferences");

  return {
    preferences: data?.data,
    isLoading,
    error,
    mutate,
  };
}

export function useToolsSettings() {
  const { data, error, isLoading, mutate } = useSWR("/settings/tools");

  return {
    tools: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useCommonIssuesSettings() {
  const { data, error, isLoading, mutate } = useSWR("/settings/common-issues");

  return {
    commonIssues: data?.data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useSettingsActions() {
  const { put, post, delete: deleteReq } = useApi();

  const updateTeamSettings = async (data: any) => {
    return await put("/settings/team", data);
  };

  const updateKnowledgeSettings = async (data: any) => {
    return await put("/settings/knowledge", data);
  };

  const createKnowledgeBank = async (data: any) => {
    return await post("/settings/knowledge/banks", data);
  };

  const updateKnowledgeBank = async (id: string, data: any) => {
    return await put(`/settings/knowledge/banks/${id}`, data);
  };

  const deleteKnowledgeBank = async (id: string) => {
    return await deleteReq(`/settings/knowledge/banks/${id}`);
  };

  const updateIntegrations = async (data: any) => {
    return await put("/settings/integrations", data);
  };

  const updateGithubIntegration = async (data: any) => {
    return await put("/settings/integrations/github", data);
  };

  const updateSlackIntegration = async (data: any) => {
    return await put("/settings/integrations/slack", data);
  };

  const updateChatWidget = async (data: any) => {
    return await put("/settings/chat", data);
  };

  const updateCustomerSettings = async (data: any) => {
    return await put("/settings/customers", data);
  };

  const updatePreferences = async (data: any) => {
    return await put("/settings/preferences", data);
  };

  const createTool = async (data: any) => {
    return await post("/settings/tools", data);
  };

  const updateTool = async (id: string, data: any) => {
    return await put(`/settings/tools/${id}`, data);
  };

  const deleteTool = async (id: string) => {
    return await deleteReq(`/settings/tools/${id}`);
  };

  return {
    updateTeamSettings,
    updateKnowledgeSettings,
    createKnowledgeBank,
    updateKnowledgeBank,
    deleteKnowledgeBank,
    updateIntegrations,
    updateGithubIntegration,
    updateSlackIntegration,
    updateChatWidget,
    updateCustomerSettings,
    updatePreferences,
    createTool,
    updateTool,
    deleteTool,
  };
}