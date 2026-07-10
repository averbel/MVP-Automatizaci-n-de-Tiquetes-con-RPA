require('dotenv').config();
const express = require('express');
const { runBot } = require('./bot');
const { searchFlights } = require('./searchBot');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 4000;
const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';

// Mapa en memoria para simular control de idempotencia (en prod usar Redis o DB)
const processedKeys = new Set();

// Middleware de autenticación
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token !== `Bearer ${RPA_WEBHOOK_SECRET}`) {
    console.log(`[Auth] Token inválido. Esperado: Bearer ${RPA_WEBHOOK_SECRET.substring(0,8)}... Recibido: ${token}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.post('/api/rpa/comprar', authMiddleware, async (req, res) => {
  const { bookingLink, passengerData, idempotencyKey, callbackUrl } = req.body;

  console.log(`[RPA] Recibida solicitud de compra:`);
  console.log(`  - bookingLink: ${bookingLink}`);
  console.log(`  - passengerData: ${JSON.stringify(passengerData)}`);
  console.log(`  - idempotencyKey: ${idempotencyKey}`);
  console.log(`  - callbackUrl: ${callbackUrl}`);

  if (!bookingLink || !idempotencyKey || !callbackUrl) {
    return res.status(400).json({ error: 'Missing required fields: bookingLink, idempotencyKey, callbackUrl' });
  }

  // Verificar idempotencia
  if (processedKeys.has(idempotencyKey)) {
    console.log(`[RPA] Key ya procesada: ${idempotencyKey}`);
    return res.status(200).json({ message: 'Execution already in progress or completed for this key' });
  }
  processedKeys.add(idempotencyKey);

  // Responder rápido (fire-and-forget)
  res.status(202).json({ message: 'RPA process started', idempotencyKey });

  // Ejecutar el bot en background (sin await en la response)
  (async () => {
    try {
      console.log(`[RPA] Iniciando bot para key: ${idempotencyKey}...`);
      const result = await runBot(bookingLink, passengerData, idempotencyKey);
      console.log(`[RPA] Bot terminó. Éxito: ${result.success}, Paso: ${result.reachedStep}`);
      
      // Llamar al webhook de Vercel con el resultado
      console.log(`[RPA] Enviando resultado a callback: ${callbackUrl}`);
      const webhookResponse = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RPA_WEBHOOK_SECRET}`
        },
        body: JSON.stringify({
          idempotencyKey,
          success: result.success,
          error: result.error,
          reachedStep: result.reachedStep,
          screenshotBase64: result.screenshotBase64
        })
      });
      console.log(`[RPA] Webhook response: ${webhookResponse.status}`);
    } catch (err) {
      console.error('[RPA] Failed to execute bot or send callback:', err.message);
    }
  })();
});

app.post('/api/rpa/search', authMiddleware, async (req, res) => {
  const { origin, destination, date } = req.body;
  console.log(`[RPA Search] Búsqueda recibida: ${origin} -> ${destination} para ${date}`);
  
  if (!origin || !destination || !date) {
    return res.status(400).json({ error: 'Missing required fields: origin, destination, date' });
  }

  try {
    const flights = await searchFlights(origin, destination, date);
    console.log(`[RPA Search] Devolviendo ${flights.length} vuelos`);
    res.status(200).json({ success: true, flights });
  } catch (err) {
    console.error('[RPA Search Endpoint] Error:', err.message);
    res.status(500).json({ error: 'Failed to search flights' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[RPA Service] Escuchando en puerto ${PORT}`);
  console.log(`[RPA Service] HEADLESS: ${process.env.HEADLESS}`);
  console.log(`[RPA Service] CHROMIUM: ${process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'default'}`);
});
