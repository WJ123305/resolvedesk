import {mkdir,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const tools=resolve(root,'.tools');
try {await access(resolve(tools,'apache-maven-3.9.9/bin/mvn.cmd')); console.log('Maven is ready.');}
catch {
 await mkdir(tools,{recursive:true});
 const url='https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip';
 console.log('Downloading Apache Maven 3.9.9…');
 const [archive,checksum]=await Promise.all([fetch(url),fetch(url+'.sha512')]);
 if(!archive.ok||!checksum.ok) throw new Error('Maven download failed');
 const bytes=Buffer.from(await archive.arrayBuffer());
 const expected=(await checksum.text()).trim().split(/\s+/)[0].toLowerCase();
 if(createHash('sha512').update(bytes).digest('hex')!==expected) throw new Error('Maven checksum mismatch');
 await writeFile(resolve(tools,'maven.zip'),bytes);
 console.log('Maven archive verified; ready to extract.');
}
