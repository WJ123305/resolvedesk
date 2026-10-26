import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dest=resolve(root,'.tools/verification');
await mkdir(dest,{recursive:true});
const files=[
 ['ecj.jar','org/eclipse/jdt/ecj/3.36.0/ecj-3.36.0.jar','a9a969911a55ffd7ad04d3ca4caf4f363b7b80a27701289dba3cc713084080c0'],
 ['junit-console.jar','org/junit/platform/junit-platform-console-standalone/1.12.2/junit-platform-console-standalone-1.12.2.jar','329bd10288875a74d04c9ca6b7c9889c265ddf87b21a9ea42a7f7392f391472a'],
];
for(const [name,path,hash] of files){
 let bytes=await readFile(resolve(dest,name)).catch(()=>null);
 if(!bytes||createHash('sha256').update(bytes).digest('hex')!==hash){
  const response=await fetch('https://repo.maven.apache.org/maven2/'+path);
  if(!response.ok) throw new Error(`Download failed: ${name}`);
  bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==hash) throw new Error(`Checksum mismatch: ${name}`);
  await writeFile(resolve(dest,name),bytes);
 }
 console.log(`Verified ${name}`);
}
