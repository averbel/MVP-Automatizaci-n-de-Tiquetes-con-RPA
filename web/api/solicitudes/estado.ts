import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: 'Missing id' });
  }

  try {
    const solicitud = await prisma.solicitudViaje.findUnique({
      where: { id },
      include: {
        transaccionCompra: true
      }
    });

    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    return res.status(200).json({ 
      estado: solicitud.estado,
      estado_rpa: solicitud.transaccionCompra?.estado_rpa || null,
      capturas: solicitud.transaccionCompra?.capturas ? JSON.parse(solicitud.transaccionCompra.capturas) : []
    });
  } catch (error) {
    console.error('Error fetching estado:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
