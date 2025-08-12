/**
 * Basic unit tests for authentication system components
 * These tests work without requiring database or environment setup
 */

import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";

const TEST_JWT_SECRET = new TextEncoder().encode('test-secret-key-for-authentication-testing-12345');

async function runBasicAuthTests() {
  console.log('🔐 Running Basic Authentication Unit Tests...\n');

  // Test 1: Argon2 Password Hashing
  console.log('Test 1: Argon2 Password Hashing');
  try {
    const password = 'TestPassword123!';
    
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    
    console.log('✅ Password hashed with Argon2');
    console.log(`   Hash format: ${hash.substring(0, 20)}...`);
    
    const isValid = await argon2.verify(hash, password);
    const isInvalid = await argon2.verify(hash, 'WrongPassword');
    
    if (isValid && !isInvalid) {
      console.log('✅ Argon2 verification works correctly\n');
    } else {
      console.log('❌ Argon2 verification failed\n');
      return false;
    }
  } catch (error) {
    console.log(`❌ Argon2 test failed: ${error}\n`);
    return false;
  }

  // Test 2: JWT with Jose Library
  console.log('Test 2: JWT with Jose Library');
  try {
    const payload = {
      userId: 'test-user-123',
      email: 'test@example.com',
      type: 'session',
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(TEST_JWT_SECRET);
    
    console.log('✅ JWT generated with Jose');
    console.log(`   Token parts: ${token.split('.').length}`);
    
    const { payload: decoded } = await jwtVerify(token, TEST_JWT_SECRET);
    
    if (decoded.userId === payload.userId && decoded.email === payload.email) {
      console.log('✅ JWT verification successful');
      console.log(`   Claims: userId=${decoded.userId}, email=${decoded.email}\n`);
    } else {
      console.log('❌ JWT claims mismatch\n');
      return false;
    }
  } catch (error) {
    console.log(`❌ JWT test failed: ${error}\n`);
    return false;
  }

  // Test 3: JWT Security
  console.log('Test 3: JWT Security Properties');
  try {
    // Test with wrong secret
    const payload = { userId: 'test' };
    const wrongSecret = new TextEncoder().encode('wrong-secret');
    
    const validToken = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(TEST_JWT_SECRET);
      
    try {
      await jwtVerify(validToken, wrongSecret);
      console.log('❌ JWT accepted with wrong secret\n');
      return false;
    } catch {
      console.log('✅ JWT rejected with wrong secret');
    }
    
    // Test with expired token
    const expiredToken = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime('0s')
      .sign(TEST_JWT_SECRET);
      
    // Wait a moment for expiration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      await jwtVerify(expiredToken, TEST_JWT_SECRET);
      console.log('❌ Expired JWT was accepted\n');
      return false;
    } catch {
      console.log('✅ Expired JWT properly rejected');
    }
    
    // Test with malformed token
    try {
      await jwtVerify('invalid.token.format', TEST_JWT_SECRET);
      console.log('❌ Malformed JWT was accepted\n');
      return false;
    } catch {
      console.log('✅ Malformed JWT properly rejected\n');
    }
  } catch (error) {
    console.log(`❌ JWT security test failed: ${error}\n`);
    return false;
  }

  // Test 4: Password Security Properties
  console.log('Test 4: Password Security Properties');
  try {
    const password = 'SecurePassword123!';
    
    // Generate multiple hashes
    const hash1 = await argon2.hash(password);
    const hash2 = await argon2.hash(password);
    const hash3 = await argon2.hash(password);
    
    // All should be different (salt effect)
    if (hash1 !== hash2 && hash2 !== hash3 && hash1 !== hash3) {
      console.log('✅ Password hashes use unique salts');
    } else {
      console.log('❌ Password hashes are not unique\n');
      return false;
    }
    
    // All should verify the same password
    const verify1 = await argon2.verify(hash1, password);
    const verify2 = await argon2.verify(hash2, password);
    const verify3 = await argon2.verify(hash3, password);
    
    if (verify1 && verify2 && verify3) {
      console.log('✅ All hashes verify the same password');
    } else {
      console.log('❌ Hash verification inconsistent\n');
      return false;
    }
    
    // None should verify wrong password
    const wrongVerify1 = await argon2.verify(hash1, 'WrongPassword');
    const wrongVerify2 = await argon2.verify(hash2, 'WrongPassword');
    const wrongVerify3 = await argon2.verify(hash3, 'WrongPassword');
    
    if (!wrongVerify1 && !wrongVerify2 && !wrongVerify3) {
      console.log('✅ Wrong passwords properly rejected\n');
    } else {
      console.log('❌ Wrong password was accepted\n');
      return false;
    }
  } catch (error) {
    console.log(`❌ Password security test failed: ${error}\n`);
    return false;
  }

  // Test 5: JWT Algorithm Verification
  console.log('Test 5: JWT Algorithm Verification');
  try {
    const payload = { test: 'data' };
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(TEST_JWT_SECRET);
    
    // Decode header to verify algorithm
    const [headerB64] = token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    
    console.log(`   Decoded header: ${JSON.stringify(header)}`);
    
    if (header.alg === 'HS256' && header.typ === 'JWT') {
      console.log('✅ JWT uses correct algorithm (HS256)\n');
    } else {
      console.log(`❌ JWT algorithm mismatch - expected HS256/JWT, got ${header.alg}/${header.typ}\n`);
      return false;
    }
  } catch (error) {
    console.log(`❌ JWT algorithm test failed: ${error}\n`);
    return false;
  }

  console.log('🎉 All Basic Authentication Unit Tests Passed!\n');
  console.log('Summary of verified components:');
  console.log('- Argon2 password hashing ✅');
  console.log('- Jose JWT generation and verification ✅');
  console.log('- JWT security (wrong secret, expiration, malformed) ✅');
  console.log('- Password salt uniqueness ✅');
  console.log('- Algorithm verification (HS256) ✅');
  console.log('\n✨ Core authentication cryptography is working correctly!');

  return true;
}

// Run the tests
runBasicAuthTests()
  .then(success => {
    console.log(success ? '\n🟢 All tests passed' : '\n🔴 Some tests failed');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });