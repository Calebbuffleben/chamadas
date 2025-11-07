# Live Meeting - Video Conferencing System

A comprehensive video conferencing solution built with LiveKit, Next.js, and NestJS. This system provides real-time audio/video communication, room management, recording capabilities, and audio egress processing.

## System Overview

This is a monorepo containing three main applications:

1. **Backend API** (`apps/backend`) - NestJS backend with WebSocket support, database management, and audio egress processing
2. **Frontend Application** (`apps/meet`) - Next.js video conferencing client built with LiveKit Components
3. **LiveKit Server** (`apps/livekit`) - LiveKit media server for WebRTC communication

## Architecture

```
┌─────────────────┐
│  Next.js Client │ (apps/meet)
│  Port: 3000     │
└────────┬────────┘
         │
         │ HTTP/WebSocket
         │
    ┌────┴──────────────────────────┐
    │                               │
┌───▼──────────┐          ┌─────────▼────────┐
│ LiveKit      │          │ NestJS Backend   │
│ Server       │◄─────────┤ Port: 3001       │
│ Port: 7880   │ WebSocket│                  │
│              │          │                  │
│  Track Egress│─────────►│  Egress WS       │
│  (Audio/Video)│         │  Receivers       │
└──────────────┘          └─────────┬────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
         ┌──────────▼──────┐  ┌─────▼──────┐  ┌────▼──────┐
         │  PostgreSQL     │  │  Audio     │  │  Imentiv  │
         │  Port: 5432     │  │  Pipeline  │  │  HTTP API │
         │  (Sessions)     │  │  (Buffer)  │  │           │
         └─────────────────┘  └────────────┘  └───────────┘
```

### Audio Processing Flow

```
LiveKit Track Egress (PCM s16le)
         │
         │ WebSocket
         ▼
┌────────────────────┐
│  Egress Receiver   │
│  (/egress-audio)   │
└─────────┬──────────┘
          │
          │ Chunks (real-time)
          ▼
┌────────────────────┐
│  Audio Pipeline    │
│  - Buffer (1-2s)   │
│  - Group chunks    │
│  - Normalize (opt) │
└─────────┬──────────┘
          │
          │ Aggregated blocks
          ├──────────────────┐
          │                  │
          ▼                  ▼
┌─────────────────┐  ┌──────────────┐
│  WAV Files      │  │  Imentiv API │
│  (Storage)      │  │  (HTTP POST) │
└─────────────────┘  └──────────────┘
```

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
- **Imentiv Integration** - HTTP dispatch of processed audio blocks to external AI service
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
   - Optional volume normalization
   - Automatic flush when threshold is reached or connection closes

3. **Imentiv Integration**:
   - HTTP POST dispatch of aggregated audio blocks
   - Supports PCM or WAV format
   - Configurable retry logic (3 attempts with backoff)
   - Headers: `X-Meeting-Id`, `X-Participant-Id`, `X-Track-Id`
   - Query params: `meetingId`, `participant`, `track`, `sr`, `ch`

4. **Output Storage**:
   - WAV files stored in `EGRESS_AUDIO_OUTPUT_DIR/<meetingId>/`
   - Pipeline logs in `storage/pipeline-logs/<meetingId>.log`

**Video Egress:**
- WebSocket endpoint (`/egress-video`) receives encoded video streams (H.264/VP8/VP9)
- Stores raw encoded bytestreams (`.h264` or `.ivf`) in `EGRESS_VIDEO_OUTPUT_DIR/<meetingId>/`
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
- API keys for token generation (development: `devkey` / `devsecret12345678901234567890`)

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

### Backend Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/live_meeting?schema=public"

# Server
PORT=3001

# Media Egress Receivers
# Directories to store media egress outputs
EGRESS_AUDIO_OUTPUT_DIR=./storage/egress/audio
EGRESS_VIDEO_OUTPUT_DIR=./storage/egress/video

# Audio Pipeline / Imentiv
# Grouping in seconds (default 2)
AUDIO_PIPELINE_GROUP_SECONDS=2
# Payload format: pcm | wav
AUDIO_PIPELINE_PAYLOAD=pcm
# Normalize volume before sending (true|false)
AUDIO_PIPELINE_NORMALIZE=false
# HTTP timeout for dispatch (ms)
AUDIO_PIPELINE_TIMEOUT_MS=5000
# Imentiv HTTP ingest endpoint
IMENTIV_ENDPOINT_URL=
# Optional bearer token
IMENTIV_API_KEY=

# Node Environment
NODE_ENV=development
```

### Frontend Environment Variables

```env
# LiveKit Server
LIVEKIT_URL=ws://localhost:7880

# API Credentials (must match LiveKit server)
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret12345678901234567890

# API Endpoint
NEXT_PUBLIC_CONN_DETAILS_ENDPOINT=/api/connection-details

# Token TTL
LIVEKIT_TOKEN_TTL=10m

# Features
NEXT_PUBLIC_ENABLE_TEST_PANELS=true
```

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
- S3 configuration for storage (S3_KEY_ID, S3_KEY_SECRET, S3_BUCKET, S3_ENDPOINT, S3_REGION)

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
- Aggregated blocks are flushed to pipeline
- Dual output: WAV files + HTTP dispatch to Imentiv (if configured)

**Output:**
- WAV files stored in `EGRESS_AUDIO_OUTPUT_DIR/<meetingId>/`
- File naming: `<timestamp>_<room>_<participant>_<track>.wav`
- Pipeline logs: `storage/pipeline-logs/<meetingId>.log`

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
- Raw encoded files stored in `EGRESS_VIDEO_OUTPUT_DIR/<meetingId>/`
- File extensions: `.h264` (H.264) or `.ivf` (VP8/VP9)
- File naming: `<timestamp>_<room>_<participant>_<track>.<codec>`

## Audio Egress Integration

The backend provides a complete audio processing pipeline with buffering and AI integration.

### Starting Audio Egress

```typescript
import { EgressClient } from 'livekit-server-sdk';

const egress = new EgressClient(
  'https://your-livekit-host',
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

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
4. **Processing**: Optional volume normalization if `AUDIO_PIPELINE_NORMALIZE=true`
5. **Format Conversion**: Optional WAV packaging if `AUDIO_PIPELINE_PAYLOAD=wav`
6. **Dual Output**:
   - **WAV Files**: Saved to `EGRESS_AUDIO_OUTPUT_DIR/<meetingId>/<filename>.wav`
   - **Imentiv API**: HTTP POST to `IMENTIV_ENDPOINT_URL` with aggregated block
7. **Cleanup**: Buffer is cleared after dispatch

### Query Parameters

- `roomName` (required) - LiveKit room name
- `participant` (optional) - Participant identity
- `trackId` (optional) - Audio track ID
- `sampleRate` (default: 48000) - Audio sample rate in Hz
- `channels` (default: 1) - Number of audio channels (1=mono, 2=stereo)
- `meetingId` (optional) - Meeting identifier (auto-resolved from active session if not provided)
- `groupSeconds` (optional) - Override default grouping time (seconds)

### Imentiv Integration

When `IMENTIV_ENDPOINT_URL` is configured, the pipeline automatically dispatches audio blocks:

**HTTP Request:**
- Method: `POST`
- URL: `{IMENTIV_ENDPOINT_URL}?meetingId={id}&participant={id}&track={id}&sr={rate}&ch={channels}`
- Headers:
  - `Content-Type`: `audio/L16; rate={rate}; channels={channels}` (PCM) or `audio/wav` (WAV)
  - `X-Meeting-Id`: Meeting identifier
  - `X-Participant-Id`: Participant identity
  - `X-Track-Id`: Track identifier
  - `Authorization`: `Bearer {IMENTIV_API_KEY}` (if provided)
- Body: Aggregated audio block (PCM or WAV)
- Retry: 3 attempts with exponential backoff
- Timeout: Configurable via `AUDIO_PIPELINE_TIMEOUT_MS`

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
- Check DATABASE_URL in .env
- Verify database credentials

**LiveKit Connection Issues:**
- Verify LiveKit server is running (`curl http://localhost:7880`)
- Check LIVEKIT_URL in frontend .env.local
- Ensure API keys match between frontend and LiveKit server

**Audio Egress Not Working:**
- Check WebSocket endpoint is accessible
- Verify AUDIO_EGRESS_OUTPUT_DIR exists and is writable
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

