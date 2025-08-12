import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { invalidateAllUserSessions } from "@/lib/security/authEnhanced";
import { checkBruteForce } from "@/lib/security/rateLimiting";

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordChangeResult {
  success: boolean;
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number;
  requiresReauth?: boolean;
}

/**
 * Secure password change with session invalidation
 */
export async function changePasswordSecure(
  userId: string,
  request: NextRequest,
  passwords: PasswordChangeRequest
): Promise<PasswordChangeResult> {
  const { currentPassword, newPassword, confirmPassword } = passwords;
  
  try {
    // Get user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    
    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }
    
    // Rate limiting for password change attempts
    const ip = getClientIP(request);
    const bruteForceCheck = checkBruteForce(user.email, ip, 'failure');
    
    if (!bruteForceCheck.allowed) {
      return {
        success: false,
        error: "Too many password change attempts. Please try again later.",
        rateLimited: true,
        retryAfter: bruteForceCheck.retryAfter,
      };
    }
    
    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return {
        success: false,
        error: "Current password is incorrect",
      };
    }
    
    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: `New password is not secure enough: ${passwordValidation.errors.join(', ')}`,
      };
    }
    
    // Check password confirmation
    if (newPassword !== confirmPassword) {
      return {
        success: false,
        error: "New password and confirmation do not match",
      };
    }
    
    // Check if new password is different from current
    const isSamePassword = await verifyPassword(newPassword, user.password);
    if (isSamePassword) {
      return {
        success: false,
        error: "New password must be different from current password",
      };
    }
    
    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);
    
    // Update password in database
    await db
      .update(usersTable)
      .set({ 
        password: hashedNewPassword,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
    
    // Invalidate all existing sessions (forces re-login)
    await invalidateAllUserSessions(userId);
    
    // Reset brute force protection on success
    checkBruteForce(user.email, ip, 'success');
    
    // Log security event
    console.log(`Password changed for user ${userId}`, {
      userId,
      timestamp: new Date(),
      ip,
    });
    
    return {
      success: true,
      requiresReauth: true,
    };
    
  } catch (error) {
    console.error('Password change error:', error);
    return {
      success: false,
      error: "Failed to change password",
    };
  }
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number;
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;
  
  // Length check
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
    suggestions.push("Consider using a longer password (12+ characters)");
  }
  
  // Character variety checks
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const characterTypes = [hasLowercase, hasUppercase, hasNumbers, hasSymbols].filter(Boolean).length;
  
  if (characterTypes < 3) {
    errors.push("Password must contain at least 3 of: lowercase, uppercase, numbers, symbols");
  }
  
  score += characterTypes;
  
  // Common password patterns
  if (/^(.)\1+$/.test(password)) {
    errors.push("Password cannot be all the same character");
  }
  
  if (/^(.*?)\1+$/.test(password)) {
    errors.push("Password cannot be repeating patterns");
  }
  
  if (/^(0123456789|abcdefghij|qwertyuiop|asdfghjkl|zxcvbnm|9876543210)/i.test(password)) {
    errors.push("Password cannot be common keyboard patterns");
  }
  
  // Dictionary words (simple check)
  const commonWords = [
    'password', 'admin', 'user', 'login', 'welcome', 'hello', 'world',
    'test', 'demo', 'example', 'sample', '123456', 'qwerty', 'abc123'
  ];
  
  if (commonWords.some(word => password.toLowerCase().includes(word))) {
    errors.push("Password cannot contain common dictionary words");
  }
  
  // Sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    errors.push("Password cannot contain sequential characters");
  }
  
  // Bonus points for length
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;
  
  // Suggestions based on what's missing
  if (!hasLowercase) suggestions.push("Add lowercase letters");
  if (!hasUppercase) suggestions.push("Add uppercase letters");
  if (!hasNumbers) suggestions.push("Add numbers");
  if (!hasSymbols) suggestions.push("Add symbols (!@#$%^&*)");
  
  return {
    valid: errors.length === 0 && score >= 4,
    score: Math.min(score, 10),
    errors,
    suggestions,
  };
}

/**
 * Generate a secure password suggestion
 */
export function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Check if password has been compromised (basic check)
 * In production, you would use a service like HaveIBeenPwned
 */
export async function checkPasswordCompromised(password: string): Promise<boolean> {
  // Simple check against common compromised passwords
  const commonCompromisedPasswords = new Set([
    'password',
    '123456',
    '123456789',
    'qwerty',
    'abc123',
    'admin',
    'letmein',
    'welcome',
    'monkey',
    'dragon',
  ]);
  
  return commonCompromisedPasswords.has(password.toLowerCase());
}

/**
 * Password reset with enhanced security
 */
export async function resetPasswordSecure(
  token: string,
  newPassword: string,
  confirmPassword: string,
  request: NextRequest
): Promise<PasswordChangeResult> {
  try {
    // Verify reset token (implementation depends on your token system)
    const userId = await verifyPasswordResetToken(token);
    if (!userId) {
      return {
        success: false,
        error: "Invalid or expired password reset token",
      };
    }
    
    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: `Password is not secure enough: ${passwordValidation.errors.join(', ')}`,
      };
    }
    
    // Check password confirmation
    if (newPassword !== confirmPassword) {
      return {
        success: false,
        error: "Password and confirmation do not match",
      };
    }
    
    // Check if password has been compromised
    if (await checkPasswordCompromised(newPassword)) {
      return {
        success: false,
        error: "This password has been found in data breaches. Please choose a different password.",
      };
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update password
    await db
      .update(usersTable)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));
    
    // Invalidate all existing sessions
    await invalidateAllUserSessions(userId);
    
    // Log security event
    console.log(`Password reset for user ${userId}`, {
      userId,
      timestamp: new Date(),
      ip: getClientIP(request),
    });
    
    return {
      success: true,
      requiresReauth: true,
    };
    
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      success: false,
      error: "Failed to reset password",
    };
  }
}

/**
 * Helper function to get client IP
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Verify password reset token (placeholder implementation)
 */
async function verifyPasswordResetToken(token: string): Promise<string | null> {
  // This would verify the password reset token
  // Implementation depends on your token system
  // For now, return null to indicate invalid token
  return null;
}

/**
 * Account lockout after too many failed attempts
 */
export async function handleAccountLockout(userId: string): Promise<void> {
  // In a production system, you might:
  // 1. Set an account lockout flag in the database
  // 2. Send an email notification
  // 3. Log the security event
  // 4. Require admin intervention or time-based unlock
  
  console.warn(`Account lockout triggered for user ${userId}`, {
    userId,
    timestamp: new Date(),
    reason: 'Too many failed login attempts',
  });
}

/**
 * Force password change on next login
 */
export async function forcePasswordChange(userId: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ 
      // Add a field to track password change requirement
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
}