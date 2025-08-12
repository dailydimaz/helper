import SuperJSON from "superjson";

// TODO: Implement proper realtime publishing solution
// For now, providing no-op implementation to maintain compatibility

const MAX_PAYLOAD_SIZE = 200 * 1000;

export const publishToRealtime = async <Data>({
  channel,
  event,
  data,
  trim,
}: {
  channel: { name: string; private: boolean };
  event: string;
  data: Data;
  trim?: (data: Data, count: number) => Data;
}) => {
  // Mock implementation - no actual publishing
  if (process.env.NODE_ENV === "development") {
    console.warn(`Realtime publish disabled: ${channel.name}:${event}`);
  }
  
  // Validate payload size for future implementation
  const json = SuperJSON.stringify(data);
  if (json.length > MAX_PAYLOAD_SIZE) {
    throw new Error(`${channel.name} ${event} payload is too large for realtime: ${json.length} bytes`);
  }
  
  // Return success for compatibility
  return { status: "ok", id: crypto.randomUUID() };
};
