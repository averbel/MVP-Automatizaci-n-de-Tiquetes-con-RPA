import { IgnavFlight } from './ignav.js'; // Reusing the same interface for simplicity

export const kayakSearch = async (
  origin: string,
  destination: string,
  date: Date
): Promise<IgnavFlight[]> => {
  const dateString = new Date(date).toISOString().split('T')[0];

  const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';
  const rpaUrl = process.env.RPA_API_URL || 'http://localhost:4000';
  
  console.log(`[kayakSearch] Buscando vuelos via RPA: ${origin} -> ${destination} para ${dateString}`);
  console.log(`[kayakSearch] RPA URL: ${rpaUrl}`);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
    
    const response = await fetch(`${rpaUrl}/api/rpa/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RPA_WEBHOOK_SECRET}`
      },
      body: JSON.stringify({
        origin,
        destination,
        date: dateString
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[kayakSearch] RPA API search failed:', response.status, errText);
      throw new Error(`RPA API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (!data || !data.success || !data.flights) {
      throw new Error('Invalid response structure from RPA Search');
    }

    console.log(`[kayakSearch] Recibidos ${data.flights.length} vuelos`);
    return data.flights;

  } catch (err: any) {
    console.error('[kayakSearch] Error:', err.message);
    // Re-lanzar para que el caller lo maneje
    throw err;
  }
};

export const getKayakBookingLink = async (
  origin: string,
  destination: string,
  dateString: string
): Promise<string> => {
  return `https://www.kayak.com/flights/${origin}-${destination}/${dateString}?sort=bestflight_a`;
};
