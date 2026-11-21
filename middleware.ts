import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { auth } from './auth.js';
import { User, type UserRole } from './models.js';

export async function verifyToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  let userId: string | undefined;
  try {
    const result = await auth.api.verifyJWT({ body: { token } });
    userId = result.payload?.sub;
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  req.user = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
  };
  return next();
}

const role = (allowed: UserRole[]): RequestHandler => (req, res, next) => {
  if (req.user && allowed.includes(req.user.role)) return next();
  return res.status(403).json({ message: 'Forbidden' });
};

export const verifyCustomer = role(['customer']);
export const verifyTechnician = role(['technician']);
export const verifyAdmin = role(['admin']);
