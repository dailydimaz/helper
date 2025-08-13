// Mock for node:crypto to prevent client-side bundling
export default {};
export const createHash = () => { throw new Error('node:crypto not available in browser'); };
export const createHmac = () => { throw new Error('node:crypto not available in browser'); };
export const randomUUID = () => { throw new Error('node:crypto not available in browser'); };
export const randomBytes = () => { throw new Error('node:crypto not available in browser'); };
export const timingSafeEqual = () => { throw new Error('node:crypto not available in browser'); };
export const createCipheriv = () => { throw new Error('node:crypto not available in browser'); };
export const createDecipheriv = () => { throw new Error('node:crypto not available in browser'); };