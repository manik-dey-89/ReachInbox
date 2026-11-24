import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import type { User } from '@reachinbox/shared';

// Augment Express global namespace so req.user is typed as our User
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User {
      id: string;
      email: string;
      name: string;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required', code: 'UNAUTHENTICATED' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as User | undefined;
  if (!user) {
    res.status(401).json({ success: false, error: 'Authentication required', code: 'UNAUTHENTICATED' });
    return;
  }
  if (user.email !== config.adminEmail) {
    res.status(403).json({ success: false, error: 'Admin access required', code: 'FORBIDDEN' });
    return;
  }
  next();
}
