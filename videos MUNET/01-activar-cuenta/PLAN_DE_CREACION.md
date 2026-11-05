# Video 1 · Cómo activar tu cuenta en MUNET

Plan de creación. Todavía **no se ha producido nada**: este documento es lo que se construirá, para que lo apruebes antes.

## 1. Ficha del video

| Dato | Propuesta |
|---|---|
| Objetivo | Que un delegado que recibió un código y una contraseña temporal sepa activar su cuenta sin ayuda |
| Público | Delegados de MUN (estudiantes), que lo verán sobre todo **en el celular** |
| Duración | **~30 segundos** (rápido, con ritmo) |
| Formato principal | **Vertical 9:16, 1080×1920, 30 fps, MP4 (H.264 + AAC)** — sirve para WhatsApp, Instagram y TikTok |
| Formato opcional | Horizontal 16:9, 1920×1080, para proyectar en la reunión o ponerlo en YouTube |
| Idioma | Español, con **subtítulos animados incrustados** (mucha gente lo ve sin sonido) |
| Música | **Activa y original**, creada para este video (sin derechos de autor) |
| Voz | Sin locución. Textos en pantalla + efectos de sonido |
| Datos que se muestran | **Ficticios** (por ejemplo código `userDelegado`). Nunca credenciales reales |

## 2. El flujo real que se explica (sacado del código)

Pantalla `app/(auth)/login/page.tsx`:

1. El participante **recibe de su comité** un *código de delegado* y una *contraseña de 1 solo uso*.
2. Entra a MUNET (pantalla de inicio de sesión) y toca **"¿Es tu primera vez? Activa tu cuenta aquí"**.
3. Se abre el modal **"Activar Cuenta"**.
   - **Paso 1:** escribe su *Código de delegado* y toca **"Continuar"**. Si no hay cuenta pendiente, sale un error.
   - **Paso 2:** escribe la *Contraseña de 1 uso*, define su *Nueva contraseña* (mínimo 6 caracteres) y la *confirma*. Toca **"Activar Cuenta"**.
4. Vuelve al inicio de sesión con el mensaje **"¡Cuenta activada con éxito! Ya puedes iniciar sesión."** y su código ya escrito.
5. Inicia sesión con el código y su **nueva** contraseña (la temporal ya no sirve).

Nota: si la persona pertenece a más de un evento, el paso 2 muestra además un selector de evento. No se incluye en el video para no complicarlo; se puede mencionar en la descripción.

## 3. Guion gráfico (storyboard)

| Tiempo | Escena | Qué se ve | Texto en pantalla | Animación y sonido |
|---|---|---|---|---|
| 0:00–0:03 | **Gancho** | Logo de MUNET sobre fondo de color de marca | "Activa tu cuenta en 1 minuto" | El logo entra con rebote, destellos suaves, *whoosh* + arranca la música |
| 0:03–0:07 | **1 · Recibes tus datos** | Tarjeta tipo mensaje con "Código de delegado: `userDelegado`" y "Contraseña de 1 uso: `Munet-demo`" | "Tu comité te da un código y una contraseña de 1 solo uso" | La tarjeta se desliza desde abajo; cada dato se resalta con un subrayado animado |
| 0:07–0:10 | **2 · Abre MUNET** | Pantalla real de inicio de sesión | "Entra a MUNET y toca «Activa tu cuenta aquí»" | Cursor animado se mueve al enlace; círculo pulsante; *click* |
| 0:10–0:15 | **3 · Paso 1** | Modal "Activar Cuenta" con el campo de código | "Paso 1: escribe tu código" | El código se escribe letra a letra (sonido de teclas); el botón "Continuar" se resalta y se toca; check ✓ |
| 0:15–0:23 | **4 · Paso 2** | Modal con contraseña de 1 uso, nueva y confirmación | "Paso 2: pon la contraseña temporal y crea la tuya" · "Mínimo 6 caracteres" | Los 3 campos se llenan en secuencia con puntos; el ojito muestra y oculta la contraseña; "Activar Cuenta" se toca |
| 0:23–0:27 | **5 · ¡Activada!** | Inicio de sesión con el mensaje verde de éxito y el código ya escrito | "¡Cuenta activada!" → "Ahora inicia sesión con tu nueva contraseña" | Confeti, *chime* de éxito; se escribe la nueva contraseña y se toca "Iniciar sesión" |
| 0:27–0:30 | **Cierre** | Logo MUNET + frase final | "Guarda tu nueva contraseña. La temporal ya no sirve." | Fade con la música llegando a su nota final |

Estilo visual: colores y tipografía reales de la aplicación (variables de `app/globals.css`) y el logo `public/logo-munet.png`, para que el video se parezca a lo que el delegado verá en pantalla.

## 4. Cómo se produce (pipeline)

La idea es **grabar la aplicación real, pero sin tocar la base de datos**.

| Paso | Qué se hace | Herramienta |
|---|---|---|
| 1 | Levantar el sitio local (`npm run dev`) | Ya está configurado |
| 2 | Abrir el login en un **navegador automatizado con tamaño de celular** (540×960 a doble resolución) | Playwright (ya instalado) |
| 3 | **Simular las respuestas del servidor** para las 3 llamadas del flujo: `GET /auth/events-by-code/:code`, `POST /auth/activate` y `POST /auth/login`. Así se usa la pantalla real pero con datos de mentira | Intercepción de red de Playwright |
| 4 | Un guion automatizado hace todo lo que haría una persona: mueve el cursor, escribe, toca. Se superponen el **cursor animado, los resaltados y los subtítulos** | Script de Playwright + capa HTML/CSS |
| 5 | Las escenas del gancho, "Recibes tus datos" y el cierre son **gráficos animados** hechos en HTML/CSS con la marca de MUNET | HTML/CSS |
| 6 | Grabar cada escena (video de pantalla) | Grabación de Playwright |
| 7 | **Crear la música y los efectos** (teclas, click, whoosh, chime) con síntesis de audio, a ~110–120 BPM, en tonalidad mayor, con ritmo animado | Web Audio / script de Node que genera un WAV |
| 8 | **Unir todo** (escenas + música + efectos), sincronizar y exportar | ffmpeg |
| 9 | Exportar MP4 vertical (y opcionalmente horizontal), más una imagen de portada | ffmpeg |

**Por qué así:**
- No se escribe ni una fila en la base de datos real: no hace falta crear una cuenta pendiente ni gastar una contraseña temporal.
- Se ve exactamente la interfaz verdadera, así que si el diseño cambia, se vuelve a grabar con un comando.
- La música es original, entonces no hay problemas de derechos al publicarlo.

**Un requisito técnico a resolver:** el ffmpeg que trae Playwright solo exporta video sin audio. Hay que instalar un ffmpeg completo (por ejemplo el paquete `ffmpeg-static`, dentro de una carpeta de herramientas, no en el proyecto).

## 5. Estructura de la carpeta

```
videos MUNET/
└── 01-activar-cuenta/
    ├── PLAN_DE_CREACION.md     ← este documento
    ├── fuente/                 ← scripts y gráficos (para volver a generarlo)
    ├── salida/                 ← el video final y la portada
    └── (el audio se genera en una carpeta temporal)
```

## 6. Pasos de trabajo

| # | Paso | Resultado | Aprox. |
|---|---|---|---|
| 1 | Aprobar el plan, el formato (vertical) y el tono | Visto bueno tuyo | — |
| 2 | Instalar las herramientas y hacer una **prueba de 10 s** para ver la calidad de la grabación | Prueba corta | 15 min |
| 3 | Gráficos del gancho, de la tarjeta y del cierre | 3 escenas animadas | 30 min |
| 4 | Script de la grabación con servidor simulado y cursor | Escenas 2 a 5 grabadas | 45 min |
| 5 | Subtítulos animados | Textos sincronizados | 20 min |
| 6 | Música y efectos | Pista de audio | 30 min |
| 7 | Montaje y exportación | MP4 vertical | 20 min |
| 8 | Revisión contigo y ajustes | Versión final | 30 min |

## 7. Lista de revisión antes de entregar

- [ ] Dura entre 25 y 35 segundos.
- [ ] Se entiende **sin sonido** (los subtítulos bastan).
- [ ] Los textos de los botones coinciden con la pantalla real: «¿Es tu primera vez? Activa tu cuenta aquí», «Continuar», «Activar Cuenta», «Iniciar sesión».
- [ ] Solo aparecen datos ficticios.
- [ ] No se ve ninguna URL, llave ni dato del proyecto real.
- [ ] La música no tapa los efectos y no hay cortes bruscos.
- [ ] Se ve bien en un celular y se lee en 1 segundo cada texto.

## 8. Decisiones que necesito de ti

1. **Formato:** ¿vertical (celular) como principal? Mi recomendación: sí, y horizontal como extra.
2. **Tono:** ¿juvenil y divertido, o más formal e institucional?
3. **Marca:** ¿hay colores o tipografía oficial de MUN ESEN o de C3 además de los de la aplicación?
4. **Datos de ejemplo:** ¿te sirve `userDelegado` y `Munet-demo`, o prefieres otros?
5. **Voz:** ¿sin locución, o más adelante quieres grabar una voz tuya encima?
6. **Repositorio:** los videos pesan. ¿Se guardan solo los scripts en el repo y los MP4 se ignoran con `.gitignore`, o se guardan fuera del repo?

## 9. Siguientes videos (cola propuesta)

1. Activar la cuenta *(este)*
2. Iniciar sesión y elegir evento
3. Recorrido del feed: muros, publicar y comentar
4. Perfil: foto, bio y alias *(cuando exista el alias)*
5. Directorio de delegados y mensajes directos
