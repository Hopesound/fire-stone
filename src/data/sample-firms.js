import { heritageSites } from "./heritage-sites.js";
import { toDateInput, addDays } from "../utils/date.js";

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
  [null, -15, 37.42, 127.88, 70, 10.4, 318.7, "D"]
];

export function buildSampleDetections({ endDate, source }) {
  return templates.map((template, index) => {
    const [siteId, dayOffset, a, b, confidence, frp, brightnessKelvin, daynight] = template;
    const site = heritageSites.find((item) => item.id === siteId);
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
