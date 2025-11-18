/**
 * Date of birth validation utility
 * Ensures users are of legal age and dates are valid
 */

const MINIMUM_AGE = 18; // Minimum age requirement for banking accounts

/**
 * Validates date of birth to ensure:
 * - Date is not in the future
 * - User is at least 18 years old
 * - Date is a valid date format
 */
export function validateDateOfBirth(dateOfBirth: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!dateOfBirth) {
    errors.push("Date of birth is required");
    return { valid: false, errors };
  }

  // Parse the date
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  
  // Reset time to start of day for accurate comparison
  today.setHours(0, 0, 0, 0);
  birthDate.setHours(0, 0, 0, 0);

  // Check if date is valid
  if (isNaN(birthDate.getTime())) {
    errors.push("Date of birth must be a valid date");
    return { valid: false, errors };
  }

  // Check if date is in the future
  if (birthDate > today) {
    errors.push("Date of birth cannot be in the future");
    return { valid: false, errors };
  }

  // Calculate age
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  // Adjust age if birthday hasn't occurred this year
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  // Check minimum age requirement
  if (age < MINIMUM_AGE) {
    errors.push(`You must be at least ${MINIMUM_AGE} years old to create an account`);
    return { valid: false, errors };
  }

  // Check for unreasonably old dates (e.g., before 1900)
  const minYear = 1900;
  if (birthDate.getFullYear() < minYear) {
    errors.push("Date of birth appears to be invalid (too old)");
    return { valid: false, errors };
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates age from date of birth
 */
export function calculateAge(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
}

/**
 * Checks if date is in the future
 */
export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date > today;
}

/**
 * Checks if user is at least the minimum age
 */
export function isMinimumAge(dateOfBirth: string, minimumAge: number = MINIMUM_AGE): boolean {
  const age = calculateAge(dateOfBirth);
  return age >= minimumAge;
}

