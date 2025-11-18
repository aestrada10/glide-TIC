import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { db, getRawDatabase } from "@/lib/db";
import { accounts, transactions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

function generateAccountNumber(): string {
  return Math.floor(Math.random() * 1000000000)
    .toString()
    .padStart(10, "0");
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

      return (
        account || {
          id: 0,
          userId: ctx.user.id,
          accountNumber: accountNumber!,
          accountType: input.accountType,
          balance: 100,
          status: "pending",
          createdAt: new Date().toISOString(),
        }
      );
    }),

  getAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, ctx.user.id));

    return userAccounts;
  }),

  fundAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        amount: z.number().positive(),
        fundingSource: z.object({
          type: z.enum(["card", "bank"]),
          accountNumber: z.string(),
          routingNumber: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const amount = parseFloat(input.amount.toString());

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

      const accountTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.accountId, input.accountId));

      const enrichedTransactions = [];
      for (const transaction of accountTransactions) {
        const accountDetails = await db.select().from(accounts).where(eq(accounts.id, transaction.accountId)).get();

        enrichedTransactions.push({
          ...transaction,
          accountType: accountDetails?.accountType,
        });
      }

      return enrichedTransactions;
    }),
});
