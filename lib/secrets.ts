import { db } from "@/db/client";
import { secretsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { symmetricEncrypt, symmetricDecrypt } from "@/db/lib/crypto";

export const SECRET_NAMES = {
  JOBS_HMAC: "jobs_hmac",
  FALLBACK_ENCRYPTION: "fallback_encryption",
} as const;

type SecretName = keyof typeof SECRET_NAMES;

// Cache for secrets to avoid repeated database queries
const secretCache = new Map<string, string>();

/**
 * Retrieve a secret from the vault (database)
 * Cached for performance
 */
export async function getSecret(name: SecretName): Promise<string | null> {
  const secretKey = SECRET_NAMES[name];
  
  // Check cache first
  if (secretCache.has(secretKey)) {
    return secretCache.get(secretKey)!;
  }

  try {
    const secret = await db.query.secretsTable.findFirst({
      where: eq(secretsTable.name, secretKey),
    });

    if (!secret) {
      return null;
    }

    // Decrypt the secret value
    const decryptedValue = symmetricDecrypt(secret.encryptedValue, getFallbackEncryptionSecret());
    
    // Cache the decrypted value
    secretCache.set(secretKey, decryptedValue);
    
    return decryptedValue;
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretKey}:`, error);
    return null;
  }
}

/**
 * Create or update a secret in the vault
 */
export async function getOrCreateSecret(name: SecretName, defaultValue?: string): Promise<string> {
  const existingSecret = await getSecret(name);
  
  if (existingSecret) {
    return existingSecret;
  }

  // Generate a new secret if none exists
  const newSecretValue = defaultValue || generateRandomSecret();
  
  try {
    const secretKey = SECRET_NAMES[name];
    const encryptedValue = symmetricEncrypt(newSecretValue, getFallbackEncryptionSecret());
    
    await db.insert(secretsTable).values({
      name: secretKey,
      encryptedValue,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: secretsTable.name,
      set: {
        encryptedValue,
        updatedAt: new Date(),
      },
    });

    // Update cache
    secretCache.set(secretKey, newSecretValue);
    
    return newSecretValue;
  } catch (error) {
    console.error(`Failed to create/update secret ${SECRET_NAMES[name]}:`, error);
    throw error;
  }
}

/**
 * Generate a cryptographically secure random secret
 */
function generateRandomSecret(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomArray = new Uint8Array(length);
  
  if (typeof window !== 'undefined') {
    // Browser environment
    crypto.getRandomValues(randomArray);
  } else {
    // Node.js environment
    const crypto = require('crypto');
    crypto.randomFillSync(randomArray);
  }
  
  for (let i = 0; i < length; i++) {
    result += chars[randomArray[i] % chars.length];
  }
  
  return result;
}

/**
 * Get the fallback encryption secret for the vault itself
 * This is the only secret that remains in environment variables
 */
function getFallbackEncryptionSecret(): string {
  if (typeof window !== 'undefined') {
    throw new Error('Secrets cannot be accessed on the client side');
  }
  
  const { env } = eval('require')("@/lib/env");
  
  if (!env.ENCRYPT_COLUMN_SECRET) {
    // For development, use a predictable fallback
    if (process.env.NODE_ENV === 'development') {
      return 'development-fallback-secret-32-chars';
    }
    throw new Error('ENCRYPT_COLUMN_SECRET is required for vault encryption');
  }
  
  return env.ENCRYPT_COLUMN_SECRET;
}

/**
 * Clear the secret cache (useful for testing)
 */
export function clearSecretCache(): void {
  secretCache.clear();
}