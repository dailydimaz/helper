
import { toolBodySchema, ToolRequestBody } from "@helperai/client";
import { z } from "zod";

console.log("Testing toolBodySchema...");
try {
  const testData = {
    parameters: {
      test: { type: "string", description: "test param" }
    }
  };
  const result = toolBodySchema.parse(testData);
  console.log("✓ toolBodySchema works correctly");
  console.log("✓ ToolRequestBody type available");
} catch (error) {
  console.error("✗ Error:", error.message);
}

