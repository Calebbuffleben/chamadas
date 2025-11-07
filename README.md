# Live Meeting - Video Conferencing System

A comprehensive video conferencing solution built with LiveKit, Next.js, and NestJS. This system provides real-time audio/video communication, room management, recording capabilities, and audio egress processing.

## System Overview

This is a monorepo containing three main applications:

1. **Backend API** (`apps/backend`) - NestJS backend with WebSocket support, database management, and audio egress processing
2. **Frontend Application** (`apps/meet`) - Next.js video conferencing client built with LiveKit Components
3. **LiveKit Server** (`apps/livekit`) - LiveKit media server for WebRTC communication

## Architecture

```
                                   ┌──────────────────────────────┐
                                   │  Media Egress WS             │
                                   │  + Audio Pipeline            │
                                   │  (apps/backend)              │
                                   └──────────┬──────────┬────────┘
                                              │          │
                                  Track Egress│          │ Prosody WS
                                  (WebSocket) ▼          ▼
┌────────────────────┐   HTTP/REST   ┌────────▼──────────┐   REST (admin API)   ┌──────────────────────┐
│ Next.js Client     │◄──────────────│ NestJS Backend    │────────────────────►│ LiveKit Server        │
│ (apps/meet)        │──────────────►│ (apps/backend)    │◄────────────────────┤ (apps/livekit)        │
└─────────┬──────────┘   Socket.io   │ - Token issuance  │   Webhooks (HTTP)    └─────────┬────────────┘
          │ WebRTC                   │ - Session store   │                         WebRTC │
          │                          │ - Egress control  │                           rooms │
          ▼                          │ - Pipeline/Hume   │                                ▼
┌──────────────────┐                 └───────────────────┘                      ┌──────────────────┐
│ Participants     │                                                         │ Participants     │
└──────────────────┘                                                         └──────────────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │ Hume Prosody API     │
                                   └──────────────────────┘
```

**Fluxos principais:**
- O frontend consome REST/Socket.io do backend para tokens, sessões e eventos auxiliares.
- O backend aciona o LiveKit via REST (egress, gravação) e recebe webhooks que sinalizam mudanças de sala/tracks.
- O LiveKit envia áudio/vídeo via Track Egress WebSocket para o backend, que processa, armazena e (quando habilitado) encaminha chunks ao Hume.
- O cliente WebRTC fala diretamente com o LiveKit para mídia em tempo real, enquanto o backend observa e enriquece a reunião com processamento de áudio e persistência.

### Audio Processing Flow

```
LiveKit Track Egress (PCM s16le)
         │
         ▼ WebSocket (/egress-audio)
┌──────────────────────────────┐
│  Media Egress WS (backend)   │
│  Receiver                    │
└─────────┬──────────┘
          │
          ├─ Writes WAV chunks to storage
          └─ Enqueues buffer into AudioPipelineService (backend)
                       │
                       ├─ Group chunks (default 2 s)
                       ├─ Optional normalization
                       ├─ Append pipeline log entry
                       └─ Stream base64 WAV frame to Hume WS API
```

Todo o fluxo de recepção, buffering, armazenamento e streaming em tempo real é executado dentro do NestJS backend. O LiveKit apenas inicia o Track Egress; a manipulação dos chunks, logs e integrações ocorre nos módulos `egress/` e `pipeline/` da API.

## Components

### Backend API (`apps/backend`)

**Technology Stack:**
- NestJS - Progressive Node.js framework
- Prisma - Type-safe ORM
- PostgreSQL - Relational database
- Socket.io - WebSocket communication
- WebSocket (ws) - Native WebSocket for audio egress

**Key Features:**
- RESTful API endpoints for health checks and status
- WebSocket gateway for real-time communication (rooms, messages)
- **Audio/Video Egress Receivers** - Native WebSocket endpoints that receive PCM audio and encoded video streams from LiveKit
- **Audio Pipeline** - Internal buffering system that groups audio chunks (1-2s) before processing
- **LiveKit Egress Automation** - Track publish webhook triggers audio track egress with retry logic
- **Hume Streaming Integration** - Real-time prosody analysis via Hume's WebSocket API
- **Session Management** - Automatic session tracking via LiveKit webhooks
- Prisma database integration with Session and User models
- CORS enabled for cross-origin requests
- Global validation pipes for request validation

**Project Structure:**
```
src/
├── config/          # Configuration module
├── prisma/          # Prisma service and module
├── websocket/       # Socket.io gateway and module
├── egress/          # Media egress WebSocket servers (audio/video)
├── pipeline/        # Audio pipeline service (buffering, processing)
├── sessions/        # Session management service
├── livekit/         # LiveKit webhook controller
├── types/           # TypeScript type definitions
├── app.module.ts    # Root application module
├── app.controller.ts # Main REST controller
└── main.ts          # Application entry point
```

**API Endpoints:**
- `GET /` - API status and information
- `GET /health` - Health check endpoint
- `POST /livekit/webhook` - LiveKit webhook endpoint for session management
- `WS /egress-audio` - WebSocket endpoint for receiving audio egress from LiveKit
- `WS /egress-video` - WebSocket endpoint for receiving video egress from LiveKit

**WebSocket Events (Socket.io):**
- `message` - Send and receive messages
- `join-room` - Join a room
- `leave-room` - Leave a room

**Audio Egress & Pipeline:**
The backend provides a comprehensive audio processing pipeline:

1. **Egress Receiver** (`/egress-audio`):
   - Receives PCM audio streams (s16le) from LiveKit Track Egress via WebSocket
   - Accepts JSON events (e.g., mute state changes)
   - Supports query parameters: `roomName`, `participant`, `trackId`, `sampleRate`, `channels`, `meetingId`, `groupSeconds`

2. **Audio Pipeline** (Internal Buffer):
   - Buffers incoming audio chunks in memory
   - Groups chunks by time (default: 2 seconds) or size threshold
   - Optional volume normalization before streaming
   - Automatic flush when threshold is reached or connection closes

3. **Hume Streaming Bridge**:
   - Maintains a dedicated WebSocket connection per meeting/participant/track
   - Sends base64 WAV frames to Hume's real-time prosody API
   - Sends a minimal prosody model configuration upon connection

4. **Output Storage & Logs**:
   - WAV files stored no diretório configurado para saída de áudio (`<meetingId>/`)
   - Pipeline logs em `storage/pipeline-logs/<meetingId>.log`

**Video Egress:**
- WebSocket endpoint (`/egress-video`) receives encoded video streams (H.264/VP8/VP9)
- Stores raw encoded bytestreams (`.h264` or `.ivf`) in um diretório de vídeo configurado (`<meetingId>/`)
- Supports query parameters: `roomName`, `participant`, `trackId`, `codec`, `meetingId`

**Session Management:**
- Automatic session tracking via LiveKit webhooks (`/livekit/webhook`)
- Creates/activates sessions when rooms start (`room_started`, `room_created`)
- Ends sessions when rooms finish (`room_finished`, `room_ended`, `room_deleted`)
- Session model: `id`, `meetingId` (unique), `roomName`, `roomSid`, `status` (ACTIVE/ENDED), `startedAt`, `endedAt`
- Egress streams are automatically associated with sessions via `meetingId`

**Database:**
- PostgreSQL database with Prisma ORM
- **Session model** - Tracks meeting lifecycle and associates media streams
- **User model** - User management (id, email, name, createdAt, updatedAt)
- Migration support for schema changes

### Frontend Application (`apps/meet`)

**Technology Stack:**
- Next.js 15 - React framework with App Router
- LiveKit Components React - UI components for video conferencing
- LiveKit Client SDK - WebRTC client library
- TypeScript - Type safety
- React 18 - UI library

**Key Features:**
- Video conferencing interface with LiveKit Components
- Pre-join screen with camera/microphone selection
- Support for end-to-end encryption (E2EE)
- Custom connection mode for connecting to external LiveKit servers
- Recording indicator and controls
- Settings menu for camera/microphone configuration
- Keyboard shortcuts
- Debug mode for development
- Performance optimization (low CPU mode)
- Chat functionality with link formatting
- Multiple video codec support (VP8, VP9, AV1, H.264)
- Adaptive streaming and simulcast

**Project Structure:**
```
app/
├── api/
│   ├── connection-details/  # Token generation endpoint
│   └── record/              # Recording start/stop endpoints
├── rooms/
│   └── [roomName]/          # Room page with video conference
├── custom/                  # Custom connection page
├── page.tsx                 # Home page with tabs
└── layout.tsx               # Root layout

lib/
├── client-utils.ts          # Client-side utilities
├── getLiveKitURL.ts         # LiveKit URL resolver
├── useSetupE2EE.ts          # E2EE setup hook
├── usePerfomanceOptimiser.ts # Performance optimization
├── CameraSettings.tsx       # Camera settings component
├── MicrophoneSettings.tsx   # Microphone settings component
├── SettingsMenu.tsx         # Settings menu component
├── RecordingIndicator.tsx   # Recording status indicator
├── KeyboardShortcuts.tsx    # Keyboard shortcuts handler
└── Debug.tsx                # Debug panel component
```

**API Routes:**
- `GET /api/connection-details` - Generates LiveKit access tokens for participants
  - Query params: `roomName`, `participantName`, `metadata`, `region`
  - Returns: `serverUrl`, `roomName`, `participantToken`, `participantName`
- `GET /api/record/start` - Starts room recording (composite egress)
  - Query params: `roomName`
  - Requires S3 configuration for output storage
- `GET /api/record/stop` - Stops active room recording
  - Query params: `roomName`

**Pages:**
- `/` - Home page with Demo and Custom connection tabs
- `/rooms/[roomName]` - Video conference room page
- `/custom` - Custom LiveKit server connection page

**Features:**
- **Demo Mode**: Quick start meetings with auto-generated room IDs
- **Custom Connection**: Connect to external LiveKit servers (Cloud or self-hosted)
- **E2EE Support**: Optional end-to-end encryption with passphrase
- **High Quality Mode**: HQ toggle for better video quality
- **Codec Selection**: Support for multiple video codecs
- **Recording**: Start/stop meeting recordings with S3 storage
- **Device Management**: Camera and microphone selection
- **Settings**: Audio/video settings, performance optimization
- **Chat**: Real-time chat with link formatting
- **Keyboard Shortcuts**: Keyboard navigation and controls

### LiveKit Server (`apps/livekit`)

**Technology Stack:**
- LiveKit Server - Open-source WebRTC media server
- Docker - Containerized deployment

**Configuration:**
- HTTP/WebSocket port: 7880
- TCP fallback port: 7881
- UDP media ports: 50000-50100
- API keys for token generation (definidos no arquivo de configuração do LiveKit)

**Features:**
- WebRTC media server for real-time communication
- Room management
- Participant tracking
- Track publishing and subscribing
- Recording/egress capabilities
- Token-based authentication

## Setup and Installation

### Prerequisites

- Node.js >= 18
- pnpm 10.18.2 (or compatible version)
- PostgreSQL 16 (or Docker)
- Docker Desktop (for LiveKit server)

### Installation Steps

1. **Clone the repository and install dependencies:**
```bash
# Install backend dependencies
cd apps/backend
pnpm install

# Install frontend dependencies
cd ../meet
pnpm install
```

2. **Configure Backend:**
```bash
cd apps/backend
cp env.example .env
# Edit .env with your configuration
```

3. **Setup Database:**

**Option A - Local PostgreSQL:**
```bash
# Ensure PostgreSQL is running
# macOS: brew services start postgresql@16
# Linux: sudo systemctl start postgresql

# Run setup script
./setup-database.sh
```

**Option B - Docker:**
```bash
docker-compose up -d
```

4. **Initialize Prisma:**
```bash
cd apps/backend
pnpm prisma:generate
pnpm prisma:migrate
```

5. **Configure Frontend:**
```bash
cd apps/meet
cp env.local.example .env.local
# Edit .env.local with your LiveKit configuration
```

6. **Configure LiveKit Server:**
```bash
cd apps/livekit
cp env.example .env.livekit
# Edit .env.livekit if needed (defaults work for local dev)
```

7. **Start LiveKit Server:**
```bash
cd apps/livekit
docker compose up -d
```

8. **Start Backend:**
```bash
cd apps/backend
pnpm start:dev
```

9. **Start Frontend:**
```bash
cd apps/meet
pnpm dev
```

## Configuration

### Backend Configuration

O backend utiliza um arquivo `.env` com credenciais e caminhos sensíveis (consulte `apps/backend/env.example`). Ajuste-o conforme o ambiente antes de iniciar os serviços.

### Frontend Configuration

O frontend também depende de um arquivo `.env.local`. Utilize `apps/meet/env.local.example` como ponto de partida e preencha os valores necessários antes de iniciar o servidor Next.js.

### LiveKit Server Configuration

The `livekit.yaml` file contains server configuration:
- Port bindings
- RTC settings (TCP/UDP ports)
- API keys
- Log level

## Development

### Backend Scripts

```bash
pnpm start:dev      # Start in development mode with watch
pnpm build          # Build for production
pnpm start:prod     # Start in production mode
pnpm test           # Run tests
pnpm lint           # Run linter
pnpm prisma:generate # Generate Prisma client
pnpm prisma:migrate # Run database migrations
pnpm prisma:studio  # Open Prisma Studio
```

### Frontend Scripts

```bash
pnpm dev            # Start development server
pnpm build          # Build for production
pnpm start          # Start production server
pnpm lint           # Run linter
pnpm lint:fix       # Fix linting issues
pnpm test           # Run tests
pnpm format:check   # Check code formatting
pnpm format:write   # Format code
```

### Database Management

**Create Migration:**
```bash
cd apps/backend
pnpm prisma migrate dev --name migration_name
```

**View Database:**
```bash
cd apps/backend
pnpm prisma studio
```

## API Documentation

### Backend REST API

#### GET /
Returns API status information.

**Response:**
```json
{
  "message": "Live Meeting API is running",
  "status": "ok"
}
```

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### POST /livekit/webhook
LiveKit webhook endpoint for session management.

**Request Body:**
```json
{
  "event": "room_started",
  "room": {
    "sid": "RM_abc123",
    "name": "my-room"
  }
}
```

**Supported Events:**
- `room_started` / `room_created` - Creates or activates a session
- `room_finished` / `room_ended` / `room_deleted` - Ends a session

**Response:**
- `204 No Content` - Success

**Behavior:**
- Creates/updates session record in database
- Associates `room.sid` as `meetingId`
- Links all subsequent egress streams to the session

### Frontend API Routes

#### GET /api/connection-details
Generates LiveKit access token for a participant.

**Query Parameters:**
- `roomName` (required) - Name of the room to join
- `participantName` (required) - Name of the participant
- `metadata` (optional) - Additional participant metadata
- `region` (optional) - LiveKit region for routing

**Response:**
```json
{
  "serverUrl": "ws://localhost:7880",
  "roomName": "my-room",
  "participantToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "participantName": "John Doe"
}
```

#### GET /api/record/start
Starts recording a room (composite egress).

**Query Parameters:**
- `roomName` (required) - Name of the room to record

**Response:**
- `200` - Recording started successfully
- `409` - Recording already in progress
- `403` - Missing roomName parameter
- `500` - Server error

**Requirements:**
- S3 storage configuration (bucket, credentials, endpoint e região)

#### GET /api/record/stop
Stops active recording for a room.

**Query Parameters:**
- `roomName` (required) - Name of the room to stop recording

**Response:**
- `200` - Recording stopped successfully
- `404` - No active recording found
- `403` - Missing roomName parameter
- `500` - Server error

### WebSocket APIs

#### Backend Socket.io Gateway
**Endpoint:** `ws://localhost:3001`

**Events:**
- `message` - Send/receive messages
  - Client sends: `string` message
  - Server broadcasts: `{ clientId: string, message: string }`
- `join-room` - Join a room
  - Client sends: `string` room name
  - Server emits to room: `user-joined` event
- `leave-room` - Leave a room
  - Client sends: `string` room name
  - Server emits to room: `user-left` event

#### Audio Egress WebSocket
**Endpoint:** `ws://localhost:3001/egress-audio`

**Query Parameters:**
- `roomName` - Room name (required)
- `participant` - Participant identity (optional)
- `trackId` - Track ID (optional)
- `sampleRate` - Audio sample rate in Hz (default: 48000)
- `channels` - Number of audio channels (default: 1)
- `meetingId` - Meeting identifier (optional, auto-resolved if not provided)
- `groupSeconds` - Override grouping time in seconds (optional)

**Protocol:**
- Binary frames: PCM audio data (s16le format)
- Text frames: JSON events (e.g., `{"muted": true}`)

**Processing:**
- Audio chunks are buffered in memory (default: 2 seconds)
- Aggregated blocks are flushed to the audio pipeline
- Each flush writes WAV data to disk and, quando configurado, encaminha o chunk para o serviço de análise em tempo real

**Output:**
- WAV files stored in the configured audio output directory (`<meetingId>/`)
- File naming: `<timestamp>_<room>_<participant>_<track>.wav`
- Pipeline logs: `storage/pipeline-logs/<meetingId>.log`
- Real-time prosody frames streamed to the configured analysis endpoint when enabled

#### Video Egress WebSocket
**Endpoint:** `ws://localhost:3001/egress-video`

**Query Parameters:**
- `roomName` - Room name (required)
- `participant` - Participant identity (optional)
- `trackId` - Track ID (optional)
- `codec` - Video codec: `h264` | `vp8` | `vp9` (required)
- `meetingId` - Meeting identifier (optional, auto-resolved if not provided)

**Protocol:**
- Binary frames: Encoded video bytestream (H.264 or VP8/VP9)

**Output:**
- Raw encoded files stored in the configured video output directory (`<meetingId>/`)
- File extensions: `.h264` (H.264) or `.ivf` (VP8/VP9)
- File naming: `<timestamp>_<room>_<participant>_<track>.<codec>`

## Audio Egress Integration

The backend provides a complete audio processing pipeline with buffering and AI integration.

### Starting Audio Egress

```typescript
import { EgressClient } from 'livekit-server-sdk';

const egress = new EgressClient('https://your-livekit-host', '<api-key>', '<api-secret>');

await egress.startTrackEgress({
  roomName: 'my-room',
  trackId: 'audio-track-id',
  websocketUrl: 'ws://localhost:3001/egress-audio?roomName=my-room&participant=user1&trackId=audio-track-id&sampleRate=48000&channels=1&meetingId=RM_123&groupSeconds=2'
});
```

### Processing Flow

1. **Egress Reception**: WebSocket receives PCM audio chunks (s16le) in real-time
2. **Buffering**: Audio Pipeline buffers chunks in memory (default: 2 seconds)
3. **Grouping**: When threshold is reached (time or size), aggregated block is flushed
4. **Processing**: Optional volume normalization when enabled
5. **Format Conversion**: Aggregated PCM is packaged as WAV before dispatch
6. **Dispatch**:
   - Streams a base64 WAV frame to the real-time prosody API when credentials are present
   - Appends a pipeline log entry and writes/updates the local WAV file on disk
7. **Cleanup**: Buffer is cleared after dispatch

### Query Parameters

- `roomName` (required) - LiveKit room name
- `participant` (optional) - Participant identity
- `trackId` (optional) - Audio track ID
- `sampleRate` (default: 48000) - Audio sample rate in Hz
- `channels` (default: 1) - Number of audio channels (1=mono, 2=stereo)
- `meetingId` (optional) - Meeting identifier (auto-resolved from active session if not provided)
- `groupSeconds` (optional) - Override default grouping time (seconds)

### Hume Integration

When the real-time analysis credentials are present, each active audio track opens a dedicated WebSocket connection to the analysis service:

**WebSocket Flow:**
- Sends the required authentication header (if provided)
- Pushes an initial configuration message enabling the `prosody` model
- Streams base64-encoded WAV frames generated by the audio pipeline
- Logs every flush locally (`storage/pipeline-logs/<meetingId>.log`) for troubleshooting
- Automatically recreates the WS client on connection drop or error

**Without analysis credentials:**
- The pipeline still buffers audio and writes WAV files locally
- Log entries note that streaming is skipped because the API key is missing

### Session Association

Audio streams are automatically associated with database sessions:
- If `meetingId` is provided in query params, it's used directly
- If not provided, the system looks up the active session by `roomName`
- Sessions are created/updated via LiveKit webhooks (`/livekit/webhook`)
- Files are organized by `meetingId` in the storage directory structure

## Security Considerations

**Current Implementation Notes:**
- Development API keys are used in the example configurations
- Recording endpoints do not include authentication (should be added for production)
- WebSocket endpoints accept connections from any origin in development
- E2EE passphrases are shared via URL hash (consider secure distribution methods)

**Production Recommendations:**
- Replace development API keys with secure keys
- Implement authentication (JWT) for all endpoints
- Add authorization checks for recording operations
- Configure CORS properly for production domains
- Use HTTPS/WSS for all connections
- Implement rate limiting
- Add input validation and sanitization
- Secure WebSocket endpoints with authentication

## Deployment

### Backend Deployment

1. Build the application:
```bash
cd apps/backend
pnpm build
```

2. Set production environment variables
3. Run database migrations:
```bash
pnpm prisma migrate deploy
```

4. Start the application:
```bash
pnpm start:prod
```

### Frontend Deployment

1. Build the application:
```bash
cd apps/meet
pnpm build
```

2. Set production environment variables
3. Start the application:
```bash
pnpm start
```

### LiveKit Server Deployment

For production, consider:
- Using LiveKit Cloud (managed service)
- Self-hosting with proper domain and TLS
- Configuring proper API keys
- Setting up proper firewall rules
- Using a reverse proxy (nginx, Caddy)

### Docker Deployment

The backend includes a `docker-compose.yml` for PostgreSQL. The LiveKit server also uses Docker. Consider orchestrating all services with Docker Compose for local development.

## Troubleshooting

### Common Issues

**Database Connection Errors:**
- Ensure PostgreSQL is running
- Confirme que o arquivo de configuração contém as credenciais corretas
- Verifique se as credenciais fornecidas são válidas

**LiveKit Connection Issues:**
- Verify LiveKit server is running (`curl http://localhost:7880`)
- Verifique a URL configurada para o servidor LiveKit na aplicação frontend
- Ensure API keys match between frontend and LiveKit server

**Audio Egress Not Working:**
- Check WebSocket endpoint is accessible
- Verifique se o diretório de saída de áudio existe e possui permissão de escrita
- Check LiveKit egress configuration

**CORS Errors:**
- Verify backend CORS configuration
- Check frontend URL matches allowed origins

## Project Structure

```
live-meeting/
├── apps/
│   ├── backend/          # NestJS backend application
│   ├── meet/             # Next.js frontend application
│   └── livekit/          # LiveKit server configuration
├── README.md             # This file
└── ...
```

## Contributing

1. Create a feature branch from `development`
2. Make your changes
3. Test thoroughly
4. Submit a pull request to `development`

## License

See individual component licenses. The frontend (apps/meet) includes its own LICENSE file.

## Additional Resources

- [LiveKit Documentation](https://docs.livekit.io/)
- [LiveKit Components](https://github.com/livekit/components-js)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

