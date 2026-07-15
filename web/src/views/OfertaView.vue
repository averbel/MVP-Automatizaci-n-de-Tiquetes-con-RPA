<template>
  <main class="min-h-screen relative overflow-hidden font-sans text-slate-100 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
    <!-- Background Image -->
    <div class="absolute inset-0 z-0">
      <img src="/airline_bg.png" alt="Airline Background" class="w-full h-full object-cover opacity-60" />
      <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
    </div>

    <div class="relative z-10 max-w-3xl mx-auto space-y-8 mt-10">
      <div class="text-center space-y-3 animate-fade-in-up">
        <div class="inline-flex items-center space-x-2 bg-indigo-500/20 px-4 py-2 rounded-full border border-indigo-500/30 backdrop-blur-md">
          <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          <span class="text-indigo-200 text-sm font-semibold tracking-wide">Aprobación Pendiente</span>
        </div>
        <h1 class="text-4xl font-extrabold text-white tracking-tight text-glow">Confirma tu Emisión</h1>
        <p class="text-slate-300 text-lg">Por favor revisa la oferta de vuelo propuesta por nuestra Inteligencia Artificial.</p>
      </div>

      <div v-if="loading" class="flex justify-center p-12 animate-fade-in-up">
        <div class="glass-dark p-8 rounded-full shadow-2xl flex items-center space-x-4 border border-white/10">
          <svg class="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-white font-semibold tracking-wide">Recuperando itinerario...</span>
        </div>
      </div>

      <div v-else-if="error" class="glass-dark bg-red-900/40 text-red-100 p-8 rounded-2xl border border-red-500/50 shadow-2xl text-center animate-fade-in-up">
        <svg class="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <p class="text-lg font-medium">{{ error }}</p>
      </div>

      <div v-else-if="oferta" class="animate-slide-in-right relative shadow-2xl">
        <!-- Boarding Pass Top Section -->
        <div class="glass-dark rounded-t-[2rem] border-glow border-b-0 overflow-hidden perforated-edge relative z-20">
          <div class="bg-gradient-to-r from-cyan-900/50 to-slate-900/80 backdrop-blur-md border-b border-white/10 p-8 text-white relative overflow-hidden">
            <div class="absolute top-0 right-0 opacity-10">
               <svg class="w-64 h-64 -mt-16 -mr-16" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            </div>
            
            <div class="relative z-10 flex justify-between items-start">
              <div>
                <p class="text-blue-300 font-bold tracking-widest uppercase text-xs mb-1">Aerolínea Operadora</p>
                <h2 class="text-4xl font-black tracking-tight">{{ oferta.aerolinea }}</h2>
              </div>
              <div class="text-right">
                <div class="bg-cyan-500 text-slate-900 shadow-[0_0_10px_rgba(6,182,212,0.5)] font-bold px-3 py-1 rounded-full text-sm inline-block mb-2 shadow-lg">
                  BUSINESS CLASS
                </div>
                <p class="text-slate-300 text-xs uppercase tracking-widest">Costo Estimado</p>
                <p class="text-3xl font-bold"><span class="text-xl">$</span>{{ oferta.precio }} <span class="text-lg text-slate-400 font-medium">{{ oferta.moneda }}</span></p>
              </div>
            </div>
          </div>

          <div class="p-8 pb-10 bg-transparent">
            <div class="grid grid-cols-2 gap-8 relative">
              <div class="space-y-6">
                 <div>
                   <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Escalas</p>
                   <p class="text-xl font-bold text-white">{{ oferta.escalas === 0 ? 'Directo' : oferta.escalas + ' escala(s)' }}</p>
                 </div>
                 <div>
                   <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Score IA</p>
                   <div class="flex items-center">
                     <span class="text-2xl font-black text-green-400 mr-2">{{ oferta.score ? oferta.score.toFixed(1) : 100 }}</span>
                     <span class="text-slate-400 font-medium">/ 100</span>
                   </div>
                 </div>
              </div>

              <div class="space-y-2 border-l-2 border-dashed border-slate-700 pl-8">
                 <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center">
                   <svg class="w-4 h-4 mr-1 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                   Análisis de IA
                 </p>
                 <p class="text-slate-300 font-medium italic leading-relaxed text-sm bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                   "{{ oferta.explicacionIA }}"
                 </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Boarding Pass Bottom Section -->
        <div class="glass-dark rounded-b-[2rem] p-8 pt-10 border-t border-dashed border-slate-700 shadow-inner border-glow relative z-10">
          <div class="flex space-x-4">
            <button @click="confirmar(true)" :disabled="procesando" class="flex-1 bg-cyan-600 hover:bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] border-none text-white font-bold py-5 px-6 rounded-xl transition-all shadow-xl hover:shadow-2xl text-lg flex items-center justify-center border border-slate-700 hover:-translate-y-1">
              <span v-if="procesando" class="flex items-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Emitiendo...
              </span>
              <span v-else class="flex items-center">
                Confirmar Emisión
                <svg class="ml-2 w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              </span>
            </button>
            <button @click="confirmar(false)" :disabled="procesando" class="bg-slate-800 hover:bg-red-900/30 text-red-400 border-red-900/50 font-bold py-5 px-8 rounded-xl border border-red-200 transition-all shadow-sm text-lg flex items-center justify-center group">
              <span class="group-hover:scale-105 transition-transform">Rechazar</span>
            </button>
          </div>
          <div class="mt-8 text-center text-slate-400 text-xs">
            <p>Este documento es generado automáticamente y es intransferible.</p>
            <div class="mt-3 flex justify-center space-x-1 opacity-50">
              <div v-for="i in 12" :key="i" class="w-1 h-8 bg-slate-400" :style="`width: ${Math.random() * 4 + 1}px`"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const id = route.params.id;

const loading = ref(true);
const procesando = ref(false);
const error = ref('');
const oferta = ref<any>(null);

const fetchOferta = async () => {
  try {
    const res = await fetch((import.meta.env.VITE_API_URL || '') + `/api/ofertas/obtener?solicitudId=${id}`);
    if (!res.ok) throw new Error('No se pudo cargar la oferta. Es posible que el enlace haya expirado o ya se haya procesado.');
    const data = await res.json();
    oferta.value = data.oferta;
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const confirmar = async (decision: boolean) => {
  procesando.value = true;
  try {
    const res = await fetch((import.meta.env.VITE_API_URL || '') + `/api/ofertas/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitudId: id, aceptar: decision })
    });
    if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Error al procesar tu decisión.');
    }
    
    if (decision) {
      alert('¡Vuelo emitido con éxito! Pronto recibirás tus pasajes.');
    } else {
      alert('Has rechazado la opción. El aprobador será notificado.');
    }
  } catch (err: any) {
    alert(err.message);
  } finally {
    procesando.value = false;
  }
};

onMounted(() => {
  fetchOferta();
});
</script>
