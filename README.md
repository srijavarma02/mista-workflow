# Stores & Inventory Management System

Enterprise-grade construction company stores and inventory management system that digitizes the complete material lifecycle — from material requisition to procurement, inspection, stock management, consumption tracking, returns, reporting, and stakeholder communication.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + TailwindCSS + React Query |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 15 |
| Auth | JWT + RBAC |
| Storage | Supabase Storage |
| Reporting | PDFKit + ExcelJS |
| AI | OpenAI GPT-4 |
| Containerization | Docker + Docker Compose |

## User Roles

- **Site Engineer** – Raise MRFs, track requests, view issued materials, submit returns
- **Project Manager** – Approve/reject MRFs, monitor project material consumption
- **Stores Executive** – Check stock, generate MINs, manage inward entries, handle returns
- **Procurement Team** – Manage vendors, create POs, track deliveries
- **QA/QC Team** – Inspect incoming materials, upload test certificates
- **Finance Team** – Verify invoices, process payments, track expenses
- **Admin** – User management, role management, audit monitoring

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Node.js 18+ (for local dev)

### Run with Docker

```bash
git clone <repo>
cd stores-inventory-system
cp backend/.env.example backend/.env   # edit values
docker-compose up -d
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed
```

- Frontend: http://localhost:3000
- API: http://localhost:5000
- Default admin: admin@stores.com / Admin@123

### Local Dev (no Docker)

```bash
# Terminal 1 – Backend
cd backend && npm install && npm run dev

# Terminal 2 – Frontend
cd frontend && npm install && npm run dev
```
