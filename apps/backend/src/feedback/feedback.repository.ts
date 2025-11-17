import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedbackEventPayload } from './feedback.types';

type FeedbackEventDelegate = {
  create(args: { data: FeedbackEventCreateInput }): Promise<void>;
  deleteMany(args: { where: { expiresAt: { lt: Date } } }): Promise<{ count: number }>;
};

type FeedbackEventCreateInput = {
  id: string;
  meetingId: string;
  participantId: string;
  type: FeedbackEventPayload['type'];
  severity: FeedbackEventPayload['severity'];
  ts: Date;
  windowStart: Date;
  windowEnd: Date;
  message: string;
  metadata: Record<string, unknown>;
  expiresAt: Date;
  organizationId?: string;
};

@Injectable()
export class FeedbackRepository {
  private readonly logger = new Logger(FeedbackRepository.name);
  private readonly ttlDays: number;

  constructor(private readonly prisma: PrismaService) {
    const n = Number(process.env.FEEDBACK_TTL_DAYS || '14');
    this.ttlDays = Number.isFinite(n) && n > 0 ? n : 14;
  }

  async saveEvent(evt: FeedbackEventPayload, organizationId?: string): Promise<void> {
    try {
      const expiresAt = new Date(evt.ts + this.ttlDays * 24 * 60 * 60 * 1000);
      const prisma = this.prisma as PrismaService & { feedbackEvent: FeedbackEventDelegate };
      await prisma.feedbackEvent.create({
        data: {
          id: evt.id,
          meetingId: evt.meetingId,
          participantId: evt.participantId,
          type: evt.type,
          severity: evt.severity,
          ts: new Date(evt.ts),
          windowStart: new Date(evt.window.start),
          windowEnd: new Date(evt.window.end),
          message: evt.message,
          metadata: evt.metadata ?? {},
          expiresAt,
          organizationId: organizationId ?? undefined,
        },
      });
      // best-effort cleanup of expired rows
      await prisma.feedbackEvent.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to save feedback event: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
