const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const origin = 'BOG';
  const destination = 'MDE';
  const dateString = '2026-07-15';
  
  const searchUrl = `https://www.google.com/travel/flights?q=Flights+from+${origin}+to+${destination}+on+${dateString}&curr=USD`;
  console.log('Navigating to', searchUrl);
  
  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("=== FIRST 2000 CHARS OF BODY ===");
  console.log(bodyText.substring(0, 2000));
  
  console.log("=== PRICE MATCHES ===");
  const matches = [...bodyText.matchAll(/(?:COP|\$)\s*(\d{1,3}(?:[.,]\d{3})*)/gi)];
  console.log(`Found ${matches.length} price matches`);
  matches.slice(0, 5).forEach(m => console.log(m[0]));
  
  await browser.close();
})();
