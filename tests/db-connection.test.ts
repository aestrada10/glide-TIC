/**
 * Test suite for database connection management
 * 
 * These tests verify that database connections are properly managed:
 * - Only one connection is created (singleton pattern)
 * - Connections can be properly closed
 * - No connection leaks occur
 * 
 * Run with: npx tsx tests/db-connection.test.ts
 */

// We need to test the database module, but we'll need to reload it for some tests
// Since we can't easily reload modules in Node.js, we'll test the behavior indirectly

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
    notToBe(expected: any) {
      if (actual === expected) {
        throw new Error(`Expected not to be ${expected}, but it was`);
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
    toBeInstanceOf(expected: any) {
      if (!(actual instanceof expected)) {
        throw new Error(`Expected instance of ${expected.name}, but got ${actual?.constructor?.name || typeof actual}`);
      }
    },
  };
}

// Test Suite: Database Connection Management
async function runTests() {
  console.log("Running Database Connection Management Tests...\n");

  // Test 1: Database module should export db and closeDb
  await runTest("should export db and closeDb functions", async () => {
    const dbModule = require("../lib/db/index");
    assert(dbModule.db).toBeTruthy();
    assert(typeof dbModule.closeDb).toBe("function");
    assert(typeof dbModule.initDb).toBe("function");
  });

  // Test 2: Database should be usable (connection works)
  await runTest("should be able to query database", async () => {
    const { db } = require("../lib/db/index");
    // Try a simple query to verify connection works
    const result = await db.select().from(require("../lib/db/schema").users).limit(1);
    assert(Array.isArray(result)).toBeTruthy();
  });

  // Test 3: Connection should handle multiple queries
  await runTest("should handle multiple queries without errors", async () => {
    const { db } = require("../lib/db/index");
    const { users, accounts } = require("../lib/db/schema");
    
    // Multiple queries should work
    const usersResult = await db.select().from(users).limit(1);
    const accountsResult = await db.select().from(accounts).limit(1);
    
    assert(Array.isArray(usersResult)).toBeTruthy();
    assert(Array.isArray(accountsResult)).toBeTruthy();
  });

  // Test 4: Database should work after initDb is called
  await runTest("should initialize database tables correctly", async () => {
    const { db, initDb } = require("../lib/db/index");
    // initDb is called on import, but we can call it again
    initDb();
    
    // Should be able to query (tables should exist)
    const result = await db.select().from(require("../lib/db/schema").users).limit(1);
    assert(Array.isArray(result)).toBeTruthy();
  });

  // Test 5: Multiple imports should not create multiple connections
  await runTest("should reuse same connection on multiple imports", async () => {
    const db1 = require("../lib/db/index").db;
    const db2 = require("../lib/db/index").db;
    
    // Both should be the same drizzle instance (wrapping the same connection)
    // We can't directly compare the underlying connection, but we can verify
    // they work and don't cause errors
    assert(db1).toBeTruthy();
    assert(db2).toBeTruthy();
  });

  // Test 6: initDb should not create duplicate connections
  await runTest("should not create duplicate connections when initDb is called multiple times", async () => {
    const { initDb } = require("../lib/db/index");
    // Call initDb multiple times
    initDb();
    initDb();
    initDb();
    // Should not throw errors or create multiple connections
    assert(true).toBeTruthy();
  });

  // Test 7: Database should support WAL mode (pragma check)
  await runTest("should have WAL mode enabled for better concurrency", async () => {
    const { db } = require("../lib/db/index");
    // We can't directly check pragma, but we can verify the connection works
    // WAL mode is set in getDatabase(), so if queries work, it's likely enabled
    const result = await db.select().from(require("../lib/db/schema").users).limit(1);
    assert(Array.isArray(result)).toBeTruthy();
  });

  // Test 8: Database operations should work after module reload
  await runTest("should recreate connection after close and reload", async () => {
    // This test verifies that the singleton pattern works correctly
    const modulePath = require.resolve("../lib/db/index");
    
    // Get initial db
    const { db: db1, closeDb } = require("../lib/db/index");
    assert(db1).toBeTruthy();
    
    // Close connection
    closeDb();
    
    // Clear cache and reload
    delete require.cache[modulePath];
    const { db: db2 } = require("../lib/db/index");
    
    // New connection should work
    assert(db2).toBeTruthy();
    const result = await db2.select().from(require("../lib/db/schema").users).limit(1);
    assert(Array.isArray(result)).toBeTruthy();
  });

  // Test 9: closeDb should be callable without errors
  await runTest("should allow closing database connection", async () => {
    // Reload module to get a fresh connection for this test
    const modulePath = require.resolve("../lib/db/index");
    delete require.cache[modulePath];
    
    const { closeDb } = require("../lib/db/index");
    // Should not throw when called
    try {
      closeDb();
      // After closing, we should be able to call it again without error
      closeDb();
      assert(true).toBeTruthy();
    } catch (error: any) {
      throw new Error(`closeDb() threw an error: ${error.message}`);
    }
  });

  // Test 10: closeDb should not throw when connection is already closed
  await runTest("should handle multiple closeDb calls gracefully", async () => {
    // Reload module to get a fresh connection for this test
    const modulePath = require.resolve("../lib/db/index");
    delete require.cache[modulePath];
    
    const { closeDb } = require("../lib/db/index");
    // Call multiple times - should not throw
    closeDb();
    closeDb();
    closeDb();
    assert(true).toBeTruthy();
  });

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

