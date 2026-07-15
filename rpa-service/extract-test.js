const fs = require('fs');
const body = fs.readFileSync('body.txt', 'utf8');

      const results = [];
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
        console.log("Testing block:", blockText);
        
        const priceMatch = blockText.match(priceRegex);
        if (!priceMatch) { console.log("NO PRICE MATCH"); continue; }
        
        let price = parseInt(priceMatch[1].replace(/[.,]/g, ''), 10);
        if (price > 20000) {
          price = Math.round(price / 4000);
        }
        
        if (price < 10 || price > 10000) { console.log("PRICE OUT OF BOUNDS", price); continue; }

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
            priceUSD: price,
            departureTime: times[0] || '08:00 AM',
            arrivalTime: times[1] || (times.length > 1 ? times[times.length - 1] : '11:00 AM'),
            stops: typeof stops === 'string' ? parseInt(stops) || 0 : stops,
            durationMinutes: durationMin
          });
        } else {
            console.log("FAILED AIRLINE OR TIMES. Airline:", airline, "Times:", times.length);
        }
      }

console.log("RESULTS:", results);
