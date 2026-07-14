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
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      permissions: ['geolocation']
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });
    
    const page = await context.newPage();

    await page.route('**/*', route => {
      const url = route.request().url();
      const type = route.request().resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        return route.abort();
      }
      if (url.includes('doubleclick') || url.includes('googlesyndication') ||
          url.includes('google-analytics') || url.includes('facebook') ||
          url.includes('hotjar') || url.includes('sentry')) {
        return route.abort();
      }
      return route.continue();
    });
    
    const searchUrl = `https://www.kayak.com/flights/${origin}-${destination}/${dateString}?sort=bestflight_a`;
    console.log(`[RPA Search] Navegando a: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'load', timeout: 45000 });

    try {
      const consentBtn = page.locator('button:has-text("Accept"), button:has-text("Got it"), button:has-text("Acepto"), [id*="consent"] button, [class*="consent"] button');
      await consentBtn.first().click({ timeout: 4000 });
      console.log('[RPA Search] Cookie consent dismissed');
    } catch {
      console.log('[RPA Search] No cookie banner found');
    }

    try {
      const closeBtn = page.locator('button[aria-label="Close"], button:has-text("No thanks"), button:has-text("Dismiss")');
      await closeBtn.first().click({ timeout: 3000 });
    } catch {
      // no popup
    }

    const resultSelectors = [
      '[class*="nrc6"]',
      '[class*="resultWrapper"]', 
      '[class*="result-item"]',
      '[class*="ResultItem"]',
      '[data-resultid]',
      '[class*="Flights-Results"] [class*="card"]',
      '[class*="resultsContainer"] > div > div',
      '.search-results [class*="result"]',
      '[class*="itinerary"]',
      '[class*="Itinerary"]'
    ];

    let found = false;
    for (const selector of resultSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 8000 });
        const count = await page.locator(selector).count();
        if (count > 0) {
          console.log(`[RPA Search] Found ${count} results with selector: ${selector}`);
          found = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!found) {
      console.log('[RPA Search] Primary selectors failed, waiting for network settle + 8s extra...');
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch {
        console.log('[RPA Search] networkidle timeout');
      }
      await page.waitForTimeout(8000);
    }

    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    const screenshotB64 = screenshot.toString('base64');
    console.log(`[RPA Search] Screenshot captured (${screenshot.length} bytes)`);

    const extractedFlights = await page.evaluate((date) => {
      const flights = [];

      const allDivs = document.querySelectorAll('div');
      const priceRegex = /^\$[\d,]+$/;
      const timeRegex = /^\d{1,2}:\d{2}\s*(AM|PM)?$/i;

      const resultContainers = [];
      for (const div of allDivs) {
        const text = div.textContent || '';
        const hasPrice = priceRegex.test(div.textContent?.trim() || '');
        const childCount = div.children.length;
        if (hasPrice && childCount >= 2 && childCount <= 20) {
          const rect = div.getBoundingClientRect();
          if (rect.height > 50 && rect.height < 400 && rect.width > 200) {
            resultContainers.push(div);
          }
        }
      }

      if (resultContainers.length > 0) {
        console.log(`Found ${resultContainers.length} price containers`);
        for (let i = 0; i < Math.min(5, resultContainers.length); i++) {
          const el = resultContainers[i];
          const allText = el.textContent || '';
          
          const imgEl = el.querySelector('img[alt]');
          let airline = imgEl?.getAttribute('alt')?.trim() || '';
          if (!airline || airline.length < 2) {
            const possibleAirline = el.querySelectorAll('span, div');
            for (const span of possibleAirline) {
              const t = span.textContent?.trim() || '';
              if (t.length > 2 && t.length < 30 && !t.match(/[\d$]/) && !t.includes('stop') && !t.includes('hour') && !t.includes('min')) {
                airline = t;
                break;
              }
            }
          }

          const priceMatch = allText.match(/\$([\d,]+)/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

          const timeMatches = allText.match(/\b(\d{1,2}:\d{2})\s*(AM|PM)?\b/gi) || [];
          const stops = allText.toLowerCase().includes('nonstop') || allText.toLowerCase().includes('direct') ? 0 :
                        (allText.match(/\d+\s*stop/i) || ['', '1'])[0].match(/\d/)?.[0] || 1;

          const durationMatch = allText.match(/(\d+)\s*h(?:r|min)?/i);
          const durationMin = durationMatch ? parseInt(durationMatch[1]) * 60 : 180;

          flights.push({
            airline: airline || 'Unknown',
            price,
            departureTime: timeMatches[0] || '08:00',
            arrivalTime: timeMatches[1] || '11:00',
            stops: typeof stops === 'number' ? stops : parseInt(stops) || 1,
            durationMinutes: durationMin
          });
        }
        return { method: 'price-container', flights };
      }

      const selectors = [
        '[class*="nrc6"]', '[class*="resultWrapper"]', '[data-resultid]',
        '[class*="itinerary"]', '[class*="Itinerary"]',
        '[class*="result-item"]', '[class*="ResultItem"]'
      ];
      
      for (const sel of selectors) {
        const results = document.querySelectorAll(sel);
        if (results.length > 0) {
          console.log(`Fallback: found ${results.length} with ${sel}`);
          for (let i = 0; i < Math.min(5, results.length); i++) {
            const el = results[i];
            const text = el.textContent || '';
            const img = el.querySelector('img[alt]');
            const airline = img?.getAttribute('alt')?.trim() || 'Unknown';
            const priceMatch = text.match(/\$([\d,]+)/);
            const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;
            const timeMatches = text.match(/\b(\d{1,2}:\d{2})\s*(AM|PM)?\b/gi) || [];
            const stops = text.toLowerCase().includes('nonstop') || text.toLowerCase().includes('direct') ? 0 : 1;

            flights.push({
              airline, price,
              departureTime: timeMatches[0] || '08:00',
              arrivalTime: timeMatches[1] || '11:00',
              stops, durationMinutes: 180
            });
          }
          return { method: sel, flights };
        }
      }

      const bodyText = document.body?.innerText || '';
      console.log('Page text preview:', bodyText.substring(0, 500));
      return { method: 'none', flights: [] };
    }, dateString);

    console.log(`[RPA Search] Method: ${extractedFlights.method}, Found: ${extractedFlights.flights.length} flights`);

    extractedFlights.flights.forEach((f, i) => {
      if (!f.airline || f.airline === 'Unknown' || f.price === 0) {
        console.log(`[RPA Search] Skipping incomplete flight ${i}: airline=${f.airline}, price=${f.price}`);
        return;
      }
      
      const depTime = f.departureTime.replace(/\s*(AM|PM)\s*/gi, ':$1').replace('::', ':');
      const arrTime = f.arrivalTime.replace(/\s*(AM|PM)\s*/gi, ':$1').replace('::', ':');
      
      flights.push({
        id: `rpa-live-${i}`,
        airline: f.airline.trim(),
        priceUSD: f.price,
        departureTime: `${dateString}T${convertTo24h(depTime)}`,
        arrivalTime: `${dateString}T${convertTo24h(arrTime)}`,
        stops: typeof f.stops === 'number' ? f.stops : parseInt(String(f.stops)) || 1,
        durationMinutes: f.durationMinutes || 180
      });
    });
    
  } catch (error) {
    console.error('[RPA Search] Error:', error.message);
    console.error('[RPA Search] Stack:', error.stack);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  
  console.log(`[RPA Search] Returning ${flights.length} flights`);
  return flights;
}

function convertTo24h(timeStr) {
  if (!timeStr) return '08:00';
  timeStr = timeStr.trim();
  
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) return `${match24[1].padStart(2, '0')}:${match24[2]}`;
  
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})(AM|PM)$/i);
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
