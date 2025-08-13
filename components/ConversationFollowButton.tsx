"use client";
import { Heart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConversationFollow } from "@/hooks/use-conversation-follow";
import { cn } from "@/lib/utils";

interface ConversationFollowButtonProps {
  conversationSlug: string;
  variant?: "default" | "ghost" | "subtle" | "outlined";
  size?: "sm" | "default" | "lg";
  showCount?: boolean;
  className?: string;
}

export function ConversationFollowButton({
  conversationSlug,
  variant = "ghost",
  size = "sm",
  showCount = true,
  className,
}: ConversationFollowButtonProps) {
  const { isFollowing, followerCount, toggleFollow, statusLoading } = useConversationFollow(conversationSlug);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={toggleFollow}
            disabled={statusLoading}
            className={cn(
              "gap-2",
              isFollowing && variant === "ghost" && "text-red-600 hover:text-red-700",
              className
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4",
                size === "sm" && "h-3 w-3",
                size === "lg" && "h-5 w-5",
                isFollowing ? "fill-current" : "fill-none"
              )}
            />
            {showCount && followerCount > 0 && (
              <span className="text-xs">{followerCount}</span>
            )}
            {!showCount && (
              <span className="text-xs">
                {isFollowing ? "Following" : "Follow"}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isFollowing ? "Unfollow" : "Follow"} this conversation to receive notifications
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FollowersListProps {
  conversationSlug: string;
  className?: string;
}

export function FollowersList({ conversationSlug, className }: FollowersListProps) {
  const { followers, followersLoading } = useConversationFollow(conversationSlug);

  if (followersLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Users className="h-4 w-4" />
        <span>Loading followers...</span>
      </div>
    );
  }

  if (followers.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Users className="h-4 w-4" />
        <span>No followers yet</span>
      </div>
    );
  }

  const displayFollowers = followers.slice(0, 3);
  const remainingCount = followers.length - displayFollowers.length;

  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Users className="h-4 w-4" />
      <div className="flex items-center gap-1">
        <span>Followed by</span>
        {displayFollowers.map((follower, index) => (
          <span key={follower.id} className="text-foreground">
            {follower.user.displayName}
            {index < displayFollowers.length - 1 && ", "}
          </span>
        ))}
        {remainingCount > 0 && (
          <span>
            {displayFollowers.length > 0 && " and "}{remainingCount} other{remainingCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}