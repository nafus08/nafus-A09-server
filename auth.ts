import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { jwt } from 'better-auth/plugins';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fixmate';
const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret && process.env.NODE_ENV === 'production') {
  throw new Error('BETTER_AUTH_SECRET must be configured in production');
}
const mongoClient = new MongoClient(mongoUri);
await mongoClient.connect();

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

export const auth = betterAuth({
  appName: 'FixMate',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:5000',
  secret: authSecret || 'fixmate-local-dev-secret-change-before-production',
  trustedOrigins: allowedOrigins,
  database: mongodbAdapter(mongoClient.db(), { client: mongoClient, transaction: false }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'customer', input: false },
      phone: { type: 'string', required: false, input: false },
      area: { type: 'string', required: false, input: false },
      bio: { type: 'string', required: false, input: false },
    },
  },
  plugins: [jwt()],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
});
