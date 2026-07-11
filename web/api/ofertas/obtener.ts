import { Request, Response } from 'express';
import { prisma } from '../../shared/prisma.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const solicitudId = req.query.solicitudId as string;
  if (!solicitudId) {
    return res.status(400).json({ error: 'Missing solicitudId' });
  }

  try {
    const solicitud = await prisma.solicitudViaje.findUnique({
      where: { id: solicitudId },
      include: { ofertaVuelo: true }
    });

    if (!solicitud || !solicitud.ofertaVuelo) {
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }

    return res.status(200).json({
      success: true,
      oferta: {
        id: solicitud.ofertaVuelo.id,
        aerolinea: solicitud.ofertaVuelo.aerolinea,
        precio: solicitud.ofertaVuelo.precio,
        moneda: 'USD',
        escalas: solicitud.ofertaVuelo.escalas,
        score: solicitud.ofertaVuelo.score,
        explicacionIA: solicitud.ofertaVuelo.explicacion,
      }
    });
  } catch (error) {
    console.error('Error fetching oferta:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
