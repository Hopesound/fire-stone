# Fire Stone

문화유산 위치 기반 재해 위험도 자동 분석 프로그램 초안입니다. NASA FIRMS 활성 화재/열적 이상 데이터를 문화유산 위치와 결합해 반경 내 위험 점수, 등급, 알림 후보, 지도 시각화를 제공합니다.

## 포함 기능

- 문화유산 위치 지도 표시, 일반지도/항공사진 전환
- 메인 화면 내 분석 보기 전환: `#daily` 위험점수, `#report` 순위보고서, `#heritage` 위험도
- 직접 접근 가능한 HTML 분석 페이지: `risk-score.html`, `priority-report.html`, `heritage-risk.html`
- NASA FIRMS Area API 호환 CSV 수집 어댑터
- `heritage/` 폴더의 Shapefile 문화유산 데이터를 지도 중심점으로 변환해 표시
- MAP_KEY 없이 검토 가능한 샘플 FIRMS 픽셀 데이터
- 주/월/년 단위 일별 감지 수, 누적 위험 점수 차트
- 거리 가중 FRP 기반 위험도 자동 산출
- 문화유산별 인근 화재 픽셀 이력, 관리 상태, 메모, CSV 내보내기
- 주의/높음 등급 문화유산 알림 후보 목록
- 위험 점수, 좌표, 최단거리, FRP, 예방 조치를 포함한 의사결정 보고서

## 구조

```text
app.js                         # 브라우저 진입점
src/config.js                  # 분석 기본값과 라벨
heritage/                      # 국가/시도 지정·등록 유산 및 보호구역 Shapefile
tools/convert-heritage.mjs     # Shapefile -> WGS84 중심점 데이터 변환
src/data/heritage-sites.js     # 생성 데이터 로딩과 샘플 fallback
src/data/heritage-sites.generated.js # heritage 폴더에서 생성된 문화유산 위치 데이터
src/data/sample-firms.js       # FIRMS 형태 샘플 데이터 생성
src/services/firms-api.js      # NASA FIRMS Area API 수집/CSV 파서
src/services/storage.js        # 관리 상태 로컬 저장
src/analysis/risk-engine.js    # 반경 검색, 거리 가중치, 위험 점수, 알림 후보
src/analysis/prevention-report.js # 예방 우선순위 보고서와 조치 권고
src/main.js                    # 지도/대시보드 UI 조립
```

## 위험도 공식

각 문화유산 반경 `r` 안의 화재 픽셀에 대해 거리 `d`를 계산하고, 다음 가중치를 적용합니다.

```text
weight = 1 / (1 + (d / r)^2)
risk_score = sum(weight * FRP)
```

기본 등급:

- 높음: `risk_score >= 50`
- 주의: `10 <= risk_score < 50`
- 낮음: `risk_score < 10`

임계값은 화면 좌측 `위험도 기준`에서 조정할 수 있습니다.

## 보고서 산출 항목

화면의 `재난 예방 우선순위 보고서`는 각 문화유산별로 다음 항목을 산출합니다.

- 문화유산명, 지정구분, 지역, 위도/경도
- 위험 등급, 위험 점수, 예방 우선순위
- 반경 내 FIRMS 픽셀 수, FRP 합계/최대값
- 문화유산과 가장 가까운 FIRMS 픽셀의 좌표, 관측일시, 신뢰도
- 즉시점검/강화모니터링/정상관리 권고와 예방 조치

보고서는 CSV 또는 JSON으로 내려받을 수 있습니다.

## 문화유산 데이터 갱신

`heritage/` 폴더 안의 `.shp/.dbf/.shx/.prj` 세트를 갱신한 뒤 아래 명령을 실행하면 지도와 위험도 분석 대상이 갱신됩니다.

```powershell
npm run build:heritage
```

현재 변환기는 `KGD2002_Unified_Coordinate_System` 좌표를 WGS84 위도/경도로 변환하고, 각 폴리곤의 중심점을 지도 표시와 반경 분석에 사용합니다.

## 실행

샘플 데이터만 볼 때는 `index.html`을 직접 열 수 있습니다. FIRMS `MAP_KEY`로 실데이터를 불러오려면 CORS 우회를 위해 로컬 정적 서버를 실행합니다.

```powershell
npm run serve
```

그 다음 `http://127.0.0.1:5173`으로 접속합니다. Leaflet, 지도 타일, 항공사진 타일을 불러오기 위해 인터넷 연결이 필요합니다.

## GitHub Pages

이 저장소는 `.github/workflows/deploy-pages.yml`로 GitHub Pages 자동 배포를 수행합니다. `main` 브랜치가 push되면 다음 주소에서 확인할 수 있습니다.

```text
https://hopesound.github.io/fire-stone/
```

GitHub Pages가 계속 404를 보이면 저장소 설정에서 **Settings -> Pages -> Source**가 **GitHub Actions**인지 확인합니다.

## NASA FIRMS 연동 메모

NASA FIRMS Area API format:

```text
https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/[SOURCE]/[AREA_COORDINATES]/[DAY_RANGE]/[DATE]
```

현재 초안에 반영한 제약:

- `DAY_RANGE`는 1~10일 요청을 기준으로 하므로 월/년 단위 조회는 여러 요청으로 분할합니다.
- `AREA_COORDINATES`는 `west,south,east,north` 순서입니다.
- `DATE`는 조회 시작일이며 `YYYY-MM-DD` 형식입니다.
- 실시간 데이터 조회에는 FIRMS `MAP_KEY`가 필요합니다.
- 브라우저 CORS 차단을 피하기 위해 로컬 개발 서버의 `/api/firms/area` 프록시를 통해 FIRMS CSV를 조회합니다.

Official references:

- https://firms.modaps.eosdis.nasa.gov/api/area/csv
- https://firms2.modaps.eosdis.nasa.gov/api/

## 다음 구현 단계

1. 운영 배포에서 FIRMS 키 보호가 필요하면 FastAPI 등 서버 프록시로 확장합니다.
2. 관리 상태와 분석 결과를 PostgreSQL + PostGIS에 저장합니다.
3. `src/analysis/risk-engine.js`의 임계값을 과거 데이터로 보정합니다.
4. 보호구역 폴리곤 자체를 지도에 그리는 상세 레이어를 추가합니다.
5. 알림 후보를 이메일/SMS/모바일 푸시로 연결합니다.
