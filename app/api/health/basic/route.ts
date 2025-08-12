import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { createMethodHandler } from "@/lib/api";

async function GET(request: NextRequest) {
  try {
    // Basic database connectivity check
    await db.execute("SELECT 1");
    
    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "unknown"
    });
  } catch (error) {
    return Response.json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Database connection failed"
    }, { status: 503 });
  }
}

export const { GET: handler } = createMethodHandler({ GET });