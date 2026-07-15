const fs = require('fs');
['src/views/HomeView.vue', 'src/views/OfertaView.vue'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/fetch\('\/api\//g, "fetch((import.meta.env.VITE_API_URL || '') + '/api/");
  content = content.replace(/fetch\(\`\/api\//g, "fetch((import.meta.env.VITE_API_URL || '') + `/api/");
  fs.writeFileSync(file, content);
});
console.log('API URLs updated.');
