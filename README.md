# Agency CRM

A sales tracker CRM built for a software agency's sales team (lead qualifiers and account closers). Leads move through a pipeline from first contact to closed deal, with revenue, commission, and pipeline-health metrics calculated automatically from the same lead records — nothing gets entered twice.

## Features

- **Kanban board** — drag-and-drop pipeline across stages (New → Discovery Call → Proposal → Contract → Deposit → Won/Lost)
- **Lead log** — sortable/filterable table view of every lead
- **Dashboard** — revenue, win rate, and commission metrics, auto-calculated from pipeline data
- **Projection module** — forecast revenue based on current pipeline
- **Bottleneck flags** — auto-highlights leads with booking lag > 4 days, follow-ups aging 7+ days, or deposits unpaid 14+ days
- **CSV bulk upload** for importing leads
- **Multi-currency** support with per-lead conversion to a USD base
- **Role-based access** — Admin / Setter / Closer
- **Auth** — email/password (JWT)

## Demo

Live app: https://agency-crm-lyart.vercel.app

Seeded demo accounts (created via `POST /api/admin/seed`, see below):

| Role   | Email                      | Password    |
|--------|-----------------------------|-------------|
| Admin  | admin@salestracker.com      | Admin@123   |
| Setter | setter@salestracker.com     | Setter@123  |
| Closer | closer@salestracker.com     | Closer@123  |

These are demo-only credentials seeded into a shared test database — don't reuse these passwords anywhere real.

## Stack

- **Backend**: FastAPI, Motor (async MongoDB), JWT auth, APScheduler, Resend for email
- **Frontend**: React (CRA + craco), Tailwind CSS, shadcn/ui, `@hello-pangea/dnd`, Recharts

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
MONGO_URL="mongodb://localhost:27017"   # or a MongoDB Atlas connection string
DB_NAME="agency_crm"
CORS_ORIGINS="*"
JWT_SECRET_KEY="<generate a random secret>"
RESEND_API_KEY=
SENDER_EMAIL=onboarding@resend.dev
```

Run MongoDB locally (or point `MONGO_URL` at Atlas):

```bash
docker run -d --name agency-crm-mongo -p 27017:27017 mongo:7
```

Start the API:

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Seed demo accounts (admin/setter/closer):

```bash
curl -X POST http://localhost:8000/api/admin/seed
```

### Frontend

```bash
cd frontend
yarn install
```

Create `frontend/.env`:

```
REACT_APP_BACKEND_URL=http://localhost:8000
```

```bash
yarn start
```

## Deployment

- **Frontend**: Vercel (auto-deploys on push to `main`)
- **Backend**: Render, via `render.yaml` (needs a long-running process for the FastAPI app + APScheduler background jobs — not a fit for serverless)
- **Database**: MongoDB Atlas

Render's free-tier services spin down after inactivity, so the first request after a while may take ~30-50s to wake up.
