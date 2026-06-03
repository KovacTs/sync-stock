import { Router } from 'express';
import { requestSOABus } from '../lib/soabus';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        codigo: 'DATOS_REQUERIDOS',
        mensaje: 'Debe especificar el usuario y la contraseña.'
      });
    }

    // --- PROTOCOL BRIDGE PATTERN ---
    // Forward REST request to the TCP ESB "autho" service
    const { status, data } = await requestSOABus('autho', JSON.stringify({ username, password }));

    if (status === 'NK') {
      return res.status(401).json({
        codigo: 'CREDENTIALS_INVALID',
        mensaje: 'Usuario o contraseña incorrectos.'
      });
    }

    const authResponse = JSON.parse(data);
    return res.status(200).json(authResponse);
  } catch (error: any) {
    console.error('Error on login route Protocol Bridge:', error);
    return res.status(500).json({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Error de conexión con el bus de servicios.'
    });
  }
});
