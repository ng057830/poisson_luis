/* ============================================
   DISTRIBUCIÓN DE POISSON — SESIÓN 7
   Lógica interactiva, simulación animada y datos CSV
   ============================================ */

const CSV_COUNTS = {
  0: 1, 1: 4, 2: 5, 3: 9, 4: 14, 5: 13,
  6: 18, 7: 11, 8: 8, 9: 8, 10: 6, 11: 3
};

const CSV_RAW_CALLS = [
  3,7,6,8,6,7,5,3,7,7,6,3,5,9,4,4,5,2,2,3,
  8,4,10,9,7,9,4,8,6,5,7,6,4,10,5,2,5,6,8,6,
  3,9,3,1,1,5,6,8,7,7,6,2,6,4,11,9,6,4,8,1,
  3,4,6,4,1,5,5,4,5,5,6,0,6,4,6,10,10,4,9,4,
  5,9,7,9,6,3,7,7,11,6,10,5,10,4,2,6,11,3,8,8
];

const SCENARIOS = {
  ficha7: {
    r: 3.0, t: 2.0, op: 'eq', k: 5, unit: 'min', eventName: 'llamada', eventPlural: 'llamadas',
    enunciado: '<strong>📞 Ficha 7 (Centralita):</strong> Con una tasa de <strong>r = 3 llamadas/minuto</strong>, ¿qué probabilidad hay de recibir <strong>exactamente 5 llamadas en 2 minutos</strong>? (\\(\\lambda = 3 \\times 2 = 6\\)).'
  },
  cafe: {
    r: 2.5, t: 2.0, op: 'eq', k: 3, unit: 'min', eventName: 'pedido', eventPlural: 'pedidos',
    enunciado: '<strong>☕ Práctica (Cafetería):</strong> Llegan pedidos por app a una tasa de <strong>r = 2.5 pedidos/minuto</strong>. En un tramo de <strong>2 minutos</strong>, ¿cuál es la probabilidad de recibir <strong>exactamente 3 pedidos</strong>? (\\(\\lambda = 2.5 \\times 2 = 5\\)).'
  },
  server: {
    r: 2.0, t: 0.5, op: 'eq', k: 0, unit: 'h', eventName: 'fallo', eventPlural: 'fallos',
    enunciado: '<strong>🖥️ Ejercicio breve (Servidor):</strong> Un sistema registra una tasa de <strong>r = 2 fallos/hora</strong>. ¿Cuál es la probabilidad de tener <strong>0 fallos en media hora</strong> (\\(t = 0.5\\text{ h}\\))? (\\(\\lambda = 2 \\times 0.5 = 1\\)).'
  }
};

const state = {
  scenario: 'ficha7',
  r: 3.0,
  t: 2.0,
  op: 'eq',
  k: 5,
  simIntervals: 0,
  simCounts: {},
  simTotalEvents: 0,
  recentIntervals: [],
  showRealOverlay: true,
  showLhatOverlay: true,
  animating: false,
  stopRequested: false
};

// ============================================
// MATEMÁTICAS DE POISSON Y BINOMIAL
// ============================================

function factorial(n) {
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function poissonPMF(lambda, k) {
  if (k < 0) return 0;
  if (lambda === 0) return k === 0 ? 1 : 0;
  // Uso de logaritmos para evitar overflow en k! o lambda^k
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function binomPMF(n, k, p) {
  if (k < 0 || k > n) return 0;
  let logC = 0;
  const m = Math.min(k, n - k);
  for (let i = 1; i <= m; i++) {
    logC += Math.log(n - i + 1) - Math.log(i);
  }
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

function matchesCondition(x, op, k) {
  if (op === 'le') return x <= k;
  if (op === 'eq') return x === k;
  if (op === 'ge') return x >= k;
  return false;
}

function theoreticalConditionProb(lambda, op, k) {
  if (op === 'eq') return poissonPMF(lambda, k);
  let sumLe = 0;
  const limit = op === 'le' ? k : k - 1;
  for (let x = 0; x <= limit; x++) {
    sumLe += poissonPMF(lambda, x);
  }
  return op === 'le' ? sumLe : Math.max(0, 1 - sumLe);
}

function formatOpSymbol(op) {
  if (op === 'le') return '≤';
  if (op === 'eq') return '=';
  return '≥';
}

function samplePoisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function generateIntervalEvents(lambda, t) {
  const count = samplePoisson(lambda);
  const times = [];
  for (let i = 0; i < count; i++) {
    times.push(Math.random() * t);
  }
  times.sort((a, b) => a - b);
  return { count, times };
}

// ============================================
// PESTAÑAS Y KATEX
// ============================================

function renderMathIn(el) {
  if (typeof renderMathInElement === 'function' && el) {
    renderMathInElement(el, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  }
}

function initMath() {
  renderMathIn(document.body);
}

function setupTabs() {
  const buttons = document.querySelectorAll('.toggle-btn');
  const views = document.querySelectorAll('.view');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      buttons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      views.forEach((v) => v.classList.remove('active'));
      const activeView = document.getElementById(`view-${target}`);
      activeView.classList.add('active');

      if (target === 'data') renderDataChart();
      if (target === 'sim') renderSimChart();
      renderMathIn(activeView);
    });
  });
}

// ============================================
// SIMULADOR ANIMADO EN LÍNEA DE TIEMPO
// ============================================

function applyScenario(key) {
  const sc = SCENARIOS[key];
  if (!sc) return;
  state.scenario = key;
  state.r = sc.r;
  state.t = sc.t;
  state.op = sc.op;
  state.k = sc.k;

  document.querySelectorAll('.scenario-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.scenario === key);
  });

  document.getElementById('input-r').value = sc.r;
  document.getElementById('input-t').value = sc.t;
  document.getElementById('input-op').value = sc.op;
  document.getElementById('input-k').value = sc.k;

  const enEl = document.getElementById('sim-enunciado');
  enEl.innerHTML = sc.enunciado;
  renderMathIn(enEl);

  syncParamLabels();
  resetSimulation();
}

function syncParamLabels() {
  const sc = SCENARIOS[state.scenario];
  const lambda = state.r * state.t;
  document.getElementById('val-r').textContent = `${state.r.toFixed(1)} / ${sc.unit}`;
  document.getElementById('val-t').textContent = `${state.t.toFixed(1)} ${sc.unit}`;
  document.getElementById('val-lambda-inline').textContent = lambda.toFixed(2).replace(/\.00$/, '');
  document.getElementById('val-cond-label').textContent = `X ${formatOpSymbol(state.op)} ${state.k}`;
  document.getElementById('tl-mid').textContent = `${(state.t / 2).toFixed(2).replace(/\.00$/, '')}`;
  document.getElementById('tl-end').textContent = `${state.t.toFixed(1)} ${sc.unit}`;
}

function clearTimelineUI() {
  const track = document.getElementById('timeline-track');
  track.querySelectorAll('.event-marker').forEach((el) => el.remove());
  document.getElementById('timeline-sweep').style.width = '0%';
  document.getElementById('events-chips').innerHTML = '';
}

function addEventToTimeline(idx, timeVal) {
  const sc = SCENARIOS[state.scenario];
  const track = document.getElementById('timeline-track');
  const pct = Math.min(98, Math.max(2, (timeVal / state.t) * 100));

  const marker = document.createElement('div');
  marker.className = 'event-marker';
  marker.style.left = `${pct}%`;
  marker.textContent = idx + 1;
  marker.title = `${sc.eventName} #${idx + 1} en t = ${timeVal.toFixed(2)} ${sc.unit}`;
  track.appendChild(marker);

  const chips = document.getElementById('events-chips');
  const chip = document.createElement('span');
  chip.className = 'event-chip';
  chip.textContent = `#${idx + 1} (${timeVal.toFixed(2)} ${sc.unit})`;
  chips.appendChild(chip);
}

function recordInterval(count) {
  state.simIntervals += 1;
  state.simTotalEvents += count;
  state.simCounts[count] = (state.simCounts[count] || 0) + 1;
  state.recentIntervals.push({ num: state.simIntervals, count });
  if (state.recentIntervals.length > 24) state.recentIntervals.shift();
}

function renderIntervalHistory() {
  const wrap = document.getElementById('interval-history-wrap');
  const container = document.getElementById('interval-history');
  if (state.recentIntervals.length === 0) {
    wrap.hidden = true;
    container.innerHTML = '';
    return;
  }
  wrap.hidden = false;
  container.innerHTML = '';
  state.recentIntervals.forEach((item) => {
    const ok = matchesCondition(item.count, state.op, state.k);
    const pill = document.createElement('span');
    pill.className = `lot-pill ${ok ? 'ok' : 'fail'}`;
    pill.textContent = `#${item.num}: X=${item.count}`;
    container.appendChild(pill);
  });
}

function getMsPerInterval(amount, speed) {
  const baseMap = { 1: 900, 10: 320, 50: 130, 100: 85, 1000: 18 };
  const base = baseMap[amount] ?? 85;
  const mult = speed === 'slow' ? 2.0 : speed === 'fast' ? 0.35 : 1.0;
  return base * mult;
}

function runSimulation() {
  if (state.animating) return;
  const amount = parseInt(document.getElementById('sim-amount').value, 10);
  const speed = document.getElementById('sim-speed').value;
  const msPerInterval = getMsPerInterval(amount, speed);
  const lambda = state.r * state.t;
  const sc = SCENARIOS[state.scenario];

  state.animating = true;
  state.stopRequested = false;

  const btnRun = document.getElementById('btn-sim-run');
  const btnStop = document.getElementById('btn-sim-stop');
  const progressWrap = document.getElementById('sim-progress-wrap');
  const progressBar = document.getElementById('sim-progress-bar');
  const progressText = document.getElementById('sim-progress-text');
  const titleEl = document.getElementById('stage-interval-title');
  const badge = document.getElementById('interval-status-badge');
  const summary = document.getElementById('interval-summary');
  const sweepEl = document.getElementById('timeline-sweep');

  btnRun.disabled = true;
  btnStop.hidden = false;
  progressWrap.hidden = false;
  progressBar.style.width = '0%';
  progressText.textContent = `0 / ${amount} intervalos`;

  let doneIntervals = 0;
  let current = generateIntervalEvents(lambda, state.t);
  let revealedEvents = 0;
  let intervalElapsed = 0;
  let lastTime = performance.now();

  clearTimelineUI();
  titleEl.textContent = `Observando intervalo 1 de ${amount}…`;
  badge.className = 'lot-badge';
  badge.textContent = 'Midiendo intervalo…';

  const finish = (stoppedEarly) => {
    btnRun.disabled = false;
    btnStop.hidden = true;
    state.animating = false;
    state.stopRequested = false;
    titleEl.innerHTML = 'Último intervalo observado (\\([0, t]\\))';
    renderMathIn(titleEl);
    if (stoppedEarly) {
      badge.className = 'lot-badge';
      badge.textContent = `Detenido en ${doneIntervals} / ${amount} intervalos`;
    } else {
      progressBar.style.width = '100%';
      progressText.textContent = `${amount} / ${amount} intervalos`;
    }
  };

  const step = (now) => {
    if (state.stopRequested) {
      finish(true);
      return;
    }

    const dt = Math.min(80, now - lastTime);
    lastTime = now;
    intervalElapsed += dt;

    // Si msPerInterval es muy rápido (ej. 1000 intervalos), podemos completar varios en un frame
    while (doneIntervals < amount && intervalElapsed >= msPerInterval) {
      // Revelar los eventos restantes de este intervalo antes de cerrarlo
      while (revealedEvents < current.count) {
        addEventToTimeline(revealedEvents, current.times[revealedEvents]);
        revealedEvents++;
      }
      sweepEl.style.width = '100%';

      recordInterval(current.count);
      doneIntervals++;

      const ok = matchesCondition(current.count, state.op, state.k);
      badge.className = `lot-badge ${ok ? 'ok' : 'fail'}`;
      badge.textContent = `Intervalo #${state.simIntervals}: X = ${current.count} · ${ok ? 'Cumple' : 'No cumple'}`;
      summary.textContent = `En el intervalo #${state.simIntervals} ocurrieron ${current.count} ${current.count === 1 ? sc.eventName : sc.eventPlural}.`;

      intervalElapsed -= msPerInterval;
      if (doneIntervals < amount) {
        current = generateIntervalEvents(lambda, state.t);
        revealedEvents = 0;
        clearTimelineUI();
        titleEl.textContent = `Observando intervalo ${doneIntervals + 1} de ${amount}…`;
      }
    }

    // Animar el barrido dentro del intervalo actual
    if (doneIntervals < amount) {
      const frac = Math.min(1, intervalElapsed / msPerInterval);
      sweepEl.style.width = `${(frac * 100).toFixed(1)}%`;
      const currentTime = frac * state.t;
      while (revealedEvents < current.count && current.times[revealedEvents] <= currentTime) {
        addEventToTimeline(revealedEvents, current.times[revealedEvents]);
        revealedEvents++;
      }
    }

    if (doneIntervals > 0) {
      progressBar.style.width = `${((doneIntervals / amount) * 100).toFixed(1)}%`;
      progressText.textContent = `${doneIntervals} / ${amount} intervalos`;
      updateSimStats();
      renderIntervalHistory();
      renderSimChart();
    }

    if (doneIntervals < amount) {
      requestAnimationFrame(step);
    } else {
      finish(false);
    }
  };

  requestAnimationFrame(step);
}

function resetSimulation() {
  state.stopRequested = true;
  state.simIntervals = 0;
  state.simCounts = {};
  state.simTotalEvents = 0;
  state.recentIntervals = [];
  document.getElementById('sim-progress-wrap').hidden = true;
  document.getElementById('stage-interval-title').innerHTML = 'Intervalo en observación (\\([0, t]\\))';
  renderMathIn(document.getElementById('stage-interval-title'));
  clearTimelineUI();
  renderIntervalHistory();
  const badge = document.getElementById('interval-status-badge');
  badge.className = 'lot-badge';
  badge.textContent = 'Esperando simulación...';
  document.getElementById('interval-summary').textContent = 'Pulsa Simular Intervalos para ver llegar los sucesos en el intervalo de tiempo.';
  updateSimStats();
  renderSimChart();
}

function updateSimStats() {
  const lambda = state.r * state.t;
  const theoProb = theoreticalConditionProb(lambda, state.op, state.k);
  const sc = SCENARIOS[state.scenario];

  document.getElementById('theo-prob').textContent = `${(theoProb * 100).toFixed(2)} %`;
  document.getElementById('theo-formula-desc').textContent = `P(X ${formatOpSymbol(state.op)} ${state.k}) con λ = ${lambda.toFixed(2)}`;
  document.getElementById('theo-mean').textContent = lambda.toFixed(2);
  document.getElementById('theo-var').textContent = lambda.toFixed(2);

  if (state.simIntervals === 0) {
    document.getElementById('sim-prob').textContent = '—';
    document.getElementById('sim-count-desc').textContent = '0 intervalos cumplen la condición de 0 simulados';
    document.getElementById('sim-mean').textContent = '—';
    document.getElementById('sim-rhat').textContent = '—';
  } else {
    let favorable = 0;
    for (const [kStr, count] of Object.entries(state.simCounts)) {
      if (matchesCondition(parseInt(kStr, 10), state.op, state.k)) {
        favorable += count;
      }
    }
    const simProb = (favorable / state.simIntervals) * 100;
    const simMean = state.simTotalEvents / state.simIntervals;
    const simRhat = simMean / state.t;

    document.getElementById('sim-prob').textContent = `${simProb.toFixed(2)} %`;
    document.getElementById('sim-count-desc').textContent = `${favorable} intervalos cumplen la condición de ${state.simIntervals} simulados`;
    document.getElementById('sim-mean').textContent = simMean.toFixed(3);
    document.getElementById('sim-rhat').textContent = `${simRhat.toFixed(3)} / ${sc.unit}`;
  }
}

// ============================================
// GRÁFICOS SVG INTERACTIVOS
// ============================================

function showTooltip(evt, html) {
  const tt = document.getElementById('chart-tooltip');
  tt.innerHTML = html;
  tt.hidden = false;
  tt.style.left = `${Math.min(window.innerWidth - 230, evt.clientX + 12)}px`;
  tt.style.top = `${Math.max(10, evt.clientY - 40)}px`;
}

function hideTooltip() {
  document.getElementById('chart-tooltip').hidden = true;
}

function buildGroupedBarSVG({ maxK, series, highlightCond = null }) {
  const width = 760;
  const height = 290;
  const padL = 48;
  const padR = 16;
  const padT = 20;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  let maxY = 0.05;
  for (let k = 0; k <= maxK; k++) {
    series.forEach((s) => {
      if (s.values[k] > maxY) maxY = s.values[k];
    });
  }
  maxY = Math.ceil(maxY * 10) / 10;
  if (maxY < 0.2) maxY = 0.2;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'chart-svg');

  for (let i = 0; i <= 4; i++) {
    const val = (maxY * i) / 4;
    const y = padT + plotH - (val / maxY) * plotH;

    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', padL);
    line.setAttribute('x2', width - padR);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(28,27,24,0.1)');
    line.setAttribute('stroke-dasharray', i === 0 ? '' : '3,3');
    svg.appendChild(line);

    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', padL - 8);
    lbl.setAttribute('y', y + 4);
    lbl.setAttribute('text-anchor', 'end');
    lbl.setAttribute('font-size', '11');
    lbl.setAttribute('fill', '#6B6A66');
    lbl.textContent = `${(val * 100).toFixed(0)}%`;
    svg.appendChild(lbl);
  }

  const groupW = plotW / (maxK + 1);
  const activeCount = series.length;
  const barW = Math.max(5, Math.min(18, (groupW * 0.76) / activeCount));
  const totalBarsW = barW * activeCount + (activeCount - 1) * 2;

  for (let k = 0; k <= maxK; k++) {
    const gx = padL + k * groupW;

    if (highlightCond && highlightCond(k)) {
      const bg = document.createElementNS(ns, 'rect');
      bg.setAttribute('x', gx + 2);
      bg.setAttribute('y', padT);
      bg.setAttribute('width', groupW - 4);
      bg.setAttribute('height', plotH);
      bg.setAttribute('fill', 'rgba(24, 95, 165, 0.08)');
      bg.setAttribute('rx', '4');
      svg.appendChild(bg);
    }

    const startX = gx + (groupW - totalBarsW) / 2;
    series.forEach((s, idx) => {
      const val = s.values[k] || 0;
      const barH = (val / maxY) * plotH;
      const bx = startX + idx * (barW + 2);
      const by = padT + plotH - barH;

      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', bx);
      rect.setAttribute('y', by);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', Math.max(1, barH));
      rect.setAttribute('fill', s.color);
      rect.setAttribute('rx', '2');
      rect.style.cursor = 'pointer';

      rect.addEventListener('mousemove', (evt) => {
        const lines = series
          .map((item) => `<span style="color:${item.lightColor || '#fff'}">● ${item.label}:</span> <strong>${((item.values[k] || 0) * 100).toFixed(2)}%</strong>`)
          .join('<br>');
        showTooltip(evt, `<strong>X = ${k} suceso${k === 1 ? '' : 's'}</strong><br>${lines}`);
      });
      rect.addEventListener('mouseleave', hideTooltip);
      svg.appendChild(rect);
    });

    const xLbl = document.createElementNS(ns, 'text');
    xLbl.setAttribute('x', gx + groupW / 2);
    xLbl.setAttribute('y', height - 16);
    xLbl.setAttribute('text-anchor', 'middle');
    xLbl.setAttribute('font-size', '11');
    xLbl.setAttribute('font-weight', highlightCond && highlightCond(k) ? '700' : '400');
    xLbl.setAttribute('fill', highlightCond && highlightCond(k) ? '#185FA5' : '#6B6A66');
    xLbl.textContent = k;
    svg.appendChild(xLbl);
  }

  const axisTitle = document.createElementNS(ns, 'text');
  axisTitle.setAttribute('x', padL + plotW / 2);
  axisTitle.setAttribute('y', height - 2);
  axisTitle.setAttribute('text-anchor', 'middle');
  axisTitle.setAttribute('font-size', '11');
  axisTitle.setAttribute('fill', '#6B6A66');
  axisTitle.textContent = 'Número de sucesos en el intervalo (k)';
  svg.appendChild(axisTitle);

  return svg;
}

function renderSimChart() {
  const wrapper = document.getElementById('sim-chart-wrapper');
  wrapper.innerHTML = '';

  const lambda = state.r * state.t;
  const maxK = Math.max(12, state.k + 2, Math.ceil(lambda + 3.5 * Math.sqrt(Math.max(1, lambda))));

  const theoVals = {};
  const simVals = {};
  const realVals = {};

  for (let k = 0; k <= maxK; k++) {
    theoVals[k] = poissonPMF(lambda, k);
    simVals[k] = state.simIntervals > 0 ? (state.simCounts[k] || 0) / state.simIntervals : 0;
    realVals[k] = (CSV_COUNTS[k] || 0) / 100;
  }

  const series = [
    { label: `Teórica Poisson(${lambda.toFixed(1)})`, color: '#185FA5', lightColor: '#7cb8f7', values: theoVals },
    { label: 'Simulada', color: '#639922', lightColor: '#a3d962', values: simVals }
  ];

  if (state.showRealOverlay) {
    series.push({ label: 'CSV Ficha 7 (100)', color: '#8B5CF6', lightColor: '#c4b5fd', values: realVals });
  }

  wrapper.appendChild(
    buildGroupedBarSVG({
      maxK,
      series,
      highlightCond: (k) => matchesCondition(k, state.op, state.k)
    })
  );
}

function renderDataChart() {
  const wrapper = document.getElementById('data-chart-wrapper');
  wrapper.innerHTML = '';

  const maxK = 12;
  const theoVals = {};
  const realVals = {};
  const lhatVals = {};

  for (let k = 0; k <= maxK; k++) {
    theoVals[k] = poissonPMF(6, k);
    realVals[k] = (CSV_COUNTS[k] || 0) / 100;
    lhatVals[k] = poissonPMF(5.76, k);
  }

  const series = [
    { label: 'Teórica (λ=6)', color: '#185FA5', lightColor: '#7cb8f7', values: theoVals },
    { label: 'Observada (CSV)', color: '#8B5CF6', lightColor: '#c4b5fd', values: realVals }
  ];

  if (state.showLhatOverlay) {
    series.push({ label: 'Ajustada (λ̂=5.76)', color: '#D97706', lightColor: '#fcd34d', values: lhatVals });
  }

  wrapper.appendChild(
    buildGroupedBarSVG({
      maxK,
      series,
      highlightCond: (k) => k === 5
    })
  );
}

// ============================================
// TEORÍA: EXPLORADOR DE LÍMITE BINOMIAL -> POISSON
// ============================================

function setupTheoryExplorer() {
  const slider = document.getElementById('explorer-m');
  const valLabel = document.getElementById('explorer-m-val');
  const resultBox = document.getElementById('explorer-m-result');
  const exactPoisson = poissonPMF(6, 5);

  const update = () => {
    const m = parseInt(slider.value, 10);
    const p = 6 / m;
    const binProb = binomPMF(m, 5, p);
    const diff = Math.abs(binProb - exactPoisson);

    valLabel.textContent = `m = ${m}`;
    resultBox.innerHTML = `
      <div>Con \\(m = ${m}\\) y \\(p = \\frac{6}{${m}} = ${p.toFixed(4)}\\):</div>
      <div style="margin-top:0.4rem;">
        Binomial \\(B(${m}, ${p.toFixed(4)}) \\Rightarrow P(X=5) =\\) <strong>${binProb.toFixed(5)}</strong>
        · Poisson(\\(6\\)): <strong>${exactPoisson.toFixed(5)}</strong>
        · Diferencia: <span style="color:var(--primary);">${diff.toFixed(5)}</span>
      </div>
    `;
    renderMathIn(resultBox);
  };

  slider.addEventListener('input', update);
  update();
}

// ============================================
// DATOS FICHA 7: TABLA Y DESCARGA CSV
// ============================================

function setupDataTab() {
  const tbody = document.getElementById('csv-freq-tbody');
  for (let k = 0; k <= 11; k++) {
    const obs = CSV_COUNTS[k] || 0;
    const exp = (poissonPMF(6, k) * 100).toFixed(2);
    const tr = document.createElement('tr');
    if (k === 5) tr.className = 'row-highlight';
    tr.innerHTML = `
      <td><strong>${k}</strong></td>
      <td>${obs}</td>
      <td>${obs}%</td>
      <td>${exp}</td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('toggle-lhat-overlay').addEventListener('change', (e) => {
    state.showLhatOverlay = e.target.checked;
    document.getElementById('legend-lhat').style.display = state.showLhatOverlay ? 'inline-flex' : 'none';
    renderDataChart();
  });

  document.getElementById('btn-download-csv').addEventListener('click', () => {
    const rows = ['id_obs,minutos,llamadas'];
    CSV_RAW_CALLS.forEach((calls, idx) => {
      rows.push(`${idx + 1},2,${calls}`);
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sesion_07_datos.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ============================================
// QUIZ DE REPASO (SESIÓN 7)
// ============================================

const QUIZ_DATA = [
  {
    q: '1. Si una centralita recibe \\(r = 3\\) llamadas/minuto y observamos un intervalo de \\(t = 2\\) minutos, ¿qué valor de \\(\\lambda\\) debemos usar?',
    options: ['\\(\\lambda = 3\\)', '\\(\\lambda = 1.5\\)', '\\(\\lambda = 6\\)'],
    correct: 2,
    explanation: 'Correcto: \\(\\lambda = r \\cdot t = 3 \\times 2 = 6\\). Nunca se usa la tasa por minuto sin ajustarla a la duración del intervalo.'
  },
  {
    q: '2. ¿Se mantiene el mismo parámetro \\(\\lambda\\) si duplicamos la duración del intervalo de observación?',
    options: [
      'Sí, porque la tasa r es constante',
      'No, con tasa constante duplicar la duración duplica λ',
      'Solo cambia la varianza, pero la media sigue igual'
    ],
    correct: 1,
    explanation: 'Como \\(\\lambda = r \\cdot t\\), al duplicar \\(t\\) con tasa constante se duplica el número esperado de sucesos.'
  },
  {
    q: '3. En el ejercicio breve de la Ficha 7 (\\(r = 2\\) fallos/hora, \\(t = 0.5\\) horas), ¿cuánto vale \\(P(X = 0)\\)?',
    options: ['\\(e^{-1} \\approx 0.3679\\)', '\\(e^{-2} \\approx 0.1353\\)', '\\(0.5\\)'],
    correct: 0,
    explanation: '\\(\\lambda = 2(0.5) = 1\\). Como \\(0! = 1\\) y \\(1^0 = 1\\), resulta \\(P(X=0) = e^{-1} \\approx 0.3679\\).'
  },
  {
    q: '4. ¿Es necesario que la media muestral (5.760) y la varianza muestral (6.528) del CSV coincidan exactamente?',
    options: [
      'Sí, si no coinciden el modelo de Poisson es imposible',
      'No: la igualdad E[X] = Var(X) = λ es poblacional; en una muestra finita varían'
    ],
    correct: 1,
    explanation: 'Exacto: la igualdad \\(\\operatorname{E}[X] = \\operatorname{Var}(X) = \\lambda\\) es una propiedad del modelo teórico, pero en 100 observaciones ambas estimaciones fluctúan.'
  },
  {
    q: '5. En el ejercicio aplicado de la cafetería (\\(r = 2.5\\) pedidos/min en \\(t = 2\\) min), ¿cuál es el valor de \\(\\lambda\\)?',
    options: ['2.5', '5', '1.25'],
    correct: 1,
    explanation: '\\(\\lambda = r \\cdot t = 2.5 \\times 2 = 5\\) pedidos esperados en el intervalo de 2 minutos.'
  }
];

function setupQuiz() {
  const listEl = document.getElementById('quiz-list');
  const scoreEl = document.getElementById('quiz-score');
  let answered = {};

  const renderQuiz = () => {
    answered = {};
    scoreEl.textContent = `Puntuación: 0 / ${QUIZ_DATA.length}`;
    listEl.innerHTML = '';

    QUIZ_DATA.forEach((item, qIdx) => {
      const card = document.createElement('div');
      card.className = 'quiz-item';

      const qTitle = document.createElement('div');
      qTitle.className = 'quiz-q';
      qTitle.innerHTML = item.q;
      card.appendChild(qTitle);

      const optsDiv = document.createElement('div');
      optsDiv.className = 'quiz-options';

      const fb = document.createElement('div');
      fb.className = 'quiz-feedback';

      item.options.forEach((optText, oIdx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt';
        btn.innerHTML = optText;
        btn.addEventListener('click', () => {
          if (answered[qIdx] !== undefined) return;
          answered[qIdx] = oIdx === item.correct;

          const allBtns = optsDiv.querySelectorAll('.quiz-opt');
          allBtns.forEach((b, i) => {
            b.disabled = true;
            if (i === item.correct) b.classList.add('correct');
            else if (i === oIdx) b.classList.add('wrong');
          });

          fb.className = `quiz-feedback show ${oIdx === item.correct ? 'ok' : 'bad'}`;
          fb.innerHTML = item.explanation;
          renderMathIn(fb);

          const totalOk = Object.values(answered).filter(Boolean).length;
          scoreEl.textContent = `Puntuación: ${totalOk} / ${QUIZ_DATA.length}`;
        });
        optsDiv.appendChild(btn);
      });

      card.appendChild(optsDiv);
      card.appendChild(fb);
      listEl.appendChild(card);
    });

    renderMathIn(listEl);
  };

  document.getElementById('btn-quiz-reset').addEventListener('click', renderQuiz);
  renderQuiz();
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();

  document.querySelectorAll('.scenario-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyScenario(btn.dataset.scenario));
  });

  document.getElementById('btn-load-cafe').addEventListener('click', () => {
    applyScenario('cafe');
    document.querySelector('.toggle-btn[data-tab="sim"]').click();
  });

  document.getElementById('input-r').addEventListener('input', (e) => {
    state.r = parseFloat(e.target.value);
    syncParamLabels();
    resetSimulation();
  });

  document.getElementById('input-t').addEventListener('input', (e) => {
    state.t = parseFloat(e.target.value);
    syncParamLabels();
    resetSimulation();
  });

  document.getElementById('input-op').addEventListener('change', (e) => {
    state.op = e.target.value;
    syncParamLabels();
    updateSimStats();
    renderIntervalHistory();
    renderSimChart();
  });

  document.getElementById('input-k').addEventListener('input', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = 0;
    state.k = Math.max(0, Math.min(25, val));
    syncParamLabels();
    updateSimStats();
    renderIntervalHistory();
    renderSimChart();
  });

  document.getElementById('toggle-real-overlay').addEventListener('change', (e) => {
    state.showRealOverlay = e.target.checked;
    document.getElementById('legend-real').style.display = state.showRealOverlay ? 'inline-flex' : 'none';
    renderSimChart();
  });

  document.getElementById('btn-sim-run').addEventListener('click', runSimulation);
  document.getElementById('btn-sim-stop').addEventListener('click', () => {
    state.stopRequested = true;
  });
  document.getElementById('btn-sim-reset').addEventListener('click', resetSimulation);

  setupTheoryExplorer();
  setupDataTab();
  setupQuiz();
  applyScenario('ficha7');
  renderDataChart();
  initMath();
});
