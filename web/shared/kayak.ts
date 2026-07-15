import { IgnavFlight } from './ignav.js';

export const kayakSearch = async (
  origin: string,
  destination: string,
  date: Date
): Promise<IgnavFlight[]> => {
  const dateString = new Date(date).toISOString().split('T')[0];
  const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';
  let rpaUrl = process.env.RPA_API_URL || 'http://localhost:4000';
  if (!rpaUrl.startsWith('http://') && !rpaUrl.startsWith('https://')) {
    rpaUrl = 'http://' + rpaUrl;
  }

  console.log(`[kayakSearch] ${origin} -> ${destination} para ${dateString}`);
  console.log(`[kayakSearch] RPA URL: ${rpaUrl}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${rpaUrl}/api/rpa/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RPA_WEBHOOK_SECRET}`
      },
      body: JSON.stringify({ origin, destination, date: dateString }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`RPA API Error ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    if (!data?.success || !data?.flights) {
      throw new Error('Invalid response from RPA Search');
    }

    console.log(`[kayakSearch] ${data.flights.length} vuelos recibidos`);
    return data.flights;
  } catch (err: any) {
    clearTimeout(timeout);
    console.error('[kayakSearch] Error:', err.message);
    throw err;
  }
};

export const getBookingLink = (
  origin: string,
  destination: string,
  dateString: string
): string => {
  return `https://www.google.com/travel/flights?q=Flights+from+${origin}+to+${destination}+on+${dateString}&curr=USD`;
};
