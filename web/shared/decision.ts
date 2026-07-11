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
  const validFlights = flights.filter(f => f.priceUSD <= presupuestoMax);

  const scored = validFlights.map(flight => {
    let score = 100;
    score -= flight.priceUSD;
    score -= flight.stops * 20;

    if (preferenciaAerolinea && flight.airline.toUpperCase() === preferenciaAerolinea.toUpperCase()) {
      score += 30;
    }

    const expl = `Opcion recomendada. $${flight.priceUSD} dentro del presupuesto de $${presupuestoMax}. ${
      flight.stops === 0 ? 'Vuelo directo.' : `${flight.stops} escala(s).`
    }${
      preferenciaAerolinea && flight.airline.toUpperCase() === preferenciaAerolinea.toUpperCase()
        ? ' Aerolinea preferida.'
        : ''
    }`;

    return { ...flight, score, explicacion: expl };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
};
