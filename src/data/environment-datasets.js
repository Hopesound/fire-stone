export const ENVIRONMENT_DATASET_META = {
  steepSlope: {
    source: "충청남도 재난안전포털 급경사지 현황",
    asOf: "2025-11-30",
    totalCount: 264,
    matchLevel: "주소의 시군명 기준",
    limitation: "원본 CSV에 좌표가 없어 문화유산 지역명과 시군 단위로 매칭합니다."
  },
  coniferPlanting: {
    source: "산림청 수종별 조림면적(침엽수) 시계열 데이터",
    asOf: "2024-12-31",
    unit: "ha",
    latestYear: 2024,
    latestTotalAreaHa: 10600,
    fiveYearAverageHa: 12673.58,
    trendPct2020To2024: -27.5,
    limitation: "전국 단위 조림면적 시계열이므로 지역별 산림도 자료가 들어오기 전까지 연료 취약도 보정 신호로 사용합니다."
  }
};

export const CHUNGNAM_STEEP_SLOPE_COUNTS = [
  { city: "금산군", count: 31 },
  { city: "당진시", count: 27 },
  { city: "천안시", count: 24 },
  { city: "아산시", count: 22 },
  { city: "태안군", count: 22 },
  { city: "계룡시", count: 21 },
  { city: "공주시", count: 19 },
  { city: "홍성군", count: 19 },
  { city: "논산시", count: 18 },
  { city: "청양군", count: 14 },
  { city: "충남", count: 11 },
  { city: "서산시", count: 11 },
  { city: "서천군", count: 10 },
  { city: "예산군", count: 6 },
  { city: "보령시", count: 5 },
  { city: "부여군", count: 4 }
];

export const CONIFER_PLANTING_SERIES = [
  { year: 2020, pine: 3946.7, koreanPine: 240.1, larch: 4711.1, cedar: 0, cypress: 5085, blackPine: 198.8, other: 438.4, total: 14620.1 },
  { year: 2021, pine: 2714.7, koreanPine: 187.7, larch: 4720.9, cedar: 0, cypress: 4532.1, blackPine: 145.9, other: 324.1, total: 12625.4 },
  { year: 2022, pine: 2301.7, koreanPine: 187.1, larch: 4931.7, cedar: 120.1, cypress: 4091.62, blackPine: 81.2, other: 358.8, total: 12072.22 },
  { year: 2023, pine: 3504.28, koreanPine: 221.6, larch: 4553.6, cedar: 0, cypress: 4605.91, blackPine: 81.8, other: 483, total: 13450.19 },
  { year: 2024, pine: 2666.8, koreanPine: 100.1, larch: 3873.9, cedar: 0, cypress: 3642.5, blackPine: 50.5, other: 266.2, total: 10600 }
];
