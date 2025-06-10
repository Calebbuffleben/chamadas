import { IntegrationService } from "./types"
import { TeamsService } from "./teams"
import { ZoomService } from "./zoom"

export type Platform = "TEAMS" | "ZOOM"

export function getIntegrationService(platform: Platform, accessToken: string): IntegrationService {
  switch (platform) {
    case "TEAMS":
      return new TeamsService(accessToken)
    case "ZOOM":
      return new ZoomService(accessToken)
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
} 