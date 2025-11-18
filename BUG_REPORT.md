# 🐛 Bug Fix Documentation

**Prepared by:** Aldo Estrada  
**Project:** Support Engineer Interview Assignment

This report documents the root causes, fixes, and prevention strategies for all identified issues across **UI, Validation, Security, and Performance**.

---

## PRIORITIZATION

| Category | Ticket  | Priority | Status |
| -------- | ------- | -------- | ------ |
| Security | SEC-301 | Critical | Fixed  |

Critical issues were prioritized first due to security/compliance risks and potential financial inaccuracies.

---

## Ticket Solutions in Prioritization Order

---

# Bug Report: SEC-301 - SSN Storage

## Ticket Information

- **Ticket ID:** SEC-301
- **Reporter:** Security Audit Team
- **Priority:** Critical
- **Status:** Fixed

## Summary

SSNs (Social Security Numbers) were being stored in **plaintext** in the database, creating a severe privacy and compliance risk. This violates data protection regulations (GDPR, CCPA, PCI-DSS) and exposes sensitive personally identifiable information (PII) to anyone with database access.

---

## How the Bug Was Found

### Investigation Process

1. **Database Schema Review**

   - Examined `lib/db/schema.ts` and found that the `users` table had an `ssn` field defined as `text("ssn").notNull()` with no encryption.
   - Reviewed `lib/db/index.ts` and confirmed the table creation SQL showed `ssn TEXT NOT NULL` with no encryption.

2. **Code Flow Analysis**

   - Traced the signup flow in `server/routers/auth.ts`:
     - Line 20: SSN validation accepts 9-digit string.
     - Line 39-42: SSN from input is directly inserted into the database without encryption.
     - Line 45: User object retrieved from database includes plaintext SSN.
     - Line 75: User object returned in API response (password excluded, SSN included).

3. **Security Audit Findings**

   - No encryption functions called before database insertion.
   - No encryption utilities existed in the codebase.
   - User objects returned in API responses could expose SSNs.

4. **Verification**
   - Used database utility script: `npm run db:list-users`.
   - Confirmed that database backups or exports would contain unencrypted SSNs.

---

## Root Cause

1. **Missing Encryption Layer:** No encryption utility existed for sensitive data.
2. **Direct Database Insertion:** Signup mutation directly inserted user input without processing.
3. **No Data Sanitization:** User objects returned in API responses without filtering sensitive fields.
4. **Lack of Security Best Practices:** SSNs treated as regular user data.

---

## Impact

- **Privacy Risk:** SSNs are highly sensitive PII and can be used for identity theft.
- **Compliance Violations:** GDPR, CCPA, PCI-DSS, and NIST/OWASP recommend encryption.
- **Data Breach Consequences:** Plaintext SSNs are immediately readable if the database is compromised.
- **Legal Liability:** Potential fines and legal action for non-compliance.

---

## Solution

### Implementation

1. **Created Encryption Utility (`lib/encryption.ts`)**

   - AES-256-GCM encryption with authentication.
   - PBKDF2 key derivation with 100,000 iterations.
   - Unique IV and salt per encryption.
   - Authentication tag for tamper detection.
   - Encryption key stored in environment variable `ENCRYPTION_KEY`.

2. **Updated Signup Flow (`server/routers/auth.ts`)**

   - Import `encryptSSN` function.
   - Encrypt SSN before database insertion: `const encryptedSSN = encryptSSN(input.ssn)`.
   - Store encrypted SSN instead of plaintext.
   - Exclude SSN from API responses: `const { password, ssn, ...safeUser } = user`.

3. **Secured User Context (`server/trpc.ts`)**
   - Updated context creation to exclude SSN from user objects.
   - Ensures SSNs are never included in authenticated user sessions.

---

### Technical Details

**Encryption Algorithm:** AES-256-GCM

- Provides confidentiality and authenticity.
- Prevents tampering with encrypted data.

**Key Management:**

- Stored in `ENCRYPTION_KEY` environment variable.
- Derived using PBKDF2 with SHA-256.
- Unique salt per encryption prevents rainbow table attacks.

**Encryption Key Setup:**

The encryption key must be set as an environment variable. Currently, if not set, the system uses a default insecure key (for development only).

**Where to Set the Encryption Key:**

1. **Development (`.env` file):**
   - Create a `.env` file in the project root
   - Add: `ENCRYPTION_KEY=your-64-character-hex-key-here`
   - Next.js automatically loads `.env` files

2. **Generate a Secure Key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   This generates a 64-character hex string (recommended format)

3. **Key Format Options:**
   - **64-character hex string** (recommended): Used directly as the encryption key
   - **Any other string**: Will be derived using PBKDF2 key derivation

4. **Production:**
   - Set `ENCRYPTION_KEY` in your hosting platform's environment variables (Vercel, AWS, etc.)
   - **Never commit the key to version control**
   - Use different keys for development and production

**⚠️ Important Security Notes:**
- If the encryption key is lost, encrypted data **cannot be decrypted**
- The current default key is **insecure** and should only be used for development/testing
- Always use a strong, randomly generated key in production
- Rotate keys periodically following your security policy

**Encrypted Data Format:** `iv:salt:tag:encryptedData` (hex-encoded)

- IV (16 bytes), Salt (64 bytes), Tag (16 bytes), Encrypted Data.

---

### Migration Considerations

- Existing plaintext SSNs remain unencrypted; migration script required.
- Key rotation requires re-encryption and key versioning.

---

## Testing

- Verify encryption produces different ciphertext for the same input.
- Decrypt to confirm correctness.
- Ensure SSNs are excluded from API responses.
- Test edge cases: empty strings, invalid formats.
- Ensure decryption fails with tampered data.
- **Run tests:**

```bash
npx tsx tests/encryption.test.ts
npx npx tsx tests/auth-router.test.ts
```
