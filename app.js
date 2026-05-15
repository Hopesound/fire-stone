(function () {
  "use strict";

  const KOREA_BBOX = {
    west: 124.4,
    south: 33.0,
    east: 131.9,
    north: 38.7
  };

  const heritageSites = [
    {
      id: "bulguksa",
      name: "경주 불국사",
      type: "temple",
      region: "경북 경주시",
      lat: 35.7901,
      lng: 129.3321,
      manager: "경주시 문화유산과"
    },
    {
      id: "haeinsa",
      name: "합천 해인사",
      type: "temple",
      region: "경남 합천군",
      lat: 35.8019,
      lng: 128.0982,
      manager: "합천군 문화관광과"
    },
    {
      id: "hahoemaeul",
      name: "안동 하회마을",
      type: "house",
      region: "경북 안동시",
      lat: 36.5394,
      lng: 128.5187,
      manager: "안동시 세계유산과"
    },
    {
      id: "yangdong",
      name: "경주 양동마을",
      type: "house",
      region: "경북 경주시",
      lat: 36.0038,
      lng: 129.2538,
      manager: "경주시 문화유산과"
    },
    {
      id: "jongmyo",
      name: "서울 종묘",
      type: "heritage",
      region: "서울 종로구",
      lat: 37.5747,
      lng: 126.9941,
      manager: "종로구 문화과"
    },
    {
      id: "songgwangsa",
      name: "순천 송광사",
      type: "temple",
      region: "전남 순천시",
      lat: 35.0026,
      lng: 127.2762,
      manager: "순천시 문화유산과"
    },
    {
      id: "buseoksa",
      name: "영주 부석사",
      type: "temple",
      region: "경북 영주시",
      lat: 36.9988,
      lng: 128.6876,
      manager: "영주시 문화관광과"
    },
    {
      id: "magoksa",
      name: "공주 마곡사",
      type: "temple",
      region: "충남 공주시",
      lat: 36.5583,
      lng: 127.0135,
      manager: "공주시 문화재과"
    },
    {
      id: "nagan",
      name: "순천 낙안읍성",
      type: "heritage",
      region: "전남 순천시",
      lat: 34.9044,
      lng: 127.3427,
      manager: "순천시 문화유산과"
    },
    {
      id: "yunjeung",
      name: "논산 명재고택",
      type: "house",
      region: "충남 논산시",
      lat: 36.2014,
      lng: 127.0892,
      manager: "논산시 문화예술과"
    }
  ];

  const sampleTemplates = [
    ["haeinsa", -1, 0.012, -0.016, 88, 18.5, "N"],
    ["haeinsa", -5, -0.028, 0.019, 72, 12.1, "D"],
    ["bulguksa", -2, 0.022, 0.015, 63, 8.4, "D"],
    ["bulguksa", -11, -0.05, 0.031, 47, 4.6, "N"],
    ["hahoemaeul", -3, -0.018, 0.026, 79, 15.9, "D"],
    ["hahoemaeul", -6, 0.036, -0.021, 61, 7.3, "N"],
    ["yangdong", -4, -0.025, 0.018, 67, 11.2, "D"],
    ["jongmyo", -9, 0.042, 0.029, 55, 6.7, "D"],
    ["songgwangsa", -1, 0.018, -0.022, 91, 22.6, "N"],
    ["songgwangsa", -8, -0.034, 0.014, 73, 13.4, "D"],
    ["buseoksa", -7, 0.031, -0.018, 58, 5.7, "D"],
    ["magoksa", -10, -0.026, -0.023, 69, 9.6, "N"],
    ["nagan", -13, 0.02, 0.027, 77, 14.2, "D"],
    ["yunjeung", -12, -0.019, 0.018, 66, 8.2, "D"],
    [null, -2, 35.32, 128.91, 84, 19.3, "D"],
    [null, -4, 37.12, 128.72, 76, 12.8, "N"],
    [null, -6, 34.76, 126.88, 54, 7.1, "D"],
    [null, -9, 36.24, 129.12, 62, 8.7, "D"],
    [null, -14, 35.18, 127.74, 49, 5.6, "N"],
    [null, -15, 37.42, 127.88, 70, 10.4, "D"]
  ];

  const state = {
    rangeDays: 7,
    minConfidence: 50,
    radiusKm: 10,
    source: "VIIRS_SNPP_NRT",
    categoryFilter: new Set(["temple", "heritage", "house"]),
    riskFilter: "all",
    selectedSiteId: null,
    detections: [],
    usingLiveData: false
  };

  const elements = {
    endDate: document.getElementById("endDate"),
    sourceSelect: document.getElementById("sourceSelect"),
    confidenceRange: document.getElementById("confidenceRange"),
    confidenceValue: document.getElementById("confidenceValue"),
    radiusRange: document.getElementById("radiusRange"),
    radiusValue: document.getElementById("radiusValue"),
    mapKey: document.getElementById("mapKey"),
    loadSample: document.getElementById("loadSample"),
    loadFirms: document.getElementById("loadFirms"),
    dataStatus: document.getElementById("dataStatus"),
    metricDetections: document.getElementById("metricDetections"),
    metricHotspotArea: document.getElementById("metricHotspotArea"),
    metricAtRisk: document.getElementById("metricAtRisk"),
    dailyChart: document.getElementById("dailyChart"),
    heritageList: document.getElementById("heritageList"),
    exportCsv: document.getElementById("exportCsv"),
    detailEmpty: document.getElementById("detailEmpty"),
    detailContent: document.getElementById("detailContent"),
    detailRegion: document.getElementById("detailRegion"),
    detailName: document.getElementById("detailName"),
    detailRisk: document.getElementById("detailRisk"),
    detailCount: document.getElementById("detailCount"),
    detailLast: document.getElementById("detailLast"),
    detailDistance: document.getElementById("detailDistance"),
    managementStatus: document.getElementById("managementStatus"),
    managementNote: document.getElementById("managementNote"),
    saveManagement: document.getElementById("saveManagement"),
    historyTimeline: document.getElementById("historyTimeline")
  };

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
      "일반지도": baseLayers.street,
      "항공사진": baseLayers.imagery
    },
    null,
    { position: "topright", collapsed: true }
  ).addTo(map);

  function setBaseLayer(type) {
    const nextLayer = baseLayers[type] || baseLayers.street;
    if (activeBaseLayer === nextLayer) {
      return;
    }
    map.removeLayer(activeBaseLayer);
    activeBaseLayer = nextLayer.addTo(map);
    document.querySelectorAll(".basemap-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.basemap === type);
    });
  }

  document.querySelectorAll(".basemap-button").forEach((button) => {
    button.addEventListener("click", () => setBaseLayer(button.dataset.basemap));
  });

  map.on("baselayerchange", (event) => {
    const type = event.name === "항공사진" ? "imagery" : "street";
    activeBaseLayer = baseLayers[type];
    document.querySelectorAll(".basemap-button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.basemap === type);
    });
  });

  const layers = {
    heritage: L.layerGroup().addTo(map),
    detection: L.layerGroup().addTo(map),
    area: L.layerGroup().addTo(map),
    radius: L.layerGroup().addTo(map)
  };

  function init() {
    elements.endDate.value = toDateInput(new Date());
    bindEvents();
    state.detections = buildSampleDetections();
    renderAll();
  }

  function bindEvents() {
    document.querySelectorAll(".segment").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".segment").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        state.rangeDays = Number(button.dataset.range);
        if (!state.usingLiveData) {
          state.detections = buildSampleDetections();
        }
        renderAll();
      });
    });

    elements.endDate.addEventListener("change", () => {
      if (!state.usingLiveData) {
        state.detections = buildSampleDetections();
      }
      renderAll();
    });

    elements.sourceSelect.addEventListener("change", () => {
      state.source = elements.sourceSelect.value;
      if (!state.usingLiveData) {
        state.detections = buildSampleDetections();
      } else {
        elements.dataStatus.textContent = "센서를 변경했습니다. 최신 결과는 FIRMS 불러오기로 다시 조회하세요.";
      }
      renderAll();
    });

    elements.confidenceRange.addEventListener("input", () => {
      state.minConfidence = Number(elements.confidenceRange.value);
      elements.confidenceValue.textContent = state.minConfidence;
      renderAll();
    });

    elements.radiusRange.addEventListener("input", () => {
      state.radiusKm = Number(elements.radiusRange.value);
      elements.radiusValue.textContent = `${state.radiusKm} km`;
      renderAll();
    });

    document.querySelectorAll(".check-row input").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.categoryFilter.add(checkbox.value);
        } else {
          state.categoryFilter.delete(checkbox.value);
        }
        renderAll();
      });
    });

    document.querySelectorAll(".risk-chip").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".risk-chip").forEach((item) => item.classList.remove("is-active"));
        button.classList.add("is-active");
        state.riskFilter = button.dataset.risk;
        renderAll();
      });
    });

    elements.loadSample.addEventListener("click", () => {
      state.usingLiveData = false;
      state.detections = buildSampleDetections();
      elements.dataStatus.textContent = "샘플 데이터가 표시됩니다.";
      renderAll();
    });

    elements.loadFirms.addEventListener("click", loadLiveFirms);
    elements.exportCsv.addEventListener("click", exportCurrentCsv);
    elements.saveManagement.addEventListener("click", saveManagementRecord);
  }

  function renderAll() {
    const filteredSites = getFilteredSites();
    const dateKeys = getDateKeys();
    const filteredDetections = getFilteredDetections(dateKeys);
    const siteSummaries = buildSiteSummaries(filteredSites, filteredDetections);
    const hotspots = buildHotspotAreas(filteredDetections);

    renderMap(filteredSites, filteredDetections, siteSummaries, hotspots);
    renderMetrics(filteredDetections, siteSummaries, hotspots);
    renderDailyChart(dateKeys, filteredDetections);
    renderHeritageList(siteSummaries);
    renderSelectedDetail(siteSummaries);
  }

  function getFilteredSites() {
    return heritageSites.filter((site) => state.categoryFilter.has(site.type));
  }

  function getDateKeys() {
    const end = dateFromInput();
    const keys = [];
    for (let i = state.rangeDays - 1; i >= 0; i -= 1) {
      const date = addDays(end, -i);
      keys.push(toDateInput(date));
    }
    return keys;
  }

  function getFilteredDetections(dateKeys) {
    const allowedDates = new Set(dateKeys);
    return state.detections.filter((detection) => {
      return (
        allowedDates.has(detection.acqDate) &&
        detection.confidence >= state.minConfidence &&
        detection.source === state.source
      );
    });
  }

  function buildSiteSummaries(sites, detections) {
    return sites.map((site) => {
      const nearby = detections
        .map((detection) => ({
          ...detection,
          distanceKm: distanceKm(site.lat, site.lng, detection.lat, detection.lng)
        }))
        .filter((detection) => detection.distanceKm <= state.radiusKm)
        .sort((a, b) => b.acqDate.localeCompare(a.acqDate));

      const closest = nearby.length ? Math.min(...nearby.map((detection) => detection.distanceKm)) : null;
      const risk = classifyRisk(nearby, closest);
      const stored = getManagementRecord(site.id);

      return {
        site,
        nearby,
        closest,
        risk,
        status: stored.status || "확인 필요",
        note: stored.note || ""
      };
    });
  }

  function classifyRisk(nearby, closest) {
    const strongFire = nearby.some((detection) => detection.confidence >= 80 || detection.frp >= 18);
    if (nearby.length >= 2 || (nearby.length === 1 && closest !== null && closest <= 5) || strongFire) {
      return "high";
    }
    if (nearby.length === 1 || (closest !== null && closest <= state.radiusKm)) {
      return "medium";
    }
    return "low";
  }

  function renderMap(sites, detections, summaries, hotspots) {
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
           <p class="popup-line">${hotspot.count}개 감지, 약 ${hotspot.areaKm2.toFixed(1)} km²</p>
           <p class="popup-line">최대 FRP ${hotspot.maxFrp.toFixed(1)}</p>`
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
          `<h3 class="popup-title">FIRMS 감지</h3>
           <p class="popup-line">${detection.acqDate} ${formatAcqTime(detection.acqTime)}</p>
           <p class="popup-line">신뢰도 ${detection.confidence}, FRP ${detection.frp}</p>`
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
        icon: createHeritageIcon(site)
      })
        .bindPopup(
          `<h3 class="popup-title">${site.name}</h3>
           <p class="popup-line">${typeLabel(site.type)} · ${site.region}</p>
           <p class="popup-line">반경 내 감지 ${summary ? summary.nearby.length : 0}건</p>`
        )
        .addTo(layers.heritage);

      marker.on("click", () => {
        selectSite(site.id);
      });
    });
  }

  function createHeritageIcon(site) {
    const letter = site.type === "temple" ? "寺" : site.type === "house" ? "古" : "文";
    return L.divIcon({
      className: "",
      html: `<div class="heritage-marker ${site.type}">${letter}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14]
    });
  }

  function renderMetrics(detections, summaries, hotspots) {
    const area = hotspots.reduce((total, hotspot) => total + hotspot.areaKm2, 0);
    const atRisk = summaries.filter((summary) => summary.nearby.length > 0).length;
    elements.metricDetections.textContent = detections.length.toLocaleString("ko-KR");
    elements.metricHotspotArea.textContent = `${area.toFixed(1)} km²`;
    elements.metricAtRisk.textContent = atRisk.toLocaleString("ko-KR");
  }

  function renderDailyChart(dateKeys, detections) {
    const daily = dateKeys.map((key) => ({
      key,
      count: detections.filter((detection) => detection.acqDate === key).length
    }));

    let running = 0;
    const cumulative = daily.map((item) => {
      running += item.count;
      return { ...item, cumulative: running };
    });

    const maxCount = Math.max(1, ...daily.map((item) => item.count));
    const maxCumulative = Math.max(1, ...cumulative.map((item) => item.cumulative));
    const width = Math.max(760, dateKeys.length * 74);
    const height = 235;
    const chartTop = 20;
    const chartBottom = 190;
    const chartHeight = chartBottom - chartTop;
    const step = width / dateKeys.length;
    const barWidth = Math.min(34, step * 0.42);
    const points = cumulative
      .map((item, index) => {
        const x = step * index + step / 2;
        const y = chartBottom - (item.cumulative / maxCumulative) * chartHeight;
        return `${x},${y}`;
      })
      .join(" ");

    const bars = daily
      .map((item, index) => {
        const x = step * index + step / 2 - barWidth / 2;
        const barHeight = (item.count / maxCount) * chartHeight;
        const y = chartBottom - barHeight;
        const label = item.key.slice(5);
        const cumulativeValue = cumulative[index].cumulative;
        return `
          <g>
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="#c94a35"></rect>
            <text x="${x + barWidth / 2}" y="${Math.max(15, y - 6)}" text-anchor="middle" font-size="11" font-weight="800" fill="#1f2522">${item.count}</text>
            <text x="${x + barWidth / 2}" y="214" text-anchor="middle" font-size="11" fill="#677069">${label}</text>
            <text x="${x + barWidth / 2}" y="230" text-anchor="middle" font-size="10" fill="#31755b">${cumulativeValue}</text>
          </g>
        `;
      })
      .join("");

    elements.dailyChart.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="일별 감지 수 막대와 누적 수 선">
        <line x1="0" y1="${chartBottom}" x2="${width}" y2="${chartBottom}" stroke="#ded8cc"></line>
        <line x1="0" y1="${chartTop}" x2="${width}" y2="${chartTop}" stroke="#eee8dc"></line>
        ${bars}
        <polyline points="${points}" fill="none" stroke="#31755b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${cumulative
          .map((item, index) => {
            const x = step * index + step / 2;
            const y = chartBottom - (item.cumulative / maxCumulative) * chartHeight;
            return `<circle cx="${x}" cy="${y}" r="4" fill="#31755b"></circle>`;
          })
          .join("")}
        <text x="0" y="12" font-size="11" font-weight="800" fill="#c94a35">일별</text>
        <text x="46" y="12" font-size="11" font-weight="800" fill="#31755b">누적</text>
      </svg>
    `;
  }

  function renderHeritageList(summaries) {
    const filtered = summaries
      .filter((summary) => state.riskFilter === "all" || summary.risk === state.riskFilter)
      .sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        return riskOrder[a.risk] - riskOrder[b.risk] || b.nearby.length - a.nearby.length;
      });

    if (!filtered.length) {
      elements.heritageList.innerHTML = `<div class="empty-state">조건에 맞는 문화유산이 없습니다.</div>`;
      return;
    }

    elements.heritageList.innerHTML = filtered
      .map((summary) => {
        const site = summary.site;
        const lastDate = summary.nearby[0] ? summary.nearby[0].acqDate : "-";
        const selectedClass = state.selectedSiteId === site.id ? " is-selected" : "";
        return `
          <button class="heritage-card${selectedClass}" type="button" data-site-id="${site.id}">
            <span class="heritage-card-top">
              <span>
                <strong>${site.name}</strong>
                <small>${typeLabel(site.type)} · ${site.region}</small>
              </span>
              <span class="risk-badge ${summary.risk}">${riskLabel(summary.risk)}</span>
            </span>
            <span class="heritage-card-meta">
              <span class="meta-pill">감지 ${summary.nearby.length}건</span>
              <span class="meta-pill">최근 ${lastDate}</span>
              <span class="meta-pill">${summary.status}</span>
            </span>
          </button>
        `;
      })
      .join("");

    elements.heritageList.querySelectorAll(".heritage-card").forEach((card) => {
      card.addEventListener("click", () => selectSite(card.dataset.siteId));
    });
  }

  function selectSite(siteId) {
    state.selectedSiteId = siteId;
    renderAll();
    const site = heritageSites.find((item) => item.id === siteId);
    if (site) {
      map.setView([site.lat, site.lng], Math.max(map.getZoom(), 10), { animate: true });
    }
  }

  function renderSelectedDetail(summaries) {
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
    elements.detailRegion.textContent = `${typeLabel(summary.site.type)} · ${summary.site.region}`;
    elements.detailName.textContent = summary.site.name;
    elements.detailRisk.textContent = riskLabel(summary.risk);
    elements.detailRisk.className = `risk-badge ${summary.risk}`;
    elements.detailCount.textContent = summary.nearby.length;
    elements.detailLast.textContent = summary.nearby[0] ? summary.nearby[0].acqDate.slice(5) : "-";
    elements.detailDistance.textContent =
      summary.closest === null ? "-" : `${summary.closest.toFixed(1)} km`;
    elements.managementStatus.value = summary.status;
    elements.managementNote.value = summary.note;

    if (!summary.nearby.length) {
      elements.historyTimeline.innerHTML = `<div class="empty-state">선택 기간 반경 내 감지 이력이 없습니다.</div>`;
      return;
    }

    elements.historyTimeline.innerHTML = summary.nearby
      .map((detection) => {
        return `
          <div class="timeline-item">
            <strong>${detection.acqDate} ${formatAcqTime(detection.acqTime)}</strong>
            <small>${detection.distanceKm.toFixed(1)} km · 신뢰도 ${detection.confidence} · FRP ${detection.frp}</small>
          </div>
        `;
      })
      .join("");
  }

  function buildHotspotAreas(detections) {
    const clusters = new Map();
    detections.forEach((detection) => {
      const key = `${Math.round(detection.lat / 0.18)}:${Math.round(detection.lng / 0.18)}`;
      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      clusters.get(key).push(detection);
    });

    return Array.from(clusters.values())
      .filter((cluster) => cluster.length >= 1)
      .map((cluster) => {
        const lat = average(cluster.map((item) => item.lat));
        const lng = average(cluster.map((item) => item.lng));
        const maxDistance = Math.max(
          2.5,
          ...cluster.map((item) => distanceKm(lat, lng, item.lat, item.lng))
        );
        const radiusKm = Math.min(28, maxDistance + 3 + cluster.length * 0.7);
        return {
          lat,
          lng,
          count: cluster.length,
          radiusKm,
          areaKm2: Math.PI * radiusKm * radiusKm,
          maxFrp: Math.max(...cluster.map((item) => item.frp))
        };
      });
  }

  function buildSampleDetections() {
    const end = dateFromInput();
    const results = [];

    sampleTemplates.forEach((template, index) => {
      const [siteId, dayOffset, a, b, confidence, frp, daynight] = template;
      let lat;
      let lng;
      if (siteId) {
        const site = heritageSites.find((item) => item.id === siteId);
        lat = site.lat + a;
        lng = site.lng + b;
      } else {
        lat = a;
        lng = b;
      }

      const date = addDays(end, dayOffset);
      results.push({
        id: `sample-${index}`,
        lat,
        lng,
        acqDate: toDateInput(date),
        acqTime: `${String(930 + (index * 37) % 920).padStart(4, "0")}`,
        confidence,
        frp,
        source: state.source,
        daynight
      });
    });

    return results;
  }

  async function loadLiveFirms() {
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
        endDate: dateFromInput(),
        rangeDays: state.rangeDays
      });
      state.usingLiveData = true;
      state.detections = detections;
      elements.dataStatus.textContent = `${detections.length.toLocaleString("ko-KR")}개 FIRMS 감지를 불러왔습니다.`;
      renderAll();
    } catch (error) {
      elements.dataStatus.textContent = `FIRMS 불러오기 실패: ${error.message}`;
    } finally {
      elements.loadFirms.disabled = false;
    }
  }

  async function fetchFirmsArea({ mapKey, source, bbox, endDate, rangeDays }) {
    const chunks = buildFirmsChunks(endDate, rangeDays);
    const allRows = [];

    for (const chunk of chunks) {
      const area = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(
        mapKey
      )}/${source}/${area}/${chunk.days}/${chunk.start}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const csv = await response.text();
      allRows.push(...parseFirmsCsv(csv, source));
    }

    return allRows;
  }

  function buildFirmsChunks(endDate, rangeDays) {
    const chunks = [];
    let remaining = rangeDays;
    let start = addDays(endDate, -(rangeDays - 1));

    while (remaining > 0) {
      const days = Math.min(10, remaining);
      chunks.push({ start: toDateInput(start), days });
      start = addDays(start, days);
      remaining -= days;
    }

    return chunks;
  }

  function parseFirmsCsv(csv, source) {
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) {
      return [];
    }

    const headers = splitCsvLine(lines[0]);
    return lines.slice(1).map((line, index) => {
      const values = splitCsvLine(line);
      const row = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex]]));
      return {
        id: `firms-${row.latitude}-${row.longitude}-${row.acq_date}-${row.acq_time}-${index}`,
        lat: Number(row.latitude),
        lng: Number(row.longitude),
        acqDate: row.acq_date,
        acqTime: row.acq_time || "",
        confidence: normalizeConfidence(row.confidence),
        frp: Number(row.frp || 0),
        source,
        daynight: row.daynight || ""
      };
    });
  }

  function splitCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  function normalizeConfidence(value) {
    if (value === undefined || value === null || value === "") {
      return 0;
    }
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
    const lower = String(value).toLowerCase();
    if (lower === "h" || lower === "high") {
      return 85;
    }
    if (lower === "n" || lower === "nominal") {
      return 55;
    }
    if (lower === "l" || lower === "low") {
      return 25;
    }
    return 0;
  }

  function exportCurrentCsv() {
    const dateKeys = getDateKeys();
    const detections = getFilteredDetections(dateKeys);
    const sites = getFilteredSites();
    const summaries = buildSiteSummaries(sites, detections);
    const rows = [
      ["heritage_id", "heritage_name", "type", "region", "risk", "nearby_count", "last_detection", "closest_km", "status"]
    ];

    summaries.forEach((summary) => {
      rows.push([
        summary.site.id,
        summary.site.name,
        typeLabel(summary.site.type),
        summary.site.region,
        riskLabel(summary.risk),
        summary.nearby.length,
        summary.nearby[0] ? summary.nearby[0].acqDate : "",
        summary.closest === null ? "" : summary.closest.toFixed(2),
        summary.status
      ]);
    });

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fire-stone-heritage-risk-${toDateInput(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function saveManagementRecord() {
    if (!state.selectedSiteId) {
      return;
    }
    const records = JSON.parse(localStorage.getItem("fireStoneManagement") || "{}");
    records[state.selectedSiteId] = {
      status: elements.managementStatus.value,
      note: elements.managementNote.value,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem("fireStoneManagement", JSON.stringify(records));
    elements.dataStatus.textContent = "관리 상태와 메모를 저장했습니다.";
    renderAll();
  }

  function getManagementRecord(siteId) {
    const records = JSON.parse(localStorage.getItem("fireStoneManagement") || "{}");
    return records[siteId] || {};
  }

  function dateFromInput() {
    const value = elements.endDate.value || toDateInput(new Date());
    return parseDate(value);
  }

  function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function distanceKm(lat1, lng1, lat2, lng2) {
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  function toRadians(value) {
    return (value * Math.PI) / 180;
  }

  function average(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function typeLabel(type) {
    return {
      temple: "사찰",
      heritage: "문화유산",
      house: "고택·마을"
    }[type];
  }

  function riskLabel(risk) {
    return {
      high: "높음",
      medium: "주의",
      low: "낮음"
    }[risk];
  }

  function formatAcqTime(value) {
    if (!value) {
      return "";
    }
    const padded = String(value).padStart(4, "0");
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  init();
})();
