# Backend API

Backend construído com Nest.js, Prisma e Socket.io para comunicação em tempo real.

## Tecnologias

- **Nest.js** - Framework Node.js modular e escalável
- **Prisma** - ORM moderno e type-safe
- **Socket.io** - WebSocket para comunicação em tempo real
- **TypeScript** - Tipagem estática

## Estrutura do Projeto

```
src/
├── config/          # Módulo de configuração
├── prisma/          # Serviço e módulo do Prisma
├── websocket/       # Gateway e módulo do Socket.io
├── app.module.ts    # Módulo principal
├── app.controller.ts # Controller principal
└── main.ts          # Ponto de entrada da aplicação
```

## Instalação

1. Instale as dependências:
```bash
pnpm install
```

2. Configure as variáveis de ambiente:
```bash
cp env.example .env
```

O arquivo `.env` já está configurado com as credenciais padrão.

3. Configure o banco de dados PostgreSQL:

**Opção A - Sem Docker (ambiente local):**
```bash
# Certifique-se de que o PostgreSQL está instalado e rodando
# macOS: brew services start postgresql@16
# Linux: sudo systemctl start postgresql

# Execute o script de setup
./setup-database.sh
```

**Opção B - Com Docker:**
```bash
docker-compose up -d
```

4. Configure o Prisma:
```bash
# Gerar o cliente Prisma
pnpm prisma:generate

# Criar e aplicar as migrações
pnpm prisma:migrate
```

## Executando a aplicação

### Desenvolvimento
```bash
pnpm start:dev
```

### Produção
```bash
pnpm build
pnpm start:prod
```

## Banco de Dados

### Configuração Local (sem Docker)

O projeto inclui um script `setup-database.sh` para configurar o PostgreSQL localmente.

**Pré-requisitos:**
- PostgreSQL instalado (macOS: `brew install postgresql@16`)
- PostgreSQL rodando (macOS: `brew services start postgresql@16`)

**Executar o setup:**
```bash
./setup-database.sh
```

Este script irá:
- Criar o usuário `user` com senha `password`
- Criar o banco de dados `live_meeting`
- Configurar as permissões necessárias

### Configuração com Docker

O projeto também inclui um `docker-compose.yml` para executar o PostgreSQL em container.

**Iniciar o banco de dados:**
```bash
docker-compose up -d
```

**Parar o banco de dados:**
```bash
docker-compose down
```

**Parar e remover volumes (apaga os dados):**
```bash
docker-compose down -v
```

**Ver logs do banco:**
```bash
docker-compose logs -f postgres
```

## Scripts disponíveis

- `pnpm start:dev` - Inicia em modo desenvolvimento com watch
- `pnpm build` - Compila o projeto
- `pnpm start:prod` - Inicia em modo produção
- `pnpm test` - Executa os testes
- `pnpm lint` - Executa o linter
- `pnpm prisma:generate` - Gera o cliente Prisma
- `pnpm prisma:migrate` - Cria e aplica migrações
- `pnpm prisma:studio` - Abre o Prisma Studio

## WebSocket

O WebSocket está configurado e disponível em `ws://localhost:3001`. O gateway está configurado para aceitar conexões de qualquer origem em desenvolvimento.

### Eventos disponíveis:

- `message` - Envia e recebe mensagens
- `join-room` - Entra em uma sala
- `leave-room` - Sai de uma sala

## Egress de Mídia (recepção)

Este backend expõe endpoints WebSocket para receber Egress de Áudio e Vídeo do LiveKit (Track Egress → WebSocket), com processamento interno via pipeline de áudio e integração com serviços externos.

### Áudio Egress com Pipeline Interna

**Endpoint:** `ws://localhost:3001/egress-audio`

**Query params suportados:**
- `roomName` (obrigatório) - Nome da sala LiveKit
- `participant` (opcional) - Identidade do participante
- `trackId` (opcional) - ID do track de áudio
- `sampleRate` (padrão: 48000) - Taxa de amostragem em Hz
- `channels` (padrão: 1) - Número de canais (1=mono, 2=estéreo)
- `meetingId` (opcional) - ID da reunião (resolvido automaticamente se não fornecido)
- `groupSeconds` (opcional) - Override do tempo de agrupamento em segundos

**Fluxo de processamento:**

1. **Recepção**: WebSocket recebe chunks PCM (s16le) em tempo real
2. **Buffer**: Pipeline interna agrupa chunks em memória (padrão: 2 segundos)
3. **Flush**: Quando atinge threshold (tempo ou tamanho), bloqueia é enviado
4. **Processamento**: Normalização de volume opcional
5. **Formato**: Conversão opcional para WAV (com header)
6. **Saída dupla**:
   - **Arquivos WAV**: Salvos em `EGRESS_AUDIO_OUTPUT_DIR/<meetingId>/`
   - **Imentiv API**: HTTP POST para `IMENTIV_ENDPOINT_URL` (se configurado)

**Logs de pipeline:**
- Arquivos de log em `storage/pipeline-logs/<meetingId>.log`
- Registra cada flush com timestamp, tamanho e metadados

### Variáveis de ambiente (mídia e pipeline)

```env
# Diretórios de saída
EGRESS_AUDIO_OUTPUT_DIR=./storage/egress/audio
EGRESS_VIDEO_OUTPUT_DIR=./storage/egress/video

# Pipeline de áudio
AUDIO_PIPELINE_GROUP_SECONDS=2          # Tempo de agrupamento (segundos)
AUDIO_PIPELINE_PAYLOAD=pcm              # Formato: pcm | wav
AUDIO_PIPELINE_NORMALIZE=false          # Normalizar volume: true | false
AUDIO_PIPELINE_TIMEOUT_MS=5000          # Timeout HTTP (ms)

# Integração Imentiv
IMENTIV_ENDPOINT_URL=                   # URL do endpoint HTTP (ex: http://api.imentiv.com/ingest)
IMENTIV_API_KEY=                        # Token Bearer (opcional)
```

### Como iniciar o Track Egress (exemplo)

Do lado do servidor LiveKit (ou de um serviço seu), inicie um Track Egress com saída WebSocket apontando para este backend:

```ts
import { EgressClient } from 'livekit-server-sdk';

const egress = new EgressClient(
  'https://<SEU_LIVEKIT_HOST>',
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

await egress.startTrackEgress({
  roomName: 'my-room',
  trackId: 'audio-track-id',
  websocketUrl: 'ws://localhost:3001/egress-audio?roomName=my-room&participant=user1&trackId=audio-track-id&sampleRate=48000&channels=1&meetingId=RM_123&groupSeconds=2'
});
```

**Notas:**
- O LiveKit enviará frames binários (PCM s16le) e frames texto JSON com eventos (ex.: `{ "muted": true }`)
- Quando `muted`, o servidor pausa a gravação
- O `meetingId` pode ser omitido se a sessão já existir no banco (resolvido por `roomName`)
- O `groupSeconds` permite override do tempo de agrupamento por chamada
- Este endpoint é apenas para desenvolvimento; adicione autenticação/assinatura de URL antes de expor publicamente

### Integração Imentiv

Quando `IMENTIV_ENDPOINT_URL` está configurado, o pipeline automaticamente envia blocos de áudio agregados:

**Requisição HTTP:**
- Método: `POST`
- URL: `{IMENTIV_ENDPOINT_URL}?meetingId={id}&participant={id}&track={id}&sr={rate}&ch={channels}`
- Headers:
  - `Content-Type`: `audio/L16; rate={rate}; channels={channels}` (PCM) ou `audio/wav` (WAV)
  - `X-Meeting-Id`: ID da reunião
  - `X-Participant-Id`: Identidade do participante
  - `X-Track-Id`: ID do track
  - `Authorization`: `Bearer {IMENTIV_API_KEY}` (se fornecido)
- Body: Bloco de áudio agregado (PCM ou WAV)
- Retry: 3 tentativas com backoff exponencial
- Timeout: Configurável via `AUDIO_PIPELINE_TIMEOUT_MS`

**Se `IMENTIV_ENDPOINT_URL` não estiver configurado:**
- O pipeline continua funcionando normalmente
- Apenas grava os arquivos WAV
- Loga um aviso no console

### Vídeo Egress (bytestream codificado)

**Endpoint:** `ws://localhost:3001/egress-video`

**Query params suportados:**
- `roomName` (obrigatório) - Nome da sala LiveKit
- `participant` (opcional) - Identidade do participante
- `trackId` (opcional) - ID do track de vídeo
- `codec` (obrigatório) - `h264` | `vp8` | `vp9` (define a extensão do arquivo)
- `meetingId` (opcional) - ID da reunião (resolvido automaticamente se não fornecido)

**Saída:**
- Arquivos `.h264` ou `.ivf` em `EGRESS_VIDEO_OUTPUT_DIR/<meetingId>/`
- Estrutura de diretórios organizada por `meetingId`

> **Observação:** O servidor grava o bytestream codificado sem empacotamento (sem MP4/WebM). Para playback, use ferramentas de linha de comando (ex.: ffmpeg) para empacotar.

### Como iniciar o Track Egress de vídeo (exemplo)

```ts
import { EgressClient } from 'livekit-server-sdk';

await egress.startTrackEgress({
  roomName: '<roomName>',
  trackId: '<videoTrackId>',
  websocketUrl: 'ws://localhost:3001/egress-video?roomName=<roomName>&participant=<identity>&trackId=<videoTrackId>&codec=h264',
});
```

## Gerenciamento de Sessões

O backend gerencia automaticamente sessões de reunião através de webhooks do LiveKit.

### Webhook Endpoint

**Endpoint:** `POST /livekit/webhook`

**Eventos suportados:**
- `room_started` / `room_created` - Cria ou ativa uma sessão
- `room_finished` / `room_ended` / `room_deleted` - Encerra uma sessão

**Modelo de Sessão:**
```typescript
{
  id: string;              // UUID
  meetingId: string;       // Identificador único (recomendado: room.sid)
  roomName: string;        // Nome da sala LiveKit
  roomSid: string | null;  // SID da sala (se disponível)
  status: 'ACTIVE' | 'ENDED';
  startedAt: Date;
  endedAt: Date | null;
}
```

**Associação automática:**
- Egress streams são automaticamente associados a sessões via `meetingId`
- Se `meetingId` não for fornecido na query, o sistema busca sessão ativa por `roomName`
- Arquivos são organizados por `meetingId` nas estruturas de diretório

### Configuração do Webhook no LiveKit

Configure o LiveKit para enviar webhooks para este backend:

```yaml
# livekit.yaml
webhook:
  urls:
    - http://localhost:3001/livekit/webhook
  api_key: devkey
  api_secret: devsecret12345678901234567890
```

## API REST

- `GET /` - Status da API
- `GET /health` - Health check
- `POST /livekit/webhook` - Webhook do LiveKit para gerenciamento de sessões

## Estrutura de Armazenamento

```
storage/
├── egress/
│   ├── audio/
│   │   └── <meetingId>/
│   │       └── <timestamp>_<room>_<participant>_<track>.wav
│   └── video/
│       └── <meetingId>/
│           └── <timestamp>_<room>_<participant>_<track>.<codec>
├── pipeline-logs/
│   └── <meetingId>.log
└── ...
```

## Próximos passos

- [x] Pipeline de áudio interna com buffer
- [x] Integração com Imentiv (HTTP dispatch)
- [x] Gerenciamento de sessões via webhook
- [x] Associação automática de streams com sessões
- [ ] Adicionar autenticação (JWT) para endpoints
- [ ] Implementar validação de dados mais robusta
- [ ] Adicionar testes automatizados
- [ ] Suporte a compressão Opus opcional

