import nunjucks from 'nunjucks';
import {templates} from './templates.mjs';
import {formatPrice} from './settings.mjs';
const engine = new nunjucks.Environment(null,{autoescape:true,throwOnUndefined:false});

export function page(template, locals={}) {
  return engine.renderString(templates[template], { ...locals, format_price:formatPrice });
}

export function responseHTML(html,status=200,headers={}) {
  return new Response(html,{status,headers:{'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store','Referrer-Policy':'no-referrer',
    'X-Content-Type-Options':'nosniff',...headers}});
}

export function json(value,status=200,headers={}) {
  return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
}

export function redirect(where,headers={}) {
  return new Response(null,{status:303,headers:{Location:where,'Cache-Control':'no-store',...headers}});
}

export function errorPage(status,message) {
  return responseHTML(`<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{background:#09040f;color:white;font-family:system-ui;padding:30px}a{color:#bf8eff}</style><h1>Error ${status}</h1><p>${message}</p><a href="/">Volver a Vortex</a></html>`,status);
}
