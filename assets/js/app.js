import { SEASON_OPTIONS, loadPlayers } from "./seasons.js";

/* =======================
   ELEMENTS
======================= */
const elSeason = document.getElementById("seasonSelect");
const elSubtitle = document.getElementById("subtitle");

// HOME
const elKpiGoals = document.getElementById("kpiGoals");
const elKpiPres = document.getElementById("kpiPres");
const elHighlights = document.getElementById("highlights"); // opcional

// Lists
const elListGols = document.getElementById("listGols");
const elListPres = document.getElementById("listPres");
const elCountGols = document.getElementById("countGols");
const elCountPres = document.getElementById("countPres");

// Jogadores
const elPlayerSelect = document.getElementById("playerSelect");
const elPlayerImg = document.getElementById("playerImg");
const elPlayerName = document.getElementById("playerName");
const elPlayerMeta = document.getElementById("playerMeta");
const elListPlayers = document.getElementById("listPlayers");

// Pages
const PAGES = ["home", "gols", "presencas", "jogadores"];
const pageEls = Object.fromEntries(PAGES.map((p) => [p, document.getElementById(`page-${p}`)]));

// Nav
const navButtons = Array.from(document.querySelectorAll(".navBtn"));

// Chart IDs (precisam existir no index.html)
const CHART_IDS = {
  homeGoals: "chartHomeGoals",
  homeGks: "chartHomeGks",
  scatter: "chartScatter",
  homePres: "chartHomePres",
  gols: "chartGols",
  pres: "chartAssiduos",
  radar: "chartRadar",
};

/* =======================
   STATE
======================= */
let currentPlayers = [];
let currentPage = "home";

/* =======================
   HELPERS
======================= */
function normText(v) {
  return String(v ?? "").trim();
}

function normPos(pos) {
  return normText(pos).toUpperCase();
}

function isGoleiro(p) {
  return normPos(p?.Posicao) === "GOL";
}

function isValidPlayer(p) {
  if (!p) return false;
  const nome = normText(p.Nome);
  if (!nome) return false;

  const pres = Number(p.Presencas || 0);
  const gols = Number(p.Gols || 0);
  const attrsSum = [p.Ritmo, p.Finalizacao, p.Passe, p.Drible, p.Defesa, p.Fisico]
    .map((x) => Number(x) || 0)
    .reduce((a, b) => a + b, 0);

  // remove linha “fantasma”
  if (pres === 0 && gols === 0 && attrsSum === 0) return false;
  return true;
}

function slugifyName(name) {
  return normText(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function playerImgSrc(name) {
  return `images/${slugifyName(name)}.png`;
}

function rating(p) {
  const attrs = [p.Ritmo, p.Finalizacao, p.Passe, p.Drible, p.Defesa, p.Fisico].map((x) => Number(x) || 0);
  const valid = attrs.filter((x) => x > 0);
  if (!valid.length) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function exists(id) {
  const el = document.getElementById(id);
  return !!el && el instanceof Element;
}

function isVisible(id) {
  const el = document.getElementById(id);
  if (!el || !(el instanceof Element)) return false;
  // hidden via tailwind "hidden" or not in layout
  if (el.closest(".hidden")) return false;
  if (getComputedStyle(el).display === "none") return false;
  return true;
}

/* =======================
   NAV / PAGES
======================= */
function setOptions() {
  elSeason.innerHTML = SEASON_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
  const saved = localStorage.getItem("pelada:v2:selectedSeason");
  if (saved && SEASON_OPTIONS.some((o) => o.value === saved)) elSeason.value = saved;
}

function getSelectedLabel() {
  return SEASON_OPTIONS.find((o) => o.value === elSeason.value)?.label || "";
}

function setActiveNav(page) {
  navButtons.forEach((btn) => {
    const active = btn.dataset.page === page;
    btn.classList.toggle("active", active);
  });
}

function setActivePage(page) {
  const p = PAGES.includes(page) ? page : "home";
  currentPage = p;

  for (const k of PAGES) {
    pageEls[k]?.classList.toggle("hidden", k !== p);
  }

  setActiveNav(p);

  if (location.hash !== `#${p}`) history.replaceState(null, "", `#${p}`);

  // amCharts: render somente quando visível
  renderPageCharts(p);
}

/* =======================
   AMCHARTS ROOTS (central)
======================= */
const rootsById = new Map();

function disposeChart(id) {
  const r = rootsById.get(id);
  if (r) {
    try {
      r.dispose();
    } catch {}
    rootsById.delete(id);
  }
}

function disposeAllCharts() {
  for (const id of rootsById.keys()) disposeChart(id);
}

// cria root garantindo que não existe root antigo no mesmo DOM
function createRoot(id) {
  disposeChart(id);
  // amCharts recomenda limpar o container quando teve crash anterior
  const el = document.getElementById(id);
  if (el) el.innerHTML = "";
  const r = am5.Root.new(id);
  rootsById.set(id, r);
  return r;
}

/* =======================
   RENDER: HOME (KPIs)
======================= */
function renderHome(players) {
  const totalGoals = players.reduce((s, p) => s + (p.Gols || 0), 0);
  const totalPres = players.reduce((s, p) => s + (p.Presencas || 0), 0);

  if (elKpiGoals) elKpiGoals.textContent = String(totalGoals);
  if (elKpiPres) elKpiPres.textContent = String(totalPres);

  if (elHighlights) {
    const topScorer = [...players].filter((p) => !isGoleiro(p)).sort((a, b) => (b.Gols || 0) - (a.Gols || 0))[0];
    const topPres = [...players].sort((a, b) => (b.Presencas || 0) - (a.Presencas || 0))[0];

    elHighlights.innerHTML = `
      <div class="flex flex-col gap-1">
        <div>⚽ <b>Artilheiro:</b> ${topScorer?.Nome || "—"} (${topScorer?.Gols || 0})</div>
        <div>📅 <b>Mais presente:</b> ${topPres?.Nome || "—"} (${topPres?.Presencas || 0})</div>
      </div>
    `;
  }
}

/* =======================
   LIST ROWS (3 modos)
   - "gols": mostra só gols (no lugar do rating)
   - "pres": mostra só presenças (no lugar do rating)
   - "players": mostra só rating (no lugar do rating)
======================= */
function listRow(p, rank, mode) {
  const img = playerImgSrc(p.Nome);

  const rightLabel =
    mode === "gols" ? "Gols" : mode === "pres" ? "Pres" : "Rating";

  const rightValue =
    mode === "gols" ? (p.Gols || 0) :
    mode === "pres" ? (p.Presencas || 0) :
    rating(p);

  // linha de meta do card (compacta)
  const meta =
    mode === "players"
      ? `Pos: <b>${p.Posicao || "—"}</b>`
      : `Pos: <b>${p.Posicao || "—"}</b>`;

  return `
    <button class="w-full text-left bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex items-center gap-3" data-player="${encodeURIComponent(p.Nome)}">
      <div class="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700">${rank}</div>
      <img src="${img}" onerror="this.style.display='none'" class="w-10 h-10 rounded-2xl bg-slate-100 object-cover border border-slate-200" alt="" />
      <div class="min-w-0 flex-1">
        <div class="font-semibold truncate">${p.Nome}</div>
        <div class="text-xs text-slate-500 mt-0.5">${meta}</div>
      </div>
      <div class="text-right">
        <div class="text-[11px] text-slate-500">${rightLabel}</div>
        <div class="text-lg font-bold">${rightValue}</div>
      </div>
    </button>
  `;
}

/* =======================
   RENDER: LISTS
======================= */
function renderLists(players) {
  // Página GOLS: excluir goleiros
  if (elListGols && elCountGols) {
    const sortedG = [...players]
      .filter((p) => !isGoleiro(p))
      .sort(
        (a, b) =>
          (b.Gols || 0) - (a.Gols || 0) ||
          (b.Presencas || 0) - (a.Presencas || 0) ||
          a.Nome.localeCompare(b.Nome, "pt-BR")
      );

    elCountGols.textContent = `${sortedG.length} jogadores`;
    elListGols.innerHTML = sortedG.map((p, i) => listRow(p, i + 1, "gols")).join("");
  }

  // Página PRESENÇAS: todos
  if (elListPres && elCountPres) {
    const sortedP = [...players].sort(
      (a, b) =>
        (b.Presencas || 0) - (a.Presencas || 0) ||
        (b.Gols || 0) - (a.Gols || 0) ||
        a.Nome.localeCompare(b.Nome, "pt-BR")
    );

    elCountPres.textContent = `${sortedP.length} jogadores`;
    elListPres.innerHTML = sortedP.map((p, i) => listRow(p, i + 1, "pres")).join("");
  }
}

/* =======================
   RENDER: JOGADORES PAGE
======================= */
function renderPlayersPage(players) {
  if (!elPlayerSelect || !elListPlayers) return;

  const sorted = [...players].sort((a, b) => a.Nome.localeCompare(b.Nome, "pt-BR"));
  elPlayerSelect.innerHTML = sorted.map((p) => `<option value="${encodeURIComponent(p.Nome)}">${p.Nome}</option>`).join("");

  const saved = localStorage.getItem("pelada:v2:selectedPlayer");
  if (saved && sorted.some((p) => p.Nome === saved)) {
    elPlayerSelect.value = encodeURIComponent(saved);
  }

  // ✅ cards da lista: somente Rating no lado direito
  elListPlayers.innerHTML = sorted
    .map((p, i) => {
      const html = listRow(p, i + 1, "players");
      // troca data attr p/ data-pick (para manter seu wire)
      return html.replace('data-player="', 'data-pick="');
    })
    .join("");

  const first = sorted[0];
  if (first) selectPlayer(first.Nome);
}

function selectPlayer(name) {
  const p = currentPlayers.find((x) => x.Nome === name);
  if (!p) return;

  localStorage.setItem("pelada:v2:selectedPlayer", name);
  if (elPlayerSelect) elPlayerSelect.value = encodeURIComponent(name);

  if (elPlayerImg) elPlayerImg.src = playerImgSrc(p.Nome);
  if (elPlayerName) elPlayerName.textContent = p.Nome;

  const isGK = isGoleiro(p);
  // goleiro: gols = DD (na sua regra atual)
  const dd = p.Gols || 0;

  if (elPlayerMeta) {
    elPlayerMeta.textContent = isGK
      ? `Pos: ${p.Posicao || "—"} • Pres: ${p.Presencas || 0} • DD: ${dd} • Rating: ${rating(p)}`
      : `Pos: ${p.Posicao || "—"} • Pres: ${p.Presencas || 0} • Gols: ${p.Gols || 0} • Rating: ${rating(p)}`;
  }

  // radar só faz sentido na aba jogadores e com container visível
  if (currentPage === "jogadores") {
    requestAnimationFrame(() => renderRadar(p));
  }
}

/* =========================
   CHARTS
========================= */
function renderBarWithPhotos(targetId, data) {
  if (!exists(targetId) || !isVisible(targetId)) return;

  let root;
  try {
    root = createRoot(targetId);
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 20,
        paddingRight: 20,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "name",
        renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 30 }),
      })
    );
    xAxis.get("renderer").grid.template.set("visible", false);
    xAxis.get("renderer").labels.template.setAll({
      dy: 0,
      paddingTop: 40,
      fontSize: 13,
      fill: am5.color(0x000000),
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, { min: 0, renderer: am5xy.AxisRendererY.new(root, {}) })
    );
    yAxis.get("renderer").grid.template.set("visible", false);
    yAxis.set("visible", false);
    yAxis.set("extraMax", 0.15);

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        valueYField: "value",
        categoryXField: "name",
        sequencedInterpolation: true,
        calculateAggregates: true,
        maskBullets: false,
      })
    );

    series.columns.template.setAll({
      strokeOpacity: 0,
      cornerRadiusTL: 10,
      cornerRadiusTR: 10,
      maxWidth: 50,
      fillOpacity: 0.9,
    });

    const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
    cursor.lineX.set("visible", false);
    cursor.lineY.set("visible", false);

    const circleTemplate = am5.Template.new({});

    // foto
    series.bullets.push(() => {
      const container = am5.Container.new(root, {});
      container.children.push(am5.Circle.new(root, { radius: 34 }, circleTemplate));
      const mask = am5.Circle.new(root, { radius: 27 });
      container.children.push(mask);

      const imageContainer = am5.Container.new(root, { mask });
      imageContainer.children.push(
        am5.Picture.new(root, {
          templateField: "pictureSettings",
          centerX: am5.p50,
          centerY: am5.p50,
          width: 45,
          height: 60,
        })
      );
      container.children.push(imageContainer);
      return am5.Bullet.new(root, { locationY: 0, sprite: container });
    });

    // número
    series.bullets.push(() => {
      return am5.Bullet.new(root, {
        locationY: 1,
        sprite: am5.Label.new(root, {
          text: "{valueY}",
          populateText: true,
          fontSize: 18,
          fontWeight: "bold",
          fill: am5.color(0x000000),
          centerX: am5.p50,
          centerY: am5.bottom,
          dy: -35,
        }),
      });
    });

    series.set("heatRules", [
      {
        target: series.columns.template,
        key: "fill",
        dataField: "valueY",
        min: am5.color(0xadd8e6),
        max: am5.color(0x003366),
        minOpacity: 0.4,
        maxOpacity: 0.9,
      },
      {
        target: circleTemplate,
        key: "fill",
        dataField: "valueY",
        min: am5.color(0xadd8e6),
        max: am5.color(0x003366),
        minOpacity: 0.4,
        maxOpacity: 0.9,
      },
    ]);

    const dataMapped = data.map((d) => ({
      name: d.name,
      value: d.value,
      pictureSettings: { src: playerImgSrc(d.name) },
    }));

    series.data.setAll(dataMapped);
    xAxis.data.setAll(dataMapped);

    series.appear();
    chart.appear(500, 40);
  } catch (e) {
    console.error("Chart error:", targetId, e);
    disposeChart(targetId);
    throw e;
  }
}

/* ---------- HOME CHARTS ---------- */
function renderHomeTopCharts(players) {
  // ⚽ Top 5 gols (sem goleiros)
  const topGoals = [...players]
    .filter((p) => !isGoleiro(p))
    .filter((p) => (p.Gols || 0) > 0)
    .sort((a, b) => (b.Gols || 0) - (a.Gols || 0))
    .slice(0, 5)
    .map((p) => ({ name: p.Nome, value: p.Gols || 0 }));

  // 🧤 Top 3 muralhas (goleiros) — usa Gols (que são DD na sua regra)
  const topGks = [...players]
    .filter((p) => isGoleiro(p))
    .filter((p) => (p.Gols || 0) > 0)
    .sort((a, b) => (b.Gols || 0) - (a.Gols || 0))
    .slice(0, 3)
    .map((p) => ({ name: p.Nome, value: p.Gols || 0 }));

  // 📅 Top 5 presenças
  const topPres = [...players]
    .filter((p) => (p.Presencas || 0) > 0)
    .sort((a, b) => (b.Presencas || 0) - (a.Presencas || 0))
    .slice(0, 5)
    .map((p) => ({ name: p.Nome, value: p.Presencas || 0 }));

  renderBarWithPhotos(CHART_IDS.homeGoals, topGoals);
  renderBarWithPhotos(CHART_IDS.homeGks, topGks);
  renderBarWithPhotos(CHART_IDS.homePres, topPres);
}

/* ---------- GOLS TAB CHART ---------- */
function renderGolsChart(players) {
  const top = [...players]
    .filter((p) => !isGoleiro(p))
    .filter((p) => (p.Gols || 0) > 0)
    .sort((a, b) => (b.Gols || 0) - (a.Gols || 0))
    .slice(0, 7)
    .map((p) => ({ name: p.Nome, value: p.Gols || 0 }));

  renderBarWithPhotos(CHART_IDS.gols, top);
}

/* ---------- PRES TAB CHART ---------- */
function renderPresChart(players) {
  const top = [...players]
    .filter((p) => (p.Presencas || 0) > 0)
    .sort((a, b) => (b.Presencas || 0) - (a.Presencas || 0))
    .slice(0, 7)
    .map((p) => ({ name: p.Nome, value: p.Presencas || 0 }));

  renderBarWithPhotos(CHART_IDS.pres, top);
}

/* ---------- SCATTER (Eficiência) ---------- */
function renderScatter(players) {
  const id = CHART_IDS.scatter;
  if (!exists(id) || !isVisible(id)) return;

  // top10 por gols/pres (sem goleiros)
  const points = [...players]
    .filter((p) => !isGoleiro(p))
    .filter((p) => Number(p.Presencas || 0) > 0)
    .map((p) => {
      const pres = Number(p.Presencas || 0);
      const gols = Number(p.Gols || 0);
      const y = pres > 0 ? gols / pres : 0; // gols por partida
      return { name: p.Nome, x: pres, y, gols };
    })
    .filter((pt) => Number.isFinite(pt.y))
    .sort((a, b) => b.y - a.y)
    .slice(0, 10);

  if (!points.length) {
    disposeChart(id);
    return;
  }

  // ---- escala de tamanho do bullet (proporcional a y) ----
  const ys = points.map((p) => p.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const MIN_R = 5;   // raio mínimo
  const MAX_R = 14;  // raio máximo

  function radiusFor(y) {
    if (yMax === yMin) return (MIN_R + MAX_R) / 2; // todos iguais
    const t = (y - yMin) / (yMax - yMin);          // 0..1
    return MIN_R + t * (MAX_R - MIN_R);
  }

  try {
    const root = createRoot(id);
    root.setThemes([am5themes_Animated.new(root)]);

    // ✅ fundo transparente (root)
    root.container.set("background", am5.Rectangle.new(root, { fillOpacity: 0 }));

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 10,
      })
    );

    // ✅ fundo transparente (área do plot)
    chart.plotContainer.set("background", am5.Rectangle.new(root, { fillOpacity: 0 }));

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: am5xy.AxisRendererX.new(root, {}),
      })
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: am5xy.AxisRendererY.new(root, {}),
      })
    );

    // remover grid (linhas) e ticks
    xAxis.get("renderer").grid.template.setAll({ visible: false });
    yAxis.get("renderer").grid.template.setAll({ visible: false });

    // opcional: remover ticks (marquinhas)
    xAxis.get("renderer").ticks.template.setAll({ visible: false });
    yAxis.get("renderer").ticks.template.setAll({ visible: false });

    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        xAxis,
        yAxis,
        valueXField: "x",
        valueYField: "y",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{name}\nPres: {x}\nGols: {gols}\nG/Partida: {y.formatNumber('0.00')}",
        }),
      })
    );

    // scatter: sem linha
    series.strokes.template.set("visible", false);

    // ✅ bullets com raio proporcional à eficiência (y)
    series.bullets.push(() => {
      const circle = am5.Circle.new(root, {
        fill: am5.color(0x2563eb),
        fillOpacity: 0.9,
        strokeOpacity: 0,
      });

      // usa o item atual pra definir o raio dinamicamente
      circle.adapters.add("radius", (radius, target) => {
        const item = target.dataItem;
        const y = item?.dataContext?.y;
        if (typeof y !== "number") return MIN_R;
        return radiusFor(y);
      });

      return am5.Bullet.new(root, { sprite: circle });
    });

    series.data.setAll(points);

    const cursor = chart.set("cursor", am5xy.XYCursor.new(root, { xAxis, yAxis }));
    cursor.lineX.set("visible", false);
    cursor.lineY.set("visible", false);

    chart.appear(500, 40);
  } catch (e) {
    console.error("Scatter error:", e);
    disposeChart(id);
    throw e;
  }
}

/* ---------- RADAR ---------- */
function renderRadar(p) {
  const id = CHART_IDS.radar;
  if (!exists(id) || !isVisible(id)) return;

  // goleiro pode ter atributos 0; ainda assim renderiza (fica “baixinho”)
  const categories = [
    { category: "Ritmo", value: Number(p.Ritmo || 0) },
    { category: "Finalização", value: Number(p.Finalizacao || 0) },
    { category: "Passe", value: Number(p.Passe || 0) },
    { category: "Drible", value: Number(p.Drible || 0) },
    { category: "Defesa", value: Number(p.Defesa || 0) },
    { category: "Físico", value: Number(p.Fisico || 0) },
  ];

  let root;
  try {
    root = createRoot(id);
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5radar.RadarChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        innerRadius: am5.percent(20),
      })
    );

    const xAxis = chart.xAxes.push(
      am5radar.CategoryAxis.new(root, {
        categoryField: "category",
        renderer: am5radar.AxisRendererCircular.new(root, {}),
      })
    );
    xAxis.data.setAll(categories);

    const yAxis = chart.yAxes.push(
      am5radar.ValueAxis.new(root, {
        min: 0,
        max: 100,
        strictMinMax: true,
        renderer: am5radar.AxisRendererRadial.new(root, {}),
      })
    );

    const series = chart.series.push(
      am5radar.RadarLineSeries.new(root, {
        xAxis,
        yAxis,
        valueYField: "value",
        categoryXField: "category",
        strokeWidth: 2,
        fillOpacity: 0.15,
      })
    );
    series.data.setAll(categories);

    series.bullets.push(() =>
      am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, { radius: 4, fillOpacity: 0.9 }),
      })
    );

    chart.appear(500, 40);
  } catch (e) {
    console.error("Radar error:", e);
    disposeChart(id);
    throw e;
  }
}

/* =======================
   PAGE CHARTS RENDER (ACTIVE)
======================= */
function renderPageCharts(page) {
  if (!currentPlayers.length) return;

  // limpa charts de páginas que saíram de cena (evita multi-root em SPA)
  // (mantemos só o necessário visível)
  const visibleIds = new Set();
  if (page === "home") {
    visibleIds.add(CHART_IDS.homeGoals);
    visibleIds.add(CHART_IDS.homeGks);
    visibleIds.add(CHART_IDS.scatter);
    visibleIds.add(CHART_IDS.homePres);
  } else if (page === "gols") {
    visibleIds.add(CHART_IDS.gols);
  } else if (page === "presencas") {
    visibleIds.add(CHART_IDS.pres);
  } else if (page === "jogadores") {
    visibleIds.add(CHART_IDS.radar);
  }

  for (const id of Array.from(rootsById.keys())) {
    if (!visibleIds.has(id)) disposeChart(id);
  }

  if (page === "home") {
    renderHomeTopCharts(currentPlayers);
    renderScatter(currentPlayers);
  }

  if (page === "gols") {
    renderGolsChart(currentPlayers);
  }

  if (page === "presencas") {
    renderPresChart(currentPlayers);
  }

  if (page === "jogadores") {
    const saved = localStorage.getItem("pelada:v2:selectedPlayer");
    const name = saved && currentPlayers.some((pp) => pp.Nome === saved) ? saved : currentPlayers[0]?.Nome;
    if (name) {
      selectPlayer(name);
      const pp = currentPlayers.find((x) => x.Nome === name);
      if (pp) requestAnimationFrame(() => renderRadar(pp));
    }
  }
}

/* =======================
   WIRES
======================= */
function wireListClicks() {
  // listas de gols/pres -> abrir jogador
  for (const container of [elListGols, elListPres]) {
    if (!container) continue;
    container.querySelectorAll("button[data-player]").forEach((btn) => {
      btn.onclick = () => {
        const name = decodeURIComponent(btn.dataset.player);
        setActivePage("jogadores");
        selectPlayer(name);
      };
    });
  }

  // lista de jogadores -> selecionar
  if (elListPlayers) {
    elListPlayers.querySelectorAll("button[data-pick]").forEach((btn) => {
      btn.onclick = () => {
        const name = decodeURIComponent(btn.dataset.pick);
        selectPlayer(name);
        document.getElementById("page-jogadores")?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
  }
}

/* =======================
   LOAD + REFRESH
======================= */
async function refreshAll() {
  const optionValue = elSeason.value;
  localStorage.setItem("pelada:v2:selectedSeason", optionValue);
  if (elSubtitle) elSubtitle.textContent = "Carregando...";

  try {
    const playersRaw = await loadPlayers(optionValue);
    const players = (playersRaw || []).filter(isValidPlayer);
    currentPlayers = players;

    if (elSubtitle) elSubtitle.textContent = getSelectedLabel();

    renderHome(players);
    renderLists(players);
    renderPlayersPage(players);

    renderPageCharts(currentPage);
    wireListClicks();
  } catch (err) {
    console.error(err);
    if (elSubtitle) elSubtitle.textContent = "Erro ao carregar";
    alert(`Não consegui carregar a planilha.\n\nDetalhe: ${String(err?.message || err)}`);
  }
}

/* =======================
   EVENTS
======================= */
navButtons.forEach((btn) => {
  btn.addEventListener("click", () => setActivePage(btn.dataset.page));
});

window.addEventListener("hashchange", () => {
  const page = location.hash.replace("#", "");
  setActivePage(page || "home");
});

elSeason.addEventListener("change", () => {
  // temporada mudou: melhor descartar tudo para evitar roots “zumbis”
  disposeAllCharts();
  refreshAll();
});

if (elPlayerSelect) {
  elPlayerSelect.addEventListener("change", () => {
    const name = decodeURIComponent(elPlayerSelect.value);
    selectPlayer(name);
  });
}

/* =======================
   INIT
======================= */
setOptions();
setActivePage(location.hash.replace("#", "") || "home");
refreshAll();
