/**
 * Test suite for password validation
 * 
 * These tests verify that password validation enforces strong password requirements
 * including length, complexity, and pattern checks.
 * 
 * Run with: npx tsx tests/password-validation.test.ts
 */

import { validatePasswordStrength } from "../lib/password-validation";

// Simple test runner
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const tests: TestResult[] = [];

function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          tests.push({ name, passed: true });
        })
        .catch((error) => {
          tests.push({ name, passed: false, error: error.message });
        });
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
    toContain(item: any) {
      if (!actual.includes || !actual.includes(item)) {
        throw new Error(`Expected ${actual} to contain ${item}`);
      }
    },
    notToContain(item: any) {
      if (actual.includes && actual.includes(item)) {
        throw new Error(`Expected ${actual} not to contain ${item}`);
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
    toHaveLength(expected: number) {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, but got ${actual.length}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== "number" || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
  };
}

// Test Suite: Password Validation
async function runTests() {
  console.log("Running Password Validation Tests...\n");

  // Test 1: Valid strong password should pass
  runTest("should accept valid strong password", () => {
    const result = validatePasswordStrength("SecureP@ss123");
    assert(result.valid).toBeTruthy();
    assert(result.errors).toHaveLength(0);
  });

  // Test 2: Password too short should fail
  runTest("should reject password shorter than 8 characters", () => {
    const result = validatePasswordStrength("Pass1!");
    assert(result.valid).toBeFalsy();
    assert(result.errors.length).toBeGreaterThan(0);
    assert(result.errors.some((e) => e.includes("8 characters"))).toBeTruthy();
  });

  // Test 3: Password without uppercase should fail
  runTest("should reject password without uppercase letter", () => {
    const result = validatePasswordStrength("securepass123!");
    assert(result.valid).toBeFalsy();
    assert(result.errors.some((e) => e.includes("uppercase"))).toBeTruthy();
  });

  // Test 4: Password without lowercase should fail
  runTest("should reject password without lowercase letter", () => {
    const result = validatePasswordStrength("SECUREPASS123!");
    assert(result.valid).toBeFalsy();
    assert(result.errors.some((e) => e.includes("lowercase"))).toBeTruthy();
  });

  // Test 5: Password without number should fail
  runTest("should reject password without number", () => {
    const result = validatePasswordStrength("SecurePass!");
    assert(result.valid).toBeFalsy();
    assert(result.errors.some((e) => e.includes("number"))).toBeTruthy();
  });

  // Test 6: Password without special character should fail
  runTest("should reject password without special character", () => {
    const result = validatePasswordStrength("SecurePass123");
    assert(result.valid).toBeFalsy();
    assert(result.errors.some((e) => e.includes("special character"))).toBeTruthy();
  });

  // Test 7: Common password should be rejected
  runTest("should reject common password 'password'", () => {
    const result = validatePasswordStrength("password");
    assert(result.valid).toBeFalsy();
    assert(result.errors.some((e) => e.includes("common"))).toBeTruthy();
  });

  // Test 8: Common password variations should be rejected
  runTest("should reject common password '12345678'", () => {
    const result = validatePasswordStrength("12345678");
    assert(result.valid).toBeFalsy();
    // Should fail for multiple reasons (no uppercase, lowercase, special char, and common)
    assert(result.errors.length).toBeGreaterThan(0);
  });

  // Test 9: Password with repeated characters should fail
  runTest("should reject password with too many repeated characters", () => {
    const result = validatePasswordStrength("SecureP@sssss123");
    assert(result.valid).toBeFalsy();
    assert(result.errors.some((e) => e.includes("repeated characters"))).toBeTruthy();
  });

  // Test 10: Password with sequential numbers should fail
  runTest("should reject password with sequential numbers", () => {
    const result = validatePasswordStrength("SecureP@ss12345");
    assert(result.valid).toBeFalsy();
    assert(result.errors.some((e) => e.includes("sequential"))).toBeTruthy();
  });

  // Test 11: Password with sequential letters should fail
  runTest("should reject password with sequential letters", () => {
    const result = validatePasswordStrength("SecureP@ssabcdef123");
    assert(result.valid).toBeFalsy();
    assert(result.errors.some((e) => e.includes("sequential"))).toBeTruthy();
  });

  // Test 12: Empty password should fail
  runTest("should reject empty password", () => {
    const result = validatePasswordStrength("");
    assert(result.valid).toBeFalsy();
    assert(result.errors.length).toBeGreaterThan(0);
  });

  // Test 13: Password with all requirements should pass
  runTest("should accept password with all requirements met", () => {
    const validPasswords = [
      "MyP@ssw0rd",
      "Str0ng!Pass",
      "Test123!@#",
      "Secure$2024",
      "Bank1ng#Pass",
    ];
    validPasswords.forEach((password) => {
      const result = validatePasswordStrength(password);
      assert(result.valid).toBeTruthy();
      assert(result.errors).toHaveLength(0);
    });
  });

  // Test 14: Password with special characters should pass
  runTest("should accept password with various special characters", () => {
    const specialChars = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+", "-", "="];
    specialChars.forEach((char) => {
      const password = `SecureP${char}ss123`;
      const result = validatePasswordStrength(password);
      assert(result.valid).toBeTruthy();
    });
  });

  // Test 15: Multiple validation errors should be reported
  runTest("should report multiple validation errors", () => {
    const result = validatePasswordStrength("weak");
    assert(result.valid).toBeFalsy();
    // Should have multiple errors (length, uppercase, lowercase, number, special char)
    assert(result.errors.length).toBeGreaterThan(1);
  });

  // Test 16: Password exactly 8 characters with all requirements should pass
  runTest("should accept password exactly 8 characters with all requirements", () => {
    const result = validatePasswordStrength("Pass1!@#");
    assert(result.valid).toBeTruthy();
    assert(result.errors).toHaveLength(0);
  });

  // Test 17: Password with mixed case, numbers, and special chars should pass
  runTest("should accept complex password with mixed requirements", () => {
    const result = validatePasswordStrength("MySecureBank@2024!");
    assert(result.valid).toBeTruthy();
    assert(result.errors).toHaveLength(0);
  });

  // Test 18: Common password in different case should be rejected
  runTest("should reject common password regardless of case", () => {
    const commonPasswords = ["PASSWORD", "Password", "PASSW0RD", "passw0rd"];
    commonPasswords.forEach((password) => {
      const result = validatePasswordStrength(password);
      // May fail for multiple reasons, but should at least fail
      if (result.valid) {
        throw new Error(`Common password "${password}" was accepted`);
      }
    });
  });

  // Test 19: Password with only 2 repeated chars should pass
  runTest("should accept password with 2 repeated characters (below threshold)", () => {
    const result = validatePasswordStrength("SecureP@ss123");
    assert(result.valid).toBeTruthy();
  });

  // Test 20: Password with 3 repeated chars should pass (threshold is 4+)
  runTest("should accept password with 3 repeated characters (at threshold)", () => {
    const result = validatePasswordStrength("SecureP@sss123");
    assert(result.valid).toBeTruthy();
  });

  // Wait for async tests
  await new Promise((resolve) => setTimeout(resolve, 100));

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

