const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Ejecuta el bot de RPA en el checkout de Avianca
 */
async function runBot(bookingLink, passengerData, idempotencyKey) {
  console.log(`[RPA] Iniciando ejecución para la key: ${idempotencyKey}`);
  
  const MAX_RETRIES = 2;
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
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();

      // 1. Navegar al booking link
      reachedStep = 'NAVEGANDO_BOOKING_LINK';
      await page.goto(bookingLink, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Tomar captura inicial
      const initialScreenshot = path.join(screenshotsDir, `${idempotencyKey}_initial_${attempts}.png`);
      await page.screenshot({ path: initialScreenshot });

      // MVP (Prueba de concepto) - Avianca checkout
      // Aquí van los selectores reales. Como esto es una prueba y los sitios cambian,
      // usaremos selectores genéricos o buscaremos por texto.
      // NOTA: Para un bot de producción en Avianca, los selectores varían mucho y requieren mantenimiento continuo.
      
      reachedStep = 'LLENANDO_DATOS_PASAJERO';
      
      // Simulamos que el bot intenta encontrar el formulario de nombre y apellido.
      // Como no conocemos el HTML exacto de Avianca hoy sin inspeccionarlo,
      // el bot espera un poco y llena campos si los encuentra por nombre, type, etc.
      
      // Esperamos que cargue el DOM
      await page.waitForTimeout(3000); 

      // Buscar inputs típicos
      const nameInputs = await page.$$('input[name*="name"], input[id*="name"], input[placeholder*="Nombre"]');
      if (nameInputs.length > 0) {
        await nameInputs[0].fill(passengerData.nombre.split(' ')[0] || 'Prueba');
      }

      const lastNameInputs = await page.$$('input[name*="lastname"], input[name*="surname"], input[placeholder*="Apellido"]');
      if (lastNameInputs.length > 0) {
        const parts = passengerData.nombre.split(' ');
        const lastname = parts.length > 1 ? parts.slice(1).join(' ') : 'Demo';
        await lastNameInputs[0].fill(lastname);
      }

      const docInputs = await page.$$('input[name*="document"], input[name*="docNumber"], input[placeholder*="Documento"]');
      if (docInputs.length > 0) {
        await docInputs[0].fill(passengerData.identificacion || '123456789');
      }
      
      const emailInputs = await page.$$('input[type="email"], input[name*="email"]');
      if (emailInputs.length > 0) {
        await emailInputs[0].fill(passengerData.email || 'demo@example.com');
      }

      // Supongamos que damos click en continuar
      const continueBtns = await page.$$('button:has-text("Continuar"), button:has-text("Siguiente"), .btn-continue');
      if (continueBtns.length > 0) {
        await continueBtns[0].click();
        await page.waitForTimeout(3000); // esperar transición
      }

      reachedStep = 'ANTES_DE_PAGO';
      
      // Tomamos la captura final antes del pago
      screenshotPath = path.join(screenshotsDir, `${idempotencyKey}_final_success.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

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
