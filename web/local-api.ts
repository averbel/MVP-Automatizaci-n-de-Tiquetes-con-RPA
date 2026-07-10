import express from 'express';
import cors from 'cors';

import apiSolicitudesCreate from './api/solicitudes/create';
import apiSolicitudesEstado from './api/solicitudes/estado';
import apiAprobacionAceptar from './api/aprobacion/aceptar';
import apiAprobacionRechazar from './api/aprobacion/rechazar';
import apiOfertasObtener from './api/ofertas/obtener';
import apiOfertasConfirmar from './api/ofertas/confirmar';
import apiVuelosBuscar from './api/vuelos/buscar';
import apiWebhooksRpaResult from './api/webhooks/rpa-result';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// Adaptador simple Express -> Vercel API
const adapt = (handler: any) => async (req: express.Request, res: express.Response) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error("API Error:", err);
    if (!res.headersSent) res.status(500).end();
  }
};

app.post('/api/solicitudes/create', adapt(apiSolicitudesCreate));
app.get('/api/solicitudes/estado', adapt(apiSolicitudesEstado));
app.get('/api/aprobacion/aceptar', adapt(apiAprobacionAceptar));
app.get('/api/aprobacion/rechazar', adapt(apiAprobacionRechazar));
app.get('/api/ofertas/obtener', adapt(apiOfertasObtener));
app.post('/api/ofertas/confirmar', adapt(apiOfertasConfirmar));
app.post('/api/vuelos/buscar', adapt(apiVuelosBuscar));
app.post('/api/webhooks/rpa-result', adapt(apiWebhooksRpaResult));

const port = 3001;
app.listen(port, () => console.log(`[API Local] Servidor Express simulando Vercel escuchando en puerto ${port}`));
