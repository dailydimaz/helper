// Browser-compatible crypto utilities

async function createHmacSha256(secret: string, message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment - use Web Crypto API
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(message));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js environment
    const crypto = eval('require')('crypto');
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }
}

async function createHmacSha256Base64(secret: string, message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment - use Web Crypto API
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(message));
    const hashArray = Array.from(new Uint8Array(signature));
    const base64 = btoa(String.fromCharCode.apply(null, hashArray));
    return base64;
  } else {
    // Node.js environment
    const crypto = eval('require')('crypto');
    return crypto.createHmac('sha256', secret).update(message).digest('base64');
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (typeof window !== 'undefined') {
    // Browser environment - simple comparison (not timing-safe but acceptable for client)
    return a === b;
  } else {
    // Node.js environment
    const crypto = eval('require')('crypto');
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) return false;
    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}

export { createHmacSha256, createHmacSha256Base64, timingSafeEqual };