# Live Meeting Frontend

Aplicativo Next.js 15 (App Router) que entrega a interface web do sistema Live Meeting. A UI é construída sobre [LiveKit Components](https://github.com/livekit/components-js) e conversa diretamente com o backend Nest (`apps/backend`) para orquestrar reuniões, gravações e track egress.

## Principais recursos

- Tela de pre-join com seleção de câmera/microfone, verificação de rede e preview.
- Sala `rooms/[roomName]` baseada em LiveKit Components com grade dinâmica, chat, indicadores de gravação e controles de layout.
- Página `custom/` para conectar-se a instâncias LiveKit externas utilizando as mesmas ferramentas da UI principal.
- Hooks auxiliares (`useSetupE2EE`, `usePerfomanceOptimiser`) para habilitar E2EE e otimizações de performance.
- APIs internas (`/api/connection-details`, `/api/record/start`, `/api/record/stop`) que emitem tokens JWT e controlam o Composite Egress do LiveKit.
- Integração visual com o backend: os estados de gravação e indicadores refletem o egress acionado automaticamente pelo Nest quando novos tracks são publicados.

## Arquitetura

```
apps/meet/
├── app/
│   ├── layout.tsx                 # Shell global (theme + providers LiveKit)
│   ├── page.tsx                   # Landing com abas (Demo x Custom)
│   ├── custom/page.tsx            # Fluxo para endpoints LiveKit externos
│   ├── rooms/[roomName]/          # Sala dinâmica + componentes client-only
│   └── api/
│       ├── connection-details/    # Geração de tokens LiveKit
│       └── record/
│           ├── start/route.ts     # Inicia composite egress (S3)
│           └── stop/route.ts      # Encerra composite egress
├── lib/                           # Helpers compartilhados (URL resolver, hooks)
├── public/                        # Assets e ícones
└── styles/                        # Estilos globais e modulares
```

Fluxo padrão:
1. O usuário acessa `/` e cria/entra em uma sala.
2. `/api/connection-details` gera um token LiveKit JWT utilizando as credenciais configuradas no backend.
3. O cliente LiveKit conecta-se diretamente ao servidor LiveKit definido na configuração.
4. Ao publicar áudio, o backend Nest (via webhooks) dispara automaticamente o Track Egress → pipeline de áudio → Hume.
5. O frontend exibe indicadores de gravação e permite iniciar/parar `Room Composite Egress` via `/api/record`.

## Setup de desenvolvimento

1. Instale as dependências:
   ```bash
   pnpm install
   ```
2. Copie o arquivo de exemplo de variáveis e ajuste:
   ```bash
   cp env.local.example .env.local
   ```
3. Preencha os valores seguindo o modelo: garanta que a URL do servidor LiveKit e as credenciais fornecidas estejam alinhadas com o backend e, se necessário, configure o bloco de S3 para gravações compostas.
4. Inicie o servidor Next:
   ```bash
   pnpm dev
   ```
5. Acesse `http://localhost:3000`.

## Variáveis de ambiente

Os valores sensíveis residem em `.env.local`. Utilize `apps/meet/env.local.example` como referência e ajuste conforme o ambiente (URLs, credenciais, opções de gravação, flags de debug).

## Scripts úteis

- `pnpm dev` – servidor Next.js em modo desenvolvimento.
- `pnpm build` – build de produção.
- `pnpm start` – executa a versão compilada.
- `pnpm lint` – validação ESLint.
- `pnpm test` – testes (quando adicionados).
