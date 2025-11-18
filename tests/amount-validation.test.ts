/**
 * Test suite for amount validation
 * 
 * These tests verify that amount validation works correctly:
 * - VAL-205: Zero amounts are rejected
 * - VAL-209: Amounts with multiple leading zeros are rejected
 * 
 * Run with: npx tsx tests/amount-validation.test.ts
 */

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
 * VAL-205 & VAL-209: Validate amount (matches frontend validation logic)
 */
function validateAmount(value: string): { valid: boolean; error?: string } {
  // Required
  if (!value || value.trim().length === 0) {
    return { valid: false, error: "Amount is required" };
  }

  // VAL-209: Check for multiple leading zeros FIRST (before pattern check)
  // Matches: "000123", "00123.45", "00.01", etc.
  if (/^0{2,}/.test(value) && value !== "0" && !value.startsWith("0.")) {
    return { valid: false, error: "Amount cannot have leading zeros" };
  }

  // Pattern validation (VAL-209 fix: reject multiple leading zeros)
  const pattern = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
  if (!pattern.test(value)) {
    return { valid: false, error: "Invalid amount format" };
  }

  // Parse and validate
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: "Invalid amount format" };
  }

  // VAL-205: Reject zero amounts
  if (num === 0) {
    return { valid: false, error: "Amount must be greater than $0.00" };
  }

  // VAL-205: Ensure positive
  if (num <= 0) {
    return { valid: false, error: "Amount must be greater than $0.00" };
  }

  // Minimum amount
  if (num < 0.01) {
    return { valid: false, error: "Amount must be at least $0.01" };
  }

  // Maximum amount
  if (num > 10000) {
    return { valid: false, error: "Amount cannot exceed $10,000" };
  }

  return { valid: true };
}

/**
 * Backend validation (matches server validation logic)
 */
function validateAmountBackend(amount: number): { valid: boolean; error?: string } {
  // VAL-205: Reject zero or negative amounts
  if (amount <= 0 || isNaN(amount)) {
    return { valid: false, error: "Amount must be greater than $0.00" };
  }

  // VAL-205: Ensure minimum amount
  if (amount < 0.01) {
    return { valid: false, error: "Amount must be at least $0.01" };
  }

  // Maximum amount
  if (amount > 10000) {
    return { valid: false, error: "Amount cannot exceed $10,000" };
  }

  return { valid: true };
}

// Test Suite: Amount Validation
async function runTests() {
  console.log("Running Amount Validation Tests...\n");

  // VAL-205 Tests: Zero Amount Rejection

  // Test 1: Reject "0"
  await runTest("should reject amount of '0'", () => {
    const result = validateAmount("0");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("greater than $0.00");
  });

  // Test 2: Reject "0.00"
  await runTest("should reject amount of '0.00'", () => {
    const result = validateAmount("0.00");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("greater than $0.00");
  });

  // Test 3: Reject "0.0"
  await runTest("should reject amount of '0.0'", () => {
    const result = validateAmount("0.0");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("greater than $0.00");
  });

  // Test 4: Reject "0.000"
  await runTest("should reject amount of '0.000'", () => {
    const result = validateAmount("0.000");
    assert(result.valid).toBeFalsy();
  });

  // Test 5: Accept minimum amount ($0.01)
  await runTest("should accept minimum amount of $0.01", () => {
    const result = validateAmount("0.01");
    assert(result.valid).toBeTruthy();
  });

  // Test 6: Backend rejects zero amount
  await runTest("should reject zero amount in backend validation", () => {
    const result = validateAmountBackend(0);
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("greater than $0.00");
  });

  // Test 7: Backend rejects negative amount
  await runTest("should reject negative amount in backend validation", () => {
    const result = validateAmountBackend(-10);
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("greater than $0.00");
  });

  // VAL-209 Tests: Leading Zeros Rejection

  // Test 8: Reject "000123.45"
  await runTest("should reject amount with multiple leading zeros (000123.45)", () => {
    const result = validateAmount("000123.45");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("leading zeros");
  });

  // Test 9: Reject "00123.45"
  await runTest("should reject amount with multiple leading zeros (00123.45)", () => {
    const result = validateAmount("00123.45");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("leading zeros");
  });

  // Test 10: Reject "0000123"
  await runTest("should reject amount with multiple leading zeros (0000123)", () => {
    const result = validateAmount("0000123");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("leading zeros");
  });

  // Test 11: Accept amount without leading zeros
  await runTest("should accept amount without leading zeros (123.45)", () => {
    const result = validateAmount("123.45");
    assert(result.valid).toBeTruthy();
  });

  // Test 12: Accept amount starting with 1-9
  await runTest("should accept amount starting with 1-9", () => {
    const result = validateAmount("1000.00");
    assert(result.valid).toBeTruthy();
  });

  // Valid Amount Tests

  // Test 13: Accept valid amount ($1.00)
  await runTest("should accept valid amount of $1.00", () => {
    const result = validateAmount("1.00");
    assert(result.valid).toBeTruthy();
  });

  // Test 14: Accept valid amount ($100.50)
  await runTest("should accept valid amount of $100.50", () => {
    const result = validateAmount("100.50");
    assert(result.valid).toBeTruthy();
  });

  // Test 15: Accept valid amount without decimals
  await runTest("should accept valid amount without decimals", () => {
    const result = validateAmount("1000");
    assert(result.valid).toBeTruthy();
  });

  // Test 16: Accept maximum amount ($10,000)
  await runTest("should accept maximum amount of $10,000", () => {
    const result = validateAmount("10000");
    assert(result.valid).toBeTruthy();
  });

  // Test 17: Reject amount exceeding maximum
  await runTest("should reject amount exceeding maximum ($10,001)", () => {
    const result = validateAmount("10001");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("exceed $10,000");
  });

  // Test 18: Backend rejects amount exceeding maximum
  await runTest("should reject amount exceeding maximum in backend", () => {
    const result = validateAmountBackend(10001);
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("exceed $10,000");
  });

  // Edge Cases

  // Test 19: Reject empty string
  await runTest("should reject empty amount", () => {
    const result = validateAmount("");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("required");
  });

  // Test 20: Reject whitespace-only
  await runTest("should reject whitespace-only amount", () => {
    const result = validateAmount("   ");
    assert(result.valid).toBeFalsy();
  });

  // Test 21: Reject non-numeric characters
  await runTest("should reject amount with non-numeric characters", () => {
    const result = validateAmount("abc123");
    assert(result.valid).toBeFalsy();
  });

  // Test 22: Reject amount with more than 2 decimal places
  await runTest("should reject amount with more than 2 decimal places", () => {
    const result = validateAmount("123.456");
    assert(result.valid).toBeFalsy();
  });

  // Test 23: Accept amount with 1 decimal place
  await runTest("should accept amount with 1 decimal place", () => {
    const result = validateAmount("123.4");
    assert(result.valid).toBeTruthy();
  });

  // Test 24: Accept amount with 2 decimal places
  await runTest("should accept amount with 2 decimal places", () => {
    const result = validateAmount("123.45");
    assert(result.valid).toBeTruthy();
  });

  // Test 25: Reject amount less than $0.01
  await runTest("should reject amount less than $0.01", () => {
    const result = validateAmount("0.001");
    // This might fail pattern check (more than 2 decimal places) or minimum check
    assert(result.valid).toBeFalsy();
  });

  // Test 26: Backend rejects amount less than $0.01
  await runTest("should reject amount less than $0.01 in backend", () => {
    const result = validateAmountBackend(0.001);
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("at least $0.01");
  });

  // Test 27: Accept amount exactly $0.01
  await runTest("should accept amount exactly $0.01", () => {
    const result = validateAmount("0.01");
    assert(result.valid).toBeTruthy();
  });

  // Test 28: Backend accepts valid amount
  await runTest("should accept valid amount in backend validation", () => {
    const result = validateAmountBackend(100.50);
    assert(result.valid).toBeTruthy();
  });

  // Test 29: Reject amount with negative sign
  await runTest("should reject amount with negative sign", () => {
    const result = validateAmount("-100");
    assert(result.valid).toBeFalsy();
  });

  // Test 30: Pattern should reject "00.01" (multiple leading zeros)
  await runTest("should reject '00.01' (multiple leading zeros)", () => {
    const result = validateAmount("00.01");
    assert(result.valid).toBeFalsy();
    assert(result.error).toContain("leading zeros");
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

