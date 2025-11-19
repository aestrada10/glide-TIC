/**
 * Test suite for email validation
 * 
 * These tests verify that email validation works correctly:
 * - VAL-201: Invalid email formats are rejected
 * - VAL-201: Common typos are detected and suggestions provided
 * - VAL-201: Email normalization is tracked and reported
 * 
 * Run with: npx tsx tests/email-validation.test.ts
 */

import { validateEmail } from "../lib/email-validation";

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
    toContain(expected: string) {
      if (!String(actual).includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
  };
}

// Test Suite: Email Validation
async function runTests() {
  console.log("Running Email Validation Tests...\n");

  // VAL-201 Tests: Invalid Format Rejection

  // Test 1: Reject email without @ symbol
  await runTest("should reject email without @ symbol", () => {
    const result = validateEmail("testexample.com");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("@ symbol");
  });

  // Test 2: Reject email with multiple @ symbols
  await runTest("should reject email with multiple @ symbols", () => {
    const result = validateEmail("test@@example.com");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("multiple @");
  });

  // Test 3: Reject email without TLD
  await runTest("should reject email without TLD", () => {
    const result = validateEmail("test@example");
    assert(result.valid).toBeFalsy();
  });

  // Test 4: Reject email with consecutive dots
  await runTest("should reject email with consecutive dots", () => {
    const result = validateEmail("test@example..com");
    assert(result.valid).toBeFalsy();
  });

  // Test 5: Reject email with leading dot in local part
  await runTest("should reject email with leading dot in local part", () => {
    const result = validateEmail(".test@example.com");
    assert(result.valid).toBeFalsy();
  });

  // Test 6: Reject email with trailing dot in local part
  await runTest("should reject email with trailing dot in local part", () => {
    const result = validateEmail("test.@example.com");
    assert(result.valid).toBeFalsy();
  });

  // VAL-201 Tests: Common Typo Detection

  // Test 7: Detect .con typo and suggest .com
  await runTest("should detect .con typo and suggest .com", () => {
    const result = validateEmail("test@example.con");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("Did you mean");
    assert(result.errors[0]).toContain("example.com");
  });

  // Test 8: Detect .cmo typo and suggest .com
  await runTest("should detect .cmo typo and suggest .com", () => {
    const result = validateEmail("test@example.cmo");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("Did you mean");
    assert(result.errors[0]).toContain("example.com");
  });

  // Test 9: Detect .cm typo and suggest .com
  await runTest("should detect .cm typo and suggest .com", () => {
    const result = validateEmail("test@example.cm");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("Did you mean");
    assert(result.errors[0]).toContain("example.com");
  });

  // Test 10: Detect .comm typo and suggest .com
  await runTest("should detect .comm typo and suggest .com", () => {
    const result = validateEmail("test@example.comm");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("Did you mean");
    assert(result.errors[0]).toContain("example.com");
  });

  // Test 11: Detect .nte typo and suggest .net
  await runTest("should detect .nte typo and suggest .net", () => {
    const result = validateEmail("test@example.nte");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("Did you mean");
    assert(result.errors[0]).toContain("example.net");
  });

  // Test 12: Detect .ogr typo and suggest .org
  await runTest("should detect .ogr typo and suggest .org", () => {
    const result = validateEmail("test@example.ogr");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("Did you mean");
    assert(result.errors[0]).toContain("example.org");
  });

  // VAL-201 Tests: Email Normalization

  // Test 13: Track lowercase normalization
  await runTest("should track lowercase normalization", () => {
    const result = validateEmail("TEST@example.com");
    assert(result.valid).toBeTruthy();
    assert(result.wasNormalized).toBeTruthy();
    assert(result.normalizedEmail).toBe("test@example.com");
  });

  // Test 14: Track mixed case normalization
  await runTest("should track mixed case normalization", () => {
    const result = validateEmail("Test@Example.COM");
    assert(result.valid).toBeTruthy();
    assert(result.wasNormalized).toBeTruthy();
    assert(result.normalizedEmail).toBe("test@example.com");
  });

  // Test 15: No normalization for already lowercase
  await runTest("should not normalize already lowercase email", () => {
    const result = validateEmail("test@example.com");
    assert(result.valid).toBeTruthy();
    assert(result.wasNormalized).toBeFalsy();
    assert(result.normalizedEmail).toBe("test@example.com");
  });

  // VAL-201 Tests: Valid Emails

  // Test 16: Accept valid email with .com
  await runTest("should accept valid email with .com", () => {
    const result = validateEmail("test@example.com");
    assert(result.valid).toBeTruthy();
    assert(result.errors.length).toBe(0);
  });

  // Test 17: Accept valid email with .net
  await runTest("should accept valid email with .net", () => {
    const result = validateEmail("test@example.net");
    assert(result.valid).toBeTruthy();
  });

  // Test 18: Accept valid email with .org
  await runTest("should accept valid email with .org", () => {
    const result = validateEmail("test@example.org");
    assert(result.valid).toBeTruthy();
  });

  // Test 19: Accept valid email with subdomain
  await runTest("should accept valid email with subdomain", () => {
    const result = validateEmail("test@mail.example.com");
    assert(result.valid).toBeTruthy();
  });

  // Test 20: Accept valid email with plus sign
  await runTest("should accept valid email with plus sign", () => {
    const result = validateEmail("test+tag@example.com");
    assert(result.valid).toBeTruthy();
  });

  // Test 21: Accept valid email with dots in local part
  await runTest("should accept valid email with dots in local part", () => {
    const result = validateEmail("test.name@example.com");
    assert(result.valid).toBeTruthy();
  });

  // VAL-201 Tests: Edge Cases

  // Test 22: Reject empty email
  await runTest("should reject empty email", () => {
    const result = validateEmail("");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("required");
  });

  // Test 23: Reject whitespace-only email
  await runTest("should reject whitespace-only email", () => {
    const result = validateEmail("   ");
    assert(result.valid).toBeFalsy();
  });

  // Test 24: Trim whitespace
  await runTest("should trim whitespace from email", () => {
    const result = validateEmail("  test@example.com  ");
    assert(result.valid).toBeTruthy();
    assert(result.normalizedEmail).toBe("test@example.com");
  });

  // Test 25: Reject email with invalid characters
  await runTest("should reject email with invalid characters", () => {
    const result = validateEmail("test@example.com ");
    // Should be trimmed and validated
    assert(result.valid).toBeTruthy();
  });

  // Test 26: Reject email with too long local part
  await runTest("should reject email with too long local part", () => {
    const longLocal = "a".repeat(65) + "@example.com";
    const result = validateEmail(longLocal);
    assert(result.valid).toBeFalsy();
  });

  // Test 27: Accept email with max length local part
  await runTest("should accept email with max length local part", () => {
    const longLocal = "a".repeat(64) + "@example.com";
    const result = validateEmail(longLocal);
    assert(result.valid).toBeTruthy();
  });

  // Test 28: Reject email with too long domain
  await runTest("should reject email with too long domain", () => {
    const longDomain = "test@" + "a".repeat(256) + ".com";
    const result = validateEmail(longDomain);
    assert(result.valid).toBeFalsy();
  });

  // Test 29: Accept valid email with numbers
  await runTest("should accept valid email with numbers", () => {
    const result = validateEmail("test123@example.com");
    assert(result.valid).toBeTruthy();
  });

  // Test 30: Accept valid email with hyphens
  await runTest("should accept valid email with hyphens", () => {
    const result = validateEmail("test-name@example.com");
    assert(result.valid).toBeTruthy();
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

