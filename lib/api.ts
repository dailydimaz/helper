import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { PerformanceMonitor } from './database/optimizations';

// Request deduplication cache for performance optimization
const requestCache = new Map<string, { promise: Promise<any>; timestamp: number }>();
const REQUEST_CACHE_TTL = 1000; // 1 second

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

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
  performance?: {
    responseTime: number;
    cached: boolean;
  };
}

export interface CacheOptions {
  maxAge?: number; // seconds
  staleWhileRevalidate?: number; // seconds
  private?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Generate cache key for request deduplication
 */
function generateCacheKey(method: string, url: string, body?: any): string {
  const bodyHash = body ? JSON.stringify(body) : '';
  return `${method}:${url}:${bodyHash}`;
}

/**
 * Deduplicate concurrent identical requests
 */
export function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const cached = requestCache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < REQUEST_CACHE_TTL) {
    return cached.promise;
  }
  
  const promise = requestFn().finally(() => {
    // Clean up cache entry after request completes
    setTimeout(() => {
      requestCache.delete(key);
    }, REQUEST_CACHE_TTL);
  });
  
  requestCache.set(key, { promise, timestamp: now });
  return promise;
}

/**
 * Enhanced API success response with performance optimizations
 */
export function apiSuccess<T>(
  data: T, 
  options: {
    message?: string;
    cache?: CacheOptions;
    compress?: boolean;
    responseTime?: number;
    cached?: boolean;
  } = {}
): NextResponse<ApiResponse<T>> {
  const { 
    message, 
    cache, 
    compress = true, 
    responseTime, 
    cached = false 
  } = options;
  
  const response = NextResponse.json({
    success: true,
    data,
    message,
    ...(responseTime !== undefined && {
      performance: { responseTime, cached },
    }),
  });
  
  // Set caching headers
  if (cache) {
    const { maxAge = 300, staleWhileRevalidate = 600, private: isPrivate = false } = cache;
    
    const cacheControl = [
      isPrivate ? 'private' : 'public',
      `max-age=${maxAge}`,
      `stale-while-revalidate=${staleWhileRevalidate}`,
    ].join(', ');
    
    response.headers.set('Cache-Control', cacheControl);
  }
  
  // Enable compression for large responses
  if (compress && JSON.stringify(data).length > 1000) {
    response.headers.set('Content-Encoding', 'gzip');
  }
  
  // Performance headers
  response.headers.set('X-Response-Time', Date.now().toString());
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  return response;
}

export function apiError(
  error: string, 
  status: number = 400,
  errors?: Record<string, string>,
  metadata?: Record<string, any>
): NextResponse<ApiResponse> {
  const response = NextResponse.json(
    {
      success: false,
      error,
      ...(errors && { errors }),
      ...(metadata && { metadata }),
    },
    { status }
  );
  
  response.headers.set('X-Response-Time', Date.now().toString());
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  return response;
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

/**
 * Safely handle Zod SafeParse results without exposing internal details
 */
export function handleSafeParseError<T>(
  result: { success: false; error: any } | { success: true; data: T }
): NextResponse<ApiResponse> | null {
  if (result.success) {
    return null; // No error
  }
  
  // Security: Don't expose detailed Zod error information in production
  if (process.env.NODE_ENV === 'production') {
    return apiError("Invalid request format", 400);
  }
  
  // In development, provide detailed validation errors for debugging
  if (result.error?.issues) {
    const errors: Record<string, string> = {};
    result.error.issues.forEach((issue: any) => {
      const path = issue.path.join(".") || "root";
      errors[path] = issue.message;
    });
    return apiValidationError(errors);
  }
  
  return apiError("Invalid request format", 400);
}

/**
 * Enhanced security wrapper for API error responses
 * Prevents information disclosure in production while preserving debug info in development
 */
export function secureApiError(error: unknown, defaultMessage: string = "An error occurred", statusCode: number = 500): NextResponse<ApiResponse> {
  // Always log the full error for server-side debugging
  console.error('API Error:', error);
  
  // In production, return sanitized error messages
  if (process.env.NODE_ENV === 'production') {
    return apiError(defaultMessage, statusCode);
  }
  
  // In development, show detailed error information
  if (error instanceof Error) {
    return apiError(error.message, statusCode);
  }
  
  if (typeof error === 'string') {
    return apiError(error, statusCode);
  }
  
  return apiError(defaultMessage, statusCode);
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
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("perPage") || "10", 10)));
  const offset = (page - 1) * perPage;
  
  return { page, perPage, offset };
}

// Error handling utilities with enhanced security
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error("API Error:", error);
  
  if (error instanceof Error) {
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    // For security: Don't expose internal error messages in production
    if (process.env.NODE_ENV === 'production') {
      // Log the actual error but return sanitized message
      console.error('Production API Error (sanitized for response):', error.message);
      return apiError("An error occurred while processing your request", 500);
    }
    
    // In development, show actual error for debugging
    return apiError(error.message, 500);
  }
  
  return apiError("Internal server error", 500);
}

/**
 * Rate limiting utility
 */
export function rateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 1000 // 1 minute
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || now > record.resetTime) {
    const resetTime = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: maxRequests - 1, resetTime };
  }
  
  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }
  
  record.count++;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Enhanced database query optimization for API routes
 */
export async function optimizedQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  cacheKey?: string,
  cacheTTL?: number
): Promise<T> {
  const startTime = Date.now();
  const monitor = PerformanceMonitor.getInstance();
  
  try {
    let result: T;
    
    if (cacheKey && cacheTTL) {
      const { cacheQuery } = await import('./database/optimizations');
      result = await cacheQuery(cacheKey, queryFn, cacheTTL);
    } else {
      result = await queryFn();
    }
    
    const duration = Date.now() - startTime;
    monitor.recordSlowQuery(queryName, duration);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    monitor.recordSlowQuery(`${queryName} (ERROR)`, duration);
    throw error;
  }
}

/**
 * Performance-optimized method handler with monitoring
 */
export function createMethodHandler(handlers: {
  GET?: (request: NextRequest, ...args: any[]) => Promise<NextResponse>;
  POST?: (request: NextRequest, ...args: any[]) => Promise<NextResponse>;
  PUT?: (request: NextRequest, ...args: any[]) => Promise<NextResponse>;
  DELETE?: (request: NextRequest, ...args: any[]) => Promise<NextResponse>;
  PATCH?: (request: NextRequest, ...args: any[]) => Promise<NextResponse>;
}) {
  const methodMap = {} as Record<string, (request: NextRequest, ...args: any[]) => Promise<NextResponse>>;
  
  Object.entries(handlers).forEach(([method, handler]) => {
    if (handler) {
      methodMap[method] = async (request: NextRequest, ...args: any[]) => {
        const startTime = Date.now();
        const monitor = PerformanceMonitor.getInstance();
        const url = request.nextUrl.pathname;
        
        try {
          // Request deduplication for GET requests
          if (method === 'GET') {
            const cacheKey = generateCacheKey(method, request.url);
            return await deduplicateRequest(cacheKey, () => handler(request, ...args));
          }
          
          // Rate limiting check
          const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
          const rateCheck = rateLimit(`${clientIP}:${method}:${url}`);
          
          if (!rateCheck.allowed) {
            return apiError('Rate limit exceeded', 429, undefined, {
              retryAfter: Math.ceil((rateCheck.resetTime - Date.now()) / 1000),
            });
          }
          
          const response = await handler(request, ...args);
          const duration = Date.now() - startTime;
          
          // Track API performance
          monitor.recordSlowQuery(`API ${method} ${url}`, duration);
          
          // Add rate limit headers
          response.headers.set('X-RateLimit-Remaining', rateCheck.remaining.toString());
          response.headers.set('X-RateLimit-Reset', rateCheck.resetTime.toString());
          
          return response;
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`API Error in ${method} ${url}:`, error);
          
          monitor.recordSlowQuery(`API ${method} ${url} (ERROR)`, duration);
          
          if (error instanceof Error) {
            // Security: Don't expose internal error messages in production
            const errorMessage = process.env.NODE_ENV === 'production' 
              ? 'An error occurred while processing your request'
              : error.message;
            return apiError(errorMessage, 500, undefined, { duration });
          }
          
          return apiError('Internal server error', 500, undefined, { duration });
        }
      };
    }
  });
  
  return methodMap;
}

/**
 * Batch API response optimization for large datasets
 */
export function batchApiResponse<T>(
  items: T[],
  options: {
    batchSize?: number;
    delay?: number;
  } = {}
): Promise<T[]> {
  const { batchSize = 100, delay = 0 } = options;
  
  if (items.length <= batchSize) {
    return Promise.resolve(items);
  }
  
  // Process in batches to avoid overwhelming the client
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  return batches.reduce(
    (promise, batch, index) =>
      promise.then(async (results) => {
        if (delay > 0 && index > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        return [...results, ...batch];
      }),
    Promise.resolve([] as T[])
  );
}