# VMS Quick Reference Guide

## 🚀 First-Time Setup (5 minutes)

```bash
# 1. Navigate to project
cd C:\Users\JSK\Desktop\VMS

# 2. Install all dependencies
npm install

# 3. Create .env.local (copy template)
cp .env.example .env.local

# 4. Start Docker (PostgreSQL + Redis)
docker-compose up -d

# 5. Run database migrations
npm run db:migrate

# 6. Start dev servers
npm run dev
```

**Dashboard ready at:** http://localhost:3000

---

## 📦 What's Running

| Service | Port | Status |
|---------|------|--------|
| Next.js Dashboard | 3000 | Running |
| NestJS API | 4000 | Not started (Phase 3) |
| PostgreSQL | 5432 | Docker container |
| Redis | 6379 | Docker container |

---

## 🛠️ Common Tasks

### View the Dashboard
```bash
npm run dev
# Open http://localhost:3000
```

### Check Database
```bash
npm run db:studio
# Opens Prisma Studio - visual DB editor
```

### Create New Migration
```bash
npm run db:migrate
# Creates new migration after schema changes
```

### Stop Docker
```bash
docker-compose down
```

### Restart Everything
```bash
docker-compose down
docker-compose up -d
npm run dev
```

---

## 📂 Adding New Components

### Create a new dashboard component:

```bash
# 1. Create component file
# File: apps/web/src/components/dashboard/NewComponent.tsx

"use client";
import { motion } from "framer-motion";

export function NewComponent() {
  return (
    <motion.div>
      {/* Your component here */}
    </motion.div>
  );
}

# 2. Import in dashboard
# File: apps/web/src/app/page.tsx
import { NewComponent } from "@/components/dashboard/NewComponent";

# 3. Use it
<NewComponent />
```

---

## 📊 Dashboard Components

### Available Components
- `LiveHeadcountCard` - Animated headcount display
- `VisitorsTable` - Today's visitor list
- `ComplianceStatus` - Compliance indicators

### Adding More Stats
Edit `apps/web/src/components/dashboard/LiveHeadcountCard.tsx`:
- Add new card object to `cards` array
- Include: label, count, icon, color, bg

---

## 🔗 Project Links

### Documentation
- Schema: `packages/database/prisma/schema.prisma`
- Components: `apps/web/src/components/`
- Tailwind Config: `apps/web/tailwind.config.js`

### External Tools
- Prisma Docs: https://www.prisma.io/docs/
- Next.js Docs: https://nextjs.org/docs
- Tailwind: https://tailwindcss.com/docs

---

## ⚡ Performance Tips

1. **Local dev**: Running `npm run dev` watches files automatically
2. **Production build**: `npm run build` compiles optimized version
3. **Clean install**: `npm install --force` if dependencies have issues

---

## 🆘 Troubleshooting

### Port 3000 already in use
```bash
# Find process on port 3000
netstat -ano | findstr :3000
# Kill process
taskkill /PID <PID> /F
```

### Docker not starting
```bash
# Check Docker status
docker ps
# Restart Docker Desktop
# Then run: docker-compose up -d
```

### Database errors
```bash
# Reset migrations (careful!)
npm run db:push --skip-generate
# Or full reset:
docker-compose down -v
docker-compose up -d
npm run db:migrate
```

### Build failing
```bash
# Clean install
rm -r node_modules package-lock.json
npm install
npm run build
```

---

## 📋 Next Steps (Phase 2 Continuation)

- [ ] Add login/authentication pages
- [ ] Create visitor check-in form
- [ ] Build contractor management pages
- [ ] Connect to real API (when Phase 3 ready)
- [ ] Add sidebar navigation
- [ ] Create admin settings page

---

## 💾 Current Phase: 2 (Web Dashboard)

**Completed:**
- ✅ Monorepo setup
- ✅ Database schema
- ✅ Docker environment
- ✅ Next.js 14 app
- ✅ Dashboard components

**In Progress:**
- 🔄 More UI pages
- 🔄 Authentication system

**Not Started:**
- 📋 API (Phase 3)
- 📋 Gate scanner (Phase 4)
- 📋 Mobile app (Phase 5)

---

**Questions?** Check the README.md in project root!
