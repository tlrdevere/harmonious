export function presentationRoute(values){
 const route=new URLSearchParams(values),layout=globalThis.document?.body?.dataset?.presentation;
 if(layout==='canvas'||layout==='outline')route.set('layout',layout);
 if(globalThis.document?.body?.dataset?.frameView==='timeline')route.set('frames','timeline');
 return route;
}
