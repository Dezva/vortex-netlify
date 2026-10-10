import { createClient } from '@supabase/supabase-js';
import { envSecret } from './security.mjs';

let client;
export function db() {
  if (!client) {
    client = createClient(envSecret('SUPABASE_URL'),envSecret('SUPABASE_SECRET_KEY'),{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
  }
  return client;
}

export async function rpc(name, args={}) {
  const {data,error} = await db().rpc(name,args);
  if (error) throw error;
  return data;
}

export async function ticketByCode(code) {
  const {data,error} = await db().from('vortex_entradas').select('*').eq('codigo',code).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTickets(q='') {
  let query = db().from('vortex_entradas').select('*').order('id',{ascending:false}).limit(500);
  if (q) {
    const cleaned = q.normalize('NFKC').replace(/[^\p{L}\p{N} +\-]/gu,'').slice(0,60);
    if (cleaned.trim()) {
      const fragment = `%${cleaned.trim()}%`;
      query = query.or(`codigo.ilike.${fragment},nombre.ilike.${fragment},telefono.ilike.${fragment}`);
    }
  }
  const {data,error} = await query;
  if (error) throw error;
  return data || [];
}

export async function csvTickets() {
  const all=[];
  // PostgREST pagina resultados; este control impide exportaciones excesivas.
  for (let start=0; start<10000; start+=1000) {
    const {data,error} = await db().from('vortex_entradas')
      .select('codigo,nombre,telefono,tipo,precio,estado_pago,estado_entrada,creado_en,pagado_en,utilizado_en')
      .order('id',{ascending:true}).range(start,start+999);
    if (error) throw error;
    all.push(...(data||[]));
    if (!data || data.length<1000) break;
  }
  return all;
}
