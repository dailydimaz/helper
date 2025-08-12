import { NextRequest, NextResponse } from "next/server";
import { validateSecureSession } from "./authEnhanced";
import { createCSRFMiddleware, requiresCSRFProtection } from "./csrf";
import { createCORSMiddleware, validateCORSSecurity } from "./cors";
import { rateLimit, RATE_LIMIT_CONFIGS } from "./rateLimiting";

export interface SecurityMiddlewareConfig {
  enableCSRF: boolean;
  enableCORS: boolean;
  enableRateLimit: boolean;
  enableSessionValidation: boolean;
  enableSecurityHeaders: boolean;
}

const DEFAULT_CONFIG: SecurityMiddlewareConfig = {
  enableCSRF: true,
  enableCORS: true,
  enableRateLimit: true,
  enableSessionValidation: true,
  enableSecurityHeaders: true,
};

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/adm',
  '/mine', 
  '/api/adm',
  '/api/conversations',
  '/api/messages',
  '/api/files',
  '/api/saved-replies',
  '/api/members',
  '/api/settings',
];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth',
  '/api/health',
  '/widget',
  '/api/widget',
  '/api/public',
];

/**
 * Comprehensive security middleware
 */
export async function securityMiddleware(
  request: NextRequest,
  config: Partial<SecurityMiddlewareConfig> = {}
): Promise<NextResponse | null> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const pathname = request.nextUrl.pathname;
  
  try {
    // 1. CORS validation and preflight handling
    if (fullConfig.enableCORS) {
      const corsMiddleware = createCORSMiddleware();
      const corsResponse = corsMiddleware(request);
      if (corsResponse) return corsResponse;
      
      // Validate CORS security
      const corsValidation = validateCORSSecurity(request);
      if (!corsValidation.valid) {
        return createSecurityResponse(
          "CORS validation failed",
          403,
          { reason: corsValidation.error }
        );
      }
    }
    
    // 2. Rate limiting
    if (fullConfig.enableRateLimit) {
      const rateLimitType = determineRateLimitType(pathname, request.method);
      const rateLimitResult = rateLimit(request, rateLimitType);
      
      if (!rateLimitResult.allowed) {
        return createSecurityResponse(
          "Rate limit exceeded",
          429,
          { 
            retryAfter: rateLimitResult.retryAfter,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
          }
        );
      }
    }
    
    // 3. CSRF protection
    if (fullConfig.enableCSRF && requiresCSRFProtection(request)) {
      const csrfMiddleware = createCSRFMiddleware();
      const csrfResponse = await csrfMiddleware(request);
      if (csrfResponse) return csrfResponse;
    }
    
    // 4. Authentication validation for protected routes
    if (fullConfig.enableSessionValidation && requiresAuth(pathname)) {
      const sessionValidation = await validateSecureSession(request);
      
      if (!sessionValidation.valid) {
        // For API routes, return JSON error
        if (pathname.startsWith('/api/')) {
          return createSecurityResponse(
            "Authentication required",
            401,
            { reason: sessionValidation.error }
          );
        }
        
        // For pages, redirect to login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
      
      // Check for session rotation
      if (sessionValidation.shouldRotate) {
        // In a real implementation, you'd rotate the session here
        console.log('Session should be rotated');
      }
    }
    
    // 5. Security headers (will be applied by next middleware or route handler)
    if (fullConfig.enableSecurityHeaders) {
      // Headers will be applied by the response transformation
    }
    
    return null; // Continue to next middleware/route
    
  } catch (error) {
    console.error('Security middleware error:', error);
    return createSecurityResponse("Security validation failed", 500);
  }
}

/**
 * Check if route requires authentication
 */
function requiresAuth(pathname: string): boolean {
  // Skip authentication check for public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return false;
  }
  
  // Check if route requires authentication
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Determine appropriate rate limit type based on path and method
 */
function determineRateLimitType(pathname: string, method: string): keyof typeof RATE_LIMIT_CONFIGS {
  if (pathname.startsWith('/api/auth/login')) {
    return 'LOGIN';
  }
  
  if (pathname.startsWith('/api/auth/register')) {
    return 'REGISTER';
  }
  
  if (pathname.startsWith('/api/auth') && pathname.includes('password')) {
    return 'PASSWORD_RESET';
  }
  
  if (pathname.startsWith('/api/files') && ['POST', 'PUT'].includes(method)) {
    return 'FILE_UPLOAD';
  }
  
  if (pathname.startsWith('/widget') || pathname.startsWith('/api/widget')) {
    return 'WIDGET';
  }
  
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return 'API_WRITE';
  }
  
  return 'API_GENERAL';
}

/**
 * Create standardized security response
 */
function createSecurityResponse(
  message: string,
  status: number,
  metadata?: Record<string, any>
): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      error: message,
      ...(metadata && { metadata }),
    },
    { status }
  );
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  if (metadata?.retryAfter) {
    response.headers.set('Retry-After', metadata.retryAfter.toString());
  }
  
  return response;
}

/**
 * Apply comprehensive security headers to response
 */
export function applySecurityHeaders(
  response: NextResponse,
  options: {
    csp?: string;
    hsts?: boolean;
    noIndex?: boolean;
  } = {}
): NextResponse {
  const { csp, hsts = true, noIndex = false } = options;
  
  // Basic security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HSTS (HTTP Strict Transport Security)
  if (hsts && process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }
  
  // Content Security Policy
  if (csp) {
    response.headers.set('Content-Security-Policy', csp);
  }
  
  // Prevent search engine indexing for sensitive pages
  if (noIndex) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  
  // Performance and caching headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  
  return response;
}

/**
 * Enhanced middleware for API routes
 */
export async function apiSecurityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const config: SecurityMiddlewareConfig = {
    enableCSRF: true,
    enableCORS: true,
    enableRateLimit: true,
    enableSessionValidation: true,
    enableSecurityHeaders: true,
  };
  
  return await securityMiddleware(request, config);
}

/**
 * Enhanced middleware for admin routes
 */
export async function adminSecurityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const config: SecurityMiddlewareConfig = {
    enableCSRF: true,
    enableCORS: true, // More restrictive CORS for admin
    enableRateLimit: true,
    enableSessionValidation: true,
    enableSecurityHeaders: true,
  };
  
  const result = await securityMiddleware(request, config);
  if (result) return result;
  
  // Additional admin-specific security checks
  const sessionValidation = await validateSecureSession(request);
  if (!sessionValidation.valid || !sessionValidation.user) {
    return createSecurityResponse("Admin authentication required", 401);
  }
  
  // Check admin permissions
  const user = sessionValidation.user;
  if (user.permissions !== 'admin') {
    return createSecurityResponse("Admin access required", 403);
  }
  
  return null;
}

/**
 * Widget-specific middleware (more permissive)
 */
export async function widgetSecurityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const config: SecurityMiddlewareConfig = {
    enableCSRF: false, // Widgets typically don't use CSRF
    enableCORS: true,  // Very permissive CORS for embedding
    enableRateLimit: true,
    enableSessionValidation: false, // Widgets may not require auth
    enableSecurityHeaders: false, // Minimal headers for embedding
  };
  
  return await securityMiddleware(request, config);
}

/**
 * Security monitoring and logging
 */
export function logSecurityEvent(
  type: 'rate_limit' | 'csrf_failure' | 'auth_failure' | 'cors_violation' | 'suspicious_activity',
  request: NextRequest,
  details?: Record<string, any>
): void {
  const event = {
    type,
    timestamp: new Date().toISOString(),
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    url: request.url,
    method: request.method,
    ...(details && { details }),
  };
  
  // Log to security monitoring system
  console.warn('Security Event:', event);
  
  // In production, send to security monitoring service
  // await sendToSecurityMonitoring(event);
}

/**
 * Detect suspicious activity patterns
 */
export function detectSuspiciousActivity(request: NextRequest): {
  suspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;
  
  // Check for suspicious user agents
  const suspiciousUAPatterns = [
    /sqlmap/i,
    /nmap/i,
    /masscan/i,
    /nikto/i,
    /dirb/i,
    /gobuster/i,
  ];
  
  if (suspiciousUAPatterns.some(pattern => pattern.test(userAgent))) {
    reasons.push('Suspicious user agent detected');
  }
  
  // Check for path traversal attempts
  if (pathname.includes('../') || pathname.includes('..\\')) {
    reasons.push('Path traversal attempt detected');
  }
  
  // Check for common attack patterns in URL
  const attackPatterns = [
    /\<script/i,
    /javascript:/i,
    /union\+select/i,
    /drop\+table/i,
    /\.\.\/etc\/passwd/i,
  ];
  
  if (attackPatterns.some(pattern => pattern.test(request.url))) {
    reasons.push('Attack pattern in URL detected');
  }
  
  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Create a combined security middleware function
 */
export function createSecurityMiddleware(
  customConfig?: Partial<SecurityMiddlewareConfig>
) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Check for suspicious activity first
    const suspiciousActivity = detectSuspiciousActivity(request);
    if (suspiciousActivity.suspicious) {
      logSecurityEvent('suspicious_activity', request, {
        reasons: suspiciousActivity.reasons,
      });
      
      // For now, log but don't block (in production, you might want to block)
    }
    
    return await securityMiddleware(request, customConfig);
  };
}