import * as Sentry from "@sentry/nextjs";
import { uniqBy } from "lodash-es";
import { useCallback, useEffect, useState } from "react";
import SuperJSON from "superjson";
import { useRefToLatest } from "@/components/useRefToLatest";
import { useSession } from "@/components/useSession";
import { getFullName } from "@/lib/auth/authUtils";
import { env } from "@/lib/env";

// TODO: Replace with proper realtime solution (WebSocket, Socket.io, or similar)
// For now, providing no-op implementations to maintain compatibility

export const DISABLED = Symbol("DISABLED");

// Mock implementation - realtime disabled until proper replacement is implemented
const channels: Record<
  string,
  {
    eventListeners: Record<string, ((payload: { id: string; data: any }) => void)[]>;
  }
> = {};

// No-op implementation for compatibility
export const ensureRealtimeAuth = Promise.resolve();

// Mock implementation - no-op for now
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const listenToRealtimeEvent = async <Data = any>(
  channel: { name: string; private: boolean } | typeof DISABLED,
  event: string,
  callback: (message: { id: string; data: Data }) => void,
): Promise<() => void> => {
  // TODO: Implement proper realtime solution
  if (env.NODE_ENV === "development") {
    console.warn("Realtime events are disabled - implement proper realtime solution");
  }
  return () => {};
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const useRealtimeEvent = <Data = any>(
  channel: { name: string; private: boolean } | typeof DISABLED,
  event: string,
  callback: (message: { id: string; data: Data }) => void,
) => {
  const callbackRef = useRefToLatest(callback);

  useEffect(() => {
    const unlisten = listenToRealtimeEvent(channel, event, (message) => callbackRef.current(message));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [channel === DISABLED ? undefined : channel.name, channel === DISABLED ? undefined : channel.private, event]);
};

// This ensures that the callback is only called once regardless of how many instances of the component exist.
// Useful for events that trigger tRPC data updates.
const handledOneTimeMessageIds = new Set();
export const useRealtimeEventOnce: typeof useRealtimeEvent = (channel, event, callback) => {
  useRealtimeEvent(channel, event, (message) => {
    if (handledOneTimeMessageIds.has(message.id)) {
      return;
    }
    handledOneTimeMessageIds.add(message.id);
    callback(message);
  });
};

// Mock implementation - no-op for now
export const broadcastRealtimeEvent = async (channel: { name: string; private: boolean }, event: string, data: any) => {
  // TODO: Implement proper realtime broadcasting
  if (env.NODE_ENV === "development") {
    console.warn("Realtime broadcasting is disabled - implement proper realtime solution");
  }
  return { status: "ok" };
};

export const useBroadcastRealtimeEvent = () => {
  return broadcastRealtimeEvent;
};

// Mock implementation - returns empty users list for now
export const useRealtimePresence = (channel: { name: string; private: boolean }) => {
  const { user } = useSession() ?? {};
  const [users] = useState<{ id: string; name: string }[]>([]);

  // TODO: Implement proper presence tracking
  if (env.NODE_ENV === "development" && user) {
    console.warn("Realtime presence is disabled - implement proper realtime solution");
  }

  return { users };
};
