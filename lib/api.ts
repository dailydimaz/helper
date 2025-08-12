import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

// Response utilities
export function apiSuccess<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  });
}

export function apiError(error: string, status: number = 400): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

export function apiValidationError(errors: Record<string, string>): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: "Validation failed",
      errors,
    },
    { status: 400 }
  );
}

// Validation utilities
export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      return { error: apiValidationError(errors) };
    }
    return { error: apiError("Invalid request body") };
  }
}

export function validateQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): { data: T } | { error: NextResponse } {
  try {
    const url = new URL(request.url);
    const params: Record<string, any> = {};
    
    for (const [key, value] of url.searchParams) {
      params[key] = value;
    }
    
    const data = schema.parse(params);
    return { data };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      return { error: apiValidationError(errors) };
    }
    return { error: apiError("Invalid query parameters") };
  }
}

// Pagination utilities
export interface PaginationOptions {
  page: number;
  perPage: number;
  total: number;
}

export function createPaginationResponse<T>(
  data: T[],
  { page, perPage, total }: PaginationOptions
): ApiResponse<T[]> {
  const totalPages = Math.ceil(total / perPage);
  
  return {
    success: true,
    data,
    pagination: {
      total,
      page,
      perPage,
      totalPages,
    },
  };
}

export function parsePagination(request: NextRequest): { page: number; perPage: number; offset: number } {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "10")));
  const offset = (page - 1) * perPage;
  
  return { page, perPage, offset };
}

// Error handling utilities
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error("API Error:", error);
  
  if (error instanceof Error) {
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    return apiError(error.message, 500);
  }
  
  return apiError("Internal server error", 500);
}

// Method utilities
export function createMethodHandler(handlers: {
  GET?: (request: NextRequest) => Promise<NextResponse>;
  POST?: (request: NextRequest) => Promise<NextResponse>;
  PUT?: (request: NextRequest) => Promise<NextResponse>;
  DELETE?: (request: NextRequest) => Promise<NextResponse>;
  PATCH?: (request: NextRequest) => Promise<NextResponse>;
}) {
  return async (request: NextRequest) => {
    try {
      const method = request.method as keyof typeof handlers;
      const handler = handlers[method];
      
      if (!handler) {
        return apiError("Method not allowed", 405);
      }
      
      return await handler(request);
    } catch (error) {
      return handleApiError(error);
    }
  };
}