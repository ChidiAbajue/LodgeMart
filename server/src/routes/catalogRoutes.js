import { Router } from 'express';
import { getCatalog } from '../controllers/catalogController.js';

// Public (on the PUBLIC_ROUTES allow-list in authMiddleware.js).
export const catalogRoutes = Router();

catalogRoutes.get('/', getCatalog);
