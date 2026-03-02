
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
    status: string;
    firstName: string;
    lastName: string;
    department?: string;
  };
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Kein Authentifizierungstoken gefunden',
        },
      });
      return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
      role: UserRole;
    };
    // Fetch user from database
    const user = await prisma.employee.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
        department: true,
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'Benutzer ist nicht aktiv',
        },
      });
      return;
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
    };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Ungültiges oder abgelaufenes Token',
      },
    });
    return;
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
        },
      });
      return;
    }
    next();
  };
};
