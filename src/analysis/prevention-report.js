import { RISK_LABELS, TYPE_LABELS } from "../config.js";

export function buildPreventionReport(summaries, options) {
  const { radiusKm, mediumThreshold, highThreshold } = options;

  return summaries
    .map((summary) => {
      const nearest = summary.nearby.length
        ? summary.nearby.reduce((best, current) => (current.distanceKm < best.distanceKm ? current : best), summary.nearby[0])
        : null;
      const latest = summary.nearby[0] || null;
      const priorityScore = buildPriorityScore(summary, highThreshold);
      const priority = classifyPriority(summary.risk, priorityScore);
      const action = buildPreventionAction(summary, nearest, priority);

      return {
        id: summary.site.id,
        heritageCode: summary.site.heritageCode || "",
        name: summary.site.name,
        type: TYPE_LABELS[summary.site.type] || summary.site.type,
        designation: summary.site.designation || summary.site.sourceLayer || "",
        region: summary.site.region || "",
        latitude: summary.site.lat,
        longitude: summary.site.lng,
        areaM2: summary.site.areaM2 || 0,
        protectedRadiusKm: summary.site.protectedRadiusKm || 0,
        analysisRadiusKm: radiusKm,
        risk: summary.risk,
        riskLabel: RISK_LABELS[summary.risk],
        riskScore: summary.riskScore,
        priority,
        priorityScore,
        nearbyPixels: summary.nearby.length,
        frpSum: summary.frpSum,
        maxFrp: summary.maxFrp,
        avgFrp: summary.avgFrp,
        maxBrightness: summary.maxBrightness,
        closestKm: summary.closest,
        nearestFireDate: nearest ? nearest.acqDate : "",
        nearestFireTime: nearest ? nearest.acqTime : "",
        nearestFireLat: nearest ? nearest.lat : "",
        nearestFireLng: nearest ? nearest.lng : "",
        nearestFireFrp: nearest ? nearest.frp : 0,
        nearestFireConfidence: nearest ? nearest.confidence : 0,
        latestFireDate: latest ? latest.acqDate : "",
        actionLevel: action.level,
        actionTitle: action.title,
        actionItems: action.items,
        thresholdMemo: `주의 ${mediumThreshold}, 높음 ${highThreshold}`
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || b.riskScore - a.riskScore);
}

export function summarizeReport(report) {
  const high = report.filter((item) => item.risk === "high").length;
  const medium = report.filter((item) => item.risk === "medium").length;
  const immediate = report.filter((item) => item.priority === "즉시점검").length;
  const watch = report.filter((item) => item.priority === "강화모니터링").length;
  const topScore = report.length ? report[0].riskScore : 0;
  return { high, medium, immediate, watch, topScore };
}

function buildPriorityScore(summary, highThreshold) {
  const nearestFactor = summary.closest === null ? 0 : Math.max(0, 20 - summary.closest * 2);
  const scoreFactor = highThreshold > 0 ? (summary.riskScore / highThreshold) * 60 : summary.riskScore;
  const densityFactor = Math.min(20, summary.nearby.length * 3);
  const powerFactor = Math.min(20, summary.maxFrp / 2);
  return Math.round((scoreFactor + nearestFactor + densityFactor + powerFactor) * 10) / 10;
}

function classifyPriority(risk, priorityScore) {
  if (risk === "high" || priorityScore >= 75) {
    return "즉시점검";
  }
  if (risk === "medium" || priorityScore >= 35) {
    return "강화모니터링";
  }
  return "정상관리";
}

function buildPreventionAction(summary, nearest, priority) {
  if (priority === "즉시점검") {
    return {
      level: "emergency",
      title: "현장 확인과 방재 자원 대기",
      items: [
        "관리자에게 즉시 알림을 발송하고 관할 소방·지자체 연락망을 확인합니다.",
        "문화유산 주변 가연물, 탐방로, 전기 설비, 산림 접경부를 우선 점검합니다.",
        nearest
          ? `최근 탐지 픽셀 위치(${nearest.lat.toFixed(5)}, ${nearest.lng.toFixed(5)})와 문화유산 간 최단거리 ${nearest.distanceKm.toFixed(1)} km를 현장지도에 표시합니다.`
          : "FIRMS 탐지 위치를 현장지도에 표시합니다."
      ]
    };
  }

  if (priority === "강화모니터링") {
    return {
      level: "watch",
      title: "상황 모니터링과 예방 점검",
      items: [
        "다음 위성 갱신 주기까지 FIRMS 감지 변화와 FRP 증가 여부를 확인합니다.",
        "건조·강풍 예보가 있으면 순찰 주기와 CCTV 확인 빈도를 높입니다.",
        "소화전, 방화수, 진입로, 비상 연락망 상태를 사전 확인합니다."
      ]
    };
  }

  return {
    level: "normal",
    title: "정기 관리 유지",
    items: [
      "정기 순찰과 방재 설비 점검 일정을 유지합니다.",
      "FIRMS 감지 수, FRP, 최단거리 지표가 상승하면 강화모니터링으로 전환합니다."
    ]
  };
}
