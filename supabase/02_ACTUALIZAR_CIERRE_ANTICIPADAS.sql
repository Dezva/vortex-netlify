-- EJECUTAR en Supabase SQL Editor para actualizar el cierre al instante exacto del 17/10/2026 a las 21:00, hora de Asunción.
-- Mantiene las tablas y todos los registros existentes. No ejecutar DROP.
-- Cambia la validación de now()>v_cierre a now()>=v_cierre.

create or replace function public.vortex_registrar(
  p_nombre text, p_telefono text, p_tipo text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nombre text := btrim(p_nombre);
  v_precio integer;
  v_codigo text;
  v_cierre timestamptz := timestamp '2026-10-17 21:00:00' at time zone 'America/Asuncion';
  v_evento timestamptz := timestamp '2026-10-30 21:30:00' at time zone 'America/Asuncion';
begin
  if now() >= v_evento then raise exception 'EVENTO_CERRADO'; end if;
  if p_tipo not in ('anticipada','listado') or
     length(v_nombre) < 3 or length(v_nombre)>80 or
     length(p_telefono)<6 or length(p_telefono)>19 or
     p_telefono !~ '^[+]?[0-9]+$' then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if p_tipo='anticipada' and now()>=v_cierre then raise exception 'ANTICIPADA_CERRADA'; end if;
  v_precio := case when p_tipo='anticipada' then 30000 else 50000 end;
  v_codigo := 'VX-H26-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,20));
  insert into public.vortex_entradas(codigo,nombre,telefono,tipo,precio)
    values(v_codigo,v_nombre,p_telefono,p_tipo,v_precio);
  return jsonb_build_object('codigo',v_codigo,'precio',v_precio);
end;
$$;
