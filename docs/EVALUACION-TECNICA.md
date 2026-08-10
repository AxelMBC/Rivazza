# Evaluación técnica — Rivazza (AC Live Telemetry)

**Fecha:** 2026-08-09 · **Commit evaluado:** `989cec5` · **Rama:** `master`
**Revisor:** análisis estático + verificación de build/lint/artefactos sobre el árbol completo.

---

## Veredicto

# 7.5 / 10

Un proyecto con **artesanía de código excepcional** —de las mejores densidades de
"por qué" por línea que se ven en un repo personal— y **ingeniería de rendimiento de
nivel experto** en el canvas, lastrado por la **ausencia total de verificación
automatizada**, un componente de 2.096 líneas que ya es el cuello de botella de
mantenimiento, y tres vectores de caída del proceso en el bridge.

No es un proyecto "de juguete con buena pinta": es un proyecto sólido al que le
falta la red de seguridad. Con tests sobre el código puro, CI, y `TrackMap.tsx`
partido en módulos, este mismo repo es un **9**.

| Dimensión | Nota | Resumen |
|---|---|---|
| Legibilidad y documentación | **9.5** | Excepcional. Cada número mágico justificado. Penaliza el tamaño de `TrackMap.tsx`. |
| Eficacia / rendimiento | **9.0** | Layering, dirty-gating, Path2D en espacio-mundo, cuantización de color. Muy por encima de lo habitual. |
| Buenas prácticas | **6.5** | TS estricto, cero `any`, specs, convenciones férreas… pero **cero tests y cero CI**. |
| Robustez / operación | **6.5** | Degradación elegante ejemplar en features; 3 handlers de error ausentes que matan el proceso. |
| Escalabilidad | **6.0** | Correcta para su alcance real. Techos estructurales duros y duplicación de lógica que resiste el crecimiento. |

**Cálculo del global:** media ponderada (legibilidad 20%, eficacia 20%, prácticas
25%, robustez 15%, escalabilidad 20%) ≈ **7.5**.

---

## Lo verificado empíricamente

No son impresiones; esto se ejecutó:

```
npm run build   →  OK. bridge: tsc --noEmit limpio. web: tsc -b + vite build limpio.
                   Bundle: 245.48 kB / 78.14 kB gzip (42 módulos, 508 ms).
npm run lint -w web  →  OK, sin diagnósticos.
grep de `any` / `@ts-ignore` / `TODO` / `FIXME` / `console.*` en web  →  0 hits.
grep de `function` declarations  →  0 (100% arrow functions, convención cumplida).
web/public/demo/imola.json  →  16.66 MB crudos / 3.26 MB gzip, 26.351 entradas
                               (26.345 telemetry, 1 session, 1 status, 4 cut), 439 s.
.github/  →  no existe. No hay CI.
Historial: 27 commits, 2026-07-03 → 2026-08-09.
```

---

## 1. Legibilidad y documentación — 9.5

### Por qué es tan alta

Esto es lo que separa al repo del montón. Los comentarios **no describen el
código, describen la realidad que obligó al código a ser así**:

- `bridge/src/parsers.ts:13-15` — explica que los strings UTF-16LE de AC son
  buffers fijos de 50 wchars con basura tras el terminador (a menudo un `%`), y
  que la basura invisible rompe silenciosamente el lookup de carpetas de track.
  Cualquiera que toque `readWideString` sabe exactamente qué está en juego.
- `bridge/src/sharedMemory.ts:3-7` — justifica los offsets mágicos con la
  estructura real (`#pragma pack(4)`, ~333 Hz, la misma interfaz que leen SimHub
  y Crew Chief) e instruye explícitamente a no "limpiarlos".
- `web/src/components/TrackMap.tsx:1384-1392` — explica por qué la cámara decae
  el *offset* en lugar de interpolar hacia el coche, con el número concreto
  (~18 m de error residual a velocidad de carrera, "nada en la vista completa
  pero el canvas entero con follow cerrado"). Esto es razonamiento de ingeniería
  documentado, no relleno.
- `bridge/src/trackAssets.ts:134-142` — documenta la trampa exacta: el layout
  `nordschleife` vive *dentro* del id `ks_nordschleife`, y por eso el scan de la
  página estática compara **tokens completos**, no substrings.

Consistencia igualmente notable: 100% arrow functions (incluidos los
componentes), tokens semánticos de Tailwind v4 en `web/src/index.css`, cero
`any`, cero `TODO`, cero `console.*` en el frontend, una única supresión de lint
(`LapAnalysis.tsx:571`) y está justificada en la línea de arriba.

`CLAUDE.md` y `README.md` describen el sistema con precisión y sin humo, e
incluso documentan decisiones *negativas* (por qué `map.png` existe pero nunca
se dibuja).

### Lo que la baja de 10

**`web/src/components/TrackMap.tsx` tiene 2.096 líneas, de las cuales un único
`useEffect` ocupa ~1.530** (líneas 474–2005). Dentro de esa clausura conviven:
proyección (3 modos), cámara follow con interpolación temporal, 3 capas
offscreen con invalidación por clave, hit-testing, readout de hover, marcas de
frenada, marcas de corte, gestos de rueda, gestos táctiles (pinch/pan/tap),
dibujo del marcador direccional y el bucle rAF con dirty-gating de 17 términos.

Cada pieza individual está bien escrita y bien comentada. El problema es que
**ninguna se puede leer, probar ni reutilizar por separado**, y el fichero ya es
20 veces el siguiente componente más grande.

---

## 2. Eficacia y rendimiento — 9.0

### Trabajo de primer nivel

El pipeline de render está pensado de verdad, extremo a extremo:

- **Throttling en dos etapas con justificación medida.** El bridge
  (`bridge/src/index.ts:10-17,116-135`) documenta que Windows cuantiza timers
  cortos a ~15.6 ms, de modo que un `setInterval` a 60 Hz dispara a ~32 Hz; la
  entrega se conduce por *llegada de paquete* contra un acumulador de vencimiento
  y el intervalo solo barre el frame rezagado. En el web
  (`useTelemetry.ts:14-18`), el estado de React va a ~30 Hz con flush de flanco
  de salida mientras `telemetryRef` mantiene la tasa completa para los consumidores
  rAF. Es exactamente la decisión correcta y está explicada.
- **Path2D en espacio-mundo + transformada afín** (`TrackMap.tsx:568-599`). Se
  leen numéricamente los coeficientes de la proyección viva y se traza la
  geometría con un stroke nativo bajo la transformada, en vez de un bucle JS por
  punto. Coste plano por frame con la cámara en movimiento, en lugar de lineal.
- **Cuantización de color en buckets** (`TrackMap.tsx:190-207`): 12 pasos por
  rampa convierten "un stroke por segmento" en "un stroke por bucket".
  Visualmente indistinguible a 3 px de ancho.
- **Tres capas offscreen con claves de invalidación** (`lapsLayerKey`,
  `currentLayerKey`, `trackLayerKey`) y append incremental de la cola de la
  vuelta actual: un frame típico son unos blits más los segmentos nuevos.
- **Dirty-gating en todos los canvas** (`TrackMap`, `LapAnalysis`, `GForceMeter`,
  `PedalTrace`): el rAF no repinta si nada cambió, incluida la terminación
  explícita de los easings asintóticos por epsilon sub-píxel para que el mapa
  pueda quedarse *realmente* quieto (`TrackMap.tsx:1401-1420`, `1738-1751`).
- **Desacople ref-vs-estado**: `telemetryRef`, `historyRef`, `lapsRef`,
  `cutsRef`, `hoveredLapRef`, `scrubRef`, `analysisLapRef`. Ningún consumidor de
  alta frecuencia provoca re-render.
- **Suscripción a tasa completa** (`subscribeFrame`) para el grabador de vueltas,
  con la razón documentada: el estado a 30 Hz difumina el punto de frenada varios
  metros a velocidad, y un rAF se estrangula cuando la ventana del navegador está
  ocluida por el juego. Ese detalle solo lo ve alguien que probó el caso real.

Resultado tangible: **78 kB gzip de bundle, cero dependencias de runtime salvo
React**, y el bridge con una sola dependencia nativa (`koffi`) que además es
opcional y degrada a no-op.

### Costes reales que quedan

| # | Hallazgo | Ubicación | Impacto |
|---|---|---|---|
| E1 | **El demo pesa 16.66 MB** (3.26 MB gzip) y se parsea a ~26.3 k objetos en memoria antes de pintar nada. Cada frame se serializa completo, con `tyreSlip`/`wheelLoad` incluidos (~632 B/frame) aunque el replay no los use todos. | `web/public/demo/imola.json` | Time-to-first-paint del demo público. Cuantizando a enteros y delta-encodando bajaría a <1 MB sin pérdida visible. |
| E2 | **Barrido lineal en el hit-test**: por cada frame "sucio" con cursor sobre el mapa se recorren todas las vueltas guardadas, muestreando 1 de cada 3 puntos y proyectando cada uno. Con 40 vueltas × ~5.000 muestras son ~66 k proyecciones/frame. | `TrackMap.tsx:865-919` | Hoy es tolerable (~1 ms). Es el primer sitio que se rompe si sube `MAX_LAPS` o baja `SAMPLE_SPACING`. No hay índice espacial ni bounding-box por vuelta como filtro previo. |
| E3 | **Doble almacenamiento de la línea conducida.** `TrackMap` guarda su propio `Sample[]` por vuelta a 1 m de separación (`MAX_LAPS=40`, `MAX_SAMPLES=25000`) y `useLapRecordings` guarda otro `LapTelemetrySample[]` a tasa completa (`MAX_RECORDED_LAPS=30`, `MAX_LAP_SAMPLES=12000`, ~20 MB declarados). Son casi los mismos datos en dos estructuras. | `TrackMap.tsx:78-79`, `useLapRecordings.ts:36-39` | Los límites están puestos y documentados —el riesgo está acotado— pero el techo combinado en una sesión larga es considerable. |
| E4 | `useInputHistory` se documenta como "ring buffer" pero implementa `history.shift()` en cada frame pasada la capacidad. | `useInputHistory.ts:37` | Trivial (360 elementos a 30 Hz), pero el nombre y la implementación no coinciden. |
| E5 | `fs.readFileSync` síncrono para `fast_lane.ai` (ficheros de MB) dentro del flujo `async` de resolución de sesión. | `aiSpline.ts:89` | Bloquea el event loop en el handshake. Ocurre una vez por sesión, así que es aceptable — pero es la única operación de I/O sincrónica en un camino con `await`. |

---

## 3. Buenas prácticas — 6.5

### A favor

- TypeScript estricto en ambos workspaces, con `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`. Cero escapes de tipos en todo el repo.
- El `build` del bridge es `tsc --noEmit`: se type-checkea aunque nunca se
  compile (corre bajo `tsx`). Decisión correcta y explicada.
- **Flujo spec-driven real, no decorativo**: 21 specs vivas en `openspec/specs/`
  y 17 cambios archivados con `proposal.md` + `design.md` + `tasks.md` + deltas de
  spec por cambio. El historial de decisiones es auditable.
- Union discriminada como contrato de cable (`BridgeMessage`) con
  `noFallthroughCasesInSwitch` activo — el switch de `handleMessage` es exhaustivo
  por construcción.
- Degradación elegante como principio de diseño, no como parche: sin `map.ini`,
  sin `fast_lane.ai`, sin koffi, fuera de Windows, con `AC_SHM=0`, con AC en otra
  máquina, con assets copiados de otro circuito (`aiSpline.ts:71-84` valida que el
  spline caiga dentro del rect del mapa) — cada camino tiene su fallback y su log.

### En contra (lo que más pesa en la nota)

#### P1 — Cero tests. Es el hallazgo principal del informe.

No es una queja genérica de cobertura. Este repo tiene una cantidad inusual de
**código puro, determinista y trivialmente testeable** que hoy no tiene ni un
solo aserto:

| Módulo | Qué haría el test | Por qué importa |
|---|---|---|
| `bridge/src/parsers.ts` | Un buffer fijture de 328 B → `parseRTCarInfo` devuelve los campos esperados; un buffer con `%` y bytes de control → `readWideString` corta donde debe. | **Un offset mal tocado corrompe todo el dashboard en silencio.** Es el "núcleo delicado" que el propio `CLAUDE.md` señala. |
| `bridge/src/aiSpline.ts` | Splines sintéticos: versión ≠ 7, `count < MIN_POINTS`, extra-count desalineado, valores no finitos, ratio de anchura bajo, fuera de bounds. | Ya hay 6 reglas de validación distintas y ninguna verificada. |
| `web/src/lib/lapAnalysis.ts` | `bracket` (búsqueda binaria), `interpolateTimeAt` fuera de rango, `sectorTimes` con los pines de 0.0/1.0, `bestSectors` excluyendo vueltas inválidas, `theoreticalBestMs` con huecos. | Aritmética exacta con casos borde explícitos en los comentarios: el test se escribe leyendo el comentario. |
| `web/src/lib/speedScale.ts` | Tabla de entrada/salida, incluido el mod absurdo >800 km/h. | 12 líneas, 5 minutos de test. |
| `web/src/lib/format.ts` | `formatLapTime(0)`, negativos, `formatGear(0/1/2)`, `prettifyName`. | Idem. |
| `useLapHistory` / `useLapRecordings` | Máquinas de estado alimentadas con secuencias de frames sintéticos: reinicio de sesión, wrap antes del tick, `lastLapMs` rancio, vueltas idénticas consecutivas, eviction con anclaje de la mejor. | **Aquí es donde los tests darían más valor**: son heurísticas sobre un protocolo que no da la información, y hoy solo se validan conduciendo. |

El `README.md` y `CLAUDE.md` declaran explícitamente que no hay framework de test
y que el mock es la forma de ejercitar la app. Es una decisión consciente y está
documentada — pero para código que reconstruye estado a partir de heurísticas
sobre bytes crudos, es la decisión equivocada. `vitest` sobre estos seis módulos
es media tarde de trabajo y elimina la clase entera de regresiones silenciosas.

#### P2 — Sin CI

No existe `.github/`. `npm run build` y `npm run lint -w web` pasan limpios hoy,
pero nada lo garantiza en el siguiente commit. Un workflow de ~15 líneas
(`build` + `lint`, y `test` cuando exista) cierra el hueco.

#### P3 — Tipos del protocolo duplicados a mano

`bridge/src/types.ts` y `web/src/types.ts` son **copias literales** mantenidas
manualmente. Ambos ficheros lo admiten en un comentario ("keep the two in sync").
Es un monorepo de npm workspaces: un tercer paquete `protocol/` con los tipos
compartidos elimina la clase de bug por completo, sin build step ni herramientas
nuevas. Hoy, un campo añadido en el bridge y olvidado en el web compila
perfectamente en ambos lados y falla en runtime.

#### P4 — La regla "manténlos sincronizados" aparece cuatro veces

La detección de reinicio de sesión (`lapCount` hacia atrás, o `lapTimeMs + 1000 <
anterior`) está **copiada literalmente en cuatro sitios**:

- `web/src/hooks/useLapHistory.ts:83-86`
- `web/src/hooks/useLapDelta.ts:54-58`
- `web/src/hooks/useLapRecordings.ts:113-116`
- `web/src/components/TrackMap.tsx:1525-1529`

`CLAUDE.md` lo documenta y pide mantenerlos en sync. **Una invariante que se pide
por documentación es una invariante que se romperá.** Un `detectRestart(prev,
frame)` en `lib/` son 6 líneas y convierte la regla en código.

Lo mismo aplica a la detección de "wrap antes del tick de vuelta" (duplicada en
`useLapDelta.ts:69-83` y `useLapRecordings.ts:196-219`) y a los literales de
color de canvas (`rgb(18, 190, 60)` / `rgb(235, 55, 45)` / `#fab219` viven tanto
en `TrackMap.tsx:175-177` como en `LapAnalysis.tsx:37-42`).

#### P5 — `useLapDelta` es casi enteramente un subconjunto de `useLapRecordings`

Ambos hooks construyen una serie `{pos, timeMs}` por vuelta, detectan el wrap,
detectan el reinicio, aplican la guarda de monotonía y eligen la vuelta de
referencia. `useLapDelta` (101 líneas) podría derivarse de `recordingsRef` +
`resolveReference()` —que ya existe en `lapAnalysis.ts:86`— reduciéndose a la
interpolación y la resta.

#### P6 — Configuración de lint por debajo de lo que el código merece

`web/.oxlintrc.json` activa exactamente dos reglas. En particular **no está
`react-hooks/exhaustive-deps`**, y hay al menos un caso donde importaría:
`resetLines` (`TrackMap.tsx:409`) se recrea en cada render, se captura en el
`useEffect` de la primera pasada y se invoca desde el bucle rAF
(`TrackMap.tsx:1531`). Hoy es correcto porque solo toca refs y setters estables,
pero es exactamente el patrón que la regla existe para vigilar.

#### P7 — Código muerto en la ruta caliente

`bridge/src/acClient.ts:32,73-78`: el bloque "LEARNING LOG" sobrevive con su
comentario "delete when done", y lo que queda es un `Date.now()` y una asignación
que no hacen nada, ejecutados en cada uno de los ~60 paquetes por segundo.

---

## 4. Robustez y operación — 6.5

La degradación *funcional* es ejemplar (ver §3). La resiliencia *del proceso* no.

### R1 — Tres handlers de error ausentes que tumban el bridge

| Ubicación | Qué pasa |
|---|---|
| `bridge/src/index.ts:76-81` | `wss.on('connection', socket => …)` no registra `socket.on('error')`. En `ws`, un error de socket (un `ECONNRESET` de un cliente que cierra la pestaña de golpe) se emite como `'error'` sobre la instancia; **sin listener, Node lanza y el proceso muere**. Es el más probable de los tres. |
| `bridge/src/index.ts:59` | `fs.createReadStream(path).pipe(res)` sin `.on('error')`. Si el `map.png` desaparece o falla el permiso entre el `existsSync` y la lectura, excepción no capturada. |
| `bridge/src/index.ts:150` | `server.listen(PORT)` sin `server.on('error')`. Con el puerto 3001 ocupado, el fallo es un stack trace en vez de un mensaje accionable. |

Los tres son de una línea cada uno. Para un servicio pensado para quedarse
corriendo mientras se juega, son la diferencia entre "un cliente se desconectó" y
"se cayó la telemetría a mitad de sesión".

### R2 — Superficie de red más amplia de lo necesario

`server.listen(PORT)` sin host **escucha en todas las interfaces**, y
`bridge/src/index.ts:25` responde `Access-Control-Allow-Origin: *`. Combinado con
R3, cualquier equipo de la LAN puede consultar los endpoints. Para uso local,
`server.listen(PORT, '127.0.0.1')` por defecto (con opt-in por env para el caso
"tablet como segunda pantalla", que el diseño responsive sugiere que es
intencional) es el ajuste correcto.

### R3 — Ruta construida con strings de origen remoto, sin normalizar

`trackAssets.ts:71` hace `path.join(AC_PATH, 'content', 'tracks', track)` donde
`track` viene del handshake UDP parseado. `readWideString` corta en caracteres de
control y `%`, pero **no filtra `..` ni separadores**. El resultado alimenta
`mapImagePath`, que se sirve por HTTP en `/api/track-map/image`. Mismo patrón en
`carAssets.ts:16` con `carName`.

Severidad real: **baja**. Requiere que alguien pueda responder al handshake antes
que el juego (o que `AC_HOST` apunte a una máquina hostil), y el impacto máximo es
lectura de ficheros. Pero la mitigación es una línea: validar `track` contra
`/^[A-Za-z0-9_.-]+$/` y verificar que la ruta resuelta siga bajo `AC_PATH`.

### R4 — Sin backpressure en el broadcast

`broadcast` (`index.ts:69-74`) hace `client.send(payload)` a 60 Hz sin mirar
`bufferedAmount`. Un cliente lento (WiFi flojo, pestaña en background) acumula
cola en memoria del bridge indefinidamente. Un guard de `bufferedAmount > N →
saltar frame` es lo natural aquí, y encaja con la filosofía del resto: los frames
son desechables, solo importa el más nuevo.

### R5 — Sin Error Boundary en React

Una excepción en `TrackMap` o `LapAnalysis` —ambos con aritmética de canvas
compleja— deja la pantalla en blanco. Un boundary alrededor de cada panel
mantendría el resto del dashboard vivo.

### R6 — `BRIDGE_PORT` es una promesa que el frontend no cumple

`web/src/hooks/useTelemetry.ts:11-12` **hardcodea el puerto 3001** en la URL HTTP
y en la del WebSocket. El bridge documenta `BRIDGE_PORT` como configurable
(`CLAUDE.md`, `README.md`) pero cambiarlo rompe el web app sin ningún aviso.
Debería ser `import.meta.env.VITE_BRIDGE_PORT ?? 3001`.

### R7 — Lectura de refs durante el render

`LapTimes.tsx:121-126`, `LapAnalysis.tsx:80-89` y `TrackMap` leen `.current` en
el cuerpo del render. Funciona porque el estado de telemetría a 30 Hz fuerza el
re-render, y es una decisión deliberada y coherente con el diseño ref-first. Pero
es formalmente incompatible con el renderizado concurrente de React 18+: el
resultado del render no es función de props+state, y un render interrumpido y
reanudado puede leer valores distintos (*tearing*). Hoy no muerde. Conviene que
esté anotado como riesgo conocido, no descubierto más adelante.

### R8 — Accesibilidad

Consecuencia directa de una restricción de producto legítima (un clic robaría el
foco al juego y con él la entrada del mando), así que no es descuido — pero el
estado es: **no hay ruta de teclado a ninguna interacción**. Los chips de vuelta
son `<span>` con `onMouseEnter` (`LapAnalysis.tsx:524-526`), los paneles se abren
por hover, el botón de follow se arma por permanencia del cursor, y todo el
contenido de datos vive en `<canvas>` sin equivalente textual ni ARIA. En el
build demo (`CLICK_MODE`) hay clics, pero siguen sin ser focusables. Merece al
menos un `role`/`tabIndex` en los chips y un resumen textual accesible del estado
de sesión.

---

## 5. Escalabilidad — 6.0

Hay que separar dos preguntas, porque la respuesta es distinta.

### ¿Escala en carga? Sí, y con margen.

El diseño es correcto para lo que hace: **un juego, un coche, un piloto, N
espectadores**. `JSON.stringify` una vez por mensaje y `send` a cada cliente; el
throttle a 60 Hz es fijo independientemente de los clientes; el estado de sesión
es un objeto. Cien pestañas conectadas no cambiarían nada estructural (salvo R4).
La carga de datos por vuelta está acotada con constantes explícitas y
documentadas en todos los buffers.

### ¿Escala en features? Aquí está la nota.

#### S1 — `TrackMap.tsx` es el techo de crecimiento

2.096 líneas, un `useEffect` de ~1.530. Toda feature nueva del mapa (sectores
dibujados, comparación de trazadas, ghost, telemetría de rivales) entra en esa
misma clausura. No hay puntos de extensión: la proyección, la cámara, las capas y
los gestos no son módulos, son variables locales de una función.

La descomposición natural ya está insinuada por el propio código y sería de bajo
riesgo:

```
lib/projection.ts   → Project, Affine, affineOf, zoomed, los 3 modos base
lib/followCamera.ts → estado + tick de la cámara (es una función pura de
                      (base, width, height, dt, refs) → Zoom)
lib/lapLayers.ts    → renderTrackLayer / renderLapsLayer / renderCurrentLayer
lib/hitTest.ts      → hitTestLaps + drawHoverReadout
hooks/useMapGestures.ts → rueda + táctil + dwell
TrackMap.tsx        → composición + JSX (~250 líneas)
```

#### S2 — Estado global mutable a nivel de módulo en el bridge

`session`, `trackAssets`, `latestFrame`, `frameDirty` son variables de módulo
(`index.ts:19-22`). Funciona porque hay exactamente una sesión. Soportar dos
instancias de AC, o el protocolo `SUBSCRIBE_SPOT` (multi-coche — el `OperationId`
**ya está definido en `parsers.ts:9` y nunca se usa**), exige refactorizar el
módulo entero a instancias.

#### S3 — Cero persistencia

Todo el historial de vueltas, las grabaciones y el mapa viven en memoria del
navegador. **Un F5 borra la sesión entera.** No hay `localStorage`, ni export
CSV/JSON, ni comparación entre sesiones. Para una herramienta cuyo valor es
"mejora tus tiempos", la comparación con la sesión de ayer es la feature obvia
siguiente, y hoy no hay ningún cimiento para ella (ni esquema, ni id de sesión, ni
serialización).

#### S4 — La duplicación de §P4/P5 es una carga de escalado

Cinco copias de la máquina de estado de vueltas significa que cada regla nueva
sobre vueltas (invalidación por track limits del server, vueltas de out/in-lap,
banderas) hay que implementarla cinco veces correctamente.

#### S5 — El demo no escala con el contenido

Añadir un segundo circuito al demo duplica los ~17 MB en el repo (y ya hay **4
revisiones del fichero en el historial**, permanentes). El formato de grabación no
tiene versionado: si `TelemetryFrame` cambia, las grabaciones antiguas se rompen
sin señal.

---

## 6. Plan de acción priorizado

### Ahora — coste bajo, valor alto

1. **Tres handlers de error en el bridge** (R1). ~5 líneas. Elimina las caídas de
   proceso más probables.
2. **`detectRestart()` compartido** (P4). ~10 líneas + 4 sustituciones. Convierte
   una regla documentada en una regla imposible de romper.
3. **Borrar el bloque LEARNING LOG** (P7). ~4 líneas fuera de la ruta caliente.
4. **`VITE_BRIDGE_PORT`** (R6). Hace honesta la documentación existente.
5. **Workflow de CI** (`build` + `lint`). ~15 líneas de YAML.

### Siguiente — el cambio que más sube la nota

6. **`vitest` + tests sobre los 6 módulos puros** (P1): `parsers`, `aiSpline`,
   `lapAnalysis`, `speedScale`, `format`, y las tres máquinas de estado de
   vueltas alimentadas con secuencias de frames sintéticos. **Esto solo lleva el
   proyecto de 7.5 a ~8.5.** Es el mejor retorno por hora del repo entero.
7. **Paquete `protocol/` compartido** en el monorepo (P3). Elimina el riesgo de
   desincronización del contrato de cable.

### Después — deuda estructural

8. **Descomponer `TrackMap.tsx`** por el plan de S1. Es la condición previa para
   cualquier feature grande del mapa.
9. **Derivar `useLapDelta` de `useLapRecordings`** (P5). ~100 líneas menos.
10. **Comprimir el demo** (E1): cuantizar a enteros y delta-encodar → de 16.6 MB
    a <1 MB, con versión de esquema en la cabecera (S5).
11. **Persistencia de sesión** (S3): `localStorage` + export JSON. Desbloquea la
    comparación entre sesiones.
12. **Endurecimiento** (R2/R3/R4): bind a localhost por defecto, validar el
    nombre de track contra whitelist de caracteres + comprobar que la ruta
    resuelta sigue bajo `AC_PATH`, guard de `bufferedAmount`.
13. **Error boundaries** (R5) y una pasada de accesibilidad mínima (R8).

---

## 7. Nota final

Lo que distingue a este repo no es que funcione: es que **cada decisión no obvia
está justificada por escrito, con el fenómeno físico o la limitación de
plataforma que la causó**. El acumulador de vencimiento contra la cuantización de
timers de Windows, el decaimiento del offset de cámara en vez de la interpolación
al objetivo, el match por token completo contra el substring en los layouts, la
tolerancia deliberada a basura en cada parser. Eso es criterio de ingeniería
senior, y sostiene el proyecto muy por encima de su tamaño.

La brecha es igual de nítida: **todo ese razonamiento vive en comentarios y en la
cabeza del autor, y nada de él está codificado en asertos ejecutables.** La misma
disciplina que produjo esos comentarios, aplicada a una suite de tests, produciría
un proyecto de 9 sin cambiar una sola decisión de diseño.

---

*Generado con Claude Code.*
