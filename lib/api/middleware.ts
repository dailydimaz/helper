import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth/simpleAuth";
import { getAuthToken } from "@/lib/cookie";

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    displayName: string;
    permissions: string;
    access: {
      role: "afk" | "core" | "nonCore";
      keywords: string[];
    };
  };
}

export function withAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: AuthenticatedRequest) => {
    try {
      const token = await getAuthToken();
      
      if (!token) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const user = await verifyJWT(token);
      
      if (!user) {
        return NextResponse.json(
          { error: "Invalid token" },
          { status: 401 }
        );
      }

      req.user = user;
      return await handler(req);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      );
    }
  };
}

export function createApiResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function createErrorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}