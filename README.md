# RIT Japanese Course Portal | 現代日本語アカデミー

A Japanese Language Learning Management System (LMS) with built-in proctoring, student dashboards, timetable tracking, interactive Japanese vocabulary & kanji cards, and comprehensive administrative controls across JLPT N5 through N1.

---

## 🌟 Key Features

- **Multi-Role Portal**: Dedicated portals for **Admin / Teachers** and **Students**.
- **JLPT N1–N5 Level Curriculum**: Dynamic course switching, timetables, syllabus, and study materials.
- **Hour-by-Hour Attendance**: Real-time attendance logging and percentage calculation.
- **Assessment & Examination Engine**: Multiple-choice testing with real-time proctoring (tab-switching detection, clipboard locking, fullscreen enforcement).
- **Assignments & Grading**: Homework submission system with grading and instructor feedback.
- **Serverless & Local Ready**: Configured for local SQLite development and seamless Vercel deployment with pre-seeded database replication.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18.x or v20.x recommended)
- **npm** or **pnpm**

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/sanjay082039-source/Japanese-website.git
cd Japanese-website

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="rit-japanese-portal-secure-production-secret-2026"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="rit-japanese-portal-secure-production-secret-2026"
```

### 4. Database Setup
```bash
# Generate Prisma Client
npx prisma generate

# (Optional) Seed the database with demo accounts & courses
npm run db:seed
```

### 5. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔐 Demo Credentials

All test accounts use the password: `password123`

| Role | Name | Email | Level |
| :--- | :--- | :--- | :--- |
| **Admin / Sensei** | Tanaka Hiroshi (田中 浩) | `admin.tanaka@rit.edu` | N1 |
| **Admin / Sensei** | Yamamoto Kenji (山本 健二) | `admin.yamamoto@rit.edu` | N2 |
| **Student** | Sakura Ito (伊藤 さくら) | `sakura.ito@student.rit.edu` | N1 |
| **Student** | Ren Takahashi (高橋 蓮) | `ren.takahashi@student.rit.edu` | N5 |

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **ORM & Database**: Prisma ORM with SQLite (embedded base64 for Vercel serverless)
- **Icons**: Lucide React
- **Auth**: JOSE (JWT) & bcryptjs