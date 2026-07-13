-- CreateTable
CREATE TABLE "Trabajador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "genero" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trabajador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aprobador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aprobador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudViaje" (
    "id" TEXT NOT NULL,
    "trabajadorId" TEXT NOT NULL,
    "aprobadorId" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "fechaSalida" TIMESTAMP(3) NOT NULL,
    "fechaRegreso" TIMESTAMP(3),
    "presupuestoMaximo" DOUBLE PRECISION NOT NULL,
    "centroCostos" TEXT NOT NULL,
    "equipajeRequerido" TEXT NOT NULL,
    "preferenciaAerolinea" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "tokenAprobacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitudViaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfertaVuelo" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "ignav_id" TEXT NOT NULL,
    "booking_link" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "explicacion" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "aerolinea" TEXT NOT NULL,
    "fechaHoraSalida" TIMESTAMP(3) NOT NULL,
    "fechaHoraLlegada" TIMESTAMP(3) NOT NULL,
    "escalas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfertaVuelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransaccionCompra" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "estado_rpa" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "capturas" TEXT NOT NULL,
    "paso_alcanzado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransaccionCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialAuditoria" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "capturaAsociada" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticaCorporativa" (
    "id" TEXT NOT NULL,
    "presupuestoMax" DOUBLE PRECISION NOT NULL,
    "aerolineasPermit" TEXT NOT NULL,
    "anticipacionDias" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoliticaCorporativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trabajador_correo_key" ON "Trabajador"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Aprobador_correo_key" ON "Aprobador"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudViaje_tokenAprobacion_key" ON "SolicitudViaje"("tokenAprobacion");

-- CreateIndex
CREATE UNIQUE INDEX "OfertaVuelo_solicitudId_key" ON "OfertaVuelo"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "TransaccionCompra_solicitudId_key" ON "TransaccionCompra"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "TransaccionCompra_idempotency_key_key" ON "TransaccionCompra"("idempotency_key");

-- AddForeignKey
ALTER TABLE "SolicitudViaje" ADD CONSTRAINT "SolicitudViaje_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "Trabajador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudViaje" ADD CONSTRAINT "SolicitudViaje_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Aprobador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaVuelo" ADD CONSTRAINT "OfertaVuelo_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudViaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransaccionCompra" ADD CONSTRAINT "TransaccionCompra_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudViaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAuditoria" ADD CONSTRAINT "HistorialAuditoria_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudViaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
