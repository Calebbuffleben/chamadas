import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/microsoft-auth";
import { getZoomToken } from "@/lib/zoom";

export async function refreshMicrosoftToken(userId: string, orgId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
      organizationId: orgId,
    },
    select: {
      microsoftRefreshToken: true,
    },
  });

  if (!user?.microsoftRefreshToken) {
    throw new Error("No refresh token available");
  }

  const tokens = await refreshAccessToken(user.microsoftRefreshToken);

  await prisma.user.update({
    where: {
      id: userId,
      organizationId: orgId,
    },
    data: {
      microsoftAccessToken: tokens.accessToken,
      microsoftRefreshToken: tokens.refreshToken,
      microsoftTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    },
  });

  return tokens.accessToken;
}

export async function refreshZoomToken(userId: string, orgId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
      organizationId: orgId,
    },
    select: {
      zoomRefreshToken: true,
    },
  });

  if (!user?.zoomRefreshToken) {
    throw new Error("No refresh token available");
  }

  const tokens = await getZoomToken(user.zoomRefreshToken);

  await prisma.user.update({
    where: {
      id: userId,
      organizationId: orgId,
    },
    data: {
      zoomAccessToken: tokens.access_token,
      zoomRefreshToken: tokens.refresh_token,
      zoomTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return tokens.access_token;
}

export async function getValidMicrosoftToken(userId: string, orgId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
      organizationId: orgId,
    },
    select: {
      microsoftAccessToken: true,
      microsoftTokenExpiresAt: true,
    },
  });

  if (!user?.microsoftAccessToken) {
    throw new Error("No access token available");
  }

  // Refresh token if it expires in less than 5 minutes
  if (user.microsoftTokenExpiresAt && user.microsoftTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshMicrosoftToken(userId, orgId);
  }

  return user.microsoftAccessToken;
}

export async function getValidZoomToken(userId: string, orgId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
      organizationId: orgId,
    },
    select: {
      zoomAccessToken: true,
      zoomTokenExpiresAt: true,
    },
  });

  if (!user?.zoomAccessToken) {
    throw new Error("No access token available");
  }

  // Refresh token if it expires in less than 5 minutes
  if (user.zoomTokenExpiresAt && user.zoomTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshZoomToken(userId, orgId);
  }

  return user.zoomAccessToken;
} 