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
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.post('/api/rpa/comprar', authMiddleware, async (req, res) => {
  const { bookingLink, passengerData, idempotencyKey, callbackUrl } = req.body;

  if (!bookingLink || !idempotencyKey || !callbackUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Verificar idempotencia
  if (processedKeys.has(idempotencyKey)) {
    return res.status(200).json({ message: 'Execution already in progress or completed for this key' });
  }
  processedKeys.add(idempotencyKey);

  // Responder rápido (fire-and-forget)
  res.status(202).json({ message: 'RPA process started', idempotencyKey });

  // Ejecutar el bot en background
  try {
    const result = await runBot(bookingLink, passengerData, idempotencyKey);
    
    // Llamar al webhook de Vercel con el resultado
    console.log(`[RPA] Llamando al callback de Vercel: ${callbackUrl}`);
    await fetch(callbackUrl, {
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
  } catch (err) {
    console.error('[RPA] Failed to execute bot or send callback:', err);
  }
});

app.post('/api/rpa/search', authMiddleware, async (req, res) => {
  const { origin, destination, date } = req.body;
  if (!origin || !destination || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const flights = await searchFlights(origin, destination, date);
    res.status(200).json({ success: true, flights });
  } catch (err) {
    console.error('[RPA Search Endpoint] Error:', err);
    res.status(500).json({ error: 'Failed to search flights' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`RPA Service listening on port ${PORT}`);
});
