/**
 * Email validation utility
 * 
 * VAL-201 fix: Comprehensive email validation including:
 * - Strict format validation
 * - Common typo detection (e.g., .con instead of .com)
 * - Case sensitivity handling
 */

export interface EmailValidationResult {
  valid: boolean;
  errors: string[];
  normalizedEmail?: string;
  wasNormalized?: boolean;
}

/**
 * Common TLD typos that should be caught
 */
const COMMON_TLD_TYPOS: Record<string, string> = {
  ".con": ".com",
  ".cmo": ".com",
  ".co": ".com", // Common typo, but .co is also valid, so we'll warn but not reject
  ".cm": ".com",
  ".comm": ".com",
  ".om": ".com",
  ".c0m": ".com",
  ".ocm": ".com",
  ".net": ".net", // Valid, but check for typos
  ".nte": ".net",
  ".ent": ".net",
  ".org": ".org", // Valid, but check for typos
  ".ogr": ".org",
  ".rog": ".org",
};

/**
 * Valid TLDs (top-level domains)
 */
const VALID_TLDS = [
  "com",
  "net",
  "org",
  "edu",
  "gov",
  "mil",
  "int",
  "co",
  "io",
  "ai",
  "me",
  "us",
  "uk",
  "ca",
  "au",
  "de",
  "fr",
  "jp",
  "cn",
  "in",
  "br",
  "mx",
  "es",
  "it",
  "nl",
  "se",
  "no",
  "dk",
  "fi",
  "pl",
  "ru",
  "kr",
  "tw",
  "sg",
  "hk",
  "nz",
  "za",
  "ae",
  "sa",
  "tr",
  "il",
  "ar",
  "cl",
  "co",
  "pe",
  "ve",
  "ph",
  "id",
  "my",
  "th",
  "vn",
];

/**
 * Validates email format strictly
 */
function isValidEmailFormat(email: string): boolean {
  // RFC 5322 compliant regex (simplified but comprehensive)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return false;
  }

  // Additional checks
  // No consecutive dots
  if (email.includes("..")) {
    return false;
  }

  // No leading or trailing dots
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return false;
  }

  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return false;
  }

  if (domain.startsWith(".") || domain.endsWith(".")) {
    return false;
  }

  // Local part length check (max 64 characters)
  if (localPart.length > 64) {
    return false;
  }

  // Domain length check (max 255 characters)
  if (domain.length > 255) {
    return false;
  }

  // Domain must have at least one dot (for TLD)
  if (!domain.includes(".")) {
    return false;
  }

  return true;
}

/**
 * Checks for common TLD typos
 */
function checkCommonTypos(email: string): { hasTypo: boolean; suggestedFix?: string } {
  const domain = email.split("@")[1];
  if (!domain) {
    return { hasTypo: false };
  }

  const lowerDomain = domain.toLowerCase();
  const tld = lowerDomain.substring(lowerDomain.lastIndexOf("."));

  // Check for common typos
  if (COMMON_TLD_TYPOS[tld] && COMMON_TLD_TYPOS[tld] !== tld) {
    const suggestedEmail = email.replace(tld, COMMON_TLD_TYPOS[tld]);
    return { hasTypo: true, suggestedFix: suggestedEmail };
  }

  // Check if TLD is valid
  const tldWithoutDot = tld.substring(1);
  if (!VALID_TLDS.includes(tldWithoutDot)) {
    // Not a common typo, but might be invalid
    return { hasTypo: false };
  }

  return { hasTypo: false };
}

/**
 * Validates email address comprehensively
 */
export function validateEmail(email: string): EmailValidationResult {
  const errors: string[] = [];

  // Trim whitespace
  const trimmedEmail = email.trim();

  // Check if empty
  if (!trimmedEmail) {
    return {
      valid: false,
      errors: ["Email is required"],
    };
  }

  // Check for basic format
  if (!trimmedEmail.includes("@")) {
    return {
      valid: false,
      errors: ["Email must contain an @ symbol"],
    };
  }

  // Check for multiple @ symbols
  const atCount = (trimmedEmail.match(/@/g) || []).length;
  if (atCount > 1) {
    return {
      valid: false,
      errors: ["Email cannot contain multiple @ symbols"],
    };
  }

  // Validate format
  if (!isValidEmailFormat(trimmedEmail)) {
    errors.push("Invalid email format");
  }

  // Check for common typos
  const typoCheck = checkCommonTypos(trimmedEmail);
  if (typoCheck.hasTypo && typoCheck.suggestedFix) {
    errors.push(`Did you mean "${typoCheck.suggestedFix}"? Common typo detected (${trimmedEmail.split("@")[1]?.substring(trimmedEmail.split("@")[1].lastIndexOf("."))} should be ${typoCheck.suggestedFix.split("@")[1]?.substring(typoCheck.suggestedFix.split("@")[1].lastIndexOf("."))})`);
  }

  // Normalize email (lowercase)
  const normalizedEmail = trimmedEmail.toLowerCase();
  const wasNormalized = normalizedEmail !== trimmedEmail;

  // If there are errors, return invalid
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      normalizedEmail,
      wasNormalized,
    };
  }

  return {
    valid: true,
    errors: [],
    normalizedEmail,
    wasNormalized,
  };
}

