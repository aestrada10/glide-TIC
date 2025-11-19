import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../trpc";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encryptSSN } from "@/lib/encryption";
import { validatePasswordStrength } from "@/lib/password-validation";
import { validateDateOfBirth } from "@/lib/date-validation";
import { validateEmail } from "@/lib/email-validation";

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: z
          .string()
          .refine(
            (val) => {
              const validation = validateEmail(val);
              return validation.valid;
            },
            (val) => {
              const validation = validateEmail(val);
              return { message: validation.errors[0] || "Invalid email address" };
            }
          )
          .transform((val) => {
            // VAL-201 fix: Normalize to lowercase and notify if changed
            const validation = validateEmail(val);
            return validation.normalizedEmail || val.toLowerCase();
          }),
        password: z
          .string()
          .min(8, "Password must be at least 8 characters long")
          .refine(
            (val) => /[A-Z]/.test(val),
            "Password must contain at least one uppercase letter"
          )
          .refine(
            (val) => /[a-z]/.test(val),
            "Password must contain at least one lowercase letter"
          )
          .refine(
            (val) => /\d/.test(val),
            "Password must contain at least one number"
          )
          .refine(
            (val) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val),
            "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)"
          )
          .refine(
            (val) => {
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
            "Password is too common. Please choose a more unique password"
          )
          .refine(
            (val) => !/(.)\1{3,}/.test(val),
            "Password contains too many repeated characters"
          )
          .refine(
            (val) =>
              !/01234|12345|23456|34567|45678|56789|abcdef|bcdefg|cdefgh|defghi|efghij|fghijk|ghijkl|hijklm|ijklmn|jklmno|klmnop|lmnopq|mnopqr|nopqrs|opqrst|pqrstu|qrstuv|rstuvw|stuvwx|tuvwxy|uvwxyz/i.test(
                val
              ),
            "Password contains sequential characters which are easy to guess"
          ),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phoneNumber: z.string().regex(/^\+?\d{10,15}$/),
        dateOfBirth: z
          .string()
          .refine(
            (val) => {
              const validation = validateDateOfBirth(val);
              return validation.valid;
            },
            (val) => {
              const validation = validateDateOfBirth(val);
              return { message: validation.errors[0] || "Invalid date of birth" };
            }
          ),
        ssn: z.string().regex(/^\d{9}$/),
        address: z.string().min(1),
        city: z.string().min(1),
        state: z.string().length(2).toUpperCase(),
        zipCode: z.string().regex(/^\d{5}$/),
      })
    )
          .mutation(async ({ input, ctx }) => {
            // VAL-201 fix: Validate email and check for normalization
            const emailValidation = validateEmail(input.email);
            if (!emailValidation.valid) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: emailValidation.errors[0] || "Invalid email address",
              });
            }

            // Use normalized email
            const normalizedEmail = emailValidation.normalizedEmail || input.email.toLowerCase();

            const existingUser = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      const encryptedSSN = encryptSSN(input.ssn);

      await db.insert(users).values({
        ...input,
        email: normalizedEmail, // VAL-201 fix: Use normalized email
        password: hashedPassword,
        ssn: encryptedSSN,
      });

      // Fetch the created user
      const user = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Create session
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "temporary-secret-for-interview", {
        expiresIn: "7d",
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      // Set cookie
      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      // Exclude sensitive fields from response
      const { password, ssn, ...safeUser } = user;
      return { user: safeUser, token };
    }),

        login: publicProcedure
          .input(
            z.object({
              email: z
                .string()
                .refine(
                  (val) => {
                    const validation = validateEmail(val);
                    return validation.valid;
                  },
                  (val) => {
                    const validation = validateEmail(val);
                    return { message: validation.errors[0] || "Invalid email address" };
                  }
                )
                .transform((val) => {
                  // VAL-201 fix: Normalize to lowercase
                  const validation = validateEmail(val);
                  return validation.normalizedEmail || val.toLowerCase();
                }),
              password: z.string(),
            })
          )
          .mutation(async ({ input, ctx }) => {
            // VAL-201 fix: Use normalized email for lookup
            const normalizedEmail = input.email.toLowerCase();
            const user = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      const validPassword = await bcrypt.compare(input.password, user.password);

      if (!validPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      // SEC-304 fix: Invalidate all existing sessions for this user before creating new one
      // This ensures only one active session per user at a time
      await db.delete(sessions).where(eq(sessions.userId, user.id));

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "temporary-secret-for-interview", {
        expiresIn: "7d",
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(sessions).values({
        userId: user.id,
        token,
        expiresAt: expiresAt.toISOString(),
      });

      if ("setHeader" in ctx.res) {
        ctx.res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      } else {
        (ctx.res as Headers).set("Set-Cookie", `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
      }

      // Exclude sensitive fields from response
      const { password, ssn, ...safeUser } = user;
      return { user: safeUser, token };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    let deleted = false;
    
    if (ctx.user) {
      // Delete session from database
      let token: string | undefined;
      if ("cookies" in ctx.req) {
        token = (ctx.req as any).cookies.session;
      } else {
        const cookieHeader = ctx.req.headers.get?.("cookie") || (ctx.req.headers as any).cookie;
        token = cookieHeader
          ?.split("; ")
          .find((c: string) => c.startsWith("session="))
          ?.split("=")[1];
      }
      
      if (token) {
        // Verify session exists before deletion (PERF-402 fix)
        const session = await db.select().from(sessions).where(eq(sessions.token, token)).get();
        if (session) {
          await db.delete(sessions).where(eq(sessions.token, token));
          // Verify deletion was successful
          const deletedSession = await db.select().from(sessions).where(eq(sessions.token, token)).get();
          deleted = !deletedSession; // True if session no longer exists
        }
      }
    }

    // Clear cookie regardless
    if ("setHeader" in ctx.res) {
      ctx.res.setHeader("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    } else {
      (ctx.res as Headers).set("Set-Cookie", `session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    }

    // Return appropriate response based on actual deletion (PERF-402 fix)
    if (!ctx.user) {
      return { success: false, message: "No active session to logout" };
    }
    
    if (deleted) {
      return { success: true, message: "Logged out successfully" };
    } else {
      return { success: false, message: "Logout failed: session could not be deleted" };
    }
  }),
});
