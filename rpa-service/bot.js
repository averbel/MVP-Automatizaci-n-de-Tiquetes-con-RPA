const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

async function runBot(bookingLink, passengerData, idempotencyKey) {
  console.log(`[RPA] Iniciando ejecución para la key: ${idempotencyKey}`);
  console.log(`[RPA] Link: ${bookingLink}`);
  console.log(`[RPA] Pasajero: ${JSON.stringify(passengerData)}`);
  
  const MAX_RETRIES = 2;
  let attempts = 0;
  let success = false;
  let screenshotPath = '';
  let errorMsg = '';
  let reachedStep = 'INICIO';

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  while (attempts <= MAX_RETRIES && !success) {
    attempts++;
    console.log(`[RPA] Intento ${attempts}/${MAX_RETRIES + 1}...`);
    let browser = null;
    
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
        locale: 'es-CO',
        timezoneId: 'America/Bogota'
      });

      // Anti-detección
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en-US'] });
        window.chrome = { runtime: {} };
      });

      const page = await context.newPage();

      // ============================================
      // PASO 1: Navegar al link de Kayak
      // ============================================
      reachedStep = 'NAVEGANDO_KAYAK';
      console.log('[RPA] Navegando a Kayak...');
      await page.goto(bookingLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);

      // Screenshot del paso 1
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${idempotencyKey}_p1_kayak.png`) });

      // ============================================
      // PASO 2: Buscar y hacer clic en "View Deal" / "Ver oferta"
      // ============================================
      reachedStep = 'SELECCIONANDO_OFERTA';
      console.log('[RPA] Buscando botón de oferta...');
      
      const dealButtonSelectors = [
        'button:has-text("View Deal")',
        'a:has-text("View Deal")',
        'button:has-text("Ver oferta")',
        'a:has-text("Ver oferta")',
        'button:has-text("Select")',
        'a:has-text("Select")',
        'button:has-text("Elegir")',
        'a:has-text("Elegir")',
        '.booking-link',
        '[class*="bookButton"]',
        '[class*="booking-link"]',
        'button:has-text("Book")',
        'a:has-text("Book")'
      ];

      let dealButton = null;
      for (const selector of dealButtonSelectors) {
        dealButton = await page.$(selector);
        if (dealButton) {
          console.log(`[RPA] Botón encontrado con selector: ${selector}`);
          break;
        }
      }
      
      let targetPage = page;
      let airlineCheckoutUrl = '';

      if (dealButton) {
        console.log('[RPA] Haciendo clic en botón de oferta...');
        
        const [newPage] = await Promise.all([
          context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
          dealButton.click()
        ]);
        
        if (newPage) {
          targetPage = newPage;
          await targetPage.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
          airlineCheckoutUrl = targetPage.url();
          console.log(`[RPA] Nueva pestaña abierta: ${airlineCheckoutUrl}`);
        }
        
        await targetPage.waitForTimeout(6000); // Esperar checkout
      } else {
        console.log('[RPA] No se encontró botón de oferta, trabajando en la página actual.');
      }

      // Screenshot del paso 2
      await targetPage.screenshot({ path: path.join(SCREENSHOTS_DIR, `${idempotencyKey}_p2_checkout.png`) }).catch(() => {});

      // ============================================
      // PASO 3: Llenar datos del pasajero
      // ============================================
      reachedStep = 'LLENANDO_DATOS_PASAJERO';
      console.log('[RPA] Llenando datos del pasajero...');

      const nombre = passengerData.nombre || 'Juan Perez';
      const parts = nombre.trim().split(' ');
      const primerNombre = parts[0] || 'Juan';
      const apellido = parts.length > 1 ? parts.slice(1).join(' ') : 'Perez';
      const identificacion = passengerData.identificacion || '123456789';
      const email = passengerData.email || 'demo@example.com';

      // Función auxiliar para llenar un campo con múltiples selectores
      async function fillField(selectors, value) {
        for (const selector of selectors) {
          const el = await targetPage.$(selector);
          if (el) {
            try {
              await el.click({ clickCount: 3 }); // Seleccionar todo
              await el.fill(value);
              console.log(`[RPA] Campo llenado con selector: ${selector}`);
              return true;
            } catch (e) {
              // Intentar con type en vez de fill
              try {
                await el.type(value, { delay: 50 });
                return true;
              } catch (e2) { /* continuar */ }
            }
          }
        }
        return false;
      }

      // Llenar nombre
      await fillField([
        'input[name*="firstName"]',
        'input[name*="first_name"]',
        'input[id*="firstName"]',
        'input[id*="first_name"]',
        'input[placeholder*="Nombre"]',
        'input[placeholder*="nombre"]',
        'input[placeholder*="First"]',
        'input[placeholder*="first"]',
        'input[name*="name"]:not([name*="last"]):not([name*="holder"])',
        '#passenger firstName',
        '[data-testid*="firstName"]',
        '[data-testid*="first-name"]'
      ], primerNombre);

      // Llenar apellido
      await fillField([
        'input[name*="lastName"]',
        'input[name*="last_name"]',
        'input[name*="surname"]',
        'input[id*="lastName"]',
        'input[id*="last_name"]',
        'input[placeholder*="Apellido"]',
        'input[placeholder*="apellido"]',
        'input[placeholder*="Last"]',
        'input[placeholder*="last"]',
        'input[name*="lastname"]',
        '[data-testid*="lastName"]',
        '[data-testid*="last-name"]'
      ], apellido);

      // Llenar documento
      await fillField([
        'input[name*="document"]',
        'input[name*="docNumber"]',
        'input[name*="passport"]',
        'input[id*="document"]',
        'input[placeholder*="Documento"]',
        'input[placeholder*="documento"]',
        'input[placeholder*="Passport"]',
        'input[placeholder*="ID"]',
        '[data-testid*="document"]',
        '[data-testid*="passport"]'
      ], identificacion);

      // Llenar email
      await fillField([
        'input[type="email"]',
        'input[name*="email"]',
        'input[id*="email"]',
        'input[placeholder*="Email"]',
        'input[placeholder*="email"]',
        'input[placeholder*="correo"]',
        '[data-testid*="email"]'
      ], email);

      await targetPage.screenshot({ path: path.join(SCREENSHOTS_DIR, `${idempotencyKey}_p3_form.png`) }).catch(() => {});

      // ============================================
      // PASO 4: Intentar continuar
      // ============================================
      reachedStep = 'PRESIONANDO_CONTINUAR';
      console.log('[RPA] Buscando botón de continuar...');

      const continueSelectors = [
        'button:has-text("Continuar")',
        'button:has-text("Continue")',
        'button:has-text("Siguiente")',
        'button:has-text("Next")',
        'button:has-text("Proceed")',
        'button:has-text("Review")',
        'button:has-text("Resumen")',
        '.btn-continue',
        '[class*="continue"]',
        '[class*="Continue"]',
        '[data-testid*="continue"]',
        '[data-testid*="Continue"]'
      ];

      let continueClicked = false;
      for (const selector of continueSelectors) {
        const btn = await targetPage.$(selector);
        if (btn) {
          await btn.click();
          continueClicked = true;
          console.log(`[RPA] Click en continuar con selector: ${selector}`);
          break;
        }
      }

      if (continueClicked) {
        await targetPage.waitForTimeout(5000); // Esperar transición de pantalla
      }

      // Screenshot del paso 4
      await targetPage.screenshot({ path: path.join(SCREENSHOTS_DIR, `${idempotencyKey}_p4_after_continue.png`), fullPage: true }).catch(() => {});

      // ============================================
      // PASO 5: Captura final (antes de pago real - NO hacemos clic en pagar)
      // ============================================
      reachedStep = 'ANTES_DE_PAGO';
      console.log('[RPA] Captura final antes del pago (NO se presiona pagar por seguridad).');

      screenshotPath = path.join(SCREENSHOTS_DIR, `${idempotencyKey}_final_success.png`);
      await targetPage.screenshot({ path: screenshotPath, fullPage: true });

      success = true;
      console.log(`[RPA] ¡Éxito en el intento ${attempts}!`);
      
    } catch (error) {
      errorMsg = error.message;
      console.error(`[RPA] Error en intento ${attempts}:`, errorMsg);
      
      // Tomar captura de error
      if (browser) {
        try {
          const contexts = browser.contexts();
          if (contexts.length > 0) {
            const pages = contexts[0].pages();
            if (pages.length > 0) {
              const errorScreenshot = path.join(SCREENSHOTS_DIR, `${idempotencyKey}_error_${attempts}.png`);
              await pages[0].screenshot({ path: errorScreenshot }).catch(() => {});
              screenshotPath = errorScreenshot;
            }
          }
        } catch (e) {
          console.error('[RPA] No se pudo tomar captura del error');
        }
      }
      
      if (attempts <= MAX_RETRIES) {
        console.log(`[RPA] Reintentando en 3 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.error(`[RPA] Se alcanzó el límite de reintentos (${MAX_RETRIES}).`);
      }
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  // Convertir captura a base64 para enviarla al webhook
  let screenshotBase64 = null;
  if (screenshotPath && fs.existsSync(screenshotPath)) {
    try {
      const fileData = fs.readFileSync(screenshotPath);
      screenshotBase64 = `data:image/png;base64,${fileData.toString('base64')}`;
    } catch (e) {
      console.error('[RPA] Error leyendo screenshot:', e.message);
    }
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
