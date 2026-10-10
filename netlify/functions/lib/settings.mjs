// Fecha/hora del evento y precio: fuente de verdad en SQL para la creación.
export const EVENT_NAME = 'Halloween VORTEX';
export const EVENT_DATE = '2026-10-30T21:30:00-03:00';
export const PRESALE_END = '2026-10-17T21:00:00-03:00';
export const PRICE_ANTICIPADA = 30000;
export const PRICE_NORMAL = 50000;
export const EVENT_PLACE = 'Quinta Maitei';

export function formatPrice(value) {
  return `Gs. ${Number(value || 0).toLocaleString('de-DE')}`;
}

export function presaleAvailable(now = Date.now()) { return now < Date.parse(PRESALE_END); }
export function eventAvailable(now = Date.now()) { return now < Date.parse(EVENT_DATE); }

export function shortDate(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Asuncion', year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit',minute:'2-digit',hour12:false
    }).format(new Date(iso));
  } catch { return String(iso).slice(0,16).replace('T',' '); }
}

export function whatsappNumber() {
  return (process.env.VORTEX_WHATSAPP_NUMBER || '').replace(/\D/g,'');
}
