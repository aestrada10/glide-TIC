/**
 * Test suite for SSN encryption functionality
 * 
 * Run with: npx tsx tests/encryption.test.ts
 * Or configure a test runner like Jest/Vitest
 */

import { encryptSSN, decryptSSN } from "../lib/encryption";

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
    toMatch(regex: RegExp) {
      if (!regex.test(actual)) {
        throw new Error(`Expected ${actual} to match ${regex}`);
      }
    },
    toThrow() {
      let threw = false;
      try {
        if (typeof actual === "function") {
          actual();
        }
      } catch {
        threw = true;
      }
      if (!threw) {
        throw new Error("Expected function to throw, but it didn't");
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
      if (typeof actual !== "number" || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
  };
}

// Set a test encryption key
process.env.ENCRYPTION_KEY = "test-encryption-key-for-testing-purposes-only-32chars";

// Test Suite: SSN Encryption
async function runTests() {
  console.log("Running SSN Encryption Tests...\n");

  // Test 1: Basic encryption and decryption
  test("should encrypt and decrypt SSN correctly", () => {
    const originalSSN = "123456789";
    const encrypted = encryptSSN(originalSSN);
    const decrypted = decryptSSN(encrypted);
    expect(decrypted).toBe(originalSSN);
  });

  // Test 2: Same SSN produces different ciphertext (due to unique IV/salt)
  test("should produce different ciphertext for same SSN", () => {
    const ssn = "987654321";
    const encrypted1 = encryptSSN(ssn);
    const encrypted2 = encryptSSN(ssn);
    expect(encrypted1).notToBe(encrypted2);
    // Both should decrypt to the same value
    expect(decryptSSN(encrypted1)).toBe(ssn);
    expect(decryptSSN(encrypted2)).toBe(ssn);
  });

  // Test 3: Encrypted format validation
  test("should produce encrypted data in correct format", () => {
    const ssn = "111223333";
    const encrypted = encryptSSN(ssn);
    // Format: iv:salt:tag:encryptedData (all hex)
    const parts = encrypted.split(":");
    expect(parts.length).toBe(4);
    // Each part should be hex-encoded
    parts.forEach((part) => {
      expect(part).toMatch(/^[0-9a-f]+$/i);
    });
  });

  // Test 4: Encryption handles various SSN formats
  test("should encrypt different SSN values", () => {
    const ssns = ["000000000", "123456789", "999999999", "555555555"];
    ssns.forEach((ssn) => {
      const encrypted = encryptSSN(ssn);
      const decrypted = decryptSSN(encrypted);
      expect(decrypted).toBe(ssn);
    });
  });

  // Test 5: Decryption fails with tampered data
  test("should fail to decrypt tampered encrypted data", () => {
    const ssn = "123456789";
    const encrypted = encryptSSN(ssn);
    const parts = encrypted.split(":");
    // Tamper with the encrypted data
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3].slice(0, -2)}XX`;
    expect(() => decryptSSN(tampered)).toThrow();
  });

  // Test 6: Decryption fails with tampered authentication tag
  test("should fail to decrypt with tampered authentication tag", () => {
    const ssn = "123456789";
    const encrypted = encryptSSN(ssn);
    const parts = encrypted.split(":");
    // Completely replace the authentication tag with a different value
    // Tag should be 32 hex chars (16 bytes), so create a fake one
    const fakeTag = "a".repeat(32); // 32 hex characters
    const tampered = `${parts[0]}:${parts[1]}:${fakeTag}:${parts[3]}`;
    let threw = false;
    try {
      decryptSSN(tampered);
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error("Expected decryption to fail with tampered tag, but it succeeded");
    }
  });

  // Test 7: Decryption fails with invalid format
  test("should throw error for invalid encrypted format", () => {
    expect(() => decryptSSN("invalid-format")).toThrow();
    expect(() => decryptSSN("part1:part2")).toThrow();
    expect(() => decryptSSN("part1:part2:part3")).toThrow();
  });

  // Test 8: Encryption fails with empty string
  test("should throw error for empty SSN", () => {
    expect(() => encryptSSN("")).toThrow();
  });

  // Test 9: Encryption fails with null/undefined
  test("should throw error for null or undefined input", () => {
    expect(() => encryptSSN(null as any)).toThrow();
    expect(() => encryptSSN(undefined as any)).toThrow();
  });

  // Test 10: Decryption fails with empty string
  test("should throw error for empty encrypted data", () => {
    expect(() => decryptSSN("")).toThrow();
  });

  // Test 11: Verify encrypted data is not the same as plaintext
  test("should ensure encrypted data is different from plaintext", () => {
    const ssn = "123456789";
    const encrypted = encryptSSN(ssn);
    expect(encrypted).notToBe(ssn);
    expect(encrypted.length).toBeGreaterThan(ssn.length);
  });

  // Test 12: Verify encryption is deterministic in decryption (same key)
  test("should decrypt correctly with same encryption key", () => {
    const ssn = "555666777";
    const encrypted1 = encryptSSN(ssn);
    // Simulate using same key (already set in env)
    const decrypted1 = decryptSSN(encrypted1);
    expect(decrypted1).toBe(ssn);
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

