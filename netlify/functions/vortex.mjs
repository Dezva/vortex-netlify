import QRCode from 'qrcode';
import { EVENT_NAME, EVENT_DATE, PRESALE_END, PRICE_ANTICIPADA, PRICE_NORMAL, EVENT_PLACE,
         formatPrice, presaleAvailable, eventAvailable, shortDate, whatsappNumber } from './lib/settings.mjs';
import { envSecret, equalsSecret, newSession, isAdmin, sessionCookie,
         sameOrigin, safeNext, ipKey } from './lib/security.mjs';
import { rpc, ticketByCode, listTickets, csvTickets } from './lib/db.mjs';
import { page, responseHTML, redirect, json, errorPage } from './lib/render.mjs';

const CODE_PATTERN = /^VX-H26-[A-F0-9]{20}$/;
function codeFrom(url, regex) {
  const match = url.pathname.match(regex);
  if (!match) return null;
  const code = match[1].toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}
function normalizePhone(s) {
  const original=String(s||'').trim();
  const digits=original.replace(/\D/g,'');
  if (digits.length<6 || digits.length>18) return null;
  return (original.startsWith('+') ? '+' : '')+digits;
}
function normalizeName(s) { return String(s||'').trim().replace(/\s+/g,' '); }
function fullTicket(row) {
  return {...row,evento_nombre:EVENT_NAME,evento_lugar:EVENT_PLACE,
          evento_fecha:EVENT_DATE,creado_corto:shortDate(row.creado_en),
          tipo_etiqueta:row.tipo==='anticipada'?'Anticipada':'Normal'};
}
async function rateLimit(req,kind,max,seconds) {
  const ok = await rpc('vortex_limite_por_ip', {
    p_clave:ipKey(req,kind),p_categoria:kind,p_max:max,p_segundos:seconds
  });
  return Boolean(ok);
}
function needAdmin(req) {
  return isAdmin(req) ? null : redirect(`/admin/login?next=${encodeURIComponent(safeNext(new URL(req.url).pathname))}`);
}
function adminLogin(req, next='/admin', error=null, status=200) {
  return responseHTML(page('admin_login', {next:safeNext(next),error}),status);
}
function csvCell(value) {
  let s=String(value ?? '');
  // Protección ante fórmulas en Excel/Google Sheets, incluso con espacios iniciales.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s)) s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}

export default async function handler(req) {
  const url=new URL(req.url);
  const path=decodeURIComponent(url.pathname);
  const method=req.method.toUpperCase();
  try {
    // Bloquea peticiones de otras páginas en todas las operaciones que modifican datos.
    if (method==='POST' && !sameOrigin(req)) {
      return json({detail:'Origen no autorizado.'},403);
    }

    if (path==='/api/config' && method==='GET') {
      return json({evento:EVENT_NAME,evento_fecha:EVENT_DATE,
        anticipada_precio:PRICE_ANTICIPADA, normal_precio:PRICE_NORMAL,
        anticipada_fin:PRESALE_END,anticipada_disponible:presaleAvailable(),
        normal_disponible:eventAvailable()});
    }

    if (path==='/api/entradas' && method==='POST') {
      if (!req.headers.get('content-type')?.toLowerCase().includes('application/json')) {
        return json({detail:'Enviá datos JSON.'},415);
      }
      const raw=await req.text();
      if (raw.length>4096) return json({detail:'Solicitud demasiado extensa.'},413);
      let data;
      try { data=JSON.parse(raw); } catch { return json({detail:'JSON no válido.'},400); }
      if (!data || typeof data!=='object' || Array.isArray(data)) return json({detail:'Datos inválidos.'},422);
      const tipo=String(data.tipo||'').trim().toLowerCase();
      const nombre=normalizeName(data.nombre);
      const telefono=normalizePhone(data.telefono);
      if (!['anticipada','listado'].includes(tipo) || nombre.length<3 || nombre.length>80 || !telefono) {
        return json({detail:'Completá nombre, WhatsApp y tipo de entrada válidos.'},422);
      }
      if (!eventAvailable()) return json({detail:'El evento ya comenzó o finalizó.'},409);
      if (tipo==='anticipada' && !presaleAvailable()) {
        return json({detail:'Las anticipadas cerraron el sábado 17 de octubre a las 21:00. Elegí entrada normal.'},409);
      }
      if (!(await rateLimit(req,'registro',15,600))) {
        return json({detail:'Demasiados registros desde esta conexión. Esperá unos minutos.'},429);
      }
      // La base de datos comprueba nuevamente fecha, tipo y precio, sin confiar en el navegador.
      let created;
      try { created=await rpc('vortex_registrar',{p_nombre:nombre,p_telefono:telefono,p_tipo:tipo}); }
      catch (err) {
        if (String(err.message||'').includes('ANTICIPADA_CERRADA'))
          return json({detail:'Las anticipadas ya cerraron. Elegí entrada normal.'},409);
        if (String(err.message||'').includes('EVENTO_CERRADO'))
          return json({detail:'Las inscripciones ya cerraron.'},409);
        if (String(err.message||'').includes('DATOS_INVALIDOS'))
          return json({detail:'Verificá los datos ingresados.'},422);
        throw err;
      }
      const base=url.origin;
      const numero=whatsappNumber();
      const code=created.codigo;
      const text=`Hola VORTEX, registré una entrada ${tipo==='anticipada'?'anticipada':'normal'} para Halloween VORTEX. Código: ${code}. Nombre: ${nombre}. Precio: ${formatPrice(created.precio)}. Quiero coordinar el pago.`;
      return json({ok:true,codigo:code,tipo,precio:created.precio,
        precio_formateado:formatPrice(created.precio),estado_pago:'pendiente',
        ticket_url:`${base}/entrada/${encodeURIComponent(code)}`,
        whatsapp_url:numero ? `https://wa.me/${numero}?text=${encodeURIComponent(text)}` : ''},201);
    }

    const qrCode=codeFrom(url,/^\/entrada\/([^/]+)\/qr\/?$/i);
    if (path.match(/^\/entrada\/[^/]+\/qr\/?$/i) && method==='GET') {
      if (!qrCode) return errorPage(404,'Entrada no encontrada.');
      const ticket=await ticketByCode(qrCode);
      if (!ticket) return errorPage(404,'Entrada no encontrada.');
      if (ticket.estado_pago!=='pagado' || ticket.estado_entrada!=='disponible')
        return errorPage(403,'QR no disponible.');
      const png=await QRCode.toBuffer(`${url.origin}/scan/${qrCode}`,{
        type:'png',margin:3,width:300,errorCorrectionLevel:'M'
      });
      return new Response(png,{status:200,headers:{'Content-Type':'image/png',
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    const ticketCode=codeFrom(url,/^\/entrada\/([^/]+)\/?$/i);
    if (path.match(/^\/entrada\/[^/]+\/?$/i) && method==='GET') {
      if (!ticketCode) return errorPage(404,'Entrada no encontrada.');
      const ticket=await ticketByCode(ticketCode);
      if (!ticket) return errorPage(404,'Entrada no encontrada.');
      return responseHTML(page('ticket',{ticket:fullTicket(ticket),precio:formatPrice(ticket.precio)}));
    }

    if (path==='/admin/login' && method==='GET') {
      return adminLogin(req,url.searchParams.get('next')||'/admin');
    }
    if (path==='/admin/login' && method==='POST') {
      if (!(await rateLimit(req,'login',8,900))) {
        return adminLogin(req,'/admin','Demasiados intentos. Probá de nuevo más tarde.',429);
      }
      const form=await req.formData();
      const password=String(form.get('password')||'');
      const next=safeNext(String(form.get('next')||'/admin'));
      if (!equalsSecret(password,envSecret('VORTEX_ADMIN_PASSWORD',1))) {
        return adminLogin(req,next,'Contraseña incorrecta.',401);
      }
      const session=newSession(envSecret('VORTEX_SESSION_SECRET',32));
      return redirect(next,{'Set-Cookie':sessionCookie(req,session)});
    }
    if (path==='/admin/logout' && method==='POST') {
      return redirect('/',{'Set-Cookie':sessionCookie(req,'',0)});
    }

    if (path==='/admin' && method==='GET') {
      const auth=needAdmin(req); if (auth) return auth;
      const q=String(url.searchParams.get('q')||'').slice(0,60);
      const [tickets,stats]=await Promise.all([listTickets(q),rpc('vortex_estadisticas')]);
      return responseHTML(page('admin',{tickets:tickets.map(fullTicket),stats,q,admin_password_default:false}));
    }
    if (path==='/admin/export.csv' && method==='GET') {
      const auth=needAdmin(req); if(auth) return auth;
      const rows=await csvTickets();
      const cols=['codigo','nombre','telefono','tipo','precio','estado_pago','estado_entrada','creado_en','pagado_en','utilizado_en'];
      const text=[cols.join(','),...rows.map(row=>cols.map(c=>csvCell(row[c])).join(','))].join('\r\n');
      return new Response('\ufeff'+text,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8',
        'Cache-Control':'no-store','Content-Disposition':'attachment; filename="vortex_entradas.csv"'}});
    }
    if (path.match(/^\/admin\/entrada\/[^/]+\/(pagar|usar|cancelar)\/?$/i) && method==='POST') {
      const auth=needAdmin(req); if(auth) return auth;
      const matched=path.match(/^\/admin\/entrada\/([^/]+)\/(pagar|usar|cancelar)\/?$/i);
      const code=matched[1].toUpperCase();
      if (!CODE_PATTERN.test(code)) return errorPage(404,'Entrada no encontrada.');
      const actionMap={pagar:'pay',usar:'use',cancelar:'cancel'};
      const accion=actionMap[matched[2].toLowerCase()];
      const form=await req.formData();
      try { await rpc('vortex_cambiar_estado',{p_codigo:code,p_accion:accion}); }
      catch (err) {
        if (String(err.message||'').startsWith('ESTADO_INVALIDO')) return errorPage(409,'La entrada cambió de estado. Volvé al panel y actualizá la información.');
        if (String(err.message||'').startsWith('NO_EXISTE')) return errorPage(404,'Entrada no encontrada.');
        throw err;
      }
      return redirect(accion==='use' ? safeNext(String(form.get('next')||'/admin')) : '/admin');
    }
    if (path.match(/^\/scan\/[^/]+\/?$/i) && method==='GET') {
      const auth=needAdmin(req); if(auth) return auth;
      const code=codeFrom(url,/^\/scan\/([^/]+)\/?$/i);
      if (!code) return errorPage(404,'Entrada no encontrada.');
      const ticket=await ticketByCode(code);
      if (!ticket) return errorPage(404,'Entrada no encontrada.');
      return responseHTML(page('scan',{ticket:fullTicket(ticket),precio:formatPrice(ticket.precio)}));
    }
    return errorPage(404,'Página no encontrada.');
  } catch (err) {
    console.error('VORTEX backend error:',err?.message||String(err));
    return path.startsWith('/api/')
      ? json({detail:'Servicio temporalmente no disponible. Contactá a VORTEX.'},503)
      : errorPage(503,'Servicio temporalmente no disponible. Revisá la configuración de Netlify y Supabase.');
  }
}

export const config = {
  path: ['/api/*','/entrada/*','/admin','/admin/*','/scan/*']
};
