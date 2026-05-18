import { generatedHeritageSites } from "./heritage-sites.generated.js";

export const sampleHeritageSites = [
  {
    id: "bulguksa",
    name: "경주 불국사",
    type: "temple",
    region: "경북 경주시",
    lat: 35.7901,
    lng: 129.3321,
    inscriptionYear: 1995,
    protectedRadiusKm: 2,
    manager: "경주시 문화유산과"
  },
  {
    id: "haeinsa",
    name: "합천 해인사 장경판전",
    type: "temple",
    region: "경남 합천군",
    lat: 35.8019,
    lng: 128.0982,
    inscriptionYear: 1995,
    protectedRadiusKm: 3,
    manager: "합천군 문화관광과"
  },
  {
    id: "hahoemaeul",
    name: "안동 하회마을",
    type: "house",
    region: "경북 안동시",
    lat: 36.5394,
    lng: 128.5187,
    inscriptionYear: 2010,
    protectedRadiusKm: 2,
    manager: "안동시 세계유산과"
  },
  {
    id: "jongmyo",
    name: "서울 종묘",
    type: "heritage",
    region: "서울 종로구",
    lat: 37.5747,
    lng: 126.9941,
    inscriptionYear: 1995,
    protectedRadiusKm: 1,
    manager: "종로구 문화과"
  }
];

export const heritageSites = generatedHeritageSites.length ? generatedHeritageSites : sampleHeritageSites;
