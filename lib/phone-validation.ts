/**
 * Phone number validation utility
 * 
 * VAL-204 fix: Validates international phone numbers properly
 */

export interface PhoneValidationResult {
  valid: boolean;
  errors: string[];
  normalizedPhone?: string;
}

/**
 * E.164 format: +[country code][number]
 * Examples:
 * - US: +1XXXXXXXXXX (11 digits total)
 * - UK: +44XXXXXXXXXX
 * - International: +[1-3 digits country code][4-14 digits number]
 */
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * Common country codes and their expected lengths
 */
const COUNTRY_CODE_LENGTHS: Record<string, number> = {
  "1": 11, // US/Canada: +1 + 10 digits
  "44": 13, // UK: +44 + 11 digits
  "33": 12, // France: +33 + 9 digits
  "49": 13, // Germany: +49 + 11 digits
  "81": 13, // Japan: +81 + 11 digits
  "86": 13, // China: +86 + 11 digits
  "91": 13, // India: +86 + 10 digits
  "7": 12, // Russia: +7 + 10 digits
  "61": 12, // Australia: +61 + 9 digits
  "55": 13, // Brazil: +55 + 11 digits
  "52": 13, // Mexico: +52 + 10 digits
  "34": 12, // Spain: +34 + 9 digits
  "39": 12, // Italy: +39 + 10 digits
  "31": 12, // Netherlands: +31 + 9 digits
  "46": 12, // Sweden: +46 + 9 digits
  "47": 11, // Norway: +47 + 8 digits
  "45": 11, // Denmark: +45 + 8 digits
  "358": 13, // Finland: +358 + 9 digits
  "32": 12, // Belgium: +32 + 9 digits
  "41": 12, // Switzerland: +41 + 9 digits
  "43": 12, // Austria: +43 + 10 digits
  "48": 12, // Poland: +48 + 9 digits
  "27": 12, // South Africa: +27 + 9 digits
  "82": 13, // South Korea: +82 + 10 digits
  "65": 11, // Singapore: +65 + 8 digits
  "852": 12, // Hong Kong: +852 + 8 digits
  "886": 13, // Taiwan: +886 + 9 digits
  "60": 12, // Malaysia: +60 + 9 digits
  "66": 12, // Thailand: +66 + 9 digits
  "62": 13, // Indonesia: +62 + 10 digits
  "63": 13, // Philippines: +63 + 10 digits
  "84": 12, // Vietnam: +84 + 9 digits
};

/**
 * Validates phone number format
 */
export function validatePhoneNumber(phoneNumber: string): PhoneValidationResult {
  const errors: string[] = [];

  // Trim whitespace
  const trimmed = phoneNumber.trim();

  // Check if empty
  if (!trimmed) {
    return {
      valid: false,
      errors: ["Phone number is required"],
    };
  }

  // Remove common formatting characters for validation (spaces, dashes, parentheses, dots)
  const cleaned = trimmed.replace(/[\s\-\(\)\.]/g, "");
  
  // If cleaned is empty after removing formatting, it's invalid
  if (!cleaned) {
    return {
      valid: false,
      errors: ["Phone number is required"],
    };
  }

  // Check if starts with +
  if (!cleaned.startsWith("+")) {
    // If no +, assume US format (10 digits)
    if (!/^\d{10}$/.test(cleaned)) {
      errors.push("US phone numbers must be 10 digits. For international numbers, use +[country code][number] format");
    } else {
      // Valid US format without +
      return {
        valid: true,
        errors: [],
        normalizedPhone: `+1${cleaned}`,
      };
    }
  } else {
    // International format with +
    // Check E.164 format
    if (!E164_REGEX.test(cleaned)) {
      errors.push("Phone number must be in E.164 format: +[country code][number] (e.g., +1234567890)");
    } else {
      // Check total length (E.164 allows 1-15 digits after +)
      const digitsAfterPlus = cleaned.substring(1);
      if (digitsAfterPlus.length < 7 || digitsAfterPlus.length > 15) {
        errors.push("Phone number must be between 7 and 15 digits after the country code");
      }

      // Try to validate against known country codes
      let countryCode = "";
      if (digitsAfterPlus.startsWith("1") && digitsAfterPlus.length === 11) {
        countryCode = "1";
      } else {
        // Try to match country code (1-3 digits)
        for (let i = 1; i <= 3 && i <= digitsAfterPlus.length; i++) {
          const potentialCode = digitsAfterPlus.substring(0, i);
          if (COUNTRY_CODE_LENGTHS[potentialCode]) {
            countryCode = potentialCode;
            break;
          }
        }
      }

      if (countryCode && COUNTRY_CODE_LENGTHS[countryCode]) {
        const expectedLength = COUNTRY_CODE_LENGTHS[countryCode];
        // COUNTRY_CODE_LENGTHS includes the +, so compare directly
        if (cleaned.length !== expectedLength) {
          // Only warn if significantly off, not for minor variations
          // Some countries have flexible lengths
          if (Math.abs(cleaned.length - expectedLength) > 2) {
            errors.push(`Phone number for country code +${countryCode} should be approximately ${expectedLength} digits total (including +)`);
          }
        }
      }
    }
  }

  // Check for invalid characters
  if (!/^\+?\d+$/.test(cleaned)) {
    errors.push("Phone number can only contain digits and + (for international format)");
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    errors: [],
    normalizedPhone: cleaned,
  };
}

