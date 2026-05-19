import { buildEnvironmentRisk } from "./environment-risk.js";

export function filterDetections(detections, { dateKeys, minConfidence, source }) {
  const allowedDates = new Set(dateKeys);
  return detections.filter((detection) => {
    return (
      allowedDates.has(detection.acqDate) &&
      detection.confidence >= minConfidence &&
      detection.source === source
    );
  });
}

export function analyzeHeritageRisk(sites, detections, options) {
  const { radiusKm, mediumThreshold, highThreshold, getStoredRecord, environmentFactors } = options;

  return sites.map((site) => {
    const environment = buildEnvironmentRisk(site, environmentFactors);
    const nearby = detections
      .map((detection) => {
        const distance = distanceKm(site.lat, site.lng, detection.lat, detection.lng);
        const weight = distanceWeight(distance, radiusKm);
        return {
          ...detection,
          distanceKm: distance,
          weight,
          weightedFrp: weight * detection.frp
        };
      })
      .filter((detection) => detection.distanceKm <= radiusKm)
      .sort((a, b) => b.acqDate.localeCompare(a.acqDate) || b.weightedFrp - a.weightedFrp);

    const fireRiskScore = nearby.reduce((sum, detection) => sum + detection.weightedFrp, 0);
    const riskScore = fireRiskScore * environment.multiplier + environment.baseScore;
    const frpSum = nearby.reduce((sum, detection) => sum + detection.frp, 0);
    const closest = nearby.length ? Math.min(...nearby.map((detection) => detection.distanceKm)) : null;
    const maxFrp = nearby.length ? Math.max(...nearby.map((detection) => detection.frp)) : 0;
    const avgFrp = nearby.length ? frpSum / nearby.length : 0;
    const maxBrightness = nearby.length ? Math.max(...nearby.map((detection) => detection.brightnessKelvin || 0)) : 0;
    const avgBrightness = nearby.length
      ? nearby.reduce((sum, detection) => sum + (detection.brightnessKelvin || 0), 0) / nearby.length
      : 0;
    const risk = classifyRiskScore(riskScore, mediumThreshold, highThreshold);
    const stored = getStoredRecord(site.id);

    return {
      site,
      nearby,
      risk,
      riskScore,
      fireRiskScore,
      environment,
      frpSum,
      avgFrp,
      maxFrp,
      avgBrightness,
      maxBrightness,
      closest,
      status: stored.status || "확인 필요",
      note: stored.note || ""
    };
  });
}

export function classifyRiskScore(score, mediumThreshold, highThreshold) {
  if (score >= highThreshold) {
    return "high";
  }
  if (score >= mediumThreshold) {
    return "medium";
  }
  return "low";
}

export function aggregateDaily(dateKeys, detections, summaries) {
  let cumulativeCount = 0;
  let cumulativeScore = 0;
  return dateKeys.map((key) => {
    const count = detections.filter((detection) => detection.acqDate === key).length;
    const score = summaries.reduce((sum, summary) => {
      const dateFireScore = summary.nearby
        .filter((detection) => detection.acqDate === key)
        .reduce((dateSum, detection) => dateSum + detection.weightedFrp, 0);
      const environmentDailyScore = (summary.environment?.baseScore || 0) / dateKeys.length;
      return sum + dateFireScore * (summary.environment?.multiplier || 1) + environmentDailyScore;
    }, 0);
    cumulativeCount += count;
    cumulativeScore += score;
    return { key, count, score, cumulativeCount, cumulativeScore };
  });
}

export function buildHotspotAreas(detections) {
  const clusters = new Map();
  detections.forEach((detection) => {
    const key = `${Math.round(detection.lat / 0.18)}:${Math.round(detection.lng / 0.18)}`;
    if (!clusters.has(key)) {
      clusters.set(key, []);
    }
    clusters.get(key).push(detection);
  });

  return Array.from(clusters.values()).map((cluster) => {
    const lat = average(cluster.map((item) => item.lat));
    const lng = average(cluster.map((item) => item.lng));
    const maxDistance = Math.max(2.5, ...cluster.map((item) => distanceKm(lat, lng, item.lat, item.lng)));
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

export function buildAlertCandidates(summaries) {
  return summaries
    .filter((summary) => summary.risk === "high" || summary.risk === "medium")
    .sort((a, b) => b.riskScore - a.riskScore);
}

export function distanceKm(lat1, lng1, lat2, lng2) {
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

function distanceWeight(distanceKm, radiusKm) {
  return 1 / (1 + Math.pow(distanceKm / radiusKm, 2));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
