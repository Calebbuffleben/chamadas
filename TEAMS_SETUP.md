# Microsoft Teams Integration Setup

## Prerequisites

1. Azure Active Directory (AAD) application registration
2. Microsoft Graph API permissions
3. Environment variables configuration

## Environment Variables

Add these to your `.env` file:

```env
# Microsoft Teams Configuration
MICROSOFT_CLIENT_ID="your-client-id-here"
MICROSOFT_CLIENT_SECRET="your-client-secret-here"
MICROSOFT_TENANT_ID="your-tenant-id-here"
```

## Azure App Registration Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Create a new registration
4. Add the following API permissions:
   - `Calendars.Read` (for meeting data)
   - `Presence.Read` (for user presence)
   - `User.Read.All` (for user data)
5. Create a client secret
6. Note down the Client ID, Tenant ID, and Client Secret

## API Endpoints

### Health Check
```
GET /teams/health
```

### Get Meetings
```
GET /teams/meetings?startDate=2024-01-01&endDate=2024-01-31
```

### Get Users
```
GET /teams/users
```

### Get User Presence
```
GET /teams/users/{userId}/presence
```

### Get Access Token
```
GET /teams/auth/token
```

### Sync Meetings to Database
```
POST /teams/sync/meetings
```

## Features

- **Meeting Retrieval**: Get all Teams meetings with attendees and join URLs
- **User Presence**: Track user availability and activity status
- **Database Sync**: Automatically sync meetings to your Prisma database
- **Authentication**: Secure OAuth2 authentication with Microsoft Graph API
- **Error Handling**: Comprehensive error handling and logging

## Usage Example

```typescript
// Get meetings for the next 7 days
const meetings = await teamsService.getMeetings();

// Get user presence
const presence = await teamsService.getPresence('user-id');

// Sync meetings to database
await teamsService.syncMeetingsToDatabase();
``` 