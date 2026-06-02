let map;
let imageLayer;
let imageBounds;
let selectedPoint = null;
let selectedMarker = null;
let selectedRegionLayer = null;
let regionLabelHandles = [];

const resourcesPanel = document.getElementById("resourcesPanel");

const drawnItems = new L.FeatureGroup();

let worldData = {
  mapImage: null,
  categories: ["City"],
  points: [],
  regions: []
};

map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -3,
  attributionControl: false,
  doubleClickZoom: false,
  zoomAnimation: false,
  markerZoomAnimation: false
});

map.addLayer(drawnItems);

// Leaflet.draw removes drawn shapes from this FeatureGroup when you use
// the left-side delete tool. Area labels are separate map markers, so they
// must be cleaned up whenever their owning drawn layer leaves drawnItems.
drawnItems.on("layerremove", e => {
  const layer = e.layer;
  if (!layer || !layer.regionData) return;

  removeRegionLabelOverlay(layer);

  if (selectedRegionLayer === layer) {
    selectedRegionLayer = null;
    clearRegionLabelHandles();
    clearRegionSidebar();
    showSidebarEditor(null);
  }
});

const drawControl = new L.Control.Draw({
  position: "topleft",
  draw: {
    marker: false,
    circle: false,
    circlemarker: false,
    polyline: false,
    rectangle: {
      shapeOptions: {
        color: "#4da6ff",
        weight: 2
      }
    },
    polygon: {
      allowIntersection: false,
      showArea: true,
      shapeOptions: {
        color: "#4da6ff",
        weight: 2,
        fillOpacity: 0.25
      }
    }
  },
  edit: {
    featureGroup: drawnItems,
    remove: true
  }
});

map.addControl(drawControl);

map.on("zoomend moveend", () => {
  drawnItems.eachLayer(layer => updateRegionLabelOverlay(layer));
});

updateCategoryDropdown();


enhanceColorInputs();
showSidebarEditor(null);

function showSidebarEditor(type) {
  const pointEditor = document.getElementById("pointEditor");
  const regionEditor = document.getElementById("regionEditor");
  const emptyMessage = document.getElementById("sidebarEmptyMessage");

  pointEditor.classList.toggle("hidden", type !== "point");
  regionEditor.classList.toggle("hidden", type !== "region");
  emptyMessage.classList.toggle("hidden", type === "point" || type === "region");

  if (!type) {
    document.getElementById("selectedTitle").textContent = "Nothing Selected";
  }
}

function enhanceColorInputs() {
  document.querySelectorAll('input[type="color"]').forEach(input => {
    if (input.closest(".color-preview-row")) return;

    const row = document.createElement("div");
    row.className = "color-preview-row";

    const value = document.createElement("span");
    value.className = "color-preview-value";

    input.parentNode.insertBefore(row, input);
    row.appendChild(input);
    row.appendChild(value);

    const syncPreview = () => {
      value.textContent = (input.value || "#000000").toUpperCase();
    };

    input.addEventListener("input", syncPreview);
    input.addEventListener("change", syncPreview);

    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (valueDescriptor && valueDescriptor.set && !input.dataset.colorPreviewEnhanced) {
      Object.defineProperty(input, "value", {
        get() {
          return valueDescriptor.get.call(this);
        },
        set(newValue) {
          valueDescriptor.set.call(this, newValue);
          requestAnimationFrame(syncPreview);
        }
      });
      input.dataset.colorPreviewEnhanced = "true";
    }

    syncPreview();
  });
}



document.getElementById("imageLoader").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById("filename").innerText = file.name;

  const reader = new FileReader();
  reader.onload = event => {
    worldData.mapImage = event.target.result;
    loadMapImage(worldData.mapImage);
  };

  reader.readAsDataURL(file);
});

function loadMapImage(src) {
  const img = new Image();

  img.onload = () => {
    const w = img.width;
    const h = img.height;

    imageBounds = [[0, 0], [h, w]];

    if (imageLayer) map.removeLayer(imageLayer);

    imageLayer = L.imageOverlay(src, imageBounds).addTo(map);
    imageLayer.bringToBack();
    drawnItems.bringToFront();
    map.fitBounds(imageBounds);
  };

  img.src = src;
}

map.on("dblclick", e => {
  if (!imageLayer) return;

  const point = {
    id: crypto.randomUUID(),
    name: "New Location",
    category: worldData.categories[0] || "Uncategorized",
    color: "#ff3333",
    icon: null,
    description: "",
    link: "",
    lat: e.latlng.lat,
    lng: e.latlng.lng
  };

  worldData.points.push(point);
  createMarker(point);

  selectedPoint = point;
  highlightSelectedMarker(point.marker);
  fillSidebar(point);

  point.marker.openPopup();
});

function createMarker(point) {
  const marker = L.marker([point.lat, point.lng], {
    draggable: true,
    icon: getMarkerIcon(point)
  })
    .addTo(map)
    .bindPopup(makePopup(point));

  marker.pointId = point.id;

  marker.on("click", e => {

    L.DomEvent.stopPropagation(e);

    selectedPoint = point;

    highlightSelectedMarker(marker);

    fillSidebar(point);

    marker.setPopupContent(makePopup(point));
    marker.openPopup();

  });

  marker.on("dragend", e => {
    const pos = e.target.getLatLng();
    point.lat = pos.lat;
    point.lng = pos.lng;
  });

  point.marker = marker;
}

function getMarkerIcon(point) {
  if (point.icon) {
    return L.divIcon({
      className: "",
      html: `<img class="custom-icon-marker" src="${point.icon}" />`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  }

  return L.divIcon({
    className: "",
    html: `<div class="custom-marker" style="background:${point.color};"></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

function refreshMarker(point) {
  if (!point.marker) return;

  point.marker.setIcon(getMarkerIcon(point));
  point.marker.setPopupContent(makePopup(point));
}

function makePopup(point) {
  return `
    <strong>${escapeHTML(point.name)}</strong><br>
    <em>${escapeHTML(point.category)}</em>
    <p>${escapeHTML(point.description || "")}</p>
    ${point.link ? `<a href="${escapeHTML(point.link)}" target="_blank">Open Link</a>` : ""}
  `;
}

function fillSidebar(point) {
  showSidebarEditor("point");
  document.getElementById("selectedTitle").textContent = point.name;
  document.getElementById("editName").value = point.name;
  document.getElementById("editCategory").value = point.category;
  document.getElementById("editColor").value = point.color || "#ff3333";
  document.getElementById("editDescription").value = point.description;
  document.getElementById("editLink").value = point.link;
}

function applyPointSidebarChanges() {
  if (!selectedPoint) return;

  selectedPoint.name = document.getElementById("editName").value || "Unnamed Location";
  selectedPoint.category = document.getElementById("editCategory").value;
  selectedPoint.color = document.getElementById("editColor").value || "#ff3333";
  selectedPoint.description = document.getElementById("editDescription").value;
  selectedPoint.link = document.getElementById("editLink").value;

  document.getElementById("selectedTitle").textContent = selectedPoint.name;
  refreshMarker(selectedPoint);
}

["editName", "editCategory", "editColor", "editDescription", "editLink"].forEach(id => {
  const input = document.getElementById(id);
  input.addEventListener("input", applyPointSidebarChanges);
  input.addEventListener("change", applyPointSidebarChanges);
});

document.getElementById("editIcon").addEventListener("change", e => {
  if (!selectedPoint) {
    alert("Click a point first.");
    e.target.value = "";
    return;
  }

  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = event => {
    selectedPoint.icon = event.target.result;
    refreshMarker(selectedPoint);
  };

  reader.readAsDataURL(file);
});

document.getElementById("clearIcon").addEventListener("click", () => {
  if (!selectedPoint) return alert("Click a point first.");

  selectedPoint.icon = null;
  document.getElementById("editIcon").value = "";
  refreshMarker(selectedPoint);
});

document.getElementById("deletePoint").addEventListener("click", () => {
  if (!selectedPoint) return alert("Click a point first.");

  map.removeLayer(selectedPoint.marker);
  worldData.points = worldData.points.filter(p => p.id !== selectedPoint.id);

  selectedPoint = null;

  showSidebarEditor(null);
  document.getElementById("editName").value = "";
  document.getElementById("editDescription").value = "";
  document.getElementById("editLink").value = "";
});

document.getElementById("addCategory").addEventListener("click", () => {
  const name = prompt("New category name:");
  if (!name) return;

  if (worldData.categories.includes(name)) {
    alert("That category already exists.");
    return;
  }

  worldData.categories.push(name);
  updateCategoryDropdown();

  document.getElementById("editCategory").value = name;

  if (selectedPoint) {
    selectedPoint.category = name;
    refreshMarker(selectedPoint);
  }
});

document.getElementById("removeCategory").addEventListener("click", () => {
  const categoryToRemove = document.getElementById("editCategory").value;

  if (!categoryToRemove) return;

  if (worldData.categories.length <= 1) {
    alert("You must keep at least one category.");
    return;
  }

  const confirmDelete = confirm(
    `Remove category "${categoryToRemove}"?\n\nPoints using it will be moved to another category.`
  );

  if (!confirmDelete) return;

  worldData.categories = worldData.categories.filter(
    category => category !== categoryToRemove
  );

  const fallbackCategory = worldData.categories[0];

  worldData.points.forEach(point => {
    if (point.category === categoryToRemove) {
      point.category = fallbackCategory;
      refreshMarker(point);
    }
  });

  updateCategoryDropdown();

  if (selectedPoint) {
    document.getElementById("editCategory").value = selectedPoint.category;
    fillSidebar(selectedPoint);
  }
});

function updateCategoryDropdown() {
  const select = document.getElementById("editCategory");
  select.innerHTML = "";

  worldData.categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}

map.on(L.Draw.Event.CREATED, e => {
  const layer = e.layer;

  setupRegionLayer(layer, {
    id: crypto.randomUUID(),
    name: "New Area",
    color: "#4da6ff"
  });

  drawnItems.addLayer(layer);
  layer.bringToFront();
  selectRegion(layer);
  saveRegionsFromMap();
});

map.on(L.Draw.Event.EDITED, e => {
  e.layers.eachLayer(layer => updateRegionTooltip(layer));
  saveRegionsFromMap();
});

map.on(L.Draw.Event.DELETED, e => {
  e.layers.eachLayer(layer => {
    removeRegionLabelOverlay(layer);

    if (selectedRegionLayer === layer) {
      selectedRegionLayer = null;
    }
  });

  clearRegionLabelHandles();
  clearRegionSidebar();
  showSidebarEditor(null);
  saveRegionsFromMap();
});

function setupRegionLayer(layer, properties = {}) {
  const data = {
    id: properties.id || crypto.randomUUID(),
    name: properties.name || "New Area",
    color: properties.color || "#4da6ff",
    labelVisible: properties.labelVisible !== false,
    labelTextColor: properties.labelTextColor || "#ffffff",
    labelBackgroundVisible: properties.labelBackgroundVisible !== false,
    labelBackground: properties.labelBackground || "#12161e",
    labelSize: Number(properties.labelSize || 14),
    labelWeight: properties.labelWeight || "bold",
    labelCurve: Number(properties.labelCurve || 0),
    labelStart: properties.labelStart || null,
    labelEnd: properties.labelEnd || null
  };

  layer.regionData = data;
  applyRegionStyle(layer);
  updateRegionTooltip(layer);

  layer.on("click", e => {
    L.DomEvent.stopPropagation(e);
    selectRegion(layer);
  });
}

function applyRegionStyle(layer) {
  if (!layer.setStyle || !layer.regionData) return;

  layer.setStyle({
    color: layer.regionData.color,
    fillColor: layer.regionData.color,
    weight: selectedRegionLayer === layer ? 4 : 2,
    fillOpacity: selectedRegionLayer === layer ? 0.38 : 0.25
  });
}

function updateRegionTooltip(layer) {
  updateRegionLabelOverlay(layer);
}

function updateRegionLabelOverlay(layer, shouldRefreshHandles = true) {
  if (!layer.regionData) return;

  // We render area labels as our own draggable/rotatable overlay instead of
  // Leaflet's tooltip. This removes the default white tooltip box and lets the
  // label endpoints be controlled independently.
  if (layer.getTooltip()) layer.unbindTooltip();

  if (layer.regionData.labelVisible === false) {
    removeRegionLabelOverlay(layer);
    if (shouldRefreshHandles) refreshRegionLabelHandles();
    return;
  }

  ensureRegionLabelEndpoints(layer);

  const startPoint = map.latLngToLayerPoint(layer.regionData.labelStart);
  const endPoint = map.latLngToLayerPoint(layer.regionData.labelEnd);
  const centerPoint = L.point(
    (startPoint.x + endPoint.x) / 2,
    (startPoint.y + endPoint.y) / 2
  );

  const zoomScale = getRegionLabelZoomScale(layer.regionData);
  const width = Math.max(20, startPoint.distanceTo(endPoint));
  const height = getRegionLabelHeight(layer.regionData, zoomScale);
  const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x) * 180 / Math.PI;
  layer.regionData._labelAngle = angle;
  const html = makeRegionLabelHTML(layer.regionData, width, zoomScale);

  const icon = L.divIcon({
    className: "region-label-overlay",
    html,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2]
  });

  if (!layer.regionLabelMarker) {
    layer.regionLabelMarker = L.marker(map.layerPointToLatLng(centerPoint), {
      interactive: false,
      keyboard: false,
      zoomAnimation: false,
      zIndexOffset: 200,
      icon
    }).addTo(map);
  } else {
    layer.regionLabelMarker.setLatLng(map.layerPointToLatLng(centerPoint));
    layer.regionLabelMarker.setIcon(icon);
  }

  if (shouldRefreshHandles) refreshRegionLabelHandles();
}

function removeRegionLabelOverlay(layer) {
  if (!layer) return;

  if (layer.getTooltip && layer.getTooltip()) {
    layer.unbindTooltip();
  }

  if (layer.regionLabelMarker) {
    if (map.hasLayer(layer.regionLabelMarker)) {
      map.removeLayer(layer.regionLabelMarker);
    }
    layer.regionLabelMarker = null;
  }
}

function ensureRegionLabelEndpoints(layer) {
  if (!Number.isFinite(Number(layer.regionData.labelBaseZoom))) {
    layer.regionData.labelBaseZoom = map.getZoom();
  }

  if (layer.regionData.labelStart && layer.regionData.labelEnd) return;

  const center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
  const centerPoint = map.latLngToLayerPoint(center);
  const defaultHalfWidth = 70;

  layer.regionData.labelStart = map.layerPointToLatLng([
    centerPoint.x - defaultHalfWidth,
    centerPoint.y
  ]);
  layer.regionData.labelEnd = map.layerPointToLatLng([
    centerPoint.x + defaultHalfWidth,
    centerPoint.y
  ]);
}

function getRegionLabelZoomScale(data) {
  const baseZoom = Number.isFinite(Number(data.labelBaseZoom))
    ? Number(data.labelBaseZoom)
    : map.getZoom();

  // Scale the label text/background with the map zoom so it shrinks when
  // zooming out instead of staying huge over the world map.
  return Math.max(0.08, Math.min(8, map.getZoomScale(map.getZoom(), baseZoom)));
}

function getRegionLabelHeight(data, zoomScale = 1) {
  const fontSize = Number(data.labelSize || 14) * zoomScale;
  const curve = Math.abs(Number(data.labelCurve || 0)) * zoomScale;
  return Math.max(10, curve + fontSize + (22 * zoomScale));
}

function makeRegionLabelHTML(data, widthOverride = null, zoomScale = 1) {
  const fontSize = Math.max(1, Number(data.labelSize || 14) * zoomScale);
  const fontFamily = data.labelFont || "Arial, sans-serif";
  const fontWeight = data.labelWeight || "bold";
  const textColor = data.labelTextColor || "#ffffff";
  const hasBackground = data.labelBackgroundVisible !== false;
  const background = hasBackground ? hexToRGBA(data.labelBackground || "#12161e", 0.82) : "transparent";
  const curve = Number(data.labelCurve || 0) * zoomScale;
  const labelText = data.name || "New Area";
  const width = Math.max(20, widthOverride || Math.ceil(labelText.length * fontSize * 0.72) + (36 * zoomScale));
  const height = getRegionLabelHeight(data, zoomScale);
  const midY = height / 2;
  const controlY = midY - curve;
  const pathId = `region-label-path-${escapeHTML(data.id || crypto.randomUUID())}`;

  return `
    <div class="region-label-rotator" style="transform: rotate(${data._labelAngle || 0}deg);">
      <svg
        class="region-label-svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
        aria-label="${escapeHTML(labelText)}"
      >
      <defs>
        <path
          id="${pathId}"
          d="M 0 ${midY} Q ${width / 2} ${controlY} ${width} ${midY}"
        />
      </defs>
      ${hasBackground ? `
      <use
        href="#${pathId}"
        stroke="${escapeHTML(background)}"
        stroke-width="${fontSize + (12 * zoomScale)}"
        stroke-linecap="round"
        fill="none"
      />` : ""}
      <text
        fill="${escapeHTML(textColor)}"
        font-size="${fontSize}"
        font-family="${escapeHTML(fontFamily)}"
        font-weight="${escapeHTML(fontWeight)}"
        text-anchor="middle"
      >
        <textPath href="#${pathId}" startOffset="50%">${escapeHTML(labelText)}</textPath>
      </text>
      </svg>
    </div>
  `;
}

function clearRegionLabelHandles() {
  regionLabelHandles.forEach(handle => map.removeLayer(handle));
  regionLabelHandles = [];
}

function refreshRegionLabelHandles() {
  clearRegionLabelHandles();

  if (!selectedRegionLayer || !selectedRegionLayer.regionData) return;
  if (selectedRegionLayer.regionData.labelVisible === false) return;

  ensureRegionLabelEndpoints(selectedRegionLayer);

  const makeHandle = (which, latlng) => {
    const handle = L.marker(latlng, {
      draggable: true,
      keyboard: false,
      zIndexOffset: 1000,
      icon: L.divIcon({
        className: "region-label-handle",
        html: '<span></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })
    }).addTo(map);

    handle.on("click", e => L.DomEvent.stopPropagation(e));
    handle.on("drag", () => {
      selectedRegionLayer.regionData[which] = handle.getLatLng();
      updateRegionLabelOverlay(selectedRegionLayer, false);
      saveRegionsFromMap();
    });
    handle.on("dragend", () => {
      updateRegionLabelOverlay(selectedRegionLayer, true);
      saveRegionsFromMap();
    });
    return handle;
  };

  regionLabelHandles = [
    makeHandle("labelStart", selectedRegionLayer.regionData.labelStart),
    makeHandle("labelEnd", selectedRegionLayer.regionData.labelEnd)
  ];
}

function hexToRGBA(hex, alpha = 1) {
  const match = String(hex).trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return `rgba(18, 22, 30, ${alpha})`;

  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function selectRegion(layer) {
  if (selectedRegionLayer && selectedRegionLayer !== layer) {
    applyRegionStyle(selectedRegionLayer);
  }

  selectedRegionLayer = layer;
  selectedPoint = null;

  if (selectedMarker) {
    const element = selectedMarker.getElement();
    if (element) element.classList.remove("selected-marker");
    selectedMarker = null;
  }

  applyRegionStyle(layer);
  fillRegionSidebar(layer);
  refreshRegionLabelHandles();
}

function fillRegionSidebar(layer) {
  showSidebarEditor("region");
  document.getElementById("selectedTitle").textContent = layer.regionData.name;
  document.getElementById("editRegionName").value = layer.regionData.name;
  document.getElementById("editRegionColor").value = layer.regionData.color || "#4da6ff";
  document.getElementById("editRegionLabelVisible").checked = layer.regionData.labelVisible !== false;
  document.getElementById("editRegionLabelTextColor").value = layer.regionData.labelTextColor || "#ffffff";
  document.getElementById("editRegionLabelBackgroundVisible").checked = layer.regionData.labelBackgroundVisible !== false;
  document.getElementById("editRegionLabelBackground").value = layer.regionData.labelBackground || "#12161e";
  document.getElementById("editRegionLabelSize").value = layer.regionData.labelSize || 14;
  document.getElementById("editRegionLabelFont").value = layer.regionData.labelFont || "Arial, sans-serif";
  document.getElementById("editRegionLabelWeight").value = layer.regionData.labelWeight || "bold";
  document.getElementById("editRegionLabelCurve").value = layer.regionData.labelCurve || 0;
}

function clearRegionSidebar() {
  document.getElementById("editRegionName").value = "";
  document.getElementById("editRegionColor").value = "#4da6ff";
  document.getElementById("editRegionLabelVisible").checked = true;
  document.getElementById("editRegionLabelTextColor").value = "#ffffff";
  document.getElementById("editRegionLabelBackgroundVisible").checked = true;
  document.getElementById("editRegionLabelBackground").value = "#12161e";
  document.getElementById("editRegionLabelSize").value = 14;
  document.getElementById("editRegionLabelFont").value = "Arial, sans-serif";
  document.getElementById("editRegionLabelWeight").value = "bold";
  document.getElementById("editRegionLabelCurve").value = 0;
}

function saveRegionsFromMap() {
  worldData.regions = [];

  drawnItems.eachLayer(layer => {
    const feature = layer.toGeoJSON();
    feature.properties = {
      ...(feature.properties || {}),
      ...(layer.regionData || {}),
      labelStart: layer.regionData?.labelStart ? { lat: layer.regionData.labelStart.lat, lng: layer.regionData.labelStart.lng } : null,
      labelEnd: layer.regionData?.labelEnd ? { lat: layer.regionData.labelEnd.lat, lng: layer.regionData.labelEnd.lng } : null
    };

    delete feature.properties._labelAngle;

    worldData.regions.push(feature);
  });
}

function applyRegionSidebarChanges() {
  if (!selectedRegionLayer) return;

  selectedRegionLayer.regionData.name =
    document.getElementById("editRegionName").value || "Unnamed Area";
  selectedRegionLayer.regionData.color =
    document.getElementById("editRegionColor").value || "#4da6ff";
  selectedRegionLayer.regionData.labelVisible =
    document.getElementById("editRegionLabelVisible").checked;
  selectedRegionLayer.regionData.labelTextColor =
    document.getElementById("editRegionLabelTextColor").value || "#ffffff";
  selectedRegionLayer.regionData.labelBackgroundVisible =
    document.getElementById("editRegionLabelBackgroundVisible").checked;
  selectedRegionLayer.regionData.labelBackground =
    document.getElementById("editRegionLabelBackground").value || "#12161e";
  selectedRegionLayer.regionData.labelSize = clampNumber(
    document.getElementById("editRegionLabelSize").value,
    10,
    72,
    14
  );
  selectedRegionLayer.regionData.labelFont =
    document.getElementById("editRegionLabelFont").value || "Arial, sans-serif";
  selectedRegionLayer.regionData.labelWeight =
    document.getElementById("editRegionLabelWeight").value || "bold";
  selectedRegionLayer.regionData.labelCurve = clampNumber(
    document.getElementById("editRegionLabelCurve").value,
    -300,
    300,
    0
  );

  applyRegionStyle(selectedRegionLayer);
  updateRegionTooltip(selectedRegionLayer);
  document.getElementById("selectedTitle").textContent =
    selectedRegionLayer.regionData.name;
  saveRegionsFromMap();
}

[
  "editRegionName",
  "editRegionColor",
  "editRegionLabelVisible",
  "editRegionLabelTextColor",
  "editRegionLabelBackgroundVisible",
  "editRegionLabelBackground",
  "editRegionLabelSize",
  "editRegionLabelFont",
  "editRegionLabelWeight",
  "editRegionLabelCurve"
].forEach(id => {
  const input = document.getElementById(id);
  input.addEventListener("input", applyRegionSidebarChanges);
  input.addEventListener("change", applyRegionSidebarChanges);
});

document.getElementById("deleteRegion").addEventListener("click", () => {
  if (!selectedRegionLayer) return alert("Click a drawn area first.");

  removeRegionLabelOverlay(selectedRegionLayer);
  clearRegionLabelHandles();
  drawnItems.removeLayer(selectedRegionLayer);
  selectedRegionLayer = null;
  clearRegionSidebar();
  showSidebarEditor(null);
  saveRegionsFromMap();
});


document.getElementById("saveWorld").addEventListener("click", () => {
  saveRegionsFromMap();

  const cleanData = {
    mapImage: worldData.mapImage,
    categories: worldData.categories,
    points: worldData.points.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      color: p.color,
      icon: p.icon,
      description: p.description,
      link: p.link,
      lat: p.lat,
      lng: p.lng
    })),
    regions: worldData.regions
  };

  const blob = new Blob([JSON.stringify(cleanData, null, 2)], {
    type: "application/json"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "world-data.json";
  a.click();
});

document.getElementById("loadWorld").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = event => {
    const data = JSON.parse(event.target.result);
    loadWorld(data);
  };

  reader.readAsText(file);
});

function loadWorld(data) {
  clearMarkers();
  removeAllRegionLabelOverlays();
  drawnItems.clearLayers();

  worldData = {
    mapImage: data.mapImage || null,
    categories: data.categories || ["Town"],
    points: data.points || [],
    regions: data.regions || []
  };

  updateCategoryDropdown();

  if (worldData.mapImage) {
    loadMapImage(worldData.mapImage);
  }

  worldData.points.forEach(point => {
    point.marker = null;
    createMarker(point);
  });

  worldData.regions.forEach(region => {
    const layerGroup = L.geoJSON(region);

    layerGroup.eachLayer(layer => {
      setupRegionLayer(layer, region.properties || {});
      drawnItems.addLayer(layer);
      layer.bringToFront();
    });
  });
}


function removeAllRegionLabelOverlays() {
  drawnItems.eachLayer(layer => removeRegionLabelOverlay(layer));
  clearRegionLabelHandles();
}

function clearMarkers() {
  if (!worldData.points) return;

  worldData.points.forEach(point => {
    if (point.marker) {
      map.removeLayer(point.marker);
    }
  });
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function highlightSelectedMarker(marker) {

  if (selectedMarker) {
    const oldElement = selectedMarker.getElement();

    if (oldElement) {
      oldElement.classList.remove("selected-marker");
    }
  }

  selectedMarker = marker;

  if (selectedRegionLayer) {
    const oldRegion = selectedRegionLayer;
    selectedRegionLayer = null;
    applyRegionStyle(oldRegion);
    clearRegionLabelHandles();
    clearRegionSidebar();
  }

  const element = marker.getElement();

  if (element) {
    element.classList.add("selected-marker");
  }
}

const helpPanel = document.getElementById("helpPanel");

function openHelpPanel() {
  helpPanel.classList.remove("hidden");
  resourcesPanel.classList.add("hidden");
}

function closeHelpPanel() {
  helpPanel.classList.add("hidden");
}

document.getElementById("toggleHelp").addEventListener("click", () => {
  if (helpPanel.classList.contains("hidden")) {
    openHelpPanel();
  } else {
    closeHelpPanel();
  }
});

document.getElementById("closeHelp").addEventListener("click", closeHelpPanel);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeHelpPanel();
    resourcesPanel.classList.add("hidden");
  }
});

function clearSelection() {

  if (selectedMarker) {
    selectedMarker.closePopup();
    const element = selectedMarker.getElement();

    if (element) {
      element.classList.remove("selected-marker");
    }
  }

  selectedMarker = null;
  selectedPoint = null;

  if (selectedRegionLayer) {
    const oldRegion = selectedRegionLayer;
    selectedRegionLayer = null;
    applyRegionStyle(oldRegion);
    clearRegionLabelHandles();
    clearRegionSidebar();
  }

  showSidebarEditor(null);

  document.getElementById("editName").value = "";
  document.getElementById("editDescription").value = "";
  document.getElementById("editLink").value = "";

  if (document.getElementById("editColor")) {
    document.getElementById("editColor").value = "#ff3333";
  }
}

map.on("click", e => {

  if (selectedMarker || selectedRegionLayer) {
    clearSelection();
  }

});

function openResourcesPanel() {
  resourcesPanel.classList.remove("hidden");
  closeHelpPanel();
}

function closeResourcesPanel() {
  resourcesPanel.classList.add("hidden");
}

document.getElementById("toggleResources").addEventListener("click", () => {
  if (resourcesPanel.classList.contains("hidden")) {
    openResourcesPanel();
  } else {
    closeResourcesPanel();
  }
});

document.getElementById("closeResources").addEventListener("click", closeResourcesPanel);