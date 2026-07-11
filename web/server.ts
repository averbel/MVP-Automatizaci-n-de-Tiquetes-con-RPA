import express from 'express';
import path from 'path';

import createSolicitud from './api/solicitudes/create';
import estadoSolicitud from './api/solicitudes/estado';
import aceptarSolicitud from './api/aprobacion/aceptar';
import rechazarSolicitud from './api/aprobacion/rechazar';
import obtenerOferta from './api/ofertas/obtener';
import confirmarOferta from './api/ofertas/confirmar';
import buscarVuelos from './api/vuelos/buscar';
import webhookRpaResult from './api/webhooks/rpa-result';

const app = express();

app.use(express.json({ limit: '10mb' }));

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.post('/api/solicitudes/create', createSolicitud);
app.get('/api/solicitudes/estado', estadoSolicitud);
app.get('/api/aprobacion/aceptar', aceptarSolicitud);
app.get('/api/aprobacion/rechazar', rechazarSolicitud);
app.get('/api/ofertas/obtener', obtenerOferta);
app.post('/api/ofertas/confirmar', confirmarOferta);
app.post('/api/vuelos/buscar', buscarVuelos);
app.post('/api/webhooks/rpa-result', webhookRpaResult);

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
