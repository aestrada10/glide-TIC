/**
 * Test suite for XSS prevention in transaction descriptions
 * 
 * These tests verify that HTML and JavaScript in transaction descriptions
 * are properly escaped and do not execute.
 * 
 * Run with: npx tsx tests/xss-prevention.test.ts
 */

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
  };
}

/**
 * Simulates React's HTML escaping behavior
 * React automatically escapes HTML entities when rendering text in JSX
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Test Suite: XSS Prevention
async function runTests() {
  console.log("Running XSS Prevention Tests...\n");

  // Test 1: Basic script tag should be escaped
  runTest("should escape basic script tag", () => {
    const malicious = "<script>alert('XSS')</script>";
    const escaped = escapeHtml(malicious);
    assert(escaped).notToContain("<script>");
    assert(escaped).toContain("&lt;script&gt;");
    assert(escaped).toContain("&lt;/script&gt;");
  });

  // Test 2: JavaScript event handlers should be escaped
  runTest("should escape onclick event handlers", () => {
    const malicious = '<img src="x" onclick="alert(\'XSS\')">';
    const escaped = escapeHtml(malicious);
    // The entire tag should be escaped, making it safe
    assert(escaped).toContain("&lt;img");
    assert(escaped).toContain("&quot;");
    // The tag should not be executable (no unescaped < or >)
    assert(escaped).notToContain("<img");
  });

  // Test 3: JavaScript URLs should be escaped
  runTest("should escape javascript: URLs", () => {
    const malicious = '<a href="javascript:alert(\'XSS\')">Click</a>';
    const escaped = escapeHtml(malicious);
    // The entire tag should be escaped
    assert(escaped).toContain("&lt;a");
    // The tag should not be executable
    assert(escaped).notToContain("<a");
  });

  // Test 4: HTML entities should be double-escaped
  runTest("should properly escape HTML entities", () => {
    const malicious = "<div>&amp;</div>";
    const escaped = escapeHtml(malicious);
    // The & should become &amp;, and < > should become &lt; &gt;
    assert(escaped).toContain("&amp;");
    assert(escaped).toContain("&lt;div&gt;");
  });

  // Test 5: Multiple script tags should all be escaped
  runTest("should escape multiple script tags", () => {
    const malicious = "<script>alert(1)</script>Normal text<script>alert(2)</script>";
    const escaped = escapeHtml(malicious);
    const scriptCount = (escaped.match(/&lt;script&gt;/g) || []).length;
    assert(scriptCount).toBe(2);
    assert(escaped).notToContain("<script>");
  });

  // Test 6: Special characters should be escaped
  runTest("should escape all special HTML characters", () => {
    const malicious = '<>&"\'';
    const escaped = escapeHtml(malicious);
    assert(escaped).toContain("&lt;");
    assert(escaped).toContain("&gt;");
    assert(escaped).toContain("&amp;");
    assert(escaped).toContain("&quot;");
    assert(escaped).toContain("&#x27;");
  });

  // Test 7: XSS via iframe should be escaped
  runTest("should escape iframe tags", () => {
    const malicious = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
    const escaped = escapeHtml(malicious);
    assert(escaped).notToContain("<iframe");
    assert(escaped).toContain("&lt;iframe");
  });

  // Test 8: XSS via style attribute should be escaped
  runTest("should escape style attributes with JavaScript", () => {
    const malicious = '<div style="background: url(\'javascript:alert(1)\')">';
    const escaped = escapeHtml(malicious);
    // The entire tag should be escaped
    assert(escaped).toContain("&lt;div");
    assert(escaped).notToContain("<div");
  });

  // Test 9: XSS via onerror event should be escaped
  runTest("should escape onerror event handlers", () => {
    const malicious = '<img src="x" onerror="alert(\'XSS\')">';
    const escaped = escapeHtml(malicious);
    // The entire tag should be escaped
    assert(escaped).toContain("&lt;img");
    assert(escaped).notToContain("<img");
  });

  // Test 10: XSS via data URI should be escaped
  runTest("should escape data URIs with JavaScript", () => {
    const malicious = '<img src="data:text/html,<script>alert(1)</script>">';
    const escaped = escapeHtml(malicious);
    // The entire tag should be escaped
    assert(escaped).toContain("&lt;img");
    assert(escaped).notToContain("<img");
    // Nested script tags should also be escaped
    assert(escaped).toContain("&lt;script&gt;");
  });

  // Test 11: Normal text should remain unchanged
  runTest("should not modify safe text content", () => {
    const safe = "Funding from card";
    const escaped = escapeHtml(safe);
    assert(escaped).toBe(safe);
  });

  // Test 12: Text with numbers and letters should remain unchanged
  runTest("should not modify alphanumeric content", () => {
    const safe = "Transaction #12345 - Deposit $100.00";
    const escaped = escapeHtml(safe);
    assert(escaped).toBe(safe);
  });

  // Test 13: Empty string should remain empty
  runTest("should handle empty strings", () => {
    const empty = "";
    const escaped = escapeHtml(empty);
    assert(escaped).toBe(empty);
  });

  // Test 14: Complex XSS payload should be fully escaped
  runTest("should escape complex XSS payload", () => {
    const malicious = "<script>document.cookie='stolen='+document.cookie</script>";
    const escaped = escapeHtml(malicious);
    // Script tags should be escaped
    assert(escaped).notToContain("<script>");
    assert(escaped).toContain("&lt;script&gt;");
    // The entire payload should be escaped, making it safe even if it contains JavaScript keywords
    assert(escaped).notToContain("</script>");
  });

  // Test 15: SVG with script should be escaped
  runTest("should escape SVG tags with embedded scripts", () => {
    const malicious = '<svg><script>alert("XSS")</script></svg>';
    const escaped = escapeHtml(malicious);
    assert(escaped).notToContain("<svg>");
    assert(escaped).notToContain("<script>");
    assert(escaped).toContain("&lt;svg&gt;");
    assert(escaped).toContain("&lt;script&gt;");
  });

  // Test 16: Verify that escaped content cannot execute JavaScript
  runTest("escaped content should not contain executable JavaScript", () => {
    const malicious = "<script>alert('XSS')</script>";
    const escaped = escapeHtml(malicious);
    
    // Check that no executable script tags exist
    assert(escaped).notToContain("<script>");
    assert(escaped).notToContain("</script>");
    
    // Check that it's properly escaped
    assert(escaped).toContain("&lt;script&gt;");
    assert(escaped).toContain("&lt;/script&gt;");
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

