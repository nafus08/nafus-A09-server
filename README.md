# FixMate Server

Express and MongoDB API for the FixMate repair service platform.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Configure `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `IMGBB_API_KEY`.

## Packages

Express, Mongoose, JSON Web Token, bcryptjs, CORS, Multer, Axios, and Stripe.
