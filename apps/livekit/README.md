# LiveKit (local)

Este diretório contém a configuração mínima para rodar o LiveKit Server em desenvolvimento usando Docker.

## Pré‑requisitos
- Docker Desktop instalado e em execução

## Arquivos
- `docker-compose.yml`: sobe o contêiner `livekit/livekit-server`
- `livekit.yaml`: configuração do servidor (portas, chaves, etc.)
- `env.example`: exemplo de variáveis para clientes gerarem tokens

## Portas
- 7880: HTTP/WebSocket (sinalização)
- 7881: WebRTC sobre TCP (fallback)
- 50000-60000/UDP: mídia WebRTC

## Como rodar
1. No diretório `apps/livekit`:
   ```bash
   docker compose up -d
   ```
2. Verifique se está no ar:
   ```bash
   curl http://localhost:7880
   ```

## Chaves de API (dev)
O arquivo `livekit.yaml` inclui credenciais de exemplo. Substitua-as antes de qualquer uso público e mantenha frontend/backend sincronizados com os mesmos valores.

## Geração de token (resumo)
- Clientes precisam de um token JWT assinado com a chave secreta configurada.
- O token inclui identity, roomName e permissões (join/publish/subscribe).
- Gere esse token no backend da sua aplicação e entregue ao cliente.

## Parar/Logs
```bash
# parar
docker compose down
# logs
docker compose logs -f livekit
```

## Observações
- Em redes corporativas, abra/permita as portas UDP 50000‑60000 ou o fallback TCP (7881) será usado.
- Para produção: use domínio público, TLS e chaves não versionadas.

## Integração com os outros apps
- As chaves `devkey/devsecret` precisam estar sincronizadas com o backend (`apps/backend/env`) e com o frontend (`apps/meet/.env.local`).
- Para que o backend dispare o Track Egress automaticamente, configure a URL base de egress apontando para este backend a partir do contêiner (ex.: `ws://host.docker.internal:3001`).
- Configure o webhook no `livekit.yaml` apontando para `http://host.docker.internal:3001/livekit/webhook` para registrar sessões e acompanhar track publish.

