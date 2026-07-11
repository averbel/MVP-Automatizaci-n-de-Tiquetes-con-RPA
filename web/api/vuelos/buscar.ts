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

    // 1. Marcar como BUSCANDO y responder inmediatamente
    await prisma.solicitudViaje.update({
      where: { id: solicitud.id },
      data: { estado: 'BUSCANDO' }
    });

    // 2. Disparar búsqueda en background (fire-and-forget)
    // No esperamos resultado — el frontend hará polling
    (async () => {
      try {
        console.log(`[buscar] Iniciando búsqueda para solicitud ${solicitudId}...`);
        const vuelos = await kayakSearch(solicitud.origen, solicitud.destino, solicitud.fechaSalida);
        console.log(`[buscar] Recibidos ${vuelos.length} vuelos`);

        const bestFlights = rankFlights(vuelos, solicitud.presupuestoMaximo, solicitud.preferenciaAerolinea);

        if (bestFlights.length === 0) {
          await prisma.solicitudViaje.update({
            where: { id: solicitud.id },
            data: { estado: 'SIN_OPCIONES' }
          });
          console.log(`[buscar] Sin opciones para solicitud ${solicitudId}`);
        } else {
          // Guardar opciones como JSON temporal en la solicitud para que el polling las lea
          await prisma.solicitudViaje.update({
            where: { id: solicitud.id },
            data: { 
              estado: 'OPCIONES_LISTAS',
              preferenciaAerolinea: JSON.stringify(bestFlights)
            }
          });
          console.log(`[buscar] ${bestFlights.length} opciones listas para solicitud ${solicitudId}`);
        }
      } catch (error: any) {
        console.error(`[buscar] Error en búsqueda background:`, error.message);
        await prisma.solicitudViaje.update({
          where: { id: solicitud.id },
          data: { estado: 'FALLIDA' }
        }).catch(() => {});
      }
    })();

    // 3. Responder inmediatamente
    return res.status(200).json({ success: true, message: 'Búsqueda iniciada' });
  } catch (error) {
    console.error('Error buscando vuelos:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
