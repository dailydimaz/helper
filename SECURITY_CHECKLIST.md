# Production Security Deployment Checklist

Use this checklist to ensure all security measures are properly configured before deploying to production.

## ✅ Pre-Deployment Checklist

### Environment Variables & Secrets

#### JWT Authentication (CRITICAL)
- [ ] `JWT_SECRET` is set and is at least 32 characters long
- [ ] `JWT_SECRET` is cryptographically secure (not a dictionary word or predictable pattern)
- [ ] `JWT_EXPIRES_IN` is set to appropriate duration (default: 7d)
- [ ] JWT secret is different from development environment

#### Database Security (CRITICAL)
- [ ] `DATABASE_URL` uses strong, unique credentials
- [ ] `ENCRYPT_COLUMN_SECRET` is exactly 32 hex characters
- [ ] `ENCRYPT_COLUMN_SECRET` is different from development
- [ ] Database connection uses SSL/TLS
- [ ] Database user has minimal required permissions (not root/postgres)

#### Application URLs (CRITICAL)
- [ ] `NEXT_PUBLIC_APP_URL` uses HTTPS in production
- [ ] `NEXT_PUBLIC_API_URL` uses HTTPS in production
- [ ] No localhost URLs in production environment

#### Optional Security Keys
- [ ] `HASH_WORDS_SECRET` is set for search functionality
- [ ] `PROXY_SECRET_KEY` is set for asset proxying
- [ ] All optional keys are unique and secure

### Rate Limiting Configuration

#### Authentication Endpoints
- [ ] Login rate limiting: 5 attempts per 15 minutes ✓
- [ ] Registration rate limiting: 3 attempts per hour ✓
- [ ] Password reset rate limiting: 3 attempts per hour ✓
- [ ] 30-minute block after exceeding login limit ✓

#### API Endpoints
- [ ] General API: 60 requests per minute ✓
- [ ] Write operations: 30 requests per minute ✓
- [ ] File uploads: 10 uploads per minute ✓
- [ ] Widget endpoints: 120 requests per minute ✓

### CORS Configuration

#### Admin Endpoints
- [ ] Admin CORS restricted to specific domains ✓
- [ ] No wildcard origins for admin endpoints ✓
- [ ] Credentials enabled for admin requests ✓

#### Authentication Endpoints
- [ ] Auth CORS restricted to app domains ✓
- [ ] Development localhost only in dev environment ✓
- [ ] Credentials enabled for auth requests ✓

#### Widget Endpoints
- [ ] Widget CORS allows embedding from any origin ✓
- [ ] Widget credentials disabled for security ✓
- [ ] Widget headers include necessary embedding headers ✓

### File Upload Security

#### File Validation
- [ ] File type restrictions implemented ✓
- [ ] File size limits enforced (25MB per file, 50MB total) ✓
- [ ] Dangerous extensions blocked (.exe, .bat, .cmd, etc.) ✓
- [ ] MIME type validation enabled ✓

#### Virus Scanning
- [ ] Multi-layer file scanning enabled ✓
- [ ] File signature validation ✓
- [ ] Suspicious content pattern detection ✓
- [ ] File quarantine system functional ✓

#### Upload Rate Limiting
- [ ] Upload rate limiting: 10 files per minute ✓
- [ ] 5-minute block after exceeding upload limit ✓
- [ ] Per-user upload tracking enabled ✓

### Database Security

#### Connection Security
- [ ] SSL/TLS enabled for database connections
- [ ] Database credentials are strong and unique
- [ ] Connection pooling limits configured
- [ ] Query timeout limits set (30 seconds)

#### SQL Injection Prevention
- [ ] Query sanitization enabled ✓
- [ ] Dangerous SQL pattern detection enabled ✓
- [ ] Parameter validation implemented ✓
- [ ] Query monitoring and logging enabled ✓

#### Access Control
- [ ] Database user has minimal required permissions
- [ ] No superuser access for application
- [ ] Query logging enabled for monitoring
- [ ] Regular security audits scheduled

### Security Headers

#### Required Headers
- [ ] `X-Content-Type-Options: nosniff` ✓
- [ ] `X-Frame-Options: DENY` ✓
- [ ] `X-XSS-Protection: 1; mode=block` ✓
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` ✓

#### HTTPS Security
- [ ] `Strict-Transport-Security` header set (production only) ✓
- [ ] HSTS max-age set to at least 1 year ✓
- [ ] HSTS includeSubDomains enabled ✓
- [ ] HSTS preload enabled for primary domain ✓

#### Content Security Policy
- [ ] CSP implemented for admin pages ✓
- [ ] CSP allows necessary resources only ✓
- [ ] CSP blocks inline scripts by default ✓
- [ ] Widget embeds have appropriate CSP ✓

## ✅ Deployment Verification

### Security Headers Test

```bash
# Test main application
curl -I https://your-domain.com/

# Expected headers:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

- [ ] All security headers present
- [ ] HSTS header includes correct max-age
- [ ] No sensitive information in headers

### Rate Limiting Verification

```bash
# Test login rate limiting
for i in {1..6}; do 
  curl -X POST https://your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done

# Expected: 429 status after 5 attempts
```

- [ ] Rate limiting blocks after configured attempts
- [ ] Proper 429 status code returned
- [ ] Retry-After header included

### Authentication Security

```bash
# Test protected endpoints without auth
curl -X GET https://your-domain.com/api/adm/users

# Expected: 401 status
```

- [ ] Protected endpoints require authentication
- [ ] Proper 401 status for unauthenticated requests
- [ ] No sensitive data exposed without auth

### CORS Verification

```bash
# Test CORS with unauthorized origin
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://your-domain.com/api/auth/login

# Expected: No Access-Control-Allow-Origin header or explicit rejection
```

- [ ] Unauthorized origins blocked
- [ ] Admin endpoints have strict CORS
- [ ] Widget endpoints allow embedding

### File Upload Security

```bash
# Test file upload with dangerous file
curl -X POST https://your-domain.com/api/files/initiate-upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"conversationSlug":"test","file":{"fileName":"malware.exe","fileSize":1000}}'

# Expected: 400 status with validation error
```

- [ ] Dangerous file types rejected
- [ ] File size limits enforced
- [ ] Upload rate limiting functional
- [ ] Virus scanning operational (if enabled)

## ✅ Monitoring Setup

### Security Event Logging

- [ ] Failed authentication attempts logged
- [ ] Rate limiting violations logged
- [ ] CORS violations logged
- [ ] File upload threats logged
- [ ] SQL injection attempts logged

### Monitoring Alerts

- [ ] High rate of failed logins triggers alert
- [ ] Multiple rate limit violations trigger alert
- [ ] File quarantine events trigger alert
- [ ] Database security events trigger alert

### Log Analysis

- [ ] Security logs are centralized
- [ ] Log retention policy defined
- [ ] Regular log analysis scheduled
- [ ] Automated threat detection configured

## ✅ Post-Deployment Actions

### Immediate Verification (First 24 hours)

- [ ] Monitor error rates and security events
- [ ] Verify all functionality works with security measures
- [ ] Check performance impact of security features
- [ ] Confirm backup systems are functional

### Weekly Security Tasks

- [ ] Review security event logs
- [ ] Check rate limiting statistics
- [ ] Verify SSL certificate status
- [ ] Update virus scanning signatures (if applicable)

### Monthly Security Tasks

- [ ] Full security audit
- [ ] Review and update security policies
- [ ] Test incident response procedures
- [ ] Update security dependencies

## 🚨 Security Incident Response

### If Security Issues Are Detected

1. **Immediate Actions**
   - [ ] Document the incident
   - [ ] Assess the scope and impact
   - [ ] Block malicious IPs if needed
   - [ ] Notify security team

2. **Investigation**
   - [ ] Review security logs
   - [ ] Identify attack vectors
   - [ ] Check for data breaches
   - [ ] Document findings

3. **Remediation**
   - [ ] Fix identified vulnerabilities
   - [ ] Update security configurations
   - [ ] Implement additional protections
   - [ ] Test fixes thoroughly

4. **Post-Incident**
   - [ ] Update security procedures
   - [ ] Improve monitoring and alerting
   - [ ] Train team on lessons learned
   - [ ] Schedule follow-up security review

## 📞 Emergency Contacts

- **Security Team**: [contact information]
- **Database Administrator**: [contact information]  
- **DevOps Team**: [contact information]
- **Incident Response Lead**: [contact information]

## 🔍 Security Tools & Resources

### Security Testing Tools
- **OWASP ZAP**: Web application security scanner
- **Nmap**: Network security scanner
- **SQLMap**: SQL injection testing
- **Burp Suite**: Web security testing platform

### Security Monitoring
- **Application logs**: Check for security events
- **Database logs**: Monitor for suspicious queries
- **CDN logs**: Check for DDoS or abuse patterns
- **Security headers**: Use online tools to verify

### Security Information
- **OWASP Top 10**: Keep updated on common vulnerabilities
- **CVE Database**: Monitor for dependency vulnerabilities
- **Security advisories**: Subscribe to relevant security feeds

---

## ✅ Final Deployment Approval

**Security Team Sign-off**
- [ ] All critical security measures implemented
- [ ] Security testing completed successfully
- [ ] Monitoring and alerting configured
- [ ] Incident response plan in place

**Date**: _______________  
**Signed by**: _______________  
**Title**: Security Lead  

**Additional Notes**: 
_Use this space to document any security considerations specific to this deployment_

---

**This checklist should be completed and signed off before any production deployment. Keep a copy of the completed checklist for audit and compliance purposes.**