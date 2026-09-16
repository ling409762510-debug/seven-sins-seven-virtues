import { mkdir, copyFile, cp, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist/vendor', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'config.js', 'content.js', 'scoring.js', 'storage.js', 'visuals.js', 'favicon.svg']) {
  await copyFile(file, `dist/${file}`);
}
await copyFile('node_modules/html2canvas/dist/html2canvas.min.js', 'dist/vendor/html2canvas.min.js');
await copyFile('node_modules/html2canvas/LICENSE', 'dist/vendor/html2canvas.LICENSE');
await cp('docs', 'dist/docs', { recursive: true });
// Portable, offline copy: same source and scoring, with all assets embedded.
const scriptOrder=['config.js','content.js','scoring.js','storage.js','visuals.js','app.js'];
const bundle=(await Promise.all(scriptOrder.map(f=>readFile(f,'utf8')))).map(source=>source.replace(/^import .*;\r?$/gm,'').replace(/^export /gm,'')).join('\n');
const safeScript=text=>text.replace(/<\/script/gi,'<\\/script');
let standalone=await readFile('index.html','utf8');
const vendor=safeScript(await readFile('node_modules/html2canvas/dist/html2canvas.min.js','utf8'));
standalone=standalone.replace('<link rel="stylesheet" href="./styles.css">',`<style>${await readFile('styles.css','utf8')}</style>`)
  .replace('<script src="./vendor/html2canvas.min.js" defer></script>',()=>`<script>${vendor}</script>`)
  .replace('<script type="module" src="./app.js"></script>',()=>`<script type="module">${safeScript(bundle)}</script>`)
  .replace('href="./favicon.svg"',`href="data:image/svg+xml,${encodeURIComponent(await readFile('favicon.svg','utf8'))}"`);
await writeFile('dist/standalone.html',standalone);
console.log('Static site ready in dist/');
