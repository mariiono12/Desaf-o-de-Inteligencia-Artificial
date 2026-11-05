const tracks = [
    { id: 'neon-pulse', title: 'Neon Pulse', artist: 'Ritmo Originals', genre: 'Electrónica', bpm: 124, duration: 31, accent: '#c4a0ff', cover: 'linear-gradient(135deg,#472d6d,#171523 75%)', root: 55, scale: [0, 3, 5, 7, 10], style: 'electronic' },
    { id: 'sunset-drive', title: 'Sunset Drive', artist: 'Ritmo Originals', genre: 'Chill', bpm: 96, duration: 40, accent: '#ffb280', cover: 'linear-gradient(135deg,#763f50,#201827 76%)', root: 49, scale: [0, 3, 5, 7, 10], style: 'chill' },
    { id: 'pixel-run', title: 'Pixel Run', artist: 'Ritmo Originals', genre: 'Arcade', bpm: 140, duration: 27, accent: '#83e7dc', cover: 'linear-gradient(135deg,#1d6c75,#162027 76%)', root: 57, scale: [0, 2, 4, 7, 9], style: 'arcade' },
    { id: 'velvet-sky', title: 'Velvet Sky', artist: 'Ritmo Originals', genre: 'Chill', bpm: 88, duration: 44, accent: '#ed99cf', cover: 'linear-gradient(135deg,#713c70,#211827 76%)', root: 52, scale: [0, 2, 5, 7, 9], style: 'chill' },
    { id: 'afterglow', title: 'Afterglow', artist: 'Ritmo Originals', genre: 'Electrónica', bpm: 116, duration: 33, accent: '#f1df72', cover: 'linear-gradient(135deg,#71612a,#242016 76%)', root: 50, scale: [0, 2, 5, 7, 9], style: 'electronic' },
    { id: 'star-circuit', title: 'Star Circuit', artist: 'Ritmo Originals', genre: 'Arcade', bpm: 132, duration: 29, accent: '#ff83aa', cover: 'linear-gradient(135deg,#772f60,#241522 76%)', root: 55, scale: [0, 2, 4, 7, 11], style: 'arcade' }
];
const remoteTracks = new Map();
let savedRemoteTracks = JSON.parse(localStorage.getItem('ritmo-remote-favorites') || '[]');

const $ = (selector) => document.querySelector(selector);
const trackGrid = $('#trackGrid');
const searchInput = $('#searchInput');
const canvas = $('#rhythmCanvas');
const ctx = canvas.getContext('2d');
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
let startAt = 0;
let schedulerId = null;
let animationId = null;
let nextBeat = 0;
let score = 0;
let combo = 0;
let hits = 0;
let successfulHits = 0;
let missedBeats = new Set();
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
let youtubeApiKey = sessionStorage.getItem('ritmo-youtube-api-key') || '';
let settings = {
    volume: Number(localStorage.getItem('ritmo-volume') || 65),
    speed: Number(localStorage.getItem('ritmo-speed') || 1),
    offset: Number(localStorage.getItem('ritmo-offset') || 0)
};

function renderTracks() {
    const rawQuery = searchInput.value.trim();
    const query = rawQuery.toLocaleLowerCase('es');
    $('#catalogTitle').textContent = query ? `Resultados para “${rawQuery}”` : 'Busca una canción';
    const matching = tracks.filter((track) => {
        const matchesQuery = `${track.title} ${track.artist} ${track.genre}`.toLocaleLowerCase('es').includes(query);
        return matchesQuery && (selectedGenre === 'Todos' || track.genre === selectedGenre);
    });
    trackGrid.innerHTML = matching.map((track) => createTrackCard(track)).join('');
    $('#emptyState').hidden = query.length < 2 || matching.length > 0;
    $('#searchStatus').textContent = !query
        ? (youtubeApiKey ? 'Busca cualquier canción o artista disponible en YouTube.' : 'Configura una API key de YouTube en Ajustes para buscar canciones y artistas.')
        : query.length < 2
            ? 'Escribe al menos 2 caracteres para buscar.'
            : youtubeApiKey ? 'Buscando en YouTube...' : 'Configura tu API key de YouTube en Ajustes para buscar este artista.';
    if (query.length >= 2) {
        clearTimeout(searchTimer);
        if (searchController) searchController.abort();
        searchTimer = setTimeout(() => searchOpenMusic(rawQuery), 450);
    } else if (searchController) {
        searchController.abort();
    }
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
    if (apiKey) {
        await searchYouTube(query, apiKey);
        return;
    }

    $('#searchStatus').textContent = 'Buscando en el catálogo abierto...';
    trackGrid.replaceChildren();
    $('#emptyState').hidden = true;
    try {
        const safeQuery = query.replace(/["\\]/g, '\\$&');
        const archiveQuery = `mediatype:audio AND identifier:jamendo-* AND licenseurl:*creativecommons.org* AND NOT licenseurl:*by-nc* AND NOT licenseurl:*by-nd* AND (title:"${safeQuery}" OR creator:"${safeQuery}")`;
        const params = new URLSearchParams({ q: archiveQuery, rows: '40', page: '1', output: 'json' });
        ['identifier', 'title', 'creator', 'licenseurl'].forEach((field) => params.append('fl[]', field));
        const response = await fetch(`https://archive.org/advancedsearch.php?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`La búsqueda respondió ${response.status}`);
        const data = await response.json();
        const documents = (data.response?.docs || [])
            .filter((doc) => isPlayableLicense(doc.licenseurl))
            .slice(0, 12);
        const results = await Promise.all(documents.map((doc) => loadArchiveTrack(doc, controller.signal)));
        if (controller.signal.aborted || query !== searchInput.value.trim()) return;
        const playable = results.filter(Boolean);
        playable.forEach((track) => remoteTracks.set(track.id, track));
        trackGrid.replaceChildren(...playable.map(createRemoteCard));
        $('#emptyState').hidden = playable.length > 0;
        $('#searchStatus').textContent = playable.length
            ? `${playable.length} canciones con licencia abierta`
            : 'No encontramos este artista en el catálogo abierto. Configura una API key de YouTube en Ajustes.';
    } catch (error) {
        if (error.name === 'AbortError') return;
        $('#searchStatus').textContent = 'No se pudo conectar al catálogo. Revisa tu conexión e inténtalo de nuevo.';
        $('#emptyState').hidden = false;
    }
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
            videoEmbeddable: 'true',
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
            ? `${results.length} videos reproducibles · YouTube. El tempo se ajusta al iniciar.`
            : 'No encontramos videos que permitan reproducción incrustada. Prueba otra búsqueda.';
    } catch (error) {
        if (error.name === 'AbortError') return;
        const details = error.message.toLowerCase();
        if (details.includes('quota') || details.includes('quotaexceeded')) {
            $('#searchStatus').textContent = 'Se agotó la cuota diaria de búsquedas de esta API key.';
        } else if (details.includes('referer') || details.includes('referrer') || details.includes('key') || details.includes('credential')) {
            $('#searchStatus').textContent = 'La API key no es válida o bloquea este sitio. Revisa la clave y la restricción HTTP referrer en Ajustes.';
        } else {
            $('#searchStatus').textContent = `No se pudo buscar en YouTube: ${error.message}`;
        }
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
                    $('#youtubePlayerStatus').textContent = 'Usa el reproductor de YouTube. El tempo del juego es ajustable.';
                    resolve(event.target);
                },
                onStateChange: handleYouTubePlayerState,
                onError: (event) => {
                    youtubeStartPending = false;
                    $('#startGame').disabled = false;
                    const message = event.data === 101 || event.data === 150
                        ? 'Este video no permite reproducción incrustada. Elige otro resultado o ábrelo en YouTube.'
                        : event.data === 153
                            ? 'YouTube requiere que abras el juego desde localhost o una web (no desde file://).'
                            : `YouTube no pudo reproducir este video (código ${event.data}).`;
                    $('#youtubePlayerStatus').textContent = message;
                    if (currentTrack?.source === 'youtube') {
                        $('#startOverlay').querySelector('h2').textContent = 'No se puede reproducir este video';
                        $('#startOverlay').querySelector('p').textContent = message;
                    }
                }
            }
        });
    });
    return youtubePlayerReady;
}

function handleYouTubePlayerState(event) {
    const state = window.YT.PlayerState;
    if (event.data === state.PLAYING) {
        $('#youtubePlayerStatus').textContent = 'Video de YouTube en reproducción · ajusta el BPM para sincronizar las notas.';
        if (youtubeStartPending && currentTrack?.source === 'youtube') {
            youtubeStartPending = false;
            startAt = 0;
            currentTrack.duration = Math.min(youtubePlayer.getDuration() || currentTrack.duration, 300);
            isPlaying = true;
            isPaused = false;
            $('#startOverlay').hidden = true;
            $('#startGame').disabled = false;
            $('#pauseOverlay').hidden = true;
            $('#pauseGame').textContent = 'Ⅱ';
            animationId = requestAnimationFrame(gameFrame);
        } else if (isPaused && currentTrack?.source === 'youtube') {
            isPaused = false;
            isPlaying = true;
            $('#pauseOverlay').hidden = true;
            $('#pauseGame').textContent = 'Ⅱ';
            animationId = requestAnimationFrame(gameFrame);
        }
    } else if (event.data === state.PAUSED && isPlaying && currentTrack?.source === 'youtube') {
        isPlaying = false;
        isPaused = true;
        if (animationId) cancelAnimationFrame(animationId);
        $('#pauseOverlay').hidden = false;
        $('#pauseGame').textContent = '▶';
    } else if (event.data === state.ENDED && isPlaying && currentTrack?.source === 'youtube') {
        finishGame();
    }
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
    if ((currentTrack.source === 'archive' || currentTrack.source === 'youtube') && !remoteTracks.has(trackId)) {
        remoteTracks.set(trackId, currentTrack);
    }
    discoverView.hidden = true;
    libraryView.hidden = true;
    gameScreen.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    $('#gameTitle').textContent = currentTrack.title;
    $('#gameArtist').textContent = currentTrack.artist;
    $('#gameBpm').textContent = `${currentTrack.bpm} BPM${currentTrack.source === 'archive' ? ' · estimado' : ''}`;
    $('#bpmSetting').value = currentTrack.bpm;
    $('#bpmValue').textContent = `${currentTrack.bpm} BPM`;
    $('#gameCover').style.setProperty('--cover-bg', currentTrack.cover);
    $('#gameCover').style.setProperty('--accent', currentTrack.accent);
    $('#startOverlay').hidden = false;
    $('#pauseOverlay').hidden = true;
    $('#resultModal').hidden = true;
    $('#pauseGame').textContent = 'Ⅱ';
    resetGame();
    if (currentTrack.source === 'youtube') {
        $('#startGame').disabled = false;
        const videoLink = $('#openYoutubeVideo');
        videoLink.href = currentTrack.sourceUrl;
        videoLink.hidden = false;
        $('#youtubePlayerStatus').textContent = 'Cargando el reproductor oficial de YouTube...';
        ensureYouTubePlayer(currentTrack.videoId).catch((error) => {
            $('#youtubePlayerStatus').textContent = error.message;
            $('#startOverlay').querySelector('p').textContent = error.message;
        });
    } else {
        $('#openYoutubeVideo').hidden = true;
        $('#youtubePlayerStatus').textContent = 'El video aparecerá aquí al elegir una canción de YouTube.';
    }
}

function resetGame() {
    stopGameAudio();
    score = 0;
    combo = 0;
    hits = 0;
    successfulHits = 0;
    missedBeats = new Set();
    isPlaying = false;
    isPaused = false;
    updateScore();
    $('#progressBar').style.width = '0%';
    $('#timeLabel').textContent = '0:00';
    $('#rankText').textContent = '¡A romperla!';
    $('#rankDescription').textContent = 'Cada nota cuenta. Encuentra tu ritmo.';
    $('#startOverlay').querySelector('p').innerHTML = 'Usa las teclas <b>D</b> <b>F</b> <b>J</b> <b>K</b> cuando las notas lleguen a la línea.';
    $('#startGame').disabled = false;
    drawGame();
}

function stopGameAudio() {
    youtubeStartPending = false;
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
    resetGame();
    if (currentTrack.source === 'youtube') {
        try {
            $('#startGame').disabled = true;
            await ensureYouTubePlayer(currentTrack.videoId);
            youtubeStartPending = true;
            $('#youtubePlayerStatus').textContent = 'Reproduce el video y sigue las notas. Si es necesario, ajusta el BPM.';
            $('#startOverlay').querySelector('h2').textContent = 'Preparando video...';
            $('#startOverlay').querySelector('p').textContent = 'Esperando a que YouTube inicie la reproducción.';
            youtubePlayer.seekTo(0, true);
            youtubePlayer.playVideo();
        } catch (error) {
            $('#startGame').disabled = false;
            $('#startOverlay').querySelector('h2').textContent = 'No se pudo cargar YouTube';
            $('#startOverlay').querySelector('p').textContent = error.message;
        }
        return;
    }
    if (!audioSupported) {
        $('#startOverlay').querySelector('p').textContent = 'Este navegador no permite generar audio. Prueba con una versión reciente de Chrome, Edge o Firefox.';
        return;
    }
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContextClass();
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
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
    const bufferSize = Math.floor(audioContext.sampleRate * 0.13);
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    noise.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = style === 'chill' ? 900 : 1450;
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    noise.connect(filter).connect(gain).connect(masterGain);
    noise.start(time);
    noise.stop(time + 0.14);
}

function playHat(time, style, volume) {
    const bufferSize = Math.floor(audioContext.sampleRate * 0.045);
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    noise.buffer = buffer;
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
    const pattern = [0, 2, 1, 3, 2, 0, 3, 1, 0, 3, 2, 1, 3, 0, 1, 2];
    return pattern[(beat + Math.floor(beat / 4)) % pattern.length];
}

function gameFrame() {
    if (!isPlaying || !currentTrack) return;
    const elapsed = currentTrack.source === 'youtube'
        ? youtubePlayer.getCurrentTime()
        : currentTrack.audioUrl && remoteAudio
            ? remoteAudio.currentTime
            : Math.max(0, audioContext.currentTime - startAt);
    const beatLength = 60 / currentTrack.bpm;
    const totalBeats = getTotalBeats();
    const duration = currentTrack.source === 'youtube' ? youtubePlayer.getDuration() || currentTrack.duration
        : currentTrack.audioUrl ? currentTrack.duration : beatLength * totalBeats;
    const adjustedTime = currentTrack.source === 'youtube'
        ? youtubePlayer.getCurrentTime() + settings.offset / 1000
        : currentTrack.audioUrl
        ? startAt + remoteAudio.currentTime + settings.offset / 1000
        : audioContext.currentTime + settings.offset / 1000;
    updateGame(elapsed, duration, adjustedTime);
    drawGame();
    if (elapsed >= duration || (currentTrack.audioUrl && remoteAudio.ended)) {
        finishGame();
        return;
    }
    animationId = requestAnimationFrame(gameFrame);
}

function updateGame(elapsed, duration, adjustedTime) {
    const beatLength = 60 / currentTrack.bpm;
    for (let beat = 0; beat < getTotalBeats(); beat++) {
        const target = startAt + beat * beatLength;
        if (!missedBeats.has(beat) && adjustedTime > target + 0.19) {
            missedBeats.add(beat);
            hits++;
            combo = 0;
            showRating('MISS', '#ff7899');
            updateScore();
        }
    }
    const progress = Math.min(100, (elapsed / duration) * 100);
    $('#progressBar').style.width = `${progress}%`;
    $('#timeLabel').textContent = formatTime(elapsed);
}

function getTotalBeats() {
    return currentTrack ? Math.ceil(currentTrack.duration * currentTrack.bpm / 60) : 64;
}

function drawGame() {
    const width = canvas.clientWidth || 520;
    const height = canvas.clientHeight || 600;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!currentTrack) return;
    const laneWidth = width / 4;
    const hitY = height * 0.9;
    const leadTime = 1.65 / settings.speed;
    const beatLength = 60 / currentTrack.bpm;
    const chartTime = currentTrack.source === 'youtube' && youtubePlayer
        ? youtubePlayer.getCurrentTime()
        : currentTrack.audioUrl && remoteAudio
            ? startAt + remoteAudio.currentTime
            : audioContext ? audioContext.currentTime : startAt;
    for (let lane = 0; lane < 4; lane++) {
        const laneColors = ['#c19aff', '#7fe4d2', '#ffd77d', '#ff8dbd'];
        const x = lane * laneWidth;
        ctx.fillStyle = lane % 2 === 0 ? '#ffffff04' : '#00000009';
        ctx.fillRect(x, 0, laneWidth, height);
        ctx.strokeStyle = '#ffffff10';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        if (activeLanes.has(lane)) {
            ctx.fillStyle = `${laneColors[lane]}20`;
            ctx.fillRect(x + 2, hitY - 22, laneWidth - 4, 48);
        }
    }
    for (let beat = 0; beat < getTotalBeats(); beat++) {
        if (missedBeats.has(beat)) continue;
        const targetTime = startAt + beat * beatLength;
        const timeRemaining = targetTime - chartTime;
        if (timeRemaining > leadTime || timeRemaining < -0.2) continue;
        const lane = getLane(beat);
        const noteY = hitY - (timeRemaining / leadTime) * (hitY - 4);
        const noteX = lane * laneWidth + 8;
        const noteW = laneWidth - 16;
        const colors = ['#c19aff', '#7fe4d2', '#ffd77d', '#ff8dbd'];
        ctx.shadowBlur = 16;
        ctx.shadowColor = colors[lane];
        ctx.fillStyle = colors[lane];
        roundedRect(ctx, noteX, noteY - 9, noteW, 18, 7);
        ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = '#d3ff6b';
    ctx.globalAlpha = 0.75;
    ctx.shadowColor = '#d3ff6b';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hitY);
    ctx.lineTo(width, hitY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    const labels = ['D', 'F', 'J', 'K'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px "Space Grotesk", sans-serif';
    labels.forEach((label, index) => {
        ctx.fillStyle = activeLanes.has(index) ? '#d3ff6b' : '#f5f0ff';
        ctx.fillText(label, laneWidth * (index + 0.5), height * 0.95);
    });
}

function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
}

function tryHit(lane) {
    if (!isPlaying || !audioContext || !currentTrack) return;
    const now = currentTrack.source === 'youtube' && youtubePlayer
        ? youtubePlayer.getCurrentTime() + settings.offset / 1000
        : currentTrack.audioUrl && remoteAudio
            ? startAt + remoteAudio.currentTime + settings.offset / 1000
        : audioContext.currentTime + settings.offset / 1000;
    const beatLength = 60 / currentTrack.bpm;
    let bestBeat = -1;
    let bestDistance = Infinity;
    for (let beat = 0; beat < getTotalBeats(); beat++) {
        if (missedBeats.has(beat) || getLane(beat) !== lane) continue;
        const distance = Math.abs(startAt + beat * beatLength - now);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestBeat = beat;
        }
    }
    if (bestBeat < 0 || bestDistance > 0.19) return;
    missedBeats.add(bestBeat);
    hits++;
    successfulHits++;
    combo++;
    if (bestDistance <= 0.065) {
        score += 100 * Math.min(combo, 10);
        showRating('PERFECT', '#d3ff6b');
    } else {
        score += 55 * Math.min(combo, 10);
        showRating('GREAT', '#c4a0ff');
    }
    updateScore();
}

function updateScore() {
    $('#scoreText').textContent = String(score).padStart(6, '0');
    $('#comboText').textContent = combo;
    const accuracy = hits ? Math.round(successfulHits / hits * 100) : 100;
    $('#accText').innerHTML = `${accuracy}<small>%</small>`;
    const personalBest = currentTrack ? Number(localStorage.getItem(`ritmo-best-${currentTrack.id}`) || 0) : 0;
    $('#bestText').textContent = String(personalBest).padStart(6, '0');
    if (combo >= 10) {
        $('#rankText').textContent = `${combo} notas seguidas`;
        $('#rankDescription').textContent = '¡Tu racha está que arde!';
    }
}

function showRating(text, color) {
    const rating = $('#hitRating');
    rating.textContent = text;
    rating.style.color = color;
    rating.animate([{ opacity: 1, transform: 'translate(-50%, 0) scale(1.08)' }, { opacity: 0, transform: 'translate(-50%, -13px) scale(1)' }], { duration: 430, easing: 'ease-out' });
}

function finishGame() {
    isPlaying = false;
    stopGameAudio();
    const bestKey = `ritmo-best-${currentTrack.id}`;
    const best = Number(localStorage.getItem(bestKey) || 0);
    if (score > best) localStorage.setItem(bestKey, String(score));
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
    $('#offsetSetting').value = settings.offset;
    $('#offsetValue').textContent = `${settings.offset} ms`;
    $('#youtubeApiKey').value = youtubeApiKey;
    $('#settingsModal').hidden = false;
}

function saveSettings() {
    settings.volume = Number($('#volumeSetting').value);
    settings.speed = Number($('#speedSetting').value);
    settings.offset = Number($('#offsetSetting').value);
    youtubeApiKey = $('#youtubeApiKey').value.trim();
    if (youtubeApiKey) sessionStorage.setItem('ritmo-youtube-api-key', youtubeApiKey);
    else sessionStorage.removeItem('ritmo-youtube-api-key');
    localStorage.setItem('ritmo-volume', String(settings.volume));
    localStorage.setItem('ritmo-speed', String(settings.speed));
    localStorage.setItem('ritmo-offset', String(settings.offset));
    if (masterGain && audioContext) masterGain.gain.setTargetAtTime(settings.volume / 100 * 0.26, audioContext.currentTime, 0.03);
    if (remoteAudio) remoteAudio.volume = settings.volume / 100;
    if (youtubePlayer && youtubeIsReady) youtubePlayer.setVolume(settings.volume);
    $('#settingsModal').hidden = true;
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
$('#settingsClose').addEventListener('click', () => { $('#settingsModal').hidden = true; });
$('#settingsDone').addEventListener('click', saveSettings);
$('#volumeSetting').addEventListener('input', (event) => { $('#volumeValue').textContent = `${event.target.value}%`; });
$('#offsetSetting').addEventListener('input', (event) => { $('#offsetValue').textContent = `${event.target.value} ms`; });
$('#bpmSetting').addEventListener('input', (event) => {
    if (!currentTrack) return;
    currentTrack.bpm = Number(event.target.value);
    $('#bpmValue').textContent = `${currentTrack.bpm} BPM`;
    $('#gameBpm').textContent = `${currentTrack.bpm} BPM${currentTrack.source === 'archive' ? ' · estimado' : ''}`;
});
$('#youtubeApiKey').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveSettings();
});
$('#startGame').addEventListener('click', beginGame);
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
    isPlaying = false;
    isPaused = false;
    stopGameAudio();
    gameScreen.hidden = true;
    document.documentElement.style.overflow = '';
    switchView('discover');
});

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
    const lane = ['d', 'f', 'j', 'k'].indexOf(event.key.toLowerCase());
    if (lane !== -1) {
        activeLanes.add(lane);
        tryHit(lane);
    }
});

document.addEventListener('keyup', (event) => {
    const lane = ['d', 'f', 'j', 'k'].indexOf(event.key.toLowerCase());
    if (lane !== -1) activeLanes.delete(lane);
});

window.addEventListener('resize', () => {
    if (!gameScreen.hidden && currentTrack) drawGame();
});

renderAll();
