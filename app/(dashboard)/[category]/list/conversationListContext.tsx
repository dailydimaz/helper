import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import React, { createContext, useContext, useMemo } from "react";
import { ConversationListItem } from "@/app/types/global";
import { useDebouncedCallback } from "@/components/useDebouncedCallback";
import { assertDefined } from "@/components/utils/assert";
import { useInfiniteConversations } from "@/hooks/use-conversations";
import { useMailboxOpenCount } from "@/hooks/use-mailbox";
import { mutate } from "swr";
import { useConversationsListInput } from "../shared/queries";

type ConversationListContextType = {
  conversationListData: any | null;
  isPending: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  currentIndex: number;
  currentTotal: number;
  fetchNextPage: () => void;
  currentConversationSlug: string | null;
  minimize: () => void;
  moveToNextConversation: () => void;
  moveToPreviousConversation: () => void;
  removeConversation: () => void;
  removeConversationKeepActive: () => void;
  navigateToConversation: (conversationSlug: string) => void;
};

const ConversationListContext = createContext<ConversationListContextType | null>(null);

export const ConversationListContextProvider = ({
  currentConversationSlug,
  children,
}: {
  currentConversationSlug: string | null;
  children: React.ReactNode;
}) => {
  const { input } = useConversationsListInput();
  const {
    data,
    conversations,
    isLoading: isPending,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    mutate: mutateConversations,
  } = useInfiniteConversations(input);
  const { mutate: mutateOpenCount } = useMailboxOpenCount();
  const [, setId] = useQueryState("id", { history: "push" });

  const lastPage = useMemo(() => data?.pages?.[data?.pages.length - 1], [data]);
  const currentTotal = useMemo(() => conversations.length, [conversations]);
  const currentIndex = useMemo(
    () => conversations.findIndex((c) => c.slug === currentConversationSlug),
    [conversations, currentConversationSlug],
  );

  const moveToNextConversation = () => {
    if (!conversations.length) return setId(null);

    let nextConversation;
    if (currentIndex === -1) {
      nextConversation = conversations[0];
    } else {
      nextConversation = currentIndex === conversations.length - 1 ? conversations[0] : conversations[currentIndex + 1];
    }
    setId(nextConversation?.slug ?? null);
  };

  const moveToPreviousConversation = () => {
    if (!conversations.length) return setId(null);

    let previousConversation;
    if (currentIndex === -1) {
      previousConversation = conversations[0];
    } else {
      previousConversation =
        currentIndex === 0 ? conversations[conversations.length - 1] : conversations[currentIndex - 1];
    }
    setId(previousConversation?.slug ?? null);
  };

  const router = useRouter();
  const debouncedInvalidate = useDebouncedCallback(() => {
    router.refresh();
    mutateConversations();
    mutateOpenCount();
  }, 1000);

  const removeConversationFromList = (condition: (conversation: ConversationListItem) => boolean) => {
    // Optimistically update the conversation list
    const updatedConversations = conversations.filter(c => !condition(c));
    mutateConversations(
      {
        ...data,
        pages: data?.pages?.map((page: any) => ({
          ...page,
          conversations: page.conversations?.filter((c: any) => !condition(c)) || [],
        })) || [],
      },
      false
    );
    
    // Update open count if removing from open conversations
    if (!input.status || input.status[0] === "open") {
      mutate(
        '/mailbox/open-count',
        (currentData: any) => {
          if (!currentData?.data) return currentData;
          return {
            ...currentData,
            data: {
              ...currentData.data,
              [input.category]: Math.max(0, currentData.data[input.category] - 1),
            },
          };
        },
        false
      );
      mutateOpenCount();
    }
  };

  const removeConversationKeepActive = () => {
    debouncedInvalidate();
    removeConversationFromList((c) => c.slug === currentConversationSlug);
  };

  const removeConversation = () => {
    debouncedInvalidate();
    removeConversationFromList((c) => c.slug === currentConversationSlug);
    moveToNextConversation();
  };

  // Real-time updates are now handled automatically by SWR's refreshInterval in useInfiniteConversations
  // Migration to SWR polling complete - no additional real-time polling needed as useInfiniteConversations
  // already implements proper SWR-based polling with refreshInterval

  const value = useMemo(
    () => ({
      conversationListData: lastPage
        ? {
            conversations,
            onboardingState: lastPage?.onboardingState,
            defaultSort: lastPage?.defaultSort,
            assignedToIds: lastPage?.assignedToIds,
            nextCursor: lastPage?.nextCursor,
          }
        : null,
      isPending,
      isFetching,
      isFetchingNextPage,
      hasNextPage,
      currentTotal,
      currentIndex,
      fetchNextPage,
      currentConversationSlug,
      minimize: () => setId(null),
      moveToNextConversation,
      moveToPreviousConversation,
      removeConversation,
      removeConversationKeepActive,
      navigateToConversation: setId,
    }),
    [currentConversationSlug, conversations, lastPage, isPending, isFetching, isFetchingNextPage, hasNextPage, currentTotal, currentIndex, fetchNextPage, moveToNextConversation, moveToPreviousConversation, removeConversation, removeConversationKeepActive, setId],
  );

  return <ConversationListContext.Provider value={value}>{children}</ConversationListContext.Provider>;
};

export const useConversationListContext = () =>
  assertDefined(
    useContext(ConversationListContext),
    "useConversationContext must be used within a ConversationContextProvider",
  );
