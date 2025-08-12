import { NextRequest } from "next/server";

// In-memory storage for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number; blocked?: number }>();

export interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxAttempts: number; // Maximum attempts allowed
  blockDurationMs?: number; // How long to block after exceeding limit
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blocked: boolean;
  retryAfter?: number;
}

// Rate limiting configurations for different endpoints
export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints - more restrictive
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    blockDurationMs: 30 * 60 * 1000, // 30 minutes block after exceeding
  },
  REGISTER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000, // 1 hour block
  },
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDurationMs: 60 * 60 * 1000, // 1 hour block
  },
  
  // API endpoints - moderate restrictions
  API_GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 60,
  },
  API_WRITE: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 30,
  },
  
  // File upload - more restrictive
  FILE_UPLOAD: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 10,
    blockDurationMs: 5 * 60 * 1000, // 5 minutes block
  },
  
  // Widget endpoints - less restrictive for public access
  WIDGET: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 120,
  },
} as const;

/**
 * Get client identifier for rate limiting
 */
export function getClientId(request: NextRequest): string {
  // Try multiple methods to identify the client
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnecting = request.headers.get('cf-connecting-ip');
  
  const ip = forwarded?.split(',')[0] || realIp || cfConnecting || 'unknown';
  
  // Include user agent for additional uniqueness while preserving anonymity
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const userAgentHash = Buffer.from(userAgent).toString('base64').slice(0, 8);
  
  return `${ip}:${userAgentHash}`;
}

/**
 * Check rate limit for a given identifier and configuration
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  // Check if currently blocked
  if (record?.blocked && now < record.blocked) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      blocked: true,
      retryAfter: Math.ceil((record.blocked - now) / 1000),
    };
  }
  
  // If no record or window has expired, create new record
  if (!record || now > record.resetTime) {
    const resetTime = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetTime,
      blocked: false,
    };
  }
  
  // Check if limit exceeded
  if (record.count >= config.maxAttempts) {
    // Apply block if configured
    if (config.blockDurationMs) {
      record.blocked = now + config.blockDurationMs;
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        blocked: true,
        retryAfter: Math.ceil(config.blockDurationMs / 1000),
      };
    }
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      blocked: false,
    };
  }
  
  // Increment count
  record.count++;
  
  return {
    allowed: true,
    remaining: config.maxAttempts - record.count,
    resetTime: record.resetTime,
    blocked: false,
  };
}

/**
 * Rate limit middleware for different endpoint types
 */
export function rateLimit(request: NextRequest, type: keyof typeof RATE_LIMIT_CONFIGS): RateLimitResult {
  const clientId = getClientId(request);
  const config = RATE_LIMIT_CONFIGS[type];
  const key = `${type}:${clientId}`;
  
  return checkRateLimit(key, config);
}

/**
 * Enhanced rate limiting with progressive penalties
 */
export function progressiveRateLimit(
  identifier: string, 
  baseConfig: RateLimitConfig,
  attemptType: 'success' | 'failure'
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (attemptType === 'success') {
    // Reset on successful attempt
    rateLimitStore.delete(identifier);
    return {
      allowed: true,
      remaining: baseConfig.maxAttempts,
      resetTime: now + baseConfig.windowMs,
      blocked: false,
    };
  }
  
  // Handle failure - apply progressive penalties
  if (!record || now > record.resetTime) {
    const resetTime = now + baseConfig.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    
    return {
      allowed: true,
      remaining: baseConfig.maxAttempts - 1,
      resetTime,
      blocked: false,
    };
  }
  
  record.count++;
  
  // Progressive blocking - longer blocks for repeated failures
  if (record.count >= baseConfig.maxAttempts && baseConfig.blockDurationMs) {
    const multiplier = Math.min(Math.floor(record.count / baseConfig.maxAttempts), 5);
    const blockDuration = baseConfig.blockDurationMs * multiplier;
    
    record.blocked = now + blockDuration;
    
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      blocked: true,
      retryAfter: Math.ceil(blockDuration / 1000),
    };
  }
  
  return {
    allowed: record.count < baseConfig.maxAttempts,
    remaining: Math.max(0, baseConfig.maxAttempts - record.count),
    resetTime: record.resetTime,
    blocked: false,
  };
}

/**
 * Clean up expired rate limit records
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime && (!record.blocked || now > record.blocked)) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get rate limit stats for monitoring
 */
export function getRateLimitStats(): {
  totalRecords: number;
  blockedRecords: number;
  activeWindows: number;
} {
  const now = Date.now();
  let blockedRecords = 0;
  let activeWindows = 0;
  
  for (const record of rateLimitStore.values()) {
    if (record.blocked && now < record.blocked) {
      blockedRecords++;
    }
    if (now <= record.resetTime) {
      activeWindows++;
    }
  }
  
  return {
    totalRecords: rateLimitStore.size,
    blockedRecords,
    activeWindows,
  };
}

// Clean up expired records every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

/**
 * Brute force protection specifically for authentication attempts
 */
export function checkBruteForce(
  email: string,
  ip: string,
  attemptType: 'success' | 'failure'
): RateLimitResult {
  // Use both email and IP for tracking
  const emailKey = `brute_force_email:${email}`;
  const ipKey = `brute_force_ip:${ip}`;
  
  // Check email-based rate limiting
  const emailResult = progressiveRateLimit(emailKey, {
    windowMs: 30 * 60 * 1000, // 30 minutes
    maxAttempts: 5,
    blockDurationMs: 60 * 60 * 1000, // 1 hour block
  }, attemptType);
  
  // Check IP-based rate limiting
  const ipResult = progressiveRateLimit(ipKey, {
    windowMs: 30 * 60 * 1000, // 30 minutes
    maxAttempts: 10, // More lenient for IP (shared IPs)
    blockDurationMs: 30 * 60 * 1000, // 30 minutes block
  }, attemptType);
  
  // Return the more restrictive result
  if (!emailResult.allowed || !ipResult.allowed) {
    return {
      allowed: false,
      remaining: Math.min(emailResult.remaining, ipResult.remaining),
      resetTime: Math.max(emailResult.resetTime, ipResult.resetTime),
      blocked: emailResult.blocked || ipResult.blocked,
      retryAfter: Math.max(emailResult.retryAfter || 0, ipResult.retryAfter || 0),
    };
  }
  
  return {
    allowed: true,
    remaining: Math.min(emailResult.remaining, ipResult.remaining),
    resetTime: Math.max(emailResult.resetTime, ipResult.resetTime),
    blocked: false,
  };
}