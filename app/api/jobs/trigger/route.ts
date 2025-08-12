import { NextRequest, NextResponse } from 'next/server';
import { triggerEvent, type EventName } from '@/lib/jobs/trigger';
import { jobQueue } from '@/lib/jobs/queue';
import { z } from 'zod';

// Schema for triggering events
const triggerEventSchema = z.object({
  event: z.string(),
  data: z.record(z.any()),
  sleepSeconds: z.number().optional(),
});

// Schema for adding jobs directly
const addJobSchema = z.object({
  type: z.string(),
  payload: z.record(z.any()).optional(),
  scheduledFor: z.string().datetime().optional(),
  priority: z.number().min(0).max(10).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'triggerEvent': {
        const { event, data, sleepSeconds } = triggerEventSchema.parse(body);
        
        await triggerEvent(event as EventName, data, { sleepSeconds });
        
        return NextResponse.json({
          success: true,
          message: `Event "${event}" triggered successfully`,
          data: { event, data, sleepSeconds },
        });
      }

      case 'addJob': {
        const { type, payload, scheduledFor, priority } = addJobSchema.parse(body);
        
        const scheduledDate = scheduledFor ? new Date(scheduledFor) : undefined;
        const job = await jobQueue.addJob(type, payload, scheduledDate, priority);
        
        return NextResponse.json({
          success: true,
          message: `Job "${type}" added successfully`,
          data: {
            id: job.id,
            type: job.type,
            scheduledFor: job.scheduledFor,
            priority: job.payload?._priority || 0,
          },
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
        }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      }, { status: 400 });
    }

    console.error('Job trigger failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Job trigger failed',
      details: error instanceof Error ? error.message : String(error),
    }, {
      status: 500,
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get available job types and event names for the API documentation
    const { JobProcessor } = await import('@/lib/jobs/processor');
    const processor = new JobProcessor();
    
    const availableJobTypes = processor.getAvailableJobTypes();
    
    // Get available event types from trigger.ts
    const events = [
      'files/preview.generate',
      'conversations/embedding.create',
      'conversations/message.created',
      'conversations/email.enqueued',
      'conversations/auto-response.create',
      'conversations/bulk-update',
      'conversations/update-suggested-actions',
      'gmail/webhook.received',
      'faqs/embedding.create',
      'gmail/import-recent-threads',
      'gmail/import-gmail-threads',
      'reports/weekly',
      'reports/daily',
      'websites/crawl.create',
      'messages/flagged.bad',
      'conversations/auto-close.check',
      'conversations/auto-close.process-mailbox',
      'conversations/human-support-requested',
      'slack/agent.message',
    ];

    return NextResponse.json({
      success: true,
      data: {
        availableJobTypes,
        availableEvents: events,
        usage: {
          triggerEvent: {
            action: 'triggerEvent',
            event: 'string (one of availableEvents)',
            data: 'object (event-specific data)',
            sleepSeconds: 'number (optional delay in seconds)',
          },
          addJob: {
            action: 'addJob',
            type: 'string (one of availableJobTypes)',
            payload: 'object (optional job payload)',
            scheduledFor: 'string (optional ISO datetime)',
            priority: 'number (0-10, optional)',
          },
        },
      },
    });
  } catch (error) {
    console.error('Failed to get job trigger info:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve job trigger information',
    }, { status: 500 });
  }
}