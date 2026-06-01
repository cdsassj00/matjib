# Maflix

DB 없이 동작하는 정적 HTML/CSS/JS 웹앱입니다. Google Maps JavaScript API와 Places Library를
사용해 선택한 위치 기준 반경 500m 안의 맛집 후보를 Netflix/OTT 스타일 추천 UI로 보여줍니다.

## 기능

- 주소/장소명 자동완성으로 검색 중심 위치 선택
- 선택 위치 기준 500m 반경 맛집 후보 검색
- 한식, 중식, 일식, 양식, 고기, 해산물, 분식/치킨/카페 카테고리 칩
- DB 없이 카테고리별 대표메뉴 태그와 무드 태그 제공
- Places Photo가 있으면 포스터 이미지로 표시, 없으면 카테고리별 gradient poster 표시
- 평점, 리뷰 수, 영업 여부, 거리, 주소, Google Maps 링크, 웹사이트 링크 표시
- `오늘 뭐 먹지?` 히어로 랜덤 추천, `오늘의 한 끼 재생`, 지도 보기, 다른 추천 UX
- 한식, 중식, 일식, 양식, 고기, 해산물, 분식/치킨/카페 가로 스크롤 row
- 지도는 검색 위치와 후보 확인을 위한 보조 패널로 제공

## API Key 설정

실제 API Key는 저장소에 커밋하지 마세요. 이 앱은 정적 클라이언트 앱이므로 배포 후 브라우저에서 키가 보이는 공개 키입니다.
반드시 Google Cloud Console에서 HTTP referrer, API, 쿼터 제한을 적용하세요.

### 로컬: `config.js` 사용

1. `config.example.js`를 `config.js`로 복사합니다.
2. `config.js`에 본인 Google Maps Platform API Key를 입력합니다.

```javascript
window.MAPS_PLATFORM_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";
```

3. 간단한 정적 서버로 실행합니다.

```bash
python -m http.server 8080
```

4. `http://localhost:8080`으로 접속합니다.

`config.js`는 `.gitignore`에 포함되어 있어 저장소에 커밋되지 않습니다. 키가 없으면 화면에
`config.js 또는 Vercel env에 API 키를 설정하세요` 안내만 표시되고, 별도 입력창은 제공하지 않습니다.

### Vercel: 환경 변수로 `config.js` 생성

Vercel의 Project Settings > Environment Variables에 다음 환경 변수를 추가하세요.

- `GOOGLE_MAPS_API_KEY`

빌드 시 `npm run build`가 `scripts/create-config.js`를 실행해 정적 배포에 포함될 `config.js`를 생성합니다.
로컬이나 다른 환경에서 `VITE_GOOGLE_MAPS_API_KEY`를 사용해야 하는 경우에도 같은 스크립트가 대체 값으로 지원합니다.

## Google Cloud 설정

Google Cloud Console에서 다음 API를 활성화하세요.

- Maps JavaScript API
- Places API

## API Key 보안 주의

이 앱은 서버가 없는 정적 클라이언트 앱이므로 브라우저에서 API Key가 보일 수 있습니다. 키 자체를 완전히 숨길 수 없기 때문에
Google Cloud Console에서 다음 제한을 반드시 설정하세요.

- HTTP referrer 제한: 허용할 로컬/배포 도메인만 등록
- API 제한: Maps JavaScript API와 Places API만 허용
- 쿼터/예산 제한: 예상치 못한 과금 방지

결과 카드의 외부 링크는 `http:`와 `https:` URL만 렌더링하도록 검증합니다.

## Vercel 정적 배포

`package.json`의 build 스크립트가 환경 변수에서 `config.js`를 생성합니다.

```bash
npx vercel
```

프로덕션 배포가 필요하면:

```bash
npx vercel --prod
```

배포 환경에서는 로컬의 `.gitignore`된 `config.js`가 포함되지 않습니다. Vercel 환경 변수로 생성된 `config.js`는
브라우저에 전달되는 정적 파일이므로 키가 노출됩니다. 위의 HTTP referrer/API/쿼터 제한을 먼저 적용하세요.

## 배포 시 인증 실패 점검(추가)

Google Maps 인증 실패 메시지는 로컬뿐 아니라 배포 환경에서도 동일하게 표시됩니다.
아래 조건이 누락되면 배포 도메인에서 `RefererNotAllowedMapError` 또는 `REQUEST_DENIED`가 발생할 수 있습니다.

- HTTP referrer 허용 예시: `https://<배포도메인>/*`, `https://*.vercel.app/*`, `http://localhost:8080/*`
- API 제한: Maps JavaScript API + Places API 허용
- Billing(결제 계정) 활성화 여부 확인
