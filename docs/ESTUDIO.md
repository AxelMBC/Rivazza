# Rivazza — Estudio del proyecto

**Para:** alguien con base sólida de frontend (React/TS) y poca o ninguna experiencia en
backend, sockets o protocolos binarios.
**Objetivo:** entender el proyecto de punta a punta —qué archivo hace qué, qué función se
llama cuándo, y por qué está escrito así— hasta poder refactorizarlo sin romperlo.

Todas las referencias son `archivo:línea` sobre el árbol actual. Si una línea no cuadra,
el archivo cambió: busca el nombre de la función, no el número.

---

## 0. Cómo leer este documento

| Si quieres… | Lee |
|---|---|
| El modelo mental en 5 minutos | §1 y §2 |
| Entender UDP, buffers y memoria compartida desde cero | §3 |
| El backend (bridge) función por función | §4 |
| El contrato entre las dos mitades | §5 |
| El frontend: hooks, estado y canvas | §6 |
| Ver un byte convertirse en un píxel | §7 |
| Qué NO tocar y por qué | §8 |
| Por dónde refactorizar | §9 |
| Un plan de estudio con ejercicios | §10 |
| Vocabulario de simracing y de sistemas | §11 |

---

## 1. Qué es esto en una frase

Assetto Corsa (un juego de 2014, motor de 32 bits, Windows) publica su telemetría en
tiempo real por tres canales distintos. Este proyecto consume esos canales desde un
proceso Node, los normaliza a un único formato JSON y los reemite por WebSocket a una
SPA de React que dibuja tablero, tiempos por vuelta y un mapa 2D del circuito con la
trayectoria real del coche pintada según los pedales.

```
┌──────────────────┐
│ Assetto Corsa    │  proceso del juego, Windows
│  (el simulador)  │
└────────┬─────────┘
         │
         │ (1) UDP :9996  — telemetría en vivo (binario, structs de C)
         │ (2) memoria compartida  Local\acpmf_physics / acpmf_static
         │ (3) archivos en disco   content/tracks/… , content/cars/…
         ▼
┌───────────────────────────────────────────────┐
│ bridge  (Node + TypeScript, ejecutado con tsx)│
│  · habla el protocolo UDP de AC               │
│  · lee la página de física (cortes de pista)  │
│  · lee map.ini / fast_lane.ai / ui_car.json   │
│  · normaliza todo a BridgeMessage (JSON)      │
└────────┬──────────────────────┬───────────────┘
         │ WebSocket :3001/ws   │ HTTP :3001/api/track-map/*
         ▼                      ▼
┌───────────────────────────────────────────────┐
│ web  (React 19 + Vite + Tailwind v4, :5173)   │
│  · useTelemetry: 1 socket, 2 canales          │
│  · hooks derivados (vueltas, delta, grabación)│
│  · componentes DOM (texto) + canvas (dibujo)  │
└───────────────────────────────────────────────┘
```

Tres procesos independientes: el juego, el bridge, el navegador. Si el juego no está, el
bridge sigue vivo reintentando. Si el bridge se cae, la web reintenta cada 1,5 s. Ninguna
capa asume que la de abajo existe — esa es la idea rectora de todo el repo.

"Rivazza" es una curva de Imola. El paquete interno se llama `assettocorsa-track`
(`package.json:2`).

---

## 2. El mapa de archivos

### bridge (`bridge/src/`, ~1.000 líneas)

| Archivo | Líneas | Responsabilidad | Analogía frontend |
|---|---|---|---|
| `index.ts` | 169 | Orquestador: HTTP + WebSocket, throttling a 60 Hz, arranque y apagado | Tu `main.tsx` + el router + el store global |
| `acClient.ts` | 94 | Máquina de estados del protocolo AC (handshake → suscripción → stream) | Cliente de API con reintentos que emite eventos |
| `parsers.ts` | 87 | Bytes crudos → objetos JS | `JSON.parse`, pero escrito a mano sobre binario |
| `types.ts` | 82 | El contrato de datos | Tus tipos de DTO |
| `trackAssets.ts` | 188 | Localizar la instalación de AC y el circuito cargado; leer `map.ini` | Resolución de rutas + parsing de config |
| `aiSpline.ts` | 158 | Leer el spline de la IA (`fast_lane.ai`) y derivar los bordes de pista | Parser binario #2 |
| `carAssets.ts` | 30 | Sacar la velocidad punta del coche de un JSON corrupto | Regex de rescate |
| `sharedMemory.ts` | 193 | Leer la página de memoria de AC vía kernel32 (detección de cortes) | FFI: llamar a la API de Windows desde JS |
| `record.ts` | 160 | Grabar una sesión a JSON para el modo demo | Un fixture generado en vivo |
| `scripts/mock-ac.js` | 128 | Un Assetto Corsa falso para desarrollar sin el juego | Un mock server |

### web (`web/src/`, ~5.100 líneas)

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `App.tsx` | 143 | Layout y cableado de las refs compartidas entre paneles |
| `hooks/useTelemetry.ts` | 189 | WebSocket, reconexión, doble canal (state 30 Hz / ref 60 Hz), replay demo |
| `hooks/useInputHistory.ts` | 39 | Buffer circular de pedales y fuerzas G (~12 s) |
| `hooks/useLapHistory.ts` | 144 | Reconstruir el registro de vueltas y su validez |
| `hooks/useLapDelta.ts` | 109 | Delta en vivo contra la vuelta de referencia |
| `hooks/useLapRecordings.ts` | 245 | Grabar la telemetría completa de cada vuelta |
| `lib/lapAnalysis.ts` | 188 | Matemática pura: interpolación, mini-sectores, mejores tiempos |
| `lib/*.ts` | ~80 | Formato, colores, escala del velocímetro, modo demo, táctil |
| `components/TrackMap.tsx` | **2.014** | El mapa: proyección, capas, cámara, interacción |
| `components/LapAnalysis.tsx` | 746 | Panel de trazas (velocidad/pedales/delta) + cinta de sectores |
| `components/LapTimes.tsx` | 200 | Tiempos y lista de vueltas |
| `components/AnalogGauge.tsx` | 214 | Relojes SVG (velocímetro y cuentarrevoluciones) |
| Resto de componentes | ~400 | Cabecera, badges, pedales, G-meter, neumáticos, volante |

Dos archivos concentran más de la mitad del frontend: `TrackMap.tsx` y `LapAnalysis.tsx`.
Ese es el punto de partida de cualquier refactor (§9).

---

## 3. Backend para frontenders: los cinco conceptos que necesitas

No necesitas "saber backend" para entender este repo. Necesitas cinco ideas.

### 3.1 UDP frente a TCP/WebSocket

Ya conoces HTTP y WebSocket. Ambos corren sobre **TCP**: hay conexión, entrega
garantizada, orden garantizado y retransmisión si algo se pierde.

**UDP** es el otro protocolo de transporte: no hay conexión, ni garantía de entrega, ni
orden garantizado. Mandas un **datagrama** (un paquete suelto y autocontenido) a una IP y
un puerto, y ya está. Si se pierde, se perdió.

Suena peor, pero para telemetría es *mejor*: a 60–333 paquetes por segundo, un paquete
perdido es un frame que ya estaba obsoleto 16 ms después. Retransmitirlo —lo que haría
TCP— solo retrasaría los frames siguientes. Por eso lo usan los juegos, el vídeo en
directo y el audio.

En Node eso es el módulo `dgram` (`bridge/src/acClient.ts:1`):

```ts
const socket = dgram.createSocket("udp4");
socket.on("message", (msg: Buffer) => { /* llegó un datagrama */ });
socket.send(buffer, PORT, HOST);
```

Compáralo mentalmente con `new WebSocket(url)` + `socket.onmessage`. La diferencia clave:
**no hay `onopen` ni `onclose`**, porque no hay conexión. De ahí salen dos problemas que
el proyecto resuelve a mano:

1. ¿Cómo sé que el juego está ahí? → mandas un handshake cada 3 s hasta que conteste
   (`acClient.ts:51`).
2. ¿Cómo sé que el juego se fue? → si no llega nada en 5 s, lo das por muerto
   (`acClient.ts:82`, `STALE_SESSION_MS`). AC nunca avisa de que la sesión terminó.

### 3.2 Buffers, bytes y endianness

En el navegador rara vez tocas bytes. En Node, un `Buffer` es un array de bytes
(`Uint8Array` con métodos extra). AC no manda JSON: manda el volcado en crudo de un
`struct` de C++.

Un `struct` de C es una secuencia fija de campos en posiciones fijas. Si el emisor dice
"en el byte 8 hay un `float` de 4 bytes que es la velocidad", lees exactamente eso:

```ts
speedKmh: buf.readFloatLE(8)   // parsers.ts:60
```

`LE` = *little-endian*: el byte menos significativo va primero. Así ordenan los bytes los
procesadores x86 (y por tanto Windows y AC). Si leyeras `readFloatBE` obtendrías basura.
No hay cabecera que lo indique: lo sabes o no funciona.

**Qué es un "offset mágico".** Mira `parsers.ts:59-87`. Los números (8, 20, 28, 40, 148,
308…) no son arbitrarios ni "sucios": son el resultado de cómo el compilador de Microsoft
coloca los campos en memoria, incluido el **padding** que inserta para alinear cada campo
a su tamaño natural. Por eso el comentario de `parsers.ts:57` avisa de no "limpiarlos":
esos huecos son parte del formato.

**Cómo se distinguen los mensajes.** No hay campo de tipo. El protocolo de AC distingue
los mensajes **por su longitud**: 408 bytes es la respuesta al handshake, 328 es un frame
de telemetría (`parsers.ts:3-4`, usados en `acClient.ts:60` y `:74`).

**Cadenas UTF-16 con basura.** AC manda los nombres en buffers fijos de 50 caracteres
anchos (100 bytes) y no limpia lo que había antes: tras el terminador quedan restos, a
menudo un `%`. `readWideString` (`parsers.ts:16`) corta en el primer carácter de control o
`%`. Si eso falla, el nombre del circuito lleva caracteres invisibles, la búsqueda de
carpeta falla y aparece "no hay mapa" — un fallo silencioso y desconcertante. Por eso
`trackAssets.ts:114` registra el nombre con `JSON.stringify`: para que lo invisible se vea.

### 3.3 Memoria compartida y FFI

El tercer canal de AC no es red: es una **página de memoria compartida**. El juego reserva
un bloque de memoria con un nombre (`Local\acpmf_physics`) y lo reescribe en cada tick de
física (~333 Hz). Cualquier proceso de la misma máquina puede abrirlo y leerlo. Es el
mecanismo que usan SimHub o Crew Chief.

Node no sabe hacer eso por sí solo: hay que llamar a la API de Windows (`kernel32.dll`).
Eso se llama **FFI** (*Foreign Function Interface*) y aquí lo aporta `koffi`, la única
dependencia nativa del repo. `sharedMemory.ts:42-79` declara las firmas de C que necesita:

```ts
lib.func("OpenFileMappingW", "void *", ["uint32", "bool", "str16"]);
lib.func("MapViewOfFile",    "void *", ["void *", "uint32", "uint32", "uint32", "size_t"]);
lib.func("RtlMoveMemory",    "void",   ["_Out_ uint8 *", "void *", "size_t"]);
```

Traducido: *abre el mapeo por nombre* → *dame un puntero a él* → *cópiame N bytes desde ese
puntero a un Buffer mío*. Y sobre ese Buffer vuelves al mundo de §3.2: offsets fijos
(`packetId` en 0, `speedKmh` en 28, `numberOfTyresOut` en 244).

**Por qué importa para el diseño:** esto solo funciona en Windows, en la misma máquina y
si `koffi` carga. Las tres condiciones se comprueban y, si fallan, la función se apaga en
silencio (`sharedMemory.ts:111-115`) sin tocar jamás el camino UDP. Ese patrón
—"degradación elegante por defecto"— se repite en todo el repo.

### 3.4 El event loop, y por qué 60 Hz no son 60 Hz en Windows

En Node, igual que en el navegador, todo ocurre en un único hilo con un bucle de eventos.
`setInterval(fn, 16)` no garantiza 16 ms: garantiza "no antes de 16 ms".

En Windows hay un detalle extra: el planificador cuantiza los temporizadores cortos a
~15,6 ms. Un `setInterval` de 16,67 ms (60 Hz) acaba disparando cada ~31 ms, o sea a
~32 Hz — la mitad del objetivo. Ese es el problema que resuelve `index.ts:122-144`:

```ts
ac.on("telemetry", (frame) => {      // llegó un paquete UDP
  latestFrame = frame;               // guarda solo el más nuevo
  frameDirty = true;
  flushIfDue();                      // ¿toca emitir? emítelo AHORA
});
setInterval(flushIfDue, BROADCAST_INTERVAL_MS);  // solo barre el frame rezagado
```

La entrega la conduce **la llegada de paquetes**, no el temporizador; el `setInterval`
solo existe para que el último frame no se quede atascado cuando el coche se detiene. Y
`nextDueAt` se recalcula para ponerse al día sin ráfagas (`index.ts:128-133`).

Esta idea —*el trabajo lo dispara el dato que llega, no un reloj*— es el equivalente
backend de "no hagas polling: suscríbete".

### 3.5 "Servidor" aquí significa dos cosas a la vez

`bridge/src/index.ts` levanta **un solo** servidor HTTP en el 3001 (`:157`) y monta encima
el servidor WebSocket, en la ruta `/ws` (`:65`). Es un patrón muy común: un WebSocket
empieza siendo una petición HTTP que se "actualiza" (*upgrade*) a socket persistente, así
que ambos comparten puerto.

- `GET /api/track-map/meta` → límites de proyección del circuito (`index.ts:28`)
- `GET /api/track-map/edges` → bordes de pista como polilíneas (`index.ts:39`)
- `GET /api/track-map/image` → el `map.png` del juego (`index.ts:50`) — **servido pero
  nunca consumido**: el frontend decidió no dibujarlo (§8.4)
- `ws://…/ws` → el stream de `BridgeMessage`

`Access-Control-Allow-Origin: *` en `index.ts:25` existe porque la web corre en el 5173 y
el bridge en el 3001: orígenes distintos, y sin CORS el navegador bloquearía el `fetch`.
El WebSocket no lo necesita (el navegador no aplica CORS igual ahí), por eso solo aparece
en la rama HTTP.

---

## 4. El bridge, archivo por archivo

### 4.1 `index.ts` — el orquestador

Es el único archivo con estado global mutable, y a propósito: cuatro variables de módulo
(`index.ts:19-22`) que representan "lo que el bridge sabe ahora mismo".

```ts
let session: SessionInfo | null = null;      // sesión actual, o null si no hay juego
let trackAssets: TrackAssets | null = null;  // map.ini + bordes del circuito cargado
let latestFrame: TelemetryFrame | null = null;
let frameDirty = false;                      // ¿hay un frame sin emitir?
```

Flujo de arranque (`index.ts:157-160`): se levanta el servidor y **después** arranca el
cliente de AC. Al apagar (`:162-169`) se paran el detector de cortes, el cliente y el
servidor, y se responde a `SIGINT`/`SIGTERM` (Ctrl-C).

Tres suscripciones definen todo el comportamiento:

| Evento | Handler | Qué hace |
|---|---|---|
| `ac.on("session")` | `index.ts:86-113` | Resuelve los assets del circuito y del coche, construye `SessionInfo`, emite `status: connected` + `session` |
| `ac.on("waiting")` | `index.ts:115-120` | Limpia todo el estado y emite `status: waiting` |
| `ac.on("telemetry")` | `index.ts:138-142` | Guarda el frame y emite si toca (§3.4) |

Dos detalles que merece la pena interiorizar:

- **El `try/catch` de `:89-100`.** La resolución de assets toca disco y memoria
  compartida; si explota, la sesión **no** debe caerse con ella. El catch deja
  `trackAssets = null` y la sesión sigue: el mapa se dibujará en modo "solo tu trazada".
- **El "hello" de `:74-82`.** Cuando un cliente nuevo se conecta, el servidor le manda de
  inmediato el estado actual. Sin eso, abrir la web a mitad de sesión mostraría "esperando
  a Assetto Corsa" hasta el siguiente cambio de estado. Es el equivalente a hidratar un
  store en el primer render.

### 4.2 `acClient.ts` — la máquina de estados del protocolo

`ACClient` extiende `EventEmitter` (el patrón pub/sub de Node; piensa en un `EventTarget`).
Tipado en `acClient.ts:19-23`: emite `session`, `telemetry` y `waiting`.

Solo tiene dos estados: `handshaking` y `subscribed` (`:27`).

```
         start()
            │
            ▼
    ┌──────────────┐   respuesta de 408 bytes    ┌────────────┐
    │ handshaking  │ ──────────────────────────► │ subscribed │
    │              │   (envía SUBSCRIBE_UPDATE)  │            │
    │ reenvía el   │                             │ parsea     │
    │ handshake    │ ◄────────────────────────── │ paquetes   │
    │ cada 3 s     │   5 s de silencio (stale)   │ de 328 B   │
    └──────────────┘   → envía DISMISS           └────────────┘
```

El protocolo en sí es minúsculo: los tres paquetes que el bridge envía son idénticos
salvo por un entero, el *operation id* (`parsers.ts:6-11`, `buildHandshakePacket:29`):

| id | Nombre | Significado |
|---|---|---|
| 0 | `HANDSHAKE` | "¿Estás ahí? Preséntate" |
| 1 | `SUBSCRIBE_UPDATE` | "Mándame el stream a alta frecuencia" |
| 2 | `SUBSCRIBE_SPOT` | (stream lento, no se usa aquí) |
| 3 | `DISMISS` | "Deja de mandarme" |

La función que sostiene toda la robustez es `touchStaleTimer` (`:82-89`): cada paquete
recibido reinicia un temporizador de 5 s. Si expira, se asume que la sesión murió, se
manda `DISMISS` y se vuelve a `handshaking`. Es un **watchdog**, y es la única forma de
detectar el final de la sesión en un protocolo sin conexión.

### 4.3 `parsers.ts` — el núcleo delicado

87 líneas y la parte más frágil del repo. Cuatro funciones:

| Función | Línea | Qué hace |
|---|---|---|
| `readWideString` | 16 | UTF-16LE de 50 caracteres, cortado en el primer control o `%` |
| `buildHandshakePacket` | 29 | 12 bytes: identificador, versión, operation id |
| `parseHandshakerResponse` | 37 | 408 bytes → coche, piloto, circuito, layout |
| `parseRTCarInfo` | 59 | 328 bytes → el `TelemetryFrame` completo |

`parseRTCarInfo` es literalmente una lista de offsets. Para leerla, la clave es el
comentario de `:57-58`: `char identifier` + 3 bytes de padding, 6 booleanos en 20..25 + 2
de padding, y quince bloques `float[4]` (uno por dato de rueda) desde el offset 84. De
esos quince bloques el proyecto solo usa dos: `tyreSlip` (148) y `wheelLoad` (180). El
resto se ignora — no porque no exista, sino porque nada lo dibuja todavía.

Las tres últimas lecturas (`x` en 316, `y` en 320, `z` en 324) son las coordenadas del
mundo en metros. Son las que acaban siendo píxeles en el mapa. Fíjate en que **no hay
ángulo de guiñada (*yaw*)**: el protocolo no dice hacia dónde apunta el coche. Por eso el
mapa deduce la orientación del movimiento (§6.6).

### 4.4 `trackAssets.ts` + `aiSpline.ts` — encontrar y leer el circuito

Tres problemas encadenados:

**(a) ¿Dónde está instalado Assetto Corsa?** `discoverAcPath` (`:15-37`) lee los
`libraryfolders.vdf` de Steam (el formato de configuración propio de Steam), extrae cada
biblioteca con una regex y prueba si existe `steamapps/common/assettocorsa`. Si nada
funciona, cae a la ruta por defecto. Se puede forzar con la variable de entorno `AC_PATH`.

**(b) ¿Qué layout está cargado?** Un circuito puede tener varios trazados
(`ks_nordschleife/endurance`, `/nordschleife`…). El handshake UDP **no dice cuál**.
`resolveTrackAssetsForSession` (`:165`) intenta, en orden:

1. El `trackConfig` que vino en el handshake (`resolveTrackAssets:76`).
2. Si el circuito tiene exactamente un layout con datos, ese.
3. Leer la página de memoria compartida *estática* de AC y buscar cuál de los nombres de
   layout aparece allí (`resolveLoadedLayout:147`). El comentario de `:142-146` explica el
   detalle fino: se comparan **tokens completos**, no subcadenas, porque "nordschleife"
   está contenido dentro de "ks_nordschleife" y una búsqueda por subcadena elegiría el
   layout equivocado.
4. Si nada funciona: `null`, y el mapa cae al modo auto-ajuste.

**(c) ¿Cómo se proyecta el mundo a la pantalla?** `parseMapIni` (`:54`) lee cinco números
del `map.ini` del juego: `WIDTH`, `HEIGHT`, `X_OFFSET`, `Z_OFFSET`, `SCALE_FACTOR`. Con
ellos, la fórmula `pixel = (mundo + OFFSET) / SCALE_FACTOR` convierte metros en píxeles del
mapa oficial. Esos cinco números son lo único que fija el encuadre del mapa.

`aiSpline.ts` es el segundo parser binario, y merece leerse por lo bien documentado que
está (`:5-12` describe el formato entero). `ai/fast_lane.ai` es la línea que siguen los
coches de la IA: una cabecera de cuatro enteros, N puntos de 20 bytes y N registros extra
de 72 bytes donde los floats en posición 5 y 6 son `sideLeft` y `sideRight` — la distancia
medida de la línea a cada borde de la pista. Con eso, `resolveTrackEdges` (`:99`) calcula
los bordes desplazando cada punto por su normal:

```ts
// La izquierda del piloto en XZ es (dz, -dx) para la dirección unitaria (dx, dz)
left[i]  = [p.x + dz * p.sideLeft,  p.z - dx * p.sideLeft ];
right[i] = [p.x - dz * p.sideRight, p.z + dx * p.sideRight];
```

Y, muy importante, **cuatro validaciones antes de creerse el archivo** (`:114-128`): que
haya al menos 50 puntos, que el 70 % tenga anchura positiva, que el 80 % caiga dentro del
rectángulo del `map.ini` (un mod puede traer un `fast_lane.ai` copiado de otro circuito), y
un suavizado de mediana de 3 contra picos sueltos (`median3:37`). Si algo falla, devuelve
`null` y la función simplemente no existe. Otra vez el mismo patrón.

### 4.5 `carAssets.ts` — la regex de rescate

30 líneas que enseñan una lección: `ui_car.json` de AC contiene con frecuencia caracteres
de control en crudo que hacen que `JSON.parse` lance. En vez de intentar sanear el JSON, el
proyecto asume que el archivo es texto sucio y saca el campo con una regex
(`carAssets.ts:24`). El resultado (`topSpeedKmh`) solo sirve para escalar el dial del
velocímetro (`lib/speedScale.ts`), así que fallar significa "usa el dial por defecto de
320 km/h", no "error".

### 4.6 `sharedMemory.ts` — detección de cortes

**Qué es un corte:** salirse de los límites de la pista. AC invalida la vuelta cuando las
cuatro ruedas están fuera, y lleva su propio contador, `numberOfTyresOut`. El protocolo UDP
**no** lo expone; la página de física, sí.

`startCutDetection` (`:110`) monta un bucle de sondeo a ~60 Hz (`poll:128`) con esta lógica:

```ts
const packetId = page.readInt32LE(0);
if (packetId === lastPacketId) return;   // congelado = pausa/menú/replay/juego cerrado
const tyresOut = page.readInt32LE(244);
const isOut = tyresOut >= 4;
const onset = isOut && !wasOut;          // solo el flanco de subida: un evento por salida
wasOut = isOut;
if (!onset) return;
```

Y después, cuatro compuertas antes de emitir (`:146`): que haya sesión viva, que exista un
frame UDP reciente, que el coche no esté en boxes y que vaya a más de 10 km/h. Cada una
suprime un falso positivo concreto (teleport al garaje, pausa, respawn).

El evento se **sella con la posición del último frame UDP**, no con la de la página de
física (`:148-155`). El comentario de `:108-109` justifica por qué es correcto: a 60 Hz esa
posición tiene como mucho ~1 m de retraso, sub-píxel a escala del mapa.

### 4.7 `record.ts` y `scripts/mock-ac.js` — desarrollar sin el juego

Dos herramientas que hacen posible trabajar en este repo sin Assetto Corsa abierto:

- **`mock-ac.js`** finge ser el juego: se ata a UDP 9996, responde al handshake con datos de
  `magione` y emite paquetes `RTCarInfo` de un coche dando vueltas. En Windows además
  **crea la página `Local\acpmf_physics`** con los mismos offsets y genera salidas de pista
  periódicas, de modo que la detección de cortes se ejercita de verdad. Lánzalo con
  `npm run mock -w bridge`. **No puede correr a la vez que el juego** (los dos se atan al
  mismo puerto).
- **`record.ts`** se conecta al bridge como si fuera la web, graba cada mensaje con su
  marca de tiempo relativa y escribe un JSON (`record.ts:89-105`), más un archivo
  `*.map.json` con los assets del circuito (`captureMap:64`). Ese par de archivos es lo que
  alimenta el **modo demo** del frontend: la web los reproduce en bucle sin bridge ninguno
  (`hooks/useTelemetry.ts:121-152`).

---

## 5. El contrato: `types.ts` en los dos lados

`bridge/src/types.ts` y `web/src/types.ts` son **copias manuales** la una de la otra. El
primer comentario del archivo web lo dice (`web/src/types.ts:1`). El tipo que importa:

```ts
export type BridgeMessage =
  | { type: "status"; state: "waiting" | "connected" }
  | ({ type: "session" }   & SessionInfo)
  | ({ type: "telemetry" } & TelemetryFrame)
  | ({ type: "cut" }       & CutEvent);
```

Es una **unión discriminada**: el campo `type` decide la forma del resto, y TypeScript
estrecha el tipo dentro de cada `case` del `switch` (`useTelemetry.ts:74-103`). Si añades
un miembro a la unión y no lo manejas, el compilador no se queja por defecto, pero sí
fallará en cualquier sitio que haga exhaustividad. Mantener los dos archivos sincronizados
es la deuda de diseño más visible del proyecto (§9.1).

Las cuatro formas de mensaje:

| Mensaje | Cuándo | Contenido esencial |
|---|---|---|
| `status` | Cambios de conexión y al conectar un cliente | `waiting` \| `connected` |
| `session` | Al empezar una sesión | circuito, layout, coche, piloto, flags de assets, `topSpeedKmh` |
| `telemetry` | ~60 veces por segundo | velocidad, marcha, rpm, tiempos, pedales, G, ruedas, posición `x/y/z`, `normalizedPos` |
| `cut` | Al salirse de pista (solo Windows local) | `lapCount`, `lapTimeMs`, `x`, `z`, `speedKmh`, `tyresOut` |

Dos campos de `TelemetryFrame` que conviene entender bien porque son el eje de medio
frontend:

- **`normalizedPos`** — posición en la vuelta como fracción de 0 a 1. 0 = línea de meta,
  0,5 = mitad del circuito. Es lo que permite comparar dos vueltas distintas "en el mismo
  punto de la pista" sin saber nada de geometría. Toda la comparación de vueltas (delta,
  sectores, scrubbing) se indexa por este número.
- **`lapCount`** — el contador crudo de AC. La convención de visualización es que
  `lapCount = N` significa que estás en la "Vuelta N+1"; al cruzar meta, la vuelta que
  acabas de cerrar es la "Vuelta N+1". Esa conversión aparece repetida en varios sitios
  (`useLapHistory.ts:88`, `TrackMap.tsx:1454`, `useLapRecordings.ts:130`) y es una fuente
  clásica de confusión.

**Un detalle de contrato que ya está desincronizado:** `SessionInfo` expone
`mapAvailable`, `boundsAvailable` y `edgesAvailable`, pero **el frontend no los lee**.
`TrackMap` siempre sondea los endpoints HTTP directamente, y explica por qué en
`TrackMap.tsx:373-374`: una página con una sesión vieja en memoria debe poder recoger los
límites que el bridge tiene *ahora*. Los tres flags son superficie muerta.

---

## 6. El frontend

### 6.1 La idea central: un stream, dos velocidades

Este es el concepto que hay que entender antes que ningún otro. `useTelemetry`
(`hooks/useTelemetry.ts:30`) recibe ~60 mensajes por segundo y los expone **por tres vías
distintas**, deliberadamente:

```ts
return { status, session, telemetry, telemetryRef, cutsRef, cutSeq, subscribeFrame };
//                        ▲          ▲                         ▲
//                        │          │                         │
//     estado React ~30 Hz┘          │                         │
//     ref mutable, 60 Hz, sin render┘                         │
//     suscripción directa por callback, 60 Hz ────────────────┘
```

| Canal | Frecuencia | Provoca render | Quién lo usa |
|---|---|---|---|
| `telemetry` (useState) | ~30 Hz con flush de cola (`:89-96`) | Sí | Todo lo que es texto: `InstrumentCluster`, `LapTimes`, `SteeringBar`, y los hooks derivados |
| `telemetryRef` (useRef) | 60 Hz, cada mensaje (`:87`) | No | Bucles `requestAnimationFrame`: `TrackMap` |
| `subscribeFrame` (callbacks) | 60 Hz, cada mensaje (`:88`) | No | `useLapRecordings`, que no puede perder ni un frame |

**Por qué tres y no uno.** Un `setState` a 60 Hz re-renderiza el árbol entero 60 veces por
segundo para actualizar un texto que el ojo no distingue a más de 30. Pero el mapa sí
necesita cada frame: a 250 km/h, saltarse la mitad de las muestras deja la línea de
frenada desplazada varios metros. La solución es que los datos de alta frecuencia viajen
por una ref (que React no observa) y los consuma un bucle rAF que dibuja en canvas, fuera
del ciclo de render.

**Y por qué existe `subscribeFrame` además de la ref.** Un bucle rAF se frena cuando la
pestaña está oculta o tapada — y en este proyecto lo normal es tener el juego en primer
plano y el navegador detrás. La grabación de vueltas no puede depender de eso, así que
recibe cada frame por callback directo. El comentario de `useLapRecordings.ts:66-68` lo
explica textualmente.

**La reconexión** (`useTelemetry.ts:113-118`): al cerrarse el socket, se pasa a
`connecting`, se borra la sesión y se reintenta a los 1,5 s. No hay backoff exponencial —
deliberado: es una herramienta local, y quieres que reenganche al instante cuando reinicias
el bridge.

**El modo demo** (`:121-169`): si `VITE_DEMO_MODE` está activo, no hay WebSocket. Se
descarga el JSON grabado y un temporizador reproduce los mensajes respetando sus marcas de
tiempo, en bucle infinito. Como pasa por el mismo `handleMessage`, **todo lo de abajo es
idéntico**: ningún componente sabe si está en vivo o en replay. Eso es lo que hace posible
el despliegue público del proyecto.

### 6.2 Los hooks derivados: un patrón, cuatro instancias

Los cuatro siguen la misma forma: *un `useEffect` que depende del estado `telemetry`,
acumula en refs, y devuelve refs*. Ninguno provoca renders por dato nuevo.

| Hook | Entrada | Salida | Consumidor |
|---|---|---|---|
| `useInputHistory` | `telemetry` | `RefObject<InputSample[]>` (360 muestras ≈ 12 s) | `PedalTrace`, `GForceMeter` |
| `useLapHistory` | `telemetry` + cortes | `lapsRef`, `currentLapInvalidRef` | `LapTimes`, `TrackMap`, `LapAnalysis` |
| `useLapDelta` | `telemetry` | `number \| null` | `LapTimes` |
| `useLapRecordings` | `subscribeFrame` + sesión | `recordingsRef`, `version` | `LapAnalysis` |

#### `useLapHistory` — reconstruir algo que el protocolo no manda

AC **no envía una lista de vueltas** ni un flag de "vuelta inválida". Solo manda
`lapCount`, `lastLapMs` y `bestLapMs`. Este hook reconstruye el registro completo a partir
de esas tres señales, y es un ejemplo precioso de razonamiento sobre datos sucios.

Tres problemas y sus soluciones:

**(1) El frame que incrementa `lapCount` todavía puede llevar el `lastLapMs` viejo.** Por
eso la vuelta terminada se queda "pendiente" (`PendingLap`, `:16-23`) hasta que
`lastLapMs` cambie visiblemente — o hasta que pasen 3 frames, por si dos vueltas tuvieran
exactamente el mismo tiempo (`:115-118`).

**(2) ¿Cómo saber si una vuelta fue inválida?** Tres heurísticas combinadas (`:128`):

```ts
invalid: pending.pitDuring || pending.cutDuring || rejected
```

- `pitDuring`: se pisó el pit lane durante la vuelta.
- `cutDuring`: llegó un evento `cut` de la memoria compartida — la señal **autoritativa**,
  cuando está disponible.
- `rejected`: la vuelta habría sido la mejor, pero el juego **no la adoptó** como mejor
  (`:122-124`). Si AC la descartó, es que la invalidó él.

**(3) Reiniciar la sesión no vuelve a hacer handshake.** Cuando el jugador pulsa "restart",
AC no reinicia la conexión: simplemente el contador de vueltas o el reloj de vuelta van
hacia atrás. La detección es esta (`:73-77`):

```ts
const restarted =
  prevLap !== null &&
  (telemetry.lapCount < prevLap ||
    (telemetry.lapCount === prevLap && telemetry.lapTimeMs + 1000 < lapTimeRef.current));
```

**Esa misma firma está duplicada literalmente en cuatro archivos**: `useLapHistory.ts:73`,
`useLapDelta.ts:59`, `useLapRecordings.ts:107` y `TrackMap.tsx:1441`. El `CLAUDE.md` avisa
de mantenerlas sincronizadas. Es el candidato número uno de refactor (§9.2).

#### `useLapDelta` — comparar contra ti mismo

Acumula pares `{pos, timeMs}` de la vuelta en curso; al cerrar una vuelta completa y más
rápida que la referencia, la adopta como nueva referencia (`:41-58`). El delta en vivo es
una resta contra una interpolación:

```ts
const refTime = interpolateTimeAt(reference, telemetry.normalizedPos);
deltaRef.current = refTime === null ? null : telemetry.lapTimeMs - refTime;
```

Dos sutilezas que explican el 70 % del código del hook:

- **El "wrap" de la línea de meta.** AC reporta el salto de `normalizedPos` de 0,99 a 0,01
  uno o dos frames *antes* de incrementar `lapCount`. El hook guarda la grabación "envuelta"
  (`wrappedRef`, `:26`) esperando el tick inminente. Si el salto atrás **no** abarcaba una
  vuelta entera, eran muestras de una vuelta de salida y se descartan — y el comentario de
  `:73-77` explica la consecuencia de no hacerlo: la guarda de monotonía bloquearía la
  primera vuelta lanzada entera.
- **Monotonía.** Solo se admite una muestra si su `normalizedPos` es mayor que la anterior
  (`:92`). Un glitch de posición envenenaría la interpolación.

**Detalle a tener en cuenta al refactorizar:** el hook devuelve `deltaRef.current`
*durante el render* (`:108`), pero lo escribe *en el efecto*, que corre después. O sea que
el valor mostrado es el de la iteración anterior (~33 ms de retraso). Es invisible en la
práctica, pero es una inconsistencia con el resto de hooks, que devuelven la ref.

#### `useLapRecordings` — la grabación completa

Es `useLapDelta` llevado al extremo: en vez de `{pos, timeMs}` guarda nueve campos por
muestra (`LapTelemetrySample:8-19`) para cada vuelta de la sesión. Sus límites están
declarados y justificados (`:32-41`): 30 vueltas, 12.000 muestras por vuelta, ~20 MB en el
peor caso.

Lo interesante es la **política de expulsión** (`:170-185`): cuando se supera el límite se
elimina la más antigua, pero se **fija** la mejor vuelta válida completa, porque es la
referencia contra la que se compara todo lo demás.

También es el único hook que emite un `version` como estado (`:76`, `:98`, `:120`, `:187`)
— un número que sube cuando el *conjunto* de grabaciones cambia, nunca por muestra. Es el
truco estándar para decirle a React "el contenido de esta ref cambió" sin meter los datos
en el estado.

### 6.3 `lib/lapAnalysis.ts` — el módulo puro

188 líneas sin React, sin canvas, sin efectos. Es el archivo más fácil de leer y el más
fácil de testear si algún día se añade un runner (hoy el repo no tiene ninguno; ver
`.claude/rules/verification.md`).

| Función | Línea | Qué calcula |
|---|---|---|
| `bracket` | 23 | Búsqueda binaria: entre qué dos muestras cae una posición |
| `interpolateTimeAt` | 40 | Tiempo interpolado en una posición de pista |
| `sampleNear` | 54 | Muestra *más cercana*, sin interpolar (marcha y pedales no se mezclan) |
| `worldPointAt` | 65 | Coordenadas `x/z` interpoladas — así el scrub del panel se refleja en el mapa |
| `resolveReference` | 84 | La vuelta de referencia: la más rápida **válida y completa** |
| `sectorTimes` | 103 | Tiempo de cada uno de los 24 mini-sectores |
| `bestSectors` | 134 | Mejor tiempo por sector, **solo entre vueltas válidas** |
| `sectorOwners` | 159 | Quién es el más rápido en cada sector, **incluidas las inválidas** |
| `theoreticalBestMs` | 179 | Suma de los mejores sectores, o `null` si falta alguno |

La distinción entre `bestSectors` y `sectorOwners` está explicada en `:152-158` y es el
tipo de decisión que hay que respetar: una responde "qué cuenta" (para la vuelta teórica),
la otra responde "quién fue más rápido aquí" (para colorear la cinta). Solo la primera
puede sumarse.

`SECTOR_COUNT = 24` (`:16`): no existen metadatos de curvas en los archivos que el bridge
lee, así que se parte la vuelta en 24 trozos iguales por `normalizedPos`. Es la convención
de las herramientas de timing de simracing.

### 6.4 Componentes: los que escriben texto y los que pintan

Hay dos familias y no se mezclan.

**DOM/SVG, dirigidos por estado de React** — se re-renderizan a ~30 Hz con `telemetry`:

- `InstrumentCluster` (`:38`) — dos `AnalogGauge` más las luces ABS/TC/PIT. El overlay de
  neumáticos (`TyreOverlay`) se revela por hover.
- `AnalogGauge` (`:35`) — SVG puro, 200×200, ángulos medidos desde las 12 en punto
  (`:4-7`). La aguja se mueve con una transición CSS de 100 ms (`:177-184`), que interpola
  entre frames y hace que 30 Hz parezcan continuos.
- `LapTimes` (`:120`) — cuatro tiles y la lista de vueltas al hacer hover.
- `SteeringBar`, `SessionHeader`, `ConnectionBadge`, `DemoBadge`, `InteractionModeBadge`,
  `GitHubLink`.

**Canvas, dirigidos por `requestAnimationFrame`** — leen refs, nunca estado:

- `PedalTrace` (`:18`) — ventana deslizante de 12 s de gas/freno/embrague.
- `GForceMeter` (`:9`) — diagrama de dispersión G lateral vs longitudinal con estela.
- `TrackMap` (`:233`) — el mapa (§6.6).
- `LapAnalysis` (`:89`) — trazas comparadas (§6.7).

**El "dirty gate": el patrón que comparten los cuatro canvas.** Un bucle rAF corre a 60 fps
mientras la pestaña esté visible, gaste o no. Estos componentes comprueban primero si algo
de lo que se dibuja cambió y, si no, salen sin pintar:

```ts
// GForceMeter.tsx:37-48
const dirty = width !== lastW || height !== lastH || dpr !== lastDpr ||
              history.length !== lastLen || (newest?.t ?? -1) !== lastT;
if (!dirty) return;
```

Funciona porque los objetos de telemetría son **nuevos en cada mensaje**, así que comparar
identidades (`!==`) es un detector de cambios fiel y baratísimo. El `CLAUDE.md` pide
preservar esto al editar cualquier canvas.

### 6.5 Cómo se comunican los paneles: refs compartidas

`App.tsx:54-56` crea tres refs y las pasa hacia abajo. Son un bus de comunicación lateral
entre componentes hermanos que evita levantar estado (y por tanto renders) al padre:

| Ref | La escribe | La lee | Efecto visible |
|---|---|---|---|
| `hoveredLapRef` | `LapTimes` (fila de la lista) | `TrackMap` | Resalta esa vuelta en el mapa y revela su marca de corte |
| `scrubRef` | `LapAnalysis` (cursor sobre las trazas) | `TrackMap` | Dibuja un anillo en el punto exacto del circuito |
| `analysisLapRef` | `LapAnalysis` (vuelta seleccionada) | `TrackMap` | Revela las marcas de frenada de esa vuelta |

Es un patrón poco ortodoxo y perfectamente intencionado: si esto fuera estado, mover el
cursor sobre una traza re-renderizaría el árbol entero 60 veces por segundo. Con refs, solo
el bucle rAF del mapa lo nota.

### 6.6 `TrackMap.tsx` — anatomía de las 2.014 líneas

Es el archivo más grande y el que más te va a costar. Se entiende mejor por capas que en
orden de lectura.

**Estructura macro:**

| Zona | Líneas | Contenido |
|---|---|---|
| Constantes documentadas | 51-191 | Cada número mágico con su justificación |
| Helpers puros | 197-231 | `computeBrakeTicks`, `freshBounds`, `lerpColor`, `bucketKey` |
| Estado del componente | 242-343 | ~20 refs y 5 estados de React |
| Lógica de "follow cam" en React | 271-366 | Dwell por hover, activación, reset |
| Carga de assets | 368-408 | Sondeo de `/meta` y `/edges` (o del archivo demo) |
| **El `useEffect` gigante** | 410-1923 | Todo el motor de render y la interacción |
| JSX | 1925-2014 | Leyenda, badges y el `<canvas>` |

Ese único efecto de ~1.500 líneas contiene, en closures, todo el motor: proyecciones,
capas, cámara, hit-testing, gestos. Es lo que hace el archivo difícil de navegar (§9.3).

#### Las tres proyecciones

"Proyectar" aquí es convertir `(x, z)` en metros del mundo a `(px, py)` en píxeles del
canvas. Hay tres modos, y el `draw` los elige en cascada:

1. **`map.ini` disponible** (`:1546-1579`). El encuadre sale de los cinco números del
   `.ini`: es idéntico desde el primer frame y nunca se mueve.
   ```ts
   px = offsetX + ((p.x + meta.xOffset) / meta.scaleFactor / meta.width) * drawnW
   ```
2. **Bordes sin `map.ini`** (`:1581-1602`). Se ajusta a los límites de la cinta de asfalto
   (`edgeView`, calculado en `:430-450`). También fijo.
3. **Sin nada** (`:1604-1692`). Auto-ajuste a la trayectoria conducida, con easing (`:1650`)
   para que el coche no quede pegado al borde mientras el circuito aún "crece". En la
   primera vuelta la cámara se ancla al punto de partida con una extensión mínima de
   1.500 m (`FIRST_LAP_EXTENT:88`) — si no, las primeras curvas ocuparían toda la pantalla.

El zoom del usuario se compone encima con `zoomed` (`:496-502`): se escalan **los puntos**,
no la transformación del canvas. Consecuencia importante: el grosor de línea, el radio del
punto del coche y el radio de detección del hover se mantienen constantes en píxeles de
pantalla a cualquier zoom.

#### Las capas (el motivo de que vaya a 60 fps)

Redibujar 40 vueltas × 3.000 muestras en cada frame sería imposible. En su lugar hay tres
canvas fuera de pantalla (`:418-423`) que se re-renderizan solo cuando su clave de
invalidación cambia, y en un frame normal solo se copian (`blitLayer:557`):

| Capa | Contenido | Se reconstruye cuando |
|---|---|---|
| `trackLayer` | Cinta de asfalto y bordes | Cambia la proyección (`trackLayerKey`) |
| `lapsLayer` | Todas las vueltas completadas menos la enfocada | Cambia la proyección, `lapsVersion` o la vuelta enfocada |
| `currentLayer` | La vuelta en curso, por cubos de color | Cambia la proyección; si no, **solo se añaden** los segmentos nuevos (`:713-729`) |

Encima de eso hay otras dos optimizaciones que conviene conocer antes de tocar nada:

- **`Path2D` en espacio-mundo** (`buildLapPath:539`, `strokeWorldPath:519`). Como todas las
  proyecciones son afines uniformes, la geometría se guarda en metros una sola vez y se
  dibuja aplicando la transformación al contexto. `affineOf` (`:511`) *deduce* los
  coeficientes proyectando tres puntos — así funciona igual en los tres modos sin código
  específico. El resultado: un `stroke` nativo en vez de un bucle de JS por punto.
- **Cuantización de color** (`COLOR_QUANT = 12`, `:180-191`). La línea de la vuelta actual
  se colorea por pedal de forma continua, lo que significaría un `stroke` por segmento. En
  vez de eso el color se redondea a 25 cubos y cada cubo acumula su propio `Path2D`: coste
  plano en lugar de lineal.

#### La "follow cam"

`followCamera` (`:1210-1362`) es el fragmento con la física más fina del repo. Cuatro
estados (`FollowState:105`): `off`, `following`, `detached`, `exiting`.

Tres decisiones que merecen estudio:

1. **Se arma por *dwell*, no por clic** (`startDwell:305`, 1 segundo). El proyecto entero
   evita los clics porque un clic da el foco al navegador y le roba la entrada al juego. La
   barrita de progreso del botón (`:2001-2007`) usa una clase Tailwind literal porque
   Tailwind escanea el texto del código: una interpolada nunca se generaría (`:109-112`).
2. **Suavizado por tiempo, no por frame** (`FOLLOW_TAU_S = 0,3`, `decay = exp(-dt/τ)`,
   `:1314`). Así la cámara se mueve igual a 60 Hz que a 144 Hz y atraviesa los frames
   perdidos sin saltos.
3. **El punto seguido se renderiza 120 ms en el pasado** (`FOLLOW_DELAY_MS:138`,
   interpolación en `:1247-1261`). Los frames llegan de forma irregular; interpolando
   dentro de un retraso mayor que el peor hueco, el movimiento se vuelve de velocidad
   constante. El comentario explica por qué un suavizado exponencial no sirve aquí:
   heredaría la irregularidad del objetivo.

De ese retraso sale un detalle bonito: `TIP_HOLDBACK` (`:144`). Las 16 muestras más nuevas
de la vuelta actual **no** entran en la capa cacheada; se dibujan cada frame recortadas
justo en el punto donde está el coche (`drawCurrentTail:737`), para que la línea nunca
asome por delante del coche.

#### Interacción

| Gesto | Handler | Comportamiento |
|---|---|---|
| Mover el ratón | `onMouseMove:1695` | Guarda la posición; `hitTestLaps:795` busca la línea más cercana (radio de 12 px) |
| Rueda | `onWheel:1701` | Zoom anclado al cursor; en modo follow reajusta el encuadre en lugar de soltar la cámara |
| Pinch | `onTouchMove:1799` | Gemelo táctil de la rueda, con paneo por el punto medio |
| Arrastre de un dedo | `onTouchMove:1851` | Paneo; si estaba siguiendo, pasa a `detached` |
| Tap | `onTouchEnd:1878` | Aparca el "cursor" ahí, para que el readout funcione en móvil |

`hitTestLaps` recorre las muestras de 3 en 3 (`:814`) — como están a ~1 m, la distancia
punto a punto es una aproximación fiel de la distancia a la línea. Y no hace nada mientras
la cámara sigue al coche (`:804`): el mapa se desliza bajo un cursor quieto, así que las
líneas "se seleccionarían solas" al pasar.

### 6.7 `LapAnalysis.tsx` — el panel de comparación

Cuatro franjas dibujadas en un canvas (`layoutStrips:66`): velocidad (42 %), pedales (24 %),
delta (34 %) y la cinta de sectores (12 px fijos).

El mismo patrón de capa cacheada que el mapa: `renderTraces` (`:198`) pinta en un canvas
fuera de pantalla y solo se rehace cuando cambia la clave `layerKey`
(`:548`); un frame de scrubbing es una copia más el cursor (`drawScrubOverlay:380`).

Tres cosas que enseñan a razonar sobre estado derivado:

- **`ownersKey`** (`:84`). La versión de las grabaciones no basta como clave: el flag de
  "vuelta inválida" puede llegar unos frames *después* de que la grabación se guarde, y eso
  cambia el color de un sector sin cambiar la versión. La solución es un fingerprint de los
  propietarios de sector.
- **Nada se memoiza por versión** (`:140-149`). El comentario justifica el coste: unos
  cientos de interpolaciones a 30 Hz no son nada, y un memo mal keyeado seguiría acreditando
  sectores a una vuelta cortada.
- **Las vueltas inválidas se revisan, no se filtran** (`:105-108`). Una vuelta que el juego
  tiró es justo donde el piloto fue más rápido *y* donde se salió. Se marca, nunca se
  esconde.

---

## 7. Recorridos completos

### 7.1 De un byte a un píxel (un frame de telemetría)

```
 1. AC envía 328 bytes por UDP al puerto 9996
 2. acClient.ts:74     → longitud 328 y estado "subscribed" → es un RTCarInfo
 3. parsers.ts:59      → parseRTCarInfo: readFloatLE(8) = velocidad, (316,324) = x,z…
 4. acClient.ts:76     → emit("telemetry", frame)
 5. index.ts:138       → latestFrame = frame; frameDirty = true; flushIfDue()
 6. index.ts:124-136   → ¿toca (60 Hz)? JSON.stringify + send a cada cliente WS
 7. useTelemetry.ts:109→ socket.onmessage → JSON.parse → handleMessage
 8. useTelemetry.ts:87 → telemetryRef.current = message            (canal rápido)
 9. useTelemetry.ts:88 → cada callback de subscribeFrame            (grabación)
10. useTelemetry.ts:90 → ¿pasaron 33 ms? setTelemetry(message)      (canal lento)
11a. TrackMap.tsx:1384 → el bucle rAF lee telemetryRef, ve un objeto nuevo → dirty
11b. TrackMap.tsx:1499 → ¿se movió más de 1 m? push a currentRef.current
11c. TrackMap.tsx:1570 → project() → capas → drawDot() → píxeles
12a. InstrumentCluster → re-render con el nuevo estado → la aguja SVG transiciona
12b. useLapHistory / useLapDelta / useInputHistory → efectos sobre el estado nuevo
```

### 7.2 De una rueda fuera a una × roja en el mapa

```
 1. AC escribe numberOfTyresOut = 4 en Local\acpmf_physics
 2. sharedMemory.ts:128 → poll() a ~60 Hz: packetId cambió, tyresOut pasó de <4 a >=4
 3. sharedMemory.ts:146 → compuertas: hay sesión, hay frame, no está en boxes, >10 km/h
 4. sharedMemory.ts:148 → onCut({ lapCount, lapTimeMs, x, z, … }) sellado con el frame UDP
 5. index.ts:149        → broadcast({ type: "cut", … })
 6. useTelemetry.ts:99  → cutsRef.current.push(message); setCutSeq(n => n+1)
 7a. useLapHistory.ts:101 → consume el corte: ¿vuelta en curso? cutDuringRef = true
                            → la vuelta se guardará con invalid: true
 7b. TrackMap.tsx:1478  → consume el corte: currentCutRef o la vuelta guardada que le toque
 8. TrackMap.tsx:1068   → drawCutMarkers: × roja, ambiente en la vuelta en curso,
                          revelada por hover en las vueltas guardadas
 9. LapTimes.tsx:154    → el tile "Current lap" muestra el cartel INV
```

Fíjate en que el mismo evento lo consumen **dos** consumidores independientes, cada uno con
su propio contador `consumedCuts` (`useLapHistory.ts:45-48`, `TrackMap.tsx:258-259`) y su
propio chequeo de identidad del array para detectar un cambio de sesión. Es duplicación real
(§9.2), pero también es lo que permite que ninguno dependa del otro.

### 7.3 De cruzar la meta a una vuelta comparable

```
 1. normalizedPos salta de ~0,99 a ~0,01 (uno o dos frames ANTES del tick de lapCount)
 2a. useLapDelta.ts:80        → guarda la grabación "envuelta" si abarcaba una vuelta
 2b. useLapRecordings.ts:202  → lo mismo con la traza completa
 3. lapCount se incrementa
 4a. useLapHistory.ts:86      → crea una PendingLap con el contexto de la vuelta cerrada
 4b. useLapRecordings.ts:121  → mueve la traza a "pendiente"
 4c. TrackMap.tsx:1451        → mueve la línea a previousLaps + calcula computeBrakeTicks
 5. Llega un lastLapMs fresco (o pasan 3-6 frames)
 6a. useLapHistory.ts:119     → push a lapsRef con el veredicto de validez
 6b. useLapRecordings.ts:159  → push a recordings, marca complete, version++
 7. LapAnalysis                → la vuelta aparece como chip; resolveReference puede
                                 adoptarla como referencia; sectorOwners recolorea la cinta
 8. TrackMap.tsx:1519          → el key de la leyenda cambia → setLegend (único setState)
```

---

## 8. Invariantes: lo que no se toca sin entender por qué

Antes de refactorizar, estas decisiones están tomadas a conciencia y documentadas. Cambiar
cualquiera de ellas es un cambio de producto, no una limpieza.

**8.1 Los offsets binarios no se "limpian".** `parsers.ts` y `sharedMemory.ts` codifican el
layout de memoria de un binario de 2014. No hay forma de derivarlos; solo de copiarlos bien.

**8.2 Todo lo opcional falla en silencio.** Cortes, mapa, bordes, velocidad punta: cada uno
se apaga solo si su fuente no está, y **nunca** afecta al camino UDP. Si añades una función
nueva, hereda esa regla.

**8.3 La interfaz es solo-hover en producción.** Un clic daría el foco al navegador y le
robaría la entrada al juego. Por eso el dwell de 1 s, los paneles que se revelan con
`group-hover`, y `lib/interaction.ts`, que activa el modo clic **solo** en la demo.

**8.4 El `map.png` no se dibuja aposta.** AC lo traza con un ancho constante alrededor de la
línea de la IA, o sea que **miente sobre los límites de pista**. El proyecto dibuja los
bordes reales derivados del spline, y la verdad sobre por dónde se pasa son las trazadas.

**8.5 El dirty-gating de los canvas se preserva.** Los cuatro componentes de canvas solo
repintan cuando lo dibujado cambió de verdad.

**8.6 El `TelemetryFrame` es inmutable por mensaje.** Media detección de cambios del
frontend se apoya en que cada mensaje es un objeto nuevo. Reutilizar el objeto para ahorrar
memoria rompería el mapa entero de forma silenciosa.

**8.7 No hay framework de tests.** Está dicho en `.claude/rules/verification.md`: la
verificación automática son cuatro comandos de solo lectura (typecheck del bridge, typecheck
de la web, oxlint, prettier) y el resto es ejecutar la app con el mock. No inventes
`npm test`.

---

## 9. Mapa de refactor

Ordenado por relación valor/riesgo. Ninguno cambia comportamiento: son todos reorganización.
Para un backlog de mejoras *funcionales* ya existe `docs/DIAGNOSTIC.md`, y el juicio general
del repo está en `docs/EVALUACION-TECNICA.md`.

### 9.1 El contrato duplicado a mano (riesgo bajo, valor alto)

`bridge/src/types.ts` y `web/src/types.ts` son copias literales mantenidas por disciplina.
Un tercer workspace (`shared/`) con los tipos, importado por ambos, elimina la clase entera
de bug. El monorepo ya es de workspaces npm, así que el coste es un `package.json` y dos
imports. Cuidado con un detalle: el bridge usa ESM con extensiones `.js` explícitas en los
imports y la web pasa por Vite; el paquete compartido debe ser solo tipos o compilar a ambos.

### 9.2 La lógica duplicada entre hooks (riesgo bajo, valor alto)

Cuatro duplicaciones reales, todas verificables:

| Qué | Dónde | Propuesta |
|---|---|---|
| Firma del reinicio de sesión | `useLapHistory.ts:73`, `useLapDelta.ts:59`, `useLapRecordings.ts:107`, `TrackMap.tsx:1441` | `lib/session.ts` → `detectRestart(prev, frame)` |
| Consumo incremental de cortes | `useLapHistory.ts:45-48,101`, `TrackMap.tsx:258,1474` | Un hook/helper `useCutConsumer(cutsRef, cutSeq)` |
| "Vuelta envuelta" en la meta | `useLapDelta.ts:73-88`, `useLapRecordings.ts:193-213` | `useLapDelta` puede derivarse de `useLapRecordings` (que ya graba `pos` y `timeMs`) |
| Mejor vuelta válida de la sesión | `LapTimes.tsx:134`, `LapAnalysis.tsx:610`, `lapAnalysis.ts:78` | Un único selector en `lib/lapAnalysis.ts` |

El tercero es el de más impacto: `useLapDelta` es, esencialmente, un subconjunto de
`useLapRecordings` con la mitad de su complejidad repetida.

### 9.3 Partir `TrackMap.tsx` (riesgo medio, valor muy alto)

2.014 líneas y un `useEffect` de ~1.500. Las costuras naturales ya existen en el propio
archivo: cada bloque de closures es un módulo en potencia.

```
components/TrackMap/
  index.tsx          // JSX, estado de React, follow-cam UI (~250 líneas)
  projection.ts      // zoomed, affineOf, los tres modos base       (:490-535, 1546-1692)
  layers.ts          // trackLayer / lapsLayer / currentLayer       (:548-731)
  followCamera.ts    // la cámara y su interpolación                (:1206-1369)
  hitTest.ts         // hitTestLaps + drawHoverReadout              (:779-916)
  markers.ts         // dot, brake ticks, cuts, rings               (:982-1167)
  input.ts           // wheel, touch, tap                           (:1695-1894)
  constants.ts       // las 140 líneas de constantes documentadas   (:51-191)
```

La dificultad real: todo eso hoy comparte estado por closure (`lapsVersion`,
`appendedCount`, `currentPaths`, `headingFrom/To`, `trail`, `camOffPx`). Extraerlo pide
convertir cada bloque en una factoría que reciba sus dependencias y devuelva funciones —por
ejemplo `createLayers({ canvas, ctx })` → `{ renderTrackLayer, renderLapsLayer, … }`. Es
mecánico, pero hay que hacerlo de un tirón por módulo y comprobar visualmente con el mock,
porque no hay tests que lo respalden.

**Empieza por `constants.ts` y `projection.ts`**: son los dos que no tocan estado mutable.

### 9.4 Robustez del bridge (riesgo bajo, valor medio)

`bridge/src/index.ts` no registra handlers de `error` en el servidor HTTP ni en el
`WebSocketServer`. En Node, un evento `error` sin escuchador se convierte en excepción no
capturada y mata el proceso: un `EADDRINUSE` (el puerto 3001 ocupado) tumba el bridge sin
mensaje útil. Un `server.on("error", …)` y un `wss.on("error", …)` con un log claro son
cinco líneas. (`acClient.ts:33` sí lo hace para el socket UDP — ahí está el patrón a copiar.)

### 9.5 Superficie muerta (riesgo nulo)

- `useLapRecordings` devuelve `currentRef` (`:54`, `:244`) y **nadie lo consume**.
- `SessionInfo.mapAvailable` / `boundsAvailable` / `edgesAvailable` no se leen en la web.
- `GET /api/track-map/image` se sirve pero no se pide nunca.
- Del `RTCarInfo` se parsean quince bloques de rueda y solo se usan dos.

Ninguna hace daño; todas confunden a quien lee. Borrarlas o documentarlas explícitamente
como "reservado" es trabajo de diez minutos.

### 9.6 Duplicación visual entre `TrackMap` y `LapAnalysis` (riesgo bajo)

Ambos dibujan cajas de readout con segmentos de texto de colores (`TrackMap.tsx:862`,
`LapAnalysis.tsx:426`), ambos definen los mismos literales de color de pedal
(`TrackMap.tsx:159-161` vs `LapAnalysis.tsx:48-53`), y ambos escriben una función
`pedalSeg`/`rowFor` casi idéntica. Un `lib/canvasReadout.ts` y un `lib/pedalColors.ts`
unifican las dos.

### 9.7 Documentación desactualizada (riesgo nulo)

El `CLAUDE.md` describe `trackAssets.ts` como "lee `map.ini`" y no menciona `aiSpline.ts`,
los bordes de pista ni el endpoint `/api/track-map/edges`, que son una parte sustancial del
mapa actual. Tampoco menciona `useLapRecordings` ni `record.ts` en la sección de flujo de
datos. Si tocas esa zona, actualiza también el `CLAUDE.md` y la spec correspondiente en
`openspec/specs/` (hay 21 capacidades documentadas ahí; son la referencia autoritativa de
comportamiento).

---

## 10. Plan de estudio

### Sesión 1 — Ver el sistema moverse (30 min)

```bash
npm run mock -w bridge     # terminal 1: Assetto Corsa falso
npm run dev                # terminal 2: bridge + web
```

Abre `http://localhost:5173`. Después:

1. Abre las DevTools → Network → WS → mira los frames en crudo. Reconoce los cuatro
   `type`. Ese es el contrato de §5 en vivo.
2. Mira la consola del bridge: verás la línea de sesión de `acClient.ts:63` y, en Windows,
   `[shm] physics page mapped`.
3. Para el mock y observa cómo la web cae a "Waiting for Assetto Corsa" pasados 5 s
   (el watchdog de §4.2) y cómo el bridge vuelve a hacer handshake cada 3 s.

### Sesión 2 — El bridge (1 h)

Lee en este orden: `types.ts` → `parsers.ts` → `acClient.ts` → `index.ts`. Son 430 líneas.

**Ejercicio:** añade al `TelemetryFrame` un campo que ya venga en el paquete pero no se
parsee (mira los bloques `float[4]` desde el offset 84 en `parsers.ts:57-58` — por ejemplo
la temperatura de neumático o la presión). Tendrás que tocar `parsers.ts`, `bridge/types.ts`
y `web/types.ts`, y verás en carne propia por qué §9.1 importa.

### Sesión 3 — El flujo de datos del frontend (1 h)

Lee `useTelemetry.ts` entero, después `App.tsx`, después `useInputHistory.ts` (39 líneas,
el hook derivado más simple).

**Ejercicio:** pon un `console.count()` en el `case "telemetry"` y otro en el
`setTelemetry`. Comprueba en vivo la relación 2:1 entre el canal rápido y el lento.

### Sesión 4 — Reconstrucción de vueltas (1,5 h)

`useLapHistory.ts` y `lib/lapAnalysis.ts`. Este es el corazón lógico del proyecto y no tiene
nada de canvas ni de red: es razonamiento puro sobre un stream sucio.

**Ejercicio:** describe con tus palabras las tres razones por las que una vuelta puede salir
`invalid` y en qué orden se evalúan. Después busca qué pasa si llega un `cut` para una
vuelta que ya se guardó (pista: `useLapHistory.ts:104-110`).

### Sesión 5 — Un canvas pequeño (45 min)

`PedalTrace.tsx` (128 líneas) y `GForceMeter.tsx` (121). Ambos tienen la estructura completa
—rAF, dirty gate, escalado por DPR, `setTransform`— en un tamaño manejable.

**Ejercicio:** añade una cuarta traza al `PedalTrace` con el ángulo de volante normalizado.
Son cinco líneas, y te obliga a entender el mapeo de coordenadas.

### Sesión 6 — El mapa (2-3 h, en dos pasadas)

Primera pasada: solo las constantes (`:51-191`) y el JSX (`:1925-2014`). Segunda pasada: la
función `draw` (`:1372-1693`) de arriba abajo, saltando a cada helper cuando lo llame.

**Ejercicio:** con el mock corriendo, borra a mano el `map.ini` de magione (o exporta
`AC_PATH` a una ruta inexistente) y observa el tercer modo de proyección: el auto-ajuste con
easing. Es la mejor forma de entender por qué existen tres.

### Sesión 7 — Refactor guiado (medio día)

Haz §9.5 (superficie muerta) primero: es intrascendente y te obliga a navegar el árbol.
Después §9.2 (el helper `detectRestart`), que toca cuatro archivos y no cambia nada
observable. Con eso hecho, §9.3 deja de dar miedo.

Después de cada paso:

```bash
npm run build -w bridge              # tsc --noEmit del bridge
npm --prefix web exec -- tsc -b --noEmit
npm run lint -w web
npm run format:check
```

Y la mitad manual: `npm run mock -w bridge` + `npm run dev`, y mirar que el punto se mueva.
El procedimiento completo está en `.claude/skills/verify/SKILL.md`.

---

## 11. Glosario

### Simracing

| Término | Significado |
|---|---|
| **Telemetría** | El flujo de datos del coche: velocidad, rpm, pedales, posición… |
| **Vuelta (lap)** | Una pasada completa por el circuito. `lapCount` es el contador crudo de AC |
| **Vuelta inválida / cortada** | Vuelta anulada por salirse de pista. En AC, cuatro ruedas fuera |
| **Corte (cut)** | El acto de salirse de los límites |
| **Out-lap** | Vuelta de salida desde boxes; no cuenta como vuelta cronometrada |
| **Delta** | Diferencia de tiempo contra una vuelta de referencia en el mismo punto |
| **Vuelta teórica** | Suma de los mejores sectores; el tiempo que harías sin fallar |
| **Mini-sector** | Trozo de la vuelta (aquí 1/24) usado para comparar por tramos |
| **Punto de frenada** | Dónde empiezas a frenar. Las marquitas del mapa (`computeBrakeTicks`) |
| **Trail braking** | Soltar el freno progresivamente al entrar en curva |
| **Coast** | Ni gas ni freno. El amarillo de la línea del mapa |
| **Fuerza G lateral/longitudinal** | Aceleración en curva / en frenada y aceleración |
| **Racing line / AI spline** | La trayectoria ideal. En AC, `ai/fast_lane.ai` |
| **Layout** | Variante de trazado de un mismo circuito |
| **Pit lane** | Calle de boxes. Pisarla invalida la vuelta |

### Sistemas y red

| Término | Significado |
|---|---|
| **UDP** | Transporte sin conexión ni garantías. Rápido y con pérdidas |
| **Datagrama** | Un paquete UDP suelto y autocontenido |
| **Handshake** | Intercambio inicial para establecer una sesión |
| **Watchdog** | Temporizador que declara muerto lo que lleva demasiado callado |
| **Buffer** | Array de bytes en bruto |
| **Endianness / little-endian** | Orden de los bytes de un número. x86 usa LE |
| **Struct / padding / offset** | Registro de campos fijos en memoria, con relleno de alineación, y la posición de cada campo |
| **Memoria compartida** | Bloque de memoria con nombre que varios procesos leen |
| **FFI** | Llamar funciones nativas (C) desde otro lenguaje. Aquí, `koffi` |
| **Event loop** | El bucle de un hilo que despacha callbacks. Node y el navegador comparten modelo |
| **Throttling / dirty gating** | Limitar la frecuencia de un trabajo / no hacerlo si nada cambió |
| **DPR** | *Device pixel ratio*: píxeles físicos por píxel CSS. Por eso los canvas se escalan |
| **Blit** | Copiar un buffer de píxeles tal cual sobre otro |
| **Affine (transformación afín)** | Escalado + traslación (+ rotación). Preserva rectas y paralelas |
| **rAF** | `requestAnimationFrame`: un callback por frame de pantalla |

