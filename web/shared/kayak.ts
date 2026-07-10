import { IgnavFlight } from './ignav.js'; // Reusing the same interface for simplicity

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'your-rapidapi-key';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'kayak-flight-search.p.rapidapi.com';

// Local proxy fallback for testing, default to RapidAPI
const API_BASE_URL = process.env.KAYAK_API_URL || `https://${RAPIDAPI_HOST}`;

export const kayakSearch = async (
  origin: string,
  destination: string,
  date: Date
): Promise<IgnavFlight[]> => {
  const dateString = new Date(date).toISOString().split('T')[0];

  try {
    const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';
    const response = await fetch(`http://localhost:4000/api/rpa/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RPA_WEBHOOK_SECRET}`
      },
      body: JSON.stringify({
        origin,
        destination,
        date: dateString
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('RPA API search failed:', errText);
      throw new Error(`RPA API Error: ${errText}`);
    }

    const data = await response.json();
    if (!data || !data.success || !data.flights) {
      throw new Error('Invalid response structure from RPA Search');
    }

    return data.flights;

  } catch (err: any) {
    console.error('Error fetching from RPA API:', err);
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
