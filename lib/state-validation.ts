/**
 * State code validation utility
 * 
 * VAL-203 fix: Validates US state codes against actual state codes
 */

export interface StateValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valid US state codes (50 states + DC + territories)
 */
const VALID_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", // District of Columbia
  "AS", // American Samoa
  "GU", // Guam
  "MP", // Northern Mariana Islands
  "PR", // Puerto Rico
  "VI", // U.S. Virgin Islands
];

/**
 * Validates US state code
 */
export function validateStateCode(stateCode: string): StateValidationResult {
  const errors: string[] = [];

  // Trim whitespace
  const trimmed = stateCode.trim().toUpperCase();

  // Check if empty
  if (!trimmed) {
    return {
      valid: false,
      errors: ["State code is required"],
    };
  }

  // Check length
  if (trimmed.length !== 2) {
    errors.push("State code must be exactly 2 letters");
  }

  // Check format (letters only)
  if (!/^[A-Z]{2}$/.test(trimmed)) {
    errors.push("State code must contain only letters");
  }

  // Check if valid state code
  if (!VALID_STATE_CODES.includes(trimmed)) {
    errors.push(`"${trimmed}" is not a valid US state code`);
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
  };
}

