import {
  CornerUpLeft as ArrowUturnLeftIcon,
  CornerRightUp as ArrowUturnUpIcon,
  MessageSquare as ChatBubbleLeftIcon,
  Mail as EnvelopeIcon,
  PenSquare as PencilSquareIcon,
  Play as PlayIcon,
  MessageSquareText as SavedReplyIcon,
  ShieldAlert as ShieldExclamationIcon,
  Sparkles as SparklesIcon,
  User as UserIcon,
} from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useConversationContext } from "@/app/(dashboard)/[category]/conversation/conversationContext";
import { Tool } from "@/app/(dashboard)/[category]/ticketCommandBar/toolForm";
import useKeyboardShortcut from "@/components/useKeyboardShortcut";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { useApi } from "@/hooks/use-api";
import useSWR from "swr";
import { mutate } from "swr";
import { handleApiErr } from "@/lib/handle-api-err";
import GitHubSvg from "../icons/github.svg";
import { CommandGroup } from "./types";

type MainPageProps = {
  onOpenChange: (open: boolean) => void;
  setPage: (page: "main" | "previous-replies" | "assignees" | "notes" | "github-issue") => void;
  setSelectedItemId: (id: string | null) => void;
  onToggleCc: () => void;
  setSelectedTool: (tool: Tool) => void;
  onInsertReply: (content: string) => void;
};

export const useMainPage = ({
  onOpenChange,
  setPage,
  setSelectedItemId,
  onToggleCc,
  setSelectedTool,
  onInsertReply,
}: MainPageProps): CommandGroup[] => {
  const { data: conversation, updateStatus, conversationSlug } = useConversationContext();
  const { post } = useApi();

  const dismissToastRef = useRef<() => void>(() => {});
  
  const generateDraft = async () => {
    if (!conversationSlug) return;
    
    const toastId = toast("Generating draft...", {
      duration: 30_000,
    });
    dismissToastRef.current = () => toast.dismiss(toastId);
    
    try {
      const result = await post(`/conversations/${conversationSlug}/generate-draft`, {});
      dismissToastRef.current?.();
      
      if (result?.data) {
        // Invalidate conversation data to refetch with new draft
        await mutate(key => 
          typeof key === 'string' && key.includes(`/conversations/${conversationSlug}`)
        );
        toast.success("Draft generated successfully");
      } else {
        toast.error("Error generating draft");
      }
    } catch (error) {
      dismissToastRef.current?.();
      handleApiErr(error, {
        onError: (message) => {
          toast.error("Error generating draft", { description: message });
          return true; // Handled
        }
      });
    }
  };

  const { data: toolsData } = useSWR(
    conversationSlug ? `/conversations/${conversationSlug}/tools` : null
  );
  const tools = toolsData?.data;

  const { data: savedRepliesData } = useSWR("/saved-replies?onlyActive=true");
  const savedReplies = savedRepliesData?.data;

  const incrementSavedReplyUsage = async (slug: string) => {
    try {
      await post(`/saved-replies/${slug}/increment-usage`, {});
    } catch (error) {
      captureExceptionAndLog("Failed to track saved reply usage:", error);
    }
  };

  const { data: mailboxData } = useSWR("/mailbox");
  const mailbox = mailboxData?.data;

  const isGitHubConnected = mailbox?.githubConnected && mailbox.githubRepoOwner && mailbox.githubRepoName;

  useKeyboardShortcut("n", (e) => {
    e.preventDefault();
    onOpenChange(true);
    setPage("notes");
    setSelectedItemId(null);
  });

  const handleSavedReplySelect = useCallback(
    (savedReply: { slug: string; content: string }) => {
      try {
        if (!onInsertReply) {
          throw new Error("onInsertReply function is not available");
        }

        onInsertReply(savedReply.content);
        onOpenChange(false);

        // Track usage separately - don't fail the insertion if tracking fails
        await incrementSavedReplyUsage(savedReply.slug);
      } catch (error) {
        captureExceptionAndLog("Failed to insert saved reply content", {
          extra: {
            error,
          },
        });
        toast.error("Failed to insert saved reply", {
          description: "Could not insert the saved reply content. Please try again.",
        });
      }
    },
    [onInsertReply, incrementSavedReplyUsage, onOpenChange],
  );

  const mainCommandGroups = useMemo(
    () => [
      {
        heading: "Actions",
        items: [
          {
            id: "close",
            label: "Close ticket",
            icon: ArrowUturnLeftIcon,
            onSelect: () => {
              updateStatus("closed");
              onOpenChange(false);
            },
            shortcut: "C",
            hidden: conversation?.status === "closed" || conversation?.status === "spam",
          },
          {
            id: "reopen",
            label: "Reopen ticket",
            icon: ArrowUturnUpIcon,
            onSelect: () => {
              updateStatus("open");
              onOpenChange(false);
            },
            shortcut: "Z",
            hidden: conversation?.status === "open",
          },
          {
            id: "assign",
            label: "Assign ticket",
            icon: UserIcon,
            onSelect: () => {
              setPage("assignees");
              setSelectedItemId(null);
            },
            shortcut: "A",
          },
          {
            id: "spam",
            label: "Mark as spam",
            icon: ShieldExclamationIcon,
            onSelect: () => {
              updateStatus("spam");
              onOpenChange(false);
            },
            shortcut: "S",
            hidden: conversation?.status === "spam",
          },
          {
            id: "add-note",
            label: "Add internal note",
            icon: PencilSquareIcon,
            onSelect: () => {
              setPage("notes");
              setSelectedItemId(null);
            },
            shortcut: "N",
          },
          {
            id: "github-issue",
            label: conversation?.githubIssueNumber ? "Manage GitHub Issue" : "Link GitHub Issue",
            icon: GitHubSvg,
            onSelect: () => {
              setPage("github-issue");
              setSelectedItemId(null);
            },
            shortcut: "G",
            hidden: !isGitHubConnected,
          },
        ],
      },
      {
        heading: "Compose",
        items: [
          {
            id: "generate-draft",
            label: "Generate draft",
            icon: SparklesIcon,
            onSelect: () => {
              generateDraft();
              onOpenChange(false);
            },
          },
          {
            id: "previous-replies",
            label: "Use previous replies",
            icon: ChatBubbleLeftIcon,
            onSelect: () => {
              setPage("previous-replies");
              setSelectedItemId(null);
            },
          },
          {
            id: "toggle-cc-bcc",
            label: "Add CC or BCC",
            icon: EnvelopeIcon,
            onSelect: () => {
              onToggleCc();
              onOpenChange(false);
            },
          },
        ],
      },
      ...(savedReplies && savedReplies.length > 0
        ? [
            {
              heading: "Saved replies",
              items: savedReplies.map((savedReply) => ({
                id: savedReply.slug,
                label: savedReply.name,
                icon: SavedReplyIcon,
                onSelect: () => handleSavedReplySelect(savedReply),
              })),
            },
          ]
        : []),
      ...(tools && tools.all.length > 0
        ? [
            {
              heading: "Tools",
              items: tools.all.map((tool) => ({
                id: tool.slug,
                label: tool.name,
                icon: PlayIcon,
                onSelect: () => setSelectedTool(tool),
              })),
            },
          ]
        : []),
    ],
    [onOpenChange, conversation, tools?.suggested, onToggleCc, isGitHubConnected, savedReplies, handleSavedReplySelect],
  );

  return mainCommandGroups;
};
