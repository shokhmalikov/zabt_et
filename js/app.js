const viewContainer = document.getElementById('view-container');

// State
let appState = {
    identityColor: 'var(--neon-green)',
    identityColorName: 'TOXIC GREEN',
    homeBase: 'Tashkent',
    location: null,
    user: null,
    runType: 'solo',
    runActive: false,
    runPaused: false,
    runSeconds: 0,
    runDistance: 0, // km
    groupDistance: 0, // km
    userArea: 0,
    enemyArea: 0,
    currentPath: [],
    ghost1Path: [],
    ghost2Path: [],
    enemyPath: []
};

let map;
let marker;
let watchId;
let simInterval;
let runTimer;
let lobbyTimeout;

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic2hva2huaXlveiIsImEiOiJjbW9wbDduam4xaWIxMndwaGpqZGNibjNpIn0.5JPq7sX4O0eREJMSTOo64A';

function initMap() {
    if (map) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    // Default to Tashkent coordinates if no location
    const startLngLat = appState.location ? [appState.location.lng, appState.location.lat] : [69.2401, 41.2995];
    
    map = new mapboxgl.Map({
        container: 'map-container',
        style: 'mapbox://styles/mapbox/dark-v11', // Dark style
        center: startLngLat,
        zoom: 16,
        attributionControl: false
    });

    map.on('load', () => {
        // Source for drawing the path
        map.addSource('route', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': []
                }
            }
        });

        // Layer for drawing the path
        map.addLayer({
            'id': 'route',
            'type': 'line',
            'source': 'route',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#10b981', // Fallback to green
                'line-width': 6,
                'line-opacity': 0.8
            }
        });

        // Ghost 1 (Blue)
        map.addSource('route-ghost1', { 'type': 'geojson', 'data': { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': [] } } });
        map.addLayer({ 'id': 'route-ghost1', 'type': 'line', 'source': 'route-ghost1', 'layout': { 'line-join': 'round', 'line-cap': 'round' }, 'paint': { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.8 } });

        // Ghost 2 (Orange)
        map.addSource('route-ghost2', { 'type': 'geojson', 'data': { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': [] } } });
        map.addLayer({ 'id': 'route-ghost2', 'type': 'line', 'source': 'route-ghost2', 'layout': { 'line-join': 'round', 'line-cap': 'round' }, 'paint': { 'line-color': '#f59e0b', 'line-width': 6, 'line-opacity': 0.8 } });

        // Enemy Route (Red)
        map.addSource('route-enemy', { 'type': 'geojson', 'data': { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': [] } } });
        map.addLayer({ 'id': 'route-enemy', 'type': 'line', 'source': 'route-enemy', 'layout': { 'line-join': 'round', 'line-cap': 'round' }, 'paint': { 'line-color': '#f43f5e', 'line-width': 6, 'line-opacity': 0.8 } });

        // Enemy Territory
        map.addSource('territory-enemy', { 'type': 'geojson', 'data': { 'type': 'FeatureCollection', 'features': [] } });
        map.addLayer({ 'id': 'territory-enemy-fill', 'type': 'fill', 'source': 'territory-enemy', 'paint': { 'fill-color': '#f43f5e', 'fill-opacity': 0.2 } });
        map.addLayer({ 'id': 'territory-enemy-line', 'type': 'line', 'source': 'territory-enemy', 'paint': { 'line-color': '#f43f5e', 'line-width': 2 } });

        // Layer for drawing claimed territory (polygons)
        map.addSource('territories', {
            'type': 'geojson',
            'data': {
                'type': 'FeatureCollection',
                'features': []
            }
        });

        map.addLayer({
            'id': 'territories-fill',
            'type': 'fill',
            'source': 'territories',
            'paint': {
                'fill-color': '#10b981', // Fallback to green
                'fill-opacity': 0.4
            }
        });
        
        // --- GLOBAL MAP TERRITORIES ---
        const globalFeatures = [
            {
                'type': 'Feature',
                'properties': { 'owner': 'Team Alpha', 'area': '45,200 m²', 'color': '#10b981' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[
                        [69.238, 41.298], [69.242, 41.297], [69.243, 41.300], [69.239, 41.301], [69.238, 41.298]
                    ]]
                }
            },
            {
                'type': 'Feature',
                'properties': { 'owner': 'Team Crimson', 'area': '38,500 m²', 'color': '#f43f5e' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[
                        [69.244, 41.302], [69.248, 41.300], [69.250, 41.304], [69.246, 41.305], [69.244, 41.302]
                    ]]
                }
            },
            {
                'type': 'Feature',
                'properties': { 'owner': 'Team Cobalt', 'area': '29,100 m²', 'color': '#3b82f6' },
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [[
                        [69.235, 41.303], [69.237, 41.302], [69.239, 41.305], [69.236, 41.306], [69.235, 41.303]
                    ]]
                }
            }
        ];

        map.addSource('global-territories', {
            'type': 'geojson',
            'data': { 'type': 'FeatureCollection', 'features': globalFeatures }
        });

        map.addLayer({
            'id': 'global-territories-fill',
            'type': 'fill',
            'source': 'global-territories',
            'paint': {
                'fill-color': ['get', 'color'],
                'fill-opacity': 0.3
            }
        });

        map.addLayer({
            'id': 'global-territories-line',
            'type': 'line',
            'source': 'global-territories',
            'paint': {
                'line-color': ['get', 'color'],
                'line-width': 2
            }
        });

        // Click interaction for Global Map
        map.on('click', 'global-territories-fill', (e) => {
            if (appState.runActive) return; // Don't interrupt runs
            const props = e.features[0].properties;
            new mapboxgl.Popup({ closeButton: false })
                .setLngLat(e.lngLat)
                .setHTML(`<strong style="color:${props.color}">${props.owner}</strong><br><span style="color:#8b92a5; font-size:12px;">Territory: ${props.area}</span>`)
                .addTo(map);
        });

        map.on('mouseenter', 'global-territories-fill', () => { if(!appState.runActive) map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'global-territories-fill', () => { map.getCanvas().style.cursor = ''; });
        // ------------------------------
        
        // Add a marker for current position
        const el = document.createElement('div');
        el.className = 'player-marker';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.backgroundColor = '#10b981';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid #fff';
        el.style.boxShadow = `0 0 15px #10b981`;

        marker = new mapboxgl.Marker(el)
            .setLngLat(startLngLat)
            .addTo(map);
    });
}

// Logic functions
function requestLocationAccess() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Success! We have the location.
                appState.location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                alert('Location secured! Proceeding to the Dashboard...');
                navigate('home');
            },
            (error) => {
                // User denied or error
                alert('Location access is required to play Zabt Et. Please enable it in your browser settings.');
            }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

function selectColor(el, color, name) {
    document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    appState.identityColor = color;
    appState.identityColorName = name;
    document.getElementById('selected-color-name').innerText = name;
    
    // We update the CSS variable dynamically so the active ring changes to the chosen color
    document.documentElement.style.setProperty('--neon-green', color);
}

function selectRegion(el, region) {
    document.querySelectorAll('.region-item').forEach(r => {
        r.classList.remove('active');
        const icon = r.querySelector('i');
        if (icon) icon.style.display = 'none';
    });
    el.classList.add('active');
    const icon = el.querySelector('i');
    if (icon) icon.style.display = 'block';
    appState.homeBase = region;
}

function signUp() {
    const name = document.getElementById('auth-name').value;
    const phone = document.getElementById('auth-phone').value;
    if(!name || !phone) {
        alert('Please fill out all fields.');
        return;
    }
    appState.user = { name, phone };
    navigate('onboarding6'); // Because onboarding-location is now onboarding6
}

function checkAuthAndGroup() {
    if(!appState.user) {
        alert('You must be signed in to join a Group Run.');
        navigate('auth');
    } else {
        navigate('group-lobby');
    }
}

function checkAuthAndPrivate() {
    if(!appState.user) {
        alert('You must be signed in to join a Private Match.');
        navigate('auth');
    } else {
        navigate('private-lobby');
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    
    document.querySelectorAll('.theme-toggle i').forEach(btn => {
        if (isLight) {
            btn.classList.replace('ph-sun', 'ph-moon');
        } else {
            btn.classList.replace('ph-moon', 'ph-sun');
        }
    });
    
    if (map) {
        map.setStyle(isLight ? 'mapbox://styles/mapbox/light-v11' : 'mapbox://styles/mapbox/dark-v11');
    }
}

// Math Helpers
function deg2rad(deg) { return deg * (Math.PI/180); }

function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2-lat1);
    const dLon = deg2rad(lon2-lon1); 
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2); 
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function getApproxArea(path) {
    if (path.length < 3) return 0;
    const R = 6371000;
    const lat0 = path[0][1] * Math.PI / 180;
    const pts = path.map(p => ({
        x: p[0] * Math.PI / 180 * R * Math.cos(lat0),
        y: p[1] * Math.PI / 180 * R
    }));
    let area = 0;
    for(let i=0; i<pts.length; i++){
        let j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2);
}

function updateRunUI() {
    if (!document.getElementById('ui-time')) return; // Not on the run screen
    
    const mins = Math.floor(appState.runSeconds / 60).toString().padStart(2, '0');
    const secs = (appState.runSeconds % 60).toString().padStart(2, '0');
    document.getElementById('ui-time').innerText = `${mins}:${secs}`;
    
    const targetDist = appState.runType.startsWith('group') ? appState.groupDistance : appState.runDistance;
    
    if (document.getElementById('ui-distance')) {
        document.getElementById('ui-distance').innerText = targetDist.toFixed(2);
        
        let paceStr = "0:00";
        if (targetDist > 0.001) {
            const paceTotalSeconds = appState.runSeconds / targetDist;
            const paceMins = Math.floor(paceTotalSeconds / 60);
            const paceSecs = Math.floor(paceTotalSeconds % 60).toString().padStart(2, '0');
            paceStr = `${paceMins}:${paceSecs}`;
        }
        document.getElementById('ui-pace').innerText = paceStr;
        
        const points = Math.floor(targetDist * 500 + appState.runSeconds * 0.5);
        document.getElementById('ui-points').innerText = points.toString();
    }
    
    // Update individual stats if they exist
    const indDistEl = document.getElementById('ui-ind-distance');
    if (indDistEl) {
        indDistEl.innerText = appState.runDistance.toFixed(2);
        let indPaceStr = "0:00";
        if (appState.runDistance > 0.001) {
            const indPaceSecs = appState.runSeconds / appState.runDistance;
            const pm = Math.floor(indPaceSecs / 60);
            const ps = Math.floor(indPaceSecs % 60).toString().padStart(2, '0');
            indPaceStr = `${pm}:${ps}`;
        }
        document.getElementById('ui-ind-pace').innerText = indPaceStr;
    }
    
    const areaContainer = document.getElementById('projected-area');
    if (appState.currentPath.length >= 3) {
        if(areaContainer) areaContainer.classList.add('visible');
        const areaSqM = getApproxArea([...appState.currentPath, appState.currentPath[0]]);
        let areaText = areaSqM > 10000 ? `${(areaSqM/10000).toFixed(2)} ha` : `${Math.floor(areaSqM)} m²`;
        if(document.getElementById('ui-area')) document.getElementById('ui-area').innerText = `Projected Area: ${areaText}`;
    } else {
        if(areaContainer) areaContainer.classList.remove('visible');
    }

    if (appState.runType.startsWith('private')) {
        const uArea = getApproxArea([...appState.currentPath, appState.currentPath[0] || [0,0]]);
        const eArea = getApproxArea([...appState.enemyPath, appState.enemyPath[0] || [0,0]]);
        appState.userArea = uArea;
        appState.enemyArea = eArea;
        
        if (document.getElementById('ui-user-area')) {
            document.getElementById('ui-user-area').innerText = `${Math.floor(uArea)} m²`;
            document.getElementById('ui-enemy-area').innerText = `${Math.floor(eArea)} m²`;
        }
    }
}

function startSoloRun() {
    appState.runType = 'solo';
    appState.runActive = true;
    appState.runPaused = false;
    appState.runSeconds = 0;
    appState.runDistance = 0;
    appState.currentPath = [];
    
    navigate('solo-run');
    
    // Start game loop
    if (runTimer) clearInterval(runTimer);
    runTimer = setInterval(() => {
        if (!appState.runPaused) {
            appState.runSeconds++;
            updateRunUI();
        }
    }, 1000);
    
    // Clear previous path
    if (map && map.getSource('route')) {
        map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
        if(map.getSource('route-ghost1')) {
            map.getSource('route-ghost1').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
            map.getSource('route-ghost2').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
        }
    }

    // Attempt to watch position
    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(updatePosition, (err) => console.log(err), { enableHighAccuracy: true });
    }
}

function startGroupRun(role) {
    appState.runType = 'group-' + role;
    appState.runActive = true;
    appState.runPaused = false;
    appState.runSeconds = 0;
    appState.runDistance = 0;
    appState.groupDistance = 0;
    appState.currentPath = [];
    appState.ghost1Path = [];
    appState.ghost2Path = [];
    appState.enemyPath = [];
    
    navigate('group-run');
    
    if (runTimer) clearInterval(runTimer);
    runTimer = setInterval(() => {
        if (!appState.runPaused) {
            appState.runSeconds++;
            updateRunUI();
        }
    }, 1000);
    
    if (map && map.getSource('route')) {
        map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
        if(map.getSource('route-ghost1')) {
            map.getSource('route-ghost1').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
            map.getSource('route-ghost2').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
        }
    }

    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(updatePosition, (err) => console.log(err), { enableHighAccuracy: true });
    }
}

function startPrivateRun(role) {
    appState.runType = 'private-' + role;
    appState.runActive = true;
    appState.runPaused = false;
    appState.runSeconds = 0;
    appState.runDistance = 0;
    appState.userArea = 0;
    appState.enemyArea = 0;
    appState.currentPath = [];
    appState.enemyPath = [];
    
    navigate('private-run');
    
    if (runTimer) clearInterval(runTimer);
    runTimer = setInterval(() => {
        if (!appState.runPaused) {
            appState.runSeconds++;
            updateRunUI();
        }
    }, 1000);
    
    if (map && map.getSource('route')) {
        map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
        if(map.getSource('route-enemy')) {
            map.getSource('route-enemy').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
            map.getSource('territory-enemy').setData({ type: 'FeatureCollection', features: [] });
        }
    }

    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(updatePosition, (err) => console.log(err), { enableHighAccuracy: true });
    }
}

function togglePause() {
    appState.runPaused = !appState.runPaused;
    const btnIcon = document.getElementById('pause-icon');
    if(appState.runPaused) {
        btnIcon.classList.replace('ph-pause', 'ph-play');
        document.querySelector('.recording-dot').style.animation = 'none';
        document.querySelector('.recording-dot').style.opacity = '0.3';
    } else {
        btnIcon.classList.replace('ph-play', 'ph-pause');
        document.querySelector('.recording-dot').style.animation = 'pulse-red 1.5s infinite';
        document.querySelector('.recording-dot').style.opacity = '1';
    }
}

function updatePosition(position) {
    if (!appState.runActive || appState.runPaused) return;
    
    const lng = position.coords.longitude;
    const lat = position.coords.latitude;
    const coord = [lng, lat];
    
    if (appState.currentPath.length > 0) {
        const lastCoord = appState.currentPath[appState.currentPath.length - 1];
        const dist = getDistanceKm(lastCoord[1], lastCoord[0], lat, lng);
        appState.runDistance += dist;
        if (appState.runType.startsWith('group')) {
            appState.groupDistance += (dist * 3); // Simulate 3 people
        } else {
            appState.groupDistance += dist;
        }
    }
    
    appState.currentPath.push(coord);
    if (marker) marker.setLngLat(coord);
    
    if (appState.runType.startsWith('group')) {
         const ghost1Coord = [coord[0] + 0.0002, coord[1] + 0.0001]; 
         const ghost2Coord = [coord[0] - 0.0001, coord[1] + 0.0002]; 
         appState.ghost1Path.push(ghost1Coord);
         appState.ghost2Path.push(ghost2Coord);
    }
    
    if (appState.runType.startsWith('private')) {
         // Create a moderate expanding circular path for the enemy
         const r = 0.001 + (appState.runSeconds * 0.0001); // Faster expansion
         const theta = appState.runSeconds * 0.5; // Faster rotation
         const enemyCoord = [coord[0] + 0.002 + Math.cos(theta)*r, coord[1] + Math.sin(theta)*r];
         appState.enemyPath.push(enemyCoord);
    }
    
    if (map) {
        map.panTo(coord);
        if (map.getSource('route')) {
            map.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: appState.currentPath } });
            
            if (appState.runType.startsWith('group')) {
                map.getSource('route-ghost1').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: appState.ghost1Path } });
                map.getSource('route-ghost2').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: appState.ghost2Path } });
            }
            if (appState.runType.startsWith('private') && map.getSource('route-enemy')) {
                map.getSource('route-enemy').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: appState.enemyPath } });
            }
        }
    }
    updateRunUI();
}

function simulateRun() {
    if (!appState.runActive || !map) return;
    
    let currentPos = appState.currentPath.length > 0 
        ? [...appState.currentPath[appState.currentPath.length - 1]]
        : (appState.location ? [appState.location.lng, appState.location.lat] : [69.2401, 41.2995]);
        
    clearInterval(simInterval);
    simInterval = setInterval(() => {
        if(appState.runPaused) return;
        // Move slightly East and North to simulate walking
        currentPos[0] += 0.0001 + (Math.random() * 0.0001);
        currentPos[1] += 0.0001 + (Math.random() * 0.0001);
        
        updatePosition({ coords: { longitude: currentPos[0], latitude: currentPos[1] } });
    }, 1000);
}

function stopRun() {
    appState.runActive = false;
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (simInterval) clearInterval(simInterval);
    if (runTimer) clearInterval(runTimer);
    
    if (appState.currentPath.length > 2) {
        const closedPath = [...appState.currentPath, appState.currentPath[0]];
        const areaSqM = getApproxArea(closedPath);
        const areaText = areaSqM > 10000 ? `${(areaSqM/10000).toFixed(2)} ha` : `${Math.floor(areaSqM)} m²`;
        
        if (map && map.getSource('territories')) {
            map.getSource('territories').setData({
                'type': 'FeatureCollection',
                'features': [{
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [closedPath]
                    }
                }]
            });
            
            map.getSource('route').setData({ type: 'Feature', geometry: { 'type': 'LineString', 'coordinates': [] } });
            if(map.getSource('route-ghost1')) {
                map.getSource('route-ghost1').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
                map.getSource('route-ghost2').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
            }
        }
        alert(`Run Stopped!\nDistance: ${appState.runDistance.toFixed(2)} km\nTime: ${document.getElementById('ui-time').innerText}\nTerritory Claimed: ${areaText}`);
    } else {
        alert('Run Stopped! Path too short to claim territory.');
    }
    
    navigate('home');
}

function stopGroupRun() {
    appState.runActive = false;
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (simInterval) clearInterval(simInterval);
    if (runTimer) clearInterval(runTimer);
    
    if(appState.runType === 'group-join') {
        alert("You left the squad run.");
    } else {
        alert("Squad Run Stopped! Territory Claimed for the team.");
    }
    navigate('home');
}

function stopPrivateRun() {
    appState.runActive = false;
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (simInterval) clearInterval(simInterval);
    if (runTimer) clearInterval(runTimer);
    
    // Guarantee final area calculation
    if (appState.currentPath.length >= 3) {
        appState.userArea = getApproxArea([...appState.currentPath, appState.currentPath[0]]);
    } else {
        appState.userArea = 0;
    }
    
    if (appState.enemyPath.length >= 3) {
        appState.enemyArea = getApproxArea([...appState.enemyPath, appState.enemyPath[0]]);
    } else {
        appState.enemyArea = 0;
    }
    
    if (appState.currentPath.length > 2) {
        const closedPath = [...appState.currentPath, appState.currentPath[0]];
        if (map && map.getSource('territories')) {
            map.getSource('territories').setData({
                'type': 'FeatureCollection',
                'features': [{
                    'type': 'Feature',
                    'geometry': { 'type': 'Polygon', 'coordinates': [closedPath] }
                }]
            });
        }
    }
    
    if (appState.enemyPath.length > 2) {
        const closedEnemyPath = [...appState.enemyPath, appState.enemyPath[0]];
        if (map && map.getSource('territory-enemy')) {
            map.getSource('territory-enemy').setData({
                'type': 'FeatureCollection',
                'features': [{
                    'type': 'Feature',
                    'geometry': { 'type': 'Polygon', 'coordinates': [closedEnemyPath] }
                }]
            });
        }
    }
    
    if(appState.runType === 'private-join') {
        alert("You left the private match.");
        navigate('home');
    } else {
        navigate('private-result');
    }
}

function joinGroup() {
    const pin = document.getElementById('join-pin').value;
    if(!pin) return alert("Enter a PIN!");
    navigate('group-wait');
}

// View Definitions
const views = {
    'select-run': () => `
        <div class="screen" style="display: block; overflow-y: auto;">
            <button class="back-btn" onclick="navigate('home')">
                <i class="ph ph-caret-left"></i>
            </button>
            
            <h1 class="main-title text-left" style="line-height: 1.1; margin-bottom: 8px;">SELECT RUN<br><span style="color: var(--neon-green);">MODE</span></h1>
            <p class="subtitle text-left" style="margin-bottom: 32px;">Choose how you want to conquer territory today.</p>
            
            <div class="mode-card mode-solo" onclick="startSoloRun()">
                <div><i class="ph ph-user"></i></div>
                <div>
                    <h3>Solo Run</h3>
                    <p>Standard mode. Track your personal territory and set your own pace.</p>
                </div>
            </div>
            
            <div class="mode-card mode-group" onclick="checkAuthAndGroup()">
                <div><i class="ph ph-users"></i></div>
                <div>
                    <h3>Group Run</h3>
                    <p>Run with friends. Combine your paths to capture massive zones together.</p>
                </div>
            </div>
            
            <div class="mode-card mode-lobby" onclick="checkAuthAndPrivate()">
                <div><i class="ph ph-lock"></i></div>
                <div>
                    <h3>Private Lobby</h3>
                    <p>Custom arena. Invite rivals for a time-boxed battle in a specific area.</p>
                </div>
            </div>
        </div>
    `,
    home: () => `
        <div class="screen" style="padding: 0; display: block; overflow-y: auto;">
            <div class="top-header">
                <div class="header-titles">
                    <p>AGENT ALPHA</p>
                    <h1>RANK: #42</h1>
                    <h2>${appState.homeBase}</h2>
                </div>
                <div class="top-icons">
                    <button class="theme-toggle" onclick="toggleTheme()">
                        <i class="ph ph-sun"></i>
                    </button>
                    <div class="shield-icon">
                        <i class="ph ph-shield"></i>
                    </div>
                </div>
            </div>

            <div class="dashboard-content">
                <div class="stats-grid">
                    <div class="stat-card">
                        <i class="ph ph-map-trifold" style="color: var(--neon-green)"></i>
                        <p>TERRITORY OWNED</p>
                        <h3>12.4 <span>km²</span></h3>
                    </div>
                    <div class="stat-card">
                        <i class="ph ph-fire" style="color: #f59e0b"></i>
                        <p>WIN STREAK</p>
                        <h3>5 <span>Days</span></h3>
                    </div>
                </div>

                <div class="mission-card">
                    <i class="ph-bold ph-lightning bg-icon"></i>
                    <div class="mission-header">
                        <i class="ph-fill ph-lightning"></i> DAILY MISSION
                    </div>
                    <h3>Capture 2 New Zones</h3>
                    <p>Expand your territory in Yunusabad district.</p>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: 50%;"></div>
                    </div>
                    <div class="progress-text">
                        <span>1 / 2 ZONES</span>
                        <span>500 XP</span>
                    </div>
                </div>

                <div class="section-title">
                    ACTIVE THREATS
                </div>
                <div class="threat-card">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div class="threat-icon"><i class="ph ph-target"></i></div>
                        <div class="threat-info">
                            <h4>Sector 4 Under Attack!</h4>
                            <p>Team Red is claiming your zone.</p>
                        </div>
                    </div>
                    <button class="btn-red" onclick="alert('Defending Sector 4!')">DEFEND</button>
                </div>

                <div class="section-title">
                    RECOMMENDED NEXT <span onclick="navigate('map')">VIEW MAP</span>
                </div>
                <div class="recommended-card">
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <div class="rec-icon">
                            <div class="rec-dot"></div>
                        </div>
                        <div class="rec-info">
                            <h4>Central Park Loop</h4>
                            <p>Unclaimed territory nearby. High strategic value.</p>
                        </div>
                    </div>
                    <i class="ph ph-arrow-right" style="color: #64748b; font-size: 24px;"></i>
                </div>
            </div>
        </div>
    `,
    'solo-run': () => `
        <div class="screen map-overlay">
            <div class="map-ui-top">
                <div class="pill-dark">
                    <div class="recording-dot"></div>
                    <i class="ph ph-user"></i> SOLO RUN
                </div>
                <button class="circle-btn" onclick="stopRun()">
                    <i class="ph ph-x"></i>
                </button>
            </div>
            
            <div class="projected-area-container" id="projected-area">
                <div class="projected-area-pill">
                    <i class="ph ph-polygon"></i> 
                    <div class="projected-area-text">
                        <strong id="ui-area">Projected Area: -- m²</strong>
                        <span>Close the loop to capture.</span>
                    </div>
                </div>
            </div>
            
            <div class="run-bottom-sheet">
                <p class="sheet-label">TIME ELAPSED</p>
                <h1 class="sheet-time" id="ui-time">00:00</h1>
                
                <div class="run-stats-grid">
                    <div class="run-stat-col">
                        <span>DISTANCE</span>
                        <div class="stat-value"><strong id="ui-distance">0.00</strong> <small>km</small></div>
                    </div>
                    <div class="run-stat-col">
                        <span style="color: var(--neon-green);">PACE</span>
                        <div class="stat-value" style="color: var(--neon-green);"><strong id="ui-pace">0:00</strong> <small>/km</small></div>
                    </div>
                    <div class="run-stat-col">
                        <span style="color: #f59e0b;">POINTS</span>
                        <div class="stat-value" style="color: #f59e0b;"><strong id="ui-points">0</strong></div>
                    </div>
                </div>
                
                <div class="run-controls">
                    <button class="control-btn secondary" onclick="simulateRun()" title="Simulate GPS Movement">
                        <i class="ph ph-magic-wand"></i>
                    </button>
                    <button class="control-btn secondary" onclick="togglePause()">
                        <i class="ph-fill ph-pause" id="pause-icon"></i>
                    </button>
                    <button class="control-btn primary" onclick="stopRun()">
                        STOP
                    </button>
                </div>
            </div>
        </div>
    `,
    'auth': () => `
        <div class="screen">
            <div class="content-center">
                <i class="ph ph-user-circle" style="font-size: 64px; color: var(--neon-green); margin-bottom: 24px;"></i>
                <h1 class="main-title text-center">CREATE<br>ACCOUNT</h1>
                <p class="subtitle text-center">Sign up to join squads and track your stats across devices.</p>
                
                <div class="auth-form">
                    <input type="text" id="auth-name" class="auth-input" placeholder="Full Name (e.g. Agent Alpha)">
                    <input type="tel" id="auth-phone" class="auth-input" placeholder="Phone Number">
                    <input type="password" id="auth-pass" class="auth-input" placeholder="Password">
                </div>
            </div>
            
            <div class="bottom-actions">
                <button class="btn-primary" onclick="signUp()">COMPLETE SIGN UP</button>
            </div>
        </div>
    `,
    'group-lobby': () => `
        <div class="screen" style="display: block; overflow-y: auto;">
            <button class="back-btn" onclick="navigate('select-run')"><i class="ph ph-caret-left"></i></button>
            <h1 class="main-title" style="margin-bottom: 32px; line-height: 1.1;">SQUAD<br><span style="color: #3b82f6;">LOBBY</span></h1>
            
            <div class="mode-card mode-group" style="background: rgba(59,130,246,0.05); border-color: rgba(59,130,246,0.2);" onclick="navigate('group-host')">
                <div><i class="ph ph-plus-circle" style="color: #3b82f6;"></i></div>
                <div>
                    <h3>Create Squad</h3>
                    <p>Host a new group run and invite your friends via PIN.</p>
                </div>
            </div>
            
            <div class="mode-card mode-group" style="background: rgba(59,130,246,0.05); border-color: rgba(59,130,246,0.2);" onclick="navigate('group-join')">
                <div><i class="ph ph-sign-in" style="color: #3b82f6;"></i></div>
                <div>
                    <h3>Join Squad</h3>
                    <p>Enter a PIN to join an existing group run.</p>
                </div>
            </div>
        </div>
    `,
    'group-host': () => {
        clearTimeout(lobbyTimeout);
        lobbyTimeout = setTimeout(() => {
            const btn = document.getElementById('btn-start-group');
            const status = document.getElementById('host-status');
            const players = document.getElementById('host-players');
            if(btn && status && players) {
                status.innerText = "Squad Ready! (3 Runners)";
                status.style.color = "#10b981";
                players.style.opacity = "1";
                btn.disabled = false;
                btn.style.opacity = "1";
            }
        }, 3000);
        return `
        <div class="screen">
            <button class="back-btn" onclick="navigate('group-lobby')"><i class="ph ph-caret-left"></i></button>
            <div class="content-center text-center">
                <p class="subtitle">SQUAD PIN</p>
                <div class="group-pin-display">4829</div>
                <p id="host-status" style="color: var(--text-muted); margin-bottom: 32px; transition: color 0.3s;">Share this PIN with your squad. Waiting for runners...</p>
                
                <div id="host-players" style="display:flex; justify-content:center; gap: 16px; margin-bottom: 40px; opacity: 0.2; transition: opacity 0.5s;">
                    <div class="player-marker" style="position:relative; transform:scale(1.5);"></div>
                    <div class="player-marker" style="position:relative; transform:scale(1.5); background:#3b82f6; box-shadow:0 0 15px #3b82f6;"></div>
                    <div class="player-marker" style="position:relative; transform:scale(1.5); background:#f59e0b; box-shadow:0 0 15px #f59e0b;"></div>
                </div>
            </div>
            <div class="bottom-actions">
                <button id="btn-start-group" class="btn-primary" style="background: #3b82f6; color: #fff; opacity: 0.5; transition: opacity 0.3s;" disabled onclick="startGroupRun('host')">START RUN</button>
            </div>
        </div>
        `;
    },
    'group-join': () => `
        <div class="screen">
            <button class="back-btn" onclick="navigate('group-lobby')"><i class="ph ph-caret-left"></i></button>
            <div class="content-center">
                <h1 class="main-title text-center" style="margin-bottom: 40px;">ENTER PIN</h1>
                <input type="number" class="group-pin-input" placeholder="0000" id="join-pin">
            </div>
            <div class="bottom-actions">
                <button class="btn-primary" style="background: #3b82f6; color: #fff; box-shadow: 0 0 30px rgba(59,130,246,0.3);" onclick="joinGroup()">JOIN SQUAD</button>
            </div>
        </div>
    `,
    'group-wait': () => {
        clearTimeout(lobbyTimeout);
        lobbyTimeout = setTimeout(() => {
            startGroupRun('join');
        }, 3000);
        return `
        <div class="screen">
            <div class="content-center text-center">
                <i class="ph ph-spinner" style="font-size: 64px; color: #3b82f6; animation: spin 1s linear infinite; margin-bottom: 24px; display: inline-block;"></i>
                <h2 style="color: #fff; margin-bottom: 8px;">Waiting for Host</h2>
                <p style="color: #8b92a5;">The run will begin automatically when the host starts the session.</p>
            </div>
        </div>
        <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        `;
    },
    'private-lobby': () => `
        <div class="screen" style="display: block; overflow-y: auto;">
            <button class="back-btn" onclick="navigate('select-run')"><i class="ph ph-caret-left"></i></button>
            <h1 class="main-title" style="margin-bottom: 32px; line-height: 1.1;">PRIVATE<br><span style="color: #f43f5e;">LOBBY</span></h1>
            
            <div class="mode-card mode-lobby" style="background: rgba(244,63,94,0.05); border-color: rgba(244,63,94,0.2);" onclick="navigate('private-host')">
                <div><i class="ph ph-plus-circle" style="color: #f43f5e;"></i></div>
                <div>
                    <h3>Create Match</h3>
                    <p>Host a competitive match and invite your rival via PIN.</p>
                </div>
            </div>
            
            <div class="mode-card mode-lobby" style="background: rgba(244,63,94,0.05); border-color: rgba(244,63,94,0.2);" onclick="navigate('private-join')">
                <div><i class="ph ph-sign-in" style="color: #f43f5e;"></i></div>
                <div>
                    <h3>Join Match</h3>
                    <p>Enter a PIN to battle your rival.</p>
                </div>
            </div>
        </div>
    `,
    'private-host': () => {
        clearTimeout(lobbyTimeout);
        lobbyTimeout = setTimeout(() => {
            const btn = document.getElementById('btn-start-private');
            const status = document.getElementById('host-private-status');
            const player2 = document.getElementById('host-private-p2');
            if(btn && status && player2) {
                status.innerText = "Rival Joined!";
                status.style.color = "#10b981";
                player2.style.opacity = "1";
                btn.disabled = false;
                btn.style.opacity = "1";
            }
        }, 3000);
        return `
        <div class="screen">
            <button class="back-btn" onclick="navigate('private-lobby')"><i class="ph ph-caret-left"></i></button>
            <div class="content-center text-center">
                <p class="subtitle">MATCH PIN</p>
                <div class="group-pin-display" style="color: #f43f5e;">9921</div>
                <p id="host-private-status" style="color: var(--text-muted); margin-bottom: 32px; transition: color 0.3s;">Waiting for your rival to join...</p>
                
                <div style="display:flex; justify-content:center; gap: 32px; margin-bottom: 40px; align-items: center;">
                    <div class="player-marker" style="position:relative; transform:scale(1.5);"></div>
                    <div style="font-weight: 900; color: #8b92a5;">VS</div>
                    <div id="host-private-p2" class="player-marker" style="position:relative; transform:scale(1.5); background:#f43f5e; box-shadow:0 0 15px #f43f5e; opacity: 0.2; transition: opacity 0.5s;"></div>
                </div>
            </div>
            <div class="bottom-actions">
                <button id="btn-start-private" class="btn-primary" style="background: #f43f5e; color: #fff; opacity: 0.5; transition: opacity 0.3s;" disabled onclick="startPrivateRun('host')">START MATCH</button>
            </div>
        </div>
        `;
    },
    'private-join': () => `
        <div class="screen">
            <button class="back-btn" onclick="navigate('private-lobby')"><i class="ph ph-caret-left"></i></button>
            <div class="content-center">
                <h1 class="main-title text-center" style="margin-bottom: 40px;">ENTER PIN</h1>
                <input type="number" class="group-pin-input" style="border-bottom-color: #f43f5e; color: #fff;" placeholder="0000" id="join-private-pin">
            </div>
            <div class="bottom-actions">
                <button class="btn-primary" style="background: #f43f5e; color: #fff; box-shadow: 0 0 30px rgba(244,63,94,0.3);" onclick="
                    const pin = document.getElementById('join-private-pin').value;
                    if(!pin) return alert('Enter a PIN!');
                    navigate('private-wait');
                ">JOIN MATCH</button>
            </div>
        </div>
    `,
    'private-wait': () => {
        clearTimeout(lobbyTimeout);
        lobbyTimeout = setTimeout(() => {
            startPrivateRun('join');
        }, 3000);
        return `
        <div class="screen">
            <div class="content-center text-center">
                <i class="ph ph-spinner" style="font-size: 64px; color: #f43f5e; animation: spin 1s linear infinite; margin-bottom: 24px; display: inline-block;"></i>
                <h2 style="color: #fff; margin-bottom: 8px;">Waiting for Match</h2>
                <p style="color: #8b92a5;">The battle will begin automatically when the host starts the session.</p>
            </div>
        </div>
        `;
    },
    'private-run': () => `
        <div class="screen map-overlay">
            <div class="map-ui-top">
                <div class="pill-dark" style="border-color: rgba(244,63,94,0.3);">
                    <div class="recording-dot" style="background: #f43f5e; animation: pulse-red 2s infinite;"></div>
                    <i class="ph ph-swords" style="color: #f43f5e;"></i> VERSUS
                </div>
                <button class="circle-btn" onclick="stopPrivateRun()">
                    <i class="ph ph-x"></i>
                </button>
            </div>
            
            <div class="run-bottom-sheet">
                <div class="vs-stats-header" style="display: flex; justify-content: space-between; margin-bottom: 24px; padding: 0 16px;">
                    <div style="text-align: left;">
                        <span style="color: var(--neon-green); font-size: 12px; font-weight: 800; letter-spacing: 1px;">YOUR AREA</span>
                        <h2 style="color: #fff; margin: 0; font-size: 28px;" id="ui-user-area">0 m²</h2>
                    </div>
                    <div style="text-align: center; color: #8b92a5; font-size: 20px; font-weight: 900; align-self: center;">VS</div>
                    <div style="text-align: right;">
                        <span style="color: #f43f5e; font-size: 12px; font-weight: 800; letter-spacing: 1px;">RIVAL AREA</span>
                        <h2 style="color: #fff; margin: 0; font-size: 28px;" id="ui-enemy-area">0 m²</h2>
                    </div>
                </div>
                
                <p class="sheet-label">TIME ELAPSED</p>
                <h1 class="sheet-time" id="ui-time" style="margin-bottom: 24px;">00:00</h1>
                
                <div class="run-controls">
                    <button class="control-btn secondary" onclick="simulateRun()" title="Simulate GPS Movement">
                        <i class="ph ph-magic-wand"></i>
                    </button>
                    <button class="control-btn secondary" onclick="togglePause()">
                        <i class="ph-fill ph-pause" id="pause-icon"></i>
                    </button>
                    <button class="control-btn primary" style="background: #f43f5e; color: #fff; box-shadow: 0 0 30px rgba(244,63,94,0.4);" onclick="stopPrivateRun()">
                        STOP & TALLY
                    </button>
                </div>
            </div>
        </div>
    `,
    'private-result': () => {
        const isWin = appState.userArea >= appState.enemyArea;
        const mainColor = isWin ? "var(--neon-green)" : "#f43f5e";
        const title = isWin ? "VICTORY!" : "DEFEAT";
        const msg = isWin ? "You claimed more territory!" : "Your rival outmaneuvered you.";
        
        return `
        <div class="screen" style="background: #0a0c11; z-index: 100;">
            <div class="content-center text-center">
                <i class="ph ${isWin ? 'ph-trophy' : 'ph-skull'}" style="font-size: 80px; color: ${mainColor}; margin-bottom: 24px; filter: drop-shadow(0 0 20px ${mainColor});"></i>
                <h1 class="main-title" style="color: ${mainColor}; font-size: 48px; letter-spacing: 2px;">${title}</h1>
                <p class="subtitle" style="margin-bottom: 40px;">${msg}</p>
                
                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 24px; width: 100%; text-align: left;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px;">
                        <div>
                            <span style="color: var(--neon-green); font-size: 11px; font-weight: bold; letter-spacing: 1px;">YOUR AREA</span>
                            <div style="font-size: 24px; font-weight: 900; color: #fff;">${Math.floor(appState.userArea)} <small style="font-size: 14px; color: #8b92a5;">m²</small></div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <span style="color: #f43f5e; font-size: 11px; font-weight: bold; letter-spacing: 1px;">RIVAL AREA</span>
                            <div style="font-size: 24px; font-weight: 900; color: #fff;">${Math.floor(appState.enemyArea)} <small style="font-size: 14px; color: #8b92a5;">m²</small></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bottom-actions">
                <button class="btn-primary" style="background: ${mainColor}; color: ${isWin ? '#000' : '#fff'};" onclick="navigate('home')">RETURN TO BASE</button>
            </div>
        </div>
        `;
    },
    'group-run': () => `
        <div class="screen map-overlay">
            <div class="map-ui-top">
                <div class="pill-dark" style="border-color: rgba(59,130,246,0.3);">
                    <div class="recording-dot" style="background: #3b82f6; animation: none;"></div>
                    <i class="ph ph-users" style="color: #3b82f6;"></i> GROUP RUN
                </div>
                <button class="circle-btn" onclick="stopGroupRun()">
                    <i class="ph ph-x"></i>
                </button>
            </div>
            
            <div class="run-bottom-sheet">
                <div class="projected-area-container visible" id="projected-area">
                    <div class="projected-area-pill">
                        <i class="ph ph-target" style="color: #3b82f6;"></i> 
                        <div class="projected-area-text">
                            <strong style="color: #fff; font-size: 13px;" id="ui-area">Squad Sync Active</strong>
                            <span>3 runners contributing to area.</span>
                        </div>
                    </div>
                </div>
                
                <p class="sheet-label">TIME ELAPSED</p>
                <h1 class="sheet-time" id="ui-time">00:00</h1>
                
                <div class="run-stats-grid" style="margin-bottom: 16px;">
                    <div class="run-stat-col">
                        <span>DISTANCE</span>
                        <div class="stat-value"><strong id="ui-distance">0.00</strong> <small>km</small></div>
                    </div>
                    <div class="run-stat-col">
                        <span style="color: #3b82f6;">PACE</span>
                        <div class="stat-value" style="color: #3b82f6;"><strong id="ui-pace">0:00</strong> <small>/km</small></div>
                    </div>
                    <div class="run-stat-col">
                        <span style="color: #f59e0b;">POINTS</span>
                        <div class="stat-value" style="color: #f59e0b;"><strong id="ui-points">0</strong></div>
                    </div>
                </div>
                
                <div style="text-align: center; font-size: 11px; font-weight: 800; color: #8b92a5; margin-bottom: 24px; letter-spacing: 0.5px; background: rgba(255,255,255,0.03); padding: 8px 16px; border-radius: 20px;">
                    Your Contribution: <span id="ui-ind-distance" style="color: #fff;">0.00</span> km | Pace: <span id="ui-ind-pace" style="color: #fff;">0:00</span>
                </div>
                
                <div class="run-controls">
                    <button class="control-btn secondary" onclick="simulateRun()" title="Simulate GPS Movement">
                        <i class="ph ph-magic-wand"></i>
                    </button>
                    <button class="control-btn secondary" onclick="togglePause()">
                        <i class="ph-fill ph-pause" id="pause-icon"></i>
                    </button>
                    <button class="control-btn primary" style="background: #3b82f6; color: #fff; box-shadow: 0 0 30px rgba(59,130,246,0.4);" onclick="stopGroupRun()">
                        STOP
                    </button>
                </div>
            </div>
        </div>
    `,
    'map': () => `
        <div class="screen map-overlay">
            <div class="map-ui-top" style="align-items: flex-start;">
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div class="pill-dark" style="border-color: rgba(255,255,255,0.1);">
                        <div class="recording-dot" style="background: var(--neon-green); animation: none;"></div>
                        Live: Tashkent Central
                    </div>
                    <div class="pill-dark pill-alert">
                        <i class="ph ph-shield-warning"></i> SECTOR 4 CONTESTED
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <button class="circle-btn" onclick="toggleTheme()">
                        <i class="ph ph-sun"></i>
                    </button>
                </div>
            </div>
            
            <div style="position: absolute; bottom: 120px; left: 0; width: 100%; padding: 0 16px; z-index: 20; pointer-events: none;">
                <div class="map-widget-panel">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h4>Top Regional Leaders</h4>
                        <button onclick="navigate('leaderboard')" style="background: none; border: none; color: var(--neon-green); font-size: 12px; font-weight: bold; cursor: pointer;">SEE ALL <i class="ph ph-arrow-right"></i></button>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="map-widget-row">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="color: #ffd700; font-weight: 900; font-size: 14px;">1</div>
                                <div style="width: 24px; height: 24px; border-radius: 50%; background: #10b981;"></div>
                                <span>Team Alpha</span>
                            </div>
                            <span style="color: var(--neon-green); font-weight: 900; font-size: 13px;">45,200 m²</span>
                        </div>
                        
                        <div class="map-widget-row">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="color: #c0c0c0; font-weight: 900; font-size: 14px;">2</div>
                                <div style="width: 24px; height: 24px; border-radius: 50%; background: #f43f5e;"></div>
                                <span>Team Crimson</span>
                            </div>
                            <span style="color: var(--neon-green); font-weight: 900; font-size: 13px;">38,500 m²</span>
                        </div>
                        
                        <div class="map-widget-row">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="color: #cd7f32; font-weight: 900; font-size: 14px;">3</div>
                                <div style="width: 24px; height: 24px; border-radius: 50%; background: #3b82f6;"></div>
                                <span>Team Cobalt</span>
                            </div>
                            <span style="color: var(--neon-green); font-weight: 900; font-size: 13px;">29,100 m²</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    'leaderboard': () => `
        <div class="screen" style="display: block; overflow-y: auto; padding-bottom: 120px;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                <button class="back-btn" onclick="navigate('map')" style="position: static;"><i class="ph ph-caret-left"></i></button>
                <h1 class="main-title" style="margin: 0; font-size: 28px;">LEADERBOARD</h1>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 24px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 12px;">
                <button id="tab-national" onclick="document.getElementById('board-national').style.display='block'; document.getElementById('board-regional').style.display='none'; this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff'; document.getElementById('tab-regional').style.background='transparent'; document.getElementById('tab-regional').style.color='#8b92a5';" style="flex: 1; padding: 10px; border-radius: 8px; border: none; background: rgba(255,255,255,0.1); color: #fff; font-weight: bold; cursor: pointer; transition: all 0.2s;">National</button>
                <button id="tab-regional" onclick="document.getElementById('board-regional').style.display='block'; document.getElementById('board-national').style.display='none'; this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff'; document.getElementById('tab-national').style.background='transparent'; document.getElementById('tab-national').style.color='#8b92a5';" style="flex: 1; padding: 10px; border-radius: 8px; border: none; background: transparent; color: #8b92a5; font-weight: bold; cursor: pointer; transition: all 0.2s;">Regional</button>
            </div>
            
            <!-- NATIONAL LEADERBOARD -->
            <div id="board-national" style="margin-bottom: 32px; display: block;">
                <h3 style="color: #8b92a5; font-size: 12px; letter-spacing: 1px; margin-bottom: 16px;">TOP RUNNERS IN UZBEKISTAN</h3>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div class="lb-row-gold">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <h2 style="margin: 0; color: #ffd700; width: 24px; text-align: center;">1</h2>
                            <img src="https://i.pravatar.cc/100?img=11" style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid #ffd700;">
                            <div>
                                <h3 class="lb-name">Agent Bravo</h3>
                                <p style="margin: 0; color: var(--neon-green); font-size: 12px;">Tashkent</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h3 class="lb-score">142.5</h3>
                            <p style="margin: 0; color: #8b92a5; font-size: 11px;">hectares</p>
                        </div>
                    </div>
                    
                    <div class="lb-row">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <h2 style="margin: 0; color: #c0c0c0; width: 24px; text-align: center;">2</h2>
                            <img src="https://i.pravatar.cc/100?img=33" style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid #c0c0c0;">
                            <div>
                                <h3 class="lb-name">SpeedRunner99</h3>
                                <p style="margin: 0; color: #3b82f6; font-size: 12px;">Samarkand</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h3 class="lb-score">128.1</h3>
                            <p style="margin: 0; color: #8b92a5; font-size: 11px;">hectares</p>
                        </div>
                    </div>
                    
                    <div class="lb-row">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <h2 style="margin: 0; color: #cd7f32; width: 24px; text-align: center;">3</h2>
                            <img src="https://i.pravatar.cc/100?img=5" style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid #cd7f32;">
                            <div>
                                <h3 class="lb-name">NightHawk</h3>
                                <p style="margin: 0; color: #f43f5e; font-size: 12px;">Bukhara</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h3 class="lb-score">94.0</h3>
                            <p style="margin: 0; color: #8b92a5; font-size: 11px;">hectares</p>
                        </div>
                    </div>
                    
                    <div class="lb-row" style="margin-top: 16px;">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <h2 style="margin: 0; color: #8b92a5; width: 24px; text-align: center;">42</h2>
                            <div style="width: 48px; height: 48px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">YOU</div>
                            <div>
                                <h3 class="lb-name">Shoxniyoz</h3>
                                <p style="margin: 0; color: var(--neon-green); font-size: 12px;">Tashkent</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h3 class="lb-score">12.4</h3>
                            <p style="margin: 0; color: #8b92a5; font-size: 11px;">hectares</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- REGIONAL LEADERBOARD -->
            <div id="board-regional" style="margin-bottom: 32px; display: none;">
                <h3 style="color: #8b92a5; font-size: 12px; letter-spacing: 1px; margin-bottom: 16px;">MOST TERRITORY BY REGION</h3>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div class="lb-row">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(16,185,129,0.2); display: flex; align-items: center; justify-content: center; color: #10b981;">
                                <i class="ph ph-buildings" style="font-size: 24px;"></i>
                            </div>
                            <div>
                                <h3 class="lb-name">Tashkent</h3>
                                <p style="margin: 0; color: #8b92a5; font-size: 12px;">Leader: <span style="color:#10b981;">Agent Bravo</span></p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h3 class="lb-score">42.5</h3>
                            <p style="margin: 0; color: #8b92a5; font-size: 11px;">hectares claimed</p>
                        </div>
                    </div>
                    
                    <div class="lb-row">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(59,130,246,0.2); display: flex; align-items: center; justify-content: center; color: #3b82f6;">
                                <i class="ph ph-mosque" style="font-size: 24px;"></i>
                            </div>
                            <div>
                                <h3 class="lb-name">Samarkand</h3>
                                <p style="margin: 0; color: #8b92a5; font-size: 12px;">Leader: <span style="color:#3b82f6;">SpeedRunner99</span></p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h3 class="lb-score">31.2</h3>
                            <p style="margin: 0; color: #8b92a5; font-size: 11px;">hectares claimed</p>
                        </div>
                    </div>
                    
                    <div class="lb-row">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(244,63,94,0.2); display: flex; align-items: center; justify-content: center; color: #f43f5e;">
                                <i class="ph ph-sun" style="font-size: 24px;"></i>
                            </div>
                            <div>
                                <h3 class="lb-name">Bukhara</h3>
                                <p style="margin: 0; color: #8b92a5; font-size: 12px;">Leader: <span style="color:#f43f5e;">NightHawk</span></p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <h3 class="lb-score">24.0</h3>
                            <p style="margin: 0; color: #8b92a5; font-size: 11px;">hectares claimed</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    'events': () => `
        <div class="screen" style="display: block; overflow-y: auto; padding-bottom: 120px;">
            <div class="top-header" style="padding-top: 16px; margin-bottom: 24px;">
                <div class="header-titles">
                    <h1 style="font-size: 36px;">EVENTS &<br><span style="color: var(--neon-green);">BATTLES</span></h1>
                    <p style="color: #8b92a5; font-size: 14px; font-weight: 500; margin-top: 8px;">Compete for glory and territory.</p>
                </div>
                <div class="top-icons">
                    <button class="theme-toggle" onclick="toggleTheme()">
                        <i class="ph ph-sun"></i>
                    </button>
                </div>
            </div>

            <div class="events-content" style="padding: 0 16px;">
                <!-- Seasonal Event -->
                <div class="event-card-seasonal" style="background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(244,63,94,0.2)), var(--card-bg); border: 1px solid rgba(245,158,11,0.2); border-radius: 24px; padding: 24px; margin-bottom: 32px; position: relative; overflow: hidden;">
                    <i class="ph-fill ph-trophy" style="position: absolute; right: -20px; bottom: -20px; font-size: 150px; color: rgba(245,158,11,0.1); transform: rotate(-15deg);"></i>
                    <div style="position: relative; z-index: 1;">
                        <div style="background: rgba(245,158,11,0.2); color: #f59e0b; font-size: 10px; font-weight: 900; letter-spacing: 1px; padding: 6px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; border: 1px solid rgba(245,158,11,0.3);">
                            <i class="ph ph-calendar-blank"></i> SEASONAL EVENT
                        </div>
                        <h2 style="color: #fff; font-size: 28px; font-style: italic; font-weight: 900; margin-bottom: 8px; letter-spacing: -0.5px;" class="seasonal-title">NAVRUZ CLASH</h2>
                        <p style="color: #e2e8f0; font-size: 13px; max-width: 85%; margin-bottom: 24px; line-height: 1.5;" class="seasonal-desc">The spring territory reset. Claim the most land before midnight.</p>
                        
                        <div style="height: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; margin-bottom: 12px; overflow: hidden; width: 100%;">
                            <div style="height: 100%; width: 75%; background: linear-gradient(90deg, #f59e0b, #f43f5e); border-radius: 4px;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; letter-spacing: 0.5px;">
                            <span style="color: #f59e0b;">LIVE NOW</span>
                            <span style="color: #f59e0b;">ENDS IN 12H</span>
                        </div>
                    </div>
                </div>

                <!-- Regional Warfare -->
                <div style="margin-bottom: 32px;">
                    <div class="section-title" style="margin-bottom: 16px; justify-content: flex-start; align-items: center; gap: 6px;">
                        <i class="ph ph-sword" style="font-size: 14px;"></i> REGIONAL WARFARE
                    </div>
                    
                    <div class="event-card-vs" style="background: var(--card-bg); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 20px; margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                            <div>
                                <h3 style="color: var(--text-main); font-size: 16px; font-weight: 900; margin-bottom: 4px;">Tashkent vs Samarkand</h3>
                                <p style="color: #8b92a5; font-size: 12px;">Capital Showdown</p>
                            </div>
                            <button class="btn-join" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: none; padding: 6px 16px; border-radius: 16px; font-weight: 900; font-size: 11px; letter-spacing: 1px; cursor: pointer;">JOIN</button>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; letter-spacing: 1px; margin-bottom: 8px;">
                            <span style="color: #fff;" class="vs-text">TASHKENT <span style="color:#8b92a5">(54%)</span></span>
                            <span style="color: #fff;" class="vs-text"><span style="color:#8b92a5">(46%)</span> SAMARKAND</span>
                        </div>
                        <div style="height: 8px; border-radius: 4px; display: flex; overflow: hidden;">
                            <div style="height: 100%; width: 54%; background: var(--neon-green);"></div>
                            <div style="height: 100%; width: 46%; background: #3b82f6;"></div>
                        </div>
                    </div>
                    
                    <div class="event-card-vs" style="background: var(--card-bg); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                            <div>
                                <h3 style="color: var(--text-main); font-size: 16px; font-weight: 900; margin-bottom: 4px;">East vs West Districts</h3>
                                <p style="color: #8b92a5; font-size: 12px;">Local Skirmish</p>
                            </div>
                            <button class="btn-join" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: none; padding: 6px 16px; border-radius: 16px; font-weight: 900; font-size: 11px; letter-spacing: 1px; cursor: pointer;">JOIN</button>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; letter-spacing: 1px; margin-bottom: 8px;">
                            <span style="color: #fff;" class="vs-text">EAST <span style="color:#8b92a5">(32%)</span></span>
                            <span style="color: #fff;" class="vs-text"><span style="color:#8b92a5">(68%)</span> WEST</span>
                        </div>
                        <div style="height: 8px; border-radius: 4px; display: flex; overflow: hidden;">
                            <div style="height: 100%; width: 32%; background: #a855f7;"></div>
                            <div style="height: 100%; width: 68%; background: #f59e0b;"></div>
                        </div>
                    </div>
                </div>

                <!-- University League -->
                <div>
                    <div class="section-title" style="margin-bottom: 16px; justify-content: flex-start; align-items: center; gap: 6px;">
                        <i class="ph ph-users" style="font-size: 14px;"></i> UNIVERSITY LEAGUE
                    </div>
                    
                    <div class="event-card-list" style="background: var(--card-bg); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3 style="color: var(--text-main); font-size: 16px; font-weight: 900; margin: 0;">Current Standings</h3>
                            <button style="background: none; border: none; color: var(--neon-green); font-size: 11px; font-weight: 900; letter-spacing: 0.5px; cursor: pointer;">VIEW ALL <i class="ph ph-caret-right"></i></button>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 16px;">
                                    <span style="color: var(--neon-green); font-weight: 900; font-size: 16px; font-style: italic; width: 20px;">#1</span>
                                    <span style="color: var(--text-main); font-weight: 900; font-size: 16px;">WIUT</span>
                                </div>
                                <span style="color: #8b92a5; font-size: 12px; font-family: monospace;">124K XP</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 16px;">
                                    <span style="color: #3b82f6; font-weight: 900; font-size: 16px; font-style: italic; width: 20px;">#2</span>
                                    <span style="color: var(--text-main); font-weight: 900; font-size: 16px;">INHA</span>
                                </div>
                                <span style="color: #8b92a5; font-size: 12px; font-family: monospace;">118K XP</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 16px;">
                                    <span style="color: #f43f5e; font-weight: 900; font-size: 16px; font-style: italic; width: 20px;">#3</span>
                                    <span style="color: var(--text-main); font-weight: 900; font-size: 16px;">MDIST</span>
                                </div>
                                <span style="color: #8b92a5; font-size: 12px; font-family: monospace;">98K XP</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 16px;">
                                    <span style="color: #8b92a5; font-weight: 900; font-size: 16px; font-style: italic; width: 20px;">#4</span>
                                    <span style="color: var(--text-main); font-weight: 900; font-size: 16px;">TUIT</span>
                                </div>
                                <span style="color: #8b92a5; font-size: 12px; font-family: monospace;">85K XP</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    'profile': () => `
        <div class="screen" style="display: block; overflow-y: auto; padding-bottom: 120px;">
            <div class="top-header" style="padding-top: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; gap: 16px; align-items: center;">
                    <div style="position: relative;">
                        <div style="width: 72px; height: 72px; border-radius: 50%; border: 2px solid var(--neon-green); display: flex; justify-content: center; align-items: center; color: var(--neon-green); font-size: 32px; box-shadow: 0 0 15px rgba(16,185,129,0.2);">
                            <i class="ph ph-user"></i>
                        </div>
                        <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: var(--neon-green); color: #000; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 12px; white-space: nowrap;">
                            LVL 24
                        </div>
                    </div>
                    <div>
                        <h1 style="font-size: 24px; color: var(--text-main); font-weight: 900; margin-bottom: 4px; letter-spacing: -0.5px;">AGENT ALPHA</h1>
                        <p style="color: var(--neon-green); font-size: 11px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">Tashkent Elite</p>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
                    <button class="theme-toggle" onclick="toggleTheme()" style="margin: 0; padding: 0; background: transparent; width: auto; height: auto; border: none; color: #8b92a5;">
                        <i class="ph ph-sun"></i>
                    </button>
                    <i class="ph ph-gear" style="color: #8b92a5; font-size: 24px; cursor: pointer;"></i>
                </div>
            </div>

            <div class="profile-content" style="padding: 0 16px;">
                <!-- Weekly Conquest Chart -->
                <div class="chart-card" style="background: var(--card-bg); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 20px; margin-bottom: 24px;">
                    <p style="color: #64748b; font-size: 10px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">Weekly Conquest</p>
                    <div style="display: flex; justify-content: space-between; align-items: baseline;">
                        <h2 style="color: var(--text-main); font-size: 28px; font-weight: 900;">4,400 <span style="color: #64748b; font-size: 14px;">XP</span></h2>
                        <span style="color: var(--neon-green); font-size: 11px; font-weight: 900;">+12% vs last week</span>
                    </div>
                    <svg viewBox="0 0 300 100" style="width: 100%; height: 120px; margin-top: 16px; overflow: visible;">
                        <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="var(--neon-green)" stop-opacity="0.3" />
                                <stop offset="100%" stop-color="var(--neon-green)" stop-opacity="0" />
                            </linearGradient>
                        </defs>
                        <path d="M0,100 L0,70 Q 40,85 80,70 T 160,80 C 200,80 220,10 250,20 C 280,30 290,60 300,70 L300,100 Z" fill="url(#chartGradient)" />
                        <path d="M0,70 Q 40,85 80,70 T 160,80 C 200,80 220,10 250,20 C 280,30 290,60 300,70" fill="none" stroke="var(--neon-green)" stroke-width="3" stroke-linecap="round" />
                    </svg>
                </div>

                <!-- Stats Grid -->
                <div class="stats-grid" style="margin-bottom: 32px;">
                    <div class="stat-card">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <i class="ph ph-map-trifold" style="color: #8b92a5; margin: 0; font-size: 20px;"></i>
                            <p style="margin: 0; font-size: 11px;">Total Area</p>
                        </div>
                        <h3 style="margin-top: auto;">124 <span>km²</span></h3>
                    </div>
                    <div class="stat-card">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <i class="ph ph-clock" style="color: #8b92a5; margin: 0; font-size: 20px;"></i>
                            <p style="margin: 0; font-size: 11px;">Time Moved</p>
                        </div>
                        <h3 style="margin-top: auto;">48h 12m</h3>
                    </div>
                    <div class="stat-card">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <i class="ph ph-shield" style="color: #8b92a5; margin: 0; font-size: 20px;"></i>
                            <p style="margin: 0; font-size: 11px;">Defenses</p>
                        </div>
                        <h3 style="margin-top: auto;">89%</h3>
                    </div>
                    <div class="stat-card">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <i class="ph ph-target" style="color: #8b92a5; margin: 0; font-size: 20px;"></i>
                            <p style="margin: 0; font-size: 11px;">Zones Captured</p>
                        </div>
                        <h3 style="margin-top: auto;">312</h3>
                    </div>
                </div>

                <!-- Recent Badges -->
                <div style="margin-bottom: 32px;">
                    <div class="section-title" style="margin-bottom: 16px; justify-content: space-between; align-items: center;">
                        <span>RECENT BADGES</span>
                        <span style="color: var(--neon-green);">VIEW ALL</span>
                    </div>
                    
                    <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px;">
                        <div class="badge-card badge-yellow">
                            <i class="ph ph-medal"></i>
                            <span>EARLY BIRD</span>
                        </div>
                        <div class="badge-card badge-blue">
                            <i class="ph ph-shield-check"></i>
                            <span>IRON WALL</span>
                        </div>
                        <div class="badge-card badge-purple">
                            <i class="ph ph-map-trifold"></i>
                            <span>EXPLORER</span>
                        </div>
                    </div>
                </div>

                <!-- Squad Card -->
                <div class="squad-card" style="background: var(--card-bg); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div class="avatar-stack" style="display: flex;">
                            <div class="stack-avatar"><i class="ph ph-user"></i></div>
                            <div class="stack-avatar"><i class="ph ph-user"></i></div>
                            <div class="stack-avatar stack-more">+5</div>
                        </div>
                        <div>
                            <h4 style="color: var(--text-main); font-size: 15px; font-weight: 900; margin-bottom: 4px;">Squad: Night Owls</h4>
                            <p style="color: #64748b; font-size: 12px;">Ranked #12 in Tashkent</p>
                        </div>
                    </div>
                    <i class="ph ph-caret-right" style="color: #64748b;"></i>
                </div>
            </div>
        </div>
    `,
    onboarding1: () => `
        <div class="screen">
            <div class="content-center">
                <div class="icon-box">
                    <i class="ph ph-map-trifold"></i>
                </div>
                <h1 class="main-title">CONQUER<br><span class="title-accent">YOUR CITY</span></h1>
                <p class="subtitle">Run, walk, and capture territory in<br>the real-world strategy game.</p>
            </div>
            <div class="bottom-actions">
                <button class="btn-primary" onclick="navigate('onboarding2')">Start Mission</button>
            </div>
        </div>
    `,
    onboarding2: () => `
        <div class="screen">
            <div style="flex: 1; padding-top: 20px;">
                <h1 class="main-title text-left">HOW IT WORKS</h1>
                <div class="feature-list">
                    <div class="feature-item">
                        <div class="feature-icon" style="color: #3b82f6;"><i class="ph ph-path"></i></div>
                        <div>
                            <h4>Move Outside</h4>
                            <p>Use GPS to trace your route</p>
                        </div>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon" style="color: var(--neon-green);"><i class="ph ph-lightning"></i></div>
                        <div>
                            <h4>Capture Land</h4>
                            <p>Close loops to claim territory</p>
                        </div>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon" style="color: #f43f5e;"><i class="ph ph-target"></i></div>
                        <div>
                            <h4>Defend & Challenge</h4>
                            <p>Protect zones or attack rivals</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="bottom-actions">
                <button class="btn-primary mb-24" onclick="navigate('onboarding3')">Next</button>
                <div class="onboarding-footer">
                    <div class="dots">
                        <div class="dot active"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                    </div>
                    <button class="btn-text" onclick="navigate('onboarding6')">SKIP</button>
                </div>
            </div>
        </div>
    `,
    onboarding3: () => `
        <div class="screen">
            <div style="flex: 1; padding-top: 20px;">
                <h1 class="main-title text-left">SHAPE STRATEGY</h1>
                <p class="subtitle text-left mb-32">Different routes create different tactical advantages.</p>
                <div class="strategy-grid">
                    <div class="strategy-card">
                        <i class="ph ph-circle" style="color: var(--neon-green)"></i>
                        <span>COMPACT DEFENSE</span>
                    </div>
                    <div class="strategy-card">
                        <i class="ph ph-minus" style="color: #3b82f6"></i>
                        <span>EXPANSION LINE</span>
                    </div>
                    <div class="strategy-card">
                        <i class="ph ph-square" style="color: #8b5cf6"></i>
                        <span>GRID CONTROL</span>
                    </div>
                    <div class="strategy-card">
                        <i class="ph ph-path" style="color: #f59e0b"></i>
                        <span>LOOP PROTECTION</span>
                    </div>
                </div>
            </div>
            <div class="bottom-actions">
                <button class="btn-primary mb-24" onclick="navigate('onboarding4')">Got It</button>
                <div class="onboarding-footer">
                    <div class="dots">
                        <div class="dot"></div>
                        <div class="dot active"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                    </div>
                    <button class="btn-text" onclick="navigate('onboarding6')">SKIP</button>
                </div>
            </div>
        </div>
    `,
    onboarding4: () => `
        <div class="screen">
            <div style="flex: 1; padding-top: 20px;">
                <h1 class="main-title text-left">IDENTITY</h1>
                <p class="subtitle text-left">Choose your primary territory color.</p>
                
                <div class="color-picker">
                    <div class="color-circle active" style="background: #10b981" onclick="selectColor(this, '#10b981', 'TOXIC GREEN')"></div>
                    <div class="color-circle" style="background: #1d4ed8" onclick="selectColor(this, '#1d4ed8', 'NEON BLUE')"></div>
                    <div class="color-circle" style="background: #9f1239" onclick="selectColor(this, '#9f1239', 'CRIMSON RED')"></div>
                    <div class="color-circle" style="background: #6b21a8" onclick="selectColor(this, '#6b21a8', 'DEEP PURPLE')"></div>
                    <div class="color-circle" style="background: #b45309" onclick="selectColor(this, '#b45309', 'AMBER ORANGE')"></div>
                </div>
                <h3 class="color-name" id="selected-color-name">TOXIC GREEN</h3>
            </div>
            <div class="bottom-actions">
                <button class="btn-primary mb-24" onclick="navigate('onboarding5')">Select Color</button>
                <div class="onboarding-footer">
                    <div class="dots">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot active"></div>
                        <div class="dot"></div>
                    </div>
                    <button class="btn-text" onclick="navigate('onboarding6')">SKIP</button>
                </div>
            </div>
        </div>
    `,
    onboarding5: () => `
        <div class="screen">
            <div style="display: flex; flex-direction: column; flex: 1; padding-top: 20px; overflow: hidden;">
                <div style="flex-shrink: 0;">
                    <h1 class="main-title text-left">HOME BASE</h1>
                    <p class="subtitle text-left mb-32">Where will you build your empire?</p>
                </div>
                
                <div class="region-list" style="flex: 1; overflow-y: auto; margin-bottom: 24px; padding-bottom: 20px;">
                    <div class="region-item active" onclick="selectRegion(this, 'Tashkent City')">
                        <span>Tashkent City</span> <i class="ph ph-flag" style="color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Andijan Region')">
                        <span>Andijan Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Bukhara Region')">
                        <span>Bukhara Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Fergana Region')">
                        <span>Fergana Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Jizzakh Region')">
                        <span>Jizzakh Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Namangan Region')">
                        <span>Namangan Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Navoiy Region')">
                        <span>Navoiy Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Kashkadarya Region')">
                        <span>Kashkadarya Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Samarkand Region')">
                        <span>Samarkand Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Sirdaryo Region')">
                        <span>Sirdaryo Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Surkhandarya Region')">
                        <span>Surkhandarya Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Tashkent Region')">
                        <span>Tashkent Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Khorezm Region')">
                        <span>Khorezm Region</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                    <div class="region-item" onclick="selectRegion(this, 'Republic of Karakalpakstan')">
                        <span>Republic of Karakalpakstan</span> <i class="ph ph-flag" style="display:none; color: var(--neon-green);"></i>
                    </div>
                </div>
            </div>
            <div class="bottom-actions">
                <button class="btn-primary mb-24" onclick="navigate('auth')">Set Region</button>
                <div class="onboarding-footer">
                    <div class="dots">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot active"></div>
                    </div>
                    <button class="btn-text" onclick="navigate('onboarding6')">SKIP</button>
                </div>
            </div>
        </div>
    `,
    onboarding6: () => `
        <div class="screen">
            <div class="content-center">
                <div class="icon-box-large">
                    <i class="ph ph-target"></i>
                </div>
                <h1 class="main-title" style="font-size: 32px;">MISSION READY</h1>
                <p class="subtitle mb-32" style="max-width: 100%;">Location access is needed to track<br>your conquests.</p>
                
                <div class="info-box">
                    <i class="ph ph-map-trifold"></i>
                    <p>We use GPS only while you are actively tracking a run.</p>
                </div>
            </div>
            <div class="bottom-actions">
                <button class="btn-primary btn-green" onclick="requestLocationAccess()">Allow Location & Start <i class="ph ph-arrow-right"></i></button>
            </div>
        </div>
    `
};

// Simple Router
function navigate(viewName) {
    if (!views[viewName]) return;
    viewContainer.innerHTML = views[viewName]();
    
    // Sync theme icon in the new view
    const isLight = document.body.classList.contains('light-theme');
    document.querySelectorAll('.theme-toggle i').forEach(btn => {
        if (isLight) {
            btn.classList.replace('ph-sun', 'ph-moon');
        } else {
            btn.classList.replace('ph-moon', 'ph-sun');
        }
    });
    
    const bottomNav = document.getElementById('bottom-nav');
    const mapContainer = document.getElementById('map-container');
    
    // Update active state in bottom nav
    document.querySelectorAll('#bottom-nav .nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick') === `navigate('${viewName}')`) {
            item.classList.add('active');
        }
    });
    
    // Toggle Bottom Nav
    if (viewName.startsWith('onboarding') || viewName === 'select-run' || viewName === 'solo-run' || viewName.startsWith('group-') || viewName.startsWith('private-') || viewName === 'auth') {
        bottomNav.classList.add('hidden');
    } else {
        bottomNav.classList.remove('hidden');
    }
    
    // Map overlay logic
    if (viewName === 'solo-run' || viewName === 'group-run' || viewName === 'private-run' || viewName === 'map') {
        viewContainer.classList.add('transparent');
        mapContainer.classList.add('active');
        initMap(); // Ensure map is initialized
        
        // Resize map to fix WebGL rendering bugs when hidden container shown
        if (map) {
            setTimeout(() => { map.resize(); }, 100);
        }
    } else {
        viewContainer.classList.remove('transparent');
        mapContainer.classList.remove('active');
    }
}

// Init App
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
    }
    navigate('home');
});
