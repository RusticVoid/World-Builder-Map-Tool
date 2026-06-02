let map;
let imageLayer;
let imageBounds;
let selectedPoint = null;
let selectedMarker = null;
let selectedRegionLayer = null;

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
  doubleClickZoom: false
});

map.addLayer(drawnItems);

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

updateCategoryDropdown();

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

  document.getElementById("selectedTitle").textContent = "No Location Selected";
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
  selectRegion(layer);
  saveRegionsFromMap();
});

map.on(L.Draw.Event.EDITED, e => {
  e.layers.eachLayer(layer => updateRegionTooltip(layer));
  saveRegionsFromMap();
});

map.on(L.Draw.Event.DELETED, () => {
  selectedRegionLayer = null;
  clearRegionSidebar();
  saveRegionsFromMap();
});

function setupRegionLayer(layer, properties = {}) {
  const data = {
    id: properties.id || crypto.randomUUID(),
    name: properties.name || "New Area",
    color: properties.color || "#4da6ff"
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
  if (!layer.regionData) return;

  const label = escapeHTML(layer.regionData.name || "New Area");

  if (layer.getTooltip()) {
    layer.setTooltipContent(label);
  } else {
    layer.bindTooltip(label, {
      permanent: true,
      direction: "center",
      className: "region-label"
    });
  }
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
}

function fillRegionSidebar(layer) {
  document.getElementById("selectedTitle").textContent = layer.regionData.name;
  document.getElementById("editRegionName").value = layer.regionData.name;
  document.getElementById("editRegionColor").value = layer.regionData.color || "#4da6ff";
}

function clearRegionSidebar() {
  document.getElementById("editRegionName").value = "";
  document.getElementById("editRegionColor").value = "#4da6ff";
}

function saveRegionsFromMap() {
  worldData.regions = [];

  drawnItems.eachLayer(layer => {
    const feature = layer.toGeoJSON();
    feature.properties = {
      ...(feature.properties || {}),
      ...(layer.regionData || {})
    };

    worldData.regions.push(feature);
  });
}

function applyRegionSidebarChanges() {
  if (!selectedRegionLayer) return;

  selectedRegionLayer.regionData.name =
    document.getElementById("editRegionName").value || "Unnamed Area";
  selectedRegionLayer.regionData.color =
    document.getElementById("editRegionColor").value || "#4da6ff";

  applyRegionStyle(selectedRegionLayer);
  updateRegionTooltip(selectedRegionLayer);
  document.getElementById("selectedTitle").textContent =
    selectedRegionLayer.regionData.name;
  saveRegionsFromMap();
}

["editRegionName", "editRegionColor"].forEach(id => {
  const input = document.getElementById(id);
  input.addEventListener("input", applyRegionSidebarChanges);
  input.addEventListener("change", applyRegionSidebarChanges);
});

document.getElementById("deleteRegion").addEventListener("click", () => {
  if (!selectedRegionLayer) return alert("Click a drawn area first.");

  drawnItems.removeLayer(selectedRegionLayer);
  selectedRegionLayer = null;
  clearRegionSidebar();
  document.getElementById("selectedTitle").textContent = "No Location Selected";
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
    });
  });
}

function clearMarkers() {
  if (!worldData.points) return;

  worldData.points.forEach(point => {
    if (point.marker) {
      map.removeLayer(point.marker);
    }
  });
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
    clearRegionSidebar();
  }

  const element = marker.getElement();

  if (element) {
    element.classList.add("selected-marker");
  }
}

document.getElementById("toggleHelp").addEventListener("click", () => {
  document.getElementById("helpPanel").classList.toggle("hidden");
});

document.getElementById("closeHelp").addEventListener("click", () => {
  document.getElementById("helpPanel").classList.add("hidden");
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
    clearRegionSidebar();
  }

  document.getElementById("selectedTitle").textContent =
    "No Location Selected";

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