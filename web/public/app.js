const MAX_POINTS = 300;
const VFS = 5.0;

const els = {
  status: document.getElementById('status'),
  lux: document.getElementById('lux'),
  state: document.getElementById('state'),
  voltage: document.getElementById('voltage'),
  code: document.getElementById('code'),
  rate: document.getElementById('rate'),
  mmm: document.getElementById('mmm'),
  chartTitle: document.getElementById('chartTitle'),
  toggle: document.getElementById('toggle'),
  canvas: document.getElementById('chart')
};

const ctx = els.canvas.getContext('2d');
let buffer = [];
let mode = 'voltage';

function classify(lux) {
  if (lux < 10) return 'muy oscuro';
  if (lux < 50) return 'oscuro';
  if (lux < 200) return 'tenue';
  if (lux < 500) return 'iluminado';
  return 'brillante';
}

function push(r) {
  buffer.push(r);
  if (buffer.length > MAX_POINTS) buffer.shift();
}

function computeRate() {
  if (buffer.length < 2) return 0;
  const a = buffer[0];
  const b = buffer[buffer.length - 1];
  const dt = (b.tMs - a.tMs) / 1000;
  if (dt <= 0) return 0;
  return (buffer.length - 1) / dt;
}

function updateMetrics() {
  if (buffer.length === 0) return;
  const last = buffer[buffer.length - 1];
  els.lux.textContent = last.lux.toFixed(0);
  els.state.textContent = classify(last.lux);
  els.voltage.textContent = last.voltage.toFixed(3) + ' V';
  els.code.textContent = last.code;
  els.rate.textContent = computeRate().toFixed(1) + ' Hz';

  let min = Infinity, max = -Infinity, sum = 0;
  for (const r of buffer) {
    if (r.lux < min) min = r.lux;
    if (r.lux > max) max = r.lux;
    sum += r.lux;
  }
  const avg = sum / buffer.length;
  els.mmm.textContent = min.toFixed(0) + ' / ' + avg.toFixed(0) + ' / ' + max.toFixed(0);
}

function drawChart() {
  const w = els.canvas.width;
  const h = els.canvas.height;
  const padL = 48, padR = 12, padT = 12, padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  ctx.clearRect(0, 0, w, h);

  const values = buffer.map(r => mode === 'voltage' ? r.voltage : r.lux);
  const yMax = mode === 'voltage' ? VFS : Math.max(10, ...values) * 1.1;
  const yMin = 0;

  ctx.strokeStyle = '#e2e0d8';
  ctx.fillStyle = '#6f6e69';
  ctx.lineWidth = 1;
  ctx.font = '11px ui-monospace, Menlo, monospace';

  const rows = 4;
  for (let i = 0; i <= rows; i++) {
    const y = padT + (plotH * i) / rows;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    const val = yMax - ((yMax - yMin) * i) / rows;
    ctx.fillText(mode === 'voltage' ? val.toFixed(1) : val.toFixed(0), 6, y + 4);
  }

  if (values.length < 2) return;

  ctx.strokeStyle = mode === 'voltage' ? '#c2761a' : '#1d7a55';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = padL + (plotW * i) / (MAX_POINTS - 1);
    const norm = (values[i] - yMin) / (yMax - yMin);
    const y = padT + plotH * (1 - norm);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function render() {
  updateMetrics();
  drawChart();
}

els.toggle.addEventListener('click', () => {
  mode = mode === 'voltage' ? 'lux' : 'voltage';
  els.chartTitle.textContent = mode === 'voltage'
    ? 'Señal reconstruida — voltaje'
    : 'Iluminación — lux';
  els.toggle.textContent = mode === 'voltage' ? 'ver lux' : 'ver voltaje';
  drawChart();
});

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(proto + '://' + location.host + '/ws');

  socket.onopen = () => {
    els.status.textContent = 'conectado';
    els.status.classList.add('on');
    els.status.classList.remove('off');
  };

  socket.onclose = () => {
    els.status.textContent = 'desconectado';
    els.status.classList.add('off');
    els.status.classList.remove('on');
    setTimeout(connect, 2000);
  };

  socket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'history') {
      buffer = msg.data.slice(-MAX_POINTS);
      render();
    } else if (msg.type === 'reading') {
      push(msg.data);
      render();
    }
  };
}

connect();
