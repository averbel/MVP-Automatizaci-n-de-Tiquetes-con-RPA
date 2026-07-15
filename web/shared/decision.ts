import { IgnavFlight } from './ignav.js';

export interface ScoredFlight extends IgnavFlight {
  score: number;
  explicacion: string;
}

export const rankFlights = (
  flights: IgnavFlight[],
  presupuestoMax: number,
  preferenciaAerolinea: string | null
): ScoredFlight[] => {
  let validFlights = flights.filter(f => f.priceUSD <= presupuestoMax);
  let overBudget = false;

  // Si ningun vuelo esta dentro del presupuesto, usar todos y marcarlos
  if (validFlights.length === 0 && flights.length > 0) {
    validFlights = [...flights];
    overBudget = true;
  }

  const scored = validFlights.map(flight => {
    let score = 100;
    
    if (flight.priceUSD > presupuestoMax) {
      score -= 40; // Penalidad severa por salir del presupuesto
    } else {
      score -= Math.min(flight.priceUSD / 10, 30);
    }
    
    score -= flight.stops * 20;

    if (preferenciaAerolinea && flight.airline.toUpperCase() === preferenciaAerolinea.toUpperCase()) {
      score += 20;
    }

    let expl = flight.priceUSD > presupuestoMax 
      ? `Fuera de presupuesto por $${flight.priceUSD - presupuestoMax}. `
      : `Opcion recomendada. $${flight.priceUSD} dentro del presupuesto. `;

    expl += flight.stops === 0 ? 'Vuelo directo.' : `${flight.stops} escala(s).`;
    
    if (preferenciaAerolinea && flight.airline.toUpperCase() === preferenciaAerolinea.toUpperCase()) {
      expl += ' Aerolinea preferida.';
    }

    // Asegurar que el score no sea negativo
    score = Math.max(0, Math.round(score));

    return { ...flight, score, explicacion: expl };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
};
