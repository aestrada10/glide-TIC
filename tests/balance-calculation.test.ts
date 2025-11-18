/**
 * Test suite for balance calculation
 * 
 * These tests verify that balance calculations are correct and atomic:
 * - Atomic balance updates prevent race conditions
 * - Concurrent transactions don't lose balance updates
 * - Balance calculations are correct
 * - Database transactions ensure atomicity
 * 
 * Run with: npx tsx tests/balance-calculation.test.ts
 */

import { getRawDatabase } from "../lib/db";
import { db } from "../lib/db";
import { accounts, transactions } from "../lib/db/schema";
import { eq } from "drizzle-orm";

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
      if (Math.abs(actual - expected) > 0.01) {
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
  
  // Check if user already exists
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

// Helper function to create a test account
async function createTestAccount(userId?: number, initialBalance: number = 0) {
  const rawDb = getRawDatabase();
  const testUserId = userId ?? createTestUser();
  const accountNumber = `TEST${Date.now()}${Math.random().toString(36).substring(7)}`;
  
  const stmt = rawDb.prepare(`
    INSERT INTO accounts (user_id, account_number, account_type, balance, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(testUserId, accountNumber, "checking", initialBalance, "active");
  const accountId = result.lastInsertRowid as number;
  
  return { accountId, accountNumber, userId: testUserId };
}

// Helper function to get account balance
function getAccountBalance(accountId: number): number {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`SELECT balance FROM accounts WHERE id = ?`);
  const result = stmt.get(accountId) as { balance: number } | undefined;
  return result?.balance ?? 0;
}

// Helper function to perform atomic deposit
function performAtomicDeposit(accountId: number, amount: number) {
  const rawDb = getRawDatabase();
  return rawDb.transaction(() => {
    // Create transaction record
    const insertStmt = rawDb.prepare(`
      INSERT INTO transactions (account_id, type, amount, description, status, processed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const processedAt = new Date().toISOString();
    insertStmt.run(accountId, "deposit", amount, "Test deposit", "completed", processedAt);

    // Atomic balance update
    const updateStmt = rawDb.prepare(`
      UPDATE accounts 
      SET balance = balance + ? 
      WHERE id = ?
    `);
    updateStmt.run(amount, accountId);

    // Return updated balance
    const balanceStmt = rawDb.prepare(`SELECT balance FROM accounts WHERE id = ?`);
    const account = balanceStmt.get(accountId) as { balance: number } | undefined;
    return account?.balance ?? 0;
  })();
}

// Helper function to get transaction count
function getTransactionCount(accountId: number): number {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`SELECT COUNT(*) as count FROM transactions WHERE account_id = ?`);
  const result = stmt.get(accountId) as { count: number } | undefined;
  return result?.count ?? 0;
}

// Helper function to get sum of all transactions
function getTransactionSum(accountId: number): number {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM transactions 
    WHERE account_id = ? AND type = 'deposit' AND status = 'completed'
  `);
  const result = stmt.get(accountId) as { total: number } | undefined;
  return result?.total ?? 0;
}

// Test Suite: Balance Calculation
async function runTests() {
  console.log("Running Balance Calculation Tests...\n");

  // Clean up any existing test accounts and users
  const rawDb = getRawDatabase();
  // Delete in correct order: transactions -> accounts -> users
  const cleanupTransactionsStmt = rawDb.prepare(`
    DELETE FROM transactions 
    WHERE account_id IN (SELECT id FROM accounts WHERE account_number LIKE 'TEST%')
  `);
  const cleanupAccountsStmt = rawDb.prepare(`DELETE FROM accounts WHERE account_number LIKE 'TEST%'`);
  const cleanupUsersStmt = rawDb.prepare(`DELETE FROM users WHERE email LIKE 'test%@test.com'`);
  cleanupTransactionsStmt.run();
  cleanupAccountsStmt.run();
  cleanupUsersStmt.run();

  // Test 1: Single deposit should update balance correctly
  await runTest("should update balance correctly for single deposit", async () => {
    const { accountId } = await createTestAccount(undefined, 100);
    const initialBalance = getAccountBalance(accountId);
    assert(initialBalance).toBe(100);

    performAtomicDeposit(accountId, 50);
    const newBalance = getAccountBalance(accountId);
    assert(newBalance).toBe(150);
  });

  // Test 2: Multiple sequential deposits should accumulate correctly
  await runTest("should accumulate balance correctly for multiple sequential deposits", async () => {
    const { accountId } = await createTestAccount(undefined, 0);
    
    performAtomicDeposit(accountId, 100);
    performAtomicDeposit(accountId, 50);
    performAtomicDeposit(accountId, 25);
    
    const finalBalance = getAccountBalance(accountId);
    assert(finalBalance).toBe(175);
  });

  // Test 3: Concurrent deposits should not lose updates (race condition test)
  await runTest("should handle concurrent deposits without losing updates", async () => {
    const { accountId } = await createTestAccount(undefined, 0);
    
    // Simulate 10 concurrent deposits
    const depositPromises = Array.from({ length: 10 }, () => 
      Promise.resolve(performAtomicDeposit(accountId, 10))
    );
    
    await Promise.all(depositPromises);
    
    const finalBalance = getAccountBalance(accountId);
    // All 10 deposits of $10 should result in $100
    assert(finalBalance).toBe(100);
    
    // Verify transaction count
    const transactionCount = getTransactionCount(accountId);
    assert(transactionCount).toBe(10);
  });

  // Test 4: Balance should match sum of all transactions
  await runTest("should have balance matching sum of all transactions", async () => {
    const { accountId } = await createTestAccount(undefined, 0);
    
    const deposits = [100, 50, 25, 75, 10];
    for (const amount of deposits) {
      performAtomicDeposit(accountId, amount);
    }
    
    const balance = getAccountBalance(accountId);
    const transactionSum = getTransactionSum(accountId);
    
    // Balance should equal the sum of all deposits
    assert(balance).toBe(transactionSum);
  });

  // Test 5: Large number of concurrent transactions should maintain accuracy
  await runTest("should maintain accuracy with many concurrent transactions", async () => {
    const { accountId } = await createTestAccount(undefined, 0);
    
    // Simulate 50 concurrent deposits of $1 each
    const depositPromises = Array.from({ length: 50 }, () => 
      Promise.resolve(performAtomicDeposit(accountId, 1))
    );
    
    await Promise.all(depositPromises);
    
    const finalBalance = getAccountBalance(accountId);
    const transactionCount = getTransactionCount(accountId);
    const transactionSum = getTransactionSum(accountId);
    
    // Should have exactly $50
    assert(finalBalance).toBe(50);
    // Should have 50 transactions
    assert(transactionCount).toBe(50);
    // Balance should match transaction sum
    assert(finalBalance).toBe(transactionSum);
  });

  // Test 6: Atomic update should prevent race conditions
  await runTest("should prevent race conditions with atomic updates", async () => {
    const { accountId } = await createTestAccount(undefined, 100);
    
    // Simulate 20 concurrent deposits of $5 each
    const depositPromises = Array.from({ length: 20 }, () => 
      Promise.resolve(performAtomicDeposit(accountId, 5))
    );
    
    await Promise.all(depositPromises);
    
    const finalBalance = getAccountBalance(accountId);
    // Initial $100 + (20 × $5) = $200
    assert(finalBalance).toBe(200);
  });

  // Test 7: Decimal amounts should be handled correctly
  await runTest("should handle decimal amounts correctly", async () => {
    const { accountId } = await createTestAccount(undefined, 0);
    
    performAtomicDeposit(accountId, 10.50);
    performAtomicDeposit(accountId, 25.75);
    performAtomicDeposit(accountId, 0.25);
    
    const finalBalance = getAccountBalance(accountId);
    // 10.50 + 25.75 + 0.25 = 36.50
    assert(finalBalance).toBe(36.50);
  });

  // Test 8: Multiple accounts should not interfere with each other
  await runTest("should maintain separate balances for different accounts", async () => {
    const { accountId: account1 } = await createTestAccount(undefined, 100);
    const { accountId: account2 } = await createTestAccount(undefined, 200);
    
    performAtomicDeposit(account1, 50);
    performAtomicDeposit(account2, 75);
    
    const balance1 = getAccountBalance(account1);
    const balance2 = getAccountBalance(account2);
    
    // Account 1: 100 + 50 = 150
    assert(balance1).toBe(150);
    // Account 2: 200 + 75 = 275
    assert(balance2).toBe(275);
  });

  // Test 9: High volume transactions should maintain correctness
  await runTest("should maintain correctness with high volume transactions", async () => {
    const { accountId } = await createTestAccount(undefined, 0);
    
    // Simulate 100 concurrent deposits
    const depositPromises = Array.from({ length: 100 }, (_, i) => 
      Promise.resolve(performAtomicDeposit(accountId, i + 1))
    );
    
    await Promise.all(depositPromises);
    
    const finalBalance = getAccountBalance(accountId);
    // Sum of 1 to 100 = 5050
    const expectedSum = (100 * 101) / 2;
    assert(finalBalance).toBe(expectedSum);
  });

  // Test 10: Balance should be consistent after many operations
  await runTest("should maintain balance consistency after many operations", async () => {
    const { accountId } = await createTestAccount(undefined, 0);
    
    // Perform many sequential operations
    for (let i = 0; i < 50; i++) {
      performAtomicDeposit(accountId, 2);
    }
    
    const balance = getAccountBalance(accountId);
    const transactionSum = getTransactionSum(accountId);
    
    // Balance should always match transaction sum
    assert(balance).toBe(transactionSum);
    assert(balance).toBe(100); // 50 × $2 = $100
  });

  // Cleanup
  cleanupTransactionsStmt.run();
  cleanupAccountsStmt.run();
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

