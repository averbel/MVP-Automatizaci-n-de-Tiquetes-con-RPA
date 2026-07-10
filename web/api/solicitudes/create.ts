import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { sendApprovalEmail } from '../lib/email';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      nombre,
      identificacion,
      email,
      aprobadorEmail,
      origen,
      destino,
      fechaSalida,
      fechaRegreso,
      presupuesto,
      centroCostos,
      aerolineaPreferida,
      equipaje
    } = req.body;

    // Generar un token único para la aprobación
    const tokenAprobacion = crypto.randomBytes(32).toString('hex');

    // Transacción para asegurar la integridad
    const solicitud = await prisma.$transaction(async (tx) => {
      // 1. Obtener o crear trabajador
      let trabajador = await tx.trabajador.findUnique({ where: { correo: email } });
      if (!trabajador) {
        trabajador = await tx.trabajador.create({
          data: {
            nombre,
            identificacion,
            correo: email,
          }
        });
      }

      // 2. Obtener o crear aprobador
      let aprobador = await tx.aprobador.findUnique({ where: { correo: aprobadorEmail } });
      if (!aprobador) {
        aprobador = await tx.aprobador.create({
          data: {
            nombre: 'Aprobador', // Podemos mejorar esto si lo pedimos en el form
            correo: aprobadorEmail,
          }
        });
      }

      // 3. Crear solicitud
      return await tx.solicitudViaje.create({
        data: {
          trabajadorId: trabajador.id,
          aprobadorId: aprobador.id,
          origen,
          destino,
          fechaSalida: new Date(fechaSalida),
          fechaRegreso: fechaRegreso ? new Date(fechaRegreso) : null,
          presupuestoMaximo: parseFloat(presupuesto),
          centroCostos,
          equipajeRequerido: equipaje ? 'SI' : 'NO',
          preferenciaAerolinea: aerolineaPreferida || null,
          estado: 'PENDIENTE',
          tokenAprobacion,
        }
      });
    });

    // 4. Enviar correo de aprobación
    await sendApprovalEmail(aprobadorEmail, nombre, destino, tokenAprobacion, solicitud.id);

    return res.status(200).json({ success: true, solicitudId: solicitud.id });
  } catch (error) {
    console.error('Error creating solicitud:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
