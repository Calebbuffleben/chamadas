import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [
    // Hume
    {
      provide: 'HUME_WS_URL',
      useFactory: () => process.env.HUME_WS_URL || 'wss://api.hume.ai/v0/stream/models',
    },
    { provide: 'HUME_API_KEY', useFactory: () => process.env.HUME_API_KEY },
    {
      provide: 'HUME_WS_HEADERS',
      useFactory: (apiKey?: string): Record<string, string> => {
        const headers: Record<string, string> = {};
        if (apiKey) headers['X-Hume-Api-Key'] = apiKey;
        return headers;
      },
      inject: ['HUME_API_KEY'],
    },
    // LiveKit / Egress
    {
      provide: 'LIVEKIT_API_URL',
      useFactory: () =>
        process.env.LIVEKIT_API_URL || process.env.LIVEKIT_HOST || 'http://localhost:7880',
    },
    { provide: 'LIVEKIT_API_KEY', useFactory: () => process.env.LIVEKIT_API_KEY },
    { provide: 'LIVEKIT_API_SECRET', useFactory: () => process.env.LIVEKIT_API_SECRET },
    {
      provide: 'EGRESS_WS_BASE',
      useFactory: () => process.env.EGRESS_WS_BASE || 'ws://localhost:3001',
    },
    // Server
    { provide: 'PORT', useFactory: () => Number(process.env.PORT || 3001) },
    {
      provide: 'JWT_ACCESS_SECRET',
      useFactory: () => process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    },
    {
      provide: 'JWT_REFRESH_SECRET',
      useFactory: () => process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    },
    {
      provide: 'JWT_ACCESS_TTL',
      useFactory: () => {
        const raw = Number(process.env.JWT_ACCESS_TTL || 900);
        return Number.isFinite(raw) && raw > 0 ? raw : 900;
      },
    },
    {
      provide: 'JWT_REFRESH_TTL',
      useFactory: () => {
        const raw = Number(process.env.JWT_REFRESH_TTL || 2592000);
        return Number.isFinite(raw) && raw > 0 ? raw : 2592000;
      },
    },
  ],
  exports: [
    'HUME_WS_URL',
    'HUME_API_KEY',
    'HUME_WS_HEADERS',
    'LIVEKIT_API_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'EGRESS_WS_BASE',
    'PORT',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_ACCESS_TTL',
    'JWT_REFRESH_TTL',
  ],
})
export class ConfigModule {}
