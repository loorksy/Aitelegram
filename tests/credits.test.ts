import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/core/prisma';
import { UserStatus, UserRole, CreditTransactionType } from '@prisma/client';
import {
  checkUserCredits,
  deductCredits,
  addCredits,
  getBalanceSummary,
  PIPELINE_COST
} from '../src/services/credits.service';

describe('Credits Service', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        telegramId: `test-credits-${Date.now()}`,
        name: 'Test Credits User',
        status: UserStatus.APPROVED,
        role: UserRole.USER,
        credits: 100,
        dailyCreditsLimit: 50,
        dailyCreditsUsed: 0
      }
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.creditTransaction.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('checkUserCredits', () => {
    it('should allow approved user with sufficient credits', async () => {
      const result = await checkUserCredits(testUserId);
      expect(result.allowed).toBe(true);
      expect(result.currentBalance).toBe(100);
    });

    it('should reject user with insufficient credits', async () => {
      // Set credits to less than PIPELINE_COST
      await prisma.user.update({
        where: { id: testUserId },
        data: { credits: 5 }
      });

      const result = await checkUserCredits(testUserId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('insufficient_credits');

      // Restore credits
      await prisma.user.update({
        where: { id: testUserId },
        data: { credits: 100 }
      });
    });

    it('should reject pending user', async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: { status: UserStatus.PENDING_APPROVAL }
      });

      const result = await checkUserCredits(testUserId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('user_status_pending_approval');

      // Restore status
      await prisma.user.update({
        where: { id: testUserId },
        data: { status: UserStatus.APPROVED }
      });
    });

    it('should reject when daily limit exceeded', async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: { dailyCreditsUsed: 45 } // 45 + 10 (PIPELINE_COST) > 50 (limit)
      });

      const result = await checkUserCredits(testUserId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('daily_limit_exceeded');

      // Reset
      await prisma.user.update({
        where: { id: testUserId },
        data: { dailyCreditsUsed: 0 }
      });
    });
  });

  describe('deductCredits', () => {
    it('should deduct credits and create transaction', async () => {
      const initialBalance = 100;
      await prisma.user.update({
        where: { id: testUserId },
        data: { credits: initialBalance }
      });

      const result = await deductCredits(testUserId, 10, 'test_deduction');
      
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(90);

      // Verify transaction created
      const transaction = await prisma.creditTransaction.findFirst({
        where: { userId: testUserId, reason: 'test_deduction' }
      });
      expect(transaction).toBeTruthy();
      expect(transaction?.amount).toBe(-10);
      expect(transaction?.type).toBe(CreditTransactionType.DEDUCTION);
    });

    it('should fail when insufficient credits', async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: { credits: 5 }
      });

      const result = await deductCredits(testUserId, 10, 'test');
      expect(result.success).toBe(false);
    });
  });

  describe('addCredits', () => {
    it('should add credits and create transaction', async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: { credits: 50 }
      });

      const result = await addCredits(
        testUserId,
        100,
        CreditTransactionType.TOPUP,
        'test_topup'
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(150);

      // Verify transaction
      const transaction = await prisma.creditTransaction.findFirst({
        where: { userId: testUserId, reason: 'test_topup' }
      });
      expect(transaction).toBeTruthy();
      expect(transaction?.amount).toBe(100);
    });
  });

  describe('getBalanceSummary', () => {
    it('should return correct balance summary', async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          credits: 200,
          dailyCreditsUsed: 30,
          dailyCreditsLimit: 100
        }
      });

      const summary = await getBalanceSummary(testUserId);

      expect(summary).toBeTruthy();
      expect(summary?.balance).toBe(200);
      expect(summary?.dailyUsed).toBe(30);
      expect(summary?.dailyLimit).toBe(100);
      expect(summary?.dailyRemaining).toBe(70);
      expect(summary?.pipelineCost).toBe(PIPELINE_COST);
    });
  });
});
