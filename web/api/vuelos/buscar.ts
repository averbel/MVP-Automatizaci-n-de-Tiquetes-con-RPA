import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    console.log(`[buscar] Búsqueda para solicitud ${solicitudId}...`);

    const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';
    const rpaUrl = process.env.RPA_API_URL || 'http://localhost:4000';
    const dateString = new Date(solicitud.fechaSalida).toISOString().split('T')[0];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${rpaUrl}/api/rpa/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RPA_WEBHOOK_SECRET}`
      },
      body: JSON.stringify({
        origin: solicitud.origen,
        destination: solicitud.destino,
        date: dateString
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[buscar] RPA API search failed:', response.status, errText);
      throw new Error(`RPA API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    console.log(`[buscar] Recibidos ${data.flights?.length || 0} vuelos`);

    if (!data.success || !data.flights || data.flights.length === 0) {
      await prisma.solicitudViaje.update({
        where: { id: solicitud.id },
        data: { estado: 'SIN_OPCIONES' }
      });
      return res.status(200).json({ success: true, message: 'No options found', options: [] });
    }

    const presupuestoMax = solicitud.presupuestoMaximo;
    const prefAerolinea = solicitud.preferenciaAerolinea;

    const scored = data.flights
      .filter((f: any) => f.priceUSD <= presupuestoMax)
      .map((f: any) => {
        let score = 100 - f.priceUSD - (f.stops * 20);
        if (prefAerolinea && f.airline.toUpperCase() === prefAerolinea.toUpperCase()) score += 30;
        return { ...f, score, explicacion: `$${f.priceUSD}, ${f.stops === 0 ? 'directo' : f.stops + ' escalas'}` };
      })
      .sort((a: any, b: any) => b.score - a.score);

    if (scored.length === 0) {
      await prisma.solicitudViaje.update({
        where: { id: solicitud.id },
        data: { estado: 'SIN_OPCIONES' }
      });
      return res.status(200).json({ success: true, message: 'No options within budget', options: [] });
    }

    await prisma.solicitudViaje.update({
      where: { id: solicitud.id },
      data: {
        estado: 'OPCIONES_LISTAS',
        preferenciaAerolinea: JSON.stringify(scored)
      }
    });

    return res.status(200).json({ success: true, message: 'Opciones encontradas', options: scored });
  } catch (error: any) {
    console.error('[buscar] Error:', error.message);
    console.error('[buscar] Stack:', error.stack);
    try {
      await prisma.solicitudViaje.update({
        where: { id: solicitudId },
        data: { estado: 'FALLIDA' }
      });
    } catch (_) {}
    return res.status(200).json({ success: false, error: 'Search failed', options: [] });
  }
}
