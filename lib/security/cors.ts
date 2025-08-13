import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

// CORS configuration
export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
}

// Default CORS configuration
const DEFAULT_CORS_CONFIG: CORSConfig = {
  allowedOrigins: [
    env.NEXT_PUBLIC_APP_URL,
    'https://helperai.dev',
    'https://*.helperai.dev',
    // Add development origins
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
    'https://helperai.dev:3000',
  ],
  allowedMethods: [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'HEAD',
    'OPTIONS',
  ],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Accept',
    'Accept-Version',
    'Content-Length',
    'Content-MD5',
    'Date',
    'User-Agent',
  ],
  exposedHeaders: [
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Response-Time',
    'X-CSRF-Token',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
};

// CORS configurations for different endpoint types
export const CORS_CONFIGS = {
  // Public API endpoints - restrictive even for public APIs
  PUBLIC_API: {
    ...DEFAULT_CORS_CONFIG,
    credentials: false,
    allowedOrigins: [
      env.NEXT_PUBLIC_APP_URL,
      'https://helperai.dev',
      'https://*.helperai.dev',
      // Only allow localhost in development
      ...(process.env.NODE_ENV === 'development' ? [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://localhost:3000'
      ] : [])
    ] as string[],
  },
  
  // Widget endpoints - controlled embedding with domain validation
  WIDGET: {
    ...DEFAULT_CORS_CONFIG,
    credentials: false,
    allowedOrigins: [
      env.NEXT_PUBLIC_APP_URL,
      'https://helperai.dev',
      'https://*.helperai.dev',
      // Development domains
      ...(process.env.NODE_ENV === 'development' ? [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://localhost:3000'
      ] : []),
      // Add verified customer domains here as needed
      // 'https://trusted-customer-domain.com',
    ] as string[],
    allowedHeaders: [
      ...DEFAULT_CORS_CONFIG.allowedHeaders,
      'X-Widget-Host',
      'X-Widget-Version',
    ] as string[],
  },
  
  // Admin endpoints - most restrictive
  ADMIN: {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: [
      env.NEXT_PUBLIC_APP_URL,
      'https://helperai.dev',
    ] as string[],
  },
  
  // Authentication endpoints - restrictive
  AUTH: {
    ...DEFAULT_CORS_CONFIG,
    allowedOrigins: [
      env.NEXT_PUBLIC_APP_URL,
      'https://helperai.dev',
      // Allow localhost for development
      'http://localhost:3000',
      'https://localhost:3000',
      'https://helperai.dev:3000',
    ] as string[],
  },
  
  // File upload endpoints
  FILES: {
    ...DEFAULT_CORS_CONFIG,
    allowedHeaders: [
      ...DEFAULT_CORS_CONFIG.allowedHeaders,
      'Content-Length',
      'X-File-Name',
      'X-File-Type',
    ] as string[],
  },
};

/**
 * Check if origin is allowed with enhanced security validation
 */
export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  // Security: Be more strict about missing origins
  if (!origin) {
    // Only allow missing origin for specific cases (mobile apps, direct API calls)
    // For web browsers, origin should always be present
    return false;
  }
  
  // Security: Never allow wildcard in production
  if (allowedOrigins.includes('*')) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('SECURITY WARNING: Wildcard CORS origin detected in production!');
      return false;
    }
    return true;
  }
  
  // Validate origin format
  try {
    new URL(origin);
  } catch {
    console.warn(`SECURITY WARNING: Invalid origin format: ${origin}`);
    return false;
  }
  
  // Check exact matches
  if (allowedOrigins.includes(origin)) return true;
  
  // Check wildcard subdomains with enhanced validation
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      
      // Enhanced subdomain validation
      if (origin.endsWith(`.${domain}`) || origin === `https://${domain}` || origin === `http://${domain}`) {
        // Additional security: validate that it's a legitimate subdomain
        try {
          const originUrl = new URL(origin);
          
          // Ensure protocol matches expectations
          if (process.env.NODE_ENV === 'production' && originUrl.protocol !== 'https:') {
            return false;
          }
          
          return true;
        } catch {
          return false;
        }
      }
    }
  }
  
  console.warn(`SECURITY WARNING: Origin not in allowlist: ${origin}`);
  return false;
}

/**
 * Get CORS configuration based on request path
 */
export function getCORSConfig(pathname: string): CORSConfig {
  if (pathname.startsWith('/api/widget')) {
    return CORS_CONFIGS.WIDGET;
  }
  
  if (pathname.startsWith('/api/adm')) {
    return CORS_CONFIGS.ADMIN;
  }
  
  if (pathname.startsWith('/api/auth')) {
    return CORS_CONFIGS.AUTH;
  }
  
  if (pathname.startsWith('/api/files')) {
    return CORS_CONFIGS.FILES;
  }
  
  // Check for public endpoints
  const publicEndpoints = [
    '/api/health',
    '/api/public',
    '/widget',
  ];
  
  if (publicEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
    return CORS_CONFIGS.PUBLIC_API;
  }
  
  return DEFAULT_CORS_CONFIG;
}

/**
 * Apply CORS headers to response
 */
export function applyCORSHeaders(
  request: NextRequest,
  response: NextResponse,
  config?: CORSConfig
): NextResponse {
  const corsConfig = config || getCORSConfig(request.nextUrl.pathname);
  const origin = request.headers.get('origin');
  
  // Check if origin is allowed
  if (origin && isOriginAllowed(origin, corsConfig.allowedOrigins)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (corsConfig.allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  // Set other CORS headers
  if (corsConfig.credentials && origin) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  response.headers.set(
    'Access-Control-Allow-Methods',
    corsConfig.allowedMethods.join(', ')
  );
  
  response.headers.set(
    'Access-Control-Allow-Headers',
    corsConfig.allowedHeaders.join(', ')
  );
  
  if (corsConfig.exposedHeaders.length > 0) {
    response.headers.set(
      'Access-Control-Expose-Headers',
      corsConfig.exposedHeaders.join(', ')
    );
  }
  
  response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());
  
  // Add security headers
  if (origin && isOriginAllowed(origin, corsConfig.allowedOrigins)) {
    response.headers.set('Vary', 'Origin');
  }
  
  return response;
}

/**
 * Handle preflight requests
 */
export function handlePreflightRequest(
  request: NextRequest,
  config?: CORSConfig
): NextResponse {
  const corsConfig = config || getCORSConfig(request.nextUrl.pathname);
  const origin = request.headers.get('origin');
  
  // Create preflight response
  const response = new NextResponse(null, { status: 200 });
  
  // Check origin
  if (!origin || !isOriginAllowed(origin, corsConfig.allowedOrigins)) {
    return new NextResponse(null, { status: 403 });
  }
  
  // Check requested method
  const requestedMethod = request.headers.get('access-control-request-method');
  if (requestedMethod && !corsConfig.allowedMethods.includes(requestedMethod)) {
    return new NextResponse(null, { status: 403 });
  }
  
  // Check requested headers
  const requestedHeaders = request.headers.get('access-control-request-headers');
  if (requestedHeaders) {
    const headers = requestedHeaders.split(',').map(h => h.trim().toLowerCase());
    const allowedHeadersLower = corsConfig.allowedHeaders.map(h => h.toLowerCase());
    
    for (const header of headers) {
      if (!allowedHeadersLower.includes(header)) {
        return new NextResponse(null, { status: 403 });
      }
    }
  }
  
  // Apply CORS headers to preflight response
  return applyCORSHeaders(request, response, corsConfig);
}

/**
 * CORS middleware factory
 */
export function createCORSMiddleware() {
  return (request: NextRequest): NextResponse | null => {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return handlePreflightRequest(request);
    }
    
    return null; // Continue to next middleware
  };
}

/**
 * Validate request origin against allowed origins
 */
export function validateRequestOrigin(
  request: NextRequest,
  allowedOrigins?: string[]
): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  const origins = allowedOrigins || DEFAULT_CORS_CONFIG.allowedOrigins;
  
  // Check origin header
  if (origin) {
    return isOriginAllowed(origin, origins);
  }
  
  // Check referer header as fallback
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      return isOriginAllowed(refererOrigin, origins);
    } catch {
      return false;
    }
  }
  
  // Allow requests without origin/referer (direct API calls, mobile apps)
  return true;
}

/**
 * Create CORS response for API routes
 */
export function createCORSResponse(
  request: NextRequest,
  data?: any,
  options: {
    status?: number;
    config?: CORSConfig;
    headers?: Record<string, string>;
  } = {}
): NextResponse {
  const { status = 200, config, headers = {} } = options;
  
  const response = NextResponse.json(data, { status });
  
  // Apply custom headers first
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Apply CORS headers
  return applyCORSHeaders(request, response, config);
}

/**
 * Enhanced security validation for CORS
 */
export function validateCORSSecurity(request: NextRequest): {
  valid: boolean;
  error?: string;
} {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const userAgent = request.headers.get('user-agent');
  const referer = request.headers.get('referer');
  
  // Enhanced origin validation for production
  if (origin && process.env.NODE_ENV === 'production') {
    // Block localhost/private IPs in production
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.')) {
      return {
        valid: false,
        error: 'Local/private origins not allowed in production',
      };
    }
    
    // Ensure HTTPS in production
    if (!origin.startsWith('https://')) {
      return {
        valid: false,
        error: 'HTTPS required in production',
      };
    }
  }
  
  // Check for missing host header (potential security issue)
  if (!host) {
    return {
      valid: false,
      error: 'Missing host header - potential security issue',
    };
  }
  
  // Enhanced suspicious request detection
  if (userAgent) {
    const suspiciousPatterns = [
      /curl/i,
      /wget/i,
      /python-requests/i,
      /httpx/i,
      /axios/i, // Block direct axios calls
      /node-fetch/i,
      /bot/i,
      /crawler/i,
      /spider/i,
      /scanner/i,
      /exploit/i,
    ];
    
    // Block suspicious requests for sensitive endpoints
    const sensitivePaths = ['/api/auth', '/api/adm', '/api/files'];
    const isSensitive = sensitivePaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    );
    
    if (isSensitive && suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      console.warn(`SECURITY WARNING: Blocked suspicious request from ${origin || 'unknown'} with UA: ${userAgent}`);
      return {
        valid: false,
        error: 'Automated requests not allowed for this endpoint',
      };
    }
  }
  
  // Cross-check origin and referer for consistency
  if (origin && referer) {
    try {
      const originUrl = new URL(origin);
      const refererUrl = new URL(referer);
      
      if (originUrl.hostname !== refererUrl.hostname) {
        console.warn(`SECURITY WARNING: Origin/Referer mismatch: ${origin} vs ${referer}`);
        // Don't block, but log for monitoring
      }
    } catch {
      // Invalid URLs - continue with other checks
    }
  }
  
  return { valid: true };
}