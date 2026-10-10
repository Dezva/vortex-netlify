# Vortex — Guía de publicación con GitHub y Netlify

## 0. Antes de publicar
1. Conservá una copia de tu proyecto local que funciona y de la carpeta `.env` fuera de GitHub.
2. **Rotá la clave Supabase filtrada en capturas** y cambiala en tu `.env`. Usá una contraseña nueva y robusta para `VORTEX_ADMIN_PASSWORD`.
3. Ya tenés creadas las tablas de Supabase. Si ejecutaste el SQL anterior, **no necesitás volver a crear tablas** para el cierre de preventa: la validación ya existía. Para que el cierre sea estricto justo a las 21:00:00, ejecutá en Supabase > SQL Editor **solo** `supabase/02_ACTUALIZAR_CIERRE_ANTICIPADAS.sql` del nuevo ZIP. Reemplaza la función sin borrar registros.
4. Los archivos `.env`, `.netlify` y `node_modules` nunca se suben.

## 1. GitHub
1. En GitHub creá un repositorio **Private** llamado `vortex-netlify`. No le añadas README, LICENSE ni `.gitignore` al crearlo (los archivos ya existen).
2. En tu PC, descomprimí este ZIP. Subí **el contenido interno** de `vortex_publicacion_netlify/`, conservando carpetas y subcarpetas.
3. Podés usar GitHub Desktop para publicar la carpeta local. Si usás el navegador, elegí `uploading an existing file` y verificá que se mantenga toda la estructura.
4. Confirmá que en la raíz del repo estén `package.json`, `netlify.toml` y `.gitignore`; que `public/index.html` y `netlify/functions/vortex.mjs` estén en las carpetas correctas.
5. Antes de guardar, revisá que `.env`, `.netlify` y `node_modules` **no aparezcan** en los cambios.

## 2. Netlify
1. Abrí el dashboard de Netlify > **Add new project** > **Import an existing project** > **GitHub**.
2. Seleccioná `vortex-netlify` y autorizá acceso si Netlify lo solicita.
3. Configurá: `Base directory`: vacío (raíz), `Build command`: vacío, `Publish directory`: `public`. La carpeta `netlify/functions` se define en `netlify.toml`.
4. Publicá el proyecto. Si lo hiciste antes de configurar las variables, la página estática se verá, pero las entradas aún no funcionarán. **No aceptes compras todavía.**
5. Abrí **Project configuration > Environment variables**. Añadí los valores REALES y privados de: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VORTEX_ADMIN_PASSWORD`, `VORTEX_SESSION_SECRET`, `VORTEX_WHATSAPP_NUMBER`. En los planes en los que se pueden elegir ámbitos, elegí `Functions` o `All scopes`.
6. Guardá las variables y realizá **un nuevo deploy** para que queden disponibles. No compartas las claves.
7. Netlify te dará una URL pública, por ejemplo `https://tusitio.netlify.app`. Usá la real para probar.

## 3. Pruebas públicas
1. Abrí `https://TUSITIO.netlify.app/api/config`: debe responder JSON.
2. Entrá a `https://TUSITIO.netlify.app/accesos`, registrá una entrada de prueba y buscala en `Supabase > Table Editor > vortex_entradas`.
3. Entrá a `/admin`, confirmá el pago de prueba y abrí `/entrada/CODIGO`.
4. Escaneá el QR desde otro celular. Si pide inicio de sesión, es esperado: el escaneo y el marcado como utilizado son exclusivos del personal autorizado.
5. Marcá la entrada como utilizada e intentá validarla otra vez: debe quedar rechazada.
6. El QR que se generó en `localhost` no servirá desde tu celular: abrí la versión en Netlify para generar uno con la URL pública.

## 4. Fechas
- Anticipadas: **Gs. 30.000**, cierre sábado **17/10/2026, 21:00** en Paraguay.
- Normales: **Gs. 50.000**, disponibles desde ahora y hasta que comience el evento (**30/10/2026, 21:30**, según configuración actual).
- Se pide el pago manualmente; el administrador lo confirma y recién después se habilita el QR.
- El backend y SQL rechazan anticipadas vencidas aunque alguien manipule el HTML. La web avisa y selecciona normal automáticamente cuando la preventa se cierra.
