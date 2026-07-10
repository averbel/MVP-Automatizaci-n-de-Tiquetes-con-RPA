const { chromium } = require('playwright');

async function searchFlights(origin, destination, dateString) {
  console.log(`[RPA Search] Buscando vuelos ${origin} -> ${destination} para el ${dateString}...`);
  
  let browser = null;
  const flights = [];
  
  try {
    browser = await chromium.launch({ 
      headless: process.env.HEADLESS !== 'false',
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage', 
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,800'
      ] 
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/Bogota'
    });

    // Inyectar scripts anti-detección antes de cada navegación
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
    });
    
    const page = await context.newPage();
    
    const searchUrl = `https://www.kayak.com/flights/${origin}-${destination}/${dateString}?sort=bestflight_a`;
    console.log(`[RPA Search] URL: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Esperar a que carguen los resultados con múltiples selectores
    const resultSelectors = [
      '.nrc6-wrapper',
      '.resultWrapper',
      '.Base-Results-ResultCard',
      '[class*="resultInner"]',
      '[class*="Flights-Results"]',
      '.Flights-Results-FlightResultItem'
    ];
    
    let foundSelector = null;
    try {
      await Promise.race([
        ...resultSelectors.map(sel => 
          page.waitForSelector(sel, { timeout: 8000 }).then(() => { foundSelector = sel; })
        )
      ]);
      await page.waitForTimeout(2000); // Tiempo extra para que renderice precios
    } catch (e) {
      console.log('[RPA Search] No se detectaron selectores de resultados, intentando scroll...');
      // Intentar scroll para forzar lazy loading
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(2000);
    }

    // Tomar screenshot para debugging
    await page.screenshot({ path: require('path').join(__dirname, 'screenshots', `search_${dateString}.png`), fullPage: false }).catch(() => {});

    // Intentar extraer resultados
    const results = foundSelector 
      ? await page.$$(foundSelector) 
      : await page.$$('.nrc6-wrapper, .resultWrapper, .Base-Results-ResultCard, [class*="resultInner"]');
    
    console.log(`[RPA Search] Se encontraron ${results.length} resultados.`);
    
    if (results.length > 0) {
      for (let i = 0; i < Math.min(5, results.length); i++) {
        const result = results[i];
        
        // Extraer aerolínea con múltiples fallbacks
        let airline = await result.$eval('img[alt]', el => el.getAttribute('alt')).catch(() => null);
        if (!airline) {
          airline = await result.$eval('.codeshares-airline-names, .bottom, .name-only-text, [class*="airline"]', el => el.textContent).catch(() => null);
        }
        if (!airline) {
          airline = await result.$eval('[class*="carrier"], [class*="airlineName"]', el => el.textContent).catch(() => 'Aerolínea Comercial');
        }

        // Extraer precio con múltiples fallbacks
        let priceText = await result.$eval('.f8F1-price-text, .price-text, .price, [class*="price"], [class*="Price"]', el => el.textContent).catch(() => null);
        if (!priceText) {
          priceText = await result.$eval('[class*="amount"], [class*="cost"]', el => el.textContent).catch(() => '$299');
        }
        let price = parseInt(priceText.replace(/[^0-9]/g, '')) || 299;

        // Extraer horarios
        let times = await result.$$eval('[class*="time"], [class*="Time"]', els => els.map(el => el.textContent)).catch(() => []);
        
        // Extraer escalas
        let stopsText = await result.$eval('[class*="stops"], [class*=" Stops"]', el => el.textContent).catch(() => '0 escala(s)');
        let stops = stopsText.includes('Nonstop') || stopsText.includes('Directo') ? 0 : (parseInt(stopsText) || 1);

        flights.push({
          id: `rpa-live-${i}`,
          airline: (airline || 'Aerolínea Comercial').trim(),
          priceUSD: price,
          departureTime: `${dateString}T${times[0] || '08:00:00'}`,
          arrivalTime: `${dateString}T${times[1] || '11:00:00'}`,
          stops: stops,
          durationMinutes: 180
        });
      }
    }
    
  } catch (error) {
    console.error('[RPA Search] Error en la búsqueda en vivo:', error.message);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
  
  // Si no se encontraron vuelos reales, devolver array vacío
  if (flights.length === 0) {
    console.log('[RPA Search] No se encontraron vuelos disponibles.');
  }
  
  return flights;
}

module.exports = {
  searchFlights
};
