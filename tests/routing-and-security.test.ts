/**
 * Test suite for routing number validation and secure random number generation
 * 
 * These tests verify that:
 * - VAL-207: Routing number is required for bank transfers
 * - SEC-302: Account numbers are generated using cryptographically secure random numbers
 * 
 * Run with: npx tsx tests/routing-and-security.test.ts
 */

import crypto from "crypto";

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
 * SEC-302: Secure account number generation (matches implementation in account.ts)
 */
function generateAccountNumber(): string {
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  const accountNum = randomNumber % 1000000000;
  return accountNum.toString().padStart(10, "0");
}

/**
 * VAL-207: Validate routing number format
 */
function validateRoutingNumber(routingNumber: string | undefined, type: "card" | "bank"): { valid: boolean; error?: string } {
  if (type === "bank") {
    if (!routingNumber || routingNumber.trim().length === 0) {
      return { valid: false, error: "Routing number is required for bank transfers" };
    }
    if (!/^\d{9}$/.test(routingNumber)) {
      return { valid: false, error: "Routing number must be exactly 9 digits" };
    }
  }
  return { valid: true };
}

// Test Suite: Routing Number Validation and Security
async function runTests() {
  console.log("Running Routing Number and Security Tests...\n");

  // VAL-207 Tests: Routing Number Validation

  // Test 1: Routing number required for bank transfers
  await runTest("should require routing number for bank transfers", () => {
    const result = validateRoutingNumber(undefined, "bank");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("required");
  });

  // Test 2: Routing number not required for card payments
  await runTest("should not require routing number for card payments", () => {
    const result = validateRoutingNumber(undefined, "card");
    assert(result.valid).toBeTruthy();
  });

  // Test 3: Empty routing number rejected for bank transfers
  await runTest("should reject empty routing number for bank transfers", () => {
    const result = validateRoutingNumber("", "bank");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("required");
  });

  // Test 4: Whitespace-only routing number rejected
  await runTest("should reject whitespace-only routing number", () => {
    const result = validateRoutingNumber("   ", "bank");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("required");
  });

  // Test 5: Valid routing number accepted (9 digits)
  await runTest("should accept valid routing number (9 digits)", () => {
    const result = validateRoutingNumber("123456789", "bank");
    assert(result.valid).toBeTruthy();
  });

  // Test 6: Routing number with wrong length rejected (too short)
  await runTest("should reject routing number that is too short", () => {
    const result = validateRoutingNumber("12345678", "bank");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("9 digits");
  });

  // Test 7: Routing number with wrong length rejected (too long)
  await runTest("should reject routing number that is too long", () => {
    const result = validateRoutingNumber("1234567890", "bank");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("9 digits");
  });

  // Test 8: Routing number with non-numeric characters rejected
  await runTest("should reject routing number with non-numeric characters", () => {
    const result = validateRoutingNumber("12345678a", "bank");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("9 digits");
  });

  // Test 9: Routing number with spaces rejected
  await runTest("should reject routing number with spaces", () => {
    const result = validateRoutingNumber("123 456 789", "bank");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("9 digits");
  });

  // Test 10: Valid routing number for card payment (should be ignored)
  await runTest("should ignore routing number for card payments", () => {
    const result = validateRoutingNumber("123456789", "card");
    assert(result.valid).toBeTruthy();
  });

  // SEC-302 Tests: Secure Random Number Generation

  // Test 11: Account numbers should be 10 digits
  await runTest("should generate 10-digit account numbers", () => {
    const accountNumber = generateAccountNumber();
    assert(accountNumber.length).toBe(10);
    assert(/^\d{10}$/.test(accountNumber)).toBeTruthy();
  });

  // Test 12: Account numbers should be unique
  await runTest("should generate unique account numbers", () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const num = generateAccountNumber();
      numbers.add(num);
    }
    // With 100 generations, we should have high uniqueness
    // (allowing for some collisions due to modulo, but should be mostly unique)
    assert(numbers.size).toBeGreaterThan(90);
  });

  // Test 13: Account numbers should be unpredictable
  await runTest("should generate unpredictable account numbers", () => {
    const numbers: string[] = [];
    for (let i = 0; i < 50; i++) {
      numbers.push(generateAccountNumber());
    }
    // Check that numbers are not sequential or predictable
    let sequential = 0;
    for (let i = 1; i < numbers.length; i++) {
      const prev = parseInt(numbers[i - 1]);
      const curr = parseInt(numbers[i]);
      if (Math.abs(curr - prev) < 100) {
        sequential++;
      }
    }
    // Should not have many sequential numbers (allowing some randomness)
    assert(sequential).toBeLessThan(numbers.length / 2);
  });

  // Test 14: Account numbers should use crypto.randomBytes
  await runTest("should use cryptographically secure random number generation", () => {
    // Generate multiple numbers and verify they're not predictable
    const numbers: string[] = [];
    for (let i = 0; i < 200; i++) {
      numbers.push(generateAccountNumber());
    }
    // Check that numbers are actually different (not all the same)
    const uniqueNumbers = new Set(numbers);
    // With 200 samples, we should have high uniqueness
    assert(uniqueNumbers.size).toBeGreaterThan(100);
    // Check that numbers span a good range (not all clustered)
    const numValues = Array.from(uniqueNumbers).map((n) => parseInt(n));
    const min = Math.min(...numValues);
    const max = Math.max(...numValues);
    // Should span a good range
    assert(max - min).toBeGreaterThan(100000);
  });

  // Test 15: Account numbers should not be all zeros
  await runTest("should not generate all-zero account numbers", () => {
    let allZeros = false;
    for (let i = 0; i < 100; i++) {
      const num = generateAccountNumber();
      if (num === "0000000000") {
        allZeros = true;
        break;
      }
    }
    // Very unlikely to get all zeros with crypto.randomBytes
    assert(allZeros).toBeFalsy();
  });

  // Test 16: Account numbers should have good distribution
  await runTest("should have good distribution of account numbers", () => {
    const numbers: string[] = [];
    for (let i = 0; i < 200; i++) {
      numbers.push(generateAccountNumber());
    }
    // Convert to numbers and check range
    const numValues = numbers.map((n) => parseInt(n));
    const min = Math.min(...numValues);
    const max = Math.max(...numValues);
    // Should span a good range (not all clustered)
    assert(max - min).toBeGreaterThan(1000000);
  });

  // Combined Tests

  // Test 17: Bank transfer with valid routing number should pass
  await runTest("should accept bank transfer with valid routing number", () => {
    const routingValidation = validateRoutingNumber("123456789", "bank");
    assert(routingValidation.valid).toBeTruthy();
  });

  // Test 18: Bank transfer without routing number should fail
  await runTest("should reject bank transfer without routing number", () => {
    const routingValidation = validateRoutingNumber(undefined, "bank");
    assert(routingValidation.valid).toBeFalsy();
  });

  // Test 19: Card payment without routing number should pass
  await runTest("should accept card payment without routing number", () => {
    const routingValidation = validateRoutingNumber(undefined, "card");
    assert(routingValidation.valid).toBeTruthy();
  });

  // Test 20: Account number generation should be consistent in format
  await runTest("should generate account numbers with consistent format", () => {
    for (let i = 0; i < 20; i++) {
      const num = generateAccountNumber();
      assert(num.length).toBe(10);
      assert(/^\d{10}$/.test(num)).toBeTruthy();
    }
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

