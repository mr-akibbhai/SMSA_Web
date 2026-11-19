import { spawnSync } from 'node:child_process';

for(const width of [390,1440]) {
  const result=spawnSync(process.execPath,['tests/redesign-browser.mjs'],{stdio:'inherit',env:{...process.env,SMSA_TEST_WIDTH:String(width)}});
  if(result.status!==0)process.exit(result.status || 1);
}
const production=spawnSync(process.execPath,['tests/production-smoke.mjs'],{stdio:'inherit'});
process.exit(production.status || (production.error ? 1 : 0));
