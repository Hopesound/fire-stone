import { toDateInput, addDays } from "../utils/date.js";

const referenceSites = {
  bulguksa: { lat: 35.7901, lng: 129.3321 },
  haeinsa: { lat: 35.8019, lng: 128.0982 },
  hahoemaeul: { lat: 36.5394, lng: 128.5187 },
  yangdong: { lat: 36.0038, lng: 129.2538 },
  jongmyo: { lat: 37.5747, lng: 126.9941 },
  songgwangsa: { lat: 35.0026, lng: 127.2762 },
  buseoksa: { lat: 36.9988, lng: 128.6876 },
  magoksa: { lat: 36.5583, lng: 127.0135 },
  nagan: { lat: 34.9044, lng: 127.3427 },
  yunjeung: { lat: 36.2014, lng: 127.0892 }
};

const templates = [
  ["haeinsa", -1, 0.012, -0.016, 88, 18.5, 341.7, "N"],
  ["haeinsa", -5, -0.028, 0.019, 72, 12.1, 323.2, "D"],
  ["bulguksa", -2, 0.022, 0.015, 83, 28.4, 352.1, "D"],
  ["bulguksa", -11, -0.05, 0.031, 47, 4.6, 305.7, "N"],
  ["hahoemaeul", -3, -0.018, 0.026, 79, 15.9, 336.3, "D"],
  ["hahoemaeul", -6, 0.036, -0.021, 71, 17.3, 331.2, "N"],
  ["yangdong", -4, -0.025, 0.018, 67, 11.2, 319.4, "D"],
  ["jongmyo", -9, 0.042, 0.029, 55, 6.7, 309.8, "D"],
  ["songgwangsa", -1, 0.018, -0.022, 91, 22.6, 358.5, "N"],
  ["songgwangsa", -8, -0.034, 0.014, 73, 13.4, 327.7, "D"],
  ["buseoksa", -7, 0.031, -0.018, 78, 15.7, 329.6, "D"],
  ["magoksa", -10, -0.026, -0.023, 69, 9.6, 316.3, "N"],
  ["nagan", -13, 0.02, 0.027, 77, 14.2, 326.9, "D"],
  ["yunjeung", -12, -0.019, 0.018, 66, 8.2, 312.1, "D"],
  [null, -2, 35.32, 128.91, 84, 19.3, 345.8, "D"],
  [null, -4, 37.12, 128.72, 76, 12.8, 326.2, "N"],
  [null, -6, 34.76, 126.88, 54, 7.1, 306.5, "D"],
  [null, -9, 36.24, 129.12, 62, 8.7, 311.4, "D"],
  [null, -14, 35.18, 127.74, 49, 5.6, 302.2, "N"],
  [null, -15, 37.42, 127.88, 70, 10.4, 318.7, "D"],
  ["songgwangsa", -24, -0.022, 0.026, 86, 19.4, 346.1, "D"],
  ["buseoksa", -28, -0.027, 0.021, 75, 11.9, 324.8, "N"],
  ["magoksa", -46, 0.018, -0.03, 82, 16.7, 337.5, "D"],
  ["nagan", -63, -0.025, 0.019, 74, 12.3, 323.1, "D"],
  ["yangdong", -94, 0.029, -0.02, 80, 14.9, 331.6, "N"],
  ["haeinsa", -128, 0.034, -0.018, 78, 15.1, 329.8, "D"],
  ["bulguksa", -186, -0.026, 0.021, 84, 20.2, 348.7, "D"],
  ["hahoemaeul", -241, 0.031, -0.018, 73, 13.6, 326.4, "N"],
  ["yunjeung", -318, 0.022, -0.025, 77, 12.8, 324.6, "D"],
  ["jongmyo", -360, -0.019, 0.023, 71, 10.9, 319.5, "D"]
];

export function buildSampleDetections({ endDate, source }) {
  return templates.map((template, index) => {
    const [siteId, dayOffset, a, b, confidence, frp, brightnessKelvin, daynight] = template;
    const site = referenceSites[siteId];
    const date = addDays(endDate, dayOffset);
    const lat = site ? site.lat + a : a;
    const lng = site ? site.lng + b : b;
    const pixelKm = source === "MODIS_NRT" ? 1 : 0.375;

    return {
      id: `sample-${index}`,
      lat,
      lng,
      acqDate: toDateInput(date),
      acqTime: `${String(930 + (index * 37) % 920).padStart(4, "0")}`,
      source,
      satellite: source === "MODIS_NRT" ? (index % 2 ? "Aqua" : "Terra") : source.includes("NOAA21") ? "NOAA-21" : source.includes("NOAA20") ? "NOAA-20" : "Suomi NPP",
      confidence,
      frp,
      brightnessKelvin,
      scanKm: pixelKm,
      trackKm: pixelKm,
      fireType: "vegetation",
      daynight
    };
  });
}
