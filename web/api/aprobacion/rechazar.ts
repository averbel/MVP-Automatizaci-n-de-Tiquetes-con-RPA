import { Request, Response } from 'express';
import { prisma } from '../../shared/prisma.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.query.token as string;
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const solicitud = await prisma.solicitudViaje.findUnique({
      where: { tokenAprobacion: token },
      include: { trabajador: true }
    });

    if (!solicitud) {
      return res.status(404).send('<html><body><h1>Error: Solicitud no encontrada o token invalido</h1></body></html>');
    }

    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(400).send(`<html><body><h1>La solicitud ya fue procesada (Estado: ${solicitud.estado})</h1></body></html>`);
    }

    await prisma.solicitudViaje.update({
      where: { id: solicitud.id },
      data: { estado: 'RECHAZADA', tokenAprobacion: null }
    });

    console.log(`[Email] Notificando rechazo a ${solicitud.trabajador.correo}`);

    res.status(200).send(`
      <html><head><style>
        body{font-family:sans-serif;background:#fef2f2;color:#991b1b;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
        .card{background:white;padding:2rem;border-radius:1rem;box-shadow:0 10px 15px -3px rgb(0 0 0/.1);text-align:center;max-width:500px}
      </style></head><body><div class="card"><h1>Solicitud Rechazada</h1><p>La solicitud de viaje ha sido declinada.</p></div></body></html>
    `);
  } catch (error) {
    console.error('Error rejecting solicitud:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
