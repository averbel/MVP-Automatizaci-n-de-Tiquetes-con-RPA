import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../shared/prisma.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.query.token as string;

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const solicitud = await prisma.solicitudViaje.findUnique({
      where: { tokenAprobacion: token }
    });

    if (!solicitud) {
      return res.status(404).send(`
        <html><body>
        <h1>Error: Solicitud no encontrada o token inválido</h1>
        </body></html>
      `);
    }

    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(400).send(`
        <html><body>
        <h1>Aviso: La solicitud ya fue procesada (Estado actual: ${solicitud.estado})</h1>
        </body></html>
      `);
    }

    // Actualizar estado a APROBADA y consumir el token (para que sea de un solo uso)
    await prisma.solicitudViaje.update({
      where: { id: solicitud.id },
      data: { 
        estado: 'APROBADA',
        tokenAprobacion: null 
      }
    });

    res.status(200).send(`
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0fdf4; color: #166534; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); text-align: center; max-width: 500px; width: 100%; }
          h1 { margin-top: 0; margin-bottom: 0.5rem; color: #16a34a; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ ¡Solicitud Aprobada!</h1>
          <p>Has aprobado el viaje para esta solicitud. El trabajador ha sido notificado y ahora elegirá su vuelo.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error accepting solicitud:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
