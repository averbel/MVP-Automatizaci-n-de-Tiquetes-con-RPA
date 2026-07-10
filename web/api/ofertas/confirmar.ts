import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';
import { getKayakBookingLink } from '../lib/kayak';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { solicitudId, flight } = req.body;

  if (!solicitudId || !flight) {
    return res.status(400).json({ error: 'Missing solicitudId or flight details' });
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
      return res.status(400).json({ error: 'La solicitud no está aprobada o ya fue procesada.' });
    }

    // Aceptar oferta y disparar RPA
    const idempotency_key = crypto.randomUUID();
    
    // Obtener la fecha en formato YYYY-MM-DD
    const dateString = flight.departureTime.split('T')[0];
    const bookingLink = await getKayakBookingLink(solicitud.origen, solicitud.destino, dateString);

    await prisma.$transaction(async (tx) => {
      // 1. Guardar la oferta elegida
      await tx.ofertaVuelo.create({
        data: {
          solicitudId: solicitud.id,
          ignav_id: flight.id || 'N/A',
          booking_link: bookingLink,
          explicacion: flight.explicacion || 'Selección del usuario',
          precio: flight.priceUSD || 0,
          aerolinea: flight.airline || 'Desconocida',
          fechaHoraSalida: flight.departureTime ? new Date(flight.departureTime) : new Date(),
          fechaHoraLlegada: flight.arrivalTime ? new Date(flight.arrivalTime) : new Date(),
          escalas: flight.stops || 0,
          score: flight.score || 100
        }
      });

      // 2. Actualizar estado
      await tx.solicitudViaje.update({
        where: { id: solicitudId },
        data: { estado: 'CONFIRMADA' }
      });

      // 3. Crear transacción RPA
      await tx.transaccionCompra.create({
        data: {
          solicitudId,
          idempotency_key,
          estado_rpa: 'PENDIENTE',
          capturas: '[]'
        }
      });
    });

    // Disparar webhook hacia el servicio RPA (Railway)
    const RPA_URL = process.env.RPA_URL || 'http://localhost:4000';
    const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';
    const PUBLIC_URL = process.env.PUBLIC_URL || 'http://localhost:5173';

    console.log(`[Webhook -> RPA] Disparando RPA para solicitud ${solicitudId} con idempotency key ${idempotency_key}`);
    console.log(`[RPA INFO] Booking Link: ${bookingLink}`);

    fetch(`${RPA_URL}/api/rpa/comprar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RPA_WEBHOOK_SECRET}`
      },
      body: JSON.stringify({
        bookingLink: bookingLink,
        passengerData: {
          nombre: solicitud.trabajador.nombre,
          identificacion: solicitud.trabajador.identificacion,
          email: solicitud.trabajador.correo
        },
        idempotencyKey: idempotency_key,
        callbackUrl: `${PUBLIC_URL}/api/webhooks/rpa-result`
      })
    }).catch(e => console.error("Error llamando al bot RPA:", e));

    return res.status(200).json({ success: true, message: 'Oferta confirmada y RPA iniciado' });
  } catch (error) {
    console.error('Error confirmando oferta:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
