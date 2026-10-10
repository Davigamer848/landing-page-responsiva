/* Mario Restaurante: comportamento do site (WhatsApp, menu, revelar ao rolar, horário). */
(() => {
  'use strict';

  /* ---------- WhatsApp ----------
     Troque o número aqui: DDI 55 + DDD + número, só dígitos. */
  const WHATSAPP = '554136671607';
  const MENSAGEM = 'Olá! Vim pelo site do Mario Restaurante e gostaria de mais informações.';
  const linkWhats = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MENSAGEM)}`;
  document.querySelectorAll('[data-whatsapp]').forEach((a) => {
    a.href = linkWhats;
    a.target = '_blank';
    a.rel = 'noopener';
  });

  /* ---------- Topo e menu ---------- */
  const topo = document.querySelector('[data-topo]');
  const hero = document.querySelector('.hero');
  const menu = document.getElementById('menu');
  const botaoMenu = document.querySelector('.menu-botao');
  let noTopoDaPagina = true;

  const atualizarTopo = () => {
    topo.classList.toggle('solido', !noTopoDaPagina || menu.classList.contains('aberto'));
  };

  const alternarMenu = (abrir) => {
    menu.classList.toggle('aberto', abrir);
    botaoMenu.setAttribute('aria-expanded', String(abrir));
    botaoMenu.setAttribute('aria-label', abrir ? 'Fechar menu' : 'Abrir menu');
    botaoMenu.querySelector('i').className = abrir ? 'ph ph-x' : 'ph ph-list';
    atualizarTopo();
  };

  botaoMenu.addEventListener('click', () => alternarMenu(!menu.classList.contains('aberto')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) alternarMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('aberto')) {
      alternarMenu(false);
      botaoMenu.focus();
    }
  });

  // O topo fica sólido assim que a página rola um pouco.
  const sentinela = document.createElement('div');
  sentinela.setAttribute('aria-hidden', 'true');
  sentinela.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:12px;pointer-events:none;';
  document.body.prepend(sentinela);
  new IntersectionObserver(([e]) => {
    noTopoDaPagina = e.isIntersecting;
    atualizarTopo();
  }).observe(sentinela);

  // O botão flutuante do WhatsApp aparece depois do topo.
  new IntersectionObserver(([e]) => {
    document.body.classList.toggle('passou-hero', !e.isIntersecting);
  }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);

  /* ---------- Desenhos de comida flutuando no fundo ---------- */
  const ICONES = ['fork-knife', 'cooking-pot', 'chef-hat', 'bowl-food', 'carrot', 'pepper', 'egg', 'coffee',
    'cookie', 'orange-slice', 'bread', 'cheese', 'heart', 'pizza', 'fish', 'cake'];
  document.querySelectorAll('[data-rabiscos]').forEach((secao, s) => {
    const total = Number(secao.dataset.rabiscos) || 12;
    const colunas = 4, linhas = Math.ceil(total / colunas);
    const camada = document.createElement('div');
    camada.className = 'rabiscos';
    camada.setAttribute('aria-hidden', 'true');
    let n = 0;
    for (let l = 0; l < linhas; l++) {
      for (let c = 0; c < colunas && n < total; c++, n++) {
        // grade com sorteio dentro de cada célula, para espalhar sem amontoar
        const x = ((c + 0.15 + Math.random() * 0.7) / colunas) * 100;
        const y = ((l + 0.15 + Math.random() * 0.7) / linhas) * 100;
        const i = document.createElement('i');
        i.className = `ph ph-${ICONES[(n + s * 5) % ICONES.length]}`;
        i.style.cssText = [
          `left:${x.toFixed(1)}%`, `top:${y.toFixed(1)}%`,
          `font-size:${Math.round(34 + Math.random() * 42)}px`,
          `--giro:${Math.round(Math.random() * 60 - 30)}deg`,
          `--dur:${(3.5 + Math.random() * 4).toFixed(1)}s`,
          `--atraso:${(-Math.random() * 6).toFixed(1)}s`
        ].join(';');
        camada.appendChild(i);
      }
    }
    secao.prepend(camada);
  });

  // Os desenhos fogem um pouquinho do mouse (só em computador e sem movimento reduzido).
  if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const raiz = document.documentElement;
    let mx = 0, my = 0, pedido = 0;
    window.addEventListener('pointermove', (e) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
      if (!pedido) {
        pedido = requestAnimationFrame(() => {
          pedido = 0;
          raiz.style.setProperty('--mx', mx.toFixed(3));
          raiz.style.setProperty('--my', my.toFixed(3));
        });
      }
    }, { passive: true });
  }

  /* ---------- Frase principal palavra por palavra ---------- */
  document.querySelectorAll('[data-palavras]').forEach((el) => {
    let i = 0;
    const embrulhar = (no) => {
      Array.from(no.childNodes).forEach((filho) => {
        if (filho.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          filho.textContent.split(/(\s+)/).forEach((parte) => {
            if (!parte) return;
            if (/^\s+$/.test(parte)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'palavra';
            s.style.setProperty('--i', i++);
            s.textContent = parte;
            frag.appendChild(s);
          });
          filho.replaceWith(frag);
        } else if (filho.nodeType === Node.ELEMENT_NODE) {
          filho.classList.add('palavra');
          filho.style.setProperty('--i', i++);
        }
      });
    };
    embrulhar(el);
  });

  /* ---------- Revelar ao rolar ---------- */
  const revelar = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('visivel');
        revelar.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-revelar], [data-palavras]').forEach((el) => revelar.observe(el));

  /* ---------- Aberto agora? (horário de Brasília) ---------- */
  const status = document.querySelector('[data-status]');
  const statusTexto = document.querySelector('[data-status-texto]');
  const statusTitulo = document.querySelector('[data-status-titulo]');

  function atualizarStatus() {
    if (!status) return;
    let partes;
    try {
      partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
      }).formatToParts(new Date());
    } catch (e) { return; }
    const pegar = (tipo) => (partes.find((p) => p.type === tipo) || {}).value;
    const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(pegar('weekday'));
    const minutos = (Number(pegar('hour')) % 24) * 60 + Number(pegar('minute'));
    const ABRE = 11 * 60, FECHA = 15 * 60;
    const diaDeAbrir = dia >= 1 && dia <= 6;

    let aberto = false, texto;
    if (diaDeAbrir && minutos >= ABRE && minutos < FECHA) {
      aberto = true;
      texto = 'Até as 15h. Vem que tá quentinho!';
    } else if (diaDeAbrir && minutos < ABRE) {
      texto = 'Abrimos hoje às 11h';
    } else {
      texto = `Abrimos ${dia === 6 ? 'segunda' : 'amanhã'} às 11h`;
    }
    status.classList.toggle('aberto', aberto);
    statusTitulo.textContent = aberto ? 'Aberto' : 'Fechado';
    statusTexto.textContent = texto;
  }
  atualizarStatus();
  setInterval(atualizarStatus, 60 * 1000);

  /* ---------- Ano no rodapé ---------- */
  const ano = document.querySelector('[data-ano]');
  if (ano) ano.textContent = new Date().getFullYear();
})();
