import { z } from 'zod';

// ========================================================================
// Pagination & Filtering Schemas
// ========================================================================
export const paginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export const filterByStatusSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed']).optional(),
});

export const filterByTypeSchema = z.object({
  type: z.enum([
    'CHAT_DEPOSIT',
    'CHAT_MESSAGE_EARNING',
    'CHAT_WITHDRAWAL',
    'CHAT_REFERRAL_EARNING'
  ]).optional(),
});

// ========================================================================
// Chat Foreigners Schemas
// ========================================================================
export const chatMessageSchema = z.object({
  bot_id: z.string().min(1, 'Bot ID required'),
  message: z.string().min(1, 'Message required').max(5000, 'Message too long'),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const botUnlockSchema = z.object({
  bot_id: z.string().min(1, 'Bot ID required'),
  phone_number: z.string().regex(/^254\d{9}$/, 'Invalid phone number'),
});

export type BotUnlockInput = z.infer<typeof botUnlockSchema>;

export const walletQuerySchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
  type: z.enum([
    'CHAT_DEPOSIT',
    'CHAT_MESSAGE_EARNING',
    'CHAT_WITHDRAWAL',
    'CHAT_REFERRAL_EARNING'
  ]).optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
});

export type WalletQueryParams = z.infer<typeof walletQuerySchema>;

export const createTransactionSchema = z.object({
  amount_cents: z.number().int().positive(),
  type: z.enum([
    'CHAT_DEPOSIT',
    'CHAT_MESSAGE_EARNING',
    'CHAT_WITHDRAWAL',
    'CHAT_REFERRAL_EARNING'
  ]),
  description: z.string().optional(),
  bot_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

// ========================================================================
// Validation Helpers
// ========================================================================
export function validatePagination(input: unknown) {
  return paginationSchema.safeParse(input);
}

export function validateChatMessage(input: unknown) {
  return chatMessageSchema.safeParse(input);
}

export function validateBotUnlock(input: unknown) {
  return botUnlockSchema.safeParse(input);
}

export function validateWalletQuery(input: unknown) {
  return walletQuerySchema.safeParse(input);
}

export function validateCreateTransaction(input: unknown) {
  return createTransactionSchema.safeParse(input);
}
