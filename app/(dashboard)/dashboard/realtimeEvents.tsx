"use client";

import { BotIcon, DollarSign, Flag, Mail, MessageSquare, Star, ThumbsDown, ThumbsUp, RefreshCw } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import HumanizedTime from "@/components/humanizedTime";
import { Panel } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedCallback } from "@/components/useDebouncedCallback";
import { useRealtimeEvents } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

const RealtimeEvents = () => {
  const { ref: loadMoreRef, inView } = useInView();

  // Use SWR for real-time events with polling
  const { events: allEvents, isLoading, mutate: refresh } = useRealtimeEvents();

  // TODO: Implement infinite scrolling with SWR if needed
  const debouncedRefresh = useDebouncedCallback(() => {
    refresh();
  }, 1000);

  useEffect(() => {
    if (inView) {
      // Trigger refresh when user scrolls to bottom (for future infinite scroll implementation)
      debouncedRefresh();
    }
  }, [inView, debouncedRefresh]);

  const EventSkeleton = () => (
    <Panel className="p-0">
      <div className="flex flex-col p-5">
        <div className="flex gap-3 mb-2 items-center min-w-0">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-6 w-3/4 mb-6" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 flex-1" />
        </div>
      </div>
    </Panel>
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <EventSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Manual refresh button */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {(allEvents || []).map((event: any) => (
        <motion.div key={event.id} layout>
          <Panel
            className={cn(
              "p-0",
              (event.isVip || event.type === "bad_reply" || event.type === "good_reply") && "dark:border-0",
            )}
          >
            <Link
              href={`/conversations?id=${event.conversationSlug}`}
              className={cn(
                "flex flex-col p-5 transition-colors rounded-lg",
                "hover:bg-muted dark:hover:bg-muted",
                event.isVip && "bg-bright/10 dark:bg-transparent dark:border dark:border-bright/50",
                event.type === "bad_reply" &&
                  "bg-destructive/10 dark:bg-transparent dark:border dark:border-destructive/50",
                event.type === "good_reply" && "bg-success/10 dark:bg-transparent dark:border dark:border-success/50",
              )}
            >
              <div className="flex gap-3 mb-2 text-muted-foreground items-center min-w-0">
                <div className="flex-1 text-sm truncate">{event.emailFrom ?? "Anonymous"}</div>
                <div className="flex items-center gap-3 shrink-0">
                  {event.isVip && (
                    <div className="flex items-center gap-1 text-xs">
                      <Star className="w-4 h-4 text-bright" />
                      VIP
                    </div>
                  )}
                  {event.value != null && (
                    <div className="flex items-center gap-1 text-xs">
                      <DollarSign className="w-4 h-4 text-success" />
                      <div>${(Number(event.value) / 100).toFixed(2)}</div>
                    </div>
                  )}
                  <Badge
                    variant={
                      event.type === "bad_reply" ? "destructive" : event.type === "good_reply" ? "success" : "bright"
                    }
                  >
                    <HumanizedTime time={event.timestamp} format="long" />
                  </Badge>
                </div>
              </div>

              <h3 className="text-lg font-medium truncate">{event.title}</h3>

              {event.type === "bad_reply" ? (
                <div className="mt-6 flex items-center gap-2 text-destructive text-sm">
                  <ThumbsDown className="w-4 h-4" />
                  <span className="flex-1 truncate">
                    Bad reply {event.description ? <>&mdash; {event.description}</> : null}
                  </span>
                </div>
              ) : event.type === "good_reply" ? (
                <div className="mt-6 flex items-center gap-2 text-success text-sm">
                  <ThumbsUp className="w-4 h-4" />
                  Good reply
                </div>
              ) : event.type === "email" ? (
                <div className="mt-6 flex items-center gap-2 text-muted-foreground text-sm">
                  <Mail className="w-4 h-4" />
                  <div className="flex-1 truncate">{event.description}</div>
                </div>
              ) : event.type === "chat" ? (
                <div className="mt-6 flex items-center gap-2 text-muted-foreground text-sm">
                  <MessageSquare className="w-4 h-4" />
                  <div className="flex-1 truncate">{event.description}</div>
                </div>
              ) : event.type === "ai_reply" ? (
                <div className="mt-6 flex items-center gap-2 text-muted-foreground text-sm">
                  <BotIcon strokeWidth={1.5} className="w-4 h-4" />
                  <div className="flex-1 truncate">{event.description}</div>
                </div>
              ) : (
                <div className="mt-6 flex items-center gap-2 text-muted-foreground text-sm">
                  <Flag className="w-4 h-4 text-bright" />
                  Human support requested
                </div>
              )}
            </Link>
          </Panel>
        </motion.div>
      ))}
      {(!allEvents || allEvents.length === 0) && (
        <Panel className="col-span-full text-center py-8 text-muted-foreground">
          No conversations yet. New activity will appear here automatically.
        </Panel>
      )}
      <div ref={loadMoreRef} className="col-span-full flex justify-center p-4"></div>
      </div>
    </div>
  );
};

export default RealtimeEvents;
