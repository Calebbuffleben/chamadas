import { z } from "zod";

const zoomConfig = {
  clientId: process.env.ZOOM_CLIENT_ID!,
  clientSecret: process.env.ZOOM_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/zoom/callback`,
};

export const zoomScopes = [
  'meeting:read',
  'meeting:write',
  'user:read',
  'report:read:admin'
];

export const zoomTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

export const zoomMeetingSchema = z.object({
  id: z.string(),
  topic: z.string(),
  start_time: z.string(),
  duration: z.number(),
  join_url: z.string(),
});

interface ZoomTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface ZoomMeeting {
  id: string;
  topic: string;
  start_time: string;
  duration: number;
}

export class ZoomError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number
  ) {
    super(message);
    this.name = 'ZoomError';
  }
}

export async function getZoomToken(code: string): Promise<ZoomTokenResponse> {
  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: zoomConfig.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ZoomError(
      error.message || "Failed to get Zoom token",
      error.code,
      response.status
    );
  }

  return response.json();
}

export async function refreshZoomToken(refreshToken: string): Promise<ZoomTokenResponse> {
  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ZoomError(
      error.message || "Failed to refresh Zoom token",
      error.code,
      response.status
    );
  }

  return response.json();
}

export async function revokeZoomToken(token: string): Promise<void> {
  const response = await fetch("https://zoom.us/oauth/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      token,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ZoomError(
      error.message || "Failed to revoke Zoom token",
      error.code,
      response.status
    );
  }
}

export async function getZoomMeetings(accessToken: string): Promise<ZoomMeeting[]> {
  const response = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ZoomError(
      error.message || "Failed to get Zoom meetings",
      error.code,
      response.status
    );
  }

  const data = await response.json();
  return data.meetings;
}

export async function getZoomMeetingDetails(accessToken: string, meetingId: string) {
  const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ZoomError(
      error.message || "Failed to get Zoom meeting details",
      error.code,
      response.status
    );
  }

  return response.json();
} 