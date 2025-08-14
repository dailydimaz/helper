import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/db/client";
import { secretsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSecret, getOrCreateSecret, clearSecretCache, SECRET_NAMES } from "@/lib/secrets";

describe("Secrets Management", () => {
  beforeEach(async () => {
    // Clear any existing test secrets
    await db.delete(secretsTable).where(eq(secretsTable.name, SECRET_NAMES.JOBS_HMAC));
    clearSecretCache();
  });

  afterEach(async () => {
    // Clean up test secrets
    await db.delete(secretsTable).where(eq(secretsTable.name, SECRET_NAMES.JOBS_HMAC));
    clearSecretCache();
  });

  it("should create a new secret when none exists", async () => {
    const secret = await getOrCreateSecret("JOBS_HMAC");
    expect(secret).toBeDefined();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(0);
  });

  it("should return existing secret when it exists", async () => {
    const secret1 = await getOrCreateSecret("JOBS_HMAC");
    const secret2 = await getOrCreateSecret("JOBS_HMAC");
    
    expect(secret1).toBe(secret2);
  });

  it("should return null when secret does not exist", async () => {
    const secret = await getSecret("JOBS_HMAC");
    expect(secret).toBeNull();
  });

  it("should create secret with custom default value", async () => {
    const customValue = "test-custom-secret-value";
    const secret = await getOrCreateSecret("JOBS_HMAC", customValue);
    
    expect(secret).toBe(customValue);
  });

  it("should cache secrets to avoid repeated database queries", async () => {
    // First call creates the secret
    const secret1 = await getOrCreateSecret("JOBS_HMAC");
    
    // Second call should return cached value
    const secret2 = await getSecret("JOBS_HMAC");
    
    expect(secret1).toBe(secret2);
  });

  it("should handle encryption/decryption correctly", async () => {
    const originalValue = "test-secret-for-encryption";
    const secret = await getOrCreateSecret("JOBS_HMAC", originalValue);
    
    expect(secret).toBe(originalValue);
    
    // Verify it was actually stored encrypted in database
    const storedSecret = await db.query.secretsTable.findFirst({
      where: eq(secretsTable.name, SECRET_NAMES.JOBS_HMAC),
    });
    
    expect(storedSecret).toBeDefined();
    expect(storedSecret?.encryptedValue).not.toBe(originalValue);
    expect(storedSecret?.encryptedValue.length).toBeGreaterThan(0);
  });
});