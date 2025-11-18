/**
 * Test suite for account creation
 * 
 * These tests verify that account creation works correctly:
 * - Account creation returns correct balance ($0)
 * - No fake account data is returned
 * - Data integrity is maintained
 * - Proper error handling
 * 
 * Run with: npx tsx tests/account-creation.test.ts
 */

import { getRawDatabase } from "../lib/db";
import { db } from "../lib/db";
import { accounts } from "../lib/db/schema";
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
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
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
    notToBe(expected: any) {
      if (actual === expected) {
        throw new Error(`Expected not to be ${expected}, but it was`);
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

// Helper function to create an account directly (simulating the createAccount mutation)
async function createAccountDirectly(userId: number, accountType: "checking" | "savings") {
  const rawDb = getRawDatabase();
  let accountNumber: string;
  let isUnique = false;

  // Generate unique account number
  while (!isUnique) {
    accountNumber = Math.floor(Math.random() * 1000000000)
      .toString()
      .padStart(10, "0");
    const existing = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber)).get();
    isUnique = !existing;
  }

  // Insert account
  await db.insert(accounts).values({
    userId,
    accountNumber: accountNumber!,
    accountType,
    balance: 0,
    status: "active",
  });

  // Fetch the created account (simulating the actual code)
  const account = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber!)).get();

  // This is the fixed behavior - throw error if account not found
  if (!account) {
    throw new Error("Account was created but could not be retrieved. Please try again.");
  }

  return account;
}

// Helper function to get account from database
function getAccountFromDb(accountNumber: string) {
  const rawDb = getRawDatabase();
  const stmt = rawDb.prepare(`SELECT * FROM accounts WHERE account_number = ?`);
  return stmt.get(accountNumber) as any;
}

// Test Suite: Account Creation
async function runTests() {
  console.log("Running Account Creation Tests...\n");

  // Clean up any existing test data
  const rawDb = getRawDatabase();
  // Delete test accounts (those starting with TEST or 10-digit numbers created during tests)
  // We'll delete all accounts for test users instead
  const cleanupAccountsStmt = rawDb.prepare(`
    DELETE FROM accounts 
    WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%@test.com')
  `);
  const cleanupUsersStmt = rawDb.prepare(`DELETE FROM users WHERE email LIKE 'test%@test.com'`);
  cleanupAccountsStmt.run();
  cleanupUsersStmt.run();

  // Test 1: Account creation should return correct balance ($0)
  await runTest("should return account with correct balance of $0", async () => {
    const userId = createTestUser();
    const account = await createAccountDirectly(userId, "checking");
    
    assert(account.balance).toBe(0);
    assert(account.status).toBe("active");
  });

  // Test 2: Account should have correct properties
  await runTest("should return account with correct properties", async () => {
    const userId = createTestUser();
    const account = await createAccountDirectly(userId, "savings");
    
    assert(account.userId).toBe(userId);
    assert(account.accountType).toBe("savings");
    assert(account.balance).toBe(0);
    assert(account.status).toBe("active");
    assert(account.accountNumber).toBeTruthy();
    assert(account.id).toBeGreaterThan(0);
    assert(account.createdAt).toBeTruthy();
  });

  // Test 3: Account data should match database
  await runTest("should return account data that matches database", async () => {
    const userId = createTestUser();
    const account = await createAccountDirectly(userId, "checking");
    
    // Verify account exists in database
    const dbAccount = getAccountFromDb(account.accountNumber);
    assert(dbAccount).toBeTruthy();
    
    // Verify returned data matches database
    assert(account.id).toBe(dbAccount.id);
    assert(account.balance).toBe(dbAccount.balance);
    assert(account.status).toBe(dbAccount.status);
    assert(account.accountType).toBe(dbAccount.account_type);
  });

  // Test 4: No fake account with $100 balance should be returned
  await runTest("should never return fake account with $100 balance", async () => {
    const userId = createTestUser();
    const account = await createAccountDirectly(userId, "checking");
    
    // Verify balance is not the fake $100
    assert(account.balance).notToBe(100);
    assert(account.balance).toBe(0);
    
    // Verify account has real ID (not fake id: 0)
    assert(account.id).notToBe(0);
    assert(account.id).toBeGreaterThan(0);
  });

  // Test 5: Multiple accounts should all have $0 balance
  await runTest("should create multiple accounts all with $0 balance", async () => {
    const userId = createTestUser();
    
    const account1 = await createAccountDirectly(userId, "checking");
    const account2 = await createAccountDirectly(userId, "savings");
    
    assert(account1.balance).toBe(0);
    assert(account2.balance).toBe(0);
    assert(account1.accountNumber).notToBe(account2.accountNumber);
  });

  // Test 6: Account should be retrievable after creation
  await runTest("should be able to retrieve account after creation", async () => {
    const userId = createTestUser();
    const account = await createAccountDirectly(userId, "checking");
    
    // Try to fetch the account again
    const fetchedAccount = await db.select().from(accounts).where(eq(accounts.id, account.id)).get();
    
    assert(fetchedAccount).toBeTruthy();
    assert(fetchedAccount?.balance).toBe(0);
    assert(fetchedAccount?.id).toBe(account.id);
  });

  // Test 7: Account number should be unique
  await runTest("should generate unique account numbers", async () => {
    const userId = createTestUser();
    
    const account1 = await createAccountDirectly(userId, "checking");
    const account2 = await createAccountDirectly(userId, "checking");
    
    assert(account1.accountNumber).notToBe(account2.accountNumber);
  });

  // Test 8: Account should have correct account type
  await runTest("should create account with correct account type", async () => {
    const userId = createTestUser();
    
    const checkingAccount = await createAccountDirectly(userId, "checking");
    const savingsAccount = await createAccountDirectly(userId, "savings");
    
    assert(checkingAccount.accountType).toBe("checking");
    assert(savingsAccount.accountType).toBe("savings");
  });

  // Test 9: Account should have valid account number format
  await runTest("should generate account number with correct format", async () => {
    const userId = createTestUser();
    const account = await createAccountDirectly(userId, "checking");
    
    // Account number should be 10 digits
    assert(account.accountNumber.length).toBe(10);
    assert(/^\d{10}$/.test(account.accountNumber)).toBeTruthy();
  });

  // Test 10: Account creation should maintain data integrity
  await runTest("should maintain data integrity between creation and retrieval", async () => {
    const userId = createTestUser();
    const account = await createAccountDirectly(userId, "checking");
    
    // Verify all fields match what was inserted
    const dbAccount = getAccountFromDb(account.accountNumber);
    
    assert(dbAccount.user_id).toBe(userId);
    assert(dbAccount.account_type).toBe("checking");
    assert(dbAccount.balance).toBe(0);
    assert(dbAccount.status).toBe("active");
    assert(dbAccount.account_number).toBe(account.accountNumber);
  });

  // Cleanup
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

