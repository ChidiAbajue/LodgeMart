import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validate } from '../middleware/validateMiddleware.js';
import { loginLimits, registerLimit } from '../middleware/rateLimitMiddleware.js';
import { registerSchema, loginSchema } from '../utils/authSchema.js';

// register + login are on the public allow-list in authMiddleware.js;
// logout + me require a valid token (enforced globally in app.js).
export const authRoutes = Router();

authRoutes.post('/register', registerLimit, validate(registerSchema), authController.register);
authRoutes.post('/login', ...loginLimits, validate(loginSchema), authController.login);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', authController.me);
