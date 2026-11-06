const tracks = [
    { id: 'neon-pulse', title: 'Neon Pulse', artist: 'Ritmo Originals', genre: 'Electrónica', bpm: 124, duration: 31, accent: '#c4a0ff', cover: 'linear-gradient(135deg,#472d6d,#171523 75%)', root: 55, scale: [0, 3, 5, 7, 10], style: 'electronic' },
    { id: 'sunset-drive', title: 'Sunset Drive', artist: 'Ritmo Originals', genre: 'Chill', bpm: 96, duration: 40, accent: '#ffb280', cover: 'linear-gradient(135deg,#763f50,#201827 76%)', root: 49, scale: [0, 3, 5, 7, 10], style: 'chill' },
    { id: 'pixel-run', title: 'Pixel Run', artist: 'Ritmo Originals', genre: 'Arcade', bpm: 140, duration: 27, accent: '#83e7dc', cover: 'linear-gradient(135deg,#1d6c75,#162027 76%)', root: 57, scale: [0, 2, 4, 7, 9], style: 'arcade' },
    { id: 'velvet-sky', title: 'Velvet Sky', artist: 'Ritmo Originals', genre: 'Chill', bpm: 88, duration: 44, accent: '#ed99cf', cover: 'linear-gradient(135deg,#713c70,#211827 76%)', root: 52, scale: [0, 2, 5, 7, 9], style: 'chill' },
    { id: 'afterglow', title: 'Afterglow', artist: 'Ritmo Originals', genre: 'Electrónica', bpm: 116, duration: 33, accent: '#f1df72', cover: 'linear-gradient(135deg,#71612a,#242016 76%)', root: 50, scale: [0, 2, 5, 7, 9], style: 'electronic' },
    { id: 'star-circuit', title: 'Star Circuit', artist: 'Ritmo Originals', genre: 'Arcade', bpm: 132, duration: 29, accent: '#ff83aa', cover: 'linear-gradient(135deg,#772f60,#241522 76%)', root: 55, scale: [0, 2, 4, 7, 11], style: 'arcade' }
];
const lanePattern = [0, 2, 1, 3, 2, 0, 3, 1, 0, 3, 2, 1, 3, 0, 1, 2];
const noteSkins = {
    prism: { lanes: ['#55e7ff', '#bd86ff', '#ff62c8', '#ffe36e'], primary: '#55e7ff', secondary: '#ff62c8' },
    aurora: { lanes: ['#c19aff', '#7fe4d2', '#ffd77d', '#ff8dbd'], primary: '#7fe4d2', secondary: '#c19aff' },
    sunset: { lanes: ['#ff806e', '#ffb45c', '#f56db8', '#9d8aff'], primary: '#ffb45c', secondary: '#f56db8' },
    toxic: { lanes: ['#b8ff5a', '#57f0b5', '#5be3ff', '#e3ff70'], primary: '#b8ff5a', secondary: '#57f0b5' }
};
let laneColors = noteSkins.prism.lanes;
const remoteTracks = new Map();
let savedRemoteTracks = JSON.parse(localStorage.getItem('ritmo-remote-favorites') || '[]');

const $ = (selector) => document.querySelector(selector);
const trackGrid = $('#trackGrid');
const searchInput = $('#searchInput');
const canvas = $('#rhythmCanvas');
const ctx = canvas.getContext('2d');
const laneLabels = Array.from(document.querySelectorAll('.lane-labels span'));
const scoreElements = {
    score: $('#scoreText'),
    combo: $('#comboText'),
    accuracy: $('#accText'),
    best: $('#bestText'),
    rank: $('#rankText'),
    description: $('#rankDescription'),
    panel: $('.score-panel')
};
const frameElements = {
    measure: $('#measureLabel'),
    progress: $('#progressBar'),
    time: $('#timeLabel'),
    rating: $('#hitRating')
};
let cachedBestScore = 0;
let ratingHideTimer = null;
const keyboardLanes = new Set();
const pointerLanes = new Map();
const canvasSize = { width: 0, height: 0, left: 0 };
const gameScreen = $('#gameScreen');
const discoverView = $('#discoverView');
const libraryView = $('#libraryView');
const audioSupported = Boolean(window.AudioContext || window.webkitAudioContext);
const savedFavorites = localStorage.getItem('ritmo-favorites');
let favorites = savedFavorites ? JSON.parse(savedFavorites) : [];
let selectedGenre = 'Todos';
let currentTrack = null;
let audioContext = null;
let masterGain = null;
let noiseBuffer = null;
let startAt = 0;
let schedulerId = null;
let animationId = null;
let nextBeat = 0;
let lastDisplayedBeat = -1;
let lastDisplayedSecond = -1;
let lastProgress = 0;
let score = 0;
let combo = 0;
let hits = 0;
let successfulHits = 0;
let missedBeats = new Set();
let nextMissBeat = 0;
let activeLanes = new Set();
let isPlaying = false;
let isPaused = false;
let remoteAudio = null;
let searchTimer = null;
let searchController = null;
let youtubePlayer = null;
let youtubeApiPromise = null;
let youtubePlayerReady = null;
let youtubeIsReady = false;
let youtubeStartPending = false;
let youtubePlaybackFailed = false;
let youtubeStartTimer = null;
let isPreviewing = false;
let localAudioObjectUrl = null;
let tapTimes = [];
let youtubeApiKey = sessionStorage.getItem('ritmo-youtube-api-key')
    || localStorage.getItem('ritmo-youtube-api-key')
    || '';
let settings = {
    volume: Number(localStorage.getItem('ritmo-volume') || 65),
    speed: Number(localStorage.getItem('ritmo-speed') || 1),
    offset: Number(localStorage.getItem('ritmo-offset') || 0),
    noteSkin: localStorage.getItem('ritmo-note-skin') || 'prism',
    noteShape: localStorage.getItem('ritmo-note-shape') || 'pill',
    noteSize: Number(localStorage.getItem('ritmo-note-size') || 100),
    background: localStorage.getItem('ritmo-background') || 'clean',
    autoSync: localStorage.getItem('ritmo-auto-sync') === 'true'
};

function renderTracks() {
    const rawQuery = searchInput.value.trim();
    const query = rawQuery.toLocaleLowerCase('es');
    $('#catalogTitle').textContent = query ? `Resultados para “${rawQuery}”` : 'Busca una canción o artista';
    const matching = tracks.filter((track) => {
        const matchesQuery = `${track.title} ${track.artist} ${track.genre}`.toLocaleLowerCase('es').includes(query);
        return matchesQuery && (selectedGenre === 'Todos' || track.genre === selectedGenre);
    });
    trackGrid.innerHTML = matching.map((track) => createTrackCard(track)).join('');
    $('#emptyState').hidden = query.length < 2 || matching.length > 0;
    $('#searchStatus').textContent = !query
        ? (youtubeApiKey ? 'Busca cualquier canción o artista disponible en YouTube.' : 'Configura una API key para ver resultados de YouTube aquí, o busca directamente en YouTube.')
        : query.length < 2
            ? 'Escribe al menos 2 caracteres para buscar.'
            : youtubeApiKey ? 'Buscando en YouTube...' : 'Sin API key, la búsqueda completa se abre directamente en YouTube.';
    updateSearchActions(rawQuery);
    if (query.length >= 2) {
        clearTimeout(searchTimer);
        if (searchController) searchController.abort();
        searchTimer = setTimeout(() => searchOpenMusic(rawQuery), 450);
    } else if (searchController) {
        searchController.abort();
    }
}

function updateSearchActions(query, show = query.length >= 2 && !youtubeApiKey) {
    const actions = $('#searchActions');
    const searchLink = $('#directYoutubeSearch');
    if (!actions || !searchLink) return;
    actions.hidden = !show;
    if (show) searchLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function createTrackCard(track) {
    const isFavorite = favorites.includes(track.id);
    return `<article class="track-card">
        <div class="cover" style="--cover-bg:${track.cover};--accent:${track.accent}">
            <div class="cover-art"><span>♪</span></div><span class="cover-spark">✦</span><span class="cover-tag">ORIGINAL</span>
        </div>
        <div class="card-body">
            <div class="card-title-row"><div class="card-title">${track.title}</div><button class="favorite-button${isFavorite ? ' is-favorite' : ''}" data-favorite="${track.id}" aria-label="${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${isFavorite ? '♥' : '♡'}</button></div>
            <div class="card-artist">${track.artist}</div>
            <div class="card-meta"><span>${track.genre}</span><span>${track.bpm} BPM&nbsp; · &nbsp;${track.duration}s</span></div>
            <button class="play-card-button" data-play="${track.id}"><span>▶</span> Jugar este beat</button>
        </div>
    </article>`;
}

function createLocalCard(track) {
    const template = document.createElement('template');
    template.innerHTML = createTrackCard(track);
    return template.content.firstElementChild;
}

function createRemoteCard(track) {
    const card = document.createElement('article');
    card.className = 'track-card';
    const cover = document.createElement('div');
    cover.className = 'cover';
    cover.style.setProperty('--cover-bg', track.cover);
    cover.style.setProperty('--accent', track.accent);
    cover.innerHTML = '<div class="cover-art"><span>♪</span></div><span class="cover-spark">✦</span>';
    const badge = document.createElement('a');
    badge.className = 'cover-tag';
    badge.href = track.sourceUrl;
    badge.target = '_blank';
    badge.rel = 'noopener noreferrer';
    badge.textContent = track.source === 'youtube' ? 'YOUTUBE' : 'LICENCIA ABIERTA';
    cover.appendChild(badge);

    const body = document.createElement('div');
    body.className = 'card-body';
    const titleRow = document.createElement('div');
    titleRow.className = 'card-title-row';
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = track.title;
    const favorite = document.createElement('button');
    favorite.className = `favorite-button${favorites.includes(track.id) ? ' is-favorite' : ''}`;
    favorite.dataset.favorite = track.id;
    favorite.setAttribute('aria-label', favorites.includes(track.id) ? 'Quitar de favoritos' : 'Añadir a favoritos');
    favorite.textContent = favorites.includes(track.id) ? '♥' : '♡';
    titleRow.append(title, favorite);

    const artist = document.createElement('div');
    artist.className = 'card-artist';
    artist.textContent = track.artist;
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const license = document.createElement('a');
    license.href = track.source === 'youtube' ? track.sourceUrl : track.license;
    license.target = '_blank';
    license.rel = 'noopener noreferrer';
    license.textContent = track.source === 'youtube' ? 'Video de YouTube' : track.licenseLabel;
    const tempo = document.createElement('span');
    tempo.textContent = `~${track.bpm} BPM · ${formatTime(track.duration)}`;
    meta.append(license, tempo);
    const play = document.createElement('button');
    play.className = 'play-card-button';
    play.dataset.play = track.id;
    play.innerHTML = '<span>▶</span> Reproducir y jugar';
    body.append(titleRow, artist, meta, play);
    card.append(cover, body);
    return card;
}

function createYouTubeCard(track) {
    const card = document.createElement('article');
    card.className = 'track-card';
    const cover = document.createElement('div');
    cover.className = 'cover youtube-cover';
    cover.style.setProperty('--cover-bg', track.cover);
    const thumbnail = document.createElement('img');
    thumbnail.src = track.thumbnail;
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    thumbnail.referrerPolicy = 'strict-origin-when-cross-origin';
    cover.appendChild(thumbnail);
    const badge = document.createElement('span');
    badge.className = 'cover-tag';
    badge.textContent = 'YOUTUBE';
    cover.appendChild(badge);
    const body = document.createElement('div');
    body.className = 'card-body';
    const titleRow = document.createElement('div');
    titleRow.className = 'card-title-row';
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = track.title;
    const favorite = document.createElement('button');
    favorite.className = `favorite-button${favorites.includes(track.id) ? ' is-favorite' : ''}`;
    favorite.dataset.favorite = track.id;
    favorite.setAttribute('aria-label', favorites.includes(track.id) ? 'Quitar de favoritos' : 'Añadir a favoritos');
    favorite.textContent = favorites.includes(track.id) ? '♥' : '♡';
    titleRow.append(title, favorite);
    const artist = document.createElement('div');
    artist.className = 'card-artist';
    artist.textContent = track.artist;
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const source = document.createElement('a');
    source.href = track.sourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'Abrir en YouTube ↗';
    const tempo = document.createElement('span');
    tempo.textContent = 'BPM ajustable';
    meta.append(source, tempo);
    const play = document.createElement('button');
    play.className = 'play-card-button';
    play.dataset.play = track.id;
    play.innerHTML = '<span>▶</span> Reproducir y jugar';
    body.append(titleRow, artist, meta, play);
    card.append(cover, body);
    return card;
}

async function searchOpenMusic(query) {
    if (query.length < 2 || query !== searchInput.value.trim()) return;
    if (searchController) searchController.abort();
    const controller = new AbortController();
    searchController = controller;
    const apiKey = youtubeApiKey.trim();
    if (!apiKey) {
        trackGrid.replaceChildren();
        $('#emptyState').hidden = false;
        $('#searchStatus').textContent = 'Para ver resultados y jugarlos aquí, configura la YouTube API key en Ajustes. También puedes buscar directamente en YouTube.';
        updateSearchActions(query, true);
        return;
    }
    await searchYouTube(query, apiKey);
}

async function searchYouTube(query, apiKey) {
    const controller = searchController;
    if (!controller || controller.signal.aborted) return;
    $('#searchStatus').textContent = 'Buscando videos musicales en YouTube...';
    trackGrid.replaceChildren();
    $('#emptyState').hidden = true;
    try {
        const params = new URLSearchParams({
            part: 'snippet',
            type: 'video',
            maxResults: '12',
            safeSearch: 'moderate',
            q: query,
            key: apiKey
        });
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || `YouTube respondió ${response.status}`);
        if (controller.signal.aborted || query !== searchInput.value.trim()) return;
        const results = (data.items || []).map((item) => {
            const videoId = item.id?.videoId;
            if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;
            const track = {
                id: `youtube:${videoId}`,
                videoId,
                title: item.snippet?.title || 'Video sin título',
                artist: item.snippet?.channelTitle || 'Canal de YouTube',
                bpm: 120,
                duration: 180,
                accent: '#ff5964',
                cover: 'linear-gradient(135deg,#66262b,#19151b 76%)',
                thumbnail: item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                source: 'youtube',
                sourceUrl: `https://www.youtube.com/watch?v=${videoId}`
            };
            remoteTracks.set(track.id, track);
            return track;
        }).filter(Boolean);
        trackGrid.replaceChildren(...results.map(createYouTubeCard));
        $('#emptyState').hidden = results.length > 0;
        $('#searchStatus').textContent = results.length
            ? `${results.length} videos encontrados · YouTube. El tempo se ajusta al iniciar; algunos pueden bloquear la reproducción integrada.`
            : 'YouTube no devolvió resultados para esta búsqueda. Prueba otro título o abre la búsqueda directamente.';
        updateSearchActions(query, results.length === 0);
    } catch (error) {
        if (error.name === 'AbortError') return;
        const details = error.message.toLowerCase();
        if (location.protocol === 'file:') {
            $('#searchStatus').textContent = 'Google bloquea la API al abrir index.html como archivo (file://). Inicia Ritmo con “Iniciar Ritmo.bat” y permite http://localhost:8000/* en las restricciones HTTP referrer de tu clave.';
        } else if (details.includes('referer') || details.includes('referrer')) {
            $('#searchStatus').textContent = `Google rechazó el origen de esta página. Añade ${location.origin}/* a las restricciones HTTP referrer de tu clave de YouTube.`;
        } else if (details.includes('quota') || details.includes('quotaexceeded')) {
            $('#searchStatus').textContent = 'Se agotó la cuota diaria de búsquedas de esta API key.';
        } else if (details.includes('key') || details.includes('credential')) {
            $('#searchStatus').textContent = 'La API key no es válida o bloquea este sitio. Revisa la clave y la restricción HTTP referrer en Ajustes.';
        } else {
            $('#searchStatus').textContent = `No se pudo buscar en YouTube: ${error.message}`;
        }
        updateSearchActions(query, true);
        $('#emptyState').hidden = false;
    }
}

function isPlayableLicense(url = '') {
    return /^https?:\/\/creativecommons\.org\/licenses\/by(?:-sa)?\//i.test(url)
        || /^https?:\/\/creativecommons\.org\/publicdomain\/(?:zero|mark)\//i.test(url);
}

async function loadArchiveTrack(doc, signal) {
    try {
        const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`, { signal });
        if (!response.ok) return null;
        const data = await response.json();
        const files = (data.files || []).filter((file) => {
            const name = (file.name || '').toLowerCase();
            return /\.(mp3|ogg|m4a|wav)$/i.test(name)
                && !name.includes('_meta')
                && !name.includes('thumb');
        });
        const file = files.find((item) => /\.mp3$/i.test(item.name))
            || files.find((item) => /\.(ogg|m4a|wav)$/i.test(item.name));
        if (!file) return null;
        const title = firstValue(data.metadata?.title || doc.title) || 'Canción sin título';
        const creator = firstValue(data.metadata?.creator || doc.creator);
        const license = data.metadata?.licenseurl || doc.licenseurl;
        if (!isPlayableLicense(license)) return null;
        const licenseLabel = license.includes('/publicdomain/') ? 'Dominio público' : license.includes('/by-sa/') ? 'CC BY-SA' : 'CC BY';
        const duration = Math.min(Number(file.length || data.metadata?.runtime) || 60, 180);
        const filename = file.name.split('/').map(encodeURIComponent).join('/');
        return {
            id: `archive:${doc.identifier}`,
            identifier: doc.identifier,
            title,
            artist: Array.isArray(creator) ? creator.join(', ') : creator || 'Artista desconocido',
            genre: 'Música abierta',
            bpm: Number(firstValue(data.metadata?.bpm || data.metadata?.tempo || doc.bpm)) || 120,
            duration,
            accent: '#a68aff',
            cover: 'linear-gradient(135deg,#49376c,#171523 76%)',
            audioUrl: `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${filename}`,
            source: 'archive',
            sourceUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
            license,
            licenseLabel
        };
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        return null;
    }
}

function firstValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;
    youtubeApiPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('YouTube tardó demasiado en cargar. Revisa tu conexión.')), 15000);
        window.onYouTubeIframeAPIReady = () => {
            clearTimeout(timeout);
            resolve(window.YT);
        };
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('No se pudo cargar el reproductor de YouTube. Revisa tu conexión.'));
        };
        document.head.appendChild(script);
    }).catch((error) => {
        youtubeApiPromise = null;
        throw error;
    });
    return youtubeApiPromise;
}

async function ensureYouTubePlayer(videoId) {
    await loadYouTubeApi();
    if (youtubePlayer) {
        if (youtubePlayerReady) await youtubePlayerReady;
        if (youtubeIsReady && currentTrack?.videoId === videoId) youtubePlayer.cueVideoById(videoId);
        return youtubePlayer;
    }

    youtubePlayerReady = new Promise((resolve) => {
        youtubePlayer = new window.YT.Player('youtube-player', {
            width: '240',
            height: '200',
            videoId,
            playerVars: {
                controls: 1,
                playsinline: 1,
                rel: 0,
                ...(location.protocol === 'file:' ? {} : { origin: location.origin })
            },
            events: {
                onReady: (event) => {
                    youtubeIsReady = true;
                    if (currentTrack?.videoId) event.target.cueVideoById(currentTrack.videoId);
                    updateGameBackdrop();
                    $('#youtubePlayerStatus').textContent = 'YouTube no informa el BPM: reproduce la canción y calibra el tempo antes de empezar.';
                    $('#startGame').disabled = false;
                    $('#startGame').innerHTML = 'Empezar partida <span>→</span>';
                    resolve(event.target);
                },
                onStateChange: handleYouTubePlayerState,
                onError: (event) => {
                    if (currentTrack?.source !== 'youtube') return;
                    const failedVideoId = event.target.getVideoData?.()?.video_id;
                    if (failedVideoId && failedVideoId !== currentTrack.videoId) return;
                    youtubeStartPending = false;
                    youtubePlaybackFailed = true;
                    isPreviewing = false;
                    clearTimeout(youtubeStartTimer);
                    youtubeStartTimer = null;
                    isPlaying = false;
                    isPaused = false;
                    if (animationId) cancelAnimationFrame(animationId);
                    animationId = null;
                    $('#startOverlay').hidden = false;
                    $('#startGame').disabled = false;
                    $('#startGame').hidden = true;
                    $('#chooseAnotherVideo').hidden = false;
                    $('#uploadFallback').hidden = false;
                    $('#previewTrack').hidden = true;
                    const message = event.data === 101 || event.data === 150
                        ? 'YouTube bloqueó este video dentro del juego. Elige otro resultado o carga un archivo de audio para jugar esa canción.'
                        : event.data === 153
                            ? 'YouTube requiere que abras el juego desde localhost o una web (no desde file://).'
                            : `YouTube no pudo reproducir este video (código ${event.data}).`;
                    $('#youtubePlayerStatus').textContent = message;
                    if (currentTrack?.source === 'youtube') {
                        $('#startOverlay').querySelector('h2').textContent = 'No se puede reproducir este video';
                        $('#startOverlay').querySelector('p').textContent = message;
                    }
                    $('#gameStateLabel').textContent = 'VIDEO NO DISPONIBLE';
                }
            }
        });
    });
    return youtubePlayerReady;
}

function handleYouTubePlayerState(event) {
    const state = window.YT.PlayerState;
    if (event.data === state.PLAYING) {
        clearTimeout(youtubeStartTimer);
        youtubeStartTimer = null;
        if (youtubeStartPending && currentTrack?.source === 'youtube') {
            startYoutubeGameplay();
        } else if (isPreviewing && currentTrack?.source === 'youtube') {
            $('#youtubePlayerStatus').textContent = 'Vista previa en reproducción · marca cuatro pulsos con Tap tempo.';
            $('#previewTrack').textContent = 'Ⅱ Pausar vista previa';
        } else if (isPaused && currentTrack?.source === 'youtube') {
            isPaused = false;
            isPlaying = true;
            $('#pauseOverlay').hidden = true;
            $('#pauseGame').textContent = 'Ⅱ';
            animationId = requestAnimationFrame(gameFrame);
        }
    } else if (event.data === state.PAUSED && isPreviewing && currentTrack?.source === 'youtube') {
        isPreviewing = false;
        $('#previewTrack').textContent = '▶ Reanudar vista previa';
        $('#youtubePlayerStatus').textContent = 'Vista previa pausada. Reanúdala para seguir calibrando.';
    } else if (event.data === state.PAUSED && isPlaying && currentTrack?.source === 'youtube') {
        isPlaying = false;
        isPaused = true;
        if (animationId) cancelAnimationFrame(animationId);
        $('#pauseOverlay').hidden = false;
        $('#pauseGame').textContent = '▶';
    } else if (event.data === state.ENDED && isPlaying && currentTrack?.source === 'youtube') {
        finishGame();
    } else if (event.data === state.ENDED && isPreviewing) {
        isPreviewing = false;
        $('#previewTrack').textContent = '▶ Escuchar para calibrar';
        $('#youtubePlayerStatus').textContent = 'Vista previa terminada. Puedes iniciar la partida cuando quieras.';
    }
}

function startYoutubeGameplay() {
    if (!currentTrack || currentTrack.source !== 'youtube') return;
    youtubeStartPending = false;
    isPreviewing = false;
    clearTimeout(youtubeStartTimer);
    youtubeStartTimer = null;
    startAt = 0;
    youtubePlaybackFailed = false;
    currentTrack.duration = Math.min(youtubePlayer.getDuration() || currentTrack.duration, 300);
    isPlaying = true;
    isPaused = false;
    $('#startOverlay').hidden = true;
    $('#startGame').disabled = false;
    $('#pauseOverlay').hidden = true;
    $('#pauseGame').textContent = 'Ⅱ';
    $('#gameStateLabel').textContent = 'EN PARTIDA';
    $('#youtubePlayerStatus').textContent = '¡Partida en marcha! Sigue las notas y pulsa D, F, J o K.';
    animationId = requestAnimationFrame(gameFrame);
}

function renderLibrary() {
    const libraryGrid = $('#libraryGrid');
    const savedTracks = [
        ...tracks.filter((track) => favorites.includes(track.id)),
        ...savedRemoteTracks.filter((track) => favorites.includes(track.id))
    ];
    libraryGrid.replaceChildren(...savedTracks.map((track) => {
        if (track.source === 'youtube') return createYouTubeCard(track);
        return track.source === 'archive' ? createRemoteCard(track) : createLocalCard(track);
    }));
    $('#libraryEmpty').hidden = savedTracks.length > 0;
    libraryGrid.hidden = savedTracks.length === 0;
}

function renderAll() {
    renderTracks();
    renderLibrary();
}

function switchView(viewName) {
    const isLibrary = viewName === 'library';
    discoverView.hidden = isLibrary;
    libraryView.hidden = !isLibrary;
    $('#breadcrumbCurrent').textContent = isLibrary ? 'MI BIBLIOTECA' : 'EXPLORAR';
    document.querySelectorAll('.nav-item').forEach((button) => {
        button.classList.toggle('active', button.dataset.view === viewName);
    });
    if (isLibrary) renderLibrary();
}

function toggleFavorite(trackId) {
    favorites = favorites.includes(trackId) ? favorites.filter((id) => id !== trackId) : [...favorites, trackId];
    localStorage.setItem('ritmo-favorites', JSON.stringify(favorites));
    const remoteTrack = remoteTracks.get(trackId);
    if (remoteTrack && favorites.includes(trackId) && !savedRemoteTracks.some((track) => track.id === trackId)) {
        savedRemoteTracks.push(remoteTrack);
    }
    if (remoteTrack && !favorites.includes(trackId)) {
        savedRemoteTracks = savedRemoteTracks.filter((track) => track.id !== trackId);
    }
    localStorage.setItem('ritmo-remote-favorites', JSON.stringify(savedRemoteTracks));
    document.querySelectorAll('[data-favorite]').forEach((button) => {
        if (button.dataset.favorite !== trackId) return;
        const isFavorite = favorites.includes(trackId);
        button.classList.toggle('is-favorite', isFavorite);
        button.textContent = isFavorite ? '♥' : '♡';
        button.setAttribute('aria-label', isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos');
    });
    renderLibrary();
}

function openGame(trackId) {
    currentTrack = tracks.find((track) => track.id === trackId)
        || remoteTracks.get(trackId)
        || savedRemoteTracks.find((track) => track.id === trackId);
    if (!currentTrack) return;
    cachedBestScore = Number(localStorage.getItem(`ritmo-best-${currentTrack.id}`) || 0);
    const savedBpm = Number(localStorage.getItem(`ritmo-track-bpm-${currentTrack.id}`));
    const savedBeatOffset = Number(localStorage.getItem(`ritmo-track-offset-${currentTrack.id}`));
    if (savedBpm >= 60 && savedBpm <= 200) currentTrack.bpm = savedBpm;
    currentTrack.beatOffset = Number.isFinite(savedBeatOffset) ? savedBeatOffset : 0;
    if ((currentTrack.source === 'archive' || currentTrack.source === 'youtube') && !remoteTracks.has(trackId)) {
        remoteTracks.set(trackId, currentTrack);
    }
    discoverView.hidden = true;
    libraryView.hidden = true;
    gameScreen.hidden = false;
    updateCanvasSize();
    document.documentElement.style.overflow = 'hidden';
    $('#gameTitle').textContent = currentTrack.title;
    $('#gameArtist').textContent = currentTrack.artist;
    $('#gameBpm').textContent = `${currentTrack.bpm} BPM${currentTrack.source === 'archive' ? ' · estimado' : ''}`;
    $('#bpmSetting').value = currentTrack.bpm;
    $('#bpmValue').textContent = `${currentTrack.bpm} BPM`;
    $('#beatOffsetSetting').value = currentTrack.beatOffset;
    $('#beatOffsetValue').textContent = `${currentTrack.beatOffset} ms`;
    tapTimes = [];
    youtubePlaybackFailed = false;
    isPreviewing = false;
    $('#chooseAnotherVideo').hidden = true;
    $('#uploadFallback').hidden = true;
    $('#startGame').hidden = false;
    $('#previewTrack').hidden = currentTrack.source !== 'youtube' && !currentTrack.audioUrl;
    $('#previewTrack').disabled = currentTrack.source === 'youtube';
    $('#previewTrack').textContent = '▶ Escuchar para calibrar';
    $('#gameStateLabel').textContent = 'PREPARACIÓN';
    $('#playerHeading').textContent = currentTrack.source === 'youtube' ? 'REPRODUCCIÓN DE YOUTUBE' : 'REPRODUCCIÓN DE AUDIO';
    $('#youtube-player-container').hidden = currentTrack.source !== 'youtube';
    updateGameBackdrop();
    $('#setupDescription').textContent = currentTrack.source === 'youtube'
        ? 'Escucha la canción, marca cuatro pulsos con Tap tempo y ajusta la sincronía antes de empezar.'
        : 'Ajusta los BPM o marca cuatro pulsos con Tap tempo mientras escuchas tu canción.';
    $('#tapTempo').innerHTML = 'TAP TEMPO <span>· 0/4</span>';
    $('#tapTempoHint').textContent = currentTrack.source === 'youtube'
        ? 'Pulsa “Escuchar para calibrar” y marca cuatro pulsos.'
        : 'Marca cuatro pulsos para calcular el tempo automáticamente.';
    updateSyncStatus();
    $('#gameCover').style.setProperty('--cover-bg', currentTrack.cover);
    $('#gameCover').style.setProperty('--accent', currentTrack.accent);
    $('#startOverlay').hidden = false;
    $('#pauseOverlay').hidden = true;
    $('#resultModal').hidden = true;
    $('#pauseGame').textContent = 'Ⅱ';
    resetGame();
    if (currentTrack.source === 'youtube') {
        $('#startGame').disabled = true;
        $('#startGame').textContent = 'Cargando reproductor…';
        const videoLink = $('#openYoutubeVideo');
        videoLink.href = currentTrack.sourceUrl;
        videoLink.hidden = false;
        $('#youtubePlayerStatus').textContent = 'Cargando el reproductor oficial de YouTube...';
        ensureYouTubePlayer(currentTrack.videoId).then(() => {
            if (currentTrack?.videoId !== trackId.slice('youtube:'.length)) return;
            $('#startGame').disabled = false;
            $('#startGame').innerHTML = 'Empezar partida <span>→</span>';
            $('#previewTrack').disabled = false;
            $('#youtubePlayerStatus').textContent = 'Reproduce el video para calibrar el ritmo; pulsa Empezar para iniciar la partida.';
        }).catch((error) => {
            if (currentTrack?.videoId !== trackId.slice('youtube:'.length)) return;
            $('#startGame').disabled = false;
            $('#startGame').textContent = 'Reintentar carga';
            $('#youtubePlayerStatus').textContent = error.message;
            $('#startOverlay').querySelector('p').textContent = error.message;
        });
    } else {
        $('#openYoutubeVideo').hidden = true;
        $('#youtubePlayerStatus').textContent = currentTrack.source === 'local'
            ? 'Se reproducirá desde tu dispositivo. El archivo no se sube a internet.'
            : currentTrack.source === 'archive'
                ? 'Audio de licencia abierta. Escúchalo y marca cuatro pulsos para calibrarlo.'
                : 'Beat original generado en el navegador.';
    }
}

function resetGame() {
    stopGameAudio();
    score = 0;
    combo = 0;
    hits = 0;
    successfulHits = 0;
    missedBeats = new Set();
    nextMissBeat = currentTrack ? getFirstPlayableBeat() : 0;
    activeLanes.clear();
    keyboardLanes.clear();
    pointerLanes.clear();
    laneLabels.forEach((label) => label.classList.remove('is-active'));
    clearTimeout(ratingHideTimer);
    frameElements.rating.classList.remove('is-visible');
    isPlaying = false;
    isPaused = false;
    updateScore();
    frameElements.progress.style.transform = 'scaleX(0)';
    lastProgress = 0;
    lastDisplayedBeat = -1;
    lastDisplayedSecond = -1;
    $('#timeLabel').textContent = '0:00';
    $('#measureLabel').textContent = 'COMPÁS 01 · BEAT 1';
    $('#rankText').textContent = '¡A romperla!';
    $('#rankDescription').textContent = 'Cada nota cuenta. Encuentra tu ritmo.';
    $('#startOverlay').querySelector('h2').textContent = 'Sigue el pulso. Pulsa a tiempo.';
    $('#setupDescription').textContent = currentTrack?.source === 'youtube'
        ? 'Las notas bajan por cuatro carriles. Pulsa D, F, J o K cuando lleguen a la línea inferior.'
        : 'Las notas bajan por cuatro carriles. Ajusta los BPM o marca cuatro pulsos para sincronizar.';
    updateSyncStatus();
    $('#startGame').disabled = false;
    $('#gameStateLabel').textContent = 'PREPARACIÓN';
    drawGame();
}

function stopGameAudio() {
    youtubeStartPending = false;
    isPreviewing = false;
    clearTimeout(youtubeStartTimer);
    youtubeStartTimer = null;
    if (schedulerId) clearInterval(schedulerId);
    schedulerId = null;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.currentTime = 0;
        remoteAudio = null;
    }
    if (youtubePlayer && youtubeIsReady) {
        youtubePlayer.pauseVideo();
        youtubePlayer.seekTo(0, true);
    }
    if (audioContext && audioContext.state === 'running') audioContext.suspend();
}

async function beginGame() {
    if (!currentTrack) return;
    if (currentTrack.source === 'youtube') {
        if (youtubePlaybackFailed) {
            $('#youtubePlayerStatus').textContent = 'Este video no se puede jugar aquí. Elige otro resultado o carga un archivo de audio.';
            return;
        }
        if (!youtubePlayer || !youtubeIsReady) {
            $('#youtubePlayerStatus').textContent = 'El reproductor aún se está preparando. Espera un momento y pulsa Empezar de nuevo.';
            return;
        }
        resetGame();
        $('#startGame').disabled = true;
        $('#startGame').textContent = 'Iniciando…';
        $('#startOverlay').querySelector('h2').textContent = '¡Que empiece el ritmo!';
        $('#startOverlay').querySelector('p').textContent = 'Iniciando la canción y preparando las notas…';
        $('#youtubePlayerStatus').textContent = 'Iniciando canción…';
        isPreviewing = false;
        $('#previewTrack').textContent = '▶ Escuchar para calibrar';
        youtubeStartPending = true;
        youtubePlayer.seekTo(0, true);
        youtubePlayer.playVideo();
        if (youtubeStartPending && youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING) {
            startYoutubeGameplay();
            return;
        }
        if (!youtubeStartPending) return;
        youtubeStartTimer = setTimeout(() => {
            if (!youtubeStartPending) return;
            youtubeStartPending = false;
            $('#startGame').disabled = false;
            $('#startGame').innerHTML = 'Empezar partida <span>→</span>';
            $('#startOverlay').querySelector('h2').textContent = 'Pulsa empezar para intentarlo otra vez';
            $('#startOverlay').querySelector('p').textContent = 'YouTube no inició el video. Comprueba que se pueda reproducir y vuelve a pulsar Empezar partida.';
            $('#youtubePlayerStatus').textContent = 'No se pudo iniciar el video. También puedes pulsar reproducir en el reproductor.';
        }, 8000);
        return;
    }
    resetGame();
    if (!audioSupported) {
        $('#startOverlay').querySelector('p').textContent = 'Este navegador no permite generar audio. Prueba con una versión reciente de Chrome, Edge o Firefox.';
        return;
    }
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContextClass();
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
        const noiseLength = Math.ceil(audioContext.sampleRate * 0.14);
        noiseBuffer = audioContext.createBuffer(1, noiseLength, audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseLength; i++) noiseData[i] = Math.random() * 2 - 1;
    }
    try {
        await audioContext.resume();
    } catch (error) {
        $('#startOverlay').querySelector('p').textContent = 'No se pudo iniciar el audio. Recarga la página e inténtalo de nuevo.';
        return;
    }
    masterGain.gain.setTargetAtTime(settings.volume / 100 * 0.26, audioContext.currentTime, 0.03);
    if (currentTrack.audioUrl) {
        remoteAudio = new Audio();
        remoteAudio.preload = 'auto';
        remoteAudio.src = currentTrack.audioUrl;
        remoteAudio.volume = settings.volume / 100;
        remoteAudio.addEventListener('ended', finishGame, { once: true });
        remoteAudio.addEventListener('error', () => {
            if (!remoteAudio || remoteAudio.src !== currentTrack.audioUrl) return;
            isPlaying = false;
            stopGameAudio();
            $('#startOverlay').hidden = false;
            $('#startOverlay').querySelector('p').textContent = 'No se pudo reproducir este archivo. Prueba otro resultado del catálogo.';
        }, { once: true });
        try {
            await remoteAudio.play();
        } catch (error) {
            stopGameAudio();
            $('#startOverlay').hidden = false;
            $('#startOverlay').querySelector('p').textContent = 'El archivo no está disponible para reproducir. Prueba otro resultado.';
            return;
        }
        startAt = audioContext.currentTime;
    } else {
        startAt = audioContext.currentTime + 0.16;
    }
    nextBeat = 0;
    isPlaying = true;
    isPaused = false;
    $('#gameStateLabel').textContent = 'EN PARTIDA';
    $('#startOverlay').hidden = true;
    $('#pauseOverlay').hidden = true;
    $('#pauseGame').textContent = 'Ⅱ';
    schedulerId = setInterval(scheduleBeats, 25);
    animationId = requestAnimationFrame(gameFrame);
}

function scheduleBeats() {
    if (!isPlaying || !audioContext || !currentTrack || currentTrack.audioUrl) return;
    const beatLength = 60 / currentTrack.bpm;
    const scheduleThrough = audioContext.currentTime + 0.12;
    while (nextBeat < getTotalBeats() && startAt + nextBeat * beatLength <= scheduleThrough) {
        scheduleBeat(nextBeat, startAt + nextBeat * beatLength);
        nextBeat++;
    }
}

function scheduleBeat(beat, time) {
    const track = currentTrack;
    const step = beat % 16;
    const barBeat = beat % 4;
    const rootFrequency = midiToFrequency(track.root);
    const scaleIndex = (Math.floor(beat / 2) + (track.style === 'arcade' ? 2 : 0)) % track.scale.length;
    const bassFrequency = rootFrequency * Math.pow(2, track.scale[scaleIndex] / 12);

    if (barBeat === 0 || (track.style !== 'chill' && barBeat === 2)) playKick(time, track.style);
    if (barBeat === 1 || barBeat === 3) playSnare(time, track.style);
    playHat(time, track.style, 0.06);
    if (track.style === 'arcade' || beat % 2 === 0) playTone(bassFrequency / 2, time, track.style === 'chill' ? 0.17 : 0.11, track.style === 'chill' ? 'triangle' : 'sawtooth', 0.07);
    if ((track.style === 'arcade' && step % 2 === 0) || (track.style !== 'arcade' && step % 4 === 0)) {
        const note = rootFrequency * Math.pow(2, track.scale[(step + Math.floor(beat / 4)) % track.scale.length] / 12) * 2;
        playTone(note, time, 0.19, 'sine', 0.035);
    }
    if (track.style === 'arcade' && beat % 2 === 1) playHat(time, track.style, 0.025);
}

function playKick(time, style) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(style === 'chill' ? 100 : 145, time);
    oscillator.frequency.exponentialRampToValueAtTime(38, time + 0.16);
    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(time);
    oscillator.stop(time + 0.21);
}

function playSnare(time, style) {
    const noise = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    noise.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = style === 'chill' ? 900 : 1450;
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    noise.connect(filter).connect(gain).connect(masterGain);
    noise.start(time);
    noise.stop(time + 0.14);
}

function playHat(time, style, volume) {
    const noise = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    noise.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = style === 'chill' ? 6500 : 8200;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
    noise.connect(filter).connect(gain).connect(masterGain);
    noise.start(time);
    noise.stop(time + 0.05);
}

function playTone(frequency, time, duration, type, volume) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.01);
}

function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

function getLane(beat) {
    return lanePattern[(beat + Math.floor(beat / 4)) % lanePattern.length];
}

function gameFrame() {
    if (!isPlaying || !currentTrack) return;
    const usesYouTube = currentTrack.source === 'youtube';
    const usesAudioFile = Boolean(currentTrack.audioUrl && remoteAudio);
    const elapsed = currentTrack.source === 'youtube'
        ? (youtubePlayer?.getCurrentTime() ?? 0)
        : usesAudioFile
            ? remoteAudio.currentTime
            : Math.max(0, audioContext.currentTime - startAt);
    const duration = usesYouTube || usesAudioFile
        ? currentTrack.duration
        : 60 / currentTrack.bpm * getTotalBeats();
    const synchronizedTime = usesYouTube ? elapsed
        : usesAudioFile ? startAt + elapsed
            : audioContext.currentTime;
    const adjustedTime = synchronizedTime + settings.offset / 1000;
    updateGame(elapsed, duration, adjustedTime);
    drawGame(adjustedTime);
    if (elapsed >= duration || (currentTrack.audioUrl && remoteAudio.ended)) {
        finishGame();
        return;
    }
    animationId = requestAnimationFrame(gameFrame);
}

function getSynchronizedTime() {
    if (currentTrack?.source === 'youtube' && youtubePlayer) return youtubePlayer.getCurrentTime();
    if (currentTrack?.audioUrl && remoteAudio) return startAt + remoteAudio.currentTime;
    return audioContext ? audioContext.currentTime : startAt;
}

function updateGame(elapsed, duration, adjustedTime) {
    const beatLength = 60 / currentTrack.bpm;
    const missWindow = getMissWindow(beatLength);
    const phaseOffset = (currentTrack.beatOffset || 0) / 1000;
    const displayedBeat = Math.max(0, Math.floor((elapsed + settings.offset / 1000 - phaseOffset) / beatLength));
    if (displayedBeat !== lastDisplayedBeat) {
        lastDisplayedBeat = displayedBeat;
        frameElements.measure.textContent = `COMPÁS ${String(Math.floor(displayedBeat / 4) + 1).padStart(2, '0')} · BEAT ${displayedBeat % 4 + 1}`;
    }
    const expiredThrough = Math.floor((adjustedTime - startAt - phaseOffset - missWindow) / beatLength);
    const lastExpired = Math.min(expiredThrough, getTotalBeats() - 1);
    let newMisses = 0;
    while (nextMissBeat <= lastExpired) {
        if (!missedBeats.has(nextMissBeat)) {
            missedBeats.add(nextMissBeat);
            newMisses++;
        }
        nextMissBeat++;
    }
    if (newMisses) {
        hits += newMisses;
        combo = 0;
        showRating('MISS', '#ff7899');
        updateScore();
    }
    const progress = Math.min(100, (elapsed / duration) * 100);
    const progressElement = frameElements.progress;
    if (Math.abs(lastProgress - progress) >= 0.5) {
        lastProgress = progress;
        progressElement.style.transform = `scaleX(${progress / 100})`;
    }
    const displayedSecond = Math.floor(elapsed);
    if (displayedSecond !== lastDisplayedSecond) {
        lastDisplayedSecond = displayedSecond;
        frameElements.time.textContent = formatTime(elapsed);
    }
}

function getTotalBeats() {
    return currentTrack ? Math.ceil(currentTrack.duration * currentTrack.bpm / 60) : 64;
}

function getBeatTime(beat, beatLength = 60 / currentTrack.bpm) {
    return startAt + beat * beatLength + (currentTrack.beatOffset || 0) / 1000;
}

function getFirstPlayableBeat(beatLength = 60 / currentTrack.bpm) {
    const phaseOffset = (currentTrack.beatOffset || 0) / 1000;
    const timingOffset = settings.offset / 1000;
    return Math.max(4, Math.ceil((1.65 / settings.speed - phaseOffset - timingOffset) / beatLength));
}

function getMissWindow(beatLength) {
    return Math.min(0.36, beatLength * 0.48);
}

function updateCanvasSize() {
    const bounds = canvas.getBoundingClientRect();
    const sizeChanged = canvasSize.width !== bounds.width || canvasSize.height !== bounds.height;
    canvasSize.left = bounds.left;
    if (!sizeChanged) return;
    canvasSize.width = bounds.width;
    canvasSize.height = bounds.height;
}

function drawGame(synchronizedTime = getSynchronizedTime() + settings.offset / 1000) {
    const width = canvasSize.width || 520;
    const height = canvasSize.height || 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!currentTrack) return;
    const laneWidth = width / 4;
    const spawnY = height * 0.08;
    const targetY = height * 0.81;
    const leadTime = 1.65 / settings.speed;
    const beatLength = 60 / currentTrack.bpm;
    const chartTime = synchronizedTime;
    const pulse = isPlaying ? 1 - ((chartTime % beatLength) / beatLength) : 0;
    for (let lane = 0; lane < 4; lane++) {
        const color = laneColors[lane];
        const laneX = lane * laneWidth;
        if (activeLanes.has(lane)) {
            ctx.fillStyle = `${color}12`;
            ctx.fillRect(laneX, 0, laneWidth, height);
        }
        if (lane > 0) {
            ctx.beginPath();
            ctx.moveTo(laneX, 0);
            ctx.lineTo(laneX, height);
            ctx.strokeStyle = '#ffffff18';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(laneX + laneWidth * 0.15, targetY);
        ctx.lineTo(laneX + laneWidth * 0.85, targetY);
        ctx.strokeStyle = `${color}${activeLanes.has(lane) ? 'c8' : '62'}`;
        ctx.lineWidth = activeLanes.has(lane) ? 4 : 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = activeLanes.has(lane) ? 18 : 7;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(laneX + laneWidth / 2, targetY, activeLanes.has(lane) ? 18 : 13, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}${activeLanes.has(lane) ? 'c8' : '70'}`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(width, targetY);
    ctx.strokeStyle = noteSkins[settings.noteSkin].primary;
    ctx.globalAlpha = 0.12 + pulse * 0.16;
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const phaseOffset = (currentTrack.beatOffset || 0) / 1000;
    const firstPlayable = getFirstPlayableBeat(beatLength);
    const firstVisible = Math.max(firstPlayable, Math.ceil((chartTime - startAt - phaseOffset - 0.2) / beatLength));
    const totalBeats = getTotalBeats();
    const lastVisible = Math.min(
        totalBeats - 1,
        Math.floor((chartTime + leadTime - startAt - phaseOffset) / beatLength)
    );
    for (let beat = firstVisible; beat <= lastVisible; beat++) {
        if (missedBeats.has(beat)) continue;
        const targetTime = getBeatTime(beat, beatLength);
        const timeRemaining = targetTime - chartTime;
        if (timeRemaining > leadTime || timeRemaining < -0.2) continue;
        const lane = getLane(beat);
        const progress = Math.max(0, Math.min(1, 1 - timeRemaining / leadTime));
        const noteY = spawnY + progress * (targetY - spawnY);
        const noteX = lane * laneWidth + laneWidth / 2;
        const downbeat = beat % 4 === 0;
        const noteSize = settings.noteSize / 100;
        const noteWidth = laneWidth * (downbeat ? 0.66 : 0.58) * noteSize;
        const noteHeight = (downbeat ? 23 : 18) * noteSize;
        ctx.save();
        ctx.shadowColor = laneColors[lane];
        ctx.shadowBlur = downbeat ? 18 : 12;
        ctx.fillStyle = laneColors[lane];
        drawNoteShape(ctx, settings.noteShape, noteX - noteWidth / 2, noteY - noteHeight / 2, noteWidth, noteHeight);
        ctx.shadowBlur = 0;
        if (downbeat) {
            ctx.fillStyle = '#ffffffdd';
            ctx.fillRect(noteX - 2, noteY - noteHeight * 0.23, 4, noteHeight * 0.46);
        }
        ctx.restore();
    }
}

function drawNoteShape(context, shape, x, y, width, height) {
    if (shape === 'diamond') {
        context.beginPath();
        context.moveTo(x + width / 2, y);
        context.lineTo(x + width, y + height / 2);
        context.lineTo(x + width / 2, y + height);
        context.lineTo(x, y + height / 2);
        context.closePath();
        context.fill();
    } else if (shape === 'circle') {
        const diameter = Math.min(width, height);
        context.beginPath();
        context.ellipse(x + width / 2, y + height / 2, diameter / 2, diameter / 2, 0, 0, Math.PI * 2);
        context.fill();
    } else if (shape === 'bar') {
        context.fillRect(x, y + height * 0.2, width, height * 0.6);
    } else {
        roundedRect(context, x, y, width, height, height / 2);
    }
}

function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
}

function tryHit(lane) {
    if (!isPlaying || !currentTrack || (currentTrack.source !== 'youtube' && !audioContext)) return;
    const now = getSynchronizedTime() + settings.offset / 1000;
    const beatLength = 60 / currentTrack.bpm;
    let closestBeat = -1;
    let closestDistance = Infinity;
    let bestBeat = -1;
    let bestDistance = Infinity;
    const phaseOffset = (currentTrack.beatOffset || 0) / 1000;
    const nearestBeat = Math.round((now - startAt - phaseOffset) / beatLength);
    const firstBeat = Math.max(getFirstPlayableBeat(beatLength), nearestBeat - 2);
    const lastBeat = Math.min(getTotalBeats() - 1, Math.max(firstBeat, nearestBeat + 2));
    for (let beat = firstBeat; beat <= lastBeat; beat++) {
        if (missedBeats.has(beat)) continue;
        const distance = Math.abs(getBeatTime(beat, beatLength) - now);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestBeat = beat;
        }
        if (getLane(beat) !== lane) continue;
        if (distance < bestDistance) {
            bestDistance = distance;
            bestBeat = beat;
        }
    }
    if (bestBeat < 0 || bestDistance > getMissWindow(beatLength)) {
        if (closestBeat >= 0 && closestDistance <= getMissWindow(beatLength)) {
            showRating('OTRA TECLA', '#ffb280');
        } else if (bestBeat >= 0 && bestDistance < beatLength * 0.8) {
            showRating(now < getBeatTime(bestBeat, beatLength) ? 'MUY PRONTO' : 'A DESTIEMPO', '#ffb280');
        }
        return;
    }
    missedBeats.add(bestBeat);
    hits++;
    successfulHits++;
    combo++;
    const perfectWindow = Math.min(0.11, beatLength * 0.18);
    const greatWindow = Math.min(0.24, beatLength * 0.42);
    if (bestDistance <= perfectWindow) {
        score += 100 * Math.min(combo, 10);
        showRating('PERFECT', '#d3ff6b');
    } else if (bestDistance <= greatWindow) {
        score += 70 * Math.min(combo, 10);
        showRating('GREAT', '#c4a0ff');
    } else {
        score += 35 * Math.min(combo, 10);
        showRating('GOOD', '#7fe4d2');
    }
    updateScore();
}

function saveTrackCalibration() {
    if (!currentTrack) return;
    localStorage.setItem(`ritmo-track-bpm-${currentTrack.id}`, String(currentTrack.bpm));
    localStorage.setItem(`ritmo-track-offset-${currentTrack.id}`, String(currentTrack.beatOffset || 0));
}

function tapTempo() {
    if (!currentTrack) return;
    const youtubeClock = currentTrack.source === 'youtube'
        && youtubePlayer
        && youtubeIsReady
        && youtubePlayer.getPlayerState() === window.YT.PlayerState.PLAYING;
    const localClock = currentTrack.source !== 'youtube' && isPreviewing && remoteAudio && !remoteAudio.paused;
    const mediaClock = youtubeClock || localClock;
    const now = youtubeClock ? youtubePlayer.getCurrentTime()
        : localClock ? remoteAudio.currentTime
            : performance.now() / 1000;
    const previousTap = tapTimes[tapTimes.length - 1];
    if (previousTap && (previousTap.mediaClock !== mediaClock || now - previousTap.time > 2)) tapTimes = [];
    tapTimes.push({ time: now, mediaClock });
    if (tapTimes.length > 7) tapTimes.shift();

    const intervals = tapTimes.slice(1).map((tap, index) => tap.time - tapTimes[index].time);
    const validIntervals = intervals.filter((interval) => interval > 0.2 && interval <= 2);
    if (validIntervals.length >= 3) {
        const sortedIntervals = [...validIntervals].sort((a, b) => a - b);
        const median = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
        currentTrack.bpm = Math.max(60, Math.min(200, Math.round(60000 / median)));
        $('#bpmSetting').value = currentTrack.bpm;
        $('#bpmValue').textContent = `${currentTrack.bpm} BPM`;
        $('#gameBpm').textContent = `${currentTrack.bpm} BPM${currentTrack.source === 'archive' ? ' · estimado' : ''}`;
        if (mediaClock && tapTimes.every((tap) => tap.mediaClock)) {
            const beatLength = 60 / currentTrack.bpm;
            const phases = tapTimes.map((tap) => ((tap.time % beatLength + beatLength / 2) % beatLength) - beatLength / 2);
            phases.sort((a, b) => a - b);
            currentTrack.beatOffset = Math.round(phases[Math.floor(phases.length / 2)] * 1000);
            $('#beatOffsetSetting').value = currentTrack.beatOffset;
            $('#beatOffsetValue').textContent = `${currentTrack.beatOffset} ms`;
        }
        saveTrackCalibration();
    }
    $('#tapTempo').innerHTML = `TAP TEMPO <span>· ${Math.min(tapTimes.length, 4)}/4</span>`;
    $('#tapTempoHint').textContent = validIntervals.length >= 3
        ? `Tempo ${currentTrack.bpm} BPM${mediaClock ? ` · entrada ${currentTrack.beatOffset} ms` : ''}. Sigue tocando para afinarlo.`
        : mediaClock ? 'Usando el reloj del video para calibrar tempo y primer beat.' : 'Sigue tocando al ritmo de la canción.';
}

function updateScore() {
    const formattedScore = String(score).padStart(6, '0');
    if (scoreElements.score.textContent !== formattedScore) scoreElements.score.textContent = formattedScore;
    if (scoreElements.combo.textContent !== String(combo)) scoreElements.combo.textContent = combo;
    const accuracy = hits ? Math.round(successfulHits / hits * 100) : 100;
    const accuracyText = String(accuracy);
    if (scoreElements.accuracy.firstChild.nodeValue !== accuracyText) scoreElements.accuracy.firstChild.nodeValue = accuracyText;
    const bestText = String(cachedBestScore).padStart(6, '0');
    if (scoreElements.best.textContent !== bestText) scoreElements.best.textContent = bestText;
    if (combo >= 10) {
        const rank = `${combo} notas seguidas`;
        if (scoreElements.rank.textContent !== rank) scoreElements.rank.textContent = rank;
        if (scoreElements.description.textContent !== '¡Tu racha está que arde!') {
            scoreElements.description.textContent = '¡Tu racha está que arde!';
        }
    } else {
        if (scoreElements.rank.textContent !== '¡A romperla!') scoreElements.rank.textContent = '¡A romperla!';
        if (scoreElements.description.textContent !== 'Cada nota cuenta. Encuentra tu ritmo.') {
            scoreElements.description.textContent = 'Cada nota cuenta. Encuentra tu ritmo.';
        }
    }
    const onFire = combo >= 5;
    if (scoreElements.panel.classList.contains('is-on-fire') !== onFire) {
        scoreElements.panel.classList.toggle('is-on-fire', onFire);
    }
}

function showRating(text, color) {
    const rating = frameElements.rating;
    rating.textContent = text;
    rating.dataset.rating = text.toLowerCase().replace(/\s+/g, '-');
    rating.style.color = color;
    rating.classList.add('is-visible');
    clearTimeout(ratingHideTimer);
    ratingHideTimer = setTimeout(() => {
        rating.classList.remove('is-visible');
    }, 420);
}

function finishGame() {
    isPlaying = false;
    stopGameAudio();
    const bestKey = `ritmo-best-${currentTrack.id}`;
    if (score > cachedBestScore) {
        cachedBestScore = score;
        localStorage.setItem(bestKey, String(score));
    }
    updateScore();
    const accuracy = hits ? Math.round(successfulHits / hits * 100) : 100;
    const rank = accuracy >= 95 ? 'PERFECT' : accuracy >= 80 ? 'GREAT' : accuracy >= 60 ? 'GOOD' : 'KEEP GOING';
    $('#resultTrack').textContent = `${currentTrack.title} · ${accuracy}% de precisión`;
    $('#resultScore').textContent = score.toLocaleString('es');
    $('#resultRank').textContent = rank;
    $('#resultModal').hidden = false;
}

function formatTime(seconds) {
    const wholeSeconds = Math.floor(seconds);
    return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

async function togglePause() {
    if (!currentTrack) return;
    if (!isPlaying && !isPaused) {
        await beginGame();
        return;
    }
    if (isPaused) {
        if (currentTrack.source === 'youtube') {
            isPaused = false;
            isPlaying = true;
            $('#pauseOverlay').hidden = true;
            $('#pauseGame').textContent = 'Ⅱ';
            youtubePlayer.playVideo();
            animationId = requestAnimationFrame(gameFrame);
            return;
        }
        try {
            await audioContext.resume();
            if (remoteAudio) await remoteAudio.play();
        } catch (error) {
            $('#pauseOverlay').querySelector('h2').textContent = 'No se pudo reanudar el audio';
            return;
        }
        isPaused = false;
        isPlaying = true;
        $('#pauseOverlay').hidden = true;
        $('#pauseGame').textContent = 'Ⅱ';
        if (currentTrack.source !== 'youtube') schedulerId = setInterval(scheduleBeats, 25);
        animationId = requestAnimationFrame(gameFrame);
    } else {
        isPlaying = false;
        isPaused = true;
        if (currentTrack.source === 'youtube') {
            if (animationId) cancelAnimationFrame(animationId);
            animationId = null;
            youtubePlayer.pauseVideo();
            $('#pauseOverlay').querySelector('h2').textContent = 'Partida en pausa';
            $('#pauseOverlay').hidden = false;
            $('#pauseGame').textContent = '▶';
            return;
        }
        if (schedulerId) clearInterval(schedulerId);
        schedulerId = null;
        if (animationId) cancelAnimationFrame(animationId);
        animationId = null;
        if (remoteAudio) remoteAudio.pause();
        if (audioContext.state === 'running') audioContext.suspend();
        $('#pauseOverlay').querySelector('h2').textContent = 'Partida en pausa';
        $('#pauseOverlay').hidden = false;
        $('#pauseGame').textContent = '▶';
    }
}

function openSettings() {
    $('#volumeSetting').value = settings.volume;
    $('#volumeValue').textContent = `${settings.volume}%`;
    $('#speedSetting').value = String(settings.speed);
    $('#backgroundSetting').value = settings.background;
    $('#offsetSetting').value = settings.offset;
    $('#offsetValue').textContent = `${settings.offset} ms`;
    $('#noteSkinSetting').value = settings.noteSkin;
    $('#noteShapeSetting').value = settings.noteShape;
    $('#noteSizeSetting').value = settings.noteSize;
    $('#noteSizeValue').textContent = `${settings.noteSize}%`;
    $('#autoSyncSetting').checked = settings.autoSync;
    $('#youtubeApiKey').value = youtubeApiKey;
    $('#settingsModal').hidden = false;
}

function updateGameBackdrop() {
    const backdrop = $('#gameBackdrop');
    const playerContainer = $('#youtube-player-container');
    const playerCard = $('.youtube-player-card');
    if (!['clean', 'cover', 'video'].includes(settings.background)) settings.background = 'clean';
    const useVideo = settings.background === 'video'
        && currentTrack?.source === 'youtube'
        && youtubeIsReady;
    const useCover = settings.background === 'cover'
        || (settings.background === 'video' && !useVideo);
    const thumbnail = /^https:\/\/i\.ytimg\.com\//i.test(currentTrack?.thumbnail || '')
        ? currentTrack.thumbnail
        : '';
    backdrop.style.backgroundImage = thumbnail
        ? `url("${thumbnail}")`
        : currentTrack?.cover || 'none';
    if (useVideo) gameScreen.append(playerContainer);
    else playerCard.insertBefore(playerContainer, $('#youtubePlayerStatus'));
    gameScreen.classList.toggle('has-cover-backdrop', useCover);
    gameScreen.classList.toggle('has-video-background', useVideo);
    playerContainer.classList.toggle('is-background-player', useVideo);
    playerContainer.hidden = currentTrack?.source !== 'youtube';
}

function updateSyncStatus(message) {
    const status = $('#syncStatus');
    if (!currentTrack) {
        status.hidden = true;
        return;
    }

    status.hidden = false;
    if (message) {
        status.textContent = message;
    } else if (currentTrack.source === 'youtube') {
        status.textContent = 'YouTube no permite analizar su audio aquí. Usa MARCAR TEMPO para sincronizarlo a oído.';
    } else if (currentTrack.audioUrl && settings.autoSync) {
        status.textContent = 'Sincronizador automático activado: analizando el audio local…';
    } else if (currentTrack.audioUrl) {
        status.textContent = 'Sincronizador apagado. Puedes ajustar el tempo y marcar cuatro pulsos manualmente.';
    } else {
        status.textContent = 'Beat original: tempo y notas ya están sincronizados.';
    }
}

async function autoSyncTrack(track) {
    if (!settings.autoSync || !track.audioUrl) return;
    updateSyncStatus('Analizando el audio local para estimar el tempo…');
    try {
        const sync = await estimateAudioSync(track.audioUrl);
        if (!settings.autoSync || currentTrack?.id !== track.id) return;
        track.bpm = sync.bpm;
        track.beatOffset = sync.beatOffset;
        $('#bpmSetting').value = sync.bpm;
        $('#bpmValue').textContent = `${sync.bpm} BPM`;
        $('#beatOffsetSetting').value = sync.beatOffset;
        $('#beatOffsetValue').textContent = `${sync.beatOffset} ms`;
        $('#gameBpm').textContent = `${sync.bpm} BPM${track.source === 'archive' ? ' · estimado' : ''}`;
        $('#tapTempoHint').textContent = `Tempo estimado: ${sync.bpm} BPM. Marca los pulsos de la canción si quieres afinarlo.`;
        saveTrackCalibration();
        drawGame();
        updateSyncStatus(`Sincronizado automáticamente: ${sync.bpm} BPM · desfase ${sync.beatOffset} ms. Puedes corregirlo manualmente.`);
    } catch (error) {
        if (currentTrack?.id !== track.id) return;
        updateSyncStatus(`No se pudo analizar este audio: ${error.message} Puedes usar MARCAR TEMPO o ajustar los BPM.`);
    }
}

async function estimateAudioSync(audioUrl) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('este navegador no permite analizar audio');
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`el audio respondió ${response.status}`);
    const audioData = await response.arrayBuffer();
    const analysisContext = new AudioContextClass();
    let audioBuffer;
    try {
        audioBuffer = await analysisContext.decodeAudioData(audioData);
    } finally {
        await analysisContext.close();
    }

    const sampleRate = audioBuffer.sampleRate;
    const hopSize = Math.max(1, Math.round(sampleRate * 0.01));
    const sampleCount = Math.min(audioBuffer.length, sampleRate * 90);
    const frameCount = Math.floor(sampleCount / hopSize);
    if (frameCount < 800) throw new Error('la canción es demasiado corta para estimar el tempo');

    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) => audioBuffer.getChannelData(channel));
    const energy = new Float32Array(frameCount);
    for (let frame = 0; frame < frameCount; frame++) {
        const start = frame * hopSize;
        const end = Math.min(sampleCount, start + hopSize);
        let sum = 0;
        let samples = 0;
        for (let index = start; index < end; index++) {
            for (const channel of channels) {
                const sample = channel[index];
                sum += sample * sample;
                samples++;
            }
        }
        energy[frame] = Math.sqrt(sum / Math.max(1, samples));
    }

    const onset = new Float32Array(frameCount);
    let onsetTotal = 0;
    for (let frame = 4; frame < frameCount; frame++) {
        const baseline = (energy[frame - 1] + energy[frame - 2] + energy[frame - 3] + energy[frame - 4]) / 4;
        const strength = Math.max(0, energy[frame] - baseline);
        onset[frame] = strength;
        onsetTotal += strength;
    }
    if (onsetTotal < 0.001) throw new Error('no se detectaron pulsos claros en el audio');
    const onsetAverage = onsetTotal / frameCount;
    let onsetEnergy = 0;
    for (let frame = 0; frame < frameCount; frame++) {
        onset[frame] = Math.max(0, onset[frame] - onsetAverage * 0.35);
        onsetEnergy += onset[frame] * onset[frame];
    }
    if (onsetEnergy < 1e-8) throw new Error('no se detectaron pulsos claros en el audio');

    const correlationCache = new Map();
    const correlation = (lag) => {
        const roundedLag = Math.round(lag);
        if (roundedLag < 1) return 0;
        if (correlationCache.has(roundedLag)) return correlationCache.get(roundedLag);
        let product = 0;
        let leftEnergy = 0;
        let rightEnergy = 0;
        for (let frame = roundedLag; frame < frameCount; frame++) {
            const left = onset[frame];
            const right = onset[frame - roundedLag];
            product += left * right;
            leftEnergy += left * left;
            rightEnergy += right * right;
        }
        const value = product / Math.sqrt(Math.max(1e-12, leftEnergy * rightEnergy));
        correlationCache.set(roundedLag, value);
        return value;
    };

    let bestLag = 0;
    let bestScore = -Infinity;
    const minLag = Math.floor(60 / (200 * 0.01));
    const maxLag = Math.ceil(60 / (60 * 0.01));
    for (let lag = minLag; lag <= maxLag; lag++) {
        const score = correlation(lag) + correlation(lag * 2) * 0.5 + correlation(lag * 3) * 0.25 - correlation(lag / 2) * 0.2;
        if (score > bestScore) {
            bestScore = score;
            bestLag = lag;
        }
    }
    if (!bestLag) throw new Error('no se pudo estimar el tempo');

    const beatLength = bestLag * hopSize / sampleRate;
    const phaseBins = 48;
    const phaseEnergy = new Float32Array(phaseBins);
    for (let frame = 0; frame < frameCount; frame++) {
        const phase = frame % bestLag;
        const bin = Math.min(phaseBins - 1, Math.floor(phase / bestLag * phaseBins));
        phaseEnergy[bin] += onset[frame];
    }
    let bestPhaseBin = 0;
    for (let bin = 1; bin < phaseBins; bin++) {
        if (phaseEnergy[bin] > phaseEnergy[bestPhaseBin]) bestPhaseBin = bin;
    }
    const strongestPhase = bestPhaseBin / phaseBins * beatLength;
    const beatOffset = Math.round(strongestPhase * 1000);
    const bpm = Math.max(60, Math.min(200, Math.round(60 / beatLength)));
    return { bpm, beatOffset };
}

function applyNoteAppearance() {
    const skin = noteSkins[settings.noteSkin] ? settings.noteSkin : 'prism';
    const shapes = ['pill', 'diamond', 'circle', 'bar'];
    settings.noteSkin = skin;
    settings.noteShape = shapes.includes(settings.noteShape) ? settings.noteShape : 'pill';
    settings.noteSize = Number.isFinite(settings.noteSize) ? Math.min(140, Math.max(70, settings.noteSize)) : 100;
    laneColors = noteSkins[skin].lanes;
    laneLabels.forEach((label, lane) => label.style.setProperty('--lane-color', laneColors[lane]));
    document.documentElement.dataset.noteSkin = skin;
    document.documentElement.dataset.noteShape = settings.noteShape;
    document.documentElement.style.setProperty('--note-primary', noteSkins[skin].primary);
    document.documentElement.style.setProperty('--note-secondary', noteSkins[skin].secondary);
    $('#noteSkinPreview').dataset.skin = skin;
}

function updateNoteAppearanceFromControls() {
    settings.noteSkin = $('#noteSkinSetting').value;
    settings.noteShape = $('#noteShapeSetting').value;
    settings.noteSize = Number($('#noteSizeSetting').value);
    $('#noteSizeValue').textContent = `${settings.noteSize}%`;
    applyNoteAppearance();
    if (currentTrack) drawGame();
}

function saveSettings() {
    settings.volume = Number($('#volumeSetting').value);
    settings.speed = Number($('#speedSetting').value);
    settings.background = $('#backgroundSetting').value;
    settings.offset = Number($('#offsetSetting').value);
    settings.autoSync = $('#autoSyncSetting').checked;
    updateNoteAppearanceFromControls();
    youtubeApiKey = $('#youtubeApiKey').value.trim();
    if (youtubeApiKey) {
        localStorage.setItem('ritmo-youtube-api-key', youtubeApiKey);
        sessionStorage.setItem('ritmo-youtube-api-key', youtubeApiKey);
    } else {
        localStorage.removeItem('ritmo-youtube-api-key');
        sessionStorage.removeItem('ritmo-youtube-api-key');
    }
    localStorage.setItem('ritmo-volume', String(settings.volume));
    localStorage.setItem('ritmo-speed', String(settings.speed));
    localStorage.setItem('ritmo-background', settings.background);
    localStorage.setItem('ritmo-offset', String(settings.offset));
    localStorage.setItem('ritmo-auto-sync', String(settings.autoSync));
    localStorage.setItem('ritmo-note-skin', settings.noteSkin);
    localStorage.setItem('ritmo-note-shape', settings.noteShape);
    localStorage.setItem('ritmo-note-size', String(settings.noteSize));
    if (masterGain && audioContext) masterGain.gain.setTargetAtTime(settings.volume / 100 * 0.26, audioContext.currentTime, 0.03);
    if (remoteAudio) remoteAudio.volume = settings.volume / 100;
    if (youtubePlayer && youtubeIsReady) youtubePlayer.setVolume(settings.volume);
    $('#settingsModal').hidden = true;
    updateGameBackdrop();
    drawGame();
    renderTracks();
}

document.addEventListener('click', (event) => {
    const playButton = event.target.closest('[data-play]');
    const favoriteButton = event.target.closest('[data-favorite]');
    if (playButton) openGame(playButton.dataset.play);
    if (favoriteButton) toggleFavorite(favoriteButton.dataset.favorite);
});

document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
});

document.querySelectorAll('.filter-chip').forEach((button) => {
    button.addEventListener('click', () => {
        selectedGenre = button.dataset.filter;
        document.querySelectorAll('.filter-chip').forEach((chip) => chip.classList.toggle('selected', chip === button));
        renderTracks();
    });
});

searchInput.addEventListener('input', renderTracks);
$('#browseButton').addEventListener('click', () => switchView('discover'));
$('#settingsOpen').addEventListener('click', openSettings);
$('#topSettings').addEventListener('click', openSettings);
$('#gameSettings').addEventListener('click', openSettings);
$('#configureYoutubeSearch').addEventListener('click', openSettings);
$('#settingsClose').addEventListener('click', () => { $('#settingsModal').hidden = true; });
$('#settingsDone').addEventListener('click', saveSettings);
$('#volumeSetting').addEventListener('input', (event) => { $('#volumeValue').textContent = `${event.target.value}%`; });
$('#offsetSetting').addEventListener('input', (event) => { $('#offsetValue').textContent = `${event.target.value} ms`; });
$('#backgroundSetting').addEventListener('change', () => {
    settings.background = $('#backgroundSetting').value;
    updateGameBackdrop();
    drawGame();
});
$('#autoSyncSetting').addEventListener('change', (event) => {
    settings.autoSync = event.target.checked;
    localStorage.setItem('ritmo-auto-sync', String(settings.autoSync));
    updateSyncStatus();
    if (settings.autoSync && currentTrack?.audioUrl) autoSyncTrack(currentTrack);
});
['noteSkinSetting', 'noteShapeSetting', 'noteSizeSetting'].forEach((id) => {
    $(`#${id}`).addEventListener('input', updateNoteAppearanceFromControls);
    $(`#${id}`).addEventListener('change', () => {
        localStorage.setItem('ritmo-note-skin', settings.noteSkin);
        localStorage.setItem('ritmo-note-shape', settings.noteShape);
        localStorage.setItem('ritmo-note-size', String(settings.noteSize));
    });
});
applyNoteAppearance();
$('#bpmSetting').addEventListener('input', (event) => {
    if (!currentTrack) return;
    currentTrack.bpm = Number(event.target.value);
    $('#bpmValue').textContent = `${currentTrack.bpm} BPM`;
    $('#gameBpm').textContent = `${currentTrack.bpm} BPM${currentTrack.source === 'archive' ? ' · estimado' : ''}`;
    saveTrackCalibration();
});
$('#tapTempo').addEventListener('click', tapTempo);
$('#beatOffsetSetting').addEventListener('input', (event) => {
    if (!currentTrack) return;
    currentTrack.beatOffset = Number(event.target.value);
    $('#beatOffsetValue').textContent = `${currentTrack.beatOffset} ms`;
    saveTrackCalibration();
});
$('#youtubeApiKey').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveSettings();
});
$('#startGame').addEventListener('click', beginGame);
$('#chooseAnotherVideo').addEventListener('click', () => $('#exitGame').click());
$('#previewTrack').addEventListener('click', () => {
    if (!currentTrack || (currentTrack.source !== 'youtube' && !currentTrack.audioUrl) || youtubePlaybackFailed) return;
    if (isPreviewing) {
        isPreviewing = false;
        if (currentTrack.source === 'youtube') youtubePlayer.pauseVideo();
        else if (remoteAudio) remoteAudio.pause();
        $('#previewTrack').textContent = '▶ Reanudar vista previa';
        $('#youtubePlayerStatus').textContent = 'Vista previa pausada. Reanúdala para seguir calibrando.';
        return;
    }
    isPreviewing = true;
    if (currentTrack.source === 'youtube') {
        if (!youtubePlayer || !youtubeIsReady) {
            isPreviewing = false;
            return;
        }
        youtubePlayer.playVideo();
    } else {
        if (!remoteAudio || remoteAudio.src !== currentTrack.audioUrl) {
            remoteAudio = new Audio(currentTrack.audioUrl);
            remoteAudio.addEventListener('ended', () => {
                isPreviewing = false;
                $('#previewTrack').textContent = '▶ Escuchar para calibrar';
                $('#youtubePlayerStatus').textContent = 'Vista previa terminada. Puedes iniciar la partida cuando quieras.';
            });
        }
        if (remoteAudio.ended) remoteAudio.currentTime = 0;
        remoteAudio.volume = settings.volume / 100;
        remoteAudio.play().catch((error) => {
            isPreviewing = false;
            $('#youtubePlayerStatus').textContent = `No se pudo reproducir el archivo: ${error.message}`;
        });
    }
    $('#youtubePlayerStatus').textContent = 'Iniciando vista previa…';
});
$('#uploadAudioButton').addEventListener('click', () => $('#localAudioInput').click());
$('#uploadFallback').addEventListener('click', () => $('#localAudioInput').click());
$('#localAudioInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        await openLocalAudio(file);
    } catch (error) {
        if (gameScreen.hidden) $('#searchStatus').textContent = error.message;
        else $('#youtubePlayerStatus').textContent = error.message;
    } finally {
        event.target.value = '';
    }
});
$('#pauseGame').addEventListener('click', togglePause);
$('#resumeGame').addEventListener('click', togglePause);
$('#retryGame').addEventListener('click', () => {
    $('#resultModal').hidden = true;
    resetGame();
    $('#startOverlay').hidden = false;
});
$('#playAgain').addEventListener('click', () => {
    $('#resultModal').hidden = true;
    beginGame();
});
$('#closeResult').addEventListener('click', () => { $('#resultModal').hidden = true; });
$('#exitGame').addEventListener('click', () => {
    isPreviewing = false;
    isPlaying = false;
    isPaused = false;
    stopGameAudio();
    gameScreen.hidden = true;
    document.documentElement.style.overflow = '';
    switchView('discover');
});

async function openLocalAudio(file) {
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name)) {
        throw new Error('Elige un archivo de audio compatible, como MP3, WAV, OGG o M4A.');
    }
    const objectUrl = URL.createObjectURL(file);
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = objectUrl;
    try {
        await new Promise((resolve, reject) => {
            probe.addEventListener('loadedmetadata', resolve, { once: true });
            probe.addEventListener('error', () => reject(new Error('No se pudo leer ese archivo de audio. Prueba con otro formato.')), { once: true });
            probe.load();
        });
        if (!Number.isFinite(probe.duration) || probe.duration <= 0) {
            throw new Error('No se pudo determinar la duración del audio.');
        }
        if (localAudioObjectUrl) URL.revokeObjectURL(localAudioObjectUrl);
        localAudioObjectUrl = objectUrl;
        const track = {
            id: `local:${Date.now()}`,
            title: file.name.replace(/\.[^.]+$/, ''),
            artist: 'Archivo de este dispositivo',
            genre: 'Mi música',
            bpm: 120,
            duration: probe.duration,
            accent: '#a68aff',
            cover: 'linear-gradient(135deg,#49376c,#171523 76%)',
            source: 'local',
            audioUrl: objectUrl,
            beatOffset: 0
        };
        remoteTracks.set(track.id, track);
        openGame(track.id);
        if (settings.autoSync) autoSyncTrack(track);
    } catch (error) {
        URL.revokeObjectURL(objectUrl);
        throw error;
    } finally {
        probe.removeAttribute('src');
        probe.load();
    }
}

document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !gameScreen.hidden && !$('#settingsModal').hidden) return;
    if (event.key === '/' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        if (gameScreen.hidden) searchInput.focus();
        return;
    }
    if (event.key === 'Escape') {
        $('#settingsModal').hidden = true;
        if (!$('#resultModal').hidden) $('#resultModal').hidden = true;
        return;
    }
    if (!gameScreen.hidden && event.code === 'Space') {
        event.preventDefault();
        if ($('#resultModal').hidden) togglePause();
        return;
    }
    if (gameScreen.hidden || event.repeat || !isPlaying) return;
    const lane = 'dfjk'.indexOf(event.key.toLowerCase());
    if (lane !== -1) {
        keyboardLanes.add(lane);
        activeLanes.add(lane);
        laneLabels[lane].classList.add('is-active');
        tryHit(lane);
    }
});

document.addEventListener('keyup', (event) => {
    const lane = 'dfjk'.indexOf(event.key.toLowerCase());
    if (lane !== -1) {
        keyboardLanes.delete(lane);
        if (!isPointerLaneHeld(lane)) {
            activeLanes.delete(lane);
            laneLabels[lane].classList.remove('is-active');
        }
    }
});

canvas.addEventListener('pointerdown', (event) => {
    if (!isPlaying) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const lane = Math.min(3, Math.max(0, Math.floor((event.clientX - bounds.left) / bounds.width * 4)));
    pointerLanes.set(event.pointerId, lane);
    activeLanes.add(lane);
    laneLabels[lane].classList.add('is-active');
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    tryHit(lane);
});

function releasePointerLane(event) {
    const lane = pointerLanes.get(event.pointerId);
    if (lane === undefined) return;
    pointerLanes.delete(event.pointerId);
    if (keyboardLanes.has(lane) || isPointerLaneHeld(lane)) return;
    activeLanes.delete(lane);
    laneLabels[lane].classList.remove('is-active');
}

function isPointerLaneHeld(lane) {
    for (const activeLane of pointerLanes.values()) {
        if (activeLane === lane) return true;
    }
    return false;
}

canvas.addEventListener('pointerup', releasePointerLane);
canvas.addEventListener('pointercancel', releasePointerLane);

window.addEventListener('resize', () => {
    if (!gameScreen.hidden && currentTrack) {
        updateCanvasSize();
        drawGame();
    }
});

renderAll();
window.addEventListener('beforeunload', () => {
    if (localAudioObjectUrl) URL.revokeObjectURL(localAudioObjectUrl);
});
