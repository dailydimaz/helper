import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";
import { useConversationListContext } from "@/app/(dashboard)/[category]/list/conversationListContext";
import { assertDefined } from "@/components/utils/assert";
import { captureExceptionAndThrowIfDevelopment } from "@/lib/shared/sentry";
import { useConversation, useConversationActions } from "@/hooks/use-conversations";
import { mutate } from "swr";

type ConversationContextType = {
  conversationSlug: string;
  data: any | null;
  isPending: boolean;
  error: { message: string } | null;
  refetch: () => void;
  updateStatus: (status: "closed" | "spam" | "open") => Promise<void>;
  updateConversation: (inputs: any) => Promise<void>;
  isUpdating: boolean;
};

const ConversationContext = createContext<ConversationContextType | null>(null);

export function useConversationQuery(conversationSlug: string | null) {
  const result = useConversation(conversationSlug || "");

  return conversationSlug ? result : null;
}

export const ConversationContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { currentConversationSlug, removeConversation, navigateToConversation } = useConversationListContext();
  const conversationSlug = assertDefined(
    currentConversationSlug,
    "ConversationContext can only be used when currentConversationSlug is defined",
  );
  const { conversation: data = null, isLoading: isPending, error, mutate: refetch } = assertDefined(useConversationQuery(currentConversationSlug));

  const { updateConversation: updateConversationAction } = useConversationActions();
  const isUpdating = false; // TODO: Add loading state management

  const update = async (inputs: any) => {
    try {
      await updateConversationAction(conversationSlug, inputs);
      await refetch();
    } catch (error: any) {
      toast.error("Error updating conversation", {
        description: error.message,
      });
      throw error;
    }
  };

  const updateStatus = useCallback(
    async (status: "closed" | "spam" | "open") => {
      const previousStatus = data?.status;

      await update({ status });

      if (status === "open") {
        toast.success("Conversation reopened");
      } else {
        removeConversation();
        if (status === "closed") {
          toast.success("Conversation closed", {
            action: {
              label: "Undo",
              onClick: async () => {
                try {
                  await update({ status: previousStatus ?? "open" });
                  navigateToConversation(conversationSlug);
                  toast.success("Conversation reopened");
                } catch (e) {
                  captureExceptionAndThrowIfDevelopment(e);
                  toast.error("Failed to undo");
                }
              },
            },
          });
        }
      }

      if (status === "spam") {
        const undoStatus = previousStatus ?? "open";
        toast.info("Marked as spam", {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await update({ status: undoStatus });
                navigateToConversation(conversationSlug);
                toast.success("No longer marked as spam");
              } catch (e) {
                captureExceptionAndThrowIfDevelopment(e);
                toast.error("Failed to undo");
              }
            },
          },
        });
      }
    },
    [update, removeConversation, navigateToConversation, conversationSlug, data],
  );

  return (
    <ConversationContext.Provider
      value={{
        conversationSlug,
        data,
        isPending,
        error: error ? { message: error.message || 'An error occurred' } : null,
        refetch,
        updateStatus,
        updateConversation: update,
        isUpdating,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversationContext = () =>
  assertDefined(
    useContext(ConversationContext),
    "useConversationContext must be used within a ConversationContextProvider",
  );
