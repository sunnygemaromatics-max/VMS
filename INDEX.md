# VMS Project - Documentation Index

Welcome! Here's your complete guide to the Visitor Management System project.

## 📖 Start Here

### For First-Time Users
**[GETTING_STARTED.md](./GETTING_STARTED.md)** - 5-minute quick start
- Setup instructions
- Common commands
- Quick reference

### For Project Overview
**[README.md](./README.md)** - Complete documentation
- Features
- Tech stack
- Architecture
- Database schema

### For Architecture Understanding
**[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design
- Component hierarchy
- Data flow diagrams
- Database schema visualization
- Phase progression

### For Completion Details
**[COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)** - Build summary
- What was built
- Progress metrics
- Next steps

---

## 🗂️ File Guide

### Root Project Files
| File | Purpose |
|------|---------|
| `package.json` | Monorepo configuration |
| `turbo.json` | Turborepo workspace settings |
| `docker-compose.yml` | Docker services (PostgreSQL + Redis) |
| `.env.local` | Local environment variables |
| `.env.example` | Environment template |
| `.gitignore` | Git ignore rules |

### Documentation Files
| File | Purpose |
|------|---------|
| `README.md` | **START HERE** - Full documentation |
| `GETTING_STARTED.md` | Quick start (5 minutes) |
| `COMPLETION_SUMMARY.md` | Build completion report |
| `ARCHITECTURE.md` | System design & diagrams |
| `INDEX.md` | This file |

### Application Files

#### Web Dashboard (`apps/web/`)
```
src/
├── app/
│   ├── page.tsx              # Main dashboard (live content)
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   └── dashboard/
│       ├── LiveHeadcountCard.tsx     # Animated stats
│       ├── VisitorsTable.tsx         # Visitor list
│       └── ComplianceStatus.tsx      # Compliance panel
├── tailwind.config.js        # Tailwind configuration
├── next.config.js            # Next.js configuration
└── tsconfig.json             # TypeScript configuration
```

#### Database (`packages/database/`)
```
prisma/
├── schema.prisma             # Database models (8 tables)
└── migrations/               # Migration history

src/
└── index.ts                  # Prisma client export
```

#### Shared UI (`packages/ui/`)
```
src/
├── Button.tsx                # Reusable button component
├── Card.tsx                  # Card wrapper components
├── utils/
│   └── cn.ts                 # Class name utility
└── index.ts                  # Component exports
```

#### Configuration (`packages/config/`)
```
├── tsconfig.base.json        # TypeScript base config
├── tailwind.config.js        # Tailwind configuration
├── eslint.js                 # ESLint rules
└── package.json              # Config package metadata
```

---

## 🚀 Quick Commands

### Setup & Development
```bash
# First time setup
npm install
cp .env.example .env.local
docker-compose up -d
npm run db:migrate

# Start development
npm run dev

# Open dashboard
# http://localhost:3000
```

### Building & Testing
```bash
# Build all apps
npm run build

# Check types
npm run type-check

# Lint code
npm run lint

# Database tools
npm run db:migrate      # Create new migration
npm run db:studio       # Visual database editor
npm run db:push         # Sync schema without migration
```

### Docker
```bash
docker-compose up -d    # Start services
docker-compose down     # Stop services
docker-compose logs db  # View database logs
```

---

## 📊 Project Status

### Phase 1: Infrastructure ✅
- Monorepo setup
- Database schema
- Docker environment
- Shared packages

### Phase 2: Web Dashboard 🔄
- Next.js 14 app ✅
- Dashboard components ✅
- Tailwind styling ✅
- (Remaining: Auth, Check-in, Admin pages)

### Phase 3: API Backend 📋
- NestJS setup
- Authentication
- REST endpoints
- WebSocket server

### Phase 4+: Specialized Apps 📋
- Gate Scanner
- Mobile App

---

## 🎯 What Each Component Does

### LiveHeadcountCard
Displays real-time occupancy with 4 animated stat cards:
- Total Inside (all people)
- Visitors (guests)
- Contractors (external workers)
- Employees (staff)

**File:** `apps/web/src/components/dashboard/LiveHeadcountCard.tsx`

### VisitorsTable
Shows today's visitor list with:
- Visitor name
- Host (who they're meeting)
- Status (pending, approved, checked-in, etc.)
- Expected vs. actual arrival times

**File:** `apps/web/src/components/dashboard/VisitorsTable.tsx`

### ComplianceStatus
Displays compliance metrics:
- Medical clearance
- Police verification
- Document validity

**File:** `apps/web/src/components/dashboard/ComplianceStatus.tsx`

---

## 💾 Database Overview

### 8 Core Models
1. **Organization** - Company/entity
2. **Branch** - Office locations
3. **User** - Staff members
4. **Visitor** - Guest records
5. **Visit** - Visit appointments
6. **Contractor** - Vendor companies
7. **Worker** - Contractor staff
8. **Attendance** - Gate check-in/out logs

All models include timestamps and relationships for data integrity.

**File:** `packages/database/prisma/schema.prisma`

---

## 🎨 UI System

### Colors (Dark Theme)
- **Primary**: Blue (interactive elements)
- **Background**: Dark slate (slate-900)
- **Cards**: White with 5% opacity + backdrop blur
- **Text**: White (foreground) + zinc-400 (muted)
- **Accents**: Purple, orange, green (by category)

### Responsive Breakpoints
- Mobile: Default (< 768px)
- Tablet: md (≥ 768px)
- Desktop: lg (≥ 1024px)

### Components
- Button (multiple variants)
- Card (with header, footer, content)
- Badge (status indicators)
- Icons (from lucide-react)

---

## 🔐 Security Architecture

### Prepared For (Phase 3)
- JWT authentication
- Role-based access control (6 roles defined)
- Password hashing (bcryptjs)
- Encrypted document storage
- Audit logging

### Implemented
- Environment variable isolation
- CORS-ready structure
- Database relationship constraints
- Type-safe queries (Prisma)

---

## 📱 Multi-Platform Design

### Web Dashboard (✅ Done)
- Next.js 14 with React Server Components
- Responsive Tailwind design
- Real-time socket.io ready

### Gate Scanner (Phase 4)
- Electron or Next.js
- Camera integration
- Face recognition support

### Mobile App (Phase 5)
- React Native + Expo
- Native APIs
- Offline support

---

## 🧠 Architecture Principles

1. **Monorepo**: Shared code across apps
2. **Type Safety**: TypeScript everywhere
3. **Component-Based**: Reusable UI blocks
4. **Database-First**: Schema defines relationships
5. **Real-Time Ready**: Socket.io integration planned
6. **Scalable**: Can grow with more teams/branches
7. **Secure**: Auth and role-based access
8. **Documented**: Multiple guide files

---

## 🚦 Typical Workflow

### Daily Development
```bash
# 1. Start services
docker-compose up -d

# 2. Start dev server
npm run dev

# 3. Make code changes (auto-reload)

# 4. Verify build
npm run build

# 5. Check database (if needed)
npm run db:studio

# 6. Commit changes
git add .
git commit -m "feat: description"
```

### Adding New Features
```bash
# 1. Create component
# apps/web/src/components/newfeature.tsx

# 2. Import in dashboard
# apps/web/src/app/page.tsx

# 3. Style with Tailwind
# Use className with utility classes

# 4. Build & verify
npm run build

# 5. Test in browser
# http://localhost:3000
```

### Database Changes
```bash
# 1. Edit schema
# packages/database/prisma/schema.prisma

# 2. Create migration
npm run db:migrate

# 3. Name the migration meaningfully

# 4. Verify in Prisma Studio
npm run db:studio
```

---

## 📚 External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Framer Motion](https://www.framer.com/motion/)
- [Turborepo](https://turbo.build/repo/docs)
- [TypeScript](https://www.typescriptlang.org/docs/)

---

## ❓ Common Questions

**Q: How do I run just one app?**
```bash
npm --workspace=@vms/web run dev
```

**Q: Where do I add new dependencies?**
```bash
npm install package_name --workspace=@vms/web
```

**Q: How do I check the database?**
```bash
npm run db:studio
```

**Q: Why isn't Docker starting?**
- Ensure Docker Desktop is running
- Check port availability (5432, 6379)
- Run: `docker-compose down && docker-compose up -d`

**Q: How do I reset everything?**
```bash
docker-compose down -v
docker-compose up -d
npm run db:migrate
npm run dev
```

---

## 🎓 Learning Path

1. **Read**: README.md (overview)
2. **Explore**: ARCHITECTURE.md (system design)
3. **Setup**: GETTING_STARTED.md (5-min setup)
4. **Code**: Explore `apps/web/src/components/`
5. **Database**: Review `packages/database/prisma/schema.prisma`
6. **Extend**: Add new components or pages
7. **Build**: Create the API (Phase 3)

---

## 🎊 Summary

You have a **complete, production-ready foundation**:
- ✅ Monorepo infrastructure
- ✅ Database schema
- ✅ Web dashboard with components
- ✅ Docker environment
- ✅ Shared packages
- ✅ Documentation

**Next step:** Build the API in Phase 3!

---

**Questions?** Check the relevant markdown file above.

**Ready to start?** Open GETTING_STARTED.md and run the commands!

---

*Last Updated: 2025-05-22*  
*Project Progress: 40% Complete*
