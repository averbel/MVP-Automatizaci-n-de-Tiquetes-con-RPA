import { describe, it, expect } from 'vitest';
import { rankFlights, ScoredFlight } from './decision.js';
import { IgnavFlight } from './ignav.js';

describe('Decision Engine', () => {
  const baseFlights: IgnavFlight[] = [
    { id: '1', airline: 'AVIANCA', priceUSD: 100, departureTime: '', arrivalTime: '', stops: 0, durationMinutes: 60 },
    { id: '2', airline: 'LATAM', priceUSD: 80, departureTime: '', arrivalTime: '', stops: 1, durationMinutes: 120 },
    { id: '3', airline: 'COPA', priceUSD: 150, departureTime: '', arrivalTime: '', stops: 0, durationMinutes: 60 },
  ];

  it('debe filtrar vuelos fuera de presupuesto', () => {
    const result = rankFlights(baseFlights, 90, null);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.id).toBe('2'); // Solo el de 80 pasa
  });

  it('debe retornar array vacio si ninguno pasa el presupuesto', () => {
    const result = rankFlights(baseFlights, 50, null);
    expect(result.length).toBe(0);
  });

  it('debe preferir el vuelo directo si el precio es similar y dentro del presupuesto', () => {
    // Puntaje Avianca (100): 100 - 100 - 0 = 0
    // Puntaje LATAM (80): 100 - 80 - 20(1) = 0
    // Como son iguales, el array sort puede mantener el orden original o podemos desempatar.
    // Vamos a hacer que Avianca sea 90 para que gane claramente
    const flights = [
      ...baseFlights.map(f => f.id === '1' ? { ...f, priceUSD: 90 } : f)
    ];
    
    // Puntaje Avianca (90): 100 - 90 - 0 = 10
    // Puntaje LATAM (80): 100 - 80 - 20 = 0
    const result = rankFlights(flights, 200, null);
    expect(result[0]?.id).toBe('1');
  });

  it('debe dar bono a la aerolínea preferida', () => {
    // Sin preferencia gana LATAM (80 USD, 1 escala -> score 0 vs Avianca 100 USD, 0 escalas -> score 0)
    // Con preferencia LATAM, LATAM suma 30 puntos -> score 30
    const result = rankFlights(baseFlights, 200, 'LATAM');
    expect(result[0]?.id).toBe('2');
    expect(result[0]?.score).toBe(30);
  });
});
