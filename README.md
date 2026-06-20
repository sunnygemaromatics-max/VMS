# Enterprise VMS - Visitor Management System

A modern, full-stack enterprise Visitor Management System built with Next.js, NestJS, Prisma, and PostgreSQL. Features real-time headcount tracking, face recognition integration, contractor workforce management, and compliance logging.

## 🎯 Project Status

**Phase 1 (Infrastructure):** ✅ COMPLETE
- Turborepo monorepo structure
- PostgreSQL schema with Prisma ORM
- Docker environment setup
- Shared configs and packages

**Phase 2 (Web Dashboard):** 🔄 IN PROGRESS
- ✅ Next.js 14 app initialized with Tailwind CSS
- ✅ Glassmorphism UI components with Framer Motion
- ✅ Live Headcount Card (mocked data)
- ✅ Visitors Table with status tracking
- ✅ Compliance Status dashboard
- 📋 TODO: Authentication system
- 📋 TODO: Visitor check-in forms
- 📋 TODO: Contractor management pages

**Phase 3 (API):** 📋 PENDING
- NestJS REST API setup
- JWT authentication
- Visitor endpoints
- Gate entry logic with face recognition
- WebSocket real-time updates

**Phase 4+:** 📋 PLANNED
- Gate Scanner (Electron/Next.js)
- React Native Mobile App

---

## 🚀 Quick Start

### Prerequisites

- Node.js v20+
- npm v10+
- Docker & Docker Compose
- PostgreSQL 15 (via Docker)

### Installation

```bash
# Clone repository
cd /path/to/vms

# Install dependencies (all workspaces)
npm install

# Copy environment variables
cp .env.example .env.local

# Start Docker services (PostgreSQL + Redis)
docker-compose up -d

# Run Prisma migrations
npm run db:migrate

# Start development servers
npm run dev
```

The dashboard will be available at: **http://localhost:3000**

---

## 📁 Project Structure

```
/enterprise-vms
├── /apps
│   ├── /api                    # NestJS REST & WebSocket API (port 4000)
│   ├── /web                    # Next.js 14 Admin Dashboard (port 3000)
│   ├── /kiosk                  # Gate Scanner Kiosk (Next.js)
│   └── /mobile                 # React Native Mobile App (Expo)
├── /packages
│   ├── /database               # Prisma schema & migrations
│   ├── /ui                     # Shared ShadCN + Tailwind components
│   └── /config                 # Shared ESLint, TypeScript, Tailwind configs
├── docker-compose.yml          # Local development infrastructure
├── turbo.json                  # Turborepo configuration
└── package.json                # Monorepo root configuration
```

---

## 🎨 Dashboard Features (Phase 2)

### Live Occupancy Cards
- Real-time headcount with animated counters
- Glassmorphism design with Framer Motion
- Categories: Total, Visitors, Contractors, Employees
- Socket.io integration ready (currently mocked)

### Visitors Management
- Today's visitor list with status tracking
- Statuses: PENDING, APPROVED, CHECKED_IN, CHECKED_OUT, REJECTED
- Expected vs. actual arrival times
- Host assignment tracking

### Compliance Status
- Medical clearance verification
- Police verification tracking
- Document validity checks
- Color-coded status indicators

---

## 🗄️ Database Schema

### Core Models
- **Organization**: Multi-tenant support with branches
- **User**: Staff with roles (SUPER_ADMIN, ORG_ADMIN, HR_MANAGER, SECURITY_GUARD, etc.)
- **Visitor**: Guest tracking with document verification
- **Visit**: Visitor-to-host appointment tracking
- **Contractor**: Vendor/contractor company management
- **Worker**: Contractor staff with compliance tracking
- **Attendance**: Gate entry/exit logging with face recognition
- **Branch**: Organizational locations

### Key Features
- Composite indexes for real-time headcount queries
- Soft delete support (isActive flags)
- Cascading relationships for data integrity
- Face embedding storage for ML integration

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animation library
- **Socket.io Client** - Real-time updates
- **Lucide React** - Icon library

### Backend
- **NestJS** - Node.js framework (coming soon)
- **Express/Fastify** - HTTP server
- **Socket.io** - WebSocket server

### Database & ORM
- **PostgreSQL 15** - Primary database
- **Prisma** - Type-safe ORM
- **Redis 7** - Caching & real-time pub/sub

### DevOps
- **Docker & Docker Compose** - Containerization
- **Turborepo** - Monorepo management

---

## 📋 Key Files & Components

### Web App (`apps/web/`)
- **`src/app/page.tsx`** - Main dashboard
- **`src/components/dashboard/LiveHeadcountCard.tsx`** - Headcount animation component
- **`src/components/dashboard/VisitorsTable.tsx`** - Visitor list with status
- **`src/components/dashboard/ComplianceStatus.tsx`** - Compliance indicators
- **`tailwind.config.js`** - Tailwind configuration
- **`next.config.js`** - Next.js configuration

### Database (`packages/database/`)
- **`prisma/schema.prisma`** - Complete schema with all models
- **`prisma/migrations/`** - Database version history

### API (`apps/api/`)
- Coming in Phase 3!

---

## 🔌 Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/vms_db"

# Redis
REDIS_URL="redis://localhost:6379"

# API
API_PORT=4000
NODE_ENV=development

# JWT
JWT_SECRET="your_secret_key_here"

# ML Configuration
CONFIDENCE_THRESHOLD=0.85

# NextJS Public URLs
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

---

## 🚦 Development Workflow

### Available Scripts

```bash
# Development
npm run dev              # Start all apps in watch mode

# Building
npm run build            # Build all apps for production

# Database
npm run db:migrate       # Run Prisma migrations
npm run db:push          # Sync schema without migration
npm run db:studio        # Open Prisma Studio UI

# Linting & Type Checking
npm run lint             # Lint all workspaces
npm run type-check       # TypeScript type checking

# Docker
docker-compose up        # Start PostgreSQL + Redis
docker-compose down      # Stop services
```

### Workspace Commands

```bash
# Run command in specific app
npm --workspace=@vms/web run dev
npm --workspace=@vms/api run build

# Install dependency in specific app
npm install express --workspace=@vms/api
```

---

## 🔐 Security Considerations

- JWT tokens for API authentication
- Password hashing with bcryptjs
- Role-based access control (RBAC)
- Secure document storage (encrypted)
- Compliance audit logging
- Blacklist management for visitors

*Full security implementation in Phase 3*

---

## 🤖 Face Recognition Integration

The system is designed to integrate with face recognition ML models:

### Architecture
1. **Capture**: Camera at gate captures visitor/worker face
2. **Embedding**: Convert face image to vector embedding
3. **Comparison**: Compare against stored embeddings in database
4. **Verification**: Check compliance (medical, police) before access
5. **Logging**: Record check-in/out with timestamp

### Supported Models
- TensorFlow.js (browser/mobile)
- OpenCV (backend processing)
- Custom fine-tuned models

*Integration code in Phase 4*

---

## 📊 API Endpoints (Coming Phase 3)

### Authentication
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh JWT token

### Visitors
- `GET /visitors` - List all visitors
- `POST /visitors` - Create visitor record
- `GET /visits/:id` - Get visit details
- `PATCH /visits/:id/approve` - Approve visit
- `POST /qr/generate` - Generate QR code token

### Gate Entry
- `POST /gate/face-entry` - Face recognition entry
- `POST /gate/check-out` - Mark check-out

### Real-Time (WebSocket)
- `headcount_update` - Live occupancy update
- `visitor_status_change` - Visitor status change
- `compliance_alert` - Compliance issue alert

---

## 🎓 Learning Path

This project is structured for learning full-stack development:

1. **Phase 1**: Monorepo patterns, database design, Docker
2. **Phase 2**: React components, Tailwind CSS, animations, Next.js
3. **Phase 3**: REST API design, NestJS, WebSockets, authentication
4. **Phase 4**: Specialized apps, ML integration, native mobile

Each phase builds on previous concepts with increasing complexity.

---

## 🤝 Contributing

This is an enterprise application. Follow the established patterns:

- Use TypeScript for type safety
- Follow component structure in `/components`
- Write database changes as Prisma migrations
- Test builds before committing

---

## 📝 License

Internal enterprise application. All rights reserved.

---

## 👥 Support

For questions or issues:
1. Check the `/packages` folder for shared config/component docs
2. Review Prisma schema for database structure
3. Check component examples in `/components`

---

**Last Updated**: 2025-05-22  
**Current Phase**: 2 (Web Dashboard)  
**Next Milestone**: API authentication system
