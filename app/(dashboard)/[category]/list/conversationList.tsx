import { Send } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { ConversationListItem as ConversationItem } from "@/app/types/global";
import { ConfirmationDialog } from "@/components/confirmationDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSelected } from "@/components/useSelected";
import { useShiftSelected } from "@/components/useShiftSelected";
// Removed real-time imports - now using SWR polling
import { generateSlug } from "@/lib/shared/slug";
import { useConversationActions } from "@/hooks/use-conversations";
import { useMailboxOpenCount } from "@/hooks/use-mailbox";
import { useConversationsListInput } from "../shared/queries";
import { ConversationFilters, useConversationFilters } from "./conversationFilters";
import { useConversationListContext } from "./conversationListContext";
import { ConversationListItem } from "./conversationListItem";
import { ConversationListSkeleton } from "./conversationListSkeleton";
import { ConversationSearchBar } from "./conversationSearchBar";
import { NoConversations } from "./emptyState";
import NewConversationModalContent from "./newConversationModal";

type ListItem = ConversationItem & { isNew?: boolean };

export const List = () => {
  const [conversationSlug] = useQueryState("id");
  const { searchParams, input } = useConversationsListInput();
  const {
    conversationListData,
    navigateToConversation,
    isPending,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useConversationListContext();

  const [showFilters, setShowFilters] = useState(false);
  const { filterValues, activeFilterCount, updateFilter, clearFilters } = useConversationFilters();
  const [allConversationsSelected, setAllConversationsSelected] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const { bulkUpdateConversations } = useConversationActions();
  const { mutate: mutateOpenCount } = useMailboxOpenCount();

  const conversations = conversationListData?.conversations ?? [];
  const defaultSort = conversationListData?.defaultSort;

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const {
    selected: selectedConversations,
    change: changeSelectedConversations,
    clear: clearSelectedConversations,
    set: setSelectedConversations,
  } = useSelected<number>([]);

  const onShiftSelectConversation = useShiftSelected<number>(
    conversations.map((c) => c.id),
    changeSelectedConversations,
  );

  const toggleConversation = (id: number, isSelected: boolean, shiftKey: boolean) => {
    if (allConversationsSelected) {
      // If all conversations are selected, toggle the selected conversation
      setAllConversationsSelected(false);
      setSelectedConversations(conversations.flatMap((c) => (c.id === id ? [] : [c.id])));
    } else {
      onShiftSelectConversation(id, isSelected, shiftKey);
    }
  };

  const toggleAllConversations = (forceValue?: boolean) => {
    setAllConversationsSelected((prev) => forceValue ?? !prev);
    clearSelectedConversations();
  };

  const handleBulkUpdate = async (status: "open" | "closed" | "spam") => {
    setIsBulkUpdating(true);
    try {
      const conversationFilter = allConversationsSelected
        ? conversations.length <= 25 && !hasNextPage
          ? conversations.map((c) => c.id)
          : input
        : selectedConversations;

      const result = await bulkUpdateConversations(conversationFilter, status);
      
      setAllConversationsSelected(false);
      clearSelectedConversations();
      mutateOpenCount();
      
      const ticketsText = allConversationsSelected
        ? "All matching tickets"
        : `${selectedConversations.length} ticket${selectedConversations.length === 1 ? "" : "s"}`;

      const actionText = status === "open" ? "reopened" : status === "closed" ? "closed" : "marked as spam";
      toast.success(`${ticketsText} ${actionText}`);
    } catch (error: any) {
      toast.error("Failed to update conversations", { description: error.message });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "500px", root: resultsContainerRef.current },
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useHotkeys("mod+a", () => toggleAllConversations(true), {
    enableOnFormTags: false,
    preventDefault: true,
  });

  // Clear selections when status filter changes
  useEffect(() => {
    toggleAllConversations(false);
  }, [searchParams.status, clearSelectedConversations]);

  // Real-time updates are now handled by SWR polling in useInfiniteConversations
  // No need for manual realtime event subscriptions

  const conversationsText = allConversationsSelected
    ? "all matching conversations"
    : `${selectedConversations.length} conversation${selectedConversations.length === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col w-full h-full">
      <div className="px-3 md:px-6 py-2 md:py-4 shrink-0 border-b border-border">
        <div className="flex flex-col gap-2 md:gap-4">
          <ConversationSearchBar
            toggleAllConversations={toggleAllConversations}
            allConversationsSelected={allConversationsSelected}
            activeFilterCount={activeFilterCount}
            defaultSort={defaultSort}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            conversationCount={conversations.length}
          />
          {(allConversationsSelected || selectedConversations.length > 0) && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label htmlFor="select-all" className="text-sm text-muted-foreground flex items-center">
                        {allConversationsSelected
                          ? "All conversations selected"
                          : `${selectedConversations.length} selected`}
                      </label>
                    </TooltipTrigger>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex items-center gap-2">
                  {searchParams.status !== "open" && (
                    <ConfirmationDialog
                      message={`Are you sure you want to reopen ${conversationsText}?`}
                      onConfirm={() => handleBulkUpdate("open")}
                      confirmLabel="Yes, reopen"
                      confirmVariant="bright"
                    >
                      <Button variant="link" className="h-auto" disabled={isBulkUpdating}>
                        Reopen
                      </Button>
                    </ConfirmationDialog>
                  )}
                  {searchParams.status !== "closed" && (
                    <ConfirmationDialog
                      message={`Are you sure you want to close ${conversationsText}?`}
                      onConfirm={() => handleBulkUpdate("closed")}
                      confirmLabel="Yes, close"
                      confirmVariant="bright"
                    >
                      <Button variant="link" className="h-auto" disabled={isBulkUpdating}>
                        Close
                      </Button>
                    </ConfirmationDialog>
                  )}
                  {searchParams.status !== "spam" && (
                    <ConfirmationDialog
                      message={`Are you sure you want to mark ${conversationsText} as spam?`}
                      onConfirm={() => handleBulkUpdate("spam")}
                      confirmLabel="Yes, mark as spam"
                      confirmVariant="bright"
                    >
                      <Button variant="link" className="h-auto" disabled={isBulkUpdating}>
                        Mark as spam
                      </Button>
                    </ConfirmationDialog>
                  )}
                </div>
              </div>
            </div>
          )}
          {showFilters && (
            <ConversationFilters
              filterValues={filterValues}
              onUpdateFilter={updateFilter}
              onClearFilters={clearFilters}
              activeFilterCount={activeFilterCount}
            />
          )}
        </div>
      </div>
      {isPending || (isFetching && conversations.length === 0) ? (
        <div className="flex-1 px-4">
          <ConversationListSkeleton count={8} />
        </div>
      ) : conversations.length === 0 ? (
        <NoConversations filtered={activeFilterCount > 0 || !!input.search} />
      ) : (
        <div ref={resultsContainerRef} className="flex-1 overflow-y-auto">
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.slug}
              conversation={conversation}
              isActive={conversationSlug === conversation.slug}
              onSelectConversation={navigateToConversation}
              isSelected={allConversationsSelected || selectedConversations.includes(conversation.id)}
              onToggleSelect={(isSelected, shiftKey) => toggleConversation(conversation.id, isSelected, shiftKey)}
            />
          ))}
          <div ref={loadMoreRef} />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <ConversationListSkeleton count={3} />
            </div>
          )}
        </div>
      )}
      <NewConversationModal />
    </div>
  );
};

const NewConversationModal = () => {
  const [newConversationModalOpen, setNewConversationModalOpen] = useState(false);
  const [newConversationSlug, setNewConversationSlug] = useState(generateSlug());
  useEffect(() => {
    if (newConversationModalOpen) setNewConversationSlug(generateSlug());
  }, [newConversationModalOpen]);

  const closeModal = () => setNewConversationModalOpen(false);

  return (
    <Dialog open={newConversationModalOpen} onOpenChange={setNewConversationModalOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          iconOnly
          className="fixed z-50 bottom-6 right-6 rounded-full text-primary-foreground dark:bg-bright dark:text-bright-foreground bg-bright hover:bg-bright/90 hover:text-background"
          aria-label="New message"
        >
          <Send className="text-primary dark:text-primary-foreground h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <NewConversationModalContent conversationSlug={newConversationSlug} onSubmit={closeModal} />
      </DialogContent>
    </Dialog>
  );
};
