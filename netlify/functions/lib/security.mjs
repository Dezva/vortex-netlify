import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export function envSecret(name, minLength=1) {
  const value = process.env[name] || '';
  if (value.length < minLength || /^CAMBIA_|^COLOCA_/.test(value)) {
    throw new Error(`Configuración incompleta: ${name}`);
  }
  return value;
}

export function equalsSecret(a, b) {
  const hash = s => createHash('sha256').update(String(s), 'utf8').digest();
  return timingSafeEqual(hash(a), hash(b));
}

function sign(text, secret) {
  return createHmac('sha256', secret).update(text).digest('base64url');
}

export function newSession(secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ role:'admin', exp: now + 8*60*60*1000 })).toString('base64url');
  return payload + '.' + sign(payload, secret);
}

export function verifySession(token, secret, now = Date.now()) {
  if (!token || typeof token !== 'string') return false;
  const [payload, signature, ...extra] = token.split('.');
  if (!payload || !signature || extra.length || !equalsSecret(signature, sign(payload, secret))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload,'base64url').toString());
    return parsed.role === 'admin' && Number.isFinite(parsed.exp) && parsed.exp > now;
  } catch { return false; }
}

export function cookieValue(req, name) {
  const all = req.headers.get('cookie') || '';
  const match = all.split(';').map(s=>s.trim()).find(s => s.startsWith(name+'='));
  return match ? match.slice(name.length+1) : '';
}

export function isAdmin(req) {
  const secret = envSecret('VORTEX_SESSION_SECRET',32);
  return verifySession(cookieValue(req,'vortex_admin'), secret);
}

export function sessionCookie(req, value, maxAge=8*60*60) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `vortex_admin=${value}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${maxAge}`;
}

export function sameOrigin(req) {
  // El navegador marca los formularios y fetch del mismo origen con Sec-Fetch-Site.
  // Esto evita falsos rechazos cuando el proxy local de Netlify cambia el origen
  // de la URL interna vista por la función (por ejemplo 8888 -> 3999).
  // Los navegadores no permiten que JavaScript modifique Sec-Fetch-Site.
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site' || fetchSite === 'same-site') return false;
  if (fetchSite === 'same-origin') return true;

  // Compatibilidad con agentes que no envían Fetch Metadata; cerramos por defecto
  // si tampoco podemos comprobar un Origin o Referer coincidente.
  const url = new URL(req.url);
  const origin = req.headers.get('origin');
  if (origin) return origin === url.origin;
  const ref = req.headers.get('referer');
  if (!ref) return false;
  try { return new URL(ref).origin === url.origin; } catch { return false; }
}

export function safeNext(value) {
  if (typeof value !== 'string' || value.startsWith('//') || value.includes('\\')) return '/admin';
  if (value === '/admin' || value.startsWith('/scan/')) return value;
  return '/admin';
}

export function ipKey(req, kind) {
  const ip = (req.headers.get('x-nf-client-connection-ip') ||
    (['localhost','127.0.0.1'].includes(new URL(req.url).hostname)
      ? (req.headers.get('x-forwarded-for') || '127.0.0.1') : 'unknown')).split(',')[0].trim();
  return createHmac('sha256',envSecret('VORTEX_SESSION_SECRET',32))
    .update(kind+':'+ip).digest('hex');
}
