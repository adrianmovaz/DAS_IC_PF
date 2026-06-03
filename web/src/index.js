import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();
const app = express();

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

app.get('/api/readings', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 300, 5000);
  const rows = await prisma.reading.findMany({ orderBy: { id: 'desc' }, take: limit });
  res.json(rows.reverse());
});

app.get('/api/stats', async (req, res) => {
  const agg = await prisma.reading.aggregate({
    _min: { lux: true },
    _max: { lux: true },
    _avg: { lux: true },
    _count: true
  });
  res.json(agg);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(payload, except) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client !== except && client.readyState === 1) client.send(data);
  }
}

wss.on('connection', async (socket) => {
  const recent = await prisma.reading.findMany({ orderBy: { id: 'desc' }, take: 300 });
  socket.send(JSON.stringify({ type: 'history', data: recent.reverse() }));

  socket.on('message', async (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }
    if (typeof msg.lux !== 'number') return;

    const saved = await prisma.reading.create({
      data: {
        seq: Number(msg.seq) || 0,
        tMs: Number(msg.tMs) || 0,
        code: Number(msg.code) || 0,
        voltage: Number(msg.voltage) || 0,
        lux: Number(msg.lux)
      }
    });

    broadcast({ type: 'reading', data: saved }, socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Servidor en http://localhost:' + PORT);
});
