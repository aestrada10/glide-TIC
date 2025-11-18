/**
 * Password validation utility
 * Enforces strong password requirements following security best practices
 */

/**
 * Validates password strength according to security requirements:
 * - At least 8 characters long
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one number
 * - Contains at least one special character
 * - Not a common/weak password
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password) {
    errors.push("Password is required");
    return { valid: false, errors };
  }

  // Minimum length
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // Uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Number
  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)");
  }

  // Check against common weak passwords
  const commonPasswords = [
    "password",
    "password123",
    "12345678",
    "123456789",
    "qwerty",
    "abc123",
    "monkey",
    "1234567",
    "letmein",
    "trustno1",
    "dragon",
    "baseball",
    "iloveyou",
    "master",
    "sunshine",
    "ashley",
    "bailey",
    "passw0rd",
    "shadow",
    "123123",
    "654321",
    "superman",
    "qazwsx",
    "michael",
    "football",
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push("Password is too common. Please choose a more unique password");
  }

  // Check for repeated characters (e.g., "aaaaaaa1")
  if (/(.)\1{3,}/.test(password)) {
    errors.push("Password contains too many repeated characters");
  }

  // Check for sequential characters (e.g., "12345678", "abcdefgh")
  if (/01234|12345|23456|34567|45678|56789|abcdef|bcdefg|cdefgh|defghi|efghij|fghijk|ghijkl|hijklm|ijklmn|jklmno|klmnop|lmnopq|mnopqr|nopqrs|opqrst|pqrstu|qrstuv|rstuvw|stuvwx|tuvwxy|uvwxyz/i.test(password)) {
    errors.push("Password contains sequential characters which are easy to guess");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a Zod schema for password validation
 * Can be used with Zod's refine method
 */
export function createPasswordSchema() {
  return {
    min: (min: number) => ({
      message: `Password must be at least ${min} characters long`,
      validation: (val: string) => val.length >= min,
    }),
    hasUppercase: {
      message: "Password must contain at least one uppercase letter",
      validation: (val: string) => /[A-Z]/.test(val),
    },
    hasLowercase: {
      message: "Password must contain at least one lowercase letter",
      validation: (val: string) => /[a-z]/.test(val),
    },
    hasNumber: {
      message: "Password must contain at least one number",
      validation: (val: string) => /\d/.test(val),
    },
    hasSpecialChar: {
      message: "Password must contain at least one special character",
      validation: (val: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val),
    },
    notCommon: {
      message: "Password is too common. Please choose a more unique password",
      validation: (val: string) => {
        const commonPasswords = [
          "password",
          "password123",
          "12345678",
          "123456789",
          "qwerty",
          "abc123",
          "monkey",
          "1234567",
          "letmein",
          "trustno1",
          "dragon",
          "baseball",
          "iloveyou",
          "master",
          "sunshine",
          "ashley",
          "bailey",
          "passw0rd",
          "shadow",
          "123123",
          "654321",
          "superman",
          "qazwsx",
          "michael",
          "football",
        ];
        return !commonPasswords.includes(val.toLowerCase());
      },
    },
  };
}

