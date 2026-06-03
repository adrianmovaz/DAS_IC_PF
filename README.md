# DAS de iluminación — ESP32 (ADC0804) + WiFi + Node.js

Sistema de adquisición de datos que mide la iluminación de una habitación con una
fotorresistencia (LDR), la digitaliza con un ADC0804 externo de 8 bits, y la envía
por WiFi (WebSocket) directamente a un servidor Node.js, que la guarda en SQLite
(Prisma) y la muestra en una interfaz web en tiempo real, incluyendo la señal
analógica reconstruida.

Un solo ESP32 hace todo el lado embebido: lee el ADC, linealiza a lux y transmite
por WiFi. No se usa ESP-NOW ni un segundo ESP32.

## Arquitectura

```
[LDR + acond.] → [ADC0804] → [ESP32: WiFi + WebSocket] → [Node.js + SQLite] → [Navegador]
```

- El ESP32 muestrea con su timer, lee el ADC0804, linealiza y envía cada muestra por WebSocket.
- El servidor persiste en SQLite vía Prisma y retransmite a los navegadores conectados.
- La interfaz muestra lux, estado, voltaje, código ADC, frecuencia de muestreo,
  mín/prom/máx y la señal reconstruida (voltaje o lux).

## Estructura de directorios

```
das-iluminacion/
├── firmware/
│   └── esp32_node/
│       ├── esp32_node.ino        Orquestación: setup/loop, timer y bandera de muestreo
│       ├── config.h              Pines y constantes (muestreo, WiFi, servidor, calibración)
│       ├── Reading.h             Estructura de una muestra
│       ├── Adc0804.h / .cpp      Driver del ADC0804: begin() y read() con el handshake
│       ├── Linearization.h / .cpp Conversiones código → voltaje → resistencia → lux
│       └── Net.h / .cpp          WiFi y cliente WebSocket: netBegin/netLoop/netSend
└── web/
    ├── package.json              Dependencias y scripts
    ├── prisma/schema.prisma       Modelo de datos (SQLite)
    ├── src/index.js               Express + WebSocket + Prisma
    └── public/                    Interfaz web
        ├── index.html
        ├── styles.css
        └── app.js                 Cliente WebSocket + gráfica reconstruida
```

Importante sobre el firmware modular: Arduino compila juntos todos los `.ino`, `.h`
y `.cpp` que estén en la carpeta del sketch (`esp32_node/`). Mantén los archivos en
esa carpeta y abre `esp32_node.ino`; el IDE mostrará cada módulo en su pestaña.

## Qué hace cada módulo del firmware

- `esp32_node.ino` — crea el timer, en cada disparo levanta una bandera y, en el loop,
  pide una lectura al ADC, la linealiza, arma la muestra y la envía.
- `config.h` — todos los parámetros en un solo lugar: pines, frecuencia de muestreo,
  credenciales WiFi, host/puerto del servidor y constantes de calibración.
- `Reading.h` — la estructura `Reading` (seq, tMs, code, voltage, lux) compartida.
- `Adc0804.h/.cpp` — configura los pines y ejecuta el handshake WR → INTR → RD.
- `Linearization.h/.cpp` — la cadena código → voltaje → resistencia → lux.
- `Net.h/.cpp` — conecta a WiFi y mantiene el cliente WebSocket; serializa y envía cada muestra.

## Pines del ADC0804 y conexión con el ESP32

CS se ata permanentemente a GND (el ADC siempre está seleccionado), así solo se
controlan WR, RD e INTR. Las salidas del ADC son de 5 V; como el ESP32 no tolera 5 V,
las 8 líneas de datos e INTR pasan por un level shifter (74LVC245 a 3.3 V, o divisor
para INTR). WR y RD salen directo del ESP32 (3.3 V satisface el VIH TTL del ADC).

| ADC0804 | Pin | Función | Conexión |
|---|---|---|---|
| CS | 1 | Selección de chip | GND (siempre activo) |
| RD | 2 | Lectura / output enable | GPIO17 (salida ESP32, directo) |
| WR | 3 | Inicio de conversión | GPIO16 (salida ESP32, directo) |
| CLK IN | 4 | Entrada de reloj | red RC con pin 19 |
| INTR | 5 | Fin de conversión | GPIO34 (entrada ESP32, vía divisor 5→3.3 V) |
| Vin(+) | 6 | Entrada analógica | salida del buffer/filtro (señal del LDR) |
| Vin(−) | 7 | Entrada diferencial | A GND |
| A GND | 8 | Tierra analógica | GND (punto estrella) |
| Vref/2 | 9 | Ajuste de span | cursor de trimpot, o abierto = span 0–5 V |
| D GND | 10 | Tierra digital | GND (punto estrella) |
| DB7 | 11 | Dato bit 7 (MSB) | 74LVC245 → GPIO35 |
| DB6 | 12 | Dato bit 6 | 74LVC245 → GPIO32 |
| DB5 | 13 | Dato bit 5 | 74LVC245 → GPIO33 |
| DB4 | 14 | Dato bit 4 | 74LVC245 → GPIO25 |
| DB3 | 15 | Dato bit 3 | 74LVC245 → GPIO26 |
| DB2 | 16 | Dato bit 2 | 74LVC245 → GPIO27 |
| DB1 | 17 | Dato bit 1 | 74LVC245 → GPIO14 |
| DB0 | 18 | Dato bit 0 (LSB) | 74LVC245 → GPIO13 |
| CLK R | 19 | Resistor del oscilador | R 10 kΩ a pin 4; C 150 pF de pin 4 a GND |
| Vcc | 20 | Alimentación 5 V | +5 V + 0.1 µF a GND |

En `config.h` el bus se define en orden DB0..DB7:
`DB_PINS = {13, 14, 27, 26, 25, 33, 32, 35}`. WR=16, RD=17, INTR=34.

Nota: GPIO34 y 35 son solo-entrada (ideales para datos/INTR). En módulos WROVER los
GPIO16/17 los usa la PSRAM; en ese caso mueve WR/RD a GPIO18/19.

## Linealización

Cada muestra recorre tres pasos (`Linearization.cpp`), con constantes en `config.h`:

1. Código a voltaje: `V = (code / 255) · VFS`
2. Voltaje a resistencia (LDR arriba): `R = R_FIXED · (VCC / V − 1)`
3. Resistencia a lux: `E = 10^((log10(R) − CAL_B) / CAL_M)`

Constantes a ajustar:

- `VCC` = 5.0 — tensión de alimentación del divisor.
- `VFS` = 5.0 — fondo de escala del ADC (= 2·Vref/2; deja 5.0 con Vref/2 abierto).
- `R_FIXED` — resistencia fija del divisor; idealmente `√(R_min·R_max)` de tu LDR.
- `CAL_M`, `CAL_B` — pendiente e intercepto del ajuste log–log del LDR.

Calibración: toma varios puntos (lux de un luxómetro de referencia vs la R que mides),
ajusta `log10(R) = m·log10(E) + b` por regresión lineal, y pon `CAL_M = m`, `CAL_B = b`.
Los valores incluidos son solo un punto de partida.

## Funcionamiento

Muestreo gobernado por timer: un timer por hardware dispara una ISR a `SAMPLE_HZ`
(10 Hz por defecto). La ISR solo levanta una bandera; el `loop` hace la conversión, de
modo que el periodo de muestreo es determinista.

Conversión (`Adc0804::read`): pulso de WR bajo→alto inicia la conversión; se espera a
que INTR baje (con timeout de seguridad por si INTR no está cableado); se baja RD, se
leen los 8 bits, se sube RD.

Transmisión: el ESP32, como cliente WebSocket, envía cada muestra en JSON
(`seq`, `tMs`, `code`, `voltage`, `lux`) al servidor.

## Servidor (Node.js + Prisma + SQLite)

Requisitos: Node.js 18+.

```bash
cd web
npm install
npx prisma generate
npx prisma db push
npm start
```

`prisma db push` crea `web/prisma/das.db`. El servidor queda en `http://localhost:3000`
y el WebSocket en `ws://<IP>:3000/ws`.

Configura el firmware (`config.h`) con tu red y la IP de tu Mac en la red local:

```bash
ipconfig getifaddr en0
```

Pon esa IP en `SERVER_HOST`, y tu red en `WIFI_SSID` / `WIFI_PASS`.

Endpoints útiles:

- `GET /api/readings?limit=300` — historial reciente (orden ascendente).
- `GET /api/stats` — mín, máx, promedio y conteo de lux.

## Librerías necesarias

- Arduino-ESP32 core 3.x (el firmware usa la API de timer de 3.x: `timerBegin(freq)`,
  `timerAlarm(...)`).
- Librería `WebSockets` de Markus Sattler (arduinoWebSockets).

## Interfaz

Minimalista y utilitaria: lux actual en grande con su estado (muy oscuro / oscuro /
tenue / iluminado / brillante), voltaje, código ADC, frecuencia de muestreo medida, y
mín/prom/máx. La gráfica une las muestras para mostrar la señal reconstruida; el botón
alterna entre voltaje (fondo de escala 0–VFS) y lux. Los umbrales de estado están en
`classify()` dentro de `public/app.js`.

## Checklist de configuración

- [ ] `WIFI_SSID`, `WIFI_PASS`, `SERVER_HOST` en `config.h`.
- [ ] `R_FIXED`, `CAL_M`, `CAL_B` calibrados al LDR real.
- [ ] Level shifter en DB0–DB7 e INTR (nunca conectes las salidas de 5 V directo al ESP32).
- [ ] Tierras analógica y digital unidas en un punto estrella.
