import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createSecurityMiddleware, applySecurityHeaders, logSecurityEvent } from "@/lib/security/middleware";

const jwtSecretEnv = process.env.JWT_SECRET;
if (!jwtSecretEnv) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretEnv);
const COOKIE_NAME = 'auth-token';

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/adm',
  '/mine', 
  '/api/adm',
];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth',
  '/widget',
  '/api/widget',
  '/api/health',
];

async function verifyAuth(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return false;

    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// Create security middleware instance (simplified for Edge Runtime)
const securityMiddleware = createSecurityMiddleware({
  enableCSRF: false, // Disabled for Edge Runtime compatibility
  enableCORS: true,
  enableRateLimit: false, // Disabled for Edge Runtime compatibility  
  enableSessionValidation: false, // Disabled for Edge Runtime compatibility
  enableSecurityHeaders: true,
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  try {
    // Apply security middleware first
    const securityResponse = await securityMiddleware(request);
    if (securityResponse) {
      return securityResponse;
    }

    // Skip authentication check for public routes
    if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
      const response = NextResponse.next();
      return applySecurityHeaders(response);
    }

    // Check if route requires authentication
    const requiresAuth = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

    if (requiresAuth) {
      const isAuthenticated = await verifyAuth(request);

      // Redirect to login if not authenticated
      if (!isAuthenticated) {
        logSecurityEvent('auth_failure', request, { reason: 'No valid token' });
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
      }

      // If authenticated and trying to access login, redirect to dashboard
      if (pathname.startsWith('/login')) {
        const dashboardUrl = new URL('/mine', request.url);
        return NextResponse.redirect(dashboardUrl);
      }
    }

    const response = NextResponse.next();
    return applySecurityHeaders(response, {
      csp: pathname.startsWith('/adm') 
        ? "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        : undefined,
      hsts: process.env.NODE_ENV === 'production',
      noIndex: pathname.startsWith('/adm'),
    });

  } catch (error) {
    console.error('Middleware error:', error);
    logSecurityEvent('suspicious_activity', request, { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    // Return a safe fallback response
    return NextResponse.json(
      { error: 'Request processing failed' },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
