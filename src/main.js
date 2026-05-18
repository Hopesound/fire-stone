import { DEFAULTS, KOREA_BBOX, RISK_LABELS, TYPE_LABELS } from "./config.js";
import { heritageSites } from "./data/heritage-sites.js";
import { buildSampleDetections } from "./data/sample-firms.js";
import { fetchFirmsArea } from "./services/firms-api.js";
import { getManagementRecord, saveManagementRecord } from "./services/storage.js";
import { formatAcqTime, getDateKeys, parseDate, toDateInput } from "./utils/date.js";
import {
  aggregateDaily,
  analyzeHeritageRisk,
  buildAlertCandidates,
  buildHotspotAreas,
  filterDetections
} from "./analysis/risk-engine.js";

export function createFireStoneApp() {
  const state = {
    rangeDays: DEFAULTS.rangeDays,
    minConfidence: DEFAULTS.confidence,
    radiusKm: DEFAULTS.radiusKm,
    mediumThreshold: DEFAULTS.mediumThreshold,
    highThreshold: DEFAULTS.highThreshold,
    source: DEFAULTS.source,
    categoryFilter: new Set(["temple", "heritage", "house"]),
    riskFilter: "all",
    selectedSiteId: null,
    detections: [],
    usingLiveData: false
  };

  const elements = collectElements();
  const mapState = initMap();

  elements.endDate.value = toDateInput(new Date());
  state.detections = buildSampleDetections({ endDate: dateFromInput(elements), source: state.source });
  bindEvents({ state, elements, mapState });
  renderAll({ state, elements, mapState });
}

function collectElements() {
  return {
    endDate: document.getElementById("endDate"),
    sourceSelect: document.getElementById("sourceSelect"),
    confidenceRange: document.getElementById("confidenceRange"),
    confidenceValue: document.getElementById("confidenceValue"),
    radiusRange: document.getElementById("radiusRange"),
    radiusValue: document.getElementById("radiusValue"),
    mediumThreshold: document.getElementById("mediumThreshold"),
    highThreshold: document.getElementById("highThreshold"),
    mapKey: document.getElementById("mapKey"),
    loadSample: document.getElementById("loadSample"),
    loadFirms: document.getElementById("loadFirms"),
    dataStatus: document.getElementById("dataStatus"),
    metricDetections: document.getElementById("metricDetections"),
    metricRiskScore: document.getElementById("metricRiskScore"),
    metricAtRisk: document.getElementById("metricAtRisk"),
    metricAlerts: document.getElementById("metricAlerts"),
    dailyChart: document.getElementById("dailyChart"),
    alertList: document.getElementById("alertList"),
    heritageList: document.getElementById("heritageList"),
    exportCsv: document.getElementById("exportCsv"),
    detailEmpty: document.getElementById("detailEmpty"),
    detailContent: document.getElementById("detailContent"),
    detailRegion: document.getElementById("detailRegion"),
    detailName: document.getElementById("detailName"),
    detailRisk: document.getElementById("detailRisk"),
    detailScore: document.getElementById("detailScore"),
    detailCount: document.getElementById("detailCount"),
    detailFrp: document.getElementById("detailFrp"),
    detailDistance: document.getElementById("detailDistance"),
    managementStatus: document.getElementById("managementStatus"),
    managementNote: document.getElementById("managementNote"),
    saveManagement: document.getElementById("saveManagement"),
    historyTimeline: document.getElementById("historyTimeline")
  };
}

function initMap() {
  const map = L.map("map", {
    zoomControl: false,
    preferCanvas: true
  }).setView([36.15, 128.05], 7);

  L.control.zoom({ position: "topright" }).addTo(map);

  const baseLayers = {
    street: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors"
    }),
    imagery: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
      }
    )
  };
  let activeBaseLayer = baseLayers.street.addTo(map);

  L.control.layers(
    {
      일반지도: baseLayers.street,
      항공사진: baseLayers.imagery
    },
    null,
    { position: "topright", collapsed: true }
  ).addTo(map);

  const layers = {
    heritage: L.layerGroup().addTo(map),
    detection: L.layerGroup().addTo(map),
    area: L.layerGroup().addTo(map),
    radius: L.layerGroup().addTo(map)
  };

  function setBaseLayer(type) {
    const nextLayer = baseLayers[type] || baseLayers.street;
    if (activeBaseLayer === nextLayer) {
      return;
    }
    map.removeLayer(activeBaseLayer);
    activeBaseLayer = nextLayer.addTo(map);
    syncBaseButtons(type);
  }

  document.querySelectorAll(".basemap-button").forEach((button) => {
    button.addEventListener("click", () => setBaseLayer(button.dataset.basemap));
  });

  map.on("baselayerchange", (event) => {
    const type = event.name === "항공사진" ? "imagery" : "street";
    activeBaseLayer = baseLayers[type];
    syncBaseButtons(type);
  });

  return { map, layers };
}

function syncBaseButtons(type) {
  document.querySelectorAll(".basemap-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.basemap === type);
  });
}

function bindEvents({ state, elements, mapState }) {
  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segment").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      state.rangeDays = Number(button.dataset.range);
      if (!state.usingLiveData) {
        state.detections = buildSampleDetections({ endDate: dateFromInput(elements), source: state.source });
      }
      renderAll({ state, elements, mapState });
    });
  });

  elements.endDate.addEventListener("change", () => {
    if (!state.usingLiveData) {
      state.detections = buildSampleDetections({ endDate: dateFromInput(elements), source: state.source });
    }
    renderAll({ state, elements, mapState });
  });

  elements.sourceSelect.addEventListener("change", () => {
    state.source = elements.sourceSelect.value;
    if (!state.usingLiveData) {
      state.detections = buildSampleDetections({ endDate: dateFromInput(elements), source: state.source });
    } else {
      elements.dataStatus.textContent = "센서를 변경했습니다. 최신 결과는 FIRMS 불러오기로 다시 조회하세요.";
    }
    renderAll({ state, elements, mapState });
  });

  elements.confidenceRange.addEventListener("input", () => {
    state.minConfidence = Number(elements.confidenceRange.value);
    elements.confidenceValue.textContent = state.minConfidence;
    renderAll({ state, elements, mapState });
  });

  elements.radiusRange.addEventListener("input", () => {
    state.radiusKm = Number(elements.radiusRange.value);
    elements.radiusValue.textContent = `${state.radiusKm} km`;
    renderAll({ state, elements, mapState });
  });

  [elements.mediumThreshold, elements.highThreshold].forEach((input) => {
    input.addEventListener("input", () => {
      state.mediumThreshold = Number(elements.mediumThreshold.value || DEFAULTS.mediumThreshold);
      state.highThreshold = Number(elements.highThreshold.value || DEFAULTS.highThreshold);
      renderAll({ state, elements, mapState });
    });
  });

  document.querySelectorAll(".check-row input").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.categoryFilter.add(checkbox.value);
      } else {
        state.categoryFilter.delete(checkbox.value);
      }
      renderAll({ state, elements, mapState });
    });
  });

  document.querySelectorAll(".risk-chip").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".risk-chip").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      state.riskFilter = button.dataset.risk;
      renderAll({ state, elements, mapState });
    });
  });

  elements.loadSample.addEventListener("click", () => {
    state.usingLiveData = false;
    state.detections = buildSampleDetections({ endDate: dateFromInput(elements), source: state.source });
    elements.dataStatus.textContent = "샘플 데이터가 표시됩니다.";
    renderAll({ state, elements, mapState });
  });

  elements.loadFirms.addEventListener("click", async () => {
    await loadLiveFirms({ state, elements, mapState });
  });

  elements.exportCsv.addEventListener("click", () => {
    exportCurrentCsv({ state, elements });
  });

  elements.saveManagement.addEventListener("click", () => {
    if (!state.selectedSiteId) {
      return;
    }
    saveManagementRecord(state.selectedSiteId, elements.managementStatus.value, elements.managementNote.value);
    elements.dataStatus.textContent = "관리 상태와 메모를 저장했습니다.";
    renderAll({ state, elements, mapState });
  });
}

async function loadLiveFirms({ state, elements, mapState }) {
  const mapKey = elements.mapKey.value.trim();
  if (!mapKey) {
    elements.dataStatus.textContent = "FIRMS MAP_KEY를 입력하거나 샘플 데이터를 사용하세요.";
    return;
  }

  elements.dataStatus.textContent = "FIRMS 데이터를 불러오는 중입니다.";
  elements.loadFirms.disabled = true;

  try {
    const detections = await fetchFirmsArea({
      mapKey,
      source: state.source,
      bbox: KOREA_BBOX,
      endDate: dateFromInput(elements),
      rangeDays: state.rangeDays
    });
    state.usingLiveData = true;
    state.detections = detections;
    elements.dataStatus.textContent = `${detections.length.toLocaleString("ko-KR")}개 FIRMS 픽셀을 불러왔습니다.`;
    renderAll({ state, elements, mapState });
  } catch (error) {
    elements.dataStatus.textContent = `FIRMS 불러오기 실패: ${error.message}`;
  } finally {
    elements.loadFirms.disabled = false;
  }
}

function renderAll({ state, elements, mapState }) {
  const filteredSites = heritageSites.filter((site) => state.categoryFilter.has(site.type));
  const dateKeys = getDateKeys(dateFromInput(elements), state.rangeDays);
  const filteredDetections = filterDetections(state.detections, {
    dateKeys,
    minConfidence: state.minConfidence,
    source: state.source
  });
  const summaries = analyzeHeritageRisk(filteredSites, filteredDetections, {
    radiusKm: state.radiusKm,
    mediumThreshold: state.mediumThreshold,
    highThreshold: state.highThreshold,
    getStoredRecord: getManagementRecord
  });
  const hotspots = buildHotspotAreas(filteredDetections);
  const alerts = buildAlertCandidates(summaries);
  const daily = aggregateDaily(dateKeys, filteredDetections, summaries);

  renderMap({ state, mapState, sites: filteredSites, detections: filteredDetections, summaries, hotspots });
  renderMetrics({ elements, detections: filteredDetections, summaries, alerts });
  renderDailyChart(elements.dailyChart, daily);
  renderAlerts({ state, elements, mapState, alerts, summaries });
  renderHeritageList({ state, elements, summaries, mapState });
  renderSelectedDetail({ state, elements, summaries });
}

function renderMap({ state, mapState, sites, detections, summaries, hotspots }) {
  const { map, layers } = mapState;
  layers.heritage.clearLayers();
  layers.detection.clearLayers();
  layers.area.clearLayers();
  layers.radius.clearLayers();

  hotspots.forEach((hotspot) => {
    L.circle([hotspot.lat, hotspot.lng], {
      radius: hotspot.radiusKm * 1000,
      color: "#c94a35",
      weight: 1,
      opacity: 0.7,
      fillColor: "#c94a35",
      fillOpacity: 0.19
    })
      .bindPopup(
        `<h3 class="popup-title">핫스팟 면적</h3>
         <p class="popup-line">${hotspot.count}개 픽셀, 약 ${hotspot.areaKm2.toFixed(1)} km²</p>
         <p class="popup-line">최대 FRP ${hotspot.maxFrp.toFixed(1)} MW</p>`
      )
      .addTo(layers.area);
  });

  detections.forEach((detection) => {
    const radius = Math.max(5, Math.min(16, 4 + detection.frp / 2));
    L.circleMarker([detection.lat, detection.lng], {
      radius,
      color: "#8d2418",
      weight: 1,
      opacity: 0.88,
      fillColor: "#c94a35",
      fillOpacity: 0.68
    })
      .bindPopup(
        `<h3 class="popup-title">FIRMS 활성 화재 픽셀</h3>
         <p class="popup-line">${detection.acqDate} ${formatAcqTime(detection.acqTime)}</p>
         <p class="popup-line">신뢰도 ${detection.confidence}, FRP ${detection.frp.toFixed(1)} MW</p>
         <p class="popup-line">밝기 ${Number(detection.brightnessKelvin || 0).toFixed(1)} K</p>`
      )
      .addTo(layers.detection);
  });

  sites.forEach((site) => {
    const summary = summaries.find((item) => item.site.id === site.id);
    L.circle([site.lat, site.lng], {
      radius: state.radiusKm * 1000,
      color: "#31755b",
      weight: 1,
      opacity: 0.4,
      fillColor: "#31755b",
      fillOpacity: 0.05
    }).addTo(layers.radius);

    const marker = L.marker([site.lat, site.lng], {
      icon: createHeritageIcon(site, summary)
    })
      .bindPopup(
        `<h3 class="popup-title">${site.name}</h3>
         <p class="popup-line">${TYPE_LABELS[site.type]} · ${site.region}</p>
         <p class="popup-line">위험 점수 ${summary ? summary.riskScore.toFixed(1) : "0.0"}</p>`
      )
      .addTo(layers.heritage);

    marker.on("click", () => {
      state.selectedSiteId = site.id;
      renderSelectedDetail({ state, elements: collectElements(), summaries });
      map.setView([site.lat, site.lng], Math.max(map.getZoom(), 10), { animate: true });
    });
  });
}

function createHeritageIcon(site, summary) {
  const letter = site.type === "temple" ? "寺" : site.type === "house" ? "古" : "文";
  const riskClass = summary ? summary.risk : "low";
  return L.divIcon({
    className: "",
    html: `<div class="heritage-marker ${site.type} risk-${riskClass}">${letter}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14]
  });
}

function renderMetrics({ elements, detections, summaries, alerts }) {
  const totalScore = summaries.reduce((sum, summary) => sum + summary.riskScore, 0);
  const atRisk = summaries.filter((summary) => summary.risk !== "low").length;
  elements.metricDetections.textContent = detections.length.toLocaleString("ko-KR");
  elements.metricRiskScore.textContent = totalScore.toFixed(1);
  elements.metricAtRisk.textContent = atRisk.toLocaleString("ko-KR");
  elements.metricAlerts.textContent = alerts.length.toLocaleString("ko-KR");
}

function renderDailyChart(container, daily) {
  const maxCount = Math.max(1, ...daily.map((item) => item.count));
  const maxScore = Math.max(1, ...daily.map((item) => item.cumulativeScore));
  const width = Math.max(760, daily.length * 74);
  const height = 235;
  const chartTop = 20;
  const chartBottom = 190;
  const chartHeight = chartBottom - chartTop;
  const step = width / daily.length;
  const barWidth = Math.min(34, step * 0.42);
  const scorePoints = daily
    .map((item, index) => {
      const x = step * index + step / 2;
      const y = chartBottom - (item.cumulativeScore / maxScore) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const bars = daily
    .map((item, index) => {
      const x = step * index + step / 2 - barWidth / 2;
      const barHeight = (item.count / maxCount) * chartHeight;
      const y = chartBottom - barHeight;
      return `
        <g>
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="#c94a35"></rect>
          <text x="${x + barWidth / 2}" y="${Math.max(15, y - 6)}" text-anchor="middle" font-size="11" font-weight="800" fill="#1f2522">${item.count}</text>
          <text x="${x + barWidth / 2}" y="214" text-anchor="middle" font-size="11" fill="#677069">${item.key.slice(5)}</text>
          <text x="${x + barWidth / 2}" y="230" text-anchor="middle" font-size="10" fill="#31755b">${item.cumulativeScore.toFixed(0)}</text>
        </g>
      `;
    })
    .join("");

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="일별 감지 수와 누적 위험 점수">
      <line x1="0" y1="${chartBottom}" x2="${width}" y2="${chartBottom}" stroke="#ded8cc"></line>
      <line x1="0" y1="${chartTop}" x2="${width}" y2="${chartTop}" stroke="#eee8dc"></line>
      ${bars}
      <polyline points="${scorePoints}" fill="none" stroke="#31755b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
      ${daily
        .map((item, index) => {
          const x = step * index + step / 2;
          const y = chartBottom - (item.cumulativeScore / maxScore) * chartHeight;
          return `<circle cx="${x}" cy="${y}" r="4" fill="#31755b"></circle>`;
        })
        .join("")}
      <text x="0" y="12" font-size="11" font-weight="800" fill="#c94a35">일별 픽셀</text>
      <text x="70" y="12" font-size="11" font-weight="800" fill="#31755b">누적 위험 점수</text>
    </svg>
  `;
}

function renderAlerts({ state, elements, mapState, alerts, summaries }) {
  if (!alerts.length) {
    elements.alertList.innerHTML = `<div class="empty-alert">주의 이상 문화유산이 없습니다.</div>`;
    return;
  }

  elements.alertList.innerHTML = alerts
    .slice(0, 6)
    .map((summary) => {
      const last = summary.nearby[0];
      return `
        <button class="alert-item" type="button" data-site-id="${summary.site.id}">
          <span class="risk-badge ${summary.risk}">${RISK_LABELS[summary.risk]}</span>
          <strong>${summary.site.name}</strong>
          <small>점수 ${summary.riskScore.toFixed(1)} · ${summary.nearby.length}개 픽셀 · 최근 ${last ? last.acqDate : "-"}</small>
        </button>
      `;
    })
    .join("");

  elements.alertList.querySelectorAll(".alert-item").forEach((button) => {
    button.addEventListener("click", () => {
      const summary = summaries.find((item) => item.site.id === button.dataset.siteId);
      if (!summary) {
        return;
      }
      state.selectedSiteId = summary.site.id;
      renderSelectedDetail({ state, elements, summaries });
      mapState.map.setView([summary.site.lat, summary.site.lng], Math.max(mapState.map.getZoom(), 10), {
        animate: true
      });
    });
  });
}

function renderHeritageList({ state, elements, summaries, mapState }) {
  const filtered = summaries
    .filter((summary) => state.riskFilter === "all" || summary.risk === state.riskFilter)
    .sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      return riskOrder[a.risk] - riskOrder[b.risk] || b.riskScore - a.riskScore;
    });

  if (!filtered.length) {
    elements.heritageList.innerHTML = `<div class="empty-state">조건에 맞는 문화유산이 없습니다.</div>`;
    return;
  }

  elements.heritageList.innerHTML = filtered
    .map((summary) => {
      const site = summary.site;
      const selectedClass = state.selectedSiteId === site.id ? " is-selected" : "";
      return `
        <button class="heritage-card${selectedClass}" type="button" data-site-id="${site.id}">
          <span class="heritage-card-top">
            <span>
              <strong>${site.name}</strong>
              <small>${TYPE_LABELS[site.type]} · ${site.region} · ${site.manager}</small>
            </span>
            <span class="risk-badge ${summary.risk}">${RISK_LABELS[summary.risk]}</span>
          </span>
          <span class="heritage-card-meta">
            <span class="meta-pill">점수 ${summary.riskScore.toFixed(1)}</span>
            <span class="meta-pill">FRP ${summary.frpSum.toFixed(1)} MW</span>
            <span class="meta-pill">${summary.status}</span>
          </span>
        </button>
      `;
    })
    .join("");

  elements.heritageList.querySelectorAll(".heritage-card").forEach((card) => {
    card.addEventListener("click", () => {
      const summary = summaries.find((item) => item.site.id === card.dataset.siteId);
      state.selectedSiteId = card.dataset.siteId;
      renderSelectedDetail({ state, elements, summaries });
      if (summary) {
        mapState.map.setView([summary.site.lat, summary.site.lng], Math.max(mapState.map.getZoom(), 10), {
          animate: true
        });
      }
    });
  });
}

function renderSelectedDetail({ state, elements, summaries }) {
  const summary =
    summaries.find((item) => item.site.id === state.selectedSiteId) ||
    summaries.find((item) => item.risk === "high") ||
    summaries[0];

  if (!summary) {
    elements.detailEmpty.classList.remove("is-hidden");
    elements.detailContent.classList.add("is-hidden");
    return;
  }

  state.selectedSiteId = summary.site.id;
  elements.detailEmpty.classList.add("is-hidden");
  elements.detailContent.classList.remove("is-hidden");
  elements.detailRegion.textContent = `${TYPE_LABELS[summary.site.type]} · ${summary.site.region} · 등재 ${summary.site.inscriptionYear || "-"}`;
  elements.detailName.textContent = summary.site.name;
  elements.detailRisk.textContent = RISK_LABELS[summary.risk];
  elements.detailRisk.className = `risk-badge ${summary.risk}`;
  elements.detailScore.textContent = summary.riskScore.toFixed(1);
  elements.detailCount.textContent = summary.nearby.length;
  elements.detailFrp.textContent = `${summary.frpSum.toFixed(1)} MW`;
  elements.detailDistance.textContent = summary.closest === null ? "-" : `${summary.closest.toFixed(1)} km`;
  elements.managementStatus.value = summary.status;
  elements.managementNote.value = summary.note;

  if (!summary.nearby.length) {
    elements.historyTimeline.innerHTML = `<div class="empty-state">선택 기간 반경 내 활성 화재 픽셀이 없습니다.</div>`;
    return;
  }

  elements.historyTimeline.innerHTML = summary.nearby
    .map((detection) => {
      return `
        <div class="timeline-item">
          <strong>${detection.acqDate} ${formatAcqTime(detection.acqTime)} · ${detection.weightedFrp.toFixed(1)}점</strong>
          <small>${detection.distanceKm.toFixed(1)} km · 가중치 ${detection.weight.toFixed(2)} · FRP ${detection.frp.toFixed(1)} MW · 밝기 ${Number(detection.brightnessKelvin || 0).toFixed(1)} K</small>
        </div>
      `;
    })
    .join("");
}

function exportCurrentCsv({ state, elements }) {
  const dateKeys = getDateKeys(dateFromInput(elements), state.rangeDays);
  const detections = filterDetections(state.detections, {
    dateKeys,
    minConfidence: state.minConfidence,
    source: state.source
  });
  const sites = heritageSites.filter((site) => state.categoryFilter.has(site.type));
  const summaries = analyzeHeritageRisk(sites, detections, {
    radiusKm: state.radiusKm,
    mediumThreshold: state.mediumThreshold,
    highThreshold: state.highThreshold,
    getStoredRecord: getManagementRecord
  });
  const rows = [
    [
      "heritage_id",
      "heritage_name",
      "type",
      "region",
      "risk",
      "risk_score",
      "nearby_pixels",
      "frp_sum_mw",
      "max_brightness_k",
      "closest_km",
      "status"
    ]
  ];

  summaries.forEach((summary) => {
    rows.push([
      summary.site.id,
      summary.site.name,
      TYPE_LABELS[summary.site.type],
      summary.site.region,
      RISK_LABELS[summary.risk],
      summary.riskScore.toFixed(2),
      summary.nearby.length,
      summary.frpSum.toFixed(2),
      summary.maxBrightness.toFixed(2),
      summary.closest === null ? "" : summary.closest.toFixed(2),
      summary.status
    ]);
  });

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fire-stone-risk-${toDateInput(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function dateFromInput(elements) {
  return parseDate(elements.endDate.value || toDateInput(new Date()));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
