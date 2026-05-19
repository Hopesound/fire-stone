import {
  CHUNGNAM_STEEP_SLOPE_COUNTS,
  CONIFER_PLANTING_SERIES,
  ENVIRONMENT_DATASET_META
} from "../data/environment-datasets.js";

const PROVINCE_PROFILES = [
  { pattern: /강원/, conifer: 86, slope: 82 },
  { pattern: /경북|경상북/, conifer: 72, slope: 68 },
  { pattern: /충북|충청북/, conifer: 64, slope: 60 },
  { pattern: /경남|경상남/, conifer: 58, slope: 63 },
  { pattern: /전북|전라북/, conifer: 54, slope: 57 },
  { pattern: /전남|전라남/, conifer: 48, slope: 52 },
  { pattern: /제주/, conifer: 36, slope: 48 },
  { pattern: /충남|충청남/, conifer: 42, slope: 38 },
  { pattern: /경기/, conifer: 40, slope: 36 },
  { pattern: /서울|인천|대전|대구|광주|부산|울산|세종/, conifer: 24, slope: 24 }
];

const coniferSignal = buildConiferPlantingSignal();
const maxSteepSlopeCount = Math.max(...CHUNGNAM_STEEP_SLOPE_COUNTS.map((item) => item.count));

export function buildEnvironmentRisk(site, factors = {}) {
  const enabled = {
    conifer: factors.conifer !== false,
    slope: factors.slope !== false
  };
  const profile = findRegionProfile(site.region || "");
  const slopeSignal = buildSteepSlopeSignal(site.region || "");
  const terrainSignal = Math.sin(site.lat * 8.73 + site.lng * 3.91) * 8;
  const templeBoost = site.type === "temple" ? 10 : 0;
  const protectionBoost = site.isProtectionZone ? 7 : 0;
  const urbanPenalty = site.type === "house" ? -6 : 0;

  const profileConifer = profile.conifer + terrainSignal + templeBoost + protectionBoost + urbanPenalty;
  const profileSlope = profile.slope - terrainSignal / 2 + templeBoost * 0.7 + protectionBoost;
  const coniferScore = clamp(coniferSignal ? profileConifer * 0.7 + coniferSignal.score * 0.3 : profileConifer);
  const slopeScore = clamp(slopeSignal ? profileSlope * 0.45 + slopeSignal.score * 0.55 : profileSlope);
  const activeConifer = enabled.conifer ? coniferScore : 0;
  const activeSlope = enabled.slope ? slopeScore : 0;
  const combinedScore =
    enabled.conifer && enabled.slope
      ? activeConifer * 0.55 + activeSlope * 0.45
      : activeConifer + activeSlope;
  const multiplier = 1 + activeConifer * 0.0018 + activeSlope * 0.0012;
  const baseScore = activeConifer * 0.035 + activeSlope * 0.03;
  const priorityBoost = activeConifer * 0.08 + activeSlope * 0.07;
  const grade = classifyEnvironment(combinedScore);
  const evidence = {
    conifer: coniferSignal,
    slope: slopeSignal
  };

  return {
    coniferScore,
    slopeScore,
    combinedScore: Math.round(combinedScore * 10) / 10,
    multiplier: Math.round(multiplier * 1000) / 1000,
    baseScore: Math.round(baseScore * 10) / 10,
    priorityBoost: Math.round(priorityBoost * 10) / 10,
    grade,
    label: grade === "high" ? "환경 높음" : grade === "medium" ? "환경 주의" : "환경 낮음",
    enabled,
    evidence,
    evidenceSummary: summarizeEvidence(evidence)
  };
}

export function getEnvironmentDatasetMeta() {
  return ENVIRONMENT_DATASET_META;
}

function buildConiferPlantingSignal() {
  const latest = CONIFER_PLANTING_SERIES[CONIFER_PLANTING_SERIES.length - 1];
  if (!latest) {
    return null;
  }
  const totals = CONIFER_PLANTING_SERIES.map((item) => item.total);
  const average = totals.reduce((sum, value) => sum + value, 0) / totals.length;
  const peak = Math.max(...totals);
  const trendPct = ((latest.total - CONIFER_PLANTING_SERIES[0].total) / CONIFER_PLANTING_SERIES[0].total) * 100;
  const ratioToAverage = latest.total / average;
  const ratioToPeak = latest.total / peak;
  const trendAdjustment = trendPct < -20 ? -4 : trendPct < 0 ? -1 : 4;
  const score = clamp(45 + Math.min(1.2, ratioToAverage) * 25 + Math.min(1, ratioToPeak) * 20 + trendAdjustment);

  return {
    source: ENVIRONMENT_DATASET_META.coniferPlanting.source,
    asOf: ENVIRONMENT_DATASET_META.coniferPlanting.asOf,
    latestYear: latest.year,
    latestTotalAreaHa: latest.total,
    fiveYearAverageHa: Math.round(average * 100) / 100,
    trendPct: Math.round(trendPct * 10) / 10,
    score
  };
}

function buildSteepSlopeSignal(region) {
  const cleanRegion = normalizeRegion(region);
  if (!/충남|충청남/.test(cleanRegion)) {
    return null;
  }

  const matched = CHUNGNAM_STEEP_SLOPE_COUNTS.find((item) => cleanRegion.includes(item.city));
  const provinceFallback = CHUNGNAM_STEEP_SLOPE_COUNTS.find((item) => item.city === "충남");
  const profile = matched || provinceFallback;
  const count = profile?.count || 0;
  const score = clamp(35 + Math.sqrt(count / maxSteepSlopeCount) * 50);

  return {
    source: ENVIRONMENT_DATASET_META.steepSlope.source,
    asOf: ENVIRONMENT_DATASET_META.steepSlope.asOf,
    city: matched?.city || "충남 광역",
    count,
    totalCount: ENVIRONMENT_DATASET_META.steepSlope.totalCount,
    score,
    matched: Boolean(matched)
  };
}

function summarizeEvidence(evidence) {
  const parts = [];
  if (evidence.conifer) {
    parts.push(`침엽수 ${evidence.conifer.latestYear}년 ${evidence.conifer.latestTotalAreaHa.toLocaleString("ko-KR")}ha`);
  }
  if (evidence.slope) {
    parts.push(`급경사지 ${evidence.slope.city} ${evidence.slope.count}건`);
  }
  return parts.join(" · ");
}

function findRegionProfile(region) {
  const cleanRegion = normalizeRegion(region);
  return PROVINCE_PROFILES.find((profile) => profile.pattern.test(cleanRegion)) || { conifer: 45, slope: 42 };
}

function normalizeRegion(region) {
  return String(region || "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function classifyEnvironment(score) {
  if (score >= 70) {
    return "high";
  }
  if (score >= 45) {
    return "medium";
  }
  return "low";
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
