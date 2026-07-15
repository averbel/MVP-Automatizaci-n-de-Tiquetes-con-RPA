const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

const RPA_WEBHOOK_SECRET = process.env.RPA_WEBHOOK_SECRET || 'secret-rpa-key';

async function sendProgressScreenshot(callbackUrl, idempotencyKey, step, screenshotBase64) {
  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RPA_WEBHOOK_SECRET}`
      },
      body: JSON.stringify({
        idempotencyKey,
        success: false,
        reachedStep: step,
        screenshotBase64,
        isProgress: true
      })
    });
    console.log(`[RPA] Screenshot de progreso enviado: ${step}`);
  } catch (e) {
    console.error(`[RPA] Error enviando screenshot de progreso: ${e.message}`);
  }
}

async function dismissOverlays(page) {
  console.log('[RPA] Intentando cerrar overlays...');

  // Cerrar banners de cookies y overlays comunes
  const dismissSelectors = [
    'button:has-text("Accept")',
    'button:has-text("Aceptar")',
    'button:has-text("OK")',
    'button:has-text("Got it")',
    'button:has-text("Entendido")',
    'button:has-text("Close")',
    'button:has-text("Cerrar")',
    '[id*="cookie"] button',
    '[class*="cookie"] button',
    '[class*="consent"] button',
    '[class*="banner"] button',
    '[id*="consent"] button',
    '[id*="onetrust"] button',
    '#onetrust-accept-btn-handler',
    '[class*="close-button"]',
    '[aria-label="Close"]',
    '[aria-label="Cerrar"]'
  ];

  for (const selector of dismissSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn && await btn.isVisible()) {
        await btn.click({ timeout: 3000 });
        console.log(`[RPA] Overlay cerrado: ${selector}`);
        await page.waitForTimeout(1000);
      }
    } catch { /* skip */ }
  }

  // Ocultar overlays problemáticos con JS
  await page.evaluate(() => {
    const overlaySelectors = [
      '.c-ulo-viewport',
      '[class*="ulo-viewport"]',
      '[class*="overlay"]',
      '[class*="modal-backdrop"]',
      '[class*="cookie-banner"]',
      '[id*="onetrust-banner"]',
      '[class*="fc-consent-root"]'
    ];
    overlaySelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '-1';
      });
    });
  });
  console.log('[RPA] Overlays ocultados via JS');
}

async function safeClick(page, element, selector) {
  // Intentar click normal primero
  try {
    await element.click({ timeout: 5000 });
    console.log(`[RPA] Click exitoso (normal): ${selector}`);
    return true;
  } catch (e) {
    console.log(`[RPA] Click normal falló, intentando force: ${selector}`);
  }

  // Intentar force click
  try {
    await element.click({ force: true, timeout: 5000 });
    console.log(`[RPA] Click exitoso (force): ${selector}`);
    return true;
  } catch (e) {
    console.log(`[RPA] Force click falló, intentando JS click: ${selector}`);
  }

  // Intentar click via JS
  try {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.click();
    }, selector);
    console.log(`[RPA] Click exitoso (JS): ${selector}`);
    return true;
  } catch (e) {
    console.log(`[RPA] JS click falló: ${selector}`);
  }

  return false;
}

async function runBot(bookingLink, passengerData, idempotencyKey, callbackUrl) {
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
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',        locale: 'es-CO',
        timezoneId: 'America/Bogota'
      });

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

      await dismissOverlays(page);

      // Screenshot del paso 1
      const p1Screenshot = path.join(SCREENSHOTS_DIR, `${idempotencyKey}_p1_kayak.png`);
      await page.screenshot({ path: p1Screenshot });

      if (callbackUrl) {
        const p1Data = fs.readFileSync(p1Screenshot);
        await sendProgressScreenshot(callbackUrl, idempotencyKey, 'NAVEGANDO_KAYAK',
          `data:image/png;base64,${p1Data.toString('base64')}`);
      }

      // ============================================
      // PASO 2: Buscar y hacer clic en "View Deal"
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
      let matchedSelector = '';
      for (const selector of dealButtonSelectors) {
        dealButton = await page.$(selector);
        if (dealButton) {
          matchedSelector = selector;
          console.log(`[RPA] Botón encontrado con selector: ${selector}`);
          break;
        }
      }

      let targetPage = page;
      let airlineCheckoutUrl = '';

      if (dealButton) {
        console.log('[RPA] Haciendo clic en botón de oferta...');

        await dismissOverlays(page);

        const [newPage] = await Promise.all([
          context.waitForEvent('page', { timeout: 15000 }).catch(() => null),
          safeClick(page, dealButton, matchedSelector)
        ]);

        if (newPage) {
          targetPage = newPage;
          await targetPage.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
          airlineCheckoutUrl = targetPage.url();
          console.log(`[RPA] Nueva pestaña abierta: ${airlineCheckoutUrl}`);
        }

        await targetPage.waitForTimeout(6000);
        await dismissOverlays(targetPage);
      } else {
        console.log('[RPA] No se encontró botón de oferta, trabajando en la página actual.');
      }

      // Screenshot del paso 2
      const p2Screenshot = path.join(SCREENSHOTS_DIR, `${idempotencyKey}_p2_checkout.png`);
      await targetPage.screenshot({ path: p2Screenshot }).catch(() => {});

      if (callbackUrl) {
        try {
          const p2Data = fs.readFileSync(p2Screenshot);
          await sendProgressScreenshot(callbackUrl, idempotencyKey, 'SELECCIONANDO_OFERTA',
            `data:image/png;base64,${p2Data.toString('base64')}`);
        } catch { /* screenshot no disponible */ }
      }

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
      const telefono = passengerData.telefono || passengerData.phone || '';
      const fechaNacimiento = passengerData.fechaNacimiento || passengerData.birthDate || '';
      const genero = passengerData.genero || passengerData.gender || '';

      async function fillField(selectors, value) {
        if (!value) return false;
        for (const selector of selectors) {
          const el = await targetPage.$(selector);
          if (el) {
            try {
              await el.click({ clickCount: 3, force: true });
              await el.fill(value);
              console.log(`[RPA] Campo llenado con selector: ${selector}`);
              return true;
            } catch (e) {
              try {
                await el.type(value, { delay: 50 });
                return true;
              } catch (e2) { /* continuar */ }
            }
          }
        }
        return false;
      }

      async function selectOption(selectors, value) {
        if (!value) return false;
        for (const selector of selectors) {
          const el = await targetPage.$(selector);
          if (el) {
            const tagName = await el.evaluate(e => e.tagName.toLowerCase());
            if (tagName === 'select') {
              try {
                await el.selectOption({ label: value, timeout: 3000 });
                console.log(`[RPA] Select llenado con selector: ${selector}`);
                return true;
              } catch {
                try {
                  await el.selectOption({ value: value.toLowerCase(), timeout: 3000 });
                  return true;
                } catch {
                  try {
                    await el.selectOption({ value: value, timeout: 3000 });
                    return true;
                  } catch { /* continuar */ }
                }
              }
            } else {
              // Custom dropdown (div/ul)
              try {
                await el.click({ timeout: 3000 });
                await targetPage.waitForTimeout(500);
                const option = await targetPage.$(`[role="option"]:has-text("${value}"), li:has-text("${value}")`);
                if (option) {
                  await option.click({ timeout: 3000 });
                  console.log(`[RPA] Custom select llenado: ${selector}`);
                  return true;
                }
                await el.type(value, { delay: 50 });
                await targetPage.keyboard.press('Enter');
                return true;
              } catch { /* continuar */ }
            }
          }
        }
        return false;
      }

      await fillField([
        'input[name*="firstName"]', 'input[name*="first_name"]',
        'input[id*="firstName"]', 'input[id*="first_name"]',
        'input[placeholder*="Nombre"]', 'input[placeholder*="nombre"]',
        'input[placeholder*="First"]', 'input[placeholder*="first"]',
        'input[name*="name"]:not([name*="last"]):not([name*="holder"])',
        '[data-testid*="firstName"]', '[data-testid*="first-name"]'
      ], primerNombre);

      await fillField([
        'input[name*="lastName"]', 'input[name*="last_name"]',
        'input[name*="surname"]', 'input[id*="lastName"]',
        'input[id*="last_name"]', 'input[placeholder*="Apellido"]',
        'input[placeholder*="apellido"]', 'input[placeholder*="Last"]',
        'input[placeholder*="last"]', 'input[name*="lastname"]',
        '[data-testid*="lastName"]', '[data-testid*="last-name"]'
      ], apellido);

      await fillField([
        'input[name*="document"]', 'input[name*="docNumber"]',
        'input[name*="passport"]', 'input[id*="document"]',
        'input[placeholder*="Documento"]', 'input[placeholder*="documento"]',
        'input[placeholder*="Passport"]', 'input[placeholder*="ID"]',
        '[data-testid*="document"]', '[data-testid*="passport"]'
      ], identificacion);

      await fillField([
        'input[type="email"]', 'input[name*="email"]',
        'input[id*="email"]', 'input[placeholder*="Email"]',
        'input[placeholder*="email"]', 'input[placeholder*="correo"]',
        '[data-testid*="email"]'
      ], email);

      await fillField([
        'input[name*="phone"]', 'input[name*="telefono"]',
        'input[id*="phone"]', 'input[id*="telefono"]',
        'input[type="tel"]', 'input[placeholder*="Teléfono"]',
        'input[placeholder*="telefono"]', 'input[placeholder*="Phone"]',
        'input[placeholder*="phone"]', 'input[placeholder*="Celular"]',
        '[data-testid*="phone"]', '[data-testid*="telefono"]'
      ], telefono);

      async function fillSplitDate(dateStr) {
        if (!dateStr || dateStr.length < 10) return false;
        const [year, month, day] = dateStr.split('-');
        try {
           const dayEl = await targetPage.$('input[placeholder*="DD"], input[name*="day"]');
           const monthEl = await targetPage.$('input[placeholder*="MM"], input[name*="month"]');
           const yearEl = await targetPage.$('input[placeholder*="YY"], input[name*="year"]');
           if (dayEl && monthEl && yearEl) {
              await dayEl.fill(day);
              await monthEl.fill(month);
              await yearEl.fill(year);
              console.log(`[RPA] Fecha separada llenada`);
              return true;
           }
        } catch {}
        return false;
      }

      const dateFilled = await fillSplitDate(fechaNacimiento);
      if (!dateFilled) {
        await fillField([
          'input[name*="birth"]', 'input[name*="dob"]',
          'input[name*="nacimiento"]', 'input[id*="birth"]',
          'input[id*="dob"]', 'input[type="date"][name*="birth"]',
          'input[placeholder*="Fecha"]', 'input[placeholder*="birth"]',
          'input[placeholder*="DD/MM"]', 'input[placeholder*="MM/DD"]',
          '[data-testid*="birth"]', '[data-testid*="dob"]'
        ], fechaNacimiento);
      }

      await selectOption([
        'select[name*="gender"]', 'select[name*="genero"]',
        'select[id*="gender"]', 'select[id*="genero"]',
        'select[name*="sex"]', 'select[id*="sex"]',
        '[data-testid*="gender"]', '[data-testid*="genero"]'
      ], genero) || await fillField([
        'input[name*="gender"]', 'input[name*="genero"]',
        'input[id*="gender"]', 'input[id*="genero"]',
        '[data-testid*="gender-input"]'
      ], genero);

      const p3Screenshot = path.join(SCREENSHOTS_DIR, `${idempotencyKey}_p3_form.png`);
      await targetPage.screenshot({ path: p3Screenshot }).catch(() => {});

      if (callbackUrl) {
        try {
          const p3Data = fs.readFileSync(p3Screenshot);
          await sendProgressScreenshot(callbackUrl, idempotencyKey, 'LLENANDO_DATOS_PASAJERO',
            `data:image/png;base64,${p3Data.toString('base64')}`);
        } catch { /* skip */ }
      }

      // ============================================
      // PASO 4: Intentar continuar
      // ============================================
      reachedStep = 'PRESIONANDO_CONTINUAR';
      console.log('[RPA] Buscando botón de continuar...');

      const continueSelectors = [
        'button:has-text("Continuar")', 'button:has-text("Continue")',
        'button:has-text("Siguiente")', 'button:has-text("Next")',
        'button:has-text("Proceed")', 'button:has-text("Review")',
        'button:has-text("Resumen")',
        '.btn-continue', '[class*="continue"]', '[class*="Continue"]',
        '[data-testid*="continue"]', '[data-testid*="Continue"]'
      ];

      let continueClicked = false;
      for (const selector of continueSelectors) {
        const btn = await targetPage.$(selector);
        if (btn) {
          await dismissOverlays(targetPage);
          continueClicked = await safeClick(targetPage, btn, selector);
          break;
        }
      }

      if (continueClicked) {
        await targetPage.waitForTimeout(5000);
      }

      // Screenshot del paso 4
      const p4Screenshot = path.join(SCREENSHOTS_DIR, `${idempotencyKey}_p4_after_continue.png`);
      await targetPage.screenshot({ path: p4Screenshot }).catch(() => {});

      if (callbackUrl) {
        try {
          const p4Data = fs.readFileSync(p4Screenshot);
          await sendProgressScreenshot(callbackUrl, idempotencyKey, 'PRESIONANDO_CONTINUAR',
            `data:image/png;base64,${p4Data.toString('base64')}`);
        } catch { /* skip */ }
      }

      // ============================================
      // PASO 5: Captura final
      // ============================================
      reachedStep = 'ANTES_DE_PAGO';
      console.log('[RPA] Captura final antes del pago (NO se presiona pagar por seguridad).');

      await targetPage.waitForTimeout(3000);

      screenshotPath = path.join(SCREENSHOTS_DIR, `${idempotencyKey}_final_success.png`);
      await targetPage.screenshot({ path: screenshotPath });

      success = true;
      console.log(`[RPA] Éxito en el intento ${attempts}!`);

    } catch (error) {
      errorMsg = error.message;
      console.error(`[RPA] Error en intento ${attempts}:`, errorMsg);

      if (browser) {
        try {
          const contexts = browser.contexts();
          if (contexts.length > 0) {
            const pages = contexts[0].pages();
            if (pages.length > 0) {
              const errorScreenshot = path.join(SCREENSHOTS_DIR, `${idempotencyKey}_error_${attempts}.png`);
              await pages[0].screenshot({ path: errorScreenshot }).catch(() => {});
              screenshotPath = errorScreenshot;

              if (callbackUrl) {
                const errData = fs.readFileSync(errorScreenshot);
                await sendProgressScreenshot(callbackUrl, idempotencyKey, reachedStep,
                  `data:image/png;base64,${errData.toString('base64')}`);
              }
            }
          }
        } catch (e) {
          console.error('[RPA] No se pudo tomar captura del error');
        }
      }

      if (attempts <= MAX_RETRIES) {
        console.log('[RPA] Reintentando en 3 segundos...');
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

  // Screenshot final como base64
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

module.exports = { runBot };
