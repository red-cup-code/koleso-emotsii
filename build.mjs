import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const read = name => readFileSync('src/' + name,'utf8');
const data = 'const EMOTIONS = ' + JSON.stringify(JSON.parse(read('emotions.json'))) + ';\n';
const worker = data + 'const HTML = ' + JSON.stringify(read('index.html')) + ';\n' +
  'const APP = ' + JSON.stringify(data + read('app.js')) + ';\n' + read('worker.js');
mkdirSync('dist/server', {recursive:true});
writeFileSync('dist/server/index.js', worker);
