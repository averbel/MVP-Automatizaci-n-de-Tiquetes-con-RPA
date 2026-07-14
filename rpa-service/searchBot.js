const { chromium } = require('playwright');

async function searchFlights(origin, destination, dateString) {
  console.log(`[RPA Search] ${origin} -> ${destination} para ${dateString}`);
  
  let browser = null;
  const flights = [];
  
  try {
    browser = await chromium.launch({ 
      headless: process.env.HEADLESS !== 'false',
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', 
        '--disable-gpu', '--disable-blink-features=AutomationControlled',
        '--disable-extensions', '--disable-background-networking',
        '--disable-default-apps', '--disable-sync',
        '--window-size=1366,768'
      ] 
    });
    
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
    });
    
    const page = await context.newPage();

    const apiResponses = [];

    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      if (contentType.includes('json') || url.includes('flights') || url.includes('search')) {
        if (url.includes('kayak.com') && (
          url.includes('/s/') ||
          url.includes('search') ||
          url.includes('itinerary') ||
          url.includes('flight') ||
          url.includes('graphql') ||
          url.includes('api')
        )) {
          try {
            const body = await response.json();
            apiResponses.push({ url, body });
            console.log(`[RPA Search] Captured API: ${url.substring(0, 120)}`);
          } catch {}
        }
      }
    });

    await page.route('**/*', route => {
      const url = route.request().url();
      const type = route.request().resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        return route.abort();
      }
      if (url.includes('doubleclick') || url.includes('googlesyndication') ||
          url.includes('google-analytics') || url.includes('facebook.net') ||
          url.includes('hotjar') || url.includes('sentry') ||
          url.includes('criteo') || url.includes('prebid')) {
        return route.abort();
      }
      return route.continue();
    });
    
    const searchUrl = `https://www.kayak.com/flights/${origin}-${destination}/${dateString}?sort=bestflight_a`;
    console.log(`[RPA Search] Navegando a: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });

    try {
      const consentBtn = page.locator('button:has-text("Accept"), button:has-text("Got it"), button:has-text("Acepto"), [id*="consent"] button');
      await consentBtn.first().click({ timeout: 4000 });
      console.log('[RPA Search] Cookie consent dismissed');
    } catch {
      console.log('[RPA Search] No cookie banner found');
    }

    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch {
      console.log('[RPA Search] networkidle timeout, continuing with captured data');
    }

    await page.waitForTimeout(10000);

    console.log(`[RPA Search] Captured ${apiResponses.length} API responses`);

    for (const resp of apiResponses) {
      const parsed = extractFromApiResponse(resp.body, dateString);
      if (parsed.length > 0) {
        flights.push(...parsed);
        console.log(`[RPA Search] Extracted ${parsed.length} flights from API response`);
        break;
      }
    }

    if (flights.length === 0) {
      console.log('[RPA Search] API interception failed, falling back to DOM extraction...');
      const domFlights = await extractFromDOM(page, dateString);
      flights.push(...domFlights);
    }

  } catch (error) {
    console.error('[RPA Search] Error:', error.message);
    console.error('[RPA Search] Stack:', error.stack);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  
  console.log(`[RPA Search] Returning ${flights.length} flights`);
  return flights;
}

function extractFromApiResponse(body, dateString) {
  const results = [];

  try {
    if (body && typeof body === 'object') {
      const searchResult = body.searchResults || body.results || body.itineraries;
      if (Array.isArray(searchResult)) {
        for (const item of searchResult.slice(0, 5)) {
          const flight = parseItinerary(item, dateString);
          if (flight) results.push(flight);
        }
        if (results.length > 0) return results;
      }

      if (body.data) {
        const data = body.data;
        const itineraries = data.searchResults || data.itineraries || data.flights;
        if (Array.isArray(itineraries)) {
          for (const item of itineraries.slice(0, 5)) {
            const flight = parseItinerary(item, dateString);
            if (flight) results.push(flight);
          }
          if (results.length > 0) return results;
        }
      }

      if (body.flights && Array.isArray(body.flights)) {
        for (const item of body.flights.slice(0, 5)) {
          const flight = parseItinerary(item, dateString);
          if (flight) results.push(flight);
        }
        if (results.length > 0) return results;
      }

      const flatResults = findItinerariesInObject(body);
      for (const item of flatResults.slice(0, 5)) {
        const flight = parseItinerary(item, dateString);
        if (flight) results.push(flight);
      }
    }
  } catch (e) {
    console.error('[RPA Search] API parse error:', e.message);
  }

  return results;
}

function findItinerariesInObject(obj, depth = 0) {
  if (depth > 6 || !obj || typeof obj !== 'object') return [];
  
  const results = [];

  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj[0] && (obj[0].legs || obj[0].price || obj[0].airline || obj[0].carrier)) {
      return obj;
    }
    for (const item of obj) {
      results.push(...findItinerariesInObject(item, depth + 1));
      if (results.length > 0) return results;
    }
  } else {
    for (const key of Object.keys(obj)) {
      results.push(...findItinerariesInObject(obj[key], depth + 1));
      if (results.length > 0) return results;
    }
  }

  return results;
}

function parseItinerary(item, dateString) {
  try {
    if (!item) return null;

    let airline = '';
    let price = 0;
    let depTime = '';
    let arrTime = '';
    let stops = 0;
    let duration = 180;

    if (item.legs && Array.isArray(item.legs) && item.legs.length > 0) {
      const leg = item.legs[0];
      airline = leg.carrier || leg.airline || leg.operatingCarrier || '';
      depTime = leg.departureTime || leg.departure || '';
      arrTime = leg.arrivalTime || leg.arrival || '';
      stops = leg.stops != null ? leg.stops : (leg.legStops ? leg.legStops.length : 0);
      duration = leg.duration || leg.durationMinutes || 180;
    }

    if (!airline) airline = item.airline || item.carrier || item.operatingCarrier || '';
    
    if (item.price) {
      if (typeof item.price === 'object') {
        price = item.price.amount || item.price.value || item.price.raw || 0;
      } else {
        price = typeof item.price === 'number' ? item.price : parseInt(String(item.price).replace(/[^0-9]/g, ''));
      }
    }

    if (!depTime) depTime = item.departureTime || item.departure || item.leaveTime || '';
    if (!arrTime) arrTime = item.arrivalTime || item.arrival || item.arriveTime || '';
    if (!stops && stops !== 0) stops = item.stops || item.numberOfStops || 0;
    if (duration === 180) duration = item.duration || item.durationMinutes || 180;

    if (!airline || price === 0) return null;

    const depStr = formatTime(depTime, dateString);
    const arrStr = formatTime(arrTime, dateString);

    return {
      id: `rpa-api-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      airline: String(airline).trim(),
      priceUSD: Number(price),
      departureTime: depStr,
      arrivalTime: arrStr,
      stops: typeof stops === 'number' ? stops : parseInt(String(stops)) || 0,
      durationMinutes: typeof duration === 'number' ? duration : parseInt(String(duration)) || 180
    };
  } catch (e) {
    return null;
  }
}

function formatTime(timeValue, dateString) {
  if (!timeValue) return `${dateString}T08:00:00`;
  
  const str = String(timeValue);
  
  if (str.includes('T') || str.includes('-')) {
    return str.length > 16 ? str.substring(0, 16) : str;
  }
  
  const timeMatch = str.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    return `${dateString}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
  }
  
  return `${dateString}T08:00:00`;
}

async function extractFromDOM(page, dateString) {
  const flights = [];

  try {
    const extractedFlights = await page.evaluate((date) => {
      const results = [];
      const bodyText = document.body?.innerText || '';
      
      const priceRegex = /\$(\d{1,3}(?:,\d{3})*)/g;
      const timeRegex = /\b(\d{1,2}:\d{2})\s*(AM|PM)?\b/gi;
      
      const allElements = document.querySelectorAll('div, li, article, section');
      
      for (const el of allElements) {
        const text = el.textContent || '';
        if (text.length < 20 || text.length > 2000) continue;
        
        const priceMatch = text.match(/\$(\d{1,3}(?:,\d{3})*)/);
        if (!priceMatch) continue;
        
        const rect = el.getBoundingClientRect();
        if (rect.height < 40 || rect.height > 500 || rect.width < 150) continue;
        
        const price = parseInt(priceMatch[1].replace(/,/g, ''));
        if (price < 20 || price > 10000) continue;
        
        const times = [];
        let m;
        const timeRe = /\b(\d{1,2}:\d{2})\s*(AM|PM)?\b/gi;
        while ((m = timeRe.exec(text)) !== null) {
          times.push(m[0].trim());
        }
        
        const isNonstop = /nonstop|direct|sin escala/i.test(text);
        const stopMatch = text.match(/(\d+)\s*stop/i);
        const stops = isNonstop ? 0 : (stopMatch ? parseInt(stopMatch[1]) : 1);
        
        const durationMatch = text.match(/(\d+)\s*h(?:r|\s*min|\s*m)/i);
        const durationMin = durationMatch ? parseInt(durationMatch[1]) * 60 : 180;
        
        const imgEl = el.querySelector('img[alt]');
        let airline = imgEl?.getAttribute('alt')?.trim() || '';
        
        if (!airline || airline.length < 2 || airline.length > 40) {
          const spans = el.querySelectorAll('span, div, strong, b');
          for (const span of spans) {
            const t = span.textContent?.trim() || '';
            if (t.length >= 3 && t.length <= 25 && /^[A-Z\s]+$/.test(t) && 
                !t.match(/\d/) && !t.includes('stop') && !t.includes('hour') && 
                !t.includes('min') && !t.includes('$')) {
              airline = t;
              break;
            }
          }
        }
        
        if (!airline || airline.length < 3) continue;
        
        results.push({
          airline,
          price,
          departureTime: times[0] || '08:00',
          arrivalTime: times[1] || '11:00',
          stops,
          durationMinutes: durationMin
        });
        
        if (results.length >= 5) break;
      }
      
      return { count: results.length, textPreview: bodyText.substring(0, 800), results };
    }, dateString);

    console.log(`[RPA Search] DOM extraction: ${extractedFlights.count} candidates`);
    console.log(`[RPA Search] Page text preview: ${extractedFlights.textPreview.substring(0, 200)}`);

    for (const f of extractedFlights.results) {
      flights.push({
        id: `rpa-dom-${flights.length}`,
        airline: f.airline.trim(),
        priceUSD: f.price,
        departureTime: `${dateString}T${convertTo24h(f.departureTime)}`,
        arrivalTime: `${dateString}T${convertTo24h(f.arrivalTime)}`,
        stops: f.stops,
        durationMinutes: f.durationMinutes
      });
    }
  } catch (e) {
    console.error('[RPA Search] DOM extraction error:', e.message);
  }

  return flights;
}

function convertTo24h(timeStr) {
  if (!timeStr) return '08:00';
  timeStr = timeStr.trim();
  
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) return `${match24[1].padStart(2, '0')}:${match24[2]}`;
  
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1]);
    const m = match12[2];
    const ap = match12[3].toUpperCase();
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  
  return '08:00';
}

module.exports = { searchFlights };
