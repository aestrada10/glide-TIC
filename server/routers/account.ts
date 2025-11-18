import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { db, getRawDatabase } from "@/lib/db";
import { accounts, transactions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { validateCardNumber } from "@/lib/card-validation";
import crypto from "crypto";

/**
 * Generates a cryptographically secure random account number
 * SEC-302 fix: Uses crypto.randomBytes instead of Math.random() for security
 */
function generateAccountNumber(): string {
  // Generate 4 random bytes (32 bits) and convert to number
  // This gives us a range of 0 to 4,294,967,295
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  // Modulo to get range 0-999,999,999 (9 digits max)
  const accountNum = randomNumber % 1000000000;
  return accountNum.toString().padStart(10, "0");
}

export const accountRouter = router({
  createAccount: protectedProcedure
    .input(
      z.object({
        accountType: z.enum(["checking", "savings"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if user already has an account of this type
      const existingAccount = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, ctx.user.id), eq(accounts.accountType, input.accountType)))
        .get();

      if (existingAccount) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `You already have a ${input.accountType} account`,
        });
      }

      let accountNumber;
      let isUnique = false;

      // Generate unique account number
      while (!isUnique) {
        accountNumber = generateAccountNumber();
        const existing = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber)).get();
        isUnique = !existing;
      }

      await db.insert(accounts).values({
        userId: ctx.user.id,
        accountNumber: accountNumber!,
        accountType: input.accountType,
        balance: 0,
        status: "active",
      });

      // Fetch the created account
      const account = await db.select().from(accounts).where(eq(accounts.accountNumber, accountNumber!)).get();

      if (!account) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Account was created but could not be retrieved. Please try again.",
        });
      }

      return account;
    }),

  getAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, ctx.user.id));

    return userAccounts;
  }),

  fundAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        amount: z
          .number()
          .positive("Amount must be greater than $0.00")
          .min(0.01, "Amount must be at least $0.01")
          .max(10000, "Amount cannot exceed $10,000")
          .refine((val) => val > 0, {
            message: "Amount must be greater than $0.00",
          }),
        fundingSource: z
          .object({
            type: z.enum(["card", "bank"]),
            accountNumber: z.string(),
            routingNumber: z.string().optional(),
          })
          .refine(
            (data) => {
              // VAL-207 fix: Routing number is required for bank transfers
              if (data.type === "bank") {
                return !!data.routingNumber && data.routingNumber.trim().length > 0;
              }
              return true;
            },
            {
              message: "Routing number is required for bank transfers",
              path: ["routingNumber"],
            }
          )
          .refine(
            (data) => {
              // VAL-207 fix: Validate routing number format (9 digits) for bank transfers
              if (data.type === "bank" && data.routingNumber) {
                return /^\d{9}$/.test(data.routingNumber);
              }
              return true;
            },
            {
              message: "Routing number must be exactly 9 digits",
              path: ["routingNumber"],
            }
          ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const amount = parseFloat(input.amount.toString());

      // VAL-205 fix: Additional server-side check to prevent zero amounts
      if (amount <= 0 || isNaN(amount)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Amount must be greater than $0.00",
        });
      }

      // VAL-205 fix: Ensure amount is at least $0.01
      if (amount < 0.01) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Amount must be at least $0.01",
        });
      }

      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      if (account.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account is not active",
        });
      }

      // VAL-206 & VAL-210: Validate card number if funding source is a card
      if (input.fundingSource.type === "card") {
        const cardValidation = validateCardNumber(input.fundingSource.accountNumber);
        if (!cardValidation.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: cardValidation.errors.join(". "),
          });
        }
      }

      // VAL-207: Validate routing number for bank transfers (additional server-side check)
      if (input.fundingSource.type === "bank") {
        if (!input.fundingSource.routingNumber || input.fundingSource.routingNumber.trim().length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Routing number is required for bank transfers",
          });
        }
        if (!/^\d{9}$/.test(input.fundingSource.routingNumber)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Routing number must be exactly 9 digits",
          });
        }
      }

      // Use database transaction for atomicity
      const rawDb = getRawDatabase();
      const transaction = rawDb.transaction(() => {
        // Create transaction record
        const insertStmt = rawDb.prepare(`
          INSERT INTO transactions (account_id, type, amount, description, status, processed_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const processedAt = new Date().toISOString();
        const result = insertStmt.run(
          input.accountId,
          "deposit",
          amount,
          `Funding from ${input.fundingSource.type}`,
          "completed",
          processedAt
        );

        // Get the inserted transaction ID
        const transactionId = result.lastInsertRowid;

        // Atomic balance update using SQL - prevents race conditions
        // This ensures the balance update is atomic and thread-safe
        const updateStmt = rawDb.prepare(`
          UPDATE accounts 
          SET balance = balance + ? 
          WHERE id = ?
        `);
        updateStmt.run(amount, input.accountId);

        // Fetch the created transaction
        const transactionStmt = rawDb.prepare(`
          SELECT * FROM transactions WHERE id = ?
        `);
        const transaction = transactionStmt.get(transactionId);

        // Fetch updated account balance
        const accountStmt = rawDb.prepare(`
          SELECT balance FROM accounts WHERE id = ?
        `);
        const updatedAccount = accountStmt.get(input.accountId) as { balance: number } | undefined;

        return {
          transaction,
          newBalance: updatedAccount?.balance ?? account.balance + amount,
        };
      })();

      return transaction;
    }),

  getTransactions: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Verify account belongs to user
      const account = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)))
        .get();

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Fetch all transactions for the account, ordered by creation date (most recent first)
      // This ensures all transactions are returned in a predictable order
      const accountTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, input.accountId))
        .orderBy(desc(transactions.createdAt));

      // Enrich transactions with account type
      // We already have the account from the verification above, so we can reuse it
      const enrichedTransactions = accountTransactions.map((transaction) => ({
        ...transaction,
        accountType: account.accountType,
      }));

      return enrichedTransactions;
    }),
});
