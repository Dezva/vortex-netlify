import test from 'node:test';
import assert from 'node:assert/strict';
import { envSecret, equalsSecret, newSession, verifySession, safeNext, sameOrigin, sessionCookie } from '../netlify/functions/lib/security.mjs';
import {formatPrice, presaleAvailable, eventAvailable, shortDate} from '../netlify/functions/lib/settings.mjs';

test('comparación de secretos acepta UTF-8 y evita coincidencias falsas',()=>{
  assert.ok(equalsSecret('contraseña segura ñ','contraseña segura ñ'));
  assert.ok(!equalsSecret('contraseña segura ñ','contraseña segura n'));
});
test('token de administración firmado con vencimiento',()=>{
  const secret='A'.repeat(50);
  const now=Date.UTC(2026,9,10);
  const token=newSession(secret,now);
  assert.ok(verifySession(token,secret,now+100));
  assert.ok(!verifySession(token,'B'.repeat(50),now+100));
  assert.ok(!verifySession(token,secret,now+9*60*60*1000));
  assert.ok(!verifySession(token.slice(0,-1)+'A',secret,now+100));
});
test('filtros de origen y rutas de redirección',()=>{
  const req=new Request('https://vortex.netlify.app/admin/login',{method:'POST',headers:{Origin:'https://vortex.netlify.app'}});
  const evil=new Request('https://vortex.netlify.app/admin/login',{method:'POST',headers:{Origin:'https://fraude.example'}});
  assert.equal(sameOrigin(req),true);
  assert.equal(sameOrigin(evil),false);
  assert.equal(safeNext('//fraude.example'),'/admin');
  assert.equal(safeNext('/scan/VX-H26-0123456789ABCDEF0123'),'/scan/VX-H26-0123456789ABCDEF0123');
  assert.ok(sessionCookie(req,'abc').includes('HttpOnly'));
  assert.ok(sessionCookie(req,'abc').includes('Secure'));
});
test('precios y fechas Paraguay',()=>{
  assert.equal(formatPrice(30000),'Gs. 30.000');
  assert.equal(formatPrice(50000),'Gs. 50.000');
  assert.ok(presaleAvailable(Date.parse('2026-10-17T20:59:59-03:00')));
  assert.equal(presaleAvailable(Date.parse('2026-10-17T21:00:00-03:00')),false);
  assert.equal(presaleAvailable(Date.parse('2026-10-17T21:00:01-03:00')),false);
  assert.ok(eventAvailable(Date.parse('2026-10-29T21:30:00-03:00')));
  assert.equal(eventAvailable(Date.parse('2026-10-30T21:30:00-03:00')),false);
  assert.ok(shortDate('2026-10-10T01:47:00Z').includes('2026-10-09'));
});

test('Netlify dev: permite formularios legítimos detrás de proxy sin relajar peticiones de otros sitios',()=>{
  const proxy = 'http://localhost:3999/admin/login';
  const headersOk = {Origin:'http://localhost:8888', 'Sec-Fetch-Site':'same-origin'};
  const headersCross = {Origin:'https://fraude.example', 'Sec-Fetch-Site':'cross-site'};
  const headersSameSite = {Origin:'https://otro.subdominio.example', 'Sec-Fetch-Site':'same-site'};
  const make = headers=>new Request(proxy,{method:'POST',headers});
  assert.equal(sameOrigin(make(headersOk)),true);
  assert.equal(sameOrigin(make(headersCross)),false);
  assert.equal(sameOrigin(make(headersSameSite)),false);
  assert.equal(sameOrigin(make({Origin:'https://fraude.example'})),false);
  assert.equal(sameOrigin(make({})),false);
});

test('contraseña administrativa corta permitida en pruebas (no vacía)',()=>{
  const prev = process.env.VORTEX_ADMIN_PASSWORD;
  try {
    process.env.VORTEX_ADMIN_PASSWORD='bebota7';
    assert.equal(envSecret('VORTEX_ADMIN_PASSWORD',1),'bebota7');
    process.env.VORTEX_ADMIN_PASSWORD='';
    assert.throws(()=>envSecret('VORTEX_ADMIN_PASSWORD',1));
  } finally {
    if (prev === undefined) delete process.env.VORTEX_ADMIN_PASSWORD;
    else process.env.VORTEX_ADMIN_PASSWORD=prev;
  }
});
