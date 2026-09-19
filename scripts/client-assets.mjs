import {readFile} from 'node:fs/promises';

// The explicit allowlist keeps configuration and server files out of releases.
export const clientFiles=['index.html','style.css','library.css','reasoning.css','accounts.css','layout.mjs','data.mjs','model.mjs','account-model.mjs','account-ui.mjs','account-challenge.mjs','adoption.mjs','adoption-fulfillment.mjs','adoption-ui.mjs','workspace.mjs','definitions.mjs','definitions-ui.mjs','counterparts.mjs','counterpart-ui.mjs','conversation-tree.mjs','discussion.mjs','discussion-ui.mjs','reasoning-view.mjs','reasoning-layout.mjs','reasoning-ui.mjs','argument.mjs','argument-canvas.mjs','argument-ui.mjs','comparison-layout.mjs','compare-canvas.mjs','participation-ui.mjs','library-ui.mjs','node-actions.mjs','workspace-ui.mjs','app.mjs','beta-boot.mjs'];

export async function clientAssets({accounts=true}={}){
  const assets={};
  for(const file of clientFiles){
    let body=await readFile(new URL('../dist/'+file,import.meta.url),'utf8');
    if(accounts&&file==='index.html')body=body.replace('</head>','<link rel="stylesheet" href="./accounts.css"></head>').replace('src="./app.mjs"','src="./beta-boot.mjs"');
    assets['/'+file]={body,type:file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'};
  }
  assets['/']=assets['/index.html'];
  return assets;
}
