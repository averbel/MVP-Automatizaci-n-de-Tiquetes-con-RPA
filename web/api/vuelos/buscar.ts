import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../shared/prisma.js';
import { kayakSearch } from '../../shared/kayak.js';
import { rankFlights } from '../../shared/decision.js';

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

    if (solicitud.estado !== 'APROBADA') {
      return res.status(400).json({ error: `Solicitud en estado incorrecto: ${solicitud.estado}` });
    }

    // 1. Marcar como BUSCANDO
    await prisma.solicitudViaje.update({
      where: { id: solicitud.id },
      data: { estado: 'BUSCANDO' }
    });

    // 2. Buscar vuelos en API de Kayak
    const vuelos = await kayakSearch(solicitud.origen, solicitud.destino, solicitud.fechaSalida);

    // 3. Tomar decisión con IA / Scoring (obtiene todos los válidos)
    const bestFlights = rankFlights(vuelos, solicitud.presupuestoMaximo, solicitud.preferenciaAerolinea);

    if (bestFlights.length === 0) {
      // No hay opciones
      await prisma.solicitudViaje.update({
        where: { id: solicitud.id },
        data: { estado: 'SIN_OPCIONES' }
      });
      return res.status(200).json({ success: true, message: 'No options found', options: [] });
    }

    // Ya no guardamos la OfertaVuelo aquí, lo hará el frontend al seleccionar
    // Solo devolvemos las opciones para que el trabajador elija
    return res.status(200).json({ success: true, message: 'Opciones encontradas', options: bestFlights });
  } catch (error) {
    console.error('Error buscando vuelos:', error);
    
    // Si falla, revertimos el estado (o lo marcamos como fallida)
    await prisma.solicitudViaje.update({
      where: { id: solicitudId },
      data: { estado: 'FALLIDA' }
    }).catch(e => console.error(e));

    return res.status(500).json({ error: 'Internal server error' });
  }
}
