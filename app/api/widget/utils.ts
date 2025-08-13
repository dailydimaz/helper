import { NextResponse } from "next/server";
import { mailboxesTable } from "@/db/schema";
import { getMailbox, Mailbox } from "@/lib/data/mailbox";
import { verifyWidgetSession, type WidgetSessionPayload } from "@/lib/widgetSession";

// Security: Restrictive CORS for widget endpoints
const getAllowedOrigin = (request: Request): string => {
  const origin = new URL(request.url).searchParams.get('origin') || 
                request.headers.get('origin') || 
                request.headers.get('referer');
  
  if (!origin) return 'null';
  
  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname;
    
    // Allow specific trusted domains for widget embedding
    const trustedDomains = [
      'helperai.dev',
      'localhost',
      '127.0.0.1'
    ];
    
    // Check if hostname matches trusted domains or their subdomains
    const isAllowed = trustedDomains.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
    
    return isAllowed ? origin : 'null';
  } catch {
    return 'null';
  }
};

const getCorsHeaders = (request: Request) => ({
  "Access-Control-Allow-Origin": getAllowedOrigin(request),
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Widget-Host",
  "Access-Control-Allow-Credentials": "false", // Explicit security setting
});

// Backward compatibility wrapper
export function corsOptions(...methods: ("GET" | "POST" | "PATCH")[]) {
  // If called without request (legacy usage), return basic restrictive headers
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.NODE_ENV === 'production' ? "https://helperai.dev" : "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Widget-Host",
      "Access-Control-Allow-Credentials": "false",
      "Access-Control-Allow-Methods": `${methods.join(", ")}, OPTIONS`,
    },
  });
}

// New secure version that takes request parameter
export function corsOptionsSecure(request: Request, ...methods: ("GET" | "POST" | "PATCH")[]) {
  return new Response(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(request),
      "Access-Control-Allow-Methods": `${methods.join(", ")}, OPTIONS`,
    },
  });
}

// Backward compatible version - will be deprecated
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function corsResponse<Data = unknown>(
  data: Data,
  init?: Omit<ResponseInit, "headers"> & { headers?: Record<string, string> },
  method: "POST" | "PATCH" = "POST",
) {
  return Response.json(data, {
    ...init,
    headers: {
      "Access-Control-Allow-Origin": process.env.NODE_ENV === 'production' ? "https://helperai.dev" : "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Widget-Host",
      "Access-Control-Allow-Credentials": "false",
      ...init?.headers,
      "Access-Control-Allow-Methods": `${method}, OPTIONS`,
    },
  });
}

// New secure version with request-based origin validation
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function corsResponseSecure<Data = unknown>(
  request: Request,
  data: Data,
  init?: Omit<ResponseInit, "headers"> & { headers?: Record<string, string> },
  method: "POST" | "PATCH" = "POST",
) {
  return Response.json(data, {
    ...init,
    headers: {
      ...getCorsHeaders(request),
      ...init?.headers,
      "Access-Control-Allow-Methods": `${method}, OPTIONS`,
    },
  });
}

type AuthenticateWidgetResult =
  | { success: true; session: WidgetSessionPayload; mailbox: typeof mailboxesTable.$inferSelect }
  | { success: false; error: string };

export async function authenticateWidget(request: Request): Promise<AuthenticateWidgetResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { success: false, error: "Missing authorization header" };
  }

  const token = authHeader.slice(7);
  const mailbox = await getMailbox();

  if (!mailbox) {
    return { success: false, error: "Mailbox not found" };
  }

  let session;
  try {
    session = verifyWidgetSession(token, mailbox);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Invalid session token", error);
    return { success: false, error: "Invalid session token" };
  }

  return { success: true, session, mailbox };
}

type AuthenticatedHandler<Params extends object> = (
  inner: { request: Request; context: { params: Promise<Params> } },
  auth: { session: WidgetSessionPayload; mailbox: Mailbox },
) => Promise<Response>;

export function withWidgetAuth<Params extends object = object>(handler: AuthenticatedHandler<Params>) {
  return async (request: Request, context: { params: Promise<Params> }) => {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
    }

    const authResult = await authenticateWidget(request);

    if (!authResult.success) {
      return new NextResponse(JSON.stringify({ error: authResult.error }), {
        status: 401,
        headers: {
          ...getCorsHeaders(request),
          "Content-Type": "application/json",
        },
      });
    }

    return handler({ request, context }, { session: authResult.session, mailbox: authResult.mailbox });
  };
}
