import { DEFAULTS, KOREA_BBOX, RISK_LABELS, TYPE_LABELS } from "./config.js";
import { heritageSites } from "./data/heritage-sites.js";
import { steepSlopeSites } from "./data/steep-slope-sites.generated.js";
import { buildSampleDetections } from "./data/sample-firms.js";
import { fetchFirmsArea } from "./services/firms-api.js";
import { fetchVworldAddressCoord } from "./services/vworld-geocoder.js";
import { fetchVworldFireRisk, getDefaultVworldDomain } from "./services/vworld-api.js";
import { getManagementRecord, saveManagementRecord } from "./services/storage.js";
import { formatAcqTime, getDateKeys, parseDate, toDateInput } from "./utils/date.js";
import {
  aggregateDaily,
  analyzeHeritageRisk,
  buildAlertCandidates,
  buildHotspotAreas,
  distanceKm,
  filterDetections
} from "./analysis/risk-engine.js";
import { buildPreventionReport, summarizeReport } from "./analysis/prevention-report.js";

const LIST_LIMIT = 250;
const RADIUS_LAYER_LIMIT = 80;
const PAGE_IDS = new Set(["map", "daily", "report", "heritage"]);
const FIRMS_PROXY_STORAGE_KEY = "fire-stone-firms-proxy-url";
const VWORLD_KEY_STORAGE_KEY = "fire-stone-vworld-api-key";
const VWORLD_DOMAIN_STORAGE_KEY = "fire-stone-vworld-domain";
const STEEP_SLOPE_GEOCODE_STORAGE_KEY = "fire-stone-steep-slope-geocodes-v1";
const VWORLD_QUERY_LIMIT = 80;

export function createFireStoneApp() {
  const state = {
    rangeDays: DEFAULTS.rangeDays,
    minConfidence: DEFAULTS.confidence,
    radiusKm: DEFAULTS.radiusKm,
    mediumThreshold: DEFAULTS.mediumThreshold,
    highThreshold: DEFAULTS.highThreshold,
    source: DEFAULTS.source,
    categoryFilter: new Set(["temple", "heritage", "house"]),
    environmentFactors: {
      conifer: true,
      slope: true
    },
    riskFilter: "all",
    regionQuery: "",
    lastRegionViewKey: "",
    selectedSiteId: null,
    detections: [],
    vworldRisks: new Map(),
    vworldRiskDate: "",
    steepSlopeGeocodes: loadSteepSlopeGeocodes(),
    usingLiveData: false
  };

  const elements = collectElements();
  const mapState = initMap();

  elements.endDate.value = toDateInput(new Date());
  if (elements.proxyUrl) {
    elements.proxyUrl.value = loadProxyUrl();
  }
  if (elements.vworldKey) {
    elements.vworldKey.value = loadVworldKey();
  }
  if (elements.vworldDomain) {
    elements.vworldDomain.value = loadVworldDomain();
  }
  populateRegionOptions(elements);
  state.detections = buildSampleDetections({ endDate: dateFromInput(elements), source: state.source });
  elements.dataStatus.textContent = `heritage 폴더 데이터 ${heritageSites.length.toLocaleString("ko-KR")}건을 분석 대상으로 불러왔습니다. 주·월·년 단위 누적 분석을 선택할 수 있습니다.`;

  bindEvents({ state, elements, mapState });
  initPageNavigation(mapState);
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
    proxyUrl: document.getElementById("proxyUrl"),
    vworldKey: document.getElementById("vworldKey"),
    vworldDomain: document.getElementById("vworldDomain"),
    loadVworld: document.getElementById("loadVworld"),
    loadSteepGeocode: document.getElementById("loadSteepGeocode"),
    regionSearch: document.getElementById("regionSearch"),
    clearRegion: document.getElementById("clearRegion"),
    regionStatus: document.getElementById("regionStatus"),
    regionOptions: document.getElementById("regionOptions"),
    loadSample: document.getElementById("loadSample"),
    loadFirms: document.getElementById("loadFirms"),
    dataStatus: document.getElementById("dataStatus"),
    metricDetections: document.getElementById("metricDetections"),
    metricRiskScore: document.getElementById("metricRiskScore"),
    metricAtRisk: document.getElementById("metricAtRisk"),
    metricAlerts: document.getElementById("metricAlerts"),
    dailyChart: document.getElementById("dailyChart"),
    alertList: document.getElementById("alertList"),
    reportSummary: document.getElementById("reportSummary"),
    reportTable: document.getElementById("reportTable"),
    reportDetail: document.getElementById("reportDetail"),
    exportReportCsv: document.getElementById("exportReportCsv"),
    exportReportJson: document.getElementById("exportReportJson"),
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
    detailEnvironment: document.getElementById("detailEnvironment"),
    managementStatus: document.getElementById("managementStatus"),
    managementNote: document.getElementById("managementNote"),
    saveManagement: document.getElementById("saveManagement"),
    historyTimeline: document.getElementById("historyTimeline")
  };
}

function initMap() {
  if (!document.getElementById("map")) {
    return null;
  }

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
    steepSlope: L.layerGroup().addTo(map),
    vworld: L.layerGroup().addTo(map),
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

function initPageNavigation(mapState) {
  const links = Array.from(document.querySelectorAll(".nav-link"));
  const pages = Array.from(document.querySelectorAll(".page-view"));

  function pageFromHash() {
    const page = window.location.hash.replace("#", "");
    return PAGE_IDS.has(page) ? page : null;
  }

  function pageFromDocument() {
    const page = document.body.dataset.page || "";
    return PAGE_IDS.has(page) ? page : null;
  }

  function setPage(page, options = {}) {
    const activePage = PAGE_IDS.has(page) ? page : "map";
    const isAnalysisPage = activePage !== "map";
    const activePageElement = pages.find((pageElement) => pageElement.dataset.page === activePage);
    document.body.dataset.page = activePage;
    document.body.classList.toggle("is-analysis-view", isAnalysisPage);
    links.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.page === activePage);
      link.setAttribute("aria-current", link.dataset.page === activePage ? "page" : "false");
    });
    pages.forEach((pageElement) => {
      pageElement.classList.toggle("is-active", isAnalysisPage && pageElement.dataset.page === activePage);
    });
    requestAnimationFrame(() => {
      if (mapState?.map) {
        mapState.map.invalidateSize();
      }
      if (options.scrollToPage && activePageElement) {
        activePageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (link.dataset.route === "page") {
        return;
      }
      event.preventDefault();
      const nextPage = link.dataset.page;
      if (!PAGE_IDS.has(nextPage)) {
        return;
      }
      const nextHash = `#${nextPage}`;
      if (window.location.hash === nextHash) {
        setPage(nextPage, { scrollToPage: true });
      } else {
        window.location.hash = nextHash;
        setPage(nextPage, { scrollToPage: true });
      }
    });
  });

  window.addEventListener("hashchange", () => {
    setPage(pageFromHash() || pageFromDocument() || "map");
  });

  setPage(pageFromHash() || pageFromDocument() || "map");
}

function bindEvents({ state, elements, mapState }) {
  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segment").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      state.rangeDays = Number(button.dataset.range);
      if (!state.usingLiveData) {
        state.detections = buildSampleDetections({ endDate: dateFromInput(elements), source: state.source });
      } else {
        elements.dataStatus.textContent = `누적 기간을 ${formatRangeLabel(state.rangeDays)}로 변경했습니다. 라이브 데이터는 FIRMS 불러오기로 다시 조회하세요.`;
      }
      renderAll({ state, elements, mapState });
    });
  });

  elements.endDate.addEventListener("change", () => {
    if (!state.usingLiveData) {
      state.detections = buildSampleDetections({ endDate: dateFromInput(elements), source: state.source });
    }
    if (state.vworldRisks.size) {
      state.vworldRisks.clear();
      state.vworldRiskDate = "";
      elements.dataStatus.textContent = "분석 종료일이 바뀌어 V-World 산불예측값을 초기화했습니다. 다시 불러오세요.";
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

  elements.proxyUrl?.addEventListener("change", () => {
    saveProxyUrl(elements.proxyUrl.value);
  });

  elements.vworldKey?.addEventListener("change", () => {
    saveVworldKey(elements.vworldKey.value);
  });

  elements.vworldDomain?.addEventListener("change", () => {
    const domain = elements.vworldDomain.value.trim().replace(/\/$/, "");
    elements.vworldDomain.value = domain || getDefaultVworldDomain();
    saveVworldDomain(elements.vworldDomain.value);
  });

  elements.regionSearch?.addEventListener("input", () => {
    state.regionQuery = elements.regionSearch.value.trim();
    state.selectedSiteId = null;
    state.lastRegionViewKey = "";
    renderAll({ state, elements, mapState });
  });

  elements.clearRegion?.addEventListener("click", () => {
    state.regionQuery = "";
    state.selectedSiteId = null;
    state.lastRegionViewKey = "";
    if (elements.regionSearch) {
      elements.regionSearch.value = "";
      elements.regionSearch.focus();
    }
    renderAll({ state, elements, mapState });
  });

  document.querySelectorAll(".check-row input").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.value === "conifer" || checkbox.value === "slope") {
        state.environmentFactors[checkbox.value] = checkbox.checked;
      } else if (checkbox.checked) {
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
    elements.dataStatus.textContent = `샘플 FIRMS 데이터와 heritage 폴더 문화유산 ${heritageSites.length.toLocaleString("ko-KR")}건이 ${formatRangeLabel(state.rangeDays)} 기준으로 표시됩니다.`;
    renderAll({ state, elements, mapState });
  });

  elements.loadFirms.addEventListener("click", async () => {
    await loadLiveFirms({ state, elements, mapState });
  });

  elements.loadVworld?.addEventListener("click", async () => {
    await loadVworldRisks({ state, elements, mapState });
  });

  elements.loadSteepGeocode?.addEventListener("click", async () => {
    await geocodeSteepSlopeSites({ state, elements, mapState });
  });

  elements.exportCsv?.addEventListener("click", () => {
    exportCurrentCsv({ state, elements });
  });

  elements.exportReportCsv?.addEventListener("click", () => {
    exportPreventionReport({ state, elements, format: "csv" });
  });

  elements.exportReportJson?.addEventListener("click", () => {
    exportPreventionReport({ state, elements, format: "json" });
  });

  elements.saveManagement?.addEventListener("click", () => {
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
  const proxyUrl = normalizeProxyUrl(elements.proxyUrl?.value || "");
  if (!mapKey && !proxyUrl) {
    elements.dataStatus.textContent = "FIRMS MAP_KEY를 입력하거나 MAP_KEY가 설정된 FIRMS 프록시 URL을 입력하세요.";
    return;
  }
  if (requiresHostedProxy() && !proxyUrl) {
    elements.dataStatus.textContent =
      "GitHub Pages에서는 NASA FIRMS 직접 호출이 브라우저에서 차단됩니다. FIRMS 프록시 URL을 입력하거나 로컬 서버(npm run serve)에서 실행하세요.";
    return;
  }
  if (proxyUrl && isStaticHostingUrl(proxyUrl)) {
    elements.dataStatus.textContent =
      "FIRMS 프록시 URL에는 GitHub Pages 주소가 아니라 Cloudflare Worker, Vercel Function, FastAPI 같은 API 프록시 주소를 입력하세요.";
    return;
  }
  if (elements.proxyUrl) {
    elements.proxyUrl.value = proxyUrl;
    saveProxyUrl(proxyUrl);
  }

  elements.dataStatus.textContent =
    state.rangeDays >= 365
      ? "연 단위 FIRMS 데이터를 10일 단위 요청으로 나누어 불러오는 중입니다."
      : "FIRMS 데이터를 불러오는 중입니다.";
  elements.loadFirms.disabled = true;

  try {
    const detections = await fetchFirmsArea({
      mapKey,
      source: state.source,
      bbox: KOREA_BBOX,
      endDate: dateFromInput(elements),
      rangeDays: state.rangeDays,
      proxyUrl
    });
    state.usingLiveData = true;
    state.detections = detections;
    elements.dataStatus.textContent = `${formatRangeLabel(state.rangeDays)} 기준 ${detections.length.toLocaleString("ko-KR")}개 FIRMS 픽셀을 불러왔습니다.`;
    renderAll({ state, elements, mapState });
  } catch (error) {
    elements.dataStatus.textContent = `FIRMS 불러오기 실패: ${error.message}`;
  } finally {
    elements.loadFirms.disabled = false;
  }
}

async function loadVworldRisks({ state, elements, mapState }) {
  const apiKey = elements.vworldKey?.value.trim() || "";
  const domain = (elements.vworldDomain?.value.trim() || getDefaultVworldDomain()).replace(/\/$/, "");
  if (!apiKey) {
    elements.dataStatus.textContent = "V-World 인증키를 입력하세요.";
    return;
  }

  if (elements.vworldKey) {
    saveVworldKey(apiKey);
  }
  if (elements.vworldDomain) {
    elements.vworldDomain.value = domain;
    saveVworldDomain(domain);
  }

  const date = dateFromInput(elements);
  const candidates = buildVworldCandidates({ state, elements });
  if (!candidates.length) {
    elements.dataStatus.textContent = "V-World 산불예측을 조회할 문화유산이 없습니다.";
    return;
  }

  state.vworldRisks = new Map();
  state.vworldRiskDate = toDateInput(date);
  elements.loadVworld.disabled = true;
  elements.dataStatus.textContent = `V-World 산불위험예측 ${candidates.length.toLocaleString("ko-KR")}건을 조회하는 중입니다.`;

  let completed = 0;
  let failed = 0;
  const failures = [];
  await runConcurrent(candidates, 4, async (site) => {
    try {
      const risk = await fetchVworldFireRisk({ apiKey, domain, site, date });
      state.vworldRisks.set(site.id, risk);
    } catch (error) {
      failed += 1;
      if (failures.length < 3) {
        failures.push(`${site.name}: ${error.message}`);
      }
    } finally {
      completed += 1;
      if (completed === candidates.length || completed % 10 === 0) {
        elements.dataStatus.textContent = `V-World 산불위험예측 조회 ${completed}/${candidates.length}건 완료`;
      }
    }
  });

  const success = state.vworldRisks.size;
  elements.dataStatus.textContent =
    success > 0
      ? `V-World 산불위험예측 ${success.toLocaleString("ko-KR")}건을 반영했습니다.${failed ? ` 실패 ${failed.toLocaleString("ko-KR")}건` : ""}`
      : `V-World 산불위험예측 불러오기 실패: ${failures[0] || "인증키, 도메인, 날짜를 확인하세요."}`;
  elements.loadVworld.disabled = false;
  renderAll({ state, elements, mapState });
}

async function geocodeSteepSlopeSites({ state, elements, mapState }) {
  const apiKey = elements.vworldKey?.value.trim() || "";
  const domain = (elements.vworldDomain?.value.trim() || getDefaultVworldDomain()).replace(/\/$/, "");
  if (!apiKey) {
    elements.dataStatus.textContent = "급경사지 주소좌표 보정을 위해 V-World 인증키를 입력하세요.";
    return;
  }

  if (elements.vworldKey) {
    saveVworldKey(apiKey);
  }
  if (elements.vworldDomain) {
    elements.vworldDomain.value = domain;
    saveVworldDomain(domain);
  }

  const targets = filterSteepSlopeSites(state.regionQuery).filter((site) => !state.steepSlopeGeocodes.has(site.id));
  if (!targets.length) {
    elements.dataStatus.textContent = `급경사지 ${state.steepSlopeGeocodes.size.toLocaleString("ko-KR")}건이 이미 주소좌표로 보정되어 있습니다.`;
    renderAll({ state, elements, mapState });
    return;
  }

  elements.loadSteepGeocode.disabled = true;
  elements.dataStatus.textContent = `급경사지 주소좌표 ${targets.length.toLocaleString("ko-KR")}건을 V-World로 보정하는 중입니다.`;

  let completed = 0;
  let failed = 0;
  const failures = [];

  await runConcurrent(targets, 3, async (site) => {
    try {
      const coord = await fetchVworldAddressCoord({ apiKey, domain, address: site.address });
      state.steepSlopeGeocodes.set(site.id, {
        ...coord,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      failed += 1;
      if (failures.length < 3) {
        failures.push(`${site.address}: ${error.message}`);
      }
    } finally {
      completed += 1;
      if (completed % 10 === 0 || completed === targets.length) {
        saveSteepSlopeGeocodes(state.steepSlopeGeocodes);
        elements.dataStatus.textContent = `급경사지 주소좌표 보정 ${completed}/${targets.length}건 완료`;
      }
    }
  });

  saveSteepSlopeGeocodes(state.steepSlopeGeocodes);
  elements.loadSteepGeocode.disabled = false;
  elements.dataStatus.textContent =
    state.steepSlopeGeocodes.size > 0
      ? `급경사지 ${state.steepSlopeGeocodes.size.toLocaleString("ko-KR")}건을 주소좌표 기반으로 표시합니다.${failed ? ` 실패 ${failed.toLocaleString("ko-KR")}건` : ""}`
      : `급경사지 주소좌표 보정 실패: ${failures[0] || "인증키와 도메인을 확인하세요."}`;
  renderAll({ state, elements, mapState });
}

function buildVworldCandidates({ state, elements }) {
  const dateKeys = getDateKeys(dateFromInput(elements), state.rangeDays);
  const detections = filterDetections(state.detections, {
    dateKeys,
    minConfidence: state.minConfidence,
    source: state.source
  });
  const sites = getFilteredSites(state);
  const summaries = analyzeHeritageRisk(sites, detections, {
    radiusKm: state.radiusKm,
    mediumThreshold: state.mediumThreshold,
    highThreshold: state.highThreshold,
    environmentFactors: state.environmentFactors,
    vworldRisks: new Map(),
    getStoredRecord: getManagementRecord
  });
  const selected = summaries.find((summary) => summary.site.id === state.selectedSiteId);
  const ranked = summaries
    .slice()
    .sort((a, b) => {
      const aScore = a.riskScore + a.environment.combinedScore * 0.2 + a.nearby.length * 2;
      const bScore = b.riskScore + b.environment.combinedScore * 0.2 + b.nearby.length * 2;
      return bScore - aScore;
    })
    .slice(0, VWORLD_QUERY_LIMIT);
  const unique = new Map();
  [selected, ...ranked].filter(Boolean).forEach((summary) => unique.set(summary.site.id, summary.site));
  return Array.from(unique.values()).slice(0, VWORLD_QUERY_LIMIT);
}

async function runConcurrent(items, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function getFilteredSites(state) {
  return heritageSites.filter((site) => {
    return state.categoryFilter.has(site.type) && matchesSiteRegion(site, state.regionQuery);
  });
}

function filterSteepSlopeSites(regionQuery) {
  return steepSlopeSites.filter((site) => matchesSteepSlopeRegion(site, regionQuery));
}

function filterDetectionsForRegion(detections, sites, regionQuery, radiusKm) {
  if (!normalizeSearchText(regionQuery)) {
    return detections;
  }
  if (!sites.length) {
    return [];
  }
  return detections.filter((detection) => {
    return sites.some((site) => distanceKm(site.lat, site.lng, detection.lat, detection.lng) <= radiusKm);
  });
}

function matchesSiteRegion(site, query) {
  return textMatchesQuery([site.region, site.name, site.manager, site.designation, site.sourceLayer].join(" "), query);
}

function matchesSteepSlopeRegion(site, query) {
  return textMatchesQuery([site.city, site.address, site.manager, site.department].join(" "), query);
}

function textMatchesQuery(text, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }
  const haystackVariants = buildSearchVariants(text);
  const queryVariants = buildSearchVariants(normalizedQuery);
  return queryVariants.some((needle) => needle && haystackVariants.some((haystack) => haystack.includes(needle)));
}

function buildSearchVariants(value) {
  const normalized = normalizeSearchText(value);
  const variants = new Set([normalized]);
  variants.add(normalized.replace(/충청남도/g, "충남"));
  variants.add(normalized.replace(/충남/g, "충청남도"));
  variants.add(normalized.replace(/[시군구]/g, ""));
  variants.add(normalized.replace(/충청남도/g, "충남").replace(/[시군구]/g, ""));
  variants.add(normalized.replace(/^충청남도/, ""));
  variants.add(normalized.replace(/^충남/, ""));
  variants.add(normalized.replace(/^충청남도/, "").replace(/[시군구]/g, ""));
  variants.add(normalized.replace(/^충남/, "").replace(/[시군구]/g, ""));
  return Array.from(variants).filter(Boolean);
}

function normalizeSearchText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function populateRegionOptions(elements) {
  if (!elements.regionOptions) {
    return;
  }
  const regions = new Set();
  heritageSites.forEach((site) => {
    const region = cleanRegionText(site.region);
    if (region) {
      regions.add(region);
      const parts = region.split(" ").filter(Boolean);
      if (parts.length >= 2) {
        regions.add(`${parts[0]} ${parts[1]}`);
        regions.add(parts[1]);
      }
    }
  });
  steepSlopeSites.forEach((site) => {
    if (site.city) {
      regions.add(site.city);
      regions.add(`충청남도 ${site.city}`);
    }
  });
  elements.regionOptions.innerHTML = Array.from(regions)
    .sort((a, b) => a.localeCompare(b, "ko-KR"))
    .slice(0, 600)
    .map((region) => `<option value="${escapeAttribute(region)}"></option>`)
    .join("");
}

function cleanRegionText(value) {
  return String(value || "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function escapeAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeProxyUrl(value) {
  const url = value.trim();
  if (!url) {
    return "";
  }
  try {
    const parsed = new URL(url, window.location.href);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function requiresHostedProxy() {
  if (typeof window === "undefined") {
    return false;
  }
  return !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function isStaticHostingUrl(value) {
  try {
    const { hostname } = new URL(value);
    return hostname.endsWith(".github.io") || hostname === "github.io";
  } catch {
    return false;
  }
}

function loadProxyUrl() {
  try {
    return window.localStorage.getItem(FIRMS_PROXY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveProxyUrl(value) {
  try {
    const proxyUrl = normalizeProxyUrl(value);
    if (proxyUrl) {
      window.localStorage.setItem(FIRMS_PROXY_STORAGE_KEY, proxyUrl);
    } else {
      window.localStorage.removeItem(FIRMS_PROXY_STORAGE_KEY);
    }
  } catch {
    // localStorage can be unavailable in strict browser privacy modes.
  }
}

function loadVworldKey() {
  try {
    return window.localStorage.getItem(VWORLD_KEY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveVworldKey(value) {
  try {
    const apiKey = String(value || "").trim();
    if (apiKey) {
      window.localStorage.setItem(VWORLD_KEY_STORAGE_KEY, apiKey);
    } else {
      window.localStorage.removeItem(VWORLD_KEY_STORAGE_KEY);
    }
  } catch {
    // localStorage can be unavailable in strict browser privacy modes.
  }
}

function loadVworldDomain() {
  try {
    return window.localStorage.getItem(VWORLD_DOMAIN_STORAGE_KEY) || getDefaultVworldDomain();
  } catch {
    return getDefaultVworldDomain();
  }
}

function saveVworldDomain(value) {
  try {
    const domain = String(value || "").trim().replace(/\/$/, "");
    if (domain) {
      window.localStorage.setItem(VWORLD_DOMAIN_STORAGE_KEY, domain);
    } else {
      window.localStorage.removeItem(VWORLD_DOMAIN_STORAGE_KEY);
    }
  } catch {
    // localStorage can be unavailable in strict browser privacy modes.
  }
}

function loadSteepSlopeGeocodes() {
  try {
    const raw = window.localStorage.getItem(STEEP_SLOPE_GEOCODE_STORAGE_KEY);
    if (!raw) {
      return new Map();
    }
    const entries = Object.entries(JSON.parse(raw)).filter(([, value]) => {
      return Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng));
    });
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveSteepSlopeGeocodes(geocodes) {
  try {
    window.localStorage.setItem(STEEP_SLOPE_GEOCODE_STORAGE_KEY, JSON.stringify(Object.fromEntries(geocodes)));
  } catch {
    // localStorage can be unavailable or full in strict browser privacy modes.
  }
}

function renderAll({ state, elements, mapState }) {
  const filteredSites = getFilteredSites(state);
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
    environmentFactors: state.environmentFactors,
    vworldRisks: state.vworldRisks,
    getStoredRecord: getManagementRecord
  });
  const visibleDetections = filterDetectionsForRegion(filteredDetections, filteredSites, state.regionQuery, state.radiusKm);
  const hotspots = buildHotspotAreas(visibleDetections);
  const alerts = buildAlertCandidates(summaries);
  const daily = aggregateDaily(dateKeys, visibleDetections, summaries);
  const report = buildPreventionReport(summaries, {
    radiusKm: state.radiusKm,
    mediumThreshold: state.mediumThreshold,
    highThreshold: state.highThreshold
  });

  if (mapState?.map) {
    renderMap({ state, elements, mapState, sites: filteredSites, detections: visibleDetections, summaries, hotspots });
    fitMapToRegion({ state, mapState, sites: filteredSites });
  }
  renderRegionStatus({ state, elements, sites: filteredSites, summaries });
  renderMetrics({ elements, detections: visibleDetections, summaries, alerts });
  if (elements.dailyChart) {
    renderDailyChart(elements.dailyChart, daily);
  }
  if (elements.alertList) {
    renderAlerts({ state, elements, mapState, alerts, summaries });
  }
  if (elements.reportSummary && elements.reportTable && elements.reportDetail) {
    renderPreventionReport({ state, elements, mapState, report, summaries });
  }
  if (elements.heritageList) {
    renderHeritageList({ state, elements, summaries, mapState });
  }
  if (elements.detailContent) {
    renderSelectedDetail({ state, elements, summaries });
  }
}

function renderRegionStatus({ state, elements, sites, summaries }) {
  if (!elements.regionStatus) {
    return;
  }
  const query = state.regionQuery.trim();
  const steepCount = filterSteepSlopeSites(state.regionQuery).length;
  const atRisk = summaries.filter((summary) => summary.risk !== "low").length;
  const topScore = summaries.length ? Math.max(...summaries.map((summary) => summary.riskScore)) : 0;
  elements.regionStatus.textContent = query
    ? `${query}: 문화유산 ${sites.length.toLocaleString("ko-KR")}건 · 급경사지 ${steepCount.toLocaleString("ko-KR")}건 · 위험 ${atRisk.toLocaleString("ko-KR")}건 · 최고 ${topScore.toFixed(1)}`
    : `전체 지역: 문화유산 ${sites.length.toLocaleString("ko-KR")}건 · 급경사지 ${steepCount.toLocaleString("ko-KR")}건`;
}

function fitMapToRegion({ state, mapState, sites }) {
  const query = state.regionQuery.trim();
  const normalized = normalizeSearchText(query);
  if (!normalized || !mapState?.map) {
    return;
  }
  const steepSites = filterSteepSlopeSites(query);
  const viewKey = `${normalized}:${sites.length}:${steepSites.length}`;
  if (state.lastRegionViewKey === viewKey) {
    return;
  }

  const points = [
    ...sites.map((site) => [site.lat, site.lng]),
    ...steepSites.map((site) => {
      const geocode = state.steepSlopeGeocodes.get(site.id);
      return [Number(geocode?.lat || site.lat), Number(geocode?.lng || site.lng)];
    })
  ].filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

  if (!points.length) {
    state.lastRegionViewKey = viewKey;
    return;
  }

  const bounds = L.latLngBounds(points);
  mapState.map.fitBounds(bounds.pad(0.18), {
    animate: true,
    maxZoom: points.length === 1 ? 12 : 10
  });
  state.lastRegionViewKey = viewKey;
}

function renderMap({ state, elements, mapState, sites, detections, summaries, hotspots }) {
  const { map, layers } = mapState;
  layers.heritage.clearLayers();
  layers.detection.clearLayers();
  layers.area.clearLayers();
  layers.steepSlope.clearLayers();
  layers.vworld.clearLayers();
  layers.radius.clearLayers();
  const summaryById = new Map(summaries.map((summary) => [summary.site.id, summary]));

  if (state.environmentFactors.slope) {
    renderSteepSlopeLayer(layers.steepSlope, state.steepSlopeGeocodes, state.regionQuery);
  }
  renderVworldLayer(layers.vworld, summaries);

  hotspots.forEach((hotspot) => {
    L.circle([hotspot.lat, hotspot.lng], {
      radius: hotspot.radiusKm * 1000,
      color: "#c94a35",
      weight: 1,
      opacity: 0.7,
      fillColor: "#c94a35",
      fillOpacity: 0.19,
      interactive: false
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

  summaries
    .filter((summary) => summary.risk !== "low" || summary.site.id === state.selectedSiteId)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, RADIUS_LAYER_LIMIT)
    .forEach((summary) => {
      const color = summary.risk === "high" ? "#c94a35" : summary.risk === "medium" ? "#d79226" : "#31755b";
      L.circle([summary.site.lat, summary.site.lng], {
        radius: state.radiusKm * 1000,
        color,
        weight: 1,
        opacity: 0.38,
        fillColor: color,
        fillOpacity: 0.04,
        interactive: false
      }).addTo(layers.radius);
    });

  sites.forEach((site) => {
    const summary = summaryById.get(site.id);
    const style = heritagePointStyle(site, summary);
    const popupHtml = buildHeritagePopup(site, summary);
    const marker = L.circleMarker([site.lat, site.lng], style).bindPopup(popupHtml).addTo(layers.heritage);
    const hitArea = L.circleMarker([site.lat, site.lng], hitAreaStyle(18)).bindPopup(popupHtml).addTo(layers.heritage);

    const selectSite = () => {
      state.selectedSiteId = site.id;
      renderSelectedDetail({ state, elements, summaries });
      map.setView([site.lat, site.lng], Math.max(map.getZoom(), 10), { animate: true });
    };
    bindWideMarkerEvents({ marker, hitArea, baseRadius: style.radius, baseWeight: style.weight, onClick: selectSite });
  });
}

function buildHeritagePopup(site, summary) {
  const environment = summary?.environment;
  const vworld = summary?.vworld;
  return `
    <h3 class="popup-title">${site.name}</h3>
    <p class="popup-line">${TYPE_LABELS[site.type]} · ${site.region || "-"}</p>
    <p class="popup-line">${site.designation || site.sourceLayer || "문화유산"} · ${site.isProtectionZone ? "보호구역" : "유산"}</p>
    <p class="popup-line">위험점수 ${summary ? summary.riskScore.toFixed(1) : "0.0"} · ${summary ? RISK_LABELS[summary.risk] : "낮음"}</p>
    ${
      environment
        ? `<p class="popup-line">침엽수 리스크 ${environment.coniferScore} · 급경사 리스크 ${environment.slopeScore}</p>
           <p class="popup-line">${environment.evidenceSummary || "주변 환경 추정치"}</p>`
        : ""
    }
    ${vworld ? `<p class="popup-line">${vworld.label} · ${vworld.peakHour || "-"}시 · +${vworld.baseScore.toFixed(1)}</p>` : ""}
  `;
}

function renderSteepSlopeLayer(layer, geocodes = new Map(), regionQuery = "") {
  filterSteepSlopeSites(regionQuery).forEach((site) => {
    const geocode = geocodes.get(site.id);
    const lat = Number(geocode?.lat || site.lat);
    const lng = Number(geocode?.lng || site.lng);
    const coordinateAccuracy = geocode?.coordinateAccuracy || site.coordinateAccuracy;
    const popupHtml = `
      <h3 class="popup-title">충청남도 급경사지</h3>
      <p class="popup-line">${site.address || "-"}</p>
      <p class="popup-line">${site.city || "-"} · ${site.department || site.manager || "관리부서 미기재"}</p>
      <p class="popup-line">${coordinateAccuracy}</p>
      ${geocode?.matchedAddress ? `<p class="popup-line">매칭주소 ${geocode.matchedAddress}</p>` : ""}
      <p class="popup-line">좌표 ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
    `;
    const marker = L.circleMarker([lat, lng], {
      radius: geocode ? 4.8 : 3.8,
      color: geocode ? "#173f72" : "#5f4428",
      weight: 1,
      opacity: 0.9,
      fillColor: geocode ? "#2f6fb3" : "#8b5a2b",
      fillOpacity: 0.76
    })
      .bindPopup(popupHtml)
      .addTo(layer);
    const hitArea = L.circleMarker([lat, lng], hitAreaStyle(15)).bindPopup(popupHtml).addTo(layer);
    bindWideMarkerEvents({ marker, hitArea, baseRadius: geocode ? 4.8 : 3.8, baseWeight: 1 });
  });
}

function renderVworldLayer(layer, summaries) {
  summaries
    .filter((summary) => summary.vworld)
    .forEach((summary) => {
      const risk = summary.vworld;
      const color = vworldColor(risk.maxClass);
      const popupHtml = `
        <h3 class="popup-title">V-World 산불위험예측</h3>
        <p class="popup-line">${summary.site.name}</p>
        <p class="popup-line">${risk.label} · 최고등급 ${risk.maxClass} · 최대값 ${risk.maxValue.toFixed(1)}</p>
        <p class="popup-line">최고 시간 ${risk.peakHour || "-"}시 · 위험점수 보정 +${risk.baseScore.toFixed(1)}</p>
      `;
      const marker = L.circleMarker([summary.site.lat, summary.site.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 1.6,
        opacity: 0.96,
        fillColor: color,
        fillOpacity: 0.8
      })
        .bindPopup(popupHtml)
        .addTo(layer);
      const hitArea = L.circleMarker([summary.site.lat, summary.site.lng], hitAreaStyle(20)).bindPopup(popupHtml).addTo(layer);
      bindWideMarkerEvents({ marker, hitArea, baseRadius: 8, baseWeight: 1.6 });
    });
}

function hitAreaStyle(radius) {
  return {
    radius,
    color: "#1f2522",
    weight: 0,
    opacity: 0,
    fillColor: "#1f2522",
    fillOpacity: 0.01,
    interactive: true
  };
}

function bindWideMarkerEvents({ marker, hitArea, baseRadius, baseWeight, onClick }) {
  const baseOpacity = marker.options.opacity;
  const baseFillOpacity = marker.options.fillOpacity;
  const activate = () => {
    marker.setRadius(Math.max(baseRadius + 3, 7));
    marker.setStyle({ weight: Math.max(baseWeight + 1, 2), opacity: 1, fillOpacity: Math.min(0.95, baseFillOpacity + 0.12) });
  };
  const deactivate = () => {
    marker.setRadius(baseRadius);
    marker.setStyle({ weight: baseWeight, opacity: baseOpacity, fillOpacity: baseFillOpacity });
  };
  [marker, hitArea].forEach((target) => {
    target.on("mouseover", activate);
    target.on("mouseout", deactivate);
    target.on("click", () => {
      if (onClick) {
        onClick();
      }
    });
  });
}

function vworldColor(value) {
  if (value >= 5) {
    return "#7f1d1d";
  }
  if (value >= 4) {
    return "#c94a35";
  }
  if (value >= 3) {
    return "#d79226";
  }
  if (value >= 2) {
    return "#e3c15b";
  }
  return "#31755b";
}

function heritagePointStyle(site, summary) {
  const risk = summary ? summary.risk : "low";
  const typeColor = site.type === "temple" ? "#31755b" : site.type === "house" ? "#1f6fb2" : "#5f5aa2";
  const riskColor = risk === "high" ? "#c94a35" : risk === "medium" ? "#d79226" : typeColor;
  return {
    radius: risk === "high" ? 6 : risk === "medium" ? 5 : 3,
    color: "#ffffff",
    weight: risk === "low" ? 0.5 : 1.5,
    opacity: 0.95,
    fillColor: riskColor,
    fillOpacity: site.isProtectionZone ? 0.38 : 0.74
  };
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
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="일별 감지 수와 누적 위험점수">
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
      <text x="70" y="12" font-size="11" font-weight="800" fill="#31755b">누적 위험점수</text>
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
          <small>${summary.environment.label} · 침엽수 ${summary.environment.coniferScore} · 급경사 ${summary.environment.slopeScore}</small>
          ${summary.environment.evidenceSummary ? `<small class="environment-source">${summary.environment.evidenceSummary}</small>` : ""}
          ${summary.vworld ? `<small class="vworld-source">${summary.vworld.label} · ${summary.vworld.peakHour || "-"}시 · +${summary.vworld.baseScore.toFixed(1)}</small>` : ""}
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
      if (elements.detailContent) {
        renderSelectedDetail({ state, elements, summaries });
      }
      if (mapState?.map) {
        mapState.map.setView([summary.site.lat, summary.site.lng], Math.max(mapState.map.getZoom(), 10), {
          animate: true
        });
      }
    });
  });
}

function renderPreventionReport({ state, elements, mapState, report, summaries }) {
  const reportSummary = summarizeReport(report);
  const actionable = report.filter((item) => item.risk !== "low" || item.priority !== "정상관리");
  const visible = (actionable.length ? actionable : report).slice(0, 40);
  const selected = report.find((item) => item.id === state.selectedSiteId) || visible[0] || report[0];

  elements.reportSummary.innerHTML = `
    <div>
      <span>${reportSummary.high.toLocaleString("ko-KR")}</span>
      <small>높음 등급</small>
    </div>
    <div>
      <span>${reportSummary.medium.toLocaleString("ko-KR")}</span>
      <small>주의 등급</small>
    </div>
    <div>
      <span>${reportSummary.immediate.toLocaleString("ko-KR")}</span>
      <small>즉시점검</small>
    </div>
    <div>
      <span>${reportSummary.topScore.toFixed(1)}</span>
      <small>최고 위험점수</small>
    </div>
  `;

  elements.reportTable.innerHTML = visible
    .map((item, index) => {
      const selectedClass = item.id === selected?.id ? " is-selected" : "";
      const closest = item.closestKm === null ? "-" : `${item.closestKm.toFixed(1)} km`;
      return `
        <tr class="report-row${selectedClass}" data-site-id="${item.id}">
          <td>${index + 1}</td>
          <td>
            <strong>${item.name}</strong>
            <small>${item.region || "-"} · ${item.designation || "-"}</small>
          </td>
          <td>
            <span>${item.latitude.toFixed(5)}</span>
            <small>${item.longitude.toFixed(5)}</small>
          </td>
          <td><span class="risk-badge ${item.risk}">${item.riskLabel}</span></td>
          <td>${item.riskScore.toFixed(1)}</td>
          <td>
            <span class="risk-badge ${item.environmentGrade}">${item.environmentLabel}</span>
            <small>침엽수 ${item.coniferScore} · 급경사 ${item.slopeScore}</small>
            ${item.environmentEvidence ? `<small class="environment-source">${item.environmentEvidence}</small>` : ""}
            ${item.vworldLabel ? `<small class="vworld-source">${item.vworldLabel} · ${item.vworldPeakHour || "-"}시 · +${item.vworldBaseScore.toFixed(1)}</small>` : ""}
          </td>
          <td>${closest}</td>
          <td>${item.frpSum.toFixed(1)} MW</td>
          <td><span class="priority-badge ${priorityClass(item.priority)}">${item.priority}</span></td>
        </tr>
      `;
    })
    .join("");

  elements.reportTable.querySelectorAll(".report-row").forEach((row) => {
    row.addEventListener("click", () => {
      const summary = summaries.find((item) => item.site.id === row.dataset.siteId);
      state.selectedSiteId = row.dataset.siteId;
      if (summary) {
        if (elements.detailContent) {
          renderSelectedDetail({ state, elements, summaries });
        }
        if (mapState?.map) {
          mapState.map.setView([summary.site.lat, summary.site.lng], Math.max(mapState.map.getZoom(), 10), {
            animate: true
          });
        }
      }
      renderReportDetail(elements.reportDetail, report.find((item) => item.id === row.dataset.siteId));
      elements.reportTable.querySelectorAll(".report-row").forEach((item) => item.classList.remove("is-selected"));
      row.classList.add("is-selected");
    });
  });

  renderReportDetail(elements.reportDetail, selected);
}

function renderReportDetail(container, item) {
  if (!item) {
    container.innerHTML = `<div class="empty-alert">보고서 대상이 없습니다.</div>`;
    return;
  }

  const closest = item.closestKm === null ? "반경 내 탐지 없음" : `${item.closestKm.toFixed(2)} km`;
  const nearestLocation =
    item.nearestFireLat === ""
      ? "-"
      : `${Number(item.nearestFireLat).toFixed(5)}, ${Number(item.nearestFireLng).toFixed(5)}`;

  container.innerHTML = `
    <div class="report-detail-head">
      <div>
        <p class="eyebrow">${item.region || "-"}</p>
        <h3>${item.name}</h3>
      </div>
      <span class="priority-badge ${priorityClass(item.priority)}">${item.priority}</span>
    </div>
    <div class="report-kv">
      <div><span>문화유산 좌표</span><strong>${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}</strong></div>
      <div><span>위험 등급/점수</span><strong>${item.riskLabel} · ${item.riskScore.toFixed(1)}</strong></div>
      <div><span>침엽수/급경사 리스크</span><strong>${item.environmentLabel} · ${item.coniferScore} / ${item.slopeScore}</strong></div>
      <div><span>환경 가중</span><strong>배수 ${item.environmentMultiplier.toFixed(2)} · 기초점수 ${item.environmentBaseScore.toFixed(1)}</strong></div>
      <div><span>환경 원자료</span><strong>${item.environmentEvidence || "지역 추정치"}</strong></div>
      <div><span>V-World 산불예측</span><strong>${item.vworldLabel ? `${item.vworldLabel} · 등급 ${item.vworldMaxClass} · +${item.vworldBaseScore.toFixed(1)}` : "미조회"}</strong></div>
      <div><span>반경 내 픽셀</span><strong>${item.nearbyPixels}개</strong></div>
      <div><span>FRP 합계/최대</span><strong>${item.frpSum.toFixed(1)} / ${item.maxFrp.toFixed(1)} MW</strong></div>
      <div><span>최단 거리</span><strong>${closest}</strong></div>
      <div><span>최근/최단 탐지 위치</span><strong>${nearestLocation}</strong></div>
    </div>
    <div class="prevention-box ${item.actionLevel}">
      <h4>${item.actionTitle}</h4>
      <ul>
        ${item.actionItems.map((action) => `<li>${action}</li>`).join("")}
      </ul>
    </div>
  `;
}

function priorityClass(priority) {
  if (priority === "즉시점검") {
    return "urgent";
  }
  if (priority === "강화모니터링") {
    return "watch";
  }
  return "normal";
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

  const visible = filtered.slice(0, LIST_LIMIT);
  const notice =
    filtered.length > LIST_LIMIT
      ? `<div class="list-notice">총 ${filtered.length.toLocaleString("ko-KR")}건 중 위험도 상위 ${LIST_LIMIT.toLocaleString("ko-KR")}건을 표시합니다.</div>`
      : "";

  elements.heritageList.innerHTML =
    notice +
    visible
      .map((summary) => {
        const site = summary.site;
        const selectedClass = state.selectedSiteId === site.id ? " is-selected" : "";
        return `
          <button class="heritage-card${selectedClass}" type="button" data-site-id="${site.id}">
            <span class="heritage-card-top">
              <span>
                <strong>${site.name}</strong>
                <small>${TYPE_LABELS[site.type]} · ${site.region || "-"} · ${site.designation || site.sourceLayer || "문화유산"}</small>
              </span>
              <span class="risk-badge ${summary.risk}">${RISK_LABELS[summary.risk]}</span>
            </span>
            <span class="heritage-card-meta">
              <span class="meta-pill">점수 ${summary.riskScore.toFixed(1)}</span>
              <span class="meta-pill">${summary.environment.label}</span>
              ${summary.vworld ? `<span class="meta-pill">${summary.vworld.label}</span>` : ""}
              <span class="meta-pill">FRP ${summary.frpSum.toFixed(1)} MW</span>
              <span class="meta-pill">${site.isProtectionZone ? "보호구역" : "유산"}</span>
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
        if (mapState?.map) {
          mapState.map.setView([summary.site.lat, summary.site.lng], Math.max(mapState.map.getZoom(), 10), {
            animate: true
          });
        }
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
  elements.detailRegion.textContent = `${TYPE_LABELS[summary.site.type]} · ${summary.site.region || "-"} · ${summary.site.designation || summary.site.sourceLayer || "문화유산"} · 면적 ${Number(summary.site.areaM2 || 0).toLocaleString("ko-KR")}㎡`;
  elements.detailName.textContent = summary.site.name;
  elements.detailRisk.textContent = RISK_LABELS[summary.risk];
  elements.detailRisk.className = `risk-badge ${summary.risk}`;
  elements.detailScore.textContent = summary.riskScore.toFixed(1);
  elements.detailCount.textContent = summary.nearby.length;
  elements.detailFrp.textContent = `${summary.frpSum.toFixed(1)} MW`;
  elements.detailDistance.textContent = summary.closest === null ? "-" : `${summary.closest.toFixed(1)} km`;
  if (elements.detailEnvironment) {
    elements.detailEnvironment.textContent = summary.vworld
      ? `${summary.environment.label} ${summary.environment.combinedScore.toFixed(0)} · V ${summary.vworld.maxClass}`
      : `${summary.environment.label} ${summary.environment.combinedScore.toFixed(0)}`;
    elements.detailEnvironment.title = [summary.environment.evidenceSummary || "지역 추정치", summary.vworld?.label || ""]
      .filter(Boolean)
      .join(" · ");
  }
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
  const sites = getFilteredSites(state);
  const summaries = analyzeHeritageRisk(sites, detections, {
    radiusKm: state.radiusKm,
    mediumThreshold: state.mediumThreshold,
    highThreshold: state.highThreshold,
    environmentFactors: state.environmentFactors,
    vworldRisks: state.vworldRisks,
    getStoredRecord: getManagementRecord
  });
  const rows = [
    [
      "heritage_id",
      "heritage_code",
      "heritage_name",
      "source_layer",
      "designation",
      "type",
      "region",
      "risk",
      "risk_score",
      "nearby_pixels",
      "frp_sum_mw",
      "max_brightness_k",
      "closest_km",
      "environment_label",
      "conifer_score",
      "slope_score",
      "environment_multiplier",
      "environment_evidence",
      "conifer_latest_year",
      "conifer_latest_area_ha",
      "conifer_trend_pct",
      "slope_data_city",
      "slope_data_count",
      "vworld_label",
      "vworld_max_class",
      "vworld_max_value",
      "vworld_peak_hour",
      "vworld_score_boost",
      "status"
    ]
  ];

  summaries.forEach((summary) => {
    rows.push([
      summary.site.id,
      summary.site.heritageCode || "",
      summary.site.name,
      summary.site.sourceLayer || "",
      summary.site.designation || "",
      TYPE_LABELS[summary.site.type],
      summary.site.region,
      RISK_LABELS[summary.risk],
      summary.riskScore.toFixed(2),
      summary.nearby.length,
      summary.frpSum.toFixed(2),
      summary.maxBrightness.toFixed(2),
      summary.closest === null ? "" : summary.closest.toFixed(2),
      summary.environment.label,
      summary.environment.coniferScore,
      summary.environment.slopeScore,
      summary.environment.multiplier,
      summary.environment.evidenceSummary || "",
      summary.environment.evidence?.conifer?.latestYear || "",
      summary.environment.evidence?.conifer?.latestTotalAreaHa || "",
      summary.environment.evidence?.conifer?.trendPct || "",
      summary.environment.evidence?.slope?.city || "",
      summary.environment.evidence?.slope?.count || "",
      summary.vworld?.label || "",
      summary.vworld?.maxClass || "",
      summary.vworld?.maxValue || "",
      summary.vworld?.peakHour || "",
      summary.vworld?.baseScore || "",
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

function exportPreventionReport({ state, elements, format }) {
  const report = buildCurrentReport({ state, elements });
  const rows = report.map((item, index) => ({
    rank: index + 1,
    heritage_id: item.id,
    heritage_code: item.heritageCode,
    heritage_name: item.name,
    designation: item.designation,
    region: item.region,
    latitude: item.latitude,
    longitude: item.longitude,
    risk_label: item.riskLabel,
    risk_score: Number(item.riskScore.toFixed(2)),
    fire_risk_score: Number(item.fireRiskScore.toFixed(2)),
    environment_label: item.environmentLabel,
    environment_score: item.environmentScore,
    conifer_score: item.coniferScore,
    slope_score: item.slopeScore,
    environment_multiplier: item.environmentMultiplier,
    environment_evidence: item.environmentEvidence,
    conifer_latest_year: item.coniferLatestYear,
    conifer_latest_area_ha: item.coniferLatestAreaHa,
    conifer_trend_pct: item.coniferTrendPct,
    slope_data_city: item.slopeDataCity,
    slope_data_count: item.slopeDataCount,
    vworld_label: item.vworldLabel,
    vworld_max_class: item.vworldMaxClass,
    vworld_max_value: item.vworldMaxValue,
    vworld_peak_hour: item.vworldPeakHour,
    vworld_score_boost: item.vworldBaseScore,
    vworld_multiplier: item.vworldMultiplier,
    priority: item.priority,
    nearby_pixels: item.nearbyPixels,
    frp_sum_mw: Number(item.frpSum.toFixed(2)),
    max_frp_mw: Number(item.maxFrp.toFixed(2)),
    closest_km: item.closestKm === null ? "" : Number(item.closestKm.toFixed(2)),
    nearest_fire_date: item.nearestFireDate,
    nearest_fire_time: item.nearestFireTime,
    nearest_fire_latitude: item.nearestFireLat,
    nearest_fire_longitude: item.nearestFireLng,
    nearest_fire_frp_mw: item.nearestFireFrp,
    nearest_fire_confidence: item.nearestFireConfidence,
    action_level: item.actionLevel,
    action_title: item.actionTitle,
    action_items: item.actionItems.join(" | ")
  }));

  if (format === "json") {
    downloadBlob(
      JSON.stringify(rows, null, 2),
      `fire-stone-prevention-report-${toDateInput(new Date())}.json`,
      "application/json;charset=utf-8"
    );
    return;
  }

  const headers = Object.keys(rows[0] || { empty: "" });
  const csv = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
  downloadBlob(`\ufeff${csv}`, `fire-stone-prevention-report-${toDateInput(new Date())}.csv`, "text/csv;charset=utf-8");
}

function buildCurrentReport({ state, elements }) {
  const dateKeys = getDateKeys(dateFromInput(elements), state.rangeDays);
  const detections = filterDetections(state.detections, {
    dateKeys,
    minConfidence: state.minConfidence,
    source: state.source
  });
  const sites = getFilteredSites(state);
  const summaries = analyzeHeritageRisk(sites, detections, {
    radiusKm: state.radiusKm,
    mediumThreshold: state.mediumThreshold,
    highThreshold: state.highThreshold,
    environmentFactors: state.environmentFactors,
    vworldRisks: state.vworldRisks,
    getStoredRecord: getManagementRecord
  });
  return buildPreventionReport(summaries, {
    radiusKm: state.radiusKm,
    mediumThreshold: state.mediumThreshold,
    highThreshold: state.highThreshold
  });
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function dateFromInput(elements) {
  return parseDate(elements.endDate.value || toDateInput(new Date()));
}

function formatRangeLabel(rangeDays) {
  if (rangeDays >= 365) {
    return "연 단위";
  }
  if (rangeDays >= 30) {
    return "월 단위";
  }
  return "주 단위";
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
