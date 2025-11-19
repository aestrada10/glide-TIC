/**
 * Test suite for database index performance improvements
 * 
 * These tests verify that database indexes are created and improve query performance:
 * - PERF-407: Indexes on frequently queried columns improve transaction processing speed
 * 
 * Run with: npx tsx tests/performance-indexes.test.ts
 */

import { getRawDatabase } from "../lib/db/index";

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
    toContain(expected: string) {
      if (!String(actual).includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
  };
}

/**
 * Helper function to check if an index exists
 */
function indexExists(indexName: string): boolean {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type = 'index' AND name = ?
  `);
  const result = stmt.get(indexName) as { name: string } | undefined;
  return !!result;
}

/**
 * Helper function to get all indexes for a table
 */
function getIndexesForTable(tableName: string): string[] {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type = 'index' AND tbl_name = ?
  `);
  const results = stmt.all(tableName) as { name: string }[];
  return results.map((r) => r.name);
}

/**
 * Helper function to get query plan for a query
 */
function getQueryPlan(query: string): string {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`EXPLAIN QUERY PLAN ${query}`);
  const results = stmt.all() as Array<{ detail: string }>;
  return results.map((r) => r.detail).join("\n");
}

/**
 * Helper function to create a test transaction
 */
function createTestTransaction(accountId: number, amount: number = 100): number {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`
    INSERT INTO transactions (account_id, type, amount, description, status, processed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    accountId,
    "deposit",
    amount,
    "Test transaction",
    "completed",
    new Date().toISOString()
  );
  return result.lastInsertRowid as number;
}

/**
 * Helper function to create a test account
 */
function createTestAccount(userId: number = 1): number {
  const rawDb = getRawDatabase();
  // Generate unique account number using timestamp + random component
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const accountNumber = `TEST${uniqueId}`;
  
  const stmt = rawDb.prepare(`
    INSERT INTO accounts (user_id, account_number, account_type, balance, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(userId, accountNumber, "checking", 0, "active");
  return result.lastInsertRowid as number;
}

/**
 * Helper function to measure query execution time
 */
function measureQueryTime(queryFn: () => void): number {
  const start = Date.now();
  queryFn();
  return Date.now() - start;
}

// Test Suite: Performance Indexes
async function runTests() {
  console.log("Running Performance Index Tests...\n");

  // PERF-407 Tests: Index Creation

  // Test 1: Verify transactions.account_id index exists
  await runTest("should have index on transactions.account_id", () => {
    const exists = indexExists("idx_transactions_account_id");
    assert(exists).toBeTruthy();
  });

  // Test 2: Verify transactions.created_at index exists
  await runTest("should have index on transactions.created_at", () => {
    const exists = indexExists("idx_transactions_created_at");
    assert(exists).toBeTruthy();
  });

  // Test 3: Verify composite index on transactions(account_id, created_at) exists
  await runTest("should have composite index on transactions(account_id, created_at)", () => {
    const exists = indexExists("idx_transactions_account_created");
    assert(exists).toBeTruthy();
  });

  // Test 4: Verify accounts.user_id index exists
  await runTest("should have index on accounts.user_id", () => {
    const exists = indexExists("idx_accounts_user_id");
    assert(exists).toBeTruthy();
  });

  // Test 5: Verify composite index on accounts(user_id, account_type) exists
  await runTest("should have composite index on accounts(user_id, account_type)", () => {
    const exists = indexExists("idx_accounts_user_type");
    assert(exists).toBeTruthy();
  });

  // Test 6: Verify sessions.user_id index exists
  await runTest("should have index on sessions.user_id", () => {
    const exists = indexExists("idx_sessions_user_id");
    assert(exists).toBeTruthy();
  });

  // Test 7: Verify sessions.token index exists
  await runTest("should have index on sessions.token", () => {
    const exists = indexExists("idx_sessions_token");
    assert(exists).toBeTruthy();
  });

  // Test 8: Verify sessions.expires_at index exists
  await runTest("should have index on sessions.expires_at", () => {
    const exists = indexExists("idx_sessions_expires_at");
    assert(exists).toBeTruthy();
  });

  // PERF-407 Tests: Query Performance

  // Test 9: Verify transaction query uses index
  await runTest("should use index for transaction queries by account_id", () => {
    const accountId = createTestAccount();
    // Create a few transactions
    for (let i = 0; i < 5; i++) {
      createTestTransaction(accountId);
    }

    const queryPlan = getQueryPlan(
      `SELECT * FROM transactions WHERE account_id = ${accountId} ORDER BY created_at DESC`
    );
    // Query plan should mention using an index
    assert(queryPlan.toLowerCase()).toContain("idx_transactions");
  });

  // Test 10: Verify account query uses index
  await runTest("should use index for account queries by user_id", () => {
    const queryPlan = getQueryPlan(
      "SELECT * FROM accounts WHERE user_id = 1 AND account_type = 'checking'"
    );
    // Query plan should mention using an index
    assert(queryPlan.toLowerCase()).toContain("idx_accounts");
  });

  // Test 11: Verify session query uses index
  await runTest("should use index for session queries by user_id", () => {
    const queryPlan = getQueryPlan("SELECT * FROM sessions WHERE user_id = 1");
    // Query plan should mention using an index
    assert(queryPlan.toLowerCase()).toContain("idx_sessions");
  });

  // Test 12: Verify all required indexes are present
  await runTest("should have all required indexes", () => {
    const transactionIndexes = getIndexesForTable("transactions");
    const accountIndexes = getIndexesForTable("accounts");
    const sessionIndexes = getIndexesForTable("sessions");

    // Check transactions indexes
    assert(transactionIndexes.some((idx) => idx.includes("account_id"))).toBeTruthy();
    assert(transactionIndexes.some((idx) => idx.includes("created_at"))).toBeTruthy();
    assert(transactionIndexes.some((idx) => idx.includes("account_created"))).toBeTruthy();

    // Check accounts indexes
    assert(accountIndexes.some((idx) => idx.includes("user_id"))).toBeTruthy();
    assert(accountIndexes.some((idx) => idx.includes("user_type"))).toBeTruthy();

    // Check sessions indexes
    assert(sessionIndexes.some((idx) => idx.includes("user_id"))).toBeTruthy();
    assert(sessionIndexes.some((idx) => idx.includes("token"))).toBeTruthy();
    assert(sessionIndexes.some((idx) => idx.includes("expires_at"))).toBeTruthy();
  });

  // Test 13: Verify query performance with indexes
  await runTest("should have acceptable query performance with indexes", () => {
    const accountId = createTestAccount();
    // Create multiple transactions
    for (let i = 0; i < 100; i++) {
      createTestTransaction(accountId);
    }

    const rawDb = getRawDatabase();
    const queryTime = measureQueryTime(() => {
      const stmt = rawDb.prepare(
        `SELECT * FROM transactions WHERE account_id = ? ORDER BY created_at DESC`
      );
      stmt.all(accountId);
    });

    // With indexes, query should complete quickly (< 100ms for 100 rows)
    assert(queryTime).toBeLessThan(100);
  });

  // Test 14: Verify composite index is used for common query pattern
  await runTest("should use composite index for account_id + created_at queries", () => {
    const accountId = createTestAccount();
    createTestTransaction(accountId);

    const queryPlan = getQueryPlan(
      `SELECT * FROM transactions WHERE account_id = ${accountId} ORDER BY created_at DESC`
    );
    // Should use the composite index
    assert(queryPlan.toLowerCase()).toContain("idx_transactions_account_created");
  });

  // Test 15: Verify indexes improve query performance at scale
  await runTest("should maintain performance with large transaction volumes", () => {
    const accountId = createTestAccount();
    // Create a larger number of transactions
    for (let i = 0; i < 500; i++) {
      createTestTransaction(accountId);
    }

    const rawDb = getRawDatabase();
    const queryTime = measureQueryTime(() => {
      const stmt = rawDb.prepare(
        `SELECT * FROM transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT 10`
      );
      stmt.all(accountId);
    });

    // With indexes, even with 500 rows, query should be fast (< 50ms)
    assert(queryTime).toBeLessThan(50);
  });

  // Cleanup test data
  const rawDb = getRawDatabase();
  rawDb.prepare("DELETE FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE account_number LIKE 'TEST%')").run();
  rawDb.prepare("DELETE FROM accounts WHERE account_number LIKE 'TEST%'").run();

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

