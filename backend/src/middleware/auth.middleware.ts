import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../utils/database';

// Define UserRole locally since Prisma doesn't export it as type
type UserRole = 'ADMIN' | 'WAREHOUSE' | 'HR' | 'READ_ONLY';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    entraId: string;
  };
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Kein gültiges Authentifizierungs-Token gefunden',
        },
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        userId: string;
        email: string;
        entraId: string;
      };

      // Fetch user from database
      const user = await prisma.employee.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, entraId: true, status: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_INACTIVE',
            message: 'Benutzer ist nicht aktiv',
          },
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
        entraId: user.entraId,
      };

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Ungültiges oder abgelaufenes Token',
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Nicht authentifiziert',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Keine Berechtigung für diese Aktion',
          details: { required: roles, current: req.user.role },
        },
      });
      return;
    }

    next();
  };
};
