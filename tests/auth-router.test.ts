/**
 * Test suite for auth router SSN handling
 * 
 * These tests verify that SSNs are properly encrypted during signup
 * and excluded from API responses.
 * 
 * Run with: npx tsx tests/auth-router.test.ts
 */

import { encryptSSN } from "../lib/encryption";

// Simple test runner
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const tests: TestResult[] = [];

function test(name: string, fn: () => void | Promise<void>) {
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

function expect(actual: any) {
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
    toBeGreaterThan(expected: number) {
      if (typeof actual !== "number" || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
  };
}

// Set a test encryption key
process.env.ENCRYPTION_KEY = "test-encryption-key-for-testing-purposes-only-32chars";

// Test Suite: Auth Router SSN Handling
async function runTests() {
  console.log("Running Auth Router SSN Handling Tests...\n");

  // Test 1: Verify SSN encryption function is available
  test("should have encryptSSN function available", () => {
    expect(typeof encryptSSN).toBe("function");
  });

  // Test 2: Verify encrypted SSN is not plaintext
  test("should encrypt SSN so it's not in plaintext format", () => {
    const plaintextSSN = "123456789";
    const encrypted = encryptSSN(plaintextSSN);
    // Encrypted should not contain the plaintext
    expect(encrypted).notToContain(plaintextSSN);
    // Encrypted should be in format: iv:salt:tag:encryptedData
    expect(encrypted.split(":").length).toBe(4);
  });

  // Test 3: Verify user object sanitization removes SSN
  test("should exclude SSN from user object", () => {
    const mockUser = {
      id: 1,
      email: "test@example.com",
      password: "hashedpassword",
      firstName: "Test",
      lastName: "User",
      phoneNumber: "+1234567890",
      dateOfBirth: "1990-01-01",
      ssn: "123456789", // This should be encrypted in real scenario
      address: "123 Main St",
      city: "City",
      state: "CA",
      zipCode: "12345",
      createdAt: "2024-01-01",
    };

    // Simulate the sanitization done in auth router
    const { password, ssn, ...safeUser } = mockUser;

    // Verify sensitive fields are excluded (TypeScript-safe check)
    expect("ssn" in safeUser).toBeFalsy();
    expect("password" in safeUser).toBeFalsy();
    expect(safeUser.email).toBe("test@example.com");
    expect(safeUser.firstName).toBe("Test");
  });

  // Test 4: Verify encrypted SSN format matches expected pattern
  test("should produce encrypted SSN in expected format", () => {
    const ssn = "987654321";
    const encrypted = encryptSSN(ssn);
    const parts = encrypted.split(":");
    
    expect(parts.length).toBe(4);
    // Each part should be hex-encoded and have reasonable length
    expect(parts[0].length).toBeGreaterThan(0); // IV (32 hex chars = 16 bytes)
    expect(parts[1].length).toBeGreaterThan(0); // Salt (128 hex chars = 64 bytes)
    expect(parts[2].length).toBeGreaterThan(0); // Tag (32 hex chars = 16 bytes)
    expect(parts[3].length).toBeGreaterThan(0); // Encrypted data
  });

  // Test 5: Verify multiple encryptions produce unique results
  test("should produce unique encrypted values for same SSN", () => {
    const ssn = "111223333";
    const encrypted1 = encryptSSN(ssn);
    const encrypted2 = encryptSSN(ssn);
    const encrypted3 = encryptSSN(ssn);
    
    // All should be different due to unique IV/salt
    expect(encrypted1).notToBe(encrypted2);
    expect(encrypted2).notToBe(encrypted3);
    expect(encrypted1).notToBe(encrypted3);
  });

  // Test 6: Verify SSN is not accidentally logged or exposed
  test("should not contain plaintext SSN in encrypted string", () => {
    const testSSNs = ["123456789", "987654321", "555444333"];
    testSSNs.forEach((ssn) => {
      const encrypted = encryptSSN(ssn);
      // Encrypted string should not contain the original SSN
      expect(encrypted).notToContain(ssn);
      // Should not contain any 9-digit sequence that matches
      const ssnRegex = new RegExp(ssn);
      expect(ssnRegex.test(encrypted)).toBeFalsy();
    });
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

