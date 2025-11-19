/**
 * Test suite for state code and phone number validation
 * 
 * These tests verify that validation works correctly:
 * - VAL-203: Invalid state codes are rejected
 * - VAL-204: Phone numbers are properly validated (US and international)
 * 
 * Run with: npx tsx tests/state-phone-validation.test.ts
 */

import { validateStateCode } from "../lib/state-validation";
import { validatePhoneNumber } from "../lib/phone-validation";

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

// Test Suite: State Code Validation (VAL-203)
async function runTests() {
  console.log("Running State Code and Phone Number Validation Tests...\n");

  // VAL-203 Tests: Invalid State Codes

  // Test 1: Reject "XX"
  await runTest("should reject invalid state code 'XX'", () => {
    const result = validateStateCode("XX");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("not a valid US state code");
  });

  // Test 2: Reject "ZZ"
  await runTest("should reject invalid state code 'ZZ'", () => {
    const result = validateStateCode("ZZ");
    assert(result.valid).toBeFalsy();
  });

  // Test 3: Reject "AB"
  await runTest("should reject invalid state code 'AB'", () => {
    const result = validateStateCode("AB");
    assert(result.valid).toBeFalsy();
  });

  // Test 4: Reject empty state code
  await runTest("should reject empty state code", () => {
    const result = validateStateCode("");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("required");
  });

  // Test 5: Reject state code with wrong length
  await runTest("should reject state code with wrong length", () => {
    const result = validateStateCode("C");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("exactly 2 letters");
  });

  // Test 6: Reject state code with numbers
  await runTest("should reject state code with numbers", () => {
    const result = validateStateCode("12");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("only letters");
  });

  // VAL-203 Tests: Valid State Codes

  // Test 7: Accept valid state code "CA"
  await runTest("should accept valid state code 'CA'", () => {
    const result = validateStateCode("CA");
    assert(result.valid).toBeTruthy();
  });

  // Test 8: Accept valid state code "NY"
  await runTest("should accept valid state code 'NY'", () => {
    const result = validateStateCode("NY");
    assert(result.valid).toBeTruthy();
  });

  // Test 9: Accept valid state code "TX"
  await runTest("should accept valid state code 'TX'", () => {
    const result = validateStateCode("TX");
    assert(result.valid).toBeTruthy();
  });

  // Test 10: Accept valid state code "DC"
  await runTest("should accept valid state code 'DC'", () => {
    const result = validateStateCode("DC");
    assert(result.valid).toBeTruthy();
  });

  // Test 11: Accept lowercase state code (normalized)
  await runTest("should accept lowercase state code and normalize", () => {
    const result = validateStateCode("ca");
    assert(result.valid).toBeTruthy();
  });

  // Test 12: Accept mixed case state code (normalized)
  await runTest("should accept mixed case state code and normalize", () => {
    const result = validateStateCode("Ca");
    assert(result.valid).toBeTruthy();
  });

  // VAL-204 Tests: Invalid Phone Numbers

  // Test 13: Reject phone number that's too short
  await runTest("should reject phone number that's too short", () => {
    const result = validatePhoneNumber("+123");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("between 7 and 15 digits");
  });

  // Test 14: Reject phone number that's too long
  await runTest("should reject phone number that's too long", () => {
    const result = validatePhoneNumber("+1234567890123456");
    assert(result.valid).toBeFalsy();
  });

  // Test 15: Reject phone number without country code
  await runTest("should reject international phone without proper format", () => {
    const result = validatePhoneNumber("123456789012345");
    // Should be rejected as too long for US format
    assert(result.valid).toBeFalsy();
  });

  // Test 16: Reject phone number with invalid characters
  await runTest("should reject phone number with invalid characters", () => {
    const result = validatePhoneNumber("+1234567890abc");
    assert(result.valid).toBeFalsy();
  });

  // VAL-204 Tests: Valid US Phone Numbers

  // Test 17: Accept US phone number with +1
  await runTest("should accept US phone number with +1", () => {
    const result = validatePhoneNumber("+1234567890");
    assert(result.valid).toBeTruthy();
    assert(result.normalizedPhone).toBe("+1234567890");
  });

  // Test 18: Accept US phone number without + (normalized)
  await runTest("should accept US phone number without + and normalize", () => {
    const result = validatePhoneNumber("1234567890");
    assert(result.valid).toBeTruthy();
    assert(result.normalizedPhone).toBe("+11234567890");
  });

  // Test 19: Accept US phone number with formatting
  await runTest("should accept US phone number with formatting", () => {
    const result = validatePhoneNumber("(123) 456-7890");
    assert(result.valid).toBeTruthy();
    assert(result.normalizedPhone).toBe("+11234567890");
  });

  // VAL-204 Tests: Valid International Phone Numbers

  // Test 20: Accept UK phone number
  await runTest("should accept UK phone number", () => {
    const result = validatePhoneNumber("+441234567890");
    assert(result.valid).toBeTruthy();
  });

  // Test 21: Accept French phone number
  await runTest("should accept French phone number", () => {
    const result = validatePhoneNumber("+33123456789");
    assert(result.valid).toBeTruthy();
  });

  // Test 22: Accept German phone number
  await runTest("should accept German phone number", () => {
    const result = validatePhoneNumber("+491234567890");
    assert(result.valid).toBeTruthy();
  });

  // Test 23: Accept phone number with spaces
  await runTest("should accept phone number with spaces", () => {
    const result = validatePhoneNumber("+1 234 567 8901");
    assert(result.valid).toBeTruthy();
    assert(result.normalizedPhone).toBe("+12345678901");
  });

  // Test 24: Accept phone number with dashes
  await runTest("should accept phone number with dashes", () => {
    const result = validatePhoneNumber("+1-234-567-8901");
    assert(result.valid).toBeTruthy();
    assert(result.normalizedPhone).toBe("+12345678901");
  });

  // VAL-204 Tests: Edge Cases

  // Test 25: Reject empty phone number
  await runTest("should reject empty phone number", () => {
    const result = validatePhoneNumber("");
    assert(result.valid).toBeFalsy();
    assert(result.errors[0]).toContain("required");
  });

  // Test 26: Reject whitespace-only phone number
  await runTest("should reject whitespace-only phone number", () => {
    const result = validatePhoneNumber("   ");
    assert(result.valid).toBeFalsy();
  });

  // Test 27: Accept phone number with leading/trailing whitespace (trimmed)
  await runTest("should trim whitespace from phone number", () => {
    const result = validatePhoneNumber("  +1234567890  ");
    assert(result.valid).toBeTruthy();
    assert(result.normalizedPhone).toBe("+1234567890");
  });

  // Test 28: Reject phone number starting with 0 after +
  await runTest("should reject phone number starting with 0 after +", () => {
    const result = validatePhoneNumber("+0123456789");
    assert(result.valid).toBeFalsy();
  });

  // Test 29: Accept valid state codes for all 50 states
  await runTest("should accept all 50 US state codes", () => {
    const states = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
      "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
      "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
      "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
      "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
    
    states.forEach((state) => {
      const result = validateStateCode(state);
      if (!result.valid) {
        throw new Error(`State code ${state} should be valid`);
      }
    });
  });

  // Test 30: Accept valid territories
  await runTest("should accept valid US territories", () => {
    const territories = ["DC", "AS", "GU", "MP", "PR", "VI"];
    territories.forEach((territory) => {
      const result = validateStateCode(territory);
      if (!result.valid) {
        throw new Error(`Territory code ${territory} should be valid`);
      }
    });
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

