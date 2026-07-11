<template>
  <main class="min-h-screen relative overflow-hidden font-sans text-slate-800 bg-slate-900">
    <!-- Background Image with Overlay -->
    <div class="absolute inset-0 z-0">
      <img src="/airline_bg.png" alt="Airline Background" class="w-full h-full object-cover opacity-80" />
      <div class="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"></div>
    </div>

    <!-- PANTALLA 1: FORMULARIO -->
    <div v-if="estado === 'FORM'" class="relative z-10 container mx-auto px-4 py-12 lg:py-24 min-h-screen flex flex-col lg:flex-row items-center gap-12">
      <div class="lg:w-1/2 space-y-8 animate-fade-in-up text-white">
        <div class="inline-flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm">
          <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span class="text-sm font-medium tracking-wide">Portal Corporativo Global</span>
        </div>
        <h1 class="text-5xl lg:text-7xl font-extrabold tracking-tight text-glow">
          Eleva tus <span class="text-amber-400">viajes</span> de negocios.
        </h1>
        <p class="text-xl text-slate-300 max-w-xl font-light leading-relaxed">
          Solicita tu vuelo y nuestra IA avanzada se encargará de encontrar la mejor opción dentro de nuestra política corporativa. Una experiencia de primera clase.
        </p>
      </div>

      <div class="lg:w-1/2 w-full max-w-2xl animate-slide-in-right">
        <div class="glass rounded-[2rem] shadow-2xl overflow-hidden border border-white/40">
          <div class="p-8 sm:p-12 space-y-8">
            <div class="space-y-2">
              <h2 class="text-2xl font-bold text-slate-900">Nueva Solicitud</h2>
              <p class="text-slate-600">Completa los detalles para tu próximo destino.</p>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-8">
              <!-- Datos del Viajero -->
              <div class="space-y-5">
                <div class="flex items-center space-x-3 border-b border-slate-200/60 pb-2">
                  <div class="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                  <h3 class="font-semibold text-slate-800">Datos del Viajero</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div class="group">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Nombre Completo</label>
                    <input v-model="form.nombre" type="text" required class="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300" />
                  </div>
                  <div class="group">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Identificación</label>
                    <input v-model="form.identificacion" type="text" required class="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300" />
                  </div>
                  <div class="group">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tu Correo</label>
                    <input v-model="form.email" type="email" required class="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300" />
                  </div>
                  <div class="group">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Correo Aprobador</label>
                    <input v-model="form.aprobadorEmail" type="email" required class="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300" />
                  </div>
                </div>
              </div>

              <!-- Itinerario -->
              <div class="space-y-5">
                <div class="flex items-center space-x-3 border-b border-slate-200/60 pb-2">
                  <div class="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                  <h3 class="font-semibold text-slate-800">Itinerario y Preferencias</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div class="group relative">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Origen</label>
                    <input v-model="form.origen" type="text" required placeholder="Ej. BOG" class="w-full bg-white/60 border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300 uppercase font-bold text-slate-800" />
                  </div>
                  <div class="group relative">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Destino</label>
                    <input v-model="form.destino" type="text" required placeholder="Ej. MDE" class="w-full bg-white/60 border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300 uppercase font-bold text-slate-800" />
                  </div>
                  <div class="group">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Salida</label>
                    <input v-model="form.fechaSalida" type="datetime-local" required class="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300" />
                  </div>
                  <div class="group">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Regreso (Opc)</label>
                    <input v-model="form.fechaRegreso" type="datetime-local" class="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300" />
                  </div>
                  <div class="group">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Presupuesto USD</label>
                    <div class="relative">
                      <span class="absolute left-3 top-3.5 text-slate-400 font-bold">$</span>
                      <input v-model.number="form.presupuesto" type="number" required min="1" step="0.01" class="w-full bg-white/60 border border-slate-200 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300 font-medium" />
                    </div>
                  </div>
                  <div class="group">
                    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Centro Costos</label>
                    <input v-model="form.centroCostos" type="text" required class="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm group-hover:border-blue-300" />
                  </div>
                </div>
              </div>

              <!-- Submit Button -->
              <button type="submit" :disabled="loading" class="w-full flex justify-center items-center py-4 px-6 rounded-xl text-lg font-bold text-white transition-all shadow-xl hover:shadow-blue-500/30 overflow-hidden relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:-translate-y-1">
                <div v-if="loading" class="flex items-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Enviando Solicitud...
                </div>
                <div v-else class="flex items-center">
                  <span>Solicitar Autorización</span>
                </div>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- PANTALLA 2: ESPERANDO APROBACIÓN -->
    <div v-else-if="estado === 'ESPERANDO_APROBACION'" class="relative z-10 min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full glass rounded-3xl shadow-2xl p-10 text-center space-y-6 animate-fade-in-up">
        <div class="relative w-24 h-24 mx-auto flex items-center justify-center">
          <div class="absolute inset-0 border-4 border-blue-500/30 rounded-full animate-ping"></div>
          <div class="absolute inset-2 border-4 border-t-blue-600 rounded-full animate-spin"></div>
          <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 class="text-3xl font-bold text-slate-900">Esperando Aprobación</h2>
        <p class="text-slate-700 font-medium">Hemos notificado a tu jefe. Por favor, no cierres esta pestaña. Cuando apruebe la solicitud, te mostraremos las opciones de vuelo inmediatamente.</p>
      </div>
    </div>

    <!-- PANTALLA 3: BUSCANDO VUELOS -->
    <div v-else-if="estado === 'BUSCANDO_VUELOS'" class="relative z-10 min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full glass rounded-3xl shadow-2xl p-10 text-center space-y-6 animate-fade-in-up">
        <div class="w-24 h-24 mx-auto text-amber-500 animate-bounce">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" /></svg>
        </div>
        <h2 class="text-3xl font-bold text-slate-900">Buscando Vuelos...</h2>
        <p class="text-slate-700 font-medium">Tu solicitud fue aprobada. Nuestra IA está consultando tarifas y analizando la mejor opción.</p>
      </div>
    </div>

    <!-- PANTALLA 3.5: SIN OPCIONES -->
    <div v-else-if="estado === 'SIN_OPCIONES'" class="relative z-10 min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full glass rounded-3xl shadow-2xl p-10 text-center space-y-6 animate-fade-in-up">
        <div class="w-24 h-24 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto backdrop-blur-md">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
        <h2 class="text-3xl font-bold text-slate-900">No se encontraron vuelos</h2>
        <p class="text-slate-700 font-medium">No hay vuelos disponibles para esta ruta y fecha dentro de tu presupuesto. Intenta con otras fechas o destinos.</p>
        <button @click="resetFlow" class="w-full bg-slate-900 hover:bg-slate-700 text-white font-semibold py-4 rounded-xl transition-colors">Volver al Inicio</button>
      </div>
    </div>

    <!-- PANTALLA 4: RESULTADOS VUELOS -->
    <div v-else-if="estado === 'SELECCIONANDO_VUELO'" class="relative z-10 min-h-screen p-8 lg:p-24 animate-fade-in-up text-slate-800">
      <div class="max-w-6xl mx-auto">
        <template v-if="opcionesVuelo.length > 0">
          <h2 class="text-4xl font-bold text-white text-glow mb-2">Vuelos Disponibles</h2>
          <p class="text-slate-300 mb-8 text-lg">La IA ha calificado estas opciones según la política de viajes.</p>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div v-for="(vuelo, index) in opcionesVuelo" :key="vuelo.id" 
                 class="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col transform transition hover:-translate-y-2 hover:shadow-2xl"
                 :class="{'ring-4 ring-amber-400': index === 0}">
              
              <div v-if="index === 0" class="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-2 font-bold uppercase tracking-wider text-sm">
                ⭐ Recomendación de la IA
              </div>
              
              <div class="p-6 flex-grow space-y-4">
                <div class="flex justify-between items-center border-b pb-4">
                  <span class="text-2xl font-black text-slate-900">{{ vuelo.airline }}</span>
                  <span class="text-3xl font-bold text-blue-600">${{ vuelo.priceUSD }}</span>
                </div>
                
                <div class="flex justify-between items-center text-sm text-slate-600">
                  <div class="text-center">
                    <p class="font-bold text-slate-800 text-lg">{{ new Date(vuelo.departureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</p>
                    <p>Salida</p>
                  </div>
                  <div class="flex-grow text-center px-4">
                    <p class="text-xs text-slate-400">{{ vuelo.stops === 0 ? 'Directo' : vuelo.stops + ' Escala(s)' }}</p>
                    <div class="h-px bg-slate-300 w-full relative my-2">
                      <span class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-400">✈️</span>
                    </div>
                  </div>
                  <div class="text-center">
                    <p class="font-bold text-slate-800 text-lg">{{ new Date(vuelo.arrivalTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</p>
                    <p>Llegada</p>
                  </div>
                </div>

                <div class="bg-blue-50 p-4 rounded-xl text-sm text-blue-900 border border-blue-100">
                  <p><strong>Score IA: {{ vuelo.score }}/100</strong></p>
                  <p class="italic mt-1">"{{ vuelo.explicacion }}"</p>
                </div>
              </div>
              
              <div class="p-6 bg-slate-50 border-t border-slate-100">
                <button @click="comprarVuelo(vuelo)" class="w-full bg-slate-900 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-colors">
                  Elegir y Comprar
                </button>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="max-w-md mx-auto text-center glass rounded-3xl shadow-2xl p-10 space-y-6">
            <div class="w-24 h-24 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto backdrop-blur-md">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h2 class="text-3xl font-bold text-white">No se encontraron vuelos</h2>
            <p class="text-slate-300 font-medium">No hay vuelos disponibles para esta ruta y fecha dentro de tu presupuesto. Intenta con otras fechas o destinos.</p>
            <button @click="resetFlow" class="w-full bg-slate-900 hover:bg-slate-700 text-white font-semibold py-4 rounded-xl transition-colors">Volver al Inicio</button>
          </div>
        </template>
      </div>
    </div>

    <!-- PANTALLA 5: RPA EJECUTANDO -->
    <div v-else-if="estado === 'RPA_EJECUTANDO'" class="relative z-10 min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full glass rounded-3xl shadow-2xl p-10 text-center space-y-6 animate-fade-in-up">
        <div class="w-24 h-24 mx-auto text-indigo-500 animate-pulse flex items-center justify-center">
          <span class="text-6xl">🤖</span>
        </div>
        <h2 class="text-3xl font-bold text-slate-900">El Bot RPA está comprando tu vuelo</h2>
        <p class="text-slate-700 font-medium">No cierres la página. El robot está navegando en el sitio de la aerolínea, llenando tus datos y finalizando la reserva.</p>
        
        <div class="w-full bg-slate-200 rounded-full h-2 mt-4 overflow-hidden">
          <div class="bg-indigo-600 h-2 rounded-full w-full animate-pulse"></div>
        </div>
      </div>
    </div>

    <!-- PANTALLA 6: COMPLETADO -->
    <div v-else-if="estado === 'RPA_COMPLETADO'" class="relative z-10 min-h-screen flex items-center justify-center p-4">
      <div class="max-w-md w-full glass rounded-3xl shadow-2xl p-10 text-center space-y-6 animate-fade-in-up">
        <div class="w-24 h-24 bg-green-500/20 text-green-600 rounded-full flex items-center justify-center mx-auto backdrop-blur-md">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 class="text-3xl font-bold text-slate-900">¡Proceso Terminado!</h2>
        <p class="text-slate-700 font-medium">El bot completó el flujo exitosamente. Recibirás en tu correo los tiquetes oficiales en unos minutos.</p>
        
        <div v-if="capturaResult" class="mt-6">
          <p class="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Evidencia del Bot</p>
          <img :src="capturaResult" class="w-full rounded-xl shadow-lg border-2 border-slate-200" alt="Captura RPA" />
        </div>

        <button @click="resetFlow" class="w-full bg-slate-900 hover:bg-slate-700 text-white font-semibold py-4 rounded-xl transition-colors mt-6">Volver al Inicio</button>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const estado = ref('FORM'); // FORM, BUSCANDO_VUELOS, SELECCIONANDO_VUELO, RPA_EJECUTANDO, RPA_COMPLETADO, SIN_OPCIONES
const loading = ref(false);
const currentSolicitudId = ref('');
const opcionesVuelo = ref<any[]>([]);
const capturaResult = ref<string | null>(null);

const form = ref({
  nombre: '',
  identificacion: '',
  email: '',
  aprobadorEmail: '',
  origen: '',
  destino: '',
  fechaSalida: '',
  fechaRegreso: '',
  presupuesto: null,
  centroCostos: '',
  aerolineaPreferida: '',
  equipaje: false
});

let pollInterval: any = null;

const handleSubmit = async () => {
  loading.value = true;
  try {
    const res = await fetch("/api/solicitudes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.value),
    });

    if (res.ok) {
      const data = await res.json();
      currentSolicitudId.value = data.solicitudId; 
      estado.value = 'BUSCANDO_VUELOS';
      await fetchVuelos();
    } else {
      alert("Error al enviar la solicitud.");
    }
  } catch (err) {
    alert("Error de conexión con el servidor.");
  } finally {
    loading.value = false;
  }
};

const fetchVuelos = async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);
    
    const res = await fetch('/api/vuelos/buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitudId: currentSolicitudId.value }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (res.ok) {
      const data = await res.json();
      if (data.options && data.options.length > 0) {
        opcionesVuelo.value = data.options;
        estado.value = 'SELECCIONANDO_VUELO';
      } else {
        estado.value = 'SIN_OPCIONES';
      }
    } else {
      // Si falla, intentar polling como fallback
      startBusquedaPolling();
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      // Timeout - intentar polling
      startBusquedaPolling();
    } else {
      startBusquedaPolling();
    }
  }
};

const startBusquedaPolling = () => {
  pollInterval = setInterval(async () => {
    if (estado.value !== 'BUSCANDO_VUELOS') {
      clearInterval(pollInterval);
      return;
    }
    try {
      const res = await fetch(`/api/solicitudes/estado?id=${currentSolicitudId.value}`);
      if (res.ok) {
        const data = await res.json();
        if (data.estado === 'OPCIONES_LISTAS' && data.opciones && data.opciones.length > 0) {
          opcionesVuelo.value = data.opciones;
          estado.value = 'SELECCIONANDO_VUELO';
          clearInterval(pollInterval);
        } else if (data.estado === 'SIN_OPCIONES') {
          estado.value = 'SIN_OPCIONES';
          clearInterval(pollInterval);
        } else if (data.estado === 'FALLIDA') {
          alert('Error al buscar vuelos. Intenta de nuevo.');
          clearInterval(pollInterval);
          resetFlow();
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, 2000);
};

const comprarVuelo = async (vuelo: any) => {
  estado.value = 'RPA_EJECUTANDO';
  try {
    const res = await fetch('/api/ofertas/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitudId: currentSolicitudId.value, flight: vuelo, aceptar: true })
    });
    
    if (res.ok) {
      startRpaPolling();
    } else {
      alert("Error al lanzar RPA.");
      resetFlow();
    }
  } catch (e) {
    alert("Error de conexión al comprar.");
    resetFlow();
  }
};

const startRpaPolling = () => {
  pollInterval = setInterval(async () => {
    if (estado.value !== 'RPA_EJECUTANDO') {
      clearInterval(pollInterval);
      return;
    }
    
    try {
      const res = await fetch(`/api/solicitudes/estado?id=${currentSolicitudId.value}`);
      if (res.ok) {
        const data = await res.json();
        if (data.estado_rpa === 'EXITO') {
          if (data.capturas && data.capturas.length > 0) {
            capturaResult.value = data.capturas[data.capturas.length - 1];
          }
          estado.value = 'RPA_COMPLETADO';
          clearInterval(pollInterval);
        } else if (data.estado_rpa === 'FALLO') {
          alert('El bot falló al intentar realizar la compra.');
          clearInterval(pollInterval);
          resetFlow();
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, 2000);
};

const resetFlow = () => {
  if (pollInterval) clearInterval(pollInterval);
  estado.value = 'FORM';
  opcionesVuelo.value = [];
  capturaResult.value = null;
  currentSolicitudId.value = '';
  form.value = {
    nombre: '', identificacion: '', email: '', aprobadorEmail: '',
    origen: '', destino: '', fechaSalida: '', fechaRegreso: '',
    presupuesto: null, centroCostos: '', aerolineaPreferida: '', equipaje: false
  };
};
</script>
