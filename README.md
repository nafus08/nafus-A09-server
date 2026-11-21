# FixMate Server

TypeScript Express and MongoDB API for FixMate. Better Auth manages passwords, sessions, and JWT signing using the MongoDB adapter.

## Setup

```bash
npm install
npm run typecheck
npm run dev
```

Copy `.env.example` to `.env`. Start MongoDB locally first. The default local URLs are `mongodb://localhost:27017/fixmate`, API `http://localhost:5000`, and client `http://localhost:5173`. Set a random 32+ character `BETTER_AUTH_SECRET` before deployment. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `IMGBB_API_KEY` as needed.

On an empty database, the server creates demo accounts:

- Admin: `admin@fixmate.test` / `Admin123`
- Technician: `tech@fixmate.test` / `Tech123`
- Customer: `customer@fixmate.test` / `Customer123`

## Packages

Express, Mongoose, Better Auth (MongoDB adapter and JWT plugin), CORS, Multer, Axios, and Stripe.
