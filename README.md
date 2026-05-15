# fire-stone

NASA FIRMS hotspot data and Korean cultural heritage fire-risk monitoring prototype.

## What this draft includes

- Interactive map for cultural heritage locations such as temples, historic houses, and heritage sites.
- Street map and aerial-photo style basemap switching.
- NASA FIRMS-compatible data adapter for VIIRS/MODIS area CSV queries.
- Sample fire detection data so the prototype works without an API key.
- 7-day and 14-day cumulative daily views.
- Hotspot-area visualization based on clustered detections.
- Heritage-nearby fire history, risk level, management status, notes, and CSV export.

## Open the prototype

Open `index.html` in a browser, or run a local static server:

```powershell
node tools/serve.mjs 5173
```

Then visit `http://127.0.0.1:5173`. Internet access is required for the Leaflet map library and OpenStreetMap tiles.

## NASA FIRMS integration notes

NASA FIRMS Area API format:

```text
https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]/[DATE]
```

Important constraints used by this prototype:

- `DAY_RANGE` supports 1 to 10 days per request, so a 14-day view is split into multiple FIRMS calls.
- `AREA_COORDINATES` uses `west,south,east,north`.
- `DATE` is the query start date in `YYYY-MM-DD`.
- A free FIRMS `MAP_KEY` is required for live data.

Official references:

- https://firms.modaps.eosdis.nasa.gov/api/area/csv
- https://firms2.modaps.eosdis.nasa.gov/api/

## Suggested next build steps

1. Replace the sample `heritageSites` array in `app.js` with an official cultural-heritage dataset.
2. Add a small backend proxy for FIRMS requests if browser CORS or key handling becomes an issue.
3. Store inspection status, notes, and incident records in a database instead of local storage.
4. Add user roles for managers, field inspectors, and analysts.
5. Add notifications when a new FIRMS detection appears within a managed radius.
