import { Request, Response } from 'express';
import { prisma } from '../../shared/prisma.js';
import crypto from 'crypto';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      nombre, identificacion, email, aprobadorEmail,
      origen, destino, fechaSalida, fechaRegreso,
      presupuesto, centroCostos, aerolineaPreferida, equipaje
    } = req.body;

    const tokenAprobacion = crypto.randomBytes(32).toString('hex');

    const solicitud = await prisma.$transaction(async (tx) => {
      let trabajador = await tx.trabajador.findUnique({ where: { correo: email } });
      if (!trabajador) {
        trabajador = await tx.trabajador.create({
          data: { nombre, identificacion, correo: email }
        });
      }

      let aprobador = await tx.aprobador.findUnique({ where: { correo: aprobadorEmail } });
      if (!aprobador) {
        aprobador = await tx.aprobador.create({
          data: { nombre: 'Aprobador', correo: aprobadorEmail }
        });
      }

      return await tx.solicitudViaje.create({
        data: {
          trabajadorId: trabajador.id,
          aprobadorId: aprobador.id,
          origen, destino,
          fechaSalida: new Date(fechaSalida),
          fechaRegreso: fechaRegreso ? new Date(fechaRegreso) : null,
          presupuestoMaximo: parseFloat(presupuesto),
          centroCostos,
          equipajeRequerido: equipaje ? 'SI' : 'NO',
          preferenciaAerolinea: aerolineaPreferida || null,
          estado: 'APROBADA',
          tokenAprobacion,
        }
      });
    });

    return res.status(200).json({ success: true, solicitudId: solicitud.id });
  } catch (error) {
    console.error('Error creating solicitud:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
