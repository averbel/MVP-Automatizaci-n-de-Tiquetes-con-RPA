import { Request, Response } from 'express';
import { prisma } from '../../shared/prisma.js';
import crypto from 'crypto';
import { getBookingLink } from '../../shared/kayak.js';

export default async function handler(req: Request, res: Response) {
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

    if (solicitud.estado !== 'APROBADA' && solicitud.estado !== 'BUSCANDO' && solicitud.estado !== 'OPCIONES_LISTAS') {
      return res.status(400).json({ error: `Solicitud en estado incorrecto: ${solicitud.estado}` });
    }

    const idempotency_key = crypto.randomUUID();
    const dateString = flight.departureTime ? flight.departureTime.split('T')[0] : new Date().toISOString().split('T')[0];
    const bookingLink = getBookingLink(solicitud.origen, solicitud.destino, dateString);

    await prisma.$transaction(async (tx) => {
      await tx.ofertaVuelo.create({
        data: {
          solicitudId: solicitud.id,
          ignav_id: flight.id || 'N/A',
          booking_link: bookingLink,
          explicacion: flight.explicacion || 'Seleccion del usuario',
          precio: flight.priceUSD || 0,
          aerolinea: flight.airline || 'Desconocida',
          fechaHoraSalida: flight.departureTime ? new Date(flight.departureTime) : new Date(),
          fechaHoraLlegada: flight.arrivalTime ? new Date(flight.arrivalTime) : new Date(),
          escalas: flight.stops || 0,
          score: flight.score || 100
        }
      });

      await tx.solicitudViaje.update({
        where: { id: solicitudId },
        data: { estado: 'CONFIRMADA' }
      });

      await tx.transaccionCompra.create({
        data: {
          solicitudId,
          idempotency_key,
          estado_rpa: 'PENDIENTE',
          capturas: '[]'
        }
      });
    });

    let RPA_URL = process.env.RPA_API_URL || process.env.RPA_URL || 'http://localhost:4000';
    if (!RPA_URL.startsWith('http://') && !RPA_URL.startsWith('https://')) {
      RPA_URL = 'http://' + RPA_URL;
    }
    const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';
    const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;

    console.log(`[Webhook -> RPA] Disparando RPA para solicitud ${solicitudId}`);

    fetch(`${RPA_URL}/api/rpa/comprar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RPA_WEBHOOK_SECRET}`
      },
      body: JSON.stringify({
        bookingLink,
        passengerData: {
          nombre: solicitud.trabajador.nombre,
          identificacion: solicitud.trabajador.identificacion,
          email: solicitud.trabajador.correo,
          telefono: solicitud.trabajador.telefono || '',
          fechaNacimiento: solicitud.trabajador.fechaNacimiento
            ? solicitud.trabajador.fechaNacimiento.toISOString().split('T')[0]
            : '',
          genero: solicitud.trabajador.genero || ''
        },
        idempotencyKey: idempotency_key,
        callbackUrl: `${PUBLIC_URL}/api/webhooks/rpa-result`
      })
    }).then(r => {
      console.log(`[Webhook -> RPA] Status: ${r.status}`);
      return r.text();
    }).then(t => console.log(`[Webhook -> RPA] Body: ${t}`))
      .catch(e => console.error("[Webhook -> RPA] Error:", e.message));

    return res.status(200).json({ success: true, message: 'Oferta confirmada y RPA iniciado' });
  } catch (error) {
    console.error('Error confirmando oferta:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
