#!/usr/bin/env tsx

/**
 * Setup script for the lightweight job system
 * This replaces the complex PGMQ + cron setup with a simple setTimeout-based system
 */

import { initializeJobSystem } from "@/lib/jobs/startup";

console.log("Setting up lightweight job system...");

// Initialize the job system
initializeJobSystem();

console.log("Lightweight job system setup complete!");
console.log("The system is now running and will process jobs as they are added.");
console.log("Recurring jobs have been scheduled using setTimeout.");

// Keep the script running to maintain the job system
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  const { shutdownJobSystem } = require("@/lib/jobs/startup");
  shutdownJobSystem();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  const { shutdownJobSystem } = require("@/lib/jobs/startup");
  shutdownJobSystem();
  process.exit(0);
});