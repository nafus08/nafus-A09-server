import type { UserRole } from './models.js';

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: UserRole;
        name: string;
      };
    }
  }
}

export {};
