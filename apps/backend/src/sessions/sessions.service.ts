import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CreateSessionInput = {
  meetingId: string; // recommended: LiveKit room SID
  roomName: string;
  roomSid?: string | null;
  organizationId?: string;
};

type SessionStatusLiteral = 'ACTIVE' | 'ENDED';
type SessionRecord = {
  id: string;
  meetingId: string;
  roomName: string;
  roomSid: string | null;
  organizationId: string | null;
};

interface SessionDelegateSubset {
  findUnique(args: {
    where: { meetingId?: string; roomSid?: string };
    select?: { id?: boolean; organizationId?: boolean; meetingId?: boolean };
  }): Promise<SessionRecord | null>;
  findFirst(args: {
    where: { roomName: string; status: SessionStatusLiteral; organizationId?: string | null };
    orderBy: { startedAt: 'desc' };
  }): Promise<SessionRecord | null>;
  upsert(args: {
    where: { meetingId: string };
    create: Omit<SessionRecord, 'id'> & { status: SessionStatusLiteral };
    update: Partial<Omit<SessionRecord, 'id'>> & {
      status?: SessionStatusLiteral;
      endedAt?: Date | null;
    };
  }): Promise<SessionRecord>;
  update(args: {
    where: { meetingId?: string; id?: string };
    data: Partial<Omit<SessionRecord, 'id'>> & {
      status?: SessionStatusLiteral;
      endedAt?: Date | null;
    };
  }): Promise<SessionRecord>;
}

type PrismaSessionAPI = { session: SessionDelegateSubset };

@Injectable()
export class SessionsService {
  constructor(private readonly prismaService: PrismaService) {}

  private get prisma(): PrismaSessionAPI {
    return this.prismaService as unknown as PrismaSessionAPI;
  }

  async createOrActivate(input: CreateSessionInput) {
    const { meetingId, roomName, roomSid, organizationId } = input;
    if (roomSid && meetingId !== roomName) {
      const placeholder = (await this.prisma.session.findUnique({
        where: { meetingId: roomName },
        select: { id: true, organizationId: true },
      })) as { id: string; organizationId: string | null } | null;
      if (placeholder) {
        return this.prisma.session.update({
          where: { id: placeholder.id },
          data: {
            meetingId,
            roomName,
            roomSid: roomSid ?? null,
            status: 'ACTIVE',
            endedAt: null,
            organizationId: placeholder.organizationId ?? organizationId ?? undefined,
          },
        });
      }
    }

    return this.prisma.session.upsert({
      where: { meetingId },
      create: {
        meetingId,
        roomName,
        roomSid: roomSid ?? null,
        organizationId: organizationId ?? null,
        status: 'ACTIVE',
      },
      update: {
        roomName,
        roomSid: roomSid ?? null,
        status: 'ACTIVE',
        endedAt: null,
        organizationId: organizationId ?? undefined,
      },
    });
  }

  async endByMeetingId(meetingId: string) {
    return this.prisma.session.update({
      where: { meetingId },
      data: { status: 'ENDED', endedAt: new Date() },
    });
  }

  async findActiveByRoomName(roomName: string, organizationId?: string) {
    const existing = await this.prisma.session.findFirst({
      where: {
        roomName,
        status: 'ACTIVE',
        organizationId: organizationId ?? null,
      },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) {
      return existing;
    }
    if (!organizationId) return null;
    const orphan = await this.prisma.session.findFirst({
      where: { roomName, status: 'ACTIVE', organizationId: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!orphan) return null;
    return this.prisma.session.update({
      where: { meetingId: orphan.meetingId },
      data: { organizationId },
    });
  }

  async getOrganizationIdByMeetingId(meetingId: string): Promise<string | null> {
    const session = (await this.prisma.session.findUnique({
      where: { meetingId },
      select: { organizationId: true },
    })) as { organizationId: string | null } | null;
    return session?.organizationId ?? null;
  }

  async assertMeetingBelongsToOrganization(meetingId: string, organizationId: string) {
    const session = (await this.prisma.session.findUnique({
      where: { meetingId },
      select: { meetingId: true, organizationId: true },
    })) as { meetingId: string; organizationId: string | null } | null;
    if (!session) {
      throw new NotFoundException('Meeting not found');
    }
    if (session.organizationId && session.organizationId !== organizationId) {
      throw new ForbiddenException('Meeting belongs to another organization');
    }
    if (!session.organizationId) {
      await this.prisma.session.update({
        where: { meetingId },
        data: { organizationId },
      });
    }
  }

  async ensurePlaceholderForRoom(roomName: string, organizationId: string) {
    await this.prisma.session.upsert({
      where: { meetingId: roomName },
      create: {
        meetingId: roomName,
        roomName,
        roomSid: null,
        status: 'ACTIVE',
        organizationId,
      },
      update: {
        organizationId: organizationId ?? undefined,
      },
    });
  }

  async getByMeetingId(meetingId: string) {
    return this.prisma.session.findUnique({
      where: { meetingId },
    });
  }
}
