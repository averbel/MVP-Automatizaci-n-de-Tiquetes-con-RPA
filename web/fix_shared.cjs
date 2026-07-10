const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      content = content.replace(/\.\.\/_lib\//g, '../../shared/');
      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Fixed api to shared', fullPath);
      }
    }
  }
}
processDir('api');

function processShared(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processShared(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      // if shared files import from each other via ./, it's fine, no change needed.
      if (content !== original) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}
processShared('shared');
