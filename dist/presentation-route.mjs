export function presentationRoute(values){
 const route=new URLSearchParams(values),layout=globalThis.document?.body?.dataset?.presentation;
 if(layout==='canvas'||layout==='outline')route.set('layout',layout);
 return route;
}
