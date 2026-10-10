# VORTEX Halloween 2026 — Netlify + Supabase

**Esta es la versión para publicar en Netlify.** Conserva el diseño de la web original y la interfaz del panel/entradas. Ya no depende de Python, Uvicorn ni SQLite para funcionar públicamente.

## Qué trae

- Web pública en `public/index.html` con los recursos originales en `public/static/assets`.
- Netlify Function en `netlify/functions/vortex.mjs`, que atiende `/api/config`, `/api/entradas`, `/entrada/:codigo`, `/entrada/:codigo/qr`, `/admin`, `/admin/login`, `/admin/entrada/:codigo/:accion`, `/admin/export.csv` y `/scan/:codigo`.
- PostgreSQL persistente en Supabase (script `supabase/01_CREAR_BASE_DE_DATOS.sql`).
- Confirmación **manual** del pago (no cobra por internet ni detecta transferencias).
- QR único, que redirige a una pantalla restringida al administrador. El QR no se activa hasta confirmar pago.
- Una sola validación de ingreso, garantizada con `SELECT ... FOR UPDATE` en PostgreSQL.
- Claves privadas en variables de entorno, cookies firmadas HttpOnly, verificación de origen y límites básicos de intentos.
- Exportación CSV protegida (hasta 10.000 filas). Los datos de búsqueda del panel muestran hasta 500 registros; las estadísticas son globales.

## 1. Crear Supabase (es obligatorio para este diseño)

1. Entrá a **https://supabase.com/dashboard**, registrate e iniciá sesión.
2. Seleccioná **New project / Nuevo proyecto**. Elegí una organización, nombre (por ejemplo `vortex-entradas`), una contraseña de base de datos **diferente a la del panel**, y una región disponible. Guardá esa contraseña en un gestor de contraseñas.
3. Esperá a que termine de crearse el proyecto.
4. Entrá a **SQL Editor** > **New query**. Abrí el archivo `supabase/01_CREAR_BASE_DE_DATOS.sql`, copiá su contenido completo y pulsá **Run**. Debe finalizar sin errores.
5. En **Table Editor** debería aparecer `public.vortex_entradas`, inicialmente vacía, y `public.vortex_limites`.
6. Buscá la **URL del proyecto** en **Project Settings > Data API / API** (la ubicación concreta puede cambiar según la interfaz). Tiene formato `https://xxxxxxxx.supabase.co`.
7. Buscá **API Keys**. Copiá **Secret key** (`sb_secret_...`) o, si tu proyecto todavía la usa, la clave **service_role** antigua. **Nunca copies la anon/publishable como sustituto de secret. Nunca coloques esta clave en HTML ni en `public/`.**

> El SQL activa RLS, no concede permisos a anon/authenticated y permite que únicamente el backend de Netlify (con una clave secreta) registre y administre entradas. El sistema funciona aunque se reinicien o actualicen las funciones de Netlify.

## 2. Configuración local de .env

1. Instalá **Node.js 22.13 o superior** en Windows, además de VS Code.
2. Abrí **esta carpeta nueva** en VS Code (no mezclar con `vortex_python`).
3. En la terminal PowerShell ejecutá `npm install`.
4. Copiá `.env.example` a un nuevo `.env` en la **raíz del proyecto**.
5. En `.env`, completá las variables:

```env
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_TU_VALOR_PRIVADO
VORTEX_ADMIN_PASSWORD=UNA_CONTRASENA_PRIVADA
VORTEX_SESSION_SECRET=UNA_CLAVE_ALEATORIA_DISTINTA_DE_32_O_MAS_CARACTERES
VORTEX_WHATSAPP_NUMBER=595981578412
```

Podés generar la clave de sesión en PowerShell (con Node instalado):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Importante:** `.env` y `.env.*` están excluidos por `.gitignore`; `.env.example` sí puede subirse porque no contiene secretos reales. Netlify CLI lee `.env` durante el desarrollo local. Netlify en producción **no** lee automáticamente ese archivo desde GitHub: las variables se configuran en el panel de Netlify.

6. Ejecutá `npm run dev`. Netlify CLI iniciará el servidor de desarrollo (habitualmente en `http://localhost:8888`). Abrí la URL que muestre la terminal.
7. Probá crear una entrada, iniciar sesión en `/admin`, confirmar pago y entrar al enlace de la entrada. Para probar el QR con otro celular, necesitarás una URL pública que resuelva desde ese celular; `localhost` solo funciona en tu PC.

## 3. Subir a GitHub

1. Creá un repositorio **nuevo**, por ejemplo `vortex-netlify`.
2. Subí **el contenido interno** de esta carpeta (incluyendo `netlify.toml`, `package.json`, `public/`, `netlify/` y `supabase/`).
3. Comprobá antes de subir que **NO** aparecen `.env`, `node_modules/` ni contraseñas en archivos públicos.

No reemplaces tu antiguo proyecto `vortex_python`: mantenelo como respaldo. Tu base de datos local `data/vortex.db` **no se migra automáticamente** a Supabase. Las entradas creadas localmente se quedan allí. Si hubiera compras reales, habría que exportarlas e importarlas de forma segura.

## 4. Configurar Netlify

1. Netlify > **Add new project / Import an existing project** > GitHub > elegí el repositorio `vortex-netlify`.
2. En configuración del despliegue verificá: **Base directory** = raíz del repositorio, **Publish directory** = `public`. La carpeta de Functions se detecta en `netlify/functions` mediante `netlify.toml`. No hace falta `Build command` para HTML estático.
3. Antes de vender, en **Project configuration > Environment variables** agregá las cinco variables de `.env` con sus valores reales. Asegurate de que las variables estén disponibles para el contexto **Production** y para **Functions** (o todos los scopes).
4. Guardá y realizá **Deploy** o un **redeploy** si configuraste las variables después del primer despliegue.
5. La web aparecerá en una URL como `https://vortex-evento.netlify.app`. **La URL es un ejemplo**: usá la que Netlify te asigne.
6. Revisá `/api/config` (debe mostrar JSON), probá un registro de prueba, abrí `/admin`, confirmá el pago y validá el QR con un segundo celular.

## 5. Estados de las entradas

| Situación | Pago | Acceso |
|---|---|---|
| Se registra | pendiente | bloqueada |
| Administrador confirma pago | pagado | disponible |
| Guardia valida en el ingreso | pagado | utilizada |
| Administrador cancela | cancelado | bloqueada |

El QR muestra una dirección a `/scan/CODIGO`. Solo personal con sesión de administrador puede confirmar un ingreso. Al marcar como utilizada, PostgreSQL bloquea la fila durante la transacción para impedir dobles validaciones simultáneas.

**Fecha límite anticipada:** 17 de octubre de 2026, 21:00 hora de Asunción (a las 21:00:00 deja de aceptar). La web cambia automáticamente a la opción normal cuando finaliza la preventa. **Si las tablas ya estaban creadas con una versión anterior, ejecutá en Supabase SQL Editor solo `supabase/02_ACTUALIZAR_CIERRE_ANTICIPADAS.sql`; no elimina datos.** **Normal:** Gs. 50.000 hasta comenzar el evento, 30 octubre 2026 a las 21:30. Estos límites se validan tanto en la Function como en PostgreSQL.

## 6. Antes de aceptar pagos reales

- Cambiar la contraseña de prueba por una clave privada robusta. No guardar claves en la web ni subirlas a GitHub.
- Probar compra, cancelación y doble intento de validación en **producción**. **No se ha verificado aquí un despliegue real de Netlify/Supabase** porque requiere tus credenciales y la creación del proyecto.
- Organizar permisos: el sistema utiliza un **único administrador compartido**; para un evento grande conviene crear usuarios separados para caja y guardias. Agregar CAPTCHA/Turnstile contra registros falsos si habrá difusión pública; los límites por IP incluidos son básicos.
- Conectar el número oficial de WhatsApp: actualizar `VORTEX_WHATSAPP_NUMBER` en Netlify **y** cambiar el enlace fijo `https://wa.me/...` del contacto en `public/index.html` si corresponde.
- No incluye procesamiento automático de pagos; Vortex debe verificar cada cobro antes de pulsar **Confirmar pago**.
- En redes móviles, los guardias necesitarán conexión a internet para validar los QR. Configurar datos móviles y respaldo de conectividad.
- Hacer copias de seguridad/exportaciones y aplicar retención de datos personales apropiada. Confirmar límites y actividad del plan de Supabase; algunas opciones gratuitas pueden pausar proyectos inactivos.
- No modifiques los nombres de columnas ni ejecutes SQL de borrado de tablas si ya existen ventas reales.

## 7. ¿Y el proyecto Python?

El archivo Python antiguo continúa funcionando para pruebas locales, con SQLite. Esta versión **migró** la lógica a JavaScript de Netlify Functions porque es compatible con el hospedaje elegido. No hace falta mantener tu PC ni un servidor Python activo.

## 8. Diagnóstico rápido

- `npm` no se reconoce → instalar Node.js actual y reabrir VS Code.
- `/api/config` da 404 → verificar que la función `netlify/functions/vortex.mjs` se desplegó; no usar el botón de arrastrar solo `public/` a Netlify.
- `503` en registros/admin → comprobar las variables de Netlify y que el SQL se ejecutó completamente en Supabase. Ver los logs en Netlify > Functions.
- `401` en admin → contraseña incorrecta o una variable desactualizada. Se permite una contraseña no vacía para pruebas locales; en producción usá una clave larga y única.
- `429` → límite básico de registros o intentos de inicio de sesión por IP.
- Si escaneás el QR con la cámara y aparece `/admin/login`, iniciá sesión con el personal autorizado; luego el sistema vuelve a la pantalla del QR.
- Si alguien ve el QR sin pagar, no estará habilitado. Una entrada pagada ya utilizada no puede validarse de nuevo.

## Seguridad y limitaciones

El nombre/teléfono son datos personales. El enlace privado de entrada muestra esa información al portador del enlace; no lo difundas públicamente. Los permisos se limitan a la función y la base de datos protege filas con RLS. Aun así, antes del evento corresponde probar y revisar el sistema desplegado, controles antiabuso, seguridad, copias de seguridad y procedimientos de caja.

## Corrección de formularios en Netlify Dev

El módulo `netlify/functions/lib/security.mjs` reconoce `Sec-Fetch-Site: same-origin` de navegadores compatibles al procesar formularios. Esto evita que `http://localhost:8888/admin/login` se rechace cuando el proxy de Netlify CLI reescribe internamente el origen de la solicitud. Las solicitudes marcadas `cross-site` y `same-site` siguen bloqueadas. Sin Fetch Metadata, se verifica `Origin` o `Referer` como antes. Ejecutá `npm test` para comprobarlo.

## Seguridad antes de publicar (importante)

- Si la clave `SUPABASE_SECRET_KEY` apareció en alguna captura, revocarla en Supabase, generar otra y reemplazarla tanto en `.env` como después en Netlify.
- Usar una contraseña de administrador **nueva y robusta**, no la contraseña corta utilizada durante las pruebas.
- Verificar `git status` o la lista de archivos de GitHub: **no incluir `.env`, `.netlify`, `node_modules` ni ningún otro archivo con credenciales reales**.
- Después del despliegue, crear una entrada ficticia en producción y probar: pago, QR desde otro móvil y rechazo del segundo intento de ingreso.
- La copia de `.env` en tu computadora no se transmite a Netlify: las variables se introducen en la configuración privada del proyecto Netlify.
