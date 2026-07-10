
export interface IgnavFlight {
  id: string;
  airline: string;
  priceUSD: number;
  departureTime: string;
  arrivalTime: string;
  stops: number;
  durationMinutes: number;
}

const IGNAV_API_KEY = process.env.IGNAV_API_KEY || 'ignav_MS26RmSP89M-OdmkYvb-w8veK4N_m0tE';

export const mockIgnavSearch = async (
  origin: string,
  destination: string,
  date: Date
): Promise<IgnavFlight[]> => {
  const dateString = new Date(date).toISOString().split('T')[0];

  const response = await fetch('https://ignav.com/api/fares/one-way', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': IGNAV_API_KEY
    },
    body: JSON.stringify({
      origin,
      destination,
      departure_date: dateString
    })
  });

  if (!response.ok) {
    console.error('Ignav search failed:', await response.text());
    return [];
  }

  const data = await response.json();
  const options = data.booking_options || [];

  return options.map((opt: any) => {
    const outbound = opt.outbound;
    const segments = outbound.segments || [];
    const firstSegment = segments[0] || {};
    const lastSegment = segments[segments.length - 1] || {};

    return {
      id: opt.ignav_id,
      airline: outbound.carrier || firstSegment.operating_carrier_name || 'Unknown',
      priceUSD: opt.price.amount,
      departureTime: firstSegment.departure_time_local,
      arrivalTime: lastSegment.arrival_time_local,
      stops: Math.max(0, segments.length - 1),
      durationMinutes: outbound.duration_minutes
    };
  });
};

export const getIgnavBookingLink = async (ignavId: string): Promise<string> => {
  const response = await fetch('https://ignav.com/api/fares/booking-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': IGNAV_API_KEY
    },
    body: JSON.stringify({ ignav_id: ignavId })
  });

  if (!response.ok) {
    console.error('Ignav get link failed:', await response.text());
    return '';
  }

  const data = await response.json();
  const options = data.booking_options || [];
  if (options.length > 0 && options[0].links && options[0].links.length > 0) {
    return options[0].links[0].url;
  }
  
  return '';
};
