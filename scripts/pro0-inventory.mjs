/** Structural baseline only. Reads tracked source paths; never reads env files/secrets. */
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const paths=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n');
const files=paths.filter(p=>/^(src|scripts|tests|supabase\/migrations)\//.test(p));
const pages=files.filter(p=>p.startsWith('src/app/')&&p.endsWith('/page.tsx'));
const routes=files.filter(p=>/^src\/app\/.*\/route\.ts$/.test(p));
const migrations=files.filter(p=>/^supabase\/migrations\/.*\.sql$/.test(p));
const features=[...new Set(files.filter(p=>p.startsWith('src/features/')).map(p=>p.split('/')[2]))].sort();
const patternCounts=[];
for(const path of files.filter(p=>p.startsWith('src/features/')&&p.endsWith('.tsx'))){
 const s=await readFile(path,'utf8');
 const count=pattern=>(s.match(pattern)||[]).length;
 const row={path,nativeDialogs:count(/<dialog\b/g),managedDialogs:count(/<ManagedDialog\b/g),formDialogs:count(/<FormDialog\b/g),uiPanels:count(/\bui-panel\b/g),details:count(/<details\b/g)};
 if(Object.values(row).slice(1).some(Boolean))patternCounts.push(row);
}
const packageJson=JSON.parse(await readFile('package.json','utf8'));
const result={schemaVersion:1,measuredAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),kind:'static-structure-not-behavior-audit',counts:{srcFiles:files.filter(p=>p.startsWith('src/')).length,pages:pages.length,apiRouteFiles:routes.filter(p=>p.startsWith('src/app/api/')).length,allRouteFiles:routes.length,migrations:migrations.length,features:features.length},pages,routes,features,migrations,packageScripts:packageJson.scripts,packageLockSha256:createHash('sha256').update(await readFile('package-lock.json')).digest('hex'),patternCounts,limits:['Route-file counts are not dispatcher action counts.','Pattern counts indicate adoption candidates, not confirmed UX bugs or unsafe duplication.','No secret files, database rows, credentials or runtime user identities are read.']};
const output=process.argv[2];if(!output)throw Error('OUTPUT_PATH_REQUIRED');
await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.counts));
