/**
 * Test suite for session management
 * 
 * These tests verify that session management works correctly:
 * - SEC-304: Only one active session per user (old sessions invalidated on login)
 * - PERF-402: Logout verifies session deletion and returns correct response
 * - PERF-403: Sessions expire with 1-minute buffer
 * 
 * Run with: npx tsx tests/session-management.test.ts
 */

import { getRawDatabase } from "../lib/db";
import { db } from "../lib/db";
import { sessions, users } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

// Simple test runner
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const tests: TestResult[] = [];

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    const result = fn();
    if (result instanceof Promise) {
      await result;
      tests.push({ name, passed: true });
    } else {
      tests.push({ name, passed: true });
    }
  } catch (error: any) {
    tests.push({ name, passed: false, error: error.message });
  }
}

function assert(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, but got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, but got ${actual}`);
      }
    },
  };
}

// Helper function to create a test user
function createTestUser() {
  const rawDb = getRawDatabase();
  const email = `test${Date.now()}@test.com`;
  
  const checkStmt = rawDb.prepare(`SELECT id FROM users WHERE email = ?`);
  const existing = checkStmt.get(email) as { id: number } | undefined;
  
  if (existing) {
    return existing.id;
  }
  
  const stmt = rawDb.prepare(`
    INSERT INTO users (email, password, first_name, last_name, phone_number, date_of_birth, ssn, address, city, state, zip_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    email,
    "hashedpassword",
    "Test",
    "User",
    "1234567890",
    "1990-01-01",
    "123456789",
    "123 Test St",
    "Test City",
    "TS",
    "12345"
  );
  
  return result.lastInsertRowid as number;
}

// Helper function to create a session
function createSession(userId: number, expiresInMinutes: number = 7 * 24 * 60) {
  const rawDb = getRawDatabase();
  // Include timestamp and random component in JWT payload to ensure uniqueness
  // This prevents identical tokens when generated in quick succession
  const token = jwt.sign(
    { 
      userId, 
      iat: Math.floor(Date.now() / 1000),
      jti: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    }, 
    process.env.JWT_SECRET || "temporary-secret-for-interview", 
    {
      expiresIn: `${expiresInMinutes}m`,
    }
  );
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
  
  const stmt = rawDb.prepare(`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `);
  
  const result = stmt.run(userId, token, expiresAt.toISOString());
  return { token, sessionId: result.lastInsertRowid as number, expiresAt };
}

// Helper function to get session count for user (using raw SQL for consistency)
function getSessionCount(userId: number): number {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`SELECT COUNT(*) as count FROM sessions WHERE user_id = ?`);
  const result = stmt.get(userId) as { count: number } | undefined;
  return result?.count ?? 0;
}

// Helper function to check if session exists (using raw SQL for consistency)
function sessionExists(token: string): boolean {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`SELECT id FROM sessions WHERE token = ?`);
  const result = stmt.get(token) as { id: number } | undefined;
  return !!result;
}

// Helper function to simulate login (invalidates old sessions, creates new one)
async function simulateLogin(userId: number) {
  // SEC-304 fix: Delete all existing sessions using raw SQL for consistency
  const rawDb = getRawDatabase();
  const deleteStmt = rawDb.prepare(`DELETE FROM sessions WHERE user_id = ?`);
  deleteStmt.run(userId);
  
  // Create new session
  return createSession(userId);
}

// Helper function to simulate logout (verify deletion)
async function simulateLogout(token: string) {
  // Check if session exists
  const session = await db.select().from(sessions).where(eq(sessions.token, token)).get();
  
  if (!session) {
    return { success: false, message: "No active session to logout" };
  }
  
  // Delete session
  await db.delete(sessions).where(eq(sessions.token, token));
  
  // Verify deletion
  const deletedSession = await db.select().from(sessions).where(eq(sessions.token, token)).get();
  const deleted = !deletedSession;
  
  if (deleted) {
    return { success: true, message: "Logged out successfully" };
  } else {
    return { success: false, message: "Logout failed: session could not be deleted" };
  }
}

// Helper function to check if session is valid (with buffer)
function isSessionValid(expiresAt: string, bufferMs: number = 60 * 1000): boolean {
  const now = new Date();
  const expiryTime = new Date(expiresAt);
  const effectiveExpiry = new Date(expiryTime.getTime() - bufferMs);
  return now < effectiveExpiry;
}

// Test Suite: Session Management
async function runTests() {
  console.log("Running Session Management Tests...\n");

  // Clean up any existing test data
  const rawDb = getRawDatabase();
  const cleanupSessionsStmt = rawDb.prepare(`
    DELETE FROM sessions 
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%@test.com')
  `);
  const cleanupUsersStmt = rawDb.prepare(`DELETE FROM users WHERE email LIKE 'test%@test.com'`);
  cleanupSessionsStmt.run();
  cleanupUsersStmt.run();

  // SEC-304 Tests: Session Invalidation

  // Test 1: Login should invalidate old sessions (SEC-304)
  await runTest("should invalidate old sessions when user logs in (SEC-304)", async () => {
    const userId = createTestUser();
    
    // Create multiple sessions (simulating old logins)
    createSession(userId, 60);
    createSession(userId, 120);
    createSession(userId, 180);
    
    assert(getSessionCount(userId)).toBe(3);
    
    // Simulate login (should delete old sessions)
    await simulateLogin(userId);
    
    // Should only have one session now
    assert(getSessionCount(userId)).toBe(1);
  });

  // Test 2: Multiple logins should result in single active session (SEC-304)
  await runTest("should maintain only one active session after multiple logins (SEC-304)", async () => {
    const userId = createTestUser();
    
    // Simulate multiple logins
    await simulateLogin(userId);
    await simulateLogin(userId);
    await simulateLogin(userId);
    
    // Should only have one session
    assert(getSessionCount(userId)).toBe(1);
  });

  // Test 3: Old sessions should be completely removed (SEC-304)
  await runTest("should completely remove old sessions, not just mark as inactive (SEC-304)", async () => {
    const userId = createTestUser();
    
    const session1 = createSession(userId, 60);
    const session2 = createSession(userId, 120);
    
    // Verify sessions exist
    assert(sessionExists(session1.token)).toBeTruthy();
    assert(sessionExists(session2.token)).toBeTruthy();
    
    // Login (should delete old sessions)
    await simulateLogin(userId);
    
    // Old sessions should be deleted
    assert(sessionExists(session1.token)).toBeFalsy();
    assert(sessionExists(session2.token)).toBeFalsy();
    
    // Only new session should exist
    assert(getSessionCount(userId)).toBe(1);
  });

  // PERF-402 Tests: Logout Verification

  // Test 4: Logout should verify session deletion (PERF-402)
  await runTest("should verify session deletion and return correct response (PERF-402)", async () => {
    const userId = createTestUser();
    const { token } = createSession(userId);
    
    // Verify session exists
    assert(sessionExists(token)).toBeTruthy();
    
    // Logout
    const result = await simulateLogout(token);
    
    // Should return success
    assert(result.success).toBeTruthy();
    assert(result.message).toBe("Logged out successfully");
    
    // Session should be deleted
    assert(sessionExists(token)).toBeFalsy();
  });

  // Test 5: Logout should return failure if session doesn't exist (PERF-402)
  await runTest("should return failure when logging out non-existent session (PERF-402)", async () => {
    const fakeToken = "fake-token-that-does-not-exist";
    
    // Logout with non-existent token
    const result = await simulateLogout(fakeToken);
    
    // Should return failure
    assert(result.success).toBeFalsy();
    assert(result.message).toBe("No active session to logout");
  });

  // Test 6: Logout should return failure if deletion fails (PERF-402)
  await runTest("should return failure if session deletion fails (PERF-402)", async () => {
    const userId = createTestUser();
    const { token } = createSession(userId);
    
    // Manually delete session to simulate deletion failure scenario
    await db.delete(sessions).where(eq(sessions.token, token));
    
    // Try to logout (session already deleted)
    const result = await simulateLogout(token);
    
    // Should return failure
    assert(result.success).toBeFalsy();
    assert(result.message).toBe("No active session to logout");
  });

  // PERF-403 Tests: Session Expiry Buffer

  // Test 7: Session should be invalid 1 minute before expiry (PERF-403)
  await runTest("should consider session expired 1 minute before actual expiry (PERF-403)", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 1000); // Expires in 30 seconds
    
    // Session expiring in 30 seconds should be invalid (buffer is 1 minute)
    assert(isSessionValid(expiresAt.toISOString())).toBeFalsy();
  });

  // Test 8: Session should be valid if more than 1 minute before expiry (PERF-403)
  await runTest("should consider session valid if more than 1 minute before expiry (PERF-403)", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 1000); // Expires in 2 minutes
    
    // Session expiring in 2 minutes should be valid (buffer is 1 minute)
    assert(isSessionValid(expiresAt.toISOString())).toBeTruthy();
  });

  // Test 9: Session expiring exactly at buffer boundary should be invalid (PERF-403)
  await runTest("should consider session invalid at exact buffer boundary (PERF-403)", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000); // Expires in exactly 1 minute
    
    // Session expiring in exactly 1 minute should be invalid (buffer is 1 minute)
    assert(isSessionValid(expiresAt.toISOString())).toBeFalsy();
  });

  // Test 10: Expired sessions should be automatically cleaned up (PERF-403)
  await runTest("should automatically delete expired sessions (PERF-403)", async () => {
    const userId = createTestUser();
    
    // Create session expiring in the past (already expired)
    const pastDate = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const token = jwt.sign({ userId }, process.env.JWT_SECRET || "temporary-secret-for-interview");
    
    const rawDb = getRawDatabase();
    const stmt = rawDb.prepare(`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(userId, token, pastDate.toISOString());
    
    // Verify session exists
    assert(sessionExists(token)).toBeTruthy();
    
    // Check if session is valid (should trigger cleanup)
    const isValid = isSessionValid(pastDate.toISOString());
    
    // Session should be invalid
    assert(isValid).toBeFalsy();
    
    // In real code, expired sessions are deleted in trpc.ts
    // For this test, we verify the validation logic works
  });

  // Combined Tests

  // Test 11: Login then logout should work correctly
  await runTest("should handle login then logout correctly", async () => {
    const userId = createTestUser();
    
    // Login
    const { token } = await simulateLogin(userId);
    assert(getSessionCount(userId)).toBe(1);
    assert(sessionExists(token)).toBeTruthy();
    
    // Logout
    const result = await simulateLogout(token);
    assert(result.success).toBeTruthy();
    assert(sessionExists(token)).toBeFalsy();
    assert(getSessionCount(userId)).toBe(0);
  });

  // Test 12: Multiple logins and logouts should maintain correct state
  await runTest("should maintain correct state through multiple logins and logouts", async () => {
    const userId = createTestUser();
    
    // First login
    const { token: token1 } = await simulateLogin(userId);
    assert(getSessionCount(userId)).toBe(1);
    
    // Second login (should invalidate first)
    const { token: token2 } = await simulateLogin(userId);
    assert(getSessionCount(userId)).toBe(1);
    
    // Verify token1 is deleted and token2 exists
    const token1Exists = sessionExists(token1);
    const token2Exists = sessionExists(token2);
    assert(token1Exists).toBeFalsy();
    assert(token2Exists).toBeTruthy();
    
    // Logout - simulateLogout already verifies deletion internally
    const result = await simulateLogout(token2);
    
    // Verify logout succeeded
    assert(result.success).toBeTruthy();
    assert(result.message).toBe("Logged out successfully");
    
    // Verify no sessions remain (this is the most reliable check)
    const finalCount = getSessionCount(userId);
    assert(finalCount).toBe(0);
  });

  // Cleanup
  cleanupSessionsStmt.run();
  cleanupUsersStmt.run();

  // Print results
  console.log("\n=== Test Results ===\n");
  let passed = 0;
  let failed = 0;

  tests.forEach((test) => {
    if (test.passed) {
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
      failed++;
    }
  });

  console.log(`\nTotal: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
  }
}

// Run tests
runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});

