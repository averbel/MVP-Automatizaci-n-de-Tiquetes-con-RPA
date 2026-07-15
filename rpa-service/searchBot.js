const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
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

    await page.route('**/*', route => {
      const type = route.request().resourceType();
      const url = route.request().url();
      if (type === 'image' || type === 'media' || type === 'font') return route.abort();
      if (url.includes('google-analytics') || url.includes('googletagmanager') ||
          url.includes('doubleclick') || url.includes('facebook') ||
          url.includes('sentry') || url.includes('hotjar')) {
        return route.abort();
      }
      return route.continue();
    });

    const formattedDate = formatDateForGoogle(dateString);
    const searchUrl = `https://www.google.com/travel/flights?q=Flights+from+${origin}+to+${destination}+on+${formattedDate}&curr=USD&hl=en`;
    console.log(`[RPA Search] Navegando a: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'load', timeout: 45000 });

    try {
      const consentBtn = page.locator('button:has-text("Accept all"), button:has-text("Aceptar todo"), button:has-text("I agree"), form[action*="consent"] button');
      await consentBtn.first().click({ timeout: 5000 });
      console.log('[RPA Search] Consent dismissed');
      await page.waitForTimeout(2000);
    } catch {
      console.log('[RPA Search] No consent banner');
    }

    console.log('[RPA Search] Waiting for flight results to load...');
    
    let foundResults = false;
    
    const selectors = [
      'li[class*="pIav2d"]',
      'li[data-ved]',
      '[class*="Rk10dc"]',
      '[class*="yR1bYc"]',
      'ul[class*="Rk10dc"] > li',
      '[role="list"] > [role="listitem"]',
      'div[class*="结果"] li',
      'c-wiz[data-hveid] li',
      '.shsNrd',
      '[data-hveid] li[class]'
    ];

    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: 8000 });
        const count = await page.locator(sel).count();
        if (count > 0) {
          console.log(`[RPA Search] Found ${count} elements with: ${sel}`);
          foundResults = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!foundResults) {
      console.log('[RPA Search] Selectors not found, waiting for content...');
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch {}
      await page.waitForTimeout(10000);
      
      const debugPath = path.join(__dirname, `screenshots/search_debug_${Date.now()}.png`);
      try {
        if (!fs.existsSync(path.join(__dirname, 'screenshots'))) fs.mkdirSync(path.join(__dirname, 'screenshots'), {recursive: true});
        await page.screenshot({ path: debugPath });
        console.log(`[RPA Search] Debug screenshot saved to ${debugPath}`);
      } catch(e) { console.error('Screenshot error:', e.message); }
    }

    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '');
    console.log(`[RPA Search] Page text: ${pageText.substring(0, 500)}`);

    const extracted = await page.evaluate((date) => {
      const results = [];
      
      const body = document.body?.innerText || '';
      
      const flightBlocks = body.split(/\n/);
      
      const timeRegex = /\b(\d{1,2}:\d{2})\s*(AM|PM)?\b/gi;
      const priceRegex = /(?:COP|\$)\s*(\d{1,3}(?:[.,]\d{3})*)/i;
      const durationRegex = /(\d+)\s*h(?:r|\s*(?:\d+\s*m|min))?/i;
      const stopsRegex = /(\d+)\s*stop/i;
      const nonstopRegex = /nonstop|direct|sin escala/i;

      let currentBlock = [];
      const blocks = [];
      
      for (const line of flightBlocks) {
        const trimmed = line.trim();
        if (priceRegex.test(trimmed) && currentBlock.length > 0) {
          blocks.push([...currentBlock, trimmed]);
          currentBlock = [];
        }
        if (trimmed.length > 0) currentBlock.push(trimmed);
      }
      
      if (currentBlock.length > 0) blocks.push(currentBlock);

      console.log(`Found ${blocks.length} potential flight blocks`);

      for (const block of blocks.slice(0, 10)) {
        const blockText = block.join(' ');
        
        const priceMatch = blockText.match(priceRegex);
        if (!priceMatch) continue;
        let price = parseInt(priceMatch[1].replace(/[.,]/g, ''), 10);
        
        if (price > 20000) {
          // Asumimos que esta en COP (pesos colombianos)
          price = Math.round(price / 4000);
        }
        
        if (price < 10 || price > 10000) continue;

        const times = [];
        let m;
        while ((m = timeRegex.exec(blockText)) !== null) {
          times.push(m[0].trim());
        }
        timeRegex.lastIndex = 0;

        let airline = '';
        for (const line of block) {
          const t = line.trim();
          if (t.length >= 3 && t.length <= 30 && /^[A-Z]/.test(t) && 
              !t.match(/^\$/) && !t.match(/^\d/) && !t.match(/stop/i) &&
              !t.match(/hour|min|h\b/i) && !t.match(/^(Nonstop|Direct)$/i) &&
              !t.match(/^From$/i) && !t.match(/^Best/i) && !t.match(/^Cheapest/i) &&
              !t.match(/^Fastest/i) && !t.match(/departure/i) && !t.match(/arrival/i) &&
              t !== 'Economy' && t !== 'Business' && t !== 'First') {
            airline = t;
            break;
          }
        }

        const stops = nonstopRegex.test(blockText) ? 0 :
                      (stopsRegex.exec(blockText) || [, '1'])[1];

        const durationMatch = durationRegex.exec(blockText);
        let durationMin = 180;
        if (durationMatch) {
          durationMin = parseInt(durationMatch[1]) * 60;
          const minMatch = blockText.match(/(\d+)\s*m(?:in)?/i);
          if (minMatch) durationMin += parseInt(minMatch[1]);
        }

        if (airline && times.length >= 1) {
          results.push({
            airline,
            price,
            departureTime: times[0] || '08:00 AM',
            arrivalTime: times[1] || (times.length > 1 ? times[times.length - 1] : '11:00 AM'),
            stops: typeof stops === 'string' ? parseInt(stops) || 0 : stops,
            durationMinutes: durationMin
          });
        }

        if (results.length >= 5) break;
      }

      if (results.length === 0) {
        const allText = body;
        const priceMatches = [...allText.matchAll(/(?:COP|\$)\s*(\d{1,3}(?:[.,]\d{3})*)/gi)];
        console.log(`Price matches found: ${priceMatches.length}`);
        
        for (const pm of priceMatches.slice(0, 5)) {
          const price = parseInt(pm[1].replace(/,/g, ''));
          if (price < 50 || price > 5000) continue;
          
          const startIdx = Math.max(0, pm.index - 200);
          const endIdx = Math.min(allText.length, pm.index + 200);
          const context = allText.substring(startIdx, endIdx);
          
          const ctxTimes = [...context.matchAll(timeRegex)];
          const airlineMatch = context.match(/\n([A-Z][A-Za-z\s]+(?:Airlines?|Airways?|Air|航空))\n/);
          
          if (airlineMatch && ctxTimes.length > 0) {
            results.push({
              airline: airlineMatch[1].trim(),
              price,
              departureTime: ctxTimes[0]?.[0] || '08:00 AM',
              arrivalTime: ctxTimes[1]?.[0] || ctxTimes[0]?.[0] || '11:00 AM',
              stops: nonstopRegex.test(context) ? 0 : 1,
              durationMinutes: 180
            });
          }
          
          if (results.length >= 5) break;
        }
      }

      return { count: results.length, results, bodyPreview: body.substring(0, 1000) };
    }, dateString);

    console.log(`[RPA Search] Extracted ${extracted.count} flights`);
    console.log(`[RPA Search] Body preview: ${extracted.bodyPreview?.substring(0, 300)}`);

    for (const f of extracted.results) {
      flights.push({
        id: `rpa-gf-${flights.length}`,
        airline: f.airline.trim(),
        priceUSD: f.price,
        departureTime: `${dateString}T${convertTo24h(f.departureTime)}`,
        arrivalTime: `${dateString}T${convertTo24h(f.arrivalTime)}`,
        stops: f.stops,
        durationMinutes: f.durationMinutes || 180
      });
    }

  } catch (error) {
    console.error('[RPA Search] Error:', error.message);
    console.error('[RPA Search] Stack:', error.stack);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  
  if (flights.length === 0) {
    console.log('[RPA Search] No live flights found, returning mock data');
    return getMockFlights(origin, destination, dateString);
  }

  console.log(`[RPA Search] Returning ${flights.length} flights`);
  return flights;
}

function formatDateForGoogle(dateString) {
  try {
    const d = new Date(dateString + 'T00:00:00');
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[d.getMonth()]}+${d.getDate()},+${d.getFullYear()}`;
  } catch {
    return dateString;
  }
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

function getMockFlights(origin, destination, dateString) {
  const airlines = ['AVIANCA', 'LATAM', 'Copa Airlines', 'Viva Air', 'Wingo'];
  const mockFlights = [];
  
  for (let i = 0; i < 3; i++) {
    const depHour = 6 + i * 4;
    const arrHour = depHour + 2 + Math.floor(Math.random() * 3);
    const price = 150 + Math.floor(Math.random() * 350);
    const stops = i === 0 ? 0 : (i === 1 ? 1 : 0);
    const duration = (arrHour - depHour) * 60 + Math.floor(Math.random() * 30);
    
    mockFlights.push({
      id: `mock-${i}-${Date.now()}`,
      airline: airlines[i % airlines.length],
      priceUSD: price,
      departureTime: `${dateString}T${String(depHour).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
      arrivalTime: `${dateString}T${String(arrHour).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
      stops,
      durationMinutes: duration
    });
  }
  
  return mockFlights;
}

module.exports = { searchFlights };
