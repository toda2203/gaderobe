import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/database';

export class AuthService {
  /**
   * Lokaler Login: E-Mail + Passwort
   */
  async localLogin(email: string, password: string) {
    const user = await prisma.employee.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Benutzer nicht gefunden');
    }
    if (!user.passwordHash) {
      throw new Error('Kein Passwort gesetzt');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('Ungültiges Passwort');
    }
    return this.generateTokens(user);
  }

  generateTokens(employee: any) {
    const payload = {
      id: employee.id,
      email: employee.email,
      role: employee.role,
      status: employee.status,
      firstName: employee.firstName,
      lastName: employee.lastName,
      department: employee.department,
      profileImageUrl: employee.profileImageUrl || null,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '8h' });
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '30d' });
    return { token, refreshToken, user: payload };
  }

  async setPassword(userId: string, password: string) {
    const hash = await bcrypt.hash(password, 10);
    await prisma.employee.update({ where: { id: userId }, data: { passwordHash: hash as any } });
  }
}

export const authService = new AuthService();
