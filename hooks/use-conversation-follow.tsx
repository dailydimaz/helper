"use client";
import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { useApi } from "./use-api";
import { toast } from "sonner";

interface FollowStatus {
  isFollowing: boolean;
  followerCount: number;
}

interface Follower {
  id: string;
  followedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
}

export function useConversationFollow(conversationSlug: string) {
  const api = useApi();
  
  const { data: followStatus, error: followStatusError, mutate: mutateFollowStatus } = useSWR<{
    data: FollowStatus;
  }>(`/conversations/${conversationSlug}/follow-status`);

  const { data: followers, error: followersError, mutate: mutateFollowers } = useSWR<{
    data: Follower[];
  }>(`/conversations/${conversationSlug}/followers`);

  const isFollowing = useMemo(() => {
    return followStatus?.data?.isFollowing || false;
  }, [followStatus]);

  const followerCount = useMemo(() => {
    return followStatus?.data?.followerCount || 0;
  }, [followStatus]);

  const followersLoading = useMemo(() => {
    return !followers && !followersError;
  }, [followers, followersError]);

  const statusLoading = useMemo(() => {
    return !followStatus && !followStatusError;
  }, [followStatus, followStatusError]);

  const follow = useCallback(async () => {
    try {
      // Optimistic update
      mutateFollowStatus(
        {
          data: {
            isFollowing: true,
            followerCount: followerCount + 1,
          },
        },
        false
      );

      await api.post(`/conversations/${conversationSlug}/follow`);
      
      // Revalidate data
      mutateFollowStatus();
      mutateFollowers();
      
      toast.success("Successfully followed conversation");
    } catch (error: any) {
      // Revert optimistic update
      mutateFollowStatus();
      
      const message = error?.message || "Failed to follow conversation";
      toast.error(message);
    }
  }, [api, conversationSlug, followerCount, mutateFollowStatus, mutateFollowers]);

  const unfollow = useCallback(async () => {
    try {
      // Optimistic update
      mutateFollowStatus(
        {
          data: {
            isFollowing: false,
            followerCount: Math.max(0, followerCount - 1),
          },
        },
        false
      );

      await api.delete(`/conversations/${conversationSlug}/follow`);
      
      // Revalidate data
      mutateFollowStatus();
      mutateFollowers();
      
      toast.success("Successfully unfollowed conversation");
    } catch (error: any) {
      // Revert optimistic update
      mutateFollowStatus();
      
      const message = error?.message || "Failed to unfollow conversation";
      toast.error(message);
    }
  }, [api, conversationSlug, followerCount, mutateFollowStatus, mutateFollowers]);

  const toggleFollow = useCallback(() => {
    if (isFollowing) {
      unfollow();
    } else {
      follow();
    }
  }, [isFollowing, follow, unfollow]);

  return {
    isFollowing,
    followerCount,
    followers: followers?.data || [],
    follow,
    unfollow,
    toggleFollow,
    statusLoading,
    followersLoading,
    error: followStatusError || followersError,
    mutateFollowStatus,
    mutateFollowers,
  };
}