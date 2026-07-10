const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Ejecuta el bot de RPA en el checkout de Avianca
 */
async function runBot(bookingLink, passengerData, idempotencyKey) {
  console.log(`[RPA] Iniciando ejecución para la key: ${idempotencyKey}`);
  
  const MAX_RETRIES = 0;
  let attempts = 0;
  let success = false;
  let screenshotPath = '';
  let errorMsg = '';
  let reachedStep = 'INICIO';

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  while (attempts <= MAX_RETRIES && !success) {
    attempts++;
    console.log(`[RPA] Intento ${attempts}/${MAX_RETRIES + 1}...`);
    let browser = null;
    
    try {
      browser = await chromium.launch({ 
        headless: process.env.HEADLESS !== 'false',
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
      });
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();

      // Permitimos imágenes y estilos para que la captura final se vea 100% real y profesional
      // Solo bloqueamos analytics de terceros para mejorar rendimiento
      await page.route('**/*', (route) => {
        const url = route.request().url();
        if (
          url.includes('google-analytics') ||
          url.includes('doubleclick') ||
          url.includes('facebook') ||
          url.includes('hotjar') ||
          url.includes('amplitude')
        ) {
          return route.abort();
        }
        return route.continue();
      });

      // 1. Navegar a los resultados de búsqueda de Kayak
      reachedStep = 'NAVEGANDO_BOOKING_LINK';
      await page.goto(bookingLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Esperar a que los vuelos carguen en pantalla
      await page.waitForTimeout(4000); 

      // 2. Dar clic en el primer resultado ("Ver oferta" / "View Deal")
      reachedStep = 'SELECCIONANDO_VUELO_EN_KAYAK';
      const dealButton = await page.$('button:has-text("View Deal"), a:has-text("View Deal"), button:has-text("Ver oferta"), a:has-text("Ver oferta"), button:has-text("Select"), a:has-text("Select"), button:has-text("Elegir"), a:has-text("Elegir"), .booking-link');
      
      let targetPage = page;

      if (dealButton) {
        console.log('[RPA] Botón "Ver Oferta" encontrado, haciendo clic...');
        
        // Al hacer clic, Kayak suele abrir una pestaña nueva con el checkout de la aerolínea
        const [newPage] = await Promise.all([
          context.waitForEvent('page').catch(() => page), // Captura la nueva pestaña si se abre
          dealButton.click()
        ]);
        
        targetPage = newPage;
        await targetPage.waitForLoadState('domcontentloaded').catch(() => {});
        await targetPage.waitForTimeout(5000); // Esperar a que el checkout de la aerolínea renderice
      } else {
        console.log('[RPA] No se encontró el botón de oferta, intentando rellenar en la página actual...');
      }

      reachedStep = 'LLENANDO_DATOS_PASAJERO';
      
      // Buscar inputs típicos del checkout de la aerolínea
      const nameInputs = await targetPage.$$('input[name*="name"], input[id*="name"], input[placeholder*="Nombre"], input[placeholder*="nombre"]');
      if (nameInputs.length > 0) {
        await nameInputs[0].fill(passengerData.nombre.split(' ')[0] || 'Prueba');
      }

      const lastNameInputs = await targetPage.$$('input[name*="lastname"], input[name*="surname"], input[placeholder*="Apellido"], input[placeholder*="apellido"]');
      if (lastNameInputs.length > 0) {
        const parts = passengerData.nombre.split(' ');
        const lastname = parts.length > 1 ? parts.slice(1).join(' ') : 'Demo';
        await lastNameInputs[0].fill(lastname);
      }

      const docInputs = await targetPage.$$('input[name*="document"], input[name*="docNumber"], input[placeholder*="Documento"], input[placeholder*="documento"]');
      if (docInputs.length > 0) {
        await docInputs[0].fill(passengerData.identificacion || '123456789');
      }
      
      const emailInputs = await targetPage.$$('input[type="email"], input[name*="email"]');
      if (emailInputs.length > 0) {
        await emailInputs[0].fill(passengerData.email || 'demo@example.com');
      }

      // Supongamos que damos click en continuar
      const continueBtns = await targetPage.$$('button:has-text("Continuar"), button:has-text("Siguiente"), .btn-continue');
      if (continueBtns.length > 0) {
        await continueBtns[0].click();
        await targetPage.waitForTimeout(3000); // esperar transición
      }

      reachedStep = 'ANTES_DE_PAGO';
      
      // Tomamos la captura final antes del pago
      screenshotPath = path.join(screenshotsDir, `${idempotencyKey}_final_success.png`);
      await targetPage.screenshot({ path: screenshotPath, fullPage: true });

      success = true;
      console.log(`[RPA] ¡Éxito en el intento ${attempts}!`);
      
    } catch (error) {
      errorMsg = error.message;
      console.error(`[RPA] Error en intento ${attempts}:`, errorMsg);
      // Tomar captura de error si se puede
      if (browser) {
         try {
           const pages = await browser.contexts()[0]?.pages();
           if (pages && pages.length > 0) {
             const errorScreenshot = path.join(screenshotsDir, `${idempotencyKey}_error_${attempts}.png`);
             await pages[0].screenshot({ path: errorScreenshot });
             screenshotPath = errorScreenshot;
           }
         } catch (e) {
           console.error('[RPA] No se pudo tomar captura del error', e);
         }
      }
      
      if (attempts > MAX_RETRIES) {
        console.error(`[RPA] Se alcanzó el límite de reintentos.`);
      } else {
        console.log(`[RPA] Reintentando...`);
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Convertir captura a base64 para enviarla al webhook fácilmente
  let screenshotBase64 = null;
  if (screenshotPath && fs.existsSync(screenshotPath)) {
    const fileData = fs.readFileSync(screenshotPath);
    screenshotBase64 = `data:image/png;base64,${fileData.toString('base64')}`;
    
    // Limpiar archivo local después de leer
    fs.unlinkSync(screenshotPath);
  }

  return {
    success,
    error: success ? null : errorMsg,
    reachedStep,
    screenshotBase64
  };
}

module.exports = {
  runBot
};
