// Server-side crypto polyfill that prevents client-side bundling

let cryptoModule: any = null;

function getCrypto() {
  if (typeof window !== 'undefined') {
    throw new Error('Node.js crypto module cannot be used in browser environment');
  }
  
  if (!cryptoModule) {
    cryptoModule = eval('require')('crypto');
  }
  
  return cryptoModule;
}

export function createHash(algorithm: string) {
  return getCrypto().createHash(algorithm);
}

export function createHmac(algorithm: string, key: string | Buffer) {
  return getCrypto().createHmac(algorithm, key);
}

export function randomUUID() {
  return getCrypto().randomUUID();
}

export function randomBytes(size: number) {
  return getCrypto().randomBytes(size);
}

export function timingSafeEqual(a: Buffer, b: Buffer) {
  return getCrypto().timingSafeEqual(a, b);
}

export function createCipheriv(algorithm: string, key: Buffer, iv: Buffer) {
  return getCrypto().createCipheriv(algorithm, key, iv);
}

export function createDecipheriv(algorithm: string, key: Buffer, iv: Buffer) {
  return getCrypto().createDecipheriv(algorithm, key, iv);
}

export default getCrypto;