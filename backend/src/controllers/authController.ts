import { Request, Response } from 'express';
import { body, ValidationChain } from 'express-validator';
import { authService } from '../services/authService';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../types/user';
import { pool } from '../config/database';
import { auditService } from '../services/auditService';

export const registerSchema: ValidationChain[] = [
  body('username')
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage('Invalid role'),
];

export const loginSchema: ValidationChain[] = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password, full_name, role } = req.body;

      const existingUsername = await authService.findUserByUsername(username);
      if (existingUsername) {
        sendError(res, 'Username already taken', 409);
        return;
      }

      const existingEmail = await authService.findUserByEmail(email);
      if (existingEmail) {
        sendError(res, 'Email already registered', 409);
        return;
      }

      const user = await authService.createUser({ username, email, password, full_name, role });
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);
      setRefreshCookie(res, refreshToken);

      sendSuccess(res, { user, accessToken, refreshToken }, 'Registration successful', 201);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Registration failed', 500, error);
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      const user = await authService.findUserByUsername(username);
      if (!user) {
        sendError(res, 'Invalid credentials', 401);
        return;
      }

      const valid = authService.comparePassword(password, user.password_hash);
      if (!valid) {
        sendError(res, 'Invalid credentials', 401);
        return;
      }

      // Load full user data with permissions
      const userPublic = await authService.findUserById(user.id);
      if (!userPublic) {
        sendError(res, 'User not found', 404);
        return;
      }

      const accessToken = generateAccessToken(userPublic);
      const refreshToken = generateRefreshToken(userPublic);
      setRefreshCookie(res, refreshToken);

      sendSuccess(res, { user: userPublic, accessToken, refreshToken }, 'Login successful');

      auditService.logAudit({
        userId: userPublic.id,
        username: userPublic.username || userPublic.email,
        action: 'LOGIN',
        entityType: 'auth',
        entityLabel: userPublic.email,
        ipAddress: req.ip,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Login failed', 500, error);
    }
  },

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken || (req.headers['x-refresh-token'] as string);
      if (!refreshToken) {
        sendError(res, 'Refresh token required', 401);
        return;
      }

      const payload = verifyToken(refreshToken);

      const user = await authService.findUserById(payload.userId);
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }

      // Deny refresh if role has been deactivated
      if (user.role_id) {
        const roleCheck = await pool.query<{ is_active: boolean }>(
          'SELECT is_active FROM roles WHERE id = $1',
          [user.role_id],
        );
        if (!roleCheck.rows[0]?.is_active) {
          res.clearCookie('refreshToken');
          sendError(res, 'Vai trò của bạn đã bị thu hồi. Vui lòng liên hệ admin.', 403);
          return;
        }
      }

      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);
      setRefreshCookie(res, newRefreshToken);

      sendSuccess(
        res,
        { accessToken: newAccessToken, refreshToken: newRefreshToken },
        'Token refreshed',
      );
    } catch {
      sendError(res, 'Invalid refresh token', 403);
    }
  },

  logout(req: AuthRequest, res: Response): void {
    res.clearCookie('refreshToken');

    if (req.user) {
      auditService.logAudit({
        userId: req.user.userId,
        username: req.user.email,
        action: 'LOGOUT',
        entityType: 'auth',
        entityLabel: req.user.email,
        ipAddress: req.ip,
      });
    }

    sendSuccess(res, undefined, 'Logged out successfully');
  },

  async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const user = await authService.findUserById(req.user.userId);
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }

      sendSuccess(res, user, 'User profile');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      sendError(res, 'Failed to get user', 500, error);
    }
  },
};
