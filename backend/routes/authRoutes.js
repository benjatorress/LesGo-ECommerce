import express from 'express';
import { login, solicitarCambioPassword } from '../controllers/authController.js';

const router = express.Router();

// Ruta de inicio de sesión
router.post('/login', login);

// Ruta para solicitar cambio/recuperación de contraseña
router.post('/forgot-password', solicitarCambioPassword);

export default router;
