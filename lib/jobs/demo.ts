#!/usr/bin/env tsx

/**
 * Demo script showing how to use the lightweight job system
 */

import { triggerEvent, jobQueue, getJobSystemStats } from "@/lib/jobs";

async function demo() {
  console.log("=== Lightweight Job System Demo ===\n");

  // 1. Trigger some events (these will create jobs automatically)
  console.log("1. Triggering events...");
  
  await triggerEvent("files/preview.generate", { fileId: 123 });
  await triggerEvent("faqs/embedding.create", { faqId: 456 });
  await triggerEvent("conversations/message.created", { messageId: 789 });

  console.log("✓ Events triggered\n");

  // 2. Add individual jobs directly
  console.log("2. Adding individual jobs...");
  
  await jobQueue.addJob("generateFilePreview", { fileId: 999 });
  await jobQueue.addJob("embeddingFaq", { faqId: 888 }, new Date(Date.now() + 10000)); // 10 seconds delay

  console.log("✓ Jobs added\n");

  // 3. Check job system stats
  console.log("3. Current job system stats:");
  const stats = await getJobSystemStats();
  console.log(JSON.stringify(stats, null, 2));
  
  console.log("\n=== Demo Complete ===");
  console.log("Jobs are now being processed in the background!");
  console.log("Check the console output to see job processing logs.");
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}