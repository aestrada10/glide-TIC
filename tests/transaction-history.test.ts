/**
 * Test suite for transaction history
 * 
 * These tests verify that transaction history is complete and properly ordered:
 * - All transactions are returned in the query
 * - Transactions are ordered by creation date (descending)
 * - Multiple funding events result in all transactions being visible
 * - Transaction history is complete and accurate
 * 
 * Run with: npx tsx tests/transaction-history.test.ts
 */

import { getRawDatabase } from "../lib/db";
import { db } from "../lib/db";
import { transactions } from "../lib/db/schema";
import { eq, desc } from "drizzle-orm";

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
    toEqual(expected: any) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
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

// Helper function to create a test account
function createTestAccount(userId?: number, initialBalance: number = 0) {
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

// Helper function to create a transaction
function createTransaction(accountId: number, amount: number, type: string = "deposit", delay: number = 0) {
  const rawDb = getRawDatabase();
  
  // Add small delay to ensure different timestamps
  if (delay > 0) {
    const start = Date.now();
    while (Date.now() - start < delay) {
      // Busy wait
    }
  }
  
  const stmt = rawDb.prepare(`
    INSERT INTO transactions (account_id, type, amount, description, status, processed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const processedAt = new Date().toISOString();
  const result = stmt.run(
    accountId,
    type,
    amount,
    `Test ${type}`,
    "completed",
    processedAt
  );
  
  return result.lastInsertRowid as number;
}

// Helper function to get transactions using Drizzle (simulating the actual query)
async function getTransactions(accountId: number) {
  const accountTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .orderBy(desc(transactions.createdAt));
  
  return accountTransactions;
}

// Helper function to get transaction count
function getTransactionCount(accountId: number): number {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`SELECT COUNT(*) as count FROM transactions WHERE account_id = ?`);
  const result = stmt.get(accountId) as { count: number } | undefined;
  return result?.count ?? 0;
}

// Test Suite: Transaction History
async function runTests() {
  console.log("Running Transaction History Tests...\n");

  // Clean up any existing test data
  const rawDb = getRawDatabase();
  const cleanupTransactionsStmt = rawDb.prepare(`
    DELETE FROM transactions 
    WHERE account_id IN (SELECT id FROM accounts WHERE account_number LIKE 'TEST%')
  `);
  const cleanupAccountsStmt = rawDb.prepare(`DELETE FROM accounts WHERE account_number LIKE 'TEST%'`);
  const cleanupUsersStmt = rawDb.prepare(`DELETE FROM users WHERE email LIKE 'test%@test.com'`);
  cleanupTransactionsStmt.run();
  cleanupAccountsStmt.run();
  cleanupUsersStmt.run();

  // Test 1: Single transaction should be returned
  await runTest("should return single transaction", async () => {
    const { accountId } = createTestAccount(undefined, 0);
    const transactionId = createTransaction(accountId, 100);
    
    const transactions = await getTransactions(accountId);
    
    assert(transactions.length).toBe(1);
    assert(transactions[0].id).toBe(transactionId);
  });

  // Test 2: Multiple transactions should all be returned
  await runTest("should return all multiple transactions", async () => {
    const { accountId } = createTestAccount(undefined, 0);
    
    const transactionIds = [];
    for (let i = 0; i < 5; i++) {
      const id = createTransaction(accountId, (i + 1) * 10, "deposit", 10);
      transactionIds.push(id);
    }
    
    const transactions = await getTransactions(accountId);
    
    assert(transactions.length).toBe(5);
    // Verify all transaction IDs are present
    const returnedIds = transactions.map(t => t.id);
    for (const id of transactionIds) {
      assert(returnedIds.includes(id)).toBeTruthy();
    }
  });

  // Test 3: Transactions should be ordered by creation date (descending)
  await runTest("should order transactions by creation date descending", async () => {
    const { accountId } = createTestAccount(undefined, 0);
    
    // Create transactions with explicit timestamps to ensure different creation dates
    const rawDb = getRawDatabase();
    const now = new Date();
    
    // Create first transaction
    const stmt1 = rawDb.prepare(`
      INSERT INTO transactions (account_id, type, amount, description, status, processed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const time1 = new Date(now.getTime() - 2000).toISOString();
    stmt1.run(accountId, "deposit", 100, "Test deposit", "completed", time1, time1);
    
    // Create second transaction
    const stmt2 = rawDb.prepare(`
      INSERT INTO transactions (account_id, type, amount, description, status, processed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const time2 = new Date(now.getTime() - 1000).toISOString();
    stmt2.run(accountId, "deposit", 200, "Test deposit", "completed", time2, time2);
    
    // Create third transaction (most recent)
    const stmt3 = rawDb.prepare(`
      INSERT INTO transactions (account_id, type, amount, description, status, processed_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const time3 = now.toISOString();
    stmt3.run(accountId, "deposit", 300, "Test deposit", "completed", time3, time3);
    
    const transactions = await getTransactions(accountId);
    
    assert(transactions.length).toBe(3);
    
    // Verify dates are in descending order (most recent first)
    for (let i = 0; i < transactions.length - 1; i++) {
      const current = new Date(transactions[i].createdAt || "").getTime();
      const next = new Date(transactions[i + 1].createdAt || "").getTime();
      // Current should be >= next (descending order)
      if (current < next) {
        throw new Error(`Transaction at index ${i} has date ${transactions[i].createdAt} which is before transaction at index ${i + 1} with date ${transactions[i + 1].createdAt}`);
      }
    }
    
    // Verify amounts are in reverse order (300, 200, 100) since most recent is first
    assert(transactions[0].amount).toBe(300);
    assert(transactions[1].amount).toBe(200);
    assert(transactions[2].amount).toBe(100);
  });

  // Test 4: Multiple funding events should result in all transactions being visible
  await runTest("should show all transactions after multiple funding events", async () => {
    const { accountId } = createTestAccount(undefined, 0);
    
    // Simulate multiple funding events
    const expectedCount = 10;
    for (let i = 0; i < expectedCount; i++) {
      createTransaction(accountId, 50, "deposit", 10);
    }
    
    const transactions = await getTransactions(accountId);
    
    // All transactions should be visible
    assert(transactions.length).toBe(expectedCount);
    
    // Verify transaction count matches database count
    const dbCount = getTransactionCount(accountId);
    assert(transactions.length).toBe(dbCount);
  });

  // Test 5: Transaction history should be complete
  await runTest("should return complete transaction history", async () => {
    const { accountId } = createTestAccount(undefined, 0);
    
    // Create various transactions
    const amounts = [100, 50, 25, 75, 10, 200];
    const createdIds = [];
    
    for (const amount of amounts) {
      const id = createTransaction(accountId, amount, "deposit", 10);
      createdIds.push(id);
    }
    
    const transactions = await getTransactions(accountId);
    
    // Should have all transactions
    assert(transactions.length).toBe(amounts.length);
    
    // All created transaction IDs should be present
    const returnedIds = transactions.map(t => t.id);
    for (const id of createdIds) {
      assert(returnedIds.includes(id)).toBeTruthy();
    }
  });

  // Test 6: High volume transactions should all be returned
  await runTest("should return all transactions with high volume", async () => {
    const { accountId } = createTestAccount(undefined, 0);
    
    // Create many transactions
    const transactionCount = 50;
    for (let i = 0; i < transactionCount; i++) {
      createTransaction(accountId, 10, "deposit", 5);
    }
    
    const transactions = await getTransactions(accountId);
    
    // All transactions should be returned
    assert(transactions.length).toBe(transactionCount);
    
    // Verify count matches database
    const dbCount = getTransactionCount(accountId);
    assert(transactions.length).toBe(dbCount);
  });

  // Test 7: Transactions should maintain order across multiple queries
  await runTest("should maintain consistent ordering across queries", async () => {
    const { accountId } = createTestAccount(undefined, 0);
    
    // Create transactions
    for (let i = 0; i < 5; i++) {
      createTransaction(accountId, (i + 1) * 10, "deposit", 20);
    }
    
    // Query multiple times
    const query1 = await getTransactions(accountId);
    const query2 = await getTransactions(accountId);
    const query3 = await getTransactions(accountId);
    
    // All queries should return same order
    assert(query1.length).toBe(query2.length);
    assert(query2.length).toBe(query3.length);
    
    // Transaction IDs should be in same order
    for (let i = 0; i < query1.length; i++) {
      assert(query1[i].id).toBe(query2[i].id);
      assert(query2[i].id).toBe(query3[i].id);
    }
  });

  // Test 8: Different accounts should have separate transaction histories
  await runTest("should maintain separate transaction histories for different accounts", async () => {
    const { accountId: account1 } = createTestAccount(undefined, 0);
    const { accountId: account2 } = createTestAccount(undefined, 0);
    
    // Create transactions for each account
    createTransaction(account1, 100, "deposit", 0);
    createTransaction(account1, 50, "deposit", 10);
    createTransaction(account2, 200, "deposit", 0);
    
    const transactions1 = await getTransactions(account1);
    const transactions2 = await getTransactions(account2);
    
    // Each account should only see its own transactions
    assert(transactions1.length).toBe(2);
    assert(transactions2.length).toBe(1);
    
    // Verify no cross-contamination
    const account1Ids = transactions1.map(t => t.accountId);
    const account2Ids = transactions2.map(t => t.accountId);
    
    for (const id of account1Ids) {
      assert(id).toBe(account1);
    }
    for (const id of account2Ids) {
      assert(id).toBe(account2);
    }
  });

  // Test 9: Empty account should return empty array
  await runTest("should return empty array for account with no transactions", async () => {
    const { accountId } = createTestAccount(undefined, 0);
    
    const transactions = await getTransactions(accountId);
    
    assert(transactions.length).toBe(0);
    assert(Array.isArray(transactions)).toBeTruthy();
  });

  // Test 10: Transaction properties should be correct
  await runTest("should return transactions with correct properties", async () => {
    const { accountId } = createTestAccount(undefined, 0);
    const transactionId = createTransaction(accountId, 150, "deposit", 0);
    
    const transactions = await getTransactions(accountId);
    
    assert(transactions.length).toBe(1);
    const transaction = transactions[0];
    
    assert(transaction.id).toBe(transactionId);
    assert(transaction.accountId).toBe(accountId);
    assert(transaction.type).toBe("deposit");
    assert(transaction.amount).toBe(150);
    assert(transaction.status).toBe("completed");
    assert(transaction.createdAt).toBeTruthy();
    assert(transaction.processedAt).toBeTruthy();
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

