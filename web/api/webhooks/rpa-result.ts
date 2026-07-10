import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../shared/prisma.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';
  const token = req.headers['authorization'];

  if (token !== `Bearer ${RPA_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { idempotencyKey, success, error, reachedStep, screenshotBase64 } = req.body;

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Missing idempotencyKey' });
  }

  try {
    const transaccion = await prisma.transaccionCompra.findUnique({
      where: { idempotency_key: idempotencyKey },
      include: {
        solicitud: {
          include: { trabajador: true }
        }
      }
    });

    if (!transaccion) {
      return res.status(404).json({ error: 'Transaccion no encontrada' });
    }

    if (transaccion.estado_rpa !== 'PENDIENTE' && transaccion.estado_rpa !== 'EN_PROGRESO') {
      return res.status(200).json({ message: 'Transaccion ya fue procesada anteriormente.' });
    }

    // Actualizar transacción
    const nuevoEstado = success ? 'EXITO' : 'FALLO';
    let capturasStr = transaccion.capturas || '[]';
    let capturasArray;
    try {
      capturasArray = JSON.parse(capturasStr);
    } catch(e) {
      capturasArray = [];
    }
    
    // Guardar la imagen en base64 en la base de datos (para el MVP)
    if (screenshotBase64) {
      capturasArray.push(screenshotBase64);
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaccionCompra.update({
        where: { id: transaccion.id },
        data: {
          estado_rpa: nuevoEstado,
          paso_alcanzado: reachedStep,
          capturas: JSON.stringify(capturasArray)
        }
      });

      const estadoSolicitud = success ? 'DEMOSTRACION_COMPLETADA' : 'FALLIDA';
      await tx.solicitudViaje.update({
        where: { id: transaccion.solicitudId },
        data: { estado: estadoSolicitud }
      });

      await tx.historialAuditoria.create({
        data: {
          solicitudId: transaccion.solicitudId,
          accion: 'RESULTADO_RPA',
          detalle: `Éxito: ${success}. Paso alcanzado: ${reachedStep}. Error: ${error || 'Ninguno'}`
        }
      });
    });

    // Enviar correo final al trabajador
    const email = transaccion.solicitud.trabajador.correo;
    const nombre = transaccion.solicitud.trabajador.nombre;
    
    console.log(`
    ===========================================
    📧 CORREO AL TRABAJADOR (RESULTADO DEMOSTRACIÓN)
    ===========================================
    Para: ${email}
    Asunto: Resultado de la demostración de compra (RPA)
    
    Hola ${nombre},
    El bot de RPA ha finalizado su ejecución en el sitio de la aerolínea.
    Resultado: ${success ? '✅ ÉXITO' : '❌ FALLO'}
    Paso alcanzado: ${reachedStep}
    ${error ? 'Error detectado: ' + error : ''}
    
    (Se han adjuntado las capturas de pantalla tomadas por el bot como evidencia)
    ===========================================
    `);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
