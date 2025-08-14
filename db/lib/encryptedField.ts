import { customType } from "drizzle-orm/pg-core";
import { symmetricDecrypt, symmetricEncrypt } from "@/db/lib/crypto";

// Lazy-load environment variable to avoid client-side bundling
let encryptColumnSecret: string | null = null;

function getEncryptColumnSecret(): string {
  if (encryptColumnSecret === null) {
    // Only access env when actually needed (server-side only)
    if (typeof window !== 'undefined') {
      throw new Error('Encrypted fields cannot be used on the client side');
    }
    const { env } = eval('require')("@/lib/env");
    
    // Use fallback encryption secret for unused encrypted columns
    if (!env.ENCRYPT_COLUMN_SECRET) {
      // For development, use a predictable fallback
      if (process.env.NODE_ENV === 'development') {
        encryptColumnSecret = 'development-fallback-secret-32-chars';
      } else {
        throw new Error('ENCRYPT_COLUMN_SECRET is required for encrypted fields');
      }
    } else {
      encryptColumnSecret = env.ENCRYPT_COLUMN_SECRET;
    }
  }
  return encryptColumnSecret;
}

export const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const encryptedField = customType<{ data: string }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: string): Buffer {
    return Buffer.from(symmetricEncrypt(value, getEncryptColumnSecret()));
  },
  fromDriver(value: unknown): string {
    return decryptFieldValue(value);
  },
});

export const decryptFieldValue = (value: unknown): string => {
  const secret = getEncryptColumnSecret();
  if (typeof value === "string") {
    // Handle PostgreSQL bytea hex format with \x prefix
    if (value.startsWith("\\x")) {
      const hexString = value.slice(2); // Remove '\x' prefix
      const bufferValue = Buffer.from(hexString, "hex");
      return symmetricDecrypt(bufferValue.toString("utf-8"), secret);
    }
    return symmetricDecrypt(value, secret);
  } else if (Buffer.isBuffer(value)) {
    return symmetricDecrypt(value.toString("utf-8"), secret);
  }

  throw new Error(`Unexpected value type: ${typeof value}`);
};
