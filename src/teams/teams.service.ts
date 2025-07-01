import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';

export interface TeamsMeeting {
  id: string;
  subject: string;
  startTime: Date;
  endTime: Date;
  joinUrl?: string;
  attendees: string[];
  organizer: string;
}

export interface TeamsPresence {
  userId: string;
  availability: string;
  activity: string;
  lastSeenAt: Date;
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);
  private msalClient: ConfidentialClientApplication;
  private graphClient: Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.initializeMsal();
  }

  /**
   * Initializes the Microsoft Authentication Library (MSAL) client and Microsoft Graph client
   * using environment variables for Azure AD application credentials.
   * Sets up authentication for accessing Microsoft Teams data via Graph API.
   */
  private initializeMsal() {
    const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET');
    const tenantId = this.configService.get<string>('MICROSOFT_TENANT_ID');

    if (!clientId || !clientSecret || !tenantId) {
      this.logger.warn('Microsoft Teams credentials not configured');
      return;
    }

    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://login.microsoftonline.com/${tenantId}`,
      },
    });

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    this.graphClient = Client.initWithMiddleware({
      authProvider,
    });
  }

  /**
   * Acquires an access token from Microsoft Azure AD using client credentials flow.
   * This token is required for authenticating requests to Microsoft Graph API.
   * 
   * @returns Promise<string | null> - The access token or null if authentication fails
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID');
      const clientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET');
      const tenantId = this.configService.get<string>('MICROSOFT_TENANT_ID');

      if (!clientId || !clientSecret || !tenantId) {
        throw new Error('Microsoft Teams credentials not configured');
      }

      const result = await this.msalClient.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });

      return result?.accessToken || null;
    } catch (error) {
      this.logger.error('Failed to get access token', error);
      return null;
    }
  }

  /**
   * Retrieves Microsoft Teams meetings from all users in the organization.
   * Fetches calendar events that have online meeting capabilities (Teams/Zoom/etc).
   * 
   * @param startDate - Optional start date for filtering meetings (defaults to current date)
   * @param endDate - Optional end date for filtering meetings (defaults to 7 days from now)
   * @returns Promise<TeamsMeeting[]> - Array of meeting objects with details
   */
  async getMeetings(startDate?: Date, endDate?: Date): Promise<TeamsMeeting[]> {
    try {
      if (!this.graphClient) {
        throw new Error('Graph client not initialized');
      }

      const start = startDate || new Date();
      const end = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const response = await this.graphClient
        .api('/users')
        .select('id,mail')
        .get();

      const meetings: TeamsMeeting[] = [];

      for (const user of response.value) {
        const userMeetings = await this.graphClient
          .api(`/users/${user.id}/calendar/events`)
          .select('id,subject,start,end,onlineMeeting,attendees,organizer')
          .filter(`start/dateTime ge '${start.toISOString()}' and end/dateTime le '${end.toISOString()}'`)
          .get();

        for (const meeting of userMeetings.value) {
          if (meeting.onlineMeeting) {
            meetings.push({
              id: meeting.id,
              subject: meeting.subject || 'No Subject',
              startTime: new Date(meeting.start.dateTime),
              endTime: new Date(meeting.end.dateTime),
              joinUrl: meeting.onlineMeeting.joinUrl,
              attendees: meeting.attendees?.map(a => a.emailAddress?.address).filter(Boolean) || [],
              organizer: meeting.organizer?.emailAddress?.address || '',
            });
          }
        }
      }

      return meetings;
    } catch (error) {
      this.logger.error('Failed to get meetings', error);
      throw error;
    }
  }

  /**
   * Retrieves the presence status of a specific user in Microsoft Teams.
   * Shows availability (Available, Busy, Away, etc.) and activity status.
   * 
   * @param userId - The Microsoft Graph user ID to check presence for
   * @returns Promise<TeamsPresence | null> - User presence data or null if not found
   */
  async getPresence(userId: string): Promise<TeamsPresence | null> {
    try {
      if (!this.graphClient) {
        throw new Error('Graph client not initialized');
      }

      const response = await this.graphClient
        .api(`/users/${userId}/presence`)
        .get();

      return {
        userId,
        availability: response.availability,
        activity: response.activity,
        lastSeenAt: new Date(response.lastSeenAt?.dateTime || Date.now()),
      };
    } catch (error) {
      this.logger.error(`Failed to get presence for user ${userId}`, error);
      return null;
    }
  }

  /**
   * Retrieves all users from the Microsoft 365 organization.
   * Returns basic user information including display name and email addresses.
   * 
   * @returns Promise<any[]> - Array of user objects with id, displayName, mail, userPrincipalName
   */
  async getUsers(): Promise<any[]> {
    try {
      if (!this.graphClient) {
        throw new Error('Graph client not initialized');
      }

      const response = await this.graphClient
        .api('/users')
        .select('id,displayName,mail,userPrincipalName')
        .get();

      return response.value;
    } catch (error) {
      this.logger.error('Failed to get users', error);
      throw error;
    }
  }

  /**
   * Synchronizes Microsoft Teams meetings to the local Prisma database.
   * Creates or updates meeting records in the database based on Teams data.
   * Uses upsert to avoid duplicates and update existing meetings.
   * 
   * @returns Promise<void> - Resolves when sync is complete
   */
  async syncMeetingsToDatabase(): Promise<void> {
    try {
      const meetings = await this.getMeetings();
      
      for (const meeting of meetings) {
        await this.prisma.meeting.upsert({
          where: { externalId: meeting.id },
          update: {
            title: meeting.subject,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            platform: 'TEAMS',
          },
          create: {
            title: meeting.subject,
            startTime: meeting.startTime,
            endTime: meeting.endTime,
            platform: 'TEAMS',
            externalId: meeting.id,
          },
        });
      }

      this.logger.log(`Synced ${meetings.length} meetings to database`);
    } catch (error) {
      this.logger.error('Failed to sync meetings to database', error);
      throw error;
    }
  }
}
