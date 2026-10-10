/*
  Mario Restaurante: animação do topo.
  Um prato feito no buffet, visto de cima, sobre a toalha xadrez amarela.
  A comida é servida item por item e o visitante pode montar o próprio prato
  tocando nos botões abaixo dele. Tudo desenhado em <canvas>, sem vídeo.
*/
(() => {
  'use strict';

  const canvas = document.getElementById('prato');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const hero = canvas.closest('.hero');
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const botoes = Array.from(document.querySelectorAll('[data-item]'));

  // Lugar de cada comida no prato (em raios do prato), na ordem de desenho.
  const ITENS = [
    { id: 'arroz',  x: -0.3,  y: -0.13, giro: 0,     raio: 0.32, migalha: '#fbf5e6', criar: arroz },
    { id: 'feijao', x: -0.22, y:  0.34, giro: 0,     raio: 0.26, migalha: '#3a1d10', criar: feijao },
    { id: 'salada', x:  0.07, y: -0.42, giro: 0.3,   raio: 0.32, migalha: '#6aa83a', criar: salada },
    { id: 'bife',   x:  0.15, y:  0.05, giro: -0.35, raio: 0.3,  migalha: '#5a2a12', criar: bife },
    { id: 'batata', x:  0.29, y:  0.37, giro: 0,     raio: 0.32, migalha: '#eab552', criar: batata },
    { id: 'pastel', x:  0.44, y: -0.15, giro: 0.55,  raio: 0.26, migalha: '#e4ab55', criar: pastel }
  ];
  // As porções são desenhadas nesta escala (prato bem servido).
  const PORCAO = 1.3;
  const ORDEM_SERVIR = ['arroz', 'feijao', 'bife', 'batata', 'salada', 'pastel'];
  const DUR_SERVIR = 0.62, DUR_TIRAR = 0.38;

  let W = 0, H = 0, DPR = 1, P = 200, cx = 0, cy = 0;
  let toalha = null, pratoImg = null, sprites = {};
  let tempo = 0, ultimo = 0, rodando = false, emTela = true, idQuadro = 0, pulo = false;
  const estado = {};
  const migalhas = [];
  const tocados = new Set();
  ITENS.forEach((it) => { estado[it.id] = { presente: false, mudou: -10, pousou: true }; });

  /* ---------- utilidades ---------- */

  function semente(s) {
    return () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function novaCamada(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * DPR));
    c.height = Math.max(1, Math.ceil(h * DPR));
    const g = c.getContext('2d');
    g.scale(DPR, DPR);
    return [c, g];
  }

  // Caminho suave passando pelos pontos (fechado).
  function caminhoSuave(g, pts) {
    const n = pts.length;
    const meio = (i) => {
      const p = pts[i % n], q = pts[(i + 1) % n];
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    };
    g.beginPath();
    const s = meio(n - 1);
    g.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const e = meio(i);
      g.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]);
    }
    g.closePath();
  }

  // Contorno irregular de uma porção. Devolve uma função que traça o mesmo caminho sempre.
  function contorno(r, rnd, irregular, sy = 1) {
    const f = [rnd() * 6, rnd() * 6], pts = [], n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 + irregular * (0.6 * Math.sin(3 * a + f[0]) + 0.4 * Math.sin(5 * a + f[1]) + (rnd() - 0.5) * 0.5));
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * sy]);
    }
    return (g) => caminhoSuave(g, pts);
  }

  function pontoNoDisco(rnd, r) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
    return [Math.cos(a) * d, Math.sin(a) * d, d];
  }

  function sombra(g, cor, blur, ox, oy) {
    g.shadowColor = cor;
    g.shadowBlur = blur * DPR;
    g.shadowOffsetX = ox * DPR;
    g.shadowOffsetY = oy * DPR;
  }
  function semSombra(g) { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }

  function retArredondado(g, x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
  }

  /* ---------- comidas ---------- */

  function arroz(g, rnd) {
    const r = P * 0.23;
    const tracar = contorno(r, rnd, 0.07);
    tracar(g);
    const base = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05);
    base.addColorStop(0, '#fffdf6');
    base.addColorStop(0.6, '#f2eada');
    base.addColorStop(1, '#d9cdb4');
    g.fillStyle = base;
    g.fill();

    g.save();
    tracar(g);
    g.clip();
    const n = Math.round(r * r * 0.32);
    for (let i = 0; i < n; i++) {
      const [x, y, d] = pontoNoDisco(rnd, r * 1.02);
      const luz = Math.min(1.04, 1 - 0.13 * ((x + y) / (r * 1.4)) - 0.16 * Math.pow(d / r, 2));
      const len = r * (0.13 + rnd() * 0.05), lar = len * 0.38;
      g.fillStyle = `rgb(${Math.round(255 * luz)},${Math.round(250 * luz)},${Math.round(236 * luz)})`;
      g.beginPath();
      g.ellipse(x, y, len / 2, lar / 2, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
      if (rnd() < 0.6) {
        g.strokeStyle = 'rgba(150,128,90,0.22)';
        g.lineWidth = 0.5;
        g.stroke();
      }
    }
    g.restore();

    // grãos soltos no prato
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, d = r * (1.04 + rnd() * 0.3);
      const len = r * 0.14;
      g.fillStyle = '#fbf6ea';
      g.strokeStyle = 'rgba(150,128,90,0.35)';
      g.lineWidth = 0.6;
      g.beginPath();
      g.ellipse(Math.cos(a) * d, Math.sin(a) * d, len / 2, len * 0.19, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  function feijao(g, rnd) {
    const r = P * 0.19;
    const tracar = contorno(r, rnd, 0.1);
    tracar(g);
    const base = g.createRadialGradient(-r * 0.25, -r * 0.3, 0, 0, 0, r * 1.05);
    base.addColorStop(0, '#5b3121');
    base.addColorStop(0.55, '#3e2014');
    base.addColorStop(1, '#2a150b');
    g.fillStyle = base;
    g.fill();

    g.save();
    tracar(g);
    g.clip();
    const cores = ['#4a2416', '#55291a', '#3f1e12', '#5d3020', '#4f2718'];
    const n = Math.round(r * r * 0.045);
    for (let i = 0; i < n; i++) {
      const [x, y] = pontoNoDisco(rnd, r * 0.98);
      const len = r * (0.3 + rnd() * 0.08), lar = len * 0.62, ang = rnd() * Math.PI;
      g.save();
      g.translate(x, y);
      g.rotate(ang);
      g.fillStyle = cores[Math.floor(rnd() * cores.length)];
      g.beginPath();
      g.ellipse(0, 0, len / 2, lar / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(20,8,3,0.5)';
      g.lineWidth = 0.6;
      g.stroke();
      g.fillStyle = 'rgba(255,230,210,0.3)';
      g.beginPath();
      g.ellipse(-len * 0.16, -lar * 0.18, len * 0.2, lar * 0.14, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // caldo cobrindo parte dos grãos
    for (let i = 0; i < 16; i++) {
      const [x, y] = pontoNoDisco(rnd, r);
      const rr = r * (0.18 + rnd() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, 'rgba(52,26,14,0.6)');
      gr.addColorStop(1, 'rgba(52,26,14,0)');
      g.fillStyle = gr;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // brilho do caldo
    const brilho = g.createRadialGradient(-r * 0.35, -r * 0.4, 0, -r * 0.35, -r * 0.4, r * 0.9);
    brilho.addColorStop(0, 'rgba(255,235,215,0.16)');
    brilho.addColorStop(1, 'rgba(255,235,215,0)');
    g.fillStyle = brilho;
    g.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    for (let i = 0; i < 18; i++) {
      const [x, y] = pontoNoDisco(rnd, r * 0.8);
      g.fillStyle = `rgba(255,240,225,${0.25 + rnd() * 0.35})`;
      g.beginPath();
      g.ellipse(x, y, 0.6 + rnd() * 1.6, 0.4 + rnd() * 0.7, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    tracar(g);
    g.strokeStyle = 'rgba(100,58,36,0.6)';
    g.lineWidth = Math.max(1, P * 0.008);
    g.stroke();
  }

  // Contorno do bife (de -1 a 1).
  const formaBife = (() => {
    const pts = [], N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let r = 1 + 0.06 * Math.sin(3 * a + 0.7) + 0.045 * Math.cos(5 * a + 1.9) + 0.025 * Math.sin(7 * a + 0.3);
      r -= 0.12 * Math.exp(-Math.pow(a - 4.3, 2) / 0.12);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  })();

  function bife(g, rnd) {
    const sx = P * 0.235, sy = P * 0.16;
    const pts = formaBife.map(([x, y]) => [x * sx, y * sy]);
    const tracar = () => caminhoSuave(g, pts);
    const tudo = () => g.fillRect(-sx * 1.2, -sy * 1.2, sx * 2.4, sy * 2.4);

    tracar();
    const base = g.createRadialGradient(-sx * 0.25, -sy * 0.3, 0, 0, 0, sx * 1.15);
    base.addColorStop(0, '#8d4a22');
    base.addColorStop(0.55, '#6b3115');
    base.addColorStop(1, '#3d1809');
    g.fillStyle = base;
    g.fill();

    g.save();
    tracar();
    g.clip();
    // gordura numa das bordas
    const gordura = g.createLinearGradient(-sx, -sy, sx * 0.3, sy * 0.4);
    gordura.addColorStop(0, 'rgba(236,190,118,0.95)');
    gordura.addColorStop(0.3, 'rgba(206,142,72,0.7)');
    gordura.addColorStop(0.55, 'rgba(206,142,72,0)');
    g.lineWidth = sy * 0.4;
    g.strokeStyle = gordura;
    tracar();
    g.stroke();
    // crosta da selagem
    for (let i = 0; i < 150; i++) {
      const [x0, y0] = pontoNoDisco(rnd, 0.95);
      const x = x0 * sx, y = y0 * sy, rr = (0.04 + rnd() * 0.12) * sx;
      const escuro = rnd() < 0.62;
      const cor = escuro ? '42,16,6' : '182,108,50';
      const al = escuro ? 0.18 + rnd() * 0.3 : 0.12 + rnd() * 0.24;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(${cor},${al})`);
      gr.addColorStop(1, `rgba(${cor},0)`);
      g.fillStyle = gr;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rnd() < 0.7 ? 'rgba(30,10,3,0.22)' : 'rgba(255,214,160,0.12)';
      g.fillRect((rnd() - 0.5) * sx * 2, (rnd() - 0.5) * sy * 2, 0.8 + rnd(), 0.8 + rnd());
    }
    g.strokeStyle = 'rgba(28,9,2,0.55)';
    g.lineWidth = sx * 0.16;
    tracar();
    g.stroke();
    g.globalCompositeOperation = 'lighter';
    const brilho = g.createRadialGradient(-sx * 0.35, -sy * 0.45, 0, -sx * 0.35, -sy * 0.45, sx * 0.9);
    brilho.addColorStop(0, 'rgba(255,214,160,0.16)');
    brilho.addColorStop(1, 'rgba(255,214,160,0)');
    g.fillStyle = brilho;
    tudo();
    for (let i = 0; i < 40; i++) {
      const [x0, y0] = pontoNoDisco(rnd, 0.85);
      g.fillStyle = `rgba(255,236,205,${0.12 + rnd() * 0.35})`;
      g.beginPath();
      g.ellipse(x0 * sx, y0 * sy, 0.6 + rnd() * 2, 0.4 + rnd() * 1.1, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    // cebola dourada por cima (bife acebolado)
    g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = (rnd() - 0.5) * sx * 1.2, y = (rnd() - 0.5) * sy * 1.1;
      const rr = sx * (0.22 + rnd() * 0.16), a0 = rnd() * Math.PI * 2, a1 = a0 + 1.6 + rnd() * 1.4;
      const larg = Math.max(2, P * 0.016);
      sombra(g, 'rgba(40,15,5,0.4)', 2, 0.5, 1);
      g.strokeStyle = 'rgba(176,112,48,0.9)';
      g.lineWidth = larg * 1.35;
      g.beginPath(); g.arc(x, y, rr, a0, a1); g.stroke();
      semSombra(g);
      g.strokeStyle = 'rgba(238,208,150,0.95)';
      g.lineWidth = larg;
      g.beginPath(); g.arc(x, y, rr, a0, a1); g.stroke();
      g.strokeStyle = 'rgba(255,244,214,0.7)';
      g.lineWidth = larg * 0.35;
      g.beginPath(); g.arc(x, y, rr - larg * 0.15, a0 + 0.1, a1 - 0.1); g.stroke();
    }
  }

  function batata(g, rnd) {
    const r = P * 0.2;
    const palitos = [];
    for (let i = 0; i < 26; i++) {
      const [x, y] = pontoNoDisco(rnd, r * 0.7);
      palitos.push({ x, y, ang: rnd() * Math.PI, len: r * (1 + rnd() * 0.5), lar: r * (0.19 + rnd() * 0.04) });
    }
    for (const p of palitos) {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.ang);
      sombra(g, 'rgba(120,70,10,0.35)', 3, 1, 2);
      retArredondado(g, -p.len / 2, -p.lar / 2, p.len, p.lar, p.lar * 0.28);
      const corpo = g.createLinearGradient(0, -p.lar / 2, 0, p.lar / 2);
      corpo.addColorStop(0, '#fbe193');
      corpo.addColorStop(0.45, '#efbc57');
      corpo.addColorStop(1, '#d2932e');
      g.fillStyle = corpo;
      g.fill();
      semSombra(g);
      const pontas = g.createLinearGradient(-p.len / 2, 0, p.len / 2, 0);
      pontas.addColorStop(0, 'rgba(160,92,20,0.5)');
      pontas.addColorStop(0.16, 'rgba(160,92,20,0)');
      pontas.addColorStop(0.84, 'rgba(160,92,20,0)');
      pontas.addColorStop(1, 'rgba(160,92,20,0.5)');
      g.fillStyle = pontas;
      g.fill();
      g.strokeStyle = 'rgba(255,248,220,0.65)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-p.len * 0.4, -p.lar * 0.28);
      g.lineTo(p.len * 0.4, -p.lar * 0.28);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let k = 0; k < 3; k++) g.fillRect((rnd() - 0.5) * p.len * 0.8, (rnd() - 0.5) * p.lar * 0.6, 1, 1);
      g.restore();
    }
  }

  function pastel(g, rnd) {
    const a = P * 0.19, h = P * 0.15, base = h * 0.45;
    const tracarCorpo = () => {
      g.beginPath();
      g.moveTo(-a, base);
      g.ellipse(0, base, a, h * 1.25, 0, Math.PI, Math.PI * 2);
      g.closePath();
    };
    tracarCorpo();
    const corpo = g.createRadialGradient(-a * 0.25, -h * 0.2, 0, 0, 0, a * 1.1);
    corpo.addColorStop(0, '#f7d084');
    corpo.addColorStop(0.6, '#e3a650');
    corpo.addColorStop(1, '#c7852f');
    g.fillStyle = corpo;
    g.fill();

    g.save();
    tracarCorpo();
    g.clip();
    // borda apertada com garfo
    g.lineWidth = h * 0.34;
    g.strokeStyle = '#d99a47';
    g.beginPath();
    g.ellipse(0, base, a, h * 1.25, 0, Math.PI, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(150,85,25,0.5)';
    g.lineWidth = 1.2;
    for (let k = 1; k < 20; k++) {
      const t = Math.PI + (k / 20) * Math.PI;
      const ox = Math.cos(t) * a, oy = base + Math.sin(t) * h * 1.25;
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(ox * 0.86, base + (oy - base) * 0.86);
      g.stroke();
    }
    // bolhinhas da massa frita
    for (let i = 0; i < 95; i++) {
      const x = (rnd() - 0.5) * a * 1.9, y = base - rnd() * h * 1.2;
      const rb = P * (0.004 + rnd() * 0.011);
      g.beginPath();
      g.arc(x, y, rb, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,232,170,${0.35 + rnd() * 0.3})`;
      g.fill();
      g.strokeStyle = 'rgba(160,95,30,0.45)';
      g.lineWidth = 0.6;
      g.stroke();
    }
    const brilho = g.createRadialGradient(-a * 0.3, -h * 0.4, 0, -a * 0.3, -h * 0.4, a);
    brilho.addColorStop(0, 'rgba(255,250,225,0.22)');
    brilho.addColorStop(1, 'rgba(255,250,225,0)');
    g.fillStyle = brilho;
    g.fillRect(-a, -h * 1.5, a * 2, h * 2.5);
    g.restore();
    g.strokeStyle = 'rgba(160,95,30,0.45)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-a * 0.96, base);
    g.lineTo(a * 0.96, base);
    g.stroke();
  }

  function folha(g, x, y, len, lar, rot, rnd) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const fase = rnd() * 6, pts = [];
    for (let i = 0; i < 30; i++) {
      const t = (i / 30) * Math.PI * 2;
      const onda = 1 + 0.07 * Math.sin(t * 9 + fase) + 0.04 * Math.sin(t * 17 + fase);
      pts.push([Math.cos(t) * len / 2 * onda, Math.sin(t) * lar / 2 * onda]);
    }
    sombra(g, 'rgba(40,70,20,0.3)', 3, 1, 1.5);
    caminhoSuave(g, pts);
    const cor = g.createRadialGradient(-len * 0.1, 0, 0, 0, 0, len / 2);
    cor.addColorStop(0, '#5b9a30');
    cor.addColorStop(0.6, '#86bd4c');
    cor.addColorStop(1, '#b4db7a');
    g.fillStyle = cor;
    g.fill();
    semSombra(g);
    g.strokeStyle = 'rgba(60,110,30,0.35)';
    g.lineWidth = 0.6;
    g.stroke();
    g.strokeStyle = 'rgba(235,250,205,0.75)';
    g.lineWidth = Math.max(1, P * 0.006);
    g.beginPath();
    g.moveTo(-len * 0.42, 0);
    g.quadraticCurveTo(0, -lar * 0.08, len * 0.42, 0);
    g.stroke();
    g.lineWidth = 0.7;
    for (let k = -2; k <= 2; k++) {
      const px = k * len * 0.15;
      g.beginPath();
      g.moveTo(px, -lar * 0.02);
      g.lineTo(px + len * 0.08, -lar * 0.3);
      g.moveTo(px, lar * 0.02);
      g.lineTo(px + len * 0.08, lar * 0.3);
      g.stroke();
    }
    g.restore();
  }

  function tomate(g, x, y, r, rnd) {
    g.save();
    g.translate(x, y);
    g.rotate(rnd() * Math.PI);
    sombra(g, 'rgba(90,20,10,0.3)', 3, 1, 1.5);
    g.fillStyle = '#c92f22';
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    semSombra(g);
    g.fillStyle = '#e8543a';
    g.beginPath(); g.arc(0, 0, r * 0.85, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      g.save();
      g.translate(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
      g.rotate(a);
      g.fillStyle = 'rgba(246,160,96,0.9)';
      g.beginPath(); g.ellipse(0, 0, r * 0.26, r * 0.19, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f7dc8f';
      for (let s = 0; s < 4; s++) {
        g.beginPath();
        g.ellipse((rnd() - 0.5) * r * 0.3, (rnd() - 0.5) * r * 0.2, r * 0.05, r * 0.03, rnd() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    g.fillStyle = 'rgba(240,122,90,0.9)';
    g.beginPath(); g.arc(0, 0, r * 0.16, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = Math.max(1, r * 0.06);
    g.beginPath(); g.arc(0, 0, r * 0.92, Math.PI * 1.1, Math.PI * 1.5); g.stroke();
    g.restore();
  }

  function salada(g, rnd) {
    const r = P * 0.2;
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + rnd() * 0.5;
      const d = r * 0.4, len = r * (0.8 + rnd() * 0.2);
      folha(g, Math.cos(ang) * d, Math.sin(ang) * d, len, len * 0.56, ang + (rnd() - 0.5) * 0.6, rnd);
    }
    folha(g, 0, 0, r * 0.8, r * 0.45, rnd() * Math.PI, rnd);
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + 0.4;
      tomate(g, Math.cos(ang) * r * 0.42, Math.sin(ang) * r * 0.42, r * 0.27, rnd);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      const [x, y] = pontoNoDisco(rnd, r * 0.9);
      const a = rnd() * Math.PI * 2, l = r * (0.15 + rnd() * 0.15);
      g.strokeStyle = rnd() < 0.5 ? '#f39a2c' : '#e9821c';
      g.lineWidth = Math.max(1, P * 0.006);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  }

  /* ---------- toalha xadrez, guardanapo, talheres e prato ---------- */

  function criarToalha() {
    const [c, g] = novaCamada(W, H);
    g.fillStyle = '#FBF8EE';
    g.fillRect(0, 0, W, H);

    // xadrez amarelo alinhado ao prato
    const S = Math.round(Math.max(18, P * 0.16));
    const ox = ((cx - S / 2) % (2 * S)) - 2 * S, oy = ((cy - S / 2) % (2 * S)) - 2 * S;
    g.fillStyle = 'rgba(243,231,91,0.55)';
    for (let x = ox; x < W; x += 2 * S) g.fillRect(x, 0, S, H);
    for (let y = oy; y < H; y += 2 * S) g.fillRect(0, y, W, S);

    // trama do tecido
    const [tc, tg] = novaCamada(4, 4);
    tg.fillStyle = 'rgba(120,95,30,0.07)';
    tg.fillRect(0, 0, 4, 1);
    tg.fillRect(0, 0, 1, 4);
    const trama = g.createPattern(tc, 'repeat');
    if (trama) {
      g.save();
      g.scale(1 / DPR, 1 / DPR);
      g.fillStyle = trama;
      g.fillRect(0, 0, W * DPR, H * DPR);
      g.restore();
    }

    // dobras suaves do tecido
    const rnd = semente(8);
    for (let i = 0; i < 5; i++) {
      const x = rnd() * W, larg = W * (0.08 + rnd() * 0.1);
      const dobra = g.createLinearGradient(x - larg, 0, x + larg, H * 0.3);
      dobra.addColorStop(0, 'rgba(255,255,255,0)');
      dobra.addColorStop(0.5, rnd() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(120,95,30,0.05)');
      dobra.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = dobra;
      g.fillRect(0, 0, W, H);
    }

    // luz de janela vindo de cima à esquerda
    const luz = g.createRadialGradient(cx - P * 0.8, cy - P, 0, cx - P * 0.8, cy - P, Math.max(W, H) * 0.8);
    luz.addColorStop(0, 'rgba(255,255,250,0.28)');
    luz.addColorStop(0.5, 'rgba(255,255,250,0.05)');
    luz.addColorStop(1, 'rgba(110,80,20,0.12)');
    g.fillStyle = luz;
    g.fillRect(0, 0, W, H);

    guardanapo(g);
    garfo(g, cx - P * 1.24, cy + P * 0.04, -0.04);
    faca(g, cx + P * 1.22, cy + P * 0.02, 0.03);

    // sombra do prato
    g.save();
    sombra(g, 'rgba(80,60,15,0.32)', P * 0.14, P * 0.03, P * 0.07);
    g.fillStyle = '#f0ede6';
    g.beginPath();
    g.arc(cx, cy, P * 0.99, 0, Math.PI * 2);
    g.fill();
    g.restore();
    return c;
  }

  function guardanapo(g) {
    const w = P * 0.48, h = P * 1.55;
    g.save();
    g.translate(cx - P * 1.25, cy + P * 0.04);
    g.rotate(-0.05);
    sombra(g, 'rgba(90,70,20,0.25)', P * 0.04, 2, P * 0.02);
    const cor = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    cor.addColorStop(0, '#d4c4a6');
    cor.addColorStop(0.32, '#e2d5bd');
    cor.addColorStop(0.34, '#cdbb9b');
    cor.addColorStop(0.36, '#ddcfb5');
    cor.addColorStop(1, '#cfbf9f');
    g.fillStyle = cor;
    g.fillRect(-w / 2, -h / 2, w, h);
    semSombra(g);
    g.strokeStyle = 'rgba(120,100,70,0.35)';
    g.setLineDash([3, 3]);
    g.lineWidth = 1;
    g.strokeRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
    g.setLineDash([]);
    g.restore();
  }

  function aco(g, larg) {
    const gr = g.createLinearGradient(-larg, 0, larg, 0);
    gr.addColorStop(0, '#cfcfcb');
    gr.addColorStop(0.35, '#ffffff');
    gr.addColorStop(0.7, '#a6a6a2');
    gr.addColorStop(1, '#e4e4e0');
    return gr;
  }

  function cabo(g, y0, y1, larg) {
    retArredondado(g, -larg / 2, y0, larg, y1 - y0, larg / 2);
    const gr = g.createLinearGradient(-larg / 2, 0, larg / 2, 0);
    gr.addColorStop(0, '#2c2c2c');
    gr.addColorStop(0.4, '#0f0f0f');
    gr.addColorStop(1, '#1e1e1e');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-larg * 0.22, y0 + larg * 0.5);
    g.lineTo(-larg * 0.22, y1 - larg * 0.5);
    g.stroke();
  }

  function garfo(g, x, y, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    sombra(g, 'rgba(70,55,20,0.35)', P * 0.03, 2, P * 0.025);
    cabo(g, P * 0.05, P * 0.66, P * 0.09);
    g.fillStyle = aco(g, P * 0.08);
    g.beginPath();
    g.moveTo(-P * 0.018, -P * 0.2);
    g.lineTo(P * 0.018, -P * 0.2);
    g.lineTo(P * 0.026, P * 0.07);
    g.lineTo(-P * 0.026, P * 0.07);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-P * 0.075, -P * 0.42);
    g.lineTo(P * 0.075, -P * 0.42);
    g.quadraticCurveTo(P * 0.07, -P * 0.22, 0, -P * 0.19);
    g.quadraticCurveTo(-P * 0.07, -P * 0.22, -P * 0.075, -P * 0.42);
    g.closePath();
    g.fill();
    for (let k = 0; k < 4; k++) {
      const tx = -P * 0.063 + k * P * 0.042;
      retArredondado(g, tx - P * 0.012, -P * 0.66, P * 0.024, P * 0.26, P * 0.012);
      g.fill();
    }
    g.restore();
  }

  function faca(g, x, y, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    sombra(g, 'rgba(70,55,20,0.35)', P * 0.03, 2, P * 0.025);
    cabo(g, P * 0.06, P * 0.66, P * 0.09);
    g.fillStyle = aco(g, P * 0.06);
    g.beginPath();
    g.moveTo(-P * 0.034, P * 0.06);
    g.lineTo(-P * 0.034, -P * 0.6);
    g.quadraticCurveTo(-P * 0.034, -P * 0.67, P * 0.004, -P * 0.67);
    g.quadraticCurveTo(P * 0.05, -P * 0.62, P * 0.05, -P * 0.5);
    g.lineTo(P * 0.044, P * 0.06);
    g.closePath();
    g.fill();
    semSombra(g);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(P * 0.036, -P * 0.48);
    g.lineTo(P * 0.032, P * 0.04);
    g.stroke();
    g.fillStyle = '#d7d7d3';
    for (const ry of [0.2, 0.36, 0.52]) {
      g.beginPath();
      g.arc(0, P * ry, P * 0.011, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function criarPrato() {
    const lado = P * 2 + 8;
    const [c, g] = novaCamada(lado, lado);
    g.translate(lado / 2, lado / 2);

    g.beginPath();
    g.arc(0, 0, P, 0, Math.PI * 2);
    const aba = g.createRadialGradient(-P * 0.3, -P * 0.3, P * 0.2, 0, 0, P);
    aba.addColorStop(0, '#ffffff');
    aba.addColorStop(0.85, '#f8f6f1');
    aba.addColorStop(1, '#e2ddd2');
    g.fillStyle = aba;
    g.fill();

    // filetes preto e amarelo na aba, como o selo do logo
    g.lineWidth = Math.max(1.5, P * 0.012);
    g.strokeStyle = '#171717';
    g.beginPath(); g.arc(0, 0, P * 0.925, 0, Math.PI * 2); g.stroke();
    g.lineWidth = Math.max(2, P * 0.016);
    g.strokeStyle = '#F3E75B';
    g.beginPath(); g.arc(0, 0, P * 0.895, 0, Math.PI * 2); g.stroke();

    // fundo do prato (côncavo)
    g.beginPath();
    g.arc(0, 0, P * 0.7, 0, Math.PI * 2);
    const fundo = g.createLinearGradient(-P * 0.7, -P * 0.7, P * 0.7, P * 0.7);
    fundo.addColorStop(0, '#ebe7de');
    fundo.addColorStop(0.45, '#faf8f3');
    fundo.addColorStop(1, '#ffffff');
    g.fillStyle = fundo;
    g.fill();
    g.lineWidth = P * 0.025;
    g.strokeStyle = 'rgba(160,145,115,0.18)';
    g.stroke();
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.arc(0, 0, P * 0.725, Math.PI * 0.1, Math.PI * 0.9); g.stroke();

    // brilho na louça
    g.lineCap = 'round';
    g.lineWidth = P * 0.03;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(0, 0, P * 0.81, Math.PI * 1.08, Math.PI * 1.32); g.stroke();
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(150,135,105,0.35)';
    g.beginPath(); g.arc(0, 0, P - 0.5, 0, Math.PI * 2); g.stroke();
    return c;
  }

  function criarSprites() {
    sprites = {};
    ITENS.forEach((it, i) => {
      const meio = it.raio * P * PORCAO + 6;
      const [c, g] = novaCamada(meio * 2, meio * 2);
      g.translate(meio, meio);
      g.scale(PORCAO, PORCAO);
      it.criar(g, semente(17 + i * 31));
      sprites[it.id] = { img: c, meio };
    });
  }

  /* ---------- servir e tirar ---------- */

  function alternar(id, presente) {
    const e = estado[id];
    if (!e || e.presente === presente) return;
    e.presente = presente;
    e.mudou = tempo;
    e.pousou = !presente;
    const botao = botoes.find((b) => b.dataset.item === id);
    if (botao) {
      botao.setAttribute('aria-pressed', String(presente));
      const icone = botao.querySelector('i');
      if (icone) icone.className = presente ? 'ph-bold ph-check' : 'ph-bold ph-plus';
    }
    if (movimentoReduzido.matches && !congelado) {
      e.mudou = -10;
      e.pousou = true;
      desenhar();
    } else {
      ligar();
    }
  }

  function espalharMigalhas(it) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, v = P * (0.25 + Math.random() * 0.5);
      migalhas.push({
        x: it.x * P + Math.cos(a) * it.raio * P * PORCAO * 0.55,
        y: it.y * P + Math.sin(a) * it.raio * P * PORCAO * 0.55,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        z: 0, vz: P * (0.3 + Math.random() * 0.5),
        tam: Math.max(1.2, P * (0.006 + Math.random() * 0.006)),
        cor: it.migalha, vida: 0, dur: 0.5 + Math.random() * 0.3
      });
    }
  }

  function atualizar(dt) {
    tempo += dt;

    // serviço automático na abertura, sem atropelar o que o visitante já escolheu
    ORDEM_SERVIR.forEach((id, i) => {
      const quando = 0.6 + i * 0.55;
      if (!tocados.has(id) && tempo - dt < quando && tempo >= quando) {
        tocados.add(id);
        alternar(id, true);
      }
    });

    ITENS.forEach((it) => {
      const e = estado[it.id];
      if (e.presente && !e.pousou && tempo - e.mudou >= DUR_SERVIR * 0.62) {
        e.pousou = true;
        espalharMigalhas(it);
      }
    });

    for (let i = migalhas.length - 1; i >= 0; i--) {
      const m = migalhas[i];
      m.vida += dt;
      if (m.vida >= m.dur) { migalhas.splice(i, 1); continue; }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vx *= 1 - 4 * dt;
      m.vy *= 1 - 4 * dt;
      m.vz -= P * 4 * dt;
      m.z += m.vz * dt;
      if (m.z < 0) { m.z = 0; m.vz *= -0.35; }
    }
  }

  function animando() {
    if (migalhas.length) return true;
    return ITENS.some((it) => {
      const e = estado[it.id];
      return tempo - e.mudou < (e.presente ? DUR_SERVIR : DUR_TIRAR);
    });
  }

  /* ---------- desenho ---------- */

  function desenharItem(g, it) {
    const e = estado[it.id];
    const dt = tempo - e.mudou;
    let escala = 1, alfa = 1, alt = 0, dy = 0;
    if (e.presente) {
      if (dt < DUR_SERVIR) {
        const u = dt / DUR_SERVIR;
        if (u < 0.62) {
          const q = u / 0.62;
          alt = 1 - q * q;
        } else {
          const v = (u - 0.62) / 0.38;
          escala = 1 - 0.05 * Math.sin(v * Math.PI) * (1 - v * 0.5);
        }
        escala *= 1 + 0.45 * alt;
        alfa = Math.min(1, u / 0.15);
        dy = -alt * P * 0.12;
      }
    } else {
      if (dt >= DUR_TIRAR) return;
      const u = dt / DUR_TIRAR;
      alt = u;
      escala = 1 + 0.35 * u;
      alfa = 1 - u;
      dy = -u * P * 0.1;
    }
    const s = sprites[it.id];
    g.save();
    g.translate(it.x * P, it.y * P + dy);
    g.rotate(it.giro);
    g.scale(escala, escala);
    g.globalAlpha = alfa;
    sombra(g, `rgba(70,50,15,${0.3 - alt * 0.12})`, 3 + alt * 24, 1.5 + alt * P * 0.1, 2.5 + alt * P * 0.16);
    g.drawImage(s.img, -s.meio, -s.meio, s.meio * 2, s.meio * 2);
    g.restore();
  }

  function desenhar() {
    if (!toalha) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(toalha, 0, 0, W, H);
    const balanco = movimentoReduzido.matches ? 0 : 0.04 * Math.sin((tempo / 11) * Math.PI * 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(balanco);
    const lado = pratoImg.width / DPR;
    ctx.drawImage(pratoImg, -lado / 2, -lado / 2, lado, lado);
    ITENS.forEach((it) => desenharItem(ctx, it));
    semSombra(ctx);
    for (const m of migalhas) {
      ctx.globalAlpha = 1 - m.vida / m.dur;
      ctx.fillStyle = m.cor;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y - m.z * 0.25, m.tam, m.tam * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ---------- tamanho e posição ---------- */

  function medir() {
    const r = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    if (W >= 900) {
      const texto = hero.querySelector('.hero-conteudo');
      const fim = texto ? texto.getBoundingClientRect().right - r.left : W * 0.45;
      const livre = W - fim;
      P = Math.max(110, Math.min(H * 0.27, livre * 0.3, 300));
      cx = fim + livre * 0.52;
      cy = H * 0.46;
    } else {
      const acoes = hero.querySelector('[data-fim-texto]');
      const fim = acoes ? acoes.getBoundingClientRect().bottom - r.top : H * 0.5;
      P = Math.min(W * 0.4, 200);
      cx = W / 2;
      cy = fim + P + 64;
    }
    hero.style.setProperty('--prato-x', `${Math.round(cx)}px`);
    hero.style.setProperty('--prato-y', `${Math.round(cy)}px`);
    hero.style.setProperty('--prato-r', `${Math.round(P)}px`);
    hero.classList.add('prato-pronto');

    toalha = criarToalha();
    pratoImg = criarPrato();
    criarSprites();
  }

  /* ---------- laço ---------- */

  function quadro(agora) {
    if (!rodando) return;
    const dt = Math.min(0.05, Math.max(0, (agora - ultimo) / 1000));
    ultimo = agora;
    atualizar(dt);
    // parado, só o balanço lento: 30 quadros por segundo bastam
    pulo = !pulo;
    if (animando() || !pulo) desenhar();
    idQuadro = requestAnimationFrame(quadro);
  }

  function ligar() {
    if (rodando || movimentoReduzido.matches || !emTela || congelado) return;
    rodando = true;
    ultimo = performance.now();
    idQuadro = requestAnimationFrame(quadro);
  }

  function desligar() {
    rodando = false;
    cancelAnimationFrame(idQuadro);
  }

  botoes.forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.item;
      tocados.add(id);
      alternar(id, !estado[id].presente);
    });
  });

  // ?quadro=1.4 congela a animação nesse segundo (para conferir cada fase).
  const quadroFixo = parseFloat(new URLSearchParams(location.search).get('quadro'));
  const congelado = Number.isFinite(quadroFixo);

  function simularAte(t) {
    tempo = 0;
    while (tempo < t) atualizar(Math.min(1 / 60, t - tempo));
  }

  let pedidoMedida = 0;
  function remedir() {
    cancelAnimationFrame(pedidoMedida);
    pedidoMedida = requestAnimationFrame(() => {
      medir();
      desenhar();
    });
  }

  medir();
  if (congelado) {
    simularAte(quadroFixo);
  } else if (movimentoReduzido.matches) {
    ORDEM_SERVIR.forEach((id) => { tocados.add(id); alternar(id, true); });
  }
  desenhar();
  ligar();

  if ('ResizeObserver' in window) new ResizeObserver(remedir).observe(hero);
  else window.addEventListener('resize', remedir);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remedir);

  new IntersectionObserver(([e]) => {
    emTela = e.isIntersecting;
    if (emTela) ligar();
    else desligar();
  }).observe(hero);
})();
