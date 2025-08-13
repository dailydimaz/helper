import { createHash } from "@/lib/crypto-polyfill";

// Simple virus signature patterns (in production, use ClamAV or similar)
const VIRUS_SIGNATURES = new Set([
  // Common virus file signatures (hex patterns)
  '4d5a', // PE executable header
  '7f454c46', // ELF executable header
  'cafebabe', // Java class file
  'feedface', // Mach-O binary (32-bit)
  'feedfacf', // Mach-O binary (64-bit)
  'cefaedfe', // Mach-O binary (reverse byte order)
  'cffa'      // Mach-O fat binary
]);

// Suspicious file content patterns
const SUSPICIOUS_PATTERNS = [
  // Script injection patterns
  /<script[^>]*>/i,
  /javascript:/i,
  /vbscript:/i,
  /on\w+\s*=/i,
  
  // Command injection patterns
  /\$\(/,
  /`[^`]*`/,
  /\|\s*\w+/,
  /&&\s*\w+/,
  
  // SQL injection patterns
  /union\s+select/i,
  /drop\s+table/i,
  /delete\s+from/i,
  /insert\s+into/i,
  
  // Path traversal
  /\.\.[\\/]/,
  /\.\.%/,
  
  // PHP/ASP web shells
  /<\?php/i,
  /<%[\s\S]*%>/,
  /eval\s*\(/i,
  /base64_decode/i,
  /system\s*\(/i,
  /exec\s*\(/i,
  /shell_exec/i,
];

export interface ScanResult {
  clean: boolean;
  threats: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  fileHash: string;
  scanTime: number;
}

export interface FileMetadata {
  filename: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

/**
 * Comprehensive file security scan
 */
export async function scanFile(file: FileMetadata): Promise<ScanResult> {
  const startTime = Date.now();
  const fileHash = createHash('sha256').update(file.buffer).digest('hex');
  const threats: string[] = [];
  
  // 1. Check file signatures
  const signatureThreats = checkFileSignatures(file.buffer);
  threats.push(...signatureThreats);
  
  // 2. Check suspicious content patterns
  const contentThreats = checkSuspiciousContent(file.buffer, file.mimeType);
  threats.push(...contentThreats);
  
  // 3. Check against known malicious hashes
  const hashThreat = await checkMaliciousHash(fileHash);
  if (hashThreat) threats.push(hashThreat);
  
  // 4. File structure analysis
  const structureThreats = analyzeFileStructure(file);
  threats.push(...structureThreats);
  
  // 5. Size-based anomaly detection
  const sizeThreat = checkFileSize(file);
  if (sizeThreat) threats.push(sizeThreat);
  
  // Determine risk level
  const riskLevel = calculateRiskLevel(threats);
  
  return {
    clean: threats.length === 0,
    threats,
    riskLevel,
    fileHash,
    scanTime: Date.now() - startTime,
  };
}

/**
 * Check file signatures against known malicious patterns
 */
function checkFileSignatures(buffer: Buffer): string[] {
  const threats: string[] = [];
  const header = buffer.slice(0, 16).toString('hex').toLowerCase();
  
  for (const signature of VIRUS_SIGNATURES) {
    if (header.startsWith(signature)) {
      threats.push(`Suspicious file signature: ${signature}`);
    }
  }
  
  return threats;
}

/**
 * Check file content for suspicious patterns
 */
function checkSuspiciousContent(buffer: Buffer, mimeType: string): string[] {
  const threats: string[] = [];
  const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
  
  // Only scan text-based files for content patterns
  const textMimeTypes = [
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',
    'text/xml',
  ];
  
  if (!textMimeTypes.some(type => mimeType.includes(type))) {
    return threats;
  }
  
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      threats.push(`Suspicious content pattern detected: ${pattern.source}`);
    }
  }
  
  return threats;
}

/**
 * Check file hash against known malicious file database
 * In production, this would query a threat intelligence service
 */
async function checkMaliciousHash(hash: string): Promise<string | null> {
  // Simple in-memory blacklist (in production, use Redis or external service)
  const maliciousHashes = new Set([
    // Example known malicious file hashes
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // empty file
  ]);
  
  if (maliciousHashes.has(hash)) {
    return `File matches known malicious hash: ${hash}`;
  }
  
  return null;
}

/**
 * Analyze file structure for anomalies
 */
function analyzeFileStructure(file: FileMetadata): string[] {
  const threats: string[] = [];
  const { filename, mimeType, buffer } = file;
  
  // Check for file extension mismatch
  const extension = filename.split('.').pop()?.toLowerCase();
  const expectedMimeTypes = getExpectedMimeTypes(extension);
  
  if (expectedMimeTypes.length > 0 && !expectedMimeTypes.includes(mimeType)) {
    threats.push(`File extension "${extension}" doesn't match MIME type "${mimeType}"`);
  }
  
  // Check for polyglot files (files that are valid in multiple formats)
  if (isPolyglotFile(buffer)) {
    threats.push('File appears to be a polyglot (valid in multiple formats)');
  }
  
  // Check for embedded executables in images
  if (mimeType.startsWith('image/') && containsExecutableCode(buffer)) {
    threats.push('Image file contains embedded executable code');
  }
  
  // Check for excessive metadata in images
  if (mimeType.startsWith('image/') && hasExcessiveMetadata(buffer)) {
    threats.push('Image file contains excessive metadata that may hide malicious content');
  }
  
  return threats;
}

/**
 * Check for suspicious file sizes
 */
function checkFileSize(file: FileMetadata): string | null {
  const { filename, size, mimeType } = file;
  
  // Check for suspiciously small files with dangerous extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif'];
  const extension = filename.toLowerCase();
  
  if (dangerousExtensions.some(ext => extension.endsWith(ext)) && size < 100) {
    return 'Suspiciously small executable file';
  }
  
  // Check for suspiciously large text files (may contain hidden data)
  if (mimeType.startsWith('text/') && size > 1024 * 1024) { // 1MB
    return 'Unusually large text file';
  }
  
  return null;
}

/**
 * Get expected MIME types for file extension
 */
function getExpectedMimeTypes(extension: string | undefined): string[] {
  if (!extension) return [];
  
  const mimeMap: Record<string, string[]> = {
    'txt': ['text/plain'],
    'html': ['text/html'],
    'css': ['text/css'],
    'js': ['text/javascript', 'application/javascript'],
    'json': ['application/json'],
    'xml': ['application/xml', 'text/xml'],
    'pdf': ['application/pdf'],
    'jpg': ['image/jpeg'],
    'jpeg': ['image/jpeg'],
    'png': ['image/png'],
    'gif': ['image/gif'],
    'webp': ['image/webp'],
    'svg': ['image/svg+xml'],
    'mp4': ['video/mp4'],
    'webm': ['video/webm'],
    'mp3': ['audio/mpeg'],
    'wav': ['audio/wav'],
    'zip': ['application/zip'],
    'doc': ['application/msword'],
    'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'xls': ['application/vnd.ms-excel'],
    'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  };
  
  return mimeMap[extension.toLowerCase()] || [];
}

/**
 * Check if file is a polyglot (valid in multiple formats)
 */
function isPolyglotFile(buffer: Buffer): boolean {
  // Check for common polyglot signatures
  const content = buffer.toString('hex', 0, 16).toLowerCase();
  
  // Example: File that starts with both HTML and PDF signatures
  const htmlStart = buffer.toString('utf8', 0, 14).toLowerCase();
  if (htmlStart.includes('<!doctype html') && content.includes('255044462d')) {
    return true;
  }
  
  return false;
}

/**
 * Check if image contains embedded executable code
 */
function containsExecutableCode(buffer: Buffer): boolean {
  // Look for executable signatures within the file
  const content = buffer.toString('hex').toLowerCase();
  
  // Check for embedded PE executables
  if (content.includes('4d5a') && content.includes('50450000')) {
    return true;
  }
  
  // Check for embedded ELF executables
  if (content.includes('7f454c46')) {
    return true;
  }
  
  return false;
}

/**
 * Check if image has excessive metadata
 */
function hasExcessiveMetadata(buffer: Buffer): boolean {
  // Simple heuristic: if first 1KB is not typical image data
  const header = buffer.slice(0, 1024);
  const nonImageData = header.filter(byte => byte < 32 || byte > 126).length;
  
  // If less than 50% of header looks like binary image data, might be suspicious
  return nonImageData < header.length * 0.5;
}

/**
 * Calculate risk level based on threats found
 */
function calculateRiskLevel(threats: string[]): 'low' | 'medium' | 'high' | 'critical' {
  if (threats.length === 0) return 'low';
  
  const highRiskKeywords = [
    'executable',
    'malicious hash',
    'virus signature',
    'shell',
    'injection',
  ];
  
  const criticalRiskKeywords = [
    'known malicious',
    'virus',
    'trojan',
    'malware',
  ];
  
  for (const threat of threats) {
    const lowerThreat = threat.toLowerCase();
    if (criticalRiskKeywords.some(keyword => lowerThreat.includes(keyword))) {
      return 'critical';
    }
    if (highRiskKeywords.some(keyword => lowerThreat.includes(keyword))) {
      return 'high';
    }
  }
  
  return threats.length > 2 ? 'medium' : 'low';
}

/**
 * Quarantine file (move to secure location)
 */
export async function quarantineFile(
  fileHash: string, 
  scanResult: ScanResult,
  originalPath?: string
): Promise<void> {
  // In production, move file to quarantine directory
  console.warn(`File quarantined: ${fileHash}`, {
    threats: scanResult.threats,
    riskLevel: scanResult.riskLevel,
    originalPath,
  });
  
  // Log to security monitoring system
  await logSecurityEvent({
    type: 'file_quarantined',
    fileHash,
    threats: scanResult.threats,
    riskLevel: scanResult.riskLevel,
    timestamp: new Date(),
  });
}

/**
 * Log security events for monitoring
 */
async function logSecurityEvent(event: {
  type: string;
  fileHash: string;
  threats: string[];
  riskLevel: string;
  timestamp: Date;
}): Promise<void> {
  // In production, send to security monitoring system
  console.log('Security Event:', event);
}

/**
 * Batch scan multiple files
 */
export async function batchScanFiles(files: FileMetadata[]): Promise<Map<string, ScanResult>> {
  const results = new Map<string, ScanResult>();
  
  // Process files in parallel but limit concurrency
  const concurrency = 5;
  const batches = [];
  
  for (let i = 0; i < files.length; i += concurrency) {
    batches.push(files.slice(i, i + concurrency));
  }
  
  for (const batch of batches) {
    const scanPromises = batch.map(async (file) => {
      const result = await scanFile(file);
      return { filename: file.filename, result };
    });
    
    const batchResults = await Promise.all(scanPromises);
    batchResults.forEach(({ filename, result }) => {
      results.set(filename, result);
    });
  }
  
  return results;
}

/**
 * Update virus signatures (in production, fetch from threat intelligence)
 */
export async function updateVirusSignatures(): Promise<void> {
  // In production, fetch latest signatures from threat intelligence feeds
  console.log('Virus signatures updated');
}

/**
 * Real-time scanning integration (for streaming uploads)
 */
export async function scanFileStream(
  stream: ReadableStream<Uint8Array>,
  filename: string,
  mimeType: string
): Promise<ScanResult> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const buffer = Buffer.concat(chunks);
    
    return await scanFile({
      filename,
      mimeType,
      size: buffer.length,
      buffer,
    });
  } finally {
    reader.releaseLock();
  }
}