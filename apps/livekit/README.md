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
O arquivo `livekit.yaml` vem com chaves de exemplo:
```yaml
keys:
  devkey: devsecret
```
Troque por chaves próprias antes de uso público. Para clientes (frontend/backend) gere tokens usando a mesma dupla `API_KEY`/`API_SECRET`.

## Geração de token (resumo)
- Clientes precisam de um token JWT assinado com `API_SECRET`.
- O token inclui identity, roomName, e permissões (join/publish/subscribe).
- Gere esse token no backend da sua aplicação e entregue ao cliente.

> Dica: salve `LIVEKIT_WS_URL=ws://localhost:7880`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` a partir do `env.example` para usar no seu gerador de tokens.

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

