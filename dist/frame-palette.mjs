// Shared category colors for every map canvas. Ink colors support readable
// controls and selection; paler category shades remain available for future use.
export const FRAME_PALETTE=Object.freeze({
  status:Object.freeze({color:'#EDAAA7',ink:'#713333'}),
  action:Object.freeze({color:'#A4C7EB',ink:'#204C74'}),
  goal:Object.freeze({color:'#A9CFA8',ink:'#2A5628'})
});
export const FRAME_COLORS=Object.freeze(['status','action','goal'].map(id=>FRAME_PALETTE[id].color));

export function installFramePalette(root=globalThis.document?.documentElement){
  if(!root?.style?.setProperty)return;
  for(const [id,{color,ink}]of Object.entries(FRAME_PALETTE)){
    root.style.setProperty(`--frame-${id}`,color);
    root.style.setProperty(`--frame-${id}-ink`,ink);
  }
}
