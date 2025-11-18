import crypto from "crypto";

/**
 * Encryption utility for sensitive data like SSNs.
 * Uses AES-256-GCM for authenticated encryption.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Gets the encryption key from environment variable or generates a default one.
 * In production, this should ALWAYS be set via environment variable.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    // For development/testing only - in production this should fail
    console.warn("WARNING: ENCRYPTION_KEY not set. Using default key. This is insecure for production!");
    return crypto.scryptSync("default-key-change-in-production", "salt", KEY_LENGTH);
  }
  
  // If key is provided as hex string, convert it
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  
  // Otherwise derive key from the provided string
  return crypto.scryptSync(key, "salt", KEY_LENGTH);
}

/**
 * Encrypts a plaintext SSN.
 * @param plaintext - The SSN to encrypt (9 digits)
 * @returns Encrypted string in format: iv:salt:tag:encryptedData (all hex encoded)
 */
export function encryptSSN(plaintext: string): string {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("Plaintext must be a non-empty string");
  }

  const key = getEncryptionKey();
  
  // Generate random IV and salt for each encryption
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Derive a key from the master key using the salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, "sha256");
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  
  // Encrypt
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  // Get authentication tag
  const tag = cipher.getAuthTag();
  
  // Return format: iv:salt:tag:encryptedData
  return `${iv.toString("hex")}:${salt.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an encrypted SSN.
 * @param encryptedData - The encrypted string in format: iv:salt:tag:encryptedData
 * @returns Decrypted SSN (9 digits)
 */
export function decryptSSN(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== "string") {
    throw new Error("Encrypted data must be a non-empty string");
  }

  const parts = encryptedData.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted data format");
  }

  const [ivHex, saltHex, tagHex, encryptedHex] = parts;
  
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const salt = Buffer.from(saltHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = encryptedHex;
  
  // Derive the same key using the salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, "sha256");
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);
  
  // Decrypt
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

