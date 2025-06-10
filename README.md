# Sistema de Presença - Reuniões

Um sistema moderno para gerenciamento de presença em reuniões corporativas, construído com Next.js, Clerk, e Prisma.

## 🚀 Funcionalidades

- **Autenticação e Autorização**
  - Login seguro com Clerk
  - Suporte a múltiplas organizações
  - Gerenciamento de permissões por organização

- **Gestão de Reuniões**
  - Criação e agendamento de reuniões
  - Registro de presença em tempo real
  - Histórico de reuniões por organização
  - Relatórios de participação

- **Interface Moderna**
  - Design responsivo com Tailwind CSS
  - Componentes interativos
  - Feedback visual em tempo real
  - Suporte a temas claro/escuro

- **Segurança**
  - Middleware de rate limiting
  - Headers de segurança
  - Proteção contra ataques comuns
  - Validação de dados

## 🛠️ Tecnologias

- **Frontend**
  - Next.js 14 (App Router)
  - React 18
  - Tailwind CSS
  - Clerk (Autenticação)

- **Backend**
  - Next.js API Routes
  - Prisma (ORM)
  - PostgreSQL
  - WebSocket (Tempo real)

- **DevOps**
  - TypeScript
  - ESLint
  - Prettier
  - Husky (Git Hooks)

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL
- Conta no Clerk
- Conta no Zoom (opcional)

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/chamadas.git
cd chamadas
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Configure as seguintes variáveis no arquivo `.env`:
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=

# Zoom (opcional)
ZOOM_API_KEY=
ZOOM_API_SECRET=
```

5. Execute as migrações do banco de dados:
```bash
npx prisma migrate dev
```

6. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## 🏗️ Estrutura do Projeto

```
src/
├── app/                    # Rotas da aplicação (App Router)
│   ├── [orgId]/           # Rotas específicas por organização
│   │   └── dashboard/     # Dashboard principal
│   ├── api/               # API Routes
│   └── select-org/        # Página de seleção de organização
├── components/            # Componentes React reutilizáveis
├── lib/                   # Utilitários e configurações
│   ├── prisma.ts         # Cliente Prisma
│   ├── zoom.ts           # Integração com Zoom
│   └── socket.ts         # Configuração WebSocket
└── middleware.ts         # Middleware global
```

## 🔐 Segurança

O projeto implementa várias camadas de segurança:

- Rate limiting para prevenir abusos
- Headers de segurança (HSTS, CSP, etc.)
- Validação de dados em todas as entradas
- Proteção contra CSRF e XSS
- Autenticação baseada em JWT
- Sanitização de inputs

## 📈 Performance

- Caching de respostas da API
- Otimização de imagens
- Lazy loading de componentes
- Compressão de assets
- Indexação do banco de dados

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte, envie um email para seu-email@exemplo.com ou abra uma issue no GitHub.
