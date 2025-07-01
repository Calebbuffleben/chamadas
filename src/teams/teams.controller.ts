import { Controller, Get, Post, Query, Param, HttpException, HttpStatus } from '@nestjs/common';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  /**
   * Retrieves Microsoft Teams meetings with optional date filtering.
   * Returns all meetings that have online meeting capabilities within the specified date range.
   * 
   * @param startDate - Optional query parameter for start date (ISO string format)
   * @param endDate - Optional query parameter for end date (ISO string format)
   * @returns Promise<TeamsMeeting[]> - Array of meeting objects
   * @throws HttpException - If meetings cannot be retrieved
   */
  @Get('meetings')
  async getMeetings(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      
      return await this.teamsService.getMeetings(start, end);
    } catch (error) {
      throw new HttpException(
        `Failed to get meetings: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retrieves all users from the Microsoft 365 organization.
   * Returns basic user information including display names and email addresses.
   * 
   * @returns Promise<any[]> - Array of user objects
   * @throws HttpException - If users cannot be retrieved
   */
  @Get('users')
  async getUsers() {
    try {
      return await this.teamsService.getUsers();
    } catch (error) {
      throw new HttpException(
        `Failed to get users: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retrieves the presence status of a specific user in Microsoft Teams.
   * Shows current availability (Available, Busy, Away, etc.) and activity status.
   * 
   * @param userId - Path parameter for the Microsoft Graph user ID
   * @returns Promise<TeamsPresence> - User presence data
   * @throws HttpException - If user presence cannot be retrieved or user not found
   */
  @Get('users/:userId/presence')
  async getUserPresence(@Param('userId') userId: string) {
    try {
      const presence = await this.teamsService.getPresence(userId);
      if (!presence) {
        throw new HttpException('User presence not found', HttpStatus.NOT_FOUND);
      }
      return presence;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get user presence: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retrieves an access token from Microsoft Azure AD for debugging purposes.
   * This endpoint is useful for testing authentication and troubleshooting.
   * 
   * @returns Promise<{accessToken: string}> - Object containing the access token
   * @throws HttpException - If access token cannot be retrieved
   */
  @Get('auth/token')
  async getAccessToken() {
    try {
      const token = await this.teamsService.getAccessToken();
      if (!token) {
        throw new HttpException('Failed to get access token', HttpStatus.UNAUTHORIZED);
      }
      return { accessToken: token };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get access token: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Synchronizes Microsoft Teams meetings to the local Prisma database.
   * Creates or updates meeting records in the database based on current Teams data.
   * This endpoint triggers a full sync of all meetings within the default date range.
   * 
   * @returns Promise<{message: string}> - Success message
   * @throws HttpException - If sync operation fails
   */
  @Post('sync/meetings')
  async syncMeetings() {
    try {
      await this.teamsService.syncMeetingsToDatabase();
      return { message: 'Meetings synced successfully' };
    } catch (error) {
      throw new HttpException(
        `Failed to sync meetings: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check endpoint for the Microsoft Teams integration.
   * Tests authentication and returns the current status of the service.
   * Useful for monitoring and debugging the Teams integration.
   * 
   * @returns Promise<object> - Health status object with authentication status and timestamp
   */
  @Get('health')
  async healthCheck() {
    try {
      const token = await this.teamsService.getAccessToken();
      return {
        status: 'healthy',
        authenticated: !!token,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        authenticated: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}