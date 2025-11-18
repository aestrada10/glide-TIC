/**
 * Card validation utility
 * 
 * Provides card number validation using Luhn algorithm and proper card type detection
 * Supports: Visa, Mastercard, American Express, Discover, Diners Club, JCB
 */

export type CardType = "visa" | "mastercard" | "amex" | "discover" | "diners" | "jcb" | "unknown";

export interface CardValidationResult {
  valid: boolean;
  cardType: CardType;
  errors: string[];
}

/**
 * Card type prefixes and lengths
 */
const CARD_TYPES: Array<{
  type: CardType;
  prefixes: (string | number)[];
  lengths: number[];
}> = [
  {
    type: "visa",
    prefixes: ["4"],
    lengths: [13, 16],
  },
  {
    type: "mastercard",
    prefixes: ["51", "52", "53", "54", "55", "2221", "2222", "2223", "2224", "2225", "2226", "2227", "2228", "2229", "223", "224", "225", "226", "227", "228", "229", "23", "24", "25", "26", "270", "271", "2720"],
    lengths: [16],
  },
  {
    type: "amex",
    prefixes: ["34", "37"],
    lengths: [15],
  },
  {
    type: "discover",
    prefixes: ["6011", "622126", "622127", "622128", "622129", "62213", "62214", "62215", "62216", "62217", "62218", "62219", "6222", "6223", "6224", "6225", "6226", "6227", "6228", "62290", "62291", "622920", "622921", "622922", "622923", "622924", "622925", "644", "645", "646", "647", "648", "649", "65"],
    lengths: [16, 19],
  },
  {
    type: "diners",
    prefixes: ["300", "301", "302", "303", "304", "305", "36", "38"],
    lengths: [14],
  },
  {
    type: "jcb",
    prefixes: ["35"],
    lengths: [16],
  },
];

/**
 * Detects card type based on card number prefix
 */
export function detectCardType(cardNumber: string): CardType {
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, "");

  if (!/^\d+$/.test(cleaned)) {
    return "unknown";
  }

  for (const cardType of CARD_TYPES) {
    for (const prefix of cardType.prefixes) {
      const prefixStr = String(prefix);
      if (cleaned.startsWith(prefixStr)) {
        // Check if length matches
        if (cardType.lengths.includes(cleaned.length)) {
          return cardType.type;
        }
      }
    }
  }

  return "unknown";
}

/**
 * Validates card number using Luhn algorithm
 * Also known as the "modulus 10" or "mod 10" algorithm
 */
export function validateLuhn(cardNumber: string): boolean {
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, "");

  // Must contain only digits
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }

  // Must have at least 13 digits (minimum for any card type)
  if (cleaned.length < 13) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  // Process digits from right to left
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      // Double every second digit from right
      digit *= 2;
      // If result is two digits, add them together
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  // Valid if sum is divisible by 10
  return sum % 10 === 0;
}

/**
 * Validates card number format (length and digits only)
 */
export function validateCardFormat(cardNumber: string): { valid: boolean; error?: string } {
  const cleaned = cardNumber.replace(/[\s-]/g, "");

  if (cleaned.length === 0) {
    return { valid: false, error: "Card number is required" };
  }

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: "Card number must contain only digits" };
  }

  if (cleaned.length < 13) {
    return { valid: false, error: "Card number is too short" };
  }

  if (cleaned.length > 19) {
    return { valid: false, error: "Card number is too long" };
  }

  return { valid: true };
}

/**
 * Comprehensive card validation
 * Validates format, card type, length, and Luhn algorithm
 */
export function validateCardNumber(cardNumber: string): CardValidationResult {
  const errors: string[] = [];
  const cleaned = cardNumber.replace(/[\s-]/g, "");

  // Format validation
  const formatCheck = validateCardFormat(cardNumber);
  if (!formatCheck.valid) {
    return {
      valid: false,
      cardType: "unknown",
      errors: [formatCheck.error || "Invalid card format"],
    };
  }

  // Detect card type
  const cardType = detectCardType(cleaned);

  if (cardType === "unknown") {
    errors.push("Card type not recognized. Supported: Visa, Mastercard, American Express, Discover, Diners Club, JCB");
  }

  // Validate length for detected card type
  if (cardType !== "unknown") {
    const cardTypeInfo = CARD_TYPES.find((ct) => ct.type === cardType);
    if (cardTypeInfo && !cardTypeInfo.lengths.includes(cleaned.length)) {
      const expectedLengths = cardTypeInfo.lengths.join(" or ");
      errors.push(`${cardType.charAt(0).toUpperCase() + cardType.slice(1)} cards must be ${expectedLengths} digits`);
    }
  }

  // Luhn algorithm validation
  if (!validateLuhn(cleaned)) {
    errors.push("Card number is invalid (failed Luhn algorithm check)");
  }

  return {
    valid: errors.length === 0,
    cardType,
    errors,
  };
}

/**
 * Formats card number for display (adds spaces every 4 digits)
 */
export function formatCardNumber(cardNumber: string): string {
  const cleaned = cardNumber.replace(/[\s-]/g, "");
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}

