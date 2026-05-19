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

export function buildEnvironmentRisk(site, factors = {}) {
  const enabled = {
    conifer: factors.conifer !== false,
    slope: factors.slope !== false
  };
  const profile = findRegionProfile(site.region || "");
  const terrainSignal = Math.sin(site.lat * 8.73 + site.lng * 3.91) * 8;
  const templeBoost = site.type === "temple" ? 10 : 0;
  const protectionBoost = site.isProtectionZone ? 7 : 0;
  const urbanPenalty = site.type === "house" ? -6 : 0;

  const coniferScore = clamp(profile.conifer + terrainSignal + templeBoost + protectionBoost + urbanPenalty);
  const slopeScore = clamp(profile.slope - terrainSignal / 2 + templeBoost * 0.7 + protectionBoost);
  const activeConifer = enabled.conifer ? coniferScore : 0;
  const activeSlope = enabled.slope ? slopeScore : 0;
  const combinedScore =
    (enabled.conifer && enabled.slope)
      ? activeConifer * 0.55 + activeSlope * 0.45
      : activeConifer + activeSlope;
  const multiplier = 1 + activeConifer * 0.0018 + activeSlope * 0.0012;
  const baseScore = activeConifer * 0.035 + activeSlope * 0.03;
  const priorityBoost = activeConifer * 0.08 + activeSlope * 0.07;
  const grade = classifyEnvironment(combinedScore);

  return {
    coniferScore,
    slopeScore,
    combinedScore: Math.round(combinedScore * 10) / 10,
    multiplier: Math.round(multiplier * 1000) / 1000,
    baseScore: Math.round(baseScore * 10) / 10,
    priorityBoost: Math.round(priorityBoost * 10) / 10,
    grade,
    label: grade === "high" ? "환경 높음" : grade === "medium" ? "환경 주의" : "환경 낮음",
    enabled
  };
}

function findRegionProfile(region) {
  return PROVINCE_PROFILES.find((profile) => profile.pattern.test(region)) || { conifer: 45, slope: 42 };
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
