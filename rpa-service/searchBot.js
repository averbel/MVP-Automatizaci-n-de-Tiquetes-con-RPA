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
        '--disable-default-apps', '--disable-sync'
      ] 
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US'
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
    });
    
    const page = await context.newPage();

    // Bloquear recursos pesados para ir más rápido
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,mp4,webm}', route => route.abort());
    await page.route('**/ads/**', route => route.abort());
    await page.route('**/analytics/**', route => route.abort());
    await page.route('**/tracking/**', route => route.abort());
    
    const searchUrl = `https://www.kayak.com/flights/${origin}-${destination}/${dateString}?sort=bestflight_a`;
    console.log(`[RPA Search] Navegando a: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // Esperar solo 3s para que carguen resultados
    try {
      await page.waitForSelector('.nrc6-wrapper, .resultWrapper, .Base-Results-ResultCard, [class*="resultInner"]', { timeout: 6000 });
    } catch (e) {
      console.log('[RPA Search] Selectores no encontrados, esperando 2s más...');
      await page.waitForTimeout(2000);
    }

    // Extraer resultados con un solo evaluate para ser más rápido
    const extractedFlights = await page.evaluate(() => {
      const results = document.querySelectorAll('.nrc6-wrapper, .resultWrapper, .Base-Results-ResultCard, [class*="resultInner"]');
      const items = [];
      for (let i = 0; i < Math.min(5, results.length); i++) {
        const el = results[i];
        const img = el.querySelector('img[alt]');
        const airline = img?.getAttribute('alt') || el.querySelector('[class*="airline"],[class*="carrier"]')?.textContent?.trim() || 'Aerolínea';
        const priceEl = el.querySelector('[class*="price"],[class*="Price"],[class*="amount"]');
        const price = parseInt((priceEl?.textContent || '0').replace(/[^0-9]/g, '')) || 0;
        const timeEls = el.querySelectorAll('[class*="time"],[class*="Time"]');
        const stops = (el.querySelector('[class*="stops"]')?.textContent || '').includes('Nonstop') ? 0 : 1;
        items.push({ airline, price, times: Array.from(timeEls).map(t => t.textContent), stops });
      }
      return items;
    });

    console.log(`[RPA Search] Extrajos ${extractedFlights.length} vuelos del DOM`);

    extractedFlights.forEach((f, i) => {
      flights.push({
        id: `rpa-live-${i}`,
        airline: f.airline.trim(),
        priceUSD: f.price || 200,
        departureTime: `${dateString}T${f.times?.[0] || '08:00'}`,
        arrivalTime: `${dateString}T${f.times?.[1] || '11:00'}`,
        stops: f.stops,
        durationMinutes: 180
      });
    });
    
  } catch (error) {
    console.error('[RPA Search] Error:', error.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  
  return flights;
}

module.exports = { searchFlights };
