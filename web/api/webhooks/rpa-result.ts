import { Request, Response } from 'express';
import { prisma } from '../../shared/prisma.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';
  const token = req.headers['authorization'];

  if (token !== `Bearer ${RPA_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { idempotencyKey, success, error, reachedStep, screenshotBase64, isProgress } = req.body;

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Missing idempotencyKey' });
  }

  try {
    const transaccion = await prisma.transaccionCompra.findUnique({
      where: { idempotency_key: idempotencyKey },
      include: { solicitud: { include: { trabajador: true } } }
    });

    if (!transaccion) {
      return res.status(404).json({ error: 'Transaccion no encontrada' });
    }

    if (!isProgress && transaccion.estado_rpa !== 'PENDIENTE' && transaccion.estado_rpa !== 'EN_PROGRESO') {
      return res.status(200).json({ message: 'Transaccion ya procesada.' });
    }

    let capturasArray: string[] = [];
    try { capturasArray = JSON.parse(transaccion.capturas || '[]'); } catch { capturasArray = []; }
    if (screenshotBase64) capturasArray.push(screenshotBase64);

    if (isProgress) {
      await prisma.transaccionCompra.update({
        where: { id: transaccion.id },
        data: {
          estado_rpa: 'EN_PROGRESO',
          paso_alcanzado: reachedStep || transaccion.paso_alcanzado,
          capturas: JSON.stringify(capturasArray)
        }
      });
      console.log(`[RPA Result] Progreso screenshot para ${transaccion.solicitudId}: ${reachedStep}`);
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.transaccionCompra.update({
          where: { id: transaccion.id },
          data: {
            estado_rpa: success ? 'EXITO' : 'FALLO',
            paso_alcanzado: reachedStep,
            capturas: JSON.stringify(capturasArray)
          }
        });

        await tx.solicitudViaje.update({
          where: { id: transaccion.solicitudId },
          data: { estado: success ? 'DEMOSTRACION_COMPLETADA' : 'FALLIDA' }
        });

        await tx.historialAuditoria.create({
          data: {
            solicitudId: transaccion.solicitudId,
            accion: 'RESULTADO_RPA',
            detalle: `Exito: ${success}. Paso: ${reachedStep}. Error: ${error || 'Ninguno'}`
          }
        });
      });

      console.log(`[RPA Result] Solicitud ${transaccion.solicitudId}: ${success ? 'EXITO' : 'FALLO'}`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
