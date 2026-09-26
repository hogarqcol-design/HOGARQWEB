const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'public');
fs.mkdirSync(output,{recursive:true});
// Explicit allowlist: server source, env files, tests and order data are never published.
for (const file of fs.readdirSync(root)) {
  if (/\.(png|ico)$/i.test(file) || file === 'lumina.mp4') fs.copyFileSync(path.join(root,file),path.join(output,file));
}
fs.cpSync(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
let html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const hashes = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>m[1].trim()).map(m=>"'sha256-"+crypto.createHash('sha256').update(m[1].replace(/\r\n/g,'\n')).digest('base64')+"'");
html=html.replace(/script-src [^;]+;/,"script-src 'self' "+hashes.join(' ')+';');
fs.writeFileSync(path.join(output,'index.html'),html);
console.log('Built public website; server code remains outside public/.');
