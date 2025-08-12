import { NextRequest, NextResponse } from "next/server";
import { jobQueue, getJobSystemStats } from "@/lib/jobs";

export async function GET() {
  try {
    const stats = await getJobSystemStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error getting job stats:", error);
    return NextResponse.json(
      { error: "Failed to get job statistics" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, payload, scheduledFor } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Job type is required" },
        { status: 400 }
      );
    }

    const job = await jobQueue.addJob(
      type,
      payload,
      scheduledFor ? new Date(scheduledFor) : undefined
    );

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `Job ${type} queued successfully`
    });
  } catch (error) {
    console.error("Error queueing job:", error);
    return NextResponse.json(
      { error: "Failed to queue job" },
      { status: 500 }
    );
  }
}