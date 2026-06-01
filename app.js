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
};

renderChips();
bindEvents();
if (els.overlayToggle && els.overlayPanel) {
  setOverlayCollapsed(false);
}
updateMapOverlay("반경 500m 검색 대기 중");
bootstrapApiKey();

function bindEvents() {
  els.searchButton.addEventListener("click", runSearch);
  els.rerunSearch.addEventListener("click", runSearch);
  els.randomPick.addEventListener("click", showRandomDiscovery);
  els.moodChips.addEventListener("click", (event) => {
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
  });
  els.categoryChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.categoryId = button.dataset.category;
    renderChips();
    if (state.selectedPlace && state.results.length > 0) {
      runSearch();
    }
  });
  els.recenterButton.addEventListener("click", () => {
    if (state.map && state.selectedPlace?.location) {
      state.map.panTo(state.selectedPlace.location);
      state.map.setZoom(16);
    }
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
    els.locationSummary.textContent =
      "Google Maps API 키가 설정되면 Maflix 추천과 위치 검색이 활성화됩니다.";
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
  els.searchButton.disabled = false;
  setStatus("장소를 검색한 뒤 주변 500m 맛집을 Maflix 카드로 볼 수 있습니다.");
  els.locationSummary.textContent = "장소명 또는 주소를 입력하면 자동완성 후보가 나타납니다.";
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
  els.locationSummary.textContent = `${state.selectedPlace.name} 기준 500m 검색 준비 완료`;
  els.recenterButton.disabled = false;
  setStatus("주변 검색 버튼을 누르면 반경 500m 음식점을 찾습니다.");
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
  els.searchButton.textContent = isLoading ? "검색 중..." : "주변 검색";
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("is-error", isError);
}

function updateMapOverlay(message) {
  els.mapOverlay.textContent = message;
}

function setOverlayCollapsed(isCollapsed) {
  state.overlayCollapsed = isCollapsed;
  els.overlayPanel.classList.toggle("is-collapsed", isCollapsed);
  els.overlayToggle.setAttribute("aria-expanded", String(!isCollapsed));
  els.overlayToggle.textContent = isCollapsed ? "패널 열기 ▲" : "패널 닫기 ▼";
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
