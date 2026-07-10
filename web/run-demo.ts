import { prisma } from './api/lib/prisma';
import { mockIgnavSearch, getIgnavBookingLink } from './api/lib/ignav';
import { rankFlights } from './api/lib/decision';
import crypto from 'crypto';

// Necesitamos importar el bot para la demostración
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { runBot } = require('../rpa-service/bot');

async function runDemo() {
  console.log("=========================================");
  console.log("🚀 INICIANDO PRUEBA DE FLUJO (MVP)");
  console.log("=========================================\n");

  // 1. Simular Formulario (Creación de solicitud)
  console.log("📝 PASO 1: El trabajador envía el formulario");
  const form = {
    nombre: "Juan Perez",
    identificacion: "1234567890",
    email: "juan@empresa.com",
    aprobadorEmail: "jefe@empresa.com",
    origen: "BOG",
    destino: "MED",
    fechaSalida: new Date(Date.now() + 5 * 86400000).toISOString(),
    presupuesto: 200,
    centroCostos: "IT",
    aerolineaPreferida: "AVIANCA",
    equipaje: true
  };

  const tokenAprobacion = crypto.randomBytes(32).toString('hex');
  
  let trabajador = await prisma.trabajador.upsert({
    where: { correo: form.email },
    update: {},
    create: { nombre: form.nombre, identificacion: form.identificacion, correo: form.email }
  });

  let aprobador = await prisma.aprobador.upsert({
    where: { correo: form.aprobadorEmail },
    update: {},
    create: { nombre: 'Jefe', correo: form.aprobadorEmail }
  });

  const solicitud = await prisma.solicitudViaje.create({
    data: {
      trabajadorId: trabajador.id,
      aprobadorId: aprobador.id,
      origen: form.origen,
      destino: form.destino,
      fechaSalida: new Date(form.fechaSalida),
      presupuestoMaximo: form.presupuesto,
      centroCostos: form.centroCostos,
      equipajeRequerido: form.equipaje ? 'SI' : 'NO',
      preferenciaAerolinea: form.aerolineaPreferida,
      estado: 'PENDIENTE',
      tokenAprobacion,
    }
  });

  console.log(`✅ Solicitud ${solicitud.id} creada en estado PENDIENTE.`);
  console.log(`📧 (Simulación) Correo enviado a ${form.aprobadorEmail} con token de aprobación.\n`);

  // 2. Simular Aprobación
  console.log("👍 PASO 2: El jefe hace clic en ACEPTAR");
  await prisma.solicitudViaje.update({
    where: { id: solicitud.id },
    data: { estado: 'APROBADA', tokenAprobacion: null }
  });
  console.log("✅ Solicitud actualizada a APROBADA.\n");

  // 3. Simular Búsqueda e IA
  console.log("🔍 PASO 3: El sistema busca vuelos y la IA decide");
  await prisma.solicitudViaje.update({ where: { id: solicitud.id }, data: { estado: 'BUSCANDO' } });
  
  const vuelos = await mockIgnavSearch(solicitud.origen, solicitud.destino, solicitud.fechaSalida);
  console.log(`✈️  Ignav devolvió ${vuelos.length} opciones.`);
  
  const bestFlight = rankFlights(vuelos, solicitud.presupuestoMaximo, solicitud.preferenciaAerolinea);
  
  if (!bestFlight) {
    console.log("❌ No se encontraron vuelos dentro del presupuesto.");
    return;
  }
  
  console.log(`🧠 IA seleccionó la mejor opción: ${bestFlight.airline} por $${bestFlight.priceUSD}`);
  console.log(`   Razón: ${bestFlight.explicacion}`);

  const bookingLink = await getIgnavBookingLink(bestFlight.id);
  
  await prisma.ofertaVuelo.create({
    data: {
      solicitudId: solicitud.id,
      ignav_id: bestFlight.id,
      booking_link: bookingLink,
      score: bestFlight.score,
      explicacion: bestFlight.explicacion,
      precio: bestFlight.priceUSD,
      aerolinea: bestFlight.airline,
      fechaHoraSalida: new Date(bestFlight.departureTime),
      fechaHoraLlegada: new Date(bestFlight.arrivalTime),
      escalas: bestFlight.stops
    }
  });

  await prisma.solicitudViaje.update({
    where: { id: solicitud.id },
    data: { estado: 'OFERTA_ENCONTRADA' }
  });
  
  console.log(`📧 (Simulación) Correo enviado a ${form.email} con la oferta encontrada.\n`);

  // 4. Simular Confirmación del Trabajador
  console.log("🖱️ PASO 4: El trabajador revisa la oferta y hace clic en CONFIRMAR EMISIÓN");
  const idempotency_key = crypto.randomUUID();

  await prisma.solicitudViaje.update({ where: { id: solicitud.id }, data: { estado: 'CONFIRMADA' } });
  
  const transaccion = await prisma.transaccionCompra.create({
    data: {
      solicitudId: solicitud.id,
      idempotency_key,
      estado_rpa: 'PENDIENTE',
      capturas: '[]'
    }
  });
  console.log(`✅ Solicitud CONFIRMADA. Iniciando RPA con key ${idempotency_key}...\n`);

  // 5. Simular RPA
  console.log("🤖 PASO 5: Ejecución del Bot RPA (Playwright)");
  process.env.HEADLESS = "true"; // correr en headless para que no moleste visualmente, o false si quisieran verlo. Lo dejamos true por defecto para rapidez
  const rpaResult = await runBot(bookingLink, {
    nombre: trabajador.nombre,
    identificacion: trabajador.identificacion,
    email: trabajador.correo
  }, idempotency_key);

  console.log(`\n📊 Resultado RPA:`);
  console.log(`   Éxito: ${rpaResult.success}`);
  console.log(`   Paso Alcanzado: ${rpaResult.reachedStep}`);
  console.log(`   Error: ${rpaResult.error || 'Ninguno'}`);
  console.log(`   Captura generada: ${rpaResult.screenshotBase64 ? 'SÍ (Base64 adjunto)' : 'NO'}\n`);

  // 6. Simular Webhook de vuelta
  console.log("🪝 PASO 6: El RPA notifica a Vercel el resultado");
  
  const nuevoEstado = rpaResult.success ? 'EXITO' : 'FALLO';
  let capturasArray = JSON.parse(transaccion.capturas || '[]');
  if (rpaResult.screenshotBase64) capturasArray.push('captura_recibida_base64');

  await prisma.transaccionCompra.update({
    where: { id: transaccion.id },
    data: {
      estado_rpa: nuevoEstado,
      paso_alcanzado: rpaResult.reachedStep,
      capturas: JSON.stringify(capturasArray)
    }
  });

  const estadoSolicitudFinal = rpaResult.success ? 'DEMOSTRACION_COMPLETADA' : 'FALLIDA';
  await prisma.solicitudViaje.update({
    where: { id: transaccion.solicitudId },
    data: { estado: estadoSolicitudFinal }
  });

  await prisma.historialAuditoria.create({
    data: {
      solicitudId: transaccion.solicitudId,
      accion: 'RESULTADO_RPA',
      detalle: `Éxito: ${rpaResult.success}. Paso alcanzado: ${rpaResult.reachedStep}. Error: ${rpaResult.error || 'Ninguno'}`
    }
  });

  console.log(`📧 (Simulación) Correo final enviado a ${trabajador.correo} con el resultado y las capturas.`);
  
  console.log("\n=========================================");
  console.log(`🎉 PRUEBA DE FLUJO FINALIZADA.`);
  console.log(`   Estado final de la solicitud: ${estadoSolicitudFinal}`);
  console.log("=========================================\n");
}

runDemo().catch(console.error).finally(() => prisma.$disconnect());
