import SuperJSON from "superjson";

// Mock WebSocket client interface
interface MockRealtimeClient {
  channel: (name: string) => MockChannel;
  removeChannel: (channel: MockChannel) => void;
}

interface MockChannel {
  subscribe: () => void;
  on: (type: string, filter: any, callback: (payload: any) => void) => void;
}

const channels: Record<
  string,
  {
    channel: MockChannel;
    eventListeners: Record<string, ((payload: { id: string; data: any }) => void)[]>;
  }
> = {};

// Simple mock implementation for realtime events
// This should be replaced with a proper WebSocket implementation when needed
export const listenToRealtimeEvent = <Data = any>(
  client: MockRealtimeClient,
  channel: string,
  event: string,
  callback: (message: { id: string; data: Data }) => void,
): (() => void) => {
  let channelObject = channels[channel];
  if (!channelObject) {
    channelObject = {
      channel: client.channel(channel),
      eventListeners: {},
    };
    channels[channel] = channelObject;
    channelObject.channel.subscribe();
  }

  if (!channelObject.eventListeners[event]) {
    channelObject.eventListeners[event] = [];
    channelObject.channel.on("broadcast", { event }, ({ payload }) => {
      if (!payload.data) {
        console.warn("No data in realtime event", { channel, event });
        return;
      }
      const data = SuperJSON.parse(payload.data);
      if (process.env.NODE_ENV === "development") {
        console.debug(
          "Helper received realtime event (this message will not be shown in production):",
          channel,
          event,
          { ...payload, data },
        );
      }
      channelObject.eventListeners[event]?.forEach((listener) =>
        listener({ id: payload.id as string, data: data as Data }),
      );
    });
  }

  const listener = (payload: { id: string; data: any }) => callback(payload);
  channelObject.eventListeners[event].push(listener);

  return () => {
    const channelObject = channels[channel];
    if (channelObject) {
      const index = channelObject.eventListeners[event]?.indexOf(listener);

      if (index != null && index >= 0) {
        channelObject.eventListeners[event]!.splice(index, 1);
      }

      if (channelObject.eventListeners[event]!.length === 0) {
        delete channelObject.eventListeners[event];
      }

      if (Object.keys(channelObject.eventListeners).length === 0) {
        client.removeChannel(channelObject.channel);
        delete channels[channel];
      }
    }
  };
};
