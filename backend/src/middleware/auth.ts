import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_98765';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    rol: string;
  };
}

export function verificarToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      codigo: 'TOKEN_REQUERIDO',
      mensaje: 'Token de autenticación no proporcionado.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      rol: decoded.rol
    };
    next();
  } catch (error) {
    return res.status(401).json({
      codigo: 'TOKEN_INVALIDO',
      mensaje: 'Token de autenticación inválido o expirado.'
    });
  }
}
