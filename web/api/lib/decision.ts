import { IgnavFlight } from './ignav';

export interface ScoredFlight extends IgnavFlight {
  score: number;
  explicacion: string;
}

export const rankFlights = (
  flights: IgnavFlight[],
  presupuestoMax: number,
  preferenciaAerolinea: string | null
): ScoredFlight[] => {
  // 1. Filtrar por presupuesto
  const validFlights = flights.filter(f => f.priceUSD <= presupuestoMax);

  if (validFlights.length === 0) {
    return [];
  }

  // 2. Scoring
  // Criterios simples: 
  // - Precio (menor es mejor)
  // - Escalas (menor es mejor)
  // - Aerolínea preferida (bonus)
  
  const scored = validFlights.map(flight => {
    let score = 100;
    
    // Penalizar precio: -1 punto por cada dólar
    score -= flight.priceUSD;
    
    // Penalizar escalas: -20 puntos por cada escala
    score -= flight.stops * 20;
    
    // Bonus aerolínea
    if (preferenciaAerolinea && flight.airline.toUpperCase() === preferenciaAerolinea.toUpperCase()) {
      score += 30;
    }

    // Explicación
    const expl = `Esta es la mejor opción. Cuesta $${flight.priceUSD}, lo cual está dentro de tu presupuesto de $${presupuestoMax}. ${
      flight.stops === 0 ? 'Es un vuelo directo.' : `Tiene ${flight.stops} escalas.`
    } ${
      preferenciaAerolinea && flight.airline.toUpperCase() === preferenciaAerolinea.toUpperCase() ? 'Además, opera con tu aerolínea preferida.' : ''
    }`;

    return {
      ...flight,
      score,
      explicacion: expl
    };
  });

  // Ordenar por mayor puntaje
  scored.sort((a, b) => b.score - a.score);

  return scored;
};
