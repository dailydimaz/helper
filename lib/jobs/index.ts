// Simplified job system exports
export { jobQueue, JobQueue } from "./queue";
export { jobProcessor, JobProcessor } from "./processor";  
export { jobScheduler, JobScheduler, scheduleHelpers } from "./scheduler";
export { triggerEvent, type EventName, type EventData } from "./trigger";
export { initializeJobSystem, shutdownJobSystem, getJobSystemStats } from "./startup";

// Re-export job types and schema
export type { Job, NewJob } from "@/db/schema/jobs";
export type { JobType } from "@/jobs/lightweight";