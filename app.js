const SEARCH_RADIUS_METERS = 500;
const DETAIL_FIELDS = [
  "formatted_address",
  "geometry",
  "name",
  "opening_hours",
  "photos",
  "place_id",
  "rating",
  "types",
  "url",
  "user_ratings_total",
  "website",
];

const proteinOptions = [
  { id: "meat", label: "육", search: "고기 바베큐 BBQ 육류" },
  { id: "sea", label: "해", search: "해산물 회 생선 조개" },
  { id: "air", label: "공", search: "치킨 닭 오리 구이" },
];

const cuisineOptions = [
  { id: "korean", label: "한식", search: "한식 Korean restaurant" },
  { id: "western", label: "양식", search: "양식 Italian pasta steak" },
  { id: "japanese", label: "일식", search: "일식 sushi ramen Japanese restaurant" },
  { id: "chinese", label: "중식", search: "중식 Chinese restaurant" },
  { id: "etc", label: "기타", search: "restaurant 맛집 다이닝" },
];

const state = {
  apiKey: "",
  map: null,
  service: null,
  autocomplete: null,
  currentStep: 1,
  answers: {
    majorPlace: null,
    detailLocation: null,
    protein: null,
    cuisine: null,
  },
  originMarker: null,
  detailMarker: null,
  circle: null,
  resultMarkers: [],
  results: [],
  selectedResultIndex: null,
};

const els = {
  flowModal: document.querySelector("#flow-modal"),
  stepIndicator: document.querySelector("#flow-step-indicator"),
  progressBar: document.querySelector("#flow-progress-bar"),
  status: document.querySelector("#status-message"),
  map: document.querySelector("#map"),
  mapOverlay: document.querySelector("#map-overlay"),
  resultCount: document.querySelector("#result-count"),
  results: document.querySelector("#results"),
  dailyDiscovery: document.querySelector("#daily-discovery"),
  finalRandomPick: document.querySelector("#final-random-pick"),
  recenterButton: document.querySelector("#recenter-button"),
  rerunSearch: document.querySelector("#rerun-search"),
  placeInput: document.querySelector("#flow-place-input"),
  step1Selection: document.querySelector("#step1-selection"),
  step2Selection: document.querySelector("#step2-selection"),
  step1Next: document.querySelector("#step1-next"),
  step2Back: document.querySelector("#step2-back"),
  step2Next: document.querySelector("#step2-next"),
  step3Back: document.querySelector("#step3-back"),
  step4Back: document.querySelector("#step4-back"),
  proteinOptions: document.querySelector("#protein-options"),
  cuisineOptions: document.querySelector("#cuisine-options"),
  proteinRandom: document.querySelector("#protein-random"),
  cuisineRandom: document.querySelector("#cuisine-random"),
  overlayPanel: document.querySelector("#overlay-panel"),
  configNotice: document.querySelector(".config-notice"),
  apiKeyHelp: document.querySelector("#api-key-help"),
};

renderChoiceButtons();
bindEvents();
setStep(1);
updateMapOverlay("반경 500m 검색 대기 중");
bootstrapApiKey();

function bindEvents() {
  els.step1Next?.addEventListener("click", () => {
    if (!state.answers.majorPlace?.location) {
      setStatus("자동완성 목록에서 위치를 먼저 선택해 주세요.", true);
      els.placeInput?.focus();
      return;
    }
    setStep(2);
    setStatus("Step 2: 지도에서 세부 장소를 클릭해 주세요.");
  });

  els.step2Back?.addEventListener("click", () => setStep(1));
  els.step2Next?.addEventListener("click", () => {
    if (!state.answers.detailLocation) {
      setStatus("지도 클릭으로 세부 장소를 지정해 주세요.", true);
      return;
    }
    setStep(3);
  });
  els.step3Back?.addEventListener("click", () => setStep(2));
  els.step4Back?.addEventListener("click", () => setStep(3));

  els.proteinOptions?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-protein]");
    if (!button) return;
    selectProtein(button.dataset.protein, false);
  });

  els.cuisineOptions?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cuisine]");
    if (!button) return;
    selectCuisine(button.dataset.cuisine, false);
  });

  els.proteinRandom?.addEventListener("click", () => {
    const picked = pickRandom(proteinOptions);
    selectProtein(picked.id, true);
  });

  els.cuisineRandom?.addEventListener("click", () => {
    const picked = pickRandom(cuisineOptions);
    selectCuisine(picked.id, true);
  });

  els.recenterButton?.addEventListener("click", () => {
    if (!state.map || !state.answers.detailLocation) return;
    state.map.panTo(state.answers.detailLocation);
    state.map.setZoom(16);
  });

  els.rerunSearch?.addEventListener("click", runSearch);
  els.finalRandomPick?.addEventListener("click", pickFinalRandom);
}

function renderChoiceButtons() {
  if (els.proteinOptions) {
    els.proteinOptions.innerHTML = proteinOptions
      .map(
        (option) =>
          `<button type="button" class="choice-button" data-protein="${option.id}" aria-pressed="false">${option.label}</button>`,
      )
      .join("");
  }

  if (els.cuisineOptions) {
    els.cuisineOptions.innerHTML = cuisineOptions
      .map(
        (option) =>
          `<button type="button" class="choice-button" data-cuisine="${option.id}" aria-pressed="false">${option.label}</button>`,
      )
      .join("");
  }
}

function setStep(step) {
  state.currentStep = step;

  for (let index = 1; index <= 4; index += 1) {
    const section = document.querySelector(`#flow-step-${index}`);
    if (!section) continue;
    const active = index === step;
    section.classList.toggle("is-hidden", !active);
    section.setAttribute("aria-hidden", String(!active));
  }

  if (els.stepIndicator) {
    els.stepIndicator.textContent = `Step ${step} / 4`;
  }
  if (els.progressBar) {
    els.progressBar.style.width = `${Math.min(100, step * 25)}%`;
  }
}

function bootstrapApiKey() {
  const configuredKey = window.MAPS_PLATFORM_API_KEY || "";
  const key = configuredKey.trim();

  if (!key || key === "YOUR_GOOGLE_MAPS_API_KEY") {
    setApiNoticeVisible(true);
    setStatus("config.js 또는 Vercel env에 API 키를 설정하세요.", true);
    updateMapOverlay("API 키 설정 필요");
    return;
  }

  setApiNoticeVisible(false);
  loadGoogleMaps(key);
}

function loadGoogleMaps(key) {
  if (window.google?.maps?.places) {
    initializeMap();
    return;
  }

  state.apiKey = key;
  setStatus("Google Maps와 Places Library를 불러오는 중입니다...");

  window.__initFlowMap = initializeMap;
  window.gm_authFailure = () => {
    setApiNoticeVisible(true);
    setStatus("Google Maps 인증에 실패했습니다. API 키/결제/API 제한을 확인해 주세요.", true);
  };

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
    key,
  )}&libraries=places&callback=__initFlowMap&loading=async&language=ko&region=KR`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    setApiNoticeVisible(true);
    setStatus("Maps JavaScript API 로드에 실패했습니다. 키/도메인 제한/네트워크를 확인해 주세요.", true);
  };
  document.head.appendChild(script);
}

function setApiNoticeVisible(visible) {
  if (!els.configNotice) return;
  els.configNotice.classList.toggle("is-hidden", !visible);
}

function setResultsPanelVisible(visible) {
  if (!els.overlayPanel) return;
  els.overlayPanel.classList.toggle("is-hidden", !visible);
}

function initializeMap() {
  const fallbackCenter = { lat: 37.5665, lng: 126.978 };

  state.map = new google.maps.Map(els.map, {
    center: fallbackCenter,
    zoom: 15,
    clickableIcons: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  });
  state.service = new google.maps.places.PlacesService(state.map);
  state.autocomplete = new google.maps.places.Autocomplete(els.placeInput, {
    fields: ["formatted_address", "geometry", "name", "place_id"],
  });

  state.autocomplete.addListener("place_changed", handlePlaceSelected);
  state.map.addListener("click", handleMapClickForDetail);

  els.placeInput.disabled = false;
  setStatus("Step 1: 장소를 입력하고 자동완성에서 선택해 주세요.");
}

function handlePlaceSelected() {
  const place = state.autocomplete.getPlace();
  if (!place.geometry?.location) {
    setStatus("선택한 장소의 위치 정보를 찾지 못했습니다. 자동완성에서 다시 선택해 주세요.", true);
    return;
  }

  state.answers.majorPlace = {
    name: place.name || place.formatted_address || "선택 위치",
    address: place.formatted_address || "",
    location: place.geometry.location,
  };

  drawMajorPlaceMarker();
  els.step1Next.disabled = false;
  if (els.step1Selection) {
    els.step1Selection.textContent = `선택됨: ${state.answers.majorPlace.name}`;
  }
  setStatus(`Step 1 완료: ${state.answers.majorPlace.name}`);
}

function drawMajorPlaceMarker() {
  const location = state.answers.majorPlace.location;
  state.map.panTo(location);
  state.map.setZoom(16);

  if (state.originMarker) {
    state.originMarker.setMap(null);
  }

  state.originMarker = new google.maps.Marker({
    map: state.map,
    position: location,
    title: state.answers.majorPlace.name,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: "#1a73e8",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });
}

function handleMapClickForDetail(event) {
  if (!state.answers.majorPlace?.location) {
    return;
  }
  if (state.currentStep < 2) {
    return;
  }

  state.answers.detailLocation = event.latLng;
  drawDetailLocation();

  const lat = event.latLng.lat().toFixed(6);
  const lng = event.latLng.lng().toFixed(6);
  if (els.step2Selection) {
    els.step2Selection.textContent = `선택 좌표: ${lat}, ${lng}`;
  }
  els.step2Next.disabled = false;
  setStatus("Step 2 완료: 세부 장소가 설정되었습니다.");
  updateMapOverlay("세부 지점 기준 500m 설정됨");
}

function drawDetailLocation() {
  const location = state.answers.detailLocation;
  if (state.detailMarker) state.detailMarker.setMap(null);
  if (state.circle) state.circle.setMap(null);

  state.detailMarker = new google.maps.Marker({
    map: state.map,
    position: location,
    title: "세부 모임 지점",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: "#e50914",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });

  state.circle = new google.maps.Circle({
    map: state.map,
    center: location,
    radius: SEARCH_RADIUS_METERS,
    fillColor: "#e50914",
    fillOpacity: 0.12,
    strokeColor: "#e50914",
    strokeOpacity: 0.75,
    strokeWeight: 2,
  });
}

function selectProtein(proteinId, isRandom) {
  state.answers.protein = proteinOptions.find((item) => item.id === proteinId) || null;
  if (!state.answers.protein) return;

  updatePressedState("[data-protein]", proteinId, "protein");
  setStatus(
    isRandom
      ? `Step 3 랜덤 확정: ${state.answers.protein.label}`
      : `Step 3 선택 완료: ${state.answers.protein.label}`,
  );
  setStep(4);
}

function selectCuisine(cuisineId, isRandom) {
  state.answers.cuisine = cuisineOptions.find((item) => item.id === cuisineId) || null;
  if (!state.answers.cuisine) return;

  updatePressedState("[data-cuisine]", cuisineId, "cuisine");
  setStatus(
    isRandom
      ? `Step 4 랜덤 확정: ${state.answers.cuisine.label} · 검색을 시작합니다.`
      : `Step 4 선택 완료: ${state.answers.cuisine.label} · 검색을 시작합니다.`,
  );
  completeFlowAndSearch();
}

function updatePressedState(selector, activeId, kind) {
  document.querySelectorAll(selector).forEach((button) => {
    const value = button.dataset[kind];
    button.setAttribute("aria-pressed", String(value === activeId));
  });
}

function completeFlowAndSearch() {
  if (els.flowModal) {
    els.flowModal.classList.add("is-complete");
    els.flowModal.setAttribute("aria-hidden", "true");
  }
  setResultsPanelVisible(true);
  runSearch();
}

async function runSearch() {
  if (!state.service || !state.map) {
    setStatus("지도가 아직 준비되지 않았습니다. API 키 설정을 확인해 주세요.", true);
    return;
  }
  if (!state.answers.detailLocation) {
    setStatus("세부 지점(Step 2)을 먼저 선택해 주세요.", true);
    setStep(2);
    return;
  }
  if (!state.answers.protein || !state.answers.cuisine) {
    setStatus("Step 3/4 취향 선택이 필요합니다.", true);
    return;
  }

  const keyword = buildSearchKeyword();
  setResultsPanelVisible(true);
  setLoading(true);
  setStatus("선택한 조건으로 500m 내 식당을 검색 중입니다...");
  updateMapOverlay("반경 500m 검색 중");
  clearResults();

  try {
    const nearby = await nearbySearch({
      location: state.answers.detailLocation,
      radius: SEARCH_RADIUS_METERS,
      type: "restaurant",
      keyword,
    });

    const unique = dedupePlaces(nearby)
      .filter((place) => place.geometry?.location)
      .map((place) => ({
        ...place,
        distance: getDistanceMeters(state.answers.detailLocation, place.geometry.location),
      }))
      .filter((place) => place.distance <= SEARCH_RADIUS_METERS)
      .sort((a, b) => scorePlace(b) - scorePlace(a))
      .slice(0, 24);

    if (unique.length === 0) {
      state.results = [];
      renderResults();
      updateMapOverlay("후보 0곳");
      setStatus("조건에 맞는 식당을 찾지 못했습니다. Step 3/4 조합을 바꿔 다시 시도해 보세요.");
      return;
    }

    const detailed = await hydratePlaceDetails(unique.slice(0, 12));
    state.results = [...detailed, ...unique.slice(12)];
    renderResults();
    renderResultMarkers();
    pickFinalRandom();

    const proteinLabel = state.answers.protein.label;
    const cuisineLabel = state.answers.cuisine.label;
    updateMapOverlay(`반경 500m · ${proteinLabel}/${cuisineLabel} · ${state.results.length}곳`);
    setStatus(`${state.results.length}개의 결과를 표시했습니다.`);
  } catch (error) {
    setStatus(getPlacesErrorMessage(error), true);
  } finally {
    setLoading(false);
  }
}

function buildSearchKeyword() {
  const protein = state.answers.protein?.search || "";
  const cuisine = state.answers.cuisine?.search || "";
  return `${cuisine} ${protein} 맛집`.trim();
}

function nearbySearch(request) {
  return new Promise((resolve, reject) => {
    state.service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        resolve(results || []);
        return;
      }
      if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
        return;
      }
      reject(status);
    });
  });
}

function hydratePlaceDetails(places) {
  return Promise.all(
    places.map(
      (place) =>
        new Promise((resolve) => {
          state.service.getDetails(
            {
              placeId: place.place_id,
              fields: DETAIL_FIELDS,
            },
            (detail, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && detail) {
                resolve({ ...place, ...detail, distance: place.distance });
              } else {
                resolve(place);
              }
            },
          );
        }),
    ),
  );
}

function clearResults() {
  state.resultMarkers.forEach((marker) => marker.setMap(null));
  state.resultMarkers = [];
  state.results = [];
  state.selectedResultIndex = null;
  els.results.innerHTML = "";
  els.resultCount.textContent = "검색 중...";
}

function renderResults() {
  if (state.results.length === 0) {
    els.resultCount.textContent = "검색 전";
    els.results.innerHTML = `<div class="empty-state">4단계를 완료하면 결과가 표시됩니다.</div>`;
    els.finalRandomPick.disabled = true;
    return;
  }

  els.resultCount.textContent = `${state.results.length}곳 · 500m`;
  els.finalRandomPick.disabled = false;
  els.rerunSearch.disabled = false;
  els.recenterButton.disabled = false;

  els.results.innerHTML = state.results.map((place, index) => renderPlaceCard(place, index)).join("");
  els.results.querySelectorAll(".place-card").forEach((card) => {
    const index = Number(card.dataset.index);
    card.addEventListener("mouseenter", () => highlightResult(index, false));
    card.addEventListener("focusin", () => highlightResult(index, false));
    card.addEventListener("click", () => {
      highlightResult(index, true);
      els.dailyDiscovery.innerHTML = buildFinalPickHtml(state.results[index], false);
    });
  });
}

function renderPlaceCard(place, index) {
  const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 720, maxHeight: 420 });
  const address = place.formatted_address || place.vicinity || "주소 정보 없음";
  const rating = place.rating ? `★ ${place.rating.toFixed(1)}` : "평점 미제공";
  const reviews = place.user_ratings_total ? `리뷰 ${place.user_ratings_total.toLocaleString()}개` : "리뷰 수 없음";
  const openNow = formatOpenNow(place.opening_hours);
  const mapsUrl = sanitizeExternalUrl(
    place.url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${
        place.place_id
      }`,
  );
  const websiteUrl = sanitizeExternalUrl(place.website);

  return `
    <article class="place-card" data-index="${index}" tabindex="0" style="--stagger-index:${index}">
      <div class="place-card__media">
        ${
          photoUrl
            ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(place.name || "식당")} 사진" loading="lazy" />`
            : `<div class="placeholder-art" aria-hidden="true">맛</div>`
        }
        <span class="place-card__badge">${index + 1}번</span>
      </div>
      <div class="place-card__body">
        <h3>${escapeHtml(place.name || "이름 없는 후보")}</h3>
        <div class="meta-row">
          <span class="meta">${rating}</span>
          <span class="meta">${Math.round(place.distance)}m</span>
          <span class="meta">${reviews}</span>
          <span class="meta">${openNow}</span>
        </div>
        <p class="meta address">${escapeHtml(address)}</p>
        <div class="card-actions">
          ${
            mapsUrl
              ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">지도에서 보기</a>`
              : ""
          }
          ${
            websiteUrl
              ? `<a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noreferrer">웹사이트</a>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderResultMarkers() {
  state.resultMarkers.forEach((marker) => marker.setMap(null));
  state.resultMarkers = state.results.map((place, index) => {
    const marker = new google.maps.Marker({
      map: state.map,
      position: place.geometry.location,
      title: place.name || `후보 ${index + 1}`,
      label: {
        text: String(index + 1),
        color: "#ffffff",
        fontWeight: "700",
      },
    });
    marker.addListener("click", () => {
      highlightResult(index, true);
      els.dailyDiscovery.innerHTML = buildFinalPickHtml(place, false);
    });
    return marker;
  });
}

function pickFinalRandom() {
  if (state.results.length === 0) {
    els.dailyDiscovery.innerHTML = "<strong>최종 선택 대기 중</strong><span>검색 결과가 있으면 랜덤 선택이 가능합니다.</span>";
    return;
  }
  const index = Math.floor(Math.random() * state.results.length);
  const place = state.results[index];
  highlightResult(index, true);
  els.dailyDiscovery.innerHTML = buildFinalPickHtml(place, true);
}

function buildFinalPickHtml(place, isRandom) {
  const prefix = isRandom ? "랜덤 최종 선택" : "선택된 식당";
  const protein = state.answers.protein?.label || "-";
  const cuisine = state.answers.cuisine?.label || "-";
  return `
    <strong>${escapeHtml(prefix)}: ${escapeHtml(place.name || "오늘의 한 끼")}</strong>
    <span>${Math.round(place.distance)}m · ${protein}/${cuisine}</span>
  `;
}

function highlightResult(index, panMap) {
  state.selectedResultIndex = index;

  els.results.querySelectorAll(".place-card").forEach((card) => {
    const active = Number(card.dataset.index) === index;
    card.classList.toggle("is-picked", active);
    if (active && panMap) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  state.resultMarkers.forEach((marker, markerIndex) => {
    marker.setZIndex(markerIndex === index ? 1000 : null);
    marker.setAnimation(markerIndex === index ? google.maps.Animation.BOUNCE : null);
    if (markerIndex === index) {
      window.setTimeout(() => marker.setAnimation(null), 700);
      if (panMap) {
        state.map.panTo(marker.getPosition());
      }
    }
  });
}

function setLoading(isLoading) {
  els.finalRandomPick.disabled = isLoading || state.results.length === 0;
  els.rerunSearch.disabled = isLoading;
}

function setStatus(message, isError = false) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.classList.toggle("is-error", isError);
}

function updateMapOverlay(message) {
  if (!els.mapOverlay) return;
  els.mapOverlay.textContent = message;
}

function getPlacesErrorMessage(status) {
  const map = {
    [google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT]:
      "Places API 쿼터를 초과했거나 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.",
    [google.maps.places.PlacesServiceStatus.REQUEST_DENIED]:
      "요청이 거부되었습니다. API 키 권한, Places API 활성화, HTTP referrer 제한을 확인해 주세요.",
    [google.maps.places.PlacesServiceStatus.INVALID_REQUEST]:
      "검색 요청이 올바르지 않습니다. 조건을 다시 선택해 주세요.",
    [google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR]:
      "Google Places 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };
  return map[status] || `장소 검색 중 오류가 발생했습니다. 상태: ${status}`;
}

function scorePlace(place) {
  const ratingScore = (place.rating || 0) * 20;
  const reviewScore = Math.min(place.user_ratings_total || 0, 500) / 10;
  const distanceScore = Math.max(0, SEARCH_RADIUS_METERS - place.distance) / 20;
  return ratingScore + reviewScore + distanceScore;
}

function dedupePlaces(places) {
  const seen = new Set();
  return places.filter((place) => {
    const key = place.place_id || place.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDistanceMeters(origin, target) {
  const from = typeof origin.lat === "function" ? { lat: origin.lat(), lng: origin.lng() } : origin;
  const to = typeof target.lat === "function" ? { lat: target.lat(), lng: target.lng() } : target;
  const earthRadius = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function formatOpenNow(openingHours) {
  if (!openingHours || typeof openingHours.open_now === "undefined") {
    return "영업 정보 없음";
  }
  return openingHours.open_now ? "영업 중" : "영업 종료";
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function sanitizeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value), window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
/*
const SEARCH_RADIUS_METERS = 500;
const DETAIL_FIELDS = [
  "formatted_address",
  "geometry",
  "name",
  "opening_hours",
  "photos",
  "place_id",
  "rating",
  "types",
  "url",
  "user_ratings_total",
  "website",
];

const proteinOptions = [
  { id: "meat", label: "육", search: "고기 바베큐 BBQ 육류" },
  { id: "sea", label: "해", search: "해산물 회 생선 조개" },
  { id: "air", label: "공", search: "치킨 닭 오리 구이" },
];

const cuisineOptions = [
  { id: "korean", label: "한식", search: "한식 Korean restaurant" },
  { id: "western", label: "양식", search: "양식 Italian pasta steak" },
  { id: "japanese", label: "일식", search: "일식 sushi ramen Japanese restaurant" },
  { id: "chinese", label: "중식", search: "중식 Chinese restaurant" },
  { id: "etc", label: "기타", search: "restaurant 맛집 다이닝" },
];

const state = {
  apiKey: "",
  map: null,
  service: null,
  autocomplete: null,
  currentStep: 1,
  answers: {
    majorPlace: null,
    detailLocation: null,
    protein: null,
    cuisine: null,
  },
  originMarker: null,
  detailMarker: null,
  circle: null,
  resultMarkers: [],
  results: [],
  selectedResultIndex: null,
};

const els = {
  flowModal: document.querySelector("#flow-modal"),
  stepIndicator: document.querySelector("#flow-step-indicator"),
  progressBar: document.querySelector("#flow-progress-bar"),
  status: document.querySelector("#status-message"),
  map: document.querySelector("#map"),
  mapOverlay: document.querySelector("#map-overlay"),
  resultCount: document.querySelector("#result-count"),
  results: document.querySelector("#results"),
  dailyDiscovery: document.querySelector("#daily-discovery"),
  finalRandomPick: document.querySelector("#final-random-pick"),
  recenterButton: document.querySelector("#recenter-button"),
  rerunSearch: document.querySelector("#rerun-search"),
  placeInput: document.querySelector("#flow-place-input"),
  step1Selection: document.querySelector("#step1-selection"),
  step2Selection: document.querySelector("#step2-selection"),
  step1Next: document.querySelector("#step1-next"),
  step2Back: document.querySelector("#step2-back"),
  step2Next: document.querySelector("#step2-next"),
  step3Back: document.querySelector("#step3-back"),
  step4Back: document.querySelector("#step4-back"),
  proteinOptions: document.querySelector("#protein-options"),
  cuisineOptions: document.querySelector("#cuisine-options"),
  proteinRandom: document.querySelector("#protein-random"),
  cuisineRandom: document.querySelector("#cuisine-random"),
};

renderChoiceButtons();
bindEvents();
setStep(1);
updateMapOverlay("반경 500m 검색 대기 중");
bootstrapApiKey();

function bindEvents() {
  els.step1Next?.addEventListener("click", () => {
    if (!state.answers.majorPlace?.location) {
      setStatus("자동완성 목록에서 위치를 먼저 선택해 주세요.", true);
      els.placeInput?.focus();
      return;
    }
    setStep(2);
    setStatus("Step 2: 지도에서 세부 장소를 클릭해 주세요.");
  });

  els.step2Back?.addEventListener("click", () => setStep(1));
  els.step2Next?.addEventListener("click", () => {
    if (!state.answers.detailLocation) {
      setStatus("지도 클릭으로 세부 장소를 지정해 주세요.", true);
      return;
    }
    setStep(3);
  });
  els.step3Back?.addEventListener("click", () => setStep(2));
  els.step4Back?.addEventListener("click", () => setStep(3));

  els.proteinOptions?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-protein]");
    if (!button) return;
    selectProtein(button.dataset.protein, false);
  });

  els.cuisineOptions?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cuisine]");
    if (!button) return;
    selectCuisine(button.dataset.cuisine, false);
  });

  els.proteinRandom?.addEventListener("click", () => {
    const picked = pickRandom(proteinOptions);
    selectProtein(picked.id, true);
  });

  els.cuisineRandom?.addEventListener("click", () => {
    const picked = pickRandom(cuisineOptions);
    selectCuisine(picked.id, true);
  });

  els.recenterButton?.addEventListener("click", () => {
    if (!state.map || !state.answers.detailLocation) return;
    state.map.panTo(state.answers.detailLocation);
    state.map.setZoom(16);
  });

  els.rerunSearch?.addEventListener("click", runSearch);
  els.finalRandomPick?.addEventListener("click", pickFinalRandom);
}

function renderChoiceButtons() {
  if (els.proteinOptions) {
    els.proteinOptions.innerHTML = proteinOptions
      .map(
        (option) =>
          `<button type="button" class="choice-button" data-protein="${option.id}" aria-pressed="false">${option.label}</button>`,
      )
      .join("");
  }

  if (els.cuisineOptions) {
    els.cuisineOptions.innerHTML = cuisineOptions
      .map(
        (option) =>
          `<button type="button" class="choice-button" data-cuisine="${option.id}" aria-pressed="false">${option.label}</button>`,
      )
      .join("");
  }
}

function setStep(step) {
  state.currentStep = step;

  for (let index = 1; index <= 4; index += 1) {
    const section = document.querySelector(`#flow-step-${index}`);
    if (!section) continue;
    const active = index === step;
    section.classList.toggle("is-hidden", !active);
    section.setAttribute("aria-hidden", String(!active));
  }

  if (els.stepIndicator) {
    els.stepIndicator.textContent = `Step ${step} / 4`;
  }
  if (els.progressBar) {
    els.progressBar.style.width = `${Math.min(100, step * 25)}%`;
  }
}

function bootstrapApiKey() {
  const configuredKey = window.MAPS_PLATFORM_API_KEY || "";
  const key = configuredKey.trim();

  if (!key || key === "YOUR_GOOGLE_MAPS_API_KEY") {
    setStatus("config.js 또는 Vercel env에 API 키를 설정하세요.", true);
    updateMapOverlay("API 키 설정 필요");
    return;
  }

  loadGoogleMaps(key);
}

function loadGoogleMaps(key) {
  if (window.google?.maps?.places) {
    initializeMap();
    return;
  }

  state.apiKey = key;
  setStatus("Google Maps와 Places Library를 불러오는 중입니다...");

  window.__initFlowMap = initializeMap;
  window.gm_authFailure = () => {
    setStatus("Google Maps 인증에 실패했습니다. API 키/결제/API 제한을 확인해 주세요.", true);
  };

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
    key,
  )}&libraries=places&callback=__initFlowMap&loading=async&language=ko&region=KR`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    setStatus("Maps JavaScript API 로드에 실패했습니다. 키/도메인 제한/네트워크를 확인해 주세요.", true);
  };
  document.head.appendChild(script);
}

function initializeMap() {
  const fallbackCenter = { lat: 37.5665, lng: 126.978 };

  state.map = new google.maps.Map(els.map, {
    center: fallbackCenter,
    zoom: 15,
    clickableIcons: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  });
  state.service = new google.maps.places.PlacesService(state.map);
  state.autocomplete = new google.maps.places.Autocomplete(els.placeInput, {
    fields: ["formatted_address", "geometry", "name", "place_id"],
  });

  state.autocomplete.addListener("place_changed", handlePlaceSelected);
  state.map.addListener("click", handleMapClickForDetail);

  els.placeInput.disabled = false;
  setStatus("Step 1: 장소를 입력하고 자동완성에서 선택해 주세요.");
}

function handlePlaceSelected() {
  const place = state.autocomplete.getPlace();
  if (!place.geometry?.location) {
    setStatus("선택한 장소의 위치 정보를 찾지 못했습니다. 자동완성에서 다시 선택해 주세요.", true);
    return;
  }

  state.answers.majorPlace = {
    name: place.name || place.formatted_address || "선택 위치",
    address: place.formatted_address || "",
    location: place.geometry.location,
  };

  drawMajorPlaceMarker();
  els.step1Next.disabled = false;
  if (els.step1Selection) {
    els.step1Selection.textContent = `선택됨: ${state.answers.majorPlace.name}`;
  }
  setStatus(`Step 1 완료: ${state.answers.majorPlace.name}`);
}

function drawMajorPlaceMarker() {
  const location = state.answers.majorPlace.location;
  state.map.panTo(location);
  state.map.setZoom(16);

  if (state.originMarker) {
    state.originMarker.setMap(null);
  }

  state.originMarker = new google.maps.Marker({
    map: state.map,
    position: location,
    title: state.answers.majorPlace.name,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7,
      fillColor: "#1a73e8",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });
}

function handleMapClickForDetail(event) {
  if (!state.answers.majorPlace?.location) {
    return;
  }
  if (state.currentStep < 2) {
    return;
  }

  state.answers.detailLocation = event.latLng;
  drawDetailLocation();

  const lat = event.latLng.lat().toFixed(6);
  const lng = event.latLng.lng().toFixed(6);
  if (els.step2Selection) {
    els.step2Selection.textContent = `선택 좌표: ${lat}, ${lng}`;
  }
  els.step2Next.disabled = false;
  setStatus("Step 2 완료: 세부 장소가 설정되었습니다.");
  updateMapOverlay("세부 지점 기준 500m 설정됨");
}

function drawDetailLocation() {
  const location = state.answers.detailLocation;
  if (state.detailMarker) state.detailMarker.setMap(null);
  if (state.circle) state.circle.setMap(null);

  state.detailMarker = new google.maps.Marker({
    map: state.map,
    position: location,
    title: "세부 모임 지점",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: "#e50914",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });

  state.circle = new google.maps.Circle({
    map: state.map,
    center: location,
    radius: SEARCH_RADIUS_METERS,
    fillColor: "#e50914",
    fillOpacity: 0.12,
    strokeColor: "#e50914",
    strokeOpacity: 0.75,
    strokeWeight: 2,
  });
}

function selectProtein(proteinId, isRandom) {
  state.answers.protein = proteinOptions.find((item) => item.id === proteinId) || null;
  if (!state.answers.protein) return;

  updatePressedState("[data-protein]", proteinId, "protein");
  setStatus(
    isRandom
      ? `Step 3 랜덤 확정: ${state.answers.protein.label}`
      : `Step 3 선택 완료: ${state.answers.protein.label}`,
  );
  setStep(4);
}

function selectCuisine(cuisineId, isRandom) {
  state.answers.cuisine = cuisineOptions.find((item) => item.id === cuisineId) || null;
  if (!state.answers.cuisine) return;

  updatePressedState("[data-cuisine]", cuisineId, "cuisine");
  setStatus(
    isRandom
      ? `Step 4 랜덤 확정: ${state.answers.cuisine.label} · 검색을 시작합니다.`
      : `Step 4 선택 완료: ${state.answers.cuisine.label} · 검색을 시작합니다.`,
  );
  completeFlowAndSearch();
}

function updatePressedState(selector, activeId, kind) {
  document.querySelectorAll(selector).forEach((button) => {
    const value = button.dataset[kind];
    button.setAttribute("aria-pressed", String(value === activeId));
  });
}

function completeFlowAndSearch() {
  if (els.flowModal) {
    els.flowModal.classList.add("is-complete");
    els.flowModal.setAttribute("aria-hidden", "true");
  }
  runSearch();
}

async function runSearch() {
  if (!state.service || !state.map) {
    setStatus("지도가 아직 준비되지 않았습니다. API 키 설정을 확인해 주세요.", true);
    return;
  }
  if (!state.answers.detailLocation) {
    setStatus("세부 지점(Step 2)을 먼저 선택해 주세요.", true);
    setStep(2);
    return;
  }
  if (!state.answers.protein || !state.answers.cuisine) {
    setStatus("Step 3/4 취향 선택이 필요합니다.", true);
    return;
  }

  const keyword = buildSearchKeyword();
  setLoading(true);
  setStatus("선택한 조건으로 500m 내 식당을 검색 중입니다...");
  updateMapOverlay("반경 500m 검색 중");
  clearResults();

  try {
    const nearby = await nearbySearch({
      location: state.answers.detailLocation,
      radius: SEARCH_RADIUS_METERS,
      type: "restaurant",
      keyword,
    });

    const unique = dedupePlaces(nearby)
      .filter((place) => place.geometry?.location)
      .map((place) => ({
        ...place,
        distance: getDistanceMeters(state.answers.detailLocation, place.geometry.location),
      }))
      .filter((place) => place.distance <= SEARCH_RADIUS_METERS)
      .sort((a, b) => scorePlace(b) - scorePlace(a))
      .slice(0, 24);

    if (unique.length === 0) {
      state.results = [];
      renderResults();
      updateMapOverlay("후보 0곳");
      setStatus("조건에 맞는 식당을 찾지 못했습니다. Step 3/4 조합을 바꿔 다시 시도해 보세요.");
      return;
    }

    const detailed = await hydratePlaceDetails(unique.slice(0, 12));
    state.results = [...detailed, ...unique.slice(12)];
    renderResults();
    renderResultMarkers();
    pickFinalRandom();

    const proteinLabel = state.answers.protein.label;
    const cuisineLabel = state.answers.cuisine.label;
    updateMapOverlay(`반경 500m · ${proteinLabel}/${cuisineLabel} · ${state.results.length}곳`);
    setStatus(`${state.results.length}개의 결과를 표시했습니다.`);
  } catch (error) {
    setStatus(getPlacesErrorMessage(error), true);
  } finally {
    setLoading(false);
  }
}

function buildSearchKeyword() {
  const protein = state.answers.protein?.search || "";
  const cuisine = state.answers.cuisine?.search || "";
  return `${cuisine} ${protein} 맛집`.trim();
}

function nearbySearch(request) {
  return new Promise((resolve, reject) => {
    state.service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        resolve(results || []);
        return;
      }
      if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
        return;
      }
      reject(status);
    });
  });
}

function hydratePlaceDetails(places) {
  return Promise.all(
    places.map(
      (place) =>
        new Promise((resolve) => {
          state.service.getDetails(
            {
              placeId: place.place_id,
              fields: DETAIL_FIELDS,
            },
            (detail, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && detail) {
                resolve({ ...place, ...detail, distance: place.distance });
              } else {
                resolve(place);
              }
            },
          );
        }),
    ),
  );
}

function clearResults() {
  state.resultMarkers.forEach((marker) => marker.setMap(null));
  state.resultMarkers = [];
  state.results = [];
  state.selectedResultIndex = null;
  els.results.innerHTML = "";
  els.resultCount.textContent = "검색 중...";
}

function renderResults() {
  if (state.results.length === 0) {
    els.resultCount.textContent = "검색 전";
    els.results.innerHTML = `<div class="empty-state">4단계를 완료하면 결과가 표시됩니다.</div>`;
    els.finalRandomPick.disabled = true;
    return;
  }

  els.resultCount.textContent = `${state.results.length}곳 · 500m`;
  els.finalRandomPick.disabled = false;
  els.rerunSearch.disabled = false;
  els.recenterButton.disabled = false;

  els.results.innerHTML = state.results.map((place, index) => renderPlaceCard(place, index)).join("");
  els.results.querySelectorAll(".place-card").forEach((card) => {
    const index = Number(card.dataset.index);
    card.addEventListener("mouseenter", () => highlightResult(index, false));
    card.addEventListener("focusin", () => highlightResult(index, false));
    card.addEventListener("click", () => {
      highlightResult(index, true);
      els.dailyDiscovery.innerHTML = buildFinalPickHtml(state.results[index], false);
    });
  });
}

function renderPlaceCard(place, index) {
  const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 720, maxHeight: 420 });
  const address = place.formatted_address || place.vicinity || "주소 정보 없음";
  const rating = place.rating ? `★ ${place.rating.toFixed(1)}` : "평점 미제공";
  const reviews = place.user_ratings_total ? `리뷰 ${place.user_ratings_total.toLocaleString()}개` : "리뷰 수 없음";
  const openNow = formatOpenNow(place.opening_hours);
  const mapsUrl = sanitizeExternalUrl(
    place.url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${
        place.place_id
      }`,
  );
  const websiteUrl = sanitizeExternalUrl(place.website);

  return `
    <article class="place-card" data-index="${index}" tabindex="0" style="--stagger-index:${index}">
      <div class="place-card__media">
        ${
          photoUrl
            ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(place.name || "식당")} 사진" loading="lazy" />`
            : `<div class="placeholder-art" aria-hidden="true">맛</div>`
        }
        <span class="place-card__badge">${index + 1}번</span>
      </div>
      <div class="place-card__body">
        <h3>${escapeHtml(place.name || "이름 없는 후보")}</h3>
        <div class="meta-row">
          <span class="meta">${rating}</span>
          <span class="meta">${Math.round(place.distance)}m</span>
          <span class="meta">${reviews}</span>
          <span class="meta">${openNow}</span>
        </div>
        <p class="meta address">${escapeHtml(address)}</p>
        <div class="card-actions">
          ${
            mapsUrl
              ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">지도에서 보기</a>`
              : ""
          }
          ${
            websiteUrl
              ? `<a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noreferrer">웹사이트</a>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderResultMarkers() {
  state.resultMarkers.forEach((marker) => marker.setMap(null));
  state.resultMarkers = state.results.map((place, index) => {
    const marker = new google.maps.Marker({
      map: state.map,
      position: place.geometry.location,
      title: place.name || `후보 ${index + 1}`,
      label: {
        text: String(index + 1),
        color: "#ffffff",
        fontWeight: "700",
      },
    });
    marker.addListener("click", () => {
      highlightResult(index, true);
      els.dailyDiscovery.innerHTML = buildFinalPickHtml(place, false);
    });
    return marker;
  });
}

function pickFinalRandom() {
  if (state.results.length === 0) {
    els.dailyDiscovery.innerHTML = "<strong>최종 선택 대기 중</strong><span>검색 결과가 있으면 랜덤 선택이 가능합니다.</span>";
    return;
  }
  const index = Math.floor(Math.random() * state.results.length);
  const place = state.results[index];
  highlightResult(index, true);
  els.dailyDiscovery.innerHTML = buildFinalPickHtml(place, true);
}

function buildFinalPickHtml(place, isRandom) {
  const prefix = isRandom ? "랜덤 최종 선택" : "선택된 식당";
  const protein = state.answers.protein?.label || "-";
  const cuisine = state.answers.cuisine?.label || "-";
  return `
    <strong>${escapeHtml(prefix)}: ${escapeHtml(place.name || "오늘의 한 끼")}</strong>
    <span>${Math.round(place.distance)}m · ${protein}/${cuisine}</span>
  `;
}

function highlightResult(index, panMap) {
  state.selectedResultIndex = index;

  els.results.querySelectorAll(".place-card").forEach((card) => {
    const active = Number(card.dataset.index) === index;
    card.classList.toggle("is-picked", active);
    if (active && panMap) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  state.resultMarkers.forEach((marker, markerIndex) => {
    marker.setZIndex(markerIndex === index ? 1000 : null);
    marker.setAnimation(markerIndex === index ? google.maps.Animation.BOUNCE : null);
    if (markerIndex === index) {
      window.setTimeout(() => marker.setAnimation(null), 700);
      if (panMap) {
        state.map.panTo(marker.getPosition());
      }
    }
  });
}

function setLoading(isLoading) {
  els.finalRandomPick.disabled = isLoading || state.results.length === 0;
  els.rerunSearch.disabled = isLoading;
}

function setStatus(message, isError = false) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.classList.toggle("is-error", isError);
}

function updateMapOverlay(message) {
  if (!els.mapOverlay) return;
  els.mapOverlay.textContent = message;
}

function getPlacesErrorMessage(status) {
  const map = {
    [google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT]:
      "Places API 쿼터를 초과했거나 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.",
    [google.maps.places.PlacesServiceStatus.REQUEST_DENIED]:
      "요청이 거부되었습니다. API 키 권한, Places API 활성화, HTTP referrer 제한을 확인해 주세요.",
    [google.maps.places.PlacesServiceStatus.INVALID_REQUEST]:
      "검색 요청이 올바르지 않습니다. 조건을 다시 선택해 주세요.",
    [google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR]:
      "Google Places 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };
  return map[status] || `장소 검색 중 오류가 발생했습니다. 상태: ${status}`;
}

function scorePlace(place) {
  const ratingScore = (place.rating || 0) * 20;
  const reviewScore = Math.min(place.user_ratings_total || 0, 500) / 10;
  const distanceScore = Math.max(0, SEARCH_RADIUS_METERS - place.distance) / 20;
  return ratingScore + reviewScore + distanceScore;
}

function dedupePlaces(places) {
  const seen = new Set();
  return places.filter((place) => {
    const key = place.place_id || place.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDistanceMeters(origin, target) {
  const from = typeof origin.lat === "function" ? { lat: origin.lat(), lng: origin.lng() } : origin;
  const to = typeof target.lat === "function" ? { lat: target.lat(), lng: target.lng() } : target;
  const earthRadius = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function formatOpenNow(openingHours) {
  if (!openingHours || typeof openingHours.open_now === "undefined") {
    return "영업 정보 없음";
  }
  return openingHours.open_now ? "영업 중" : "영업 종료";
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function sanitizeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value), window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
const SEARCH_RADIUS_METERS = 500;
const DETAIL_FIELDS = [
  "formatted_address",
  "geometry",
  "name",
  "opening_hours",
  "photos",
  "place_id",
  "rating",
  "types",
  "url",
  "user_ratings_total",
  "website",
];

const moods = [
  { id: "cozy", label: "따뜻한", tag: "든든한 한 끼" },
  { id: "quick", label: "빠른", tag: "빠르게 충전" },
  { id: "spicy", label: "매콤한", tag: "매콤 모험" },
  { id: "fresh", label: "산뜻한", tag: "가벼운 발견" },
  { id: "party", label: "여럿이", tag: "공유하기 좋음" },
];

const categories = [
  {
    id: "all",
    label: "전체",
    query: "맛집 restaurant",
    icon: "🧭",
    menuTags: ["오늘의 발견", "근처 인기 메뉴", "탐험 후보"],
    gradient: "linear-gradient(135deg, #ffb000, #ff5a3d)",
  },
  {
    id: "korean",
    label: "한식",
    query: "한식 Korean restaurant",
    icon: "🍚",
    menuTags: ["백반", "찌개", "비빔밥"],
    gradient: "linear-gradient(135deg, #d9480f, #ffd166)",
  },
  {
    id: "chinese",
    label: "중식",
    query: "중식 Chinese restaurant",
    icon: "🥡",
    menuTags: ["짜장면", "짬뽕", "탕수육"],
    gradient: "linear-gradient(135deg, #b71c1c, #ffb703)",
  },
  {
    id: "japanese",
    label: "일식",
    query: "일식 Japanese restaurant sushi ramen",
    icon: "🍣",
    menuTags: ["초밥", "라멘", "돈카츠"],
    gradient: "linear-gradient(135deg, #0f4c5c, #f7ede2)",
  },
  {
    id: "western",
    label: "양식",
    query: "양식 Italian restaurant pasta steak",
    icon: "🍝",
    menuTags: ["파스타", "피자", "스테이크"],
    gradient: "linear-gradient(135deg, #3a0ca3, #f72585)",
  },
  {
    id: "meat",
    label: "고기",
    query: "고기집 barbecue Korean BBQ",
    icon: "🥩",
    menuTags: ["삼겹살", "갈비", "바비큐"],
    gradient: "linear-gradient(135deg, #5f0f40, #fb8b24)",
  },
  {
    id: "seafood",
    label: "해산물",
    query: "해산물 seafood restaurant",
    icon: "🦐",
    menuTags: ["회", "해물탕", "생선구이"],
    gradient: "linear-gradient(135deg, #006d77, #83c5be)",
  },
  {
    id: "snack",
    label: "분식/치킨/카페",
    query: "분식 치킨 카페 cafe chicken",
    icon: "🍗",
    menuTags: ["떡볶이", "치킨", "커피"],
    gradient: "linear-gradient(135deg, #9d4edd, #ffba08)",
  },
];

const state = {
  apiKey: "",
  autocomplete: null,
  categoryId: "all",
  selectedMoods: new Set(["cozy"]),
  selectedPlace: null,
  map: null,
  marker: null,
  circle: null,
  service: null,
  resultMarkers: [],
  results: [],
  activeResultIndex: null,
  discoveryTimer: null,
  overlayCollapsed: false,
  filterPanelOpen: false,
};

const els = {
  searchInput: document.querySelector("#search-input"),
  searchButton: document.querySelector("#search-button"),
  locationSummary: document.querySelector("#location-summary"),
  moodChips: document.querySelector("#mood-chips"),
  categoryChips: document.querySelector("#category-chips"),
  status: document.querySelector("#status-message"),
  results: document.querySelector("#results"),
  resultCount: document.querySelector("#result-count"),
  map: document.querySelector("#map"),
  dailyDiscovery: document.querySelector("#daily-discovery"),
  heroBackdrop: document.querySelector(".hero-backdrop"),
  randomPick: document.querySelector("#random-pick"),
  rerunSearch: document.querySelector("#rerun-search"),
  recenterButton: document.querySelector("#recenter-button"),
  mapOverlay: document.querySelector("#map-overlay"),
  overlayPanel: document.querySelector("#overlay-panel"),
  overlayToggle: document.querySelector("#overlay-toggle"),
  filterPanel: document.querySelector("#filter-panel"),
  filterToggle: document.querySelector("#filter-toggle"),
  filterClose: document.querySelector("#filter-close"),
};

renderChips();
bindEvents();
if (els.overlayToggle && els.overlayPanel) {
  setOverlayCollapsed(false);
}
if (els.filterPanel) {
  setFilterPanelOpen(false);
}
updateMapOverlay("반경 500m 검색 대기 중");
bootstrapApiKey();

function bindEvents() {
  els.searchButton?.addEventListener("click", runSearch);
  els.rerunSearch?.addEventListener("click", runSearch);
  els.randomPick?.addEventListener("click", showRandomDiscovery);
  els.moodChips?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mood]");
    if (!button) return;
    const id = button.dataset.mood;
    if (state.selectedMoods.has(id)) {
      state.selectedMoods.delete(id);
    } else {
      state.selectedMoods.add(id);
    }
    if (state.selectedMoods.size === 0) {
      state.selectedMoods.add(id);
    }
    renderChips();
    setStatus(`필터 적용: ${getSelectedCategory().label} · ${getSelectedMoodTags().join(", ")}`);
  });
  els.categoryChips?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.categoryId = button.dataset.category;
    renderChips();
    setStatus(`필터 적용: ${getSelectedCategory().label} · ${getSelectedMoodTags().join(", ")}`);
    if (state.selectedPlace && state.results.length > 0) {
      runSearch();
    }
  });
  els.recenterButton?.addEventListener("click", () => {
    if (state.map && state.selectedPlace?.location) {
      state.map.panTo(state.selectedPlace.location);
      state.map.setZoom(16);
    }
  });
  els.filterToggle?.addEventListener("click", () => {
    setFilterPanelOpen(!state.filterPanelOpen);
  });
  els.filterClose?.addEventListener("click", () => {
    setFilterPanelOpen(false);
  });
  if (els.overlayToggle && els.overlayPanel) {
    els.overlayToggle.addEventListener("click", () => {
      setOverlayCollapsed(!state.overlayCollapsed);
    });
  }
}

function bootstrapApiKey() {
  const configuredKey = window.MAPS_PLATFORM_API_KEY || "";
  const key = configuredKey.trim();

  if (!key || key === "YOUR_GOOGLE_MAPS_API_KEY") {
    setStatus("config.js 또는 Vercel env에 API 키를 설정하세요.", true);
    if (els.locationSummary) {
      els.locationSummary.textContent =
      "Google Maps API 키가 설정되면 Maflix 추천과 위치 검색이 활성화됩니다.";
    }
    updateMapOverlay("API 키 설정 필요");
    return;
  }

  loadGoogleMaps(key);
}

function loadGoogleMaps(key) {
  if (window.google?.maps?.places) {
    initializeMapQuest();
    return;
  }

  state.apiKey = key;
  setStatus("Google Maps와 Places Library를 불러오는 중입니다...");

  window.__initMapQuest = initializeMapQuest;
  window.gm_authFailure = () => {
    setStatus("Google Maps 인증에 실패했습니다. API Key, 결제 설정, API 제한을 확인해 주세요.", true);
  };

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
    key,
  )}&libraries=places&callback=__initMapQuest&loading=async&language=ko&region=KR`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    setStatus("Maps JavaScript API 로드에 실패했습니다. 키, 도메인 제한, 네트워크를 확인해 주세요.", true);
  };
  document.head.appendChild(script);
}

function initializeMapQuest() {
  const fallbackCenter = { lat: 37.5665, lng: 126.978 };

  state.map = new google.maps.Map(els.map, {
    center: fallbackCenter,
    zoom: 15,
    clickableIcons: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  });

  state.service = new google.maps.places.PlacesService(state.map);
  state.autocomplete = new google.maps.places.Autocomplete(els.searchInput, {
    fields: ["formatted_address", "geometry", "name", "place_id"],
  });

  state.autocomplete.addListener("place_changed", handlePlaceSelected);
  els.searchInput.disabled = false;
  els.searchButton.disabled = true;
  setStatus("Step 1에서 위치를 선택하면 Step 3 검색 버튼이 활성화됩니다.");
  if (els.locationSummary) {
    els.locationSummary.textContent = "장소명 또는 주소를 입력하면 자동완성 후보가 나타납니다.";
  }
}

function handlePlaceSelected() {
  const place = state.autocomplete.getPlace();
  if (!place.geometry?.location) {
    setStatus("선택한 장소의 위치 정보를 찾지 못했습니다. 자동완성 목록에서 다시 선택해 주세요.", true);
    return;
  }

  state.selectedPlace = {
    name: place.name || place.formatted_address || "선택 위치",
    address: place.formatted_address || "",
    location: place.geometry.location,
  };

  drawSearchOrigin();
  if (els.locationSummary) {
    els.locationSummary.textContent = `${state.selectedPlace.name} 기준 500m 검색 준비 완료`;
  }
  els.searchButton.disabled = false;
  els.recenterButton.disabled = false;
  setStatus(`위치 선택 완료: ${state.selectedPlace.name}`);
  updateMapOverlay("반경 500m 활성화 · 검색 전");
}

function drawSearchOrigin() {
  const { location } = state.selectedPlace;
  state.map.panTo(location);
  state.map.setZoom(16);

  if (state.marker) {
    state.marker.setMap(null);
  }
  if (state.circle) {
    state.circle.setMap(null);
  }

  state.marker = new google.maps.Marker({
    map: state.map,
    position: location,
    title: state.selectedPlace.name,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#1a73e8",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });

  state.circle = new google.maps.Circle({
    map: state.map,
    center: location,
    radius: SEARCH_RADIUS_METERS,
    fillColor: "#1a73e8",
    fillOpacity: 0.1,
    strokeColor: "#1a73e8",
    strokeOpacity: 0.65,
    strokeWeight: 2,
  });
}

async function runSearch() {
  if (!state.service || !state.map) {
    setStatus("config.js 또는 Vercel env에 API 키를 설정해 지도를 활성화해 주세요.", true);
    return;
  }

  if (!state.selectedPlace?.location) {
    setStatus("위치를 선택해야 반경 500m 음식점을 검색할 수 있습니다.", true);
    els.searchInput.focus();
    return;
  }

  const category = getSelectedCategory();
  const searchCategories =
    state.categoryId === "all" ? categories.filter((item) => item.id !== "all") : [category];
  setLoading(true);
  setStatus(`${state.selectedPlace.name} 주변 500m에서 맛집 라인업을 불러오는 중입니다...`);
  updateMapOverlay("반경 500m 검색 중");
  clearResults();

  try {
    const nearbyGroups = await Promise.all(
      searchCategories.map((item) =>
        nearbySearch({
          location: state.selectedPlace.location,
          radius: SEARCH_RADIUS_METERS,
          type: "restaurant",
          keyword: item.query,
        }).then((places) => places.map((place) => ({ ...place, maflixCategoryId: item.id }))),
      ),
    );
    const unique = dedupePlaces(nearbyGroups.flat())
      .filter((place) => place.geometry?.location)
      .map((place) => ({
        ...place,
        distance: getDistanceMeters(state.selectedPlace.location, place.geometry.location),
      }))
      .filter((place) => place.distance <= SEARCH_RADIUS_METERS)
      .sort((a, b) => scorePlace(b) - scorePlace(a))
      .slice(0, state.categoryId === "all" ? 30 : 12);

    if (unique.length === 0) {
      state.results = [];
      renderResults();
      updateMapOverlay("후보 0곳");
      setStatus("500m 안에서 조건에 맞는 음식점을 찾지 못했습니다. 카테고리를 바꿔 다시 검색해 보세요.");
      return;
    }

    const detailLimit = state.categoryId === "all" ? 18 : 8;
    const detailed = await hydratePlaceDetails(unique.slice(0, detailLimit));
    state.results = [...detailed, ...unique.slice(detailLimit)];
    renderResults();
    renderResultMarkers();
    showRandomDiscovery();
    setOverlayCollapsed(false);
    updateMapOverlay(`반경 500m · 후보 ${state.results.length}곳`);
    setStatus(`${state.results.length}개의 음식점을 찾았습니다.`);
  } catch (error) {
    setStatus(getPlacesErrorMessage(error), true);
  } finally {
    setLoading(false);
  }
}

function nearbySearch(request) {
  return new Promise((resolve, reject) => {
    state.service.nearbySearch(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK) {
        resolve(results || []);
        return;
      }
      if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
        return;
      }
      reject(status);
    });
  });
}

function hydratePlaceDetails(places) {
  return Promise.all(
    places.map(
      (place) =>
        new Promise((resolve) => {
          state.service.getDetails(
            {
              placeId: place.place_id,
              fields: DETAIL_FIELDS,
            },
            (detail, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && detail) {
                resolve({ ...place, ...detail, distance: place.distance });
              } else {
                resolve(place);
              }
            },
          );
        }),
    ),
  );
}

function renderChips() {
  els.moodChips.innerHTML = moods
    .map(
      (mood) =>
        `<button class="chip" type="button" data-mood="${mood.id}" aria-pressed="${
          state.selectedMoods.has(mood.id) ? "true" : "false"
        }">${mood.label}</button>`,
    )
    .join("");

  els.categoryChips.innerHTML = categories
    .map(
      (category) =>
        `<button class="chip" type="button" data-category="${category.id}" aria-pressed="${
          category.id === state.categoryId ? "true" : "false"
        }">${category.label}</button>`,
    )
    .join("");
}

function renderResults() {
  els.resultCount.textContent =
    state.results.length > 0
      ? `${state.results.length}곳 · 500m`
      : "검색 전";

  if (state.results.length === 0) {
    els.results.innerHTML = `<div class="empty-state">위치를 선택하고 주변 음식점을 검색해 보세요.</div>`;
    els.randomPick.disabled = true;
    els.rerunSearch.disabled = !state.selectedPlace;
    return;
  }

  els.randomPick.disabled = false;
  els.rerunSearch.disabled = false;
  els.results.innerHTML = renderCategoryRows();

  els.results.querySelectorAll(".place-card").forEach((card) => {
    const index = Number(card.dataset.index);
    card.addEventListener("mouseenter", () => highlightResult(index, false));
    card.addEventListener("focusin", () => highlightResult(index, false));
  });
}

function renderCategoryRows() {
  const rows = getResultRows();
  return rows
    .map(
      ({ category, places }) => `
        <section class="category-row" aria-labelledby="row-${category.id}">
          <div class="category-row__heading">
            <h3 id="row-${category.id}">${escapeHtml(category.label)}</h3>
            <span class="meta">${places.length}편</span>
          </div>
          <div class="poster-row">
            ${places.map(({ place, index }) => renderPlaceCard(place, index)).join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function getResultRows() {
  const baseCategories =
    state.categoryId === "all" ? categories.filter((category) => category.id !== "all") : [getSelectedCategory()];

  return baseCategories
    .map((category) => ({
      category,
      places: state.results
        .map((place, index) => ({ place, index }))
        .filter(({ place }) => inferCategory(place).id === category.id),
    }))
    .filter((row) => row.places.length > 0);
}

function renderPlaceCard(place, index) {
  const category = inferCategory(place);
  const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 720, maxHeight: 420 });
  const address = place.formatted_address || place.vicinity || "주소 정보 없음";
  const rating = place.rating ? `★ ${place.rating.toFixed(1)}` : "평점 미제공";
  const reviews = place.user_ratings_total ? `리뷰 ${place.user_ratings_total.toLocaleString()}개` : "리뷰 수 없음";
  const openNow = formatOpenNow(place.opening_hours);
  const reason = buildSelectionReason(place);
  const mapsUrl = sanitizeExternalUrl(
    place.url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${
        place.place_id
      }`,
  );
  const websiteUrl = sanitizeExternalUrl(place.website);

  return `
    <article class="place-card" data-index="${index}" tabindex="0" aria-label="${escapeHtml(place.name || "맛집 후보")}">
      <div class="place-card__media">
        ${
          photoUrl
            ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(place.name)} 사진" loading="lazy" />`
            : `<div class="placeholder-art" style="background: ${escapeHtml(
                category.gradient,
              )}" aria-hidden="true">${escapeHtml(category.label.slice(0, 1))}</div>`
        }
        <span class="place-card__badge">TOP ${index + 1}</span>
      </div>
      <div class="place-card__body">
        <div>
          <h3>${escapeHtml(place.name || "이름 없는 후보")}</h3>
          <div class="meta-row">
            <span class="meta">${rating}</span>
            <span class="meta">${Math.round(place.distance)}m</span>
            <span class="meta">${reviews}</span>
            <span class="meta">${openNow}</span>
          </div>
        </div>
        <p class="meta address">${escapeHtml(address)}</p>
        <div class="tag-row">
          ${buildTags(category).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <span class="reason">${escapeHtml(reason)}</span>
        <div class="card-actions">
          ${
            mapsUrl
              ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(
                  place.name,
                )} Google 지도에서 보기">지도에서 보기</a>`
              : ""
          }
          ${
            websiteUrl
              ? `<a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(
                  place.name,
                )} 웹사이트 열기">웹사이트</a>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

function renderResultMarkers() {
  state.resultMarkers.forEach((marker) => marker.setMap(null));
  state.resultMarkers = state.results.map((place, index) => {
    const marker = new google.maps.Marker({
      map: state.map,
      position: place.geometry.location,
      title: place.name,
      label: {
        text: String(index + 1),
        color: "#ffffff",
        fontWeight: "700",
      },
    });

    marker.addListener("click", () => {
      highlightResult(index, true);
      els.dailyDiscovery.innerHTML = buildDiscoveryHtml(place);
      updateHeroBackdrop(place);
    });

    return marker;
  });
}

function showRandomDiscovery() {
  if (state.results.length === 0) {
    els.dailyDiscovery.innerHTML = "<strong>오늘 뭐 먹지?</strong><span>검색 결과가 생기면 랜덤으로 고를 수 있습니다.</span>";
    return;
  }
  const index = Math.floor(Math.random() * state.results.length);
  const place = state.results[index];
  highlightResult(index, true);
  els.dailyDiscovery.innerHTML = buildDiscoveryHtml(place);
  updateHeroBackdrop(place);
}

function buildDiscoveryHtml(place) {
  const category = inferCategory(place);
  const reason = buildSelectionReason(place);
  return `
    <strong>${escapeHtml(place.name || "오늘의 선택")}</strong>
    <span>${Math.round(place.distance)}m · ${escapeHtml(category.label)} · ${escapeHtml(reason)}</span>
  `;
}

function updateHeroBackdrop(place) {
  if (!els.heroBackdrop) {
    return;
  }
  const category = inferCategory(place);
  const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 1440, maxHeight: 900 });
  const image = photoUrl
    ? `url("${photoUrl.replaceAll('"', "%22")}")`
    : category.gradient;
  els.heroBackdrop.style.backgroundImage = `
    linear-gradient(90deg, rgba(5, 5, 5, 0.98) 0%, rgba(5, 5, 5, 0.72) 42%, rgba(5, 5, 5, 0.18)),
    linear-gradient(180deg, rgba(5, 5, 5, 0.08), rgba(5, 5, 5, 0.78)),
    ${image}
  `;
}

function highlightResult(index, shouldScroll) {
  state.activeResultIndex = index;
  els.results.querySelectorAll(".place-card").forEach((card) => {
    const isActive = Number(card.dataset.index) === index;
    card.classList.toggle("is-active", isActive);
    if (isActive && shouldScroll) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  state.resultMarkers.forEach((marker, markerIndex) => {
    marker.setZIndex(markerIndex === index ? 1000 : null);
    marker.setAnimation(markerIndex === index ? google.maps.Animation.BOUNCE : null);
    if (markerIndex === index) {
      window.setTimeout(() => marker.setAnimation(null), 700);
    }
  });
}

function buildTags(category) {
  const moodTags = getSelectedMoodTags();
  return [...category.menuTags.slice(0, 3), ...moodTags.slice(0, 2)];
}

function getSelectedMoodTags() {
  return [...state.selectedMoods]
    .map((id) => moods.find((mood) => mood.id === id)?.tag)
    .filter(Boolean);
}

function inferCategory(place) {
  if (place.maflixCategoryId) {
    return categories.find((category) => category.id === place.maflixCategoryId) || categories[0];
  }

  if (state.categoryId !== "all") {
    return getSelectedCategory();
  }

  const typeText = `${place.name || ""} ${(place.types || []).join(" ")}`.toLowerCase();
  return (
    categories.find(
      (category) =>
        category.id !== "all" &&
        (typeText.includes(category.label.toLowerCase()) ||
          category.query
            .toLowerCase()
            .split(" ")
            .some((keyword) => keyword.length > 2 && typeText.includes(keyword))),
    ) || categories[0]
  );
}

function getSelectedCategory() {
  return categories.find((category) => category.id === state.categoryId) || categories[0];
}

function clearResults() {
  state.resultMarkers.forEach((marker) => marker.setMap(null));
  state.resultMarkers = [];
  state.results = [];
  state.activeResultIndex = null;
  els.results.innerHTML = "";
  els.resultCount.textContent = "검색 중...";
}

function setLoading(isLoading) {
  els.searchButton.disabled = isLoading;
  els.rerunSearch.disabled = isLoading || !state.selectedPlace;
  els.randomPick.disabled = isLoading || state.results.length === 0;
  els.searchButton.textContent = isLoading ? "검색 중..." : "Step 3. 주변 맛집 검색";
}

function setStatus(message, isError = false) {
  if (!els.status) {
    return;
  }
  els.status.textContent = message;
  els.status.classList.toggle("is-error", isError);
}

function updateMapOverlay(message) {
  if (!els.mapOverlay) {
    return;
  }
  els.mapOverlay.textContent = message;
}

function setOverlayCollapsed(isCollapsed) {
  state.overlayCollapsed = isCollapsed;
  els.overlayPanel.classList.toggle("is-collapsed", isCollapsed);
  els.overlayToggle.setAttribute("aria-expanded", String(!isCollapsed));
  els.overlayToggle.textContent = isCollapsed ? "결과 보기 ▲" : "결과 숨기기 ▼";
}

function setFilterPanelOpen(isOpen) {
  if (!els.filterPanel) {
    return;
  }
  state.filterPanelOpen = isOpen;
  els.filterPanel.classList.toggle("is-hidden", !isOpen);
  els.filterPanel.setAttribute("aria-hidden", String(!isOpen));
  if (els.filterToggle) {
    els.filterToggle.setAttribute("aria-expanded", String(isOpen));
  }
}

function getPlacesErrorMessage(status) {
  const map = {
    [google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT]:
      "Places API 쿼터를 초과했거나 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.",
    [google.maps.places.PlacesServiceStatus.REQUEST_DENIED]:
      "요청이 거부되었습니다. API Key 권한, Places API 활성화, HTTP referrer 제한을 확인해 주세요.",
    [google.maps.places.PlacesServiceStatus.INVALID_REQUEST]:
      "검색 요청이 올바르지 않습니다. 위치를 다시 선택해 주세요.",
    [google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR]:
      "Google Places 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };
  return map[status] || `장소 검색 중 오류가 발생했습니다. 상태: ${status}`;
}

function scorePlace(place) {
  const ratingScore = (place.rating || 0) * 20;
  const reviewScore = Math.min(place.user_ratings_total || 0, 500) / 10;
  const distanceScore = Math.max(0, SEARCH_RADIUS_METERS - place.distance) / 20;
  return ratingScore + reviewScore + distanceScore;
}

function buildSelectionReason(place) {
  const reasons = [];
  if (place.distance <= 250) reasons.push("가까움");
  if (place.opening_hours?.open_now) reasons.push("영업 중");
  if ((place.user_ratings_total || 0) >= 100) reasons.push("리뷰 많음");
  if (place.photos?.length) reasons.push("사진 있음");
  const mood = getSelectedMoodTags()[0];
  if (mood) reasons.push(mood);
  return reasons.slice(0, 2).join(" · ") || "조건에 맞는 후보";
}

function dedupePlaces(places) {
  const seen = new Set();
  return places.filter((place) => {
    const key = place.place_id || place.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDistanceMeters(origin, target) {
  const from = typeof origin.lat === "function" ? { lat: origin.lat(), lng: origin.lng() } : origin;
  const to = typeof target.lat === "function" ? { lat: target.lat(), lng: target.lng() } : target;
  const earthRadius = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function formatOpenNow(openingHours) {
  if (!openingHours || typeof openingHours.open_now === "undefined") {
    return "영업 정보 없음";
  }
  return openingHours.open_now ? "영업 중" : "영업 종료";
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function sanitizeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value), window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

*/