import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

// Compile the actual production graph. Fulfil every external request locally before it reaches any service.
await build();
const server=await preview({preview:{host:'127.0.0.1',port:5183,strictPort:true}});
let browser;
try {
  const executablePath=process.env.SMSA_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser=await chromium.launch({headless:true,...(fs.existsSync(executablePath) ? {executablePath} : {})});
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  const errors=[],externalPaths=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();
    externalPaths.push(new URL(route.request().url()).pathname);
    if(route.request().resourceType()==='stylesheet')return route.fulfill({contentType:'text/css',body:''});
    return route.fulfill({contentType:'application/json',body:'[]',headers:{'access-control-allow-origin':'*'}});
  });
  await page.goto('http://127.0.0.1:5183');
  await page.locator('#home').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Committee',exact:true}).click();
  await page.getByRole('region',{name:'Committee years'}).waitFor({state:'visible'});
  const management=fs.readdirSync('dist/assets').find(file=>/^Management-.*\.js$/.test(file));
  assert(management,'CMS remains a separate lazy-loaded chunk');
  await page.evaluate(async file=>{const module=await import('/assets/'+file);if(!module)throw new Error('Missing CMS chunk');},management);
  assert.equal(errors.length,0,errors.join('\n'));
  assert(!externalPaths.some(path=>path.includes('smsa_get_committee_layouts_v1') || path.includes('smsa_save_committee_layout_v1')),'Unverified ordering backend is disabled in production');
  const bundles=fs.readdirSync('dist/assets').filter(file=>file.endsWith('.js')).map(file=>fs.readFileSync('dist/assets/'+file,'utf8'));
  assert(!bundles.some(text=>text.includes('__smsaMock') || text.includes('Fixture reunion')),'Synthetic adapter must not be included in production');
  console.log('PASS: production vendor/CMS chunks load in Chromium; all external requests fulfilled locally, no live Supabase connection; test fixtures absent from production.');
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.httpServer.close(resolve));
}
