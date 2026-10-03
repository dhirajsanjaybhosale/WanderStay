// Safe Mapbox Map Initialization
(function () {
  const container = document.getElementById("map");
  if (!container) return;

  const token = window.mapToken;
  const listingData = window.listing;

  if (!token) {
    container.innerHTML = '<div class="map-error"><i class="fa-solid fa-map-location-dot fs-3 mb-2 d-block"></i>Map token is not configured. Add MAP_TOKEN to .env</div>';
    return;
  }

  if (typeof mapboxgl === "undefined") {
    container.innerHTML = '<div class="map-error"><i class="fa-solid fa-triangle-exclamation fs-3 mb-2 d-block"></i>Map library failed to load.</div>';
    return;
  }

  let coords = [77.2090, 28.6139]; // Default coordinates
  if (
    listingData &&
    listingData.geometry &&
    Array.isArray(listingData.geometry.coordinates) &&
    listingData.geometry.coordinates.length === 2 &&
    !isNaN(listingData.geometry.coordinates[0]) &&
    !isNaN(listingData.geometry.coordinates[1])
  ) {
    coords = listingData.geometry.coordinates;
  }

  try {
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: coords,
      zoom: 11,
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add custom popup and marker
    const popupTitle = (listingData && listingData.title) ? listingData.title : "WanderStay Property";
    const popupLocation = (listingData && listingData.location) ? listingData.location : "Exact location provided after booking";

    const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(`
      <div style="padding: 6px; font-family: 'Plus Jakarta Sans', sans-serif;">
        <strong style="font-size: 13px; color: #1F2937;">${popupTitle}</strong>
        <p style="margin: 3px 0 0 0; font-size: 11px; color: #6B7280;">📍 ${popupLocation}</p>
      </div>
    `);

    new mapboxgl.Marker({ color: "#FF385C" })
      .setLngLat(coords)
      .setPopup(popup)
      .addTo(map);

  } catch (err) {
    console.error("Map initialization notice:", err);
    container.innerHTML = '<div class="map-error"><i class="fa-solid fa-location-dot fs-3 mb-2 d-block text-danger"></i>Interactive map could not be loaded. Location: ' + ((listingData && listingData.location) || 'Available') + '</div>';
  }
})();