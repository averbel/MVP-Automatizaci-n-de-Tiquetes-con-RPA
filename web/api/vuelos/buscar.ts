import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../shared/prisma.js';
import { kayakSearch } from '../../shared/kayak.js';
import { rankFlights } from '../../shared/decision.js';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { solicitudId } = req.body;

  if (!solicitudId) {
    return res.status(400).json({ error: 'Missing solicitudId' });
  }

  try {
    const solicitud = await prisma.solicitudViaje.findUnique({
      where: { id: solicitudId },
      include: { trabajador: true }
    });

    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (solicitud.estado !== 'APROBADA' && solicitud.estado !== 'BUSCANDO') {
      return res.status(400).json({ error: `Solicitud en estado incorrecto: ${solicitud.estado}` });
    }

    await prisma.solicitudViaje.update({
      where: { id: solicitud.id },
      data: { estado: 'BUSCANDO' }
    });

    console.log(`[buscar] Iniciando búsqueda para solicitud ${solicitudId}...`);
    const vuelos = await kayakSearch(solicitud.origen, solicitud.destino, solicitud.fechaSalida);
    console.log(`[buscar] Recibidos ${vuelos.length} vuelos`);

    const bestFlights = rankFlights(vuelos, solicitud.presupuestoMaximo, solicitud.preferenciaAerolinea);

    if (bestFlights.length === 0) {
      await prisma.solicitudViaje.update({
        where: { id: solicitud.id },
        data: { estado: 'SIN_OPCIONES' }
      });
      return res.status(200).json({ success: true, message: 'No options found', options: [] });
    }

    await prisma.solicitudViaje.update({
      where: { id: solicitud.id },
      data: { 
        estado: 'OPCIONES_LISTAS',
        preferenciaAerolinea: JSON.stringify(bestFlights)
      }
    });

    console.log(`[buscar] ${bestFlights.length} opciones listas para solicitud ${solicitudId}`);
    return res.status(200).json({ success: true, message: 'Opciones encontradas', options: bestFlights });
  } catch (error: any) {
    console.error('[buscar] Error:', error.message);
    
    await prisma.solicitudViaje.update({
      where: { id: solicitudId },
      data: { estado: 'FALLIDA' }
    }).catch(() => {});

    return res.status(500).json({ error: 'Internal server error' });
  }
}
