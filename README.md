# Attendance System - Meetings

A modern system for managing attendance in corporate meetings, built with Next.js, Clerk, and Prisma.

## 🚀 Features

- **Authentication & Authorization**
  - Secure login with Clerk
  - Multi-organization support
  - Organization-based permission management

- **Meeting Management**
  - Create and schedule meetings
  - Real-time attendance tracking
  - Organization-specific meeting history
  - Participation reports

- **Modern Interface**
  - Responsive design with Tailwind CSS
  - Interactive components
  - Real-time visual feedback
  - Light/dark theme support

- **Security**
  - Rate limiting middleware
  - Security headers
  - Protection against common attacks
  - Data validation

## 🛠️ Technologies

- **Frontend**
  - Next.js 14 (App Router)
  - React 18
  - Tailwind CSS
  - Clerk (Authentication)

- **Backend**
  - Next.js API Routes
  - Prisma (ORM)
  - PostgreSQL
  - WebSocket (Real-time)

- **DevOps**
  - TypeScript
  - ESLint
  - Prettier
  - Husky (Git Hooks)

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL
- Clerk Account
- Zoom Account (optional)

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/chamadas.git
cd chamadas
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure the following variables in `.env`:
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=

# Zoom (optional)
ZOOM_API_KEY=
ZOOM_API_SECRET=
```

5. Run database migrations:
```bash
npx prisma migrate dev
```

6. Start the development server:
```bash
npm run dev
```

## 🏗️ Project Structure

```
src/
├── app/                    # Application routes (App Router)
│   ├── [orgId]/           # Organization-specific routes
│   │   └── dashboard/     # Main dashboard
│   ├── api/               # API Routes
│   └── select-org/        # Organization selection page
├── components/            # Reusable React components
├── lib/                   # Utilities and configurations
│   ├── prisma.ts         # Prisma client
│   ├── zoom.ts           # Zoom integration
│   └── socket.ts         # WebSocket configuration
└── middleware.ts         # Global middleware
```

## 🔐 Security

The project implements multiple security layers:

- Rate limiting to prevent abuse
- Security headers (HSTS, CSP, etc.)
- Input data validation
- CSRF and XSS protection
- JWT-based authentication
- Input sanitization

## 📈 Performance

- API response caching
- Image optimization
- Component lazy loading
- Asset compression
- Database indexing

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email your-email@example.com or open an issue on GitHub.
