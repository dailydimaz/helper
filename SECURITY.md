# Security Implementation Guide

This document outlines the comprehensive security measures implemented in the application and provides deployment guidelines.

## Security Architecture Overview

### 1. Authentication & Authorization
- **Password Hashing**: Argon2id with memory cost 2^16, time cost 3, parallelism 1
- **JWT Tokens**: HS256 algorithm with secure secrets (min 32 characters)
- **Session Management**: Secure session storage with rotation and invalidation
- **Brute Force Protection**: Progressive rate limiting with IP and email tracking
- **Session Security**: IP and User-Agent validation, automatic rotation

### 2. API Security
- **Rate Limiting**: Configurable limits per endpoint type (login: 5/15min, API: 60/min)
- **CORS Protection**: Context-aware CORS policies (strict for admin, permissive for widgets)
- **CSRF Protection**: Double-submit cookies with JWT-based tokens
- **Input Validation**: Zod schema validation for all API endpoints
- **SQL Injection Prevention**: Query sanitization and pattern detection

### 3. File Upload Security
- **File Validation**: MIME type checking, extension validation, size limits
- **Virus Scanning**: Multi-layer file analysis (signatures, content patterns, structure)
- **Content Security**: File quarantine, integrity verification, secure storage
- **Rate Limiting**: Upload-specific rate limiting (10 uploads/minute)

### 4. Database Security
- **Connection Security**: SSL enforcement, credential validation
- **Query Monitoring**: Slow query detection, error rate monitoring
- **SQL Injection Detection**: Pattern-based detection with risk assessment
- **Access Control**: Minimal privilege principles, connection limits

### 5. Network Security
- **Security Headers**: Comprehensive HTTP security headers
- **TLS/SSL**: HSTS enforcement, secure cookie settings
- **Content Security Policy**: Context-aware CSP rules
- **Origin Validation**: Request origin verification

## Implementation Details

### Rate Limiting Configuration

```typescript
const RATE_LIMIT_CONFIGS = {
  LOGIN: { windowMs: 15 * 60 * 1000, maxAttempts: 5, blockDurationMs: 30 * 60 * 1000 },
  REGISTER: { windowMs: 60 * 60 * 1000, maxAttempts: 3, blockDurationMs: 60 * 60 * 1000 },
  API_GENERAL: { windowMs: 60 * 1000, maxAttempts: 60 },
  FILE_UPLOAD: { windowMs: 60 * 1000, maxAttempts: 10, blockDurationMs: 5 * 60 * 1000 },
};
```

### CORS Configuration

```typescript
// Different CORS policies for different endpoint types
const CORS_CONFIGS = {
  ADMIN: { allowedOrigins: [APP_URL, "https://helperai.dev"], credentials: true },
  AUTH: { allowedOrigins: [APP_URL, "https://helperai.dev", "http://localhost:3010"], credentials: true },
  WIDGET: { allowedOrigins: ["*"], credentials: false },
  FILES: { allowedHeaders: [...defaultHeaders, "X-File-Name", "X-File-Type"] }
};
```

### Password Security

```typescript
// Password strength requirements:
- Minimum 8 characters (recommended 12+)
- At least 3 of: lowercase, uppercase, numbers, symbols
- No common patterns, dictionary words, or sequential characters
- Compromise checking against known breached passwords
```

### File Upload Security

```typescript
// Multi-layer file scanning:
1. File signature validation
2. MIME type verification
3. Suspicious content pattern detection
4. File structure analysis
5. Size-based anomaly detection
6. Malicious hash checking
```

## Security Headers

The application applies comprehensive security headers:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: frame-ancestors 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

## Environment Security

### Required Environment Variables

```bash
# JWT Authentication (CRITICAL)
JWT_SECRET=<32+ character random string>
JWT_EXPIRES_IN=7d

# Database Encryption (CRITICAL)
ENCRYPT_COLUMN_SECRET=<32-character hex string>

# Database Connection (CRITICAL)
DATABASE_URL=postgresql://user:password@host:5432/database

# Optional but Recommended
HASH_WORDS_SECRET=<separate key for search indexing>
PROXY_SECRET_KEY=<key for asset proxying>
```

### Security Validations

```typescript
// Environment validation ensures:
- JWT_SECRET is at least 32 characters
- ENCRYPT_COLUMN_SECRET is exactly 32 hex characters
- DATABASE_URL is properly formatted
- Production environment has proper HTTPS URLs
```

## Deployment Checklist

### Pre-Deployment Security Checklist

#### 1. Environment Configuration
- [ ] All required environment variables are set
- [ ] JWT_SECRET is cryptographically secure (32+ characters)
- [ ] ENCRYPT_COLUMN_SECRET is properly generated hex string
- [ ] Database credentials are unique and strong
- [ ] All URLs use HTTPS in production
- [ ] No development secrets in production environment

#### 2. Database Security
- [ ] Database connection uses SSL
- [ ] Database user has minimal required permissions
- [ ] Query logging is enabled for security monitoring
- [ ] Backup system is configured and tested
- [ ] Connection pooling limits are appropriate

#### 3. Application Security
- [ ] All API endpoints have proper authentication
- [ ] Rate limiting is configured for all endpoint types
- [ ] CORS policies are restrictive and appropriate
- [ ] CSRF protection is enabled for state-changing operations
- [ ] File upload limits and validation are in place
- [ ] Security headers are properly configured

#### 4. Monitoring and Logging
- [ ] Security event logging is configured
- [ ] Rate limiting violations are monitored
- [ ] Failed authentication attempts are logged
- [ ] File upload security events are tracked
- [ ] Database query performance is monitored

#### 5. Infrastructure Security
- [ ] TLS/SSL certificates are valid and up to date
- [ ] HSTS is enabled with appropriate max-age
- [ ] CDN security settings are configured
- [ ] Load balancer security is properly configured
- [ ] Network access controls are in place

### Post-Deployment Verification

#### 1. Security Headers Test
```bash
# Test security headers
curl -I https://your-domain.com/
# Should include all required security headers
```

#### 2. Rate Limiting Test
```bash
# Test rate limiting
for i in {1..10}; do curl -X POST https://your-domain.com/api/auth/login; done
# Should return 429 after configured limit
```

#### 3. CORS Test
```bash
# Test CORS policies
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://your-domain.com/api/auth/login
# Should reject unauthorized origins
```

#### 4. Authentication Test
```bash
# Test authentication requirements
curl https://your-domain.com/api/adm/users
# Should return 401 without valid token
```

## Security Monitoring

### Key Metrics to Monitor

1. **Authentication Security**
   - Failed login attempts per IP/user
   - Account lockouts and brute force attempts
   - Suspicious login patterns (location, time)

2. **API Security**
   - Rate limiting violations by endpoint
   - CORS violations and blocked origins
   - CSRF token validation failures

3. **File Upload Security**
   - Files quarantined due to security threats
   - Upload rate limiting violations
   - Virus scanning results and threat levels

4. **Database Security**
   - Slow query detection and optimization needs
   - SQL injection attempt patterns
   - Connection security and SSL usage

### Security Event Logging

All security events are logged with the following structure:

```typescript
interface SecurityEvent {
  type: 'rate_limit' | 'csrf_failure' | 'auth_failure' | 'cors_violation' | 'suspicious_activity';
  timestamp: string;
  ip: string;
  userAgent: string;
  url: string;
  method: string;
  details?: Record<string, any>;
}
```

### Incident Response

1. **Rate Limiting Violations**
   - Monitor for distributed attacks
   - Adjust rate limits if needed
   - Consider IP blocking for persistent violators

2. **Authentication Failures**
   - Investigate brute force patterns
   - Consider account lockouts for targeted attacks
   - Monitor for credential stuffing attempts

3. **File Upload Threats**
   - Quarantine suspicious files immediately
   - Analyze threat patterns for new signatures
   - Update virus scanning rules as needed

4. **Database Security Issues**
   - Investigate SQL injection attempts immediately
   - Review and optimize slow queries
   - Monitor for privilege escalation attempts

## Security Updates

### Regular Maintenance Tasks

1. **Weekly Tasks**
   - Review security event logs
   - Check rate limiting statistics
   - Verify backup integrity
   - Update virus scanning signatures

2. **Monthly Tasks**
   - Review and rotate JWT secrets if needed
   - Audit user permissions and access
   - Test incident response procedures
   - Review security header configurations

3. **Quarterly Tasks**
   - Full security audit and penetration testing
   - Review and update security policies
   - Update dependency vulnerabilities
   - Review and update rate limiting configurations

### Security Dependencies

Keep these dependencies updated for security patches:
- `argon2` (password hashing)
- `jose` (JWT implementation)
- `drizzle-orm` (database ORM)
- `next` (Next.js framework)
- `zod` (input validation)

### Security Contact

For security issues or questions:
- Review this documentation first
- Check security event logs for patterns
- Test changes in development environment
- Monitor production metrics after changes

## Additional Security Considerations

### 1. Content Security Policy (CSP)
- Admin pages have strict CSP policies
- Widget embeds have permissive policies for functionality
- Regular review and updates of CSP rules

### 2. Data Privacy
- Sensitive data encryption at rest
- Secure data transmission (TLS)
- Privacy-compliant logging practices
- Data retention and deletion policies

### 3. Third-Party Security
- Regular security audits of dependencies
- Monitoring for known vulnerabilities
- Secure integration with external APIs
- Validation of third-party data

### 4. Development Security
- Secure coding practices training
- Code review requirements for security changes
- Security testing in CI/CD pipeline
- Separate environments for development/production

This security implementation provides defense-in-depth protection against common web application vulnerabilities while maintaining usability and performance. Regular monitoring and maintenance are essential for continued security effectiveness.