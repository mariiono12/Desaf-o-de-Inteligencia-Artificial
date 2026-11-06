const signals = [...document.querySelectorAll(".signal")];
const modeCards = [...document.querySelectorAll(".mode-card")];
const startButton = document.querySelector("#start-button");
const startButtonLabel = document.querySelector("#start-button-label");
const startOverlay = document.querySelector("#start-overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayDescription = document.querySelector("#overlay-description");
const statusMessage = document.querySelector("#game-status");
const statusIndicator = document.querySelector("#status-indicator");
const roundLabel = document.querySelector("#round-label");
const sequenceCount = document.querySelector("#sequence-count");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const scoreValue = document.querySelector("#score-value");
const bestValue = document.querySelector("#best-value");
const livesValue = document.querySelector("#lives-value");
const energyLabel = document.querySelector("#energy-label");
const modeBadge = document.querySelector("#mode-badge");
const modeDescription = document.querySelector("#mode-description");
const timerStat = document.querySelector("#timer-stat");
const timerValue = document.querySelector("#timer-value");
const gamesValue = document.querySelector("#games-value");
const streakRecordValue = document.querySelector("#streak-record-value");
const sprintBestValue = document.querySelector("#sprint-best-value");
const soundToggle = document.querySelector("#sound-toggle");
const soundLabel = document.querySelector("#sound-label");
const restartButton = document.querySelector("#restart-button");
const pauseButton = document.querySelector("#pause-button");
const echoButton = document.querySelector("#echo-button");
const echoLabel = document.querySelector("#echo-label");
const copyPromptButton = document.querySelector("#copy-prompt");
const toast = document.querySelector("#toast");
const promptText = document.querySelector("#prompt-text").textContent;

const STORAGE_KEY = "eco-estelar-estadisticas-v2";
const SPRINT_SECONDS = 60;
const SPRINT_PENALTY = 7;
const SPRINT_BONUS = 3;
const modes = {
  classic: {
    name: "CLÁSICO",
    lives: 3,
    echoes: 2,
    description: "Observa la secuencia de luces y repítela en el mismo orden. Cada ronda suma una señal. Un error cuesta una energía.",
  },
  sprint: {
    name: "SUPERNOVA",
    lives: Infinity,
    echoes: 1,
    description: "Tienes 60 segundos para llegar tan lejos como puedas. Cada ronda completada añade 3 segundos; un error te quita 7.",
  },
  zen: {
    name: "ÓRBITA ZEN",
    lives: Infinity,
    echoes: 3,
    description: "Explora sin límite de energías ni reloj. Si te equivocas, la secuencia volverá a sonar. Concéntrate en el ritmo.",
  },
};
const keySignals = { q: 0, w: 1, a: 2, s: 3 };
const frequencies = [392, 523.25, 659.25, 783.99];
const storage = loadStorage();
const state = {
  sequence: [],
  inputIndex: 0,
  score: 0,
  bestStreak: 0,
  streak: 0,
  lives: 3,
  round: 0,
  echoes: modes.classic.echoes,
  mode: "classic",
  phase: "ready",
  resumePhase: "input",
  soundEnabled: storage.soundEnabled,
  audioContext: null,
  timers: new Set(),
  countdown: null,
  secondsLeft: SPRINT_SECONDS,
  gamesRecorded: false,
};
let toastTimer;

function freshStorage() {
  return {
    soundEnabled: false,
    gamesPlayed: 0,
    bestStreak: 0,
    records: {
      classic: { best: 0 },
      sprint: { best: 0 },
      zen: { best: 0 },
    },
  };
}

function loadStorage() {
  const fallback = freshStorage();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return fallback;
    for (const mode of Object.keys(fallback.records)) {
      const best = Number(saved.records?.[mode]?.best);
      if (Number.isFinite(best) && best >= 0) fallback.records[mode].best = best;
    }
    fallback.soundEnabled = saved.soundEnabled === true;
    fallback.gamesPlayed = Number.isSafeInteger(saved.gamesPlayed) && saved.gamesPlayed > 0 ? saved.gamesPlayed : 0;
    fallback.bestStreak = Number.isSafeInteger(saved.bestStreak) && saved.bestStreak > 0 ? saved.bestStreak : 0;
    return fallback;
  } catch (error) {
    console.warn("No se pudieron leer los récords guardados.", error);
    return fallback;
  }
}

function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.warn("No se pudieron guardar los récords de la partida.", error);
    showToast("No se pudo guardar en este navegador.");
  }
}

function formatScore(score) {
  return String(score).padStart(5, "0");
}

function renderRecords() {
  bestValue.textContent = formatScore(storage.records[state.mode].best);
  sprintBestValue.textContent = formatScore(storage.records.sprint.best);
  gamesValue.textContent = String(storage.gamesPlayed);
  streakRecordValue.innerHTML = `${storage.bestStreak} <small>×</small>`;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2500);
}

function setStatus(message, mood = "idle") {
  statusMessage.textContent = message;
  statusIndicator.classList.toggle("is-active", mood === "active");
  statusIndicator.classList.toggle("is-warning", mood === "warning");
  statusIndicator.classList.toggle("is-paused", mood === "paused");
}

function setPhase(phase) {
  state.phase = phase;
  const canAnswer = phase === "input";
  const running = phase === "watching" || phase === "input";
  signals.forEach((signal) => { signal.disabled = !canAnswer; });
  modeCards.forEach((card) => { card.disabled = running || phase === "paused" || phase === "transition"; });
  pauseButton.disabled = !running && phase !== "paused";
  pauseButton.innerHTML = phase === "paused" ? '<span aria-hidden="true">▶</span> REANUDAR' : '<span aria-hidden="true">Ⅱ</span> PAUSAR';
  echoButton.disabled = phase !== "input" || state.echoes <= 0;
  echoLabel.textContent = `ECO · ${state.echoes}`;
  if (phase === "ready" || phase === "over") startOverlay.classList.remove("is-hidden");
  else startOverlay.classList.add("is-hidden");
  document.body.classList.toggle("is-paused", phase === "paused");
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    state.timers.delete(timer);
    callback();
  }, delay);
  state.timers.add(timer);
  return timer;
}

function clearTimers() {
  state.timers.forEach(window.clearTimeout);
  state.timers.clear();
  signals.forEach((signal) => signal.classList.remove("is-lit"));
}

function clearCountdown() {
  if (state.countdown !== null) {
    window.clearInterval(state.countdown);
    state.countdown = null;
  }
}

function playTone(signalIndex, duration = 250) {
  if (!state.soundEnabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    setStatus("Este navegador no admite sonido; puedes jugar igualmente.", "warning");
    return;
  }

  state.audioContext ??= new AudioContext();
  if (state.audioContext.state === "suspended") {
    state.audioContext.resume().catch((error) => console.warn("No se pudo activar el audio.", error));
  }

  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  oscillator.type = signalIndex % 2 === 0 ? "sine" : "triangle";
  oscillator.frequency.value = frequencies[signalIndex];
  gain.gain.setValueAtTime(0.0001, state.audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, state.audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, state.audioContext.currentTime + duration / 1000);
  oscillator.connect(gain);
  gain.connect(state.audioContext.destination);
  oscillator.start();
  oscillator.stop(state.audioContext.currentTime + duration / 1000);
}

function flashSignal(signalIndex, duration = 340) {
  const signal = signals[signalIndex];
  if (!signal) return;
  signal.classList.add("is-lit");
  playTone(signalIndex, duration);
  schedule(() => signal.classList.remove("is-lit"), duration);
}

function updateProgress() {
  const total = state.sequence.length;
  const current = state.phase === "input" ? state.inputIndex : 0;
  progressTrack.setAttribute("aria-valuemax", String(Math.max(total, 1)));
  progressTrack.setAttribute("aria-valuenow", String(current));
  progressFill.style.width = `${total ? (current / total) * 100 : 0}%`;
  sequenceCount.textContent = total ? `SECUENCIA ${String(current).padStart(2, "0")} / ${String(total).padStart(2, "0")}` : "SECUENCIA —";
}

function updateModeDisplay() {
  const mode = modes[state.mode];
  modeBadge.textContent = mode.name;
  modeDescription.textContent = mode.description;
  timerStat.hidden = state.mode !== "sprint";
  timerStat.classList.remove("is-urgent");
  if (state.mode === "sprint") {
    energyLabel.textContent = "BONUS";
    livesValue.textContent = `+${SPRINT_BONUS}s`;
    livesValue.setAttribute("aria-label", `Acierto: más ${SPRINT_BONUS} segundos`);
  } else if (state.mode === "zen") {
    energyLabel.textContent = "ENERGÍA";
    livesValue.textContent = "∞";
    livesValue.setAttribute("aria-label", "Energía ilimitada");
  } else {
    energyLabel.textContent = "ENERGÍA";
    updateLives();
  }
  timerValue.textContent = String(state.secondsLeft).padStart(2, "0");
  echoLabel.textContent = `ECO · ${state.echoes}`;
  renderRecords();
}

function updateLives() {
  if (state.mode === "classic") {
    livesValue.textContent = `${"✦ ".repeat(state.lives)}${"· ".repeat(3 - state.lives)}`.trim();
    livesValue.setAttribute("aria-label", `${state.lives} de 3 energías restantes`);
  }
}

function setMode(mode) {
  if (!modes[mode] || state.phase === "watching" || state.phase === "input" || state.phase === "paused" || state.phase === "transition") return;
  state.mode = mode;
  state.echoes = modes[mode].echoes;
  if (state.phase === "over") {
    state.sequence = [];
    state.score = 0;
    state.round = 0;
    state.streak = 0;
    state.lives = modes[mode].lives;
    state.secondsLeft = SPRINT_SECONDS;
    scoreValue.textContent = formatScore(0);
    roundLabel.textContent = "PREPARADA PARA DESPEGAR";
    overlayTitle.innerHTML = "La galaxia <span>te llama.</span>";
    overlayDescription.textContent = "Afina tu memoria. Cada señal que repitas hará brillar una estrella.";
    startButtonLabel.textContent = "INICIAR MISIÓN";
    updateProgress();
    setPhase("ready");
  }
  modeCards.forEach((card) => {
    const selected = card.dataset.mode === mode;
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
  updateModeDisplay();
  setStatus(`Ruta seleccionada: ${modes[mode].name}. Lista para despegar.`);
}

function startGame() {
  clearTimers();
  clearCountdown();
  state.sequence = [];
  state.inputIndex = 0;
  state.score = 0;
  state.bestStreak = 0;
  state.streak = 0;
  state.lives = modes[state.mode].lives;
  state.round = 0;
  state.echoes = modes[state.mode].echoes;
  state.secondsLeft = SPRINT_SECONDS;
  state.gamesRecorded = false;
  scoreValue.textContent = formatScore(0);
  roundLabel.textContent = "PREPARANDO SEÑAL";
  progressTrack.setAttribute("aria-valuenow", "0");
  progressFill.style.width = "0%";
  updateProgress();
  updateModeDisplay();
  startButtonLabel.textContent = "INICIAR MISIÓN";
  overlayTitle.innerHTML = "La galaxia <span>te llama.</span>";
  overlayDescription.textContent = "Afina tu memoria. Cada señal que repitas hará brillar una estrella.";
  setPhase("watching");

  if (state.mode === "sprint") startCountdown();
  nextRound();
}

function nextRound() {
  if (state.phase === "over" || state.phase === "paused") return;
  state.round += 1;
  state.sequence.push(Math.floor(Math.random() * signals.length));
  state.inputIndex = 0;
  roundLabel.textContent = `RONDA ${String(state.round).padStart(2, "0")}`;
  updateProgress();
  playSequence("Observa y escucha la secuencia…");
}

function playSequence(message) {
  if (state.phase === "over" || state.phase === "paused") return;
  setPhase("watching");
  setStatus(message, "active");
  const baseDuration = state.mode === "sprint" ? 280 : 360;
  const pulseDuration = Math.max(175, baseDuration - state.round * 8);
  const pulseGap = pulseDuration + 155;
  const startDelay = 520;

  state.sequence.forEach((signalIndex, position) => {
    schedule(() => flashSignal(signalIndex, pulseDuration), startDelay + position * pulseGap);
  });

  schedule(() => {
    if (state.phase !== "watching") return;
    state.inputIndex = 0;
    setPhase("input");
    updateProgress();
    setStatus(`Tu turno: repite las ${state.sequence.length} señales.`, "active");
    roundLabel.textContent = `TU TURNO · RONDA ${String(state.round).padStart(2, "0")}`;
  }, startDelay + state.sequence.length * pulseGap);
}

function handleSignalPress(signalIndex) {
  if (state.phase !== "input") return;
  flashSignal(signalIndex, 180);

  if (signalIndex !== state.sequence[state.inputIndex]) {
    handleMistake();
    return;
  }

  state.inputIndex += 1;
  updateProgress();
  if (state.inputIndex < state.sequence.length) {
    const remaining = state.sequence.length - state.inputIndex;
    setStatus(`¡Buena señal! Quedan ${remaining} ${remaining === 1 ? "luz" : "luces"}.`, "active");
    return;
  }

  state.streak += 1;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  const multiplier = Math.min(5, 1 + Math.floor(state.streak / 3));
  const basePoints = 100 + state.round * 25;
  const points = basePoints * multiplier;
  state.score += points;
  scoreValue.textContent = formatScore(state.score);
  roundLabel.textContent = `RONDA ${String(state.round).padStart(2, "0")} COMPLETADA`;

  if (state.mode === "sprint") {
    state.secondsLeft += SPRINT_BONUS;
    timerValue.textContent = String(state.secondsLeft).padStart(2, "0");
    setStatus(`¡Perfecto! +${points} puntos · +${SPRINT_BONUS}s · racha ×${state.streak}.`, "active");
  } else {
    setStatus(`¡Resonancia perfecta! +${points} puntos · racha ×${state.streak}.`, "active");
  }

  if (state.round > 0 && state.round % 5 === 0) showToast(`✦ HITO ALCANZADO · RONDA ${state.round}`);
  setPhase("transition");
  schedule(nextRound, 800);
}

function handleMistake() {
  state.inputIndex = 0;
  state.streak = 0;
  updateProgress();

  if (state.mode === "classic") {
    state.lives -= 1;
    updateLives();
    if (state.lives <= 0) {
      endGame();
      return;
    }
    setStatus(`Señal equivocada. Te ${state.lives === 1 ? "queda" : "quedan"} ${state.lives} energías.`, "warning");
  } else if (state.mode === "sprint") {
    state.secondsLeft = Math.max(0, state.secondsLeft - SPRINT_PENALTY);
    timerValue.textContent = String(state.secondsLeft).padStart(2, "0");
    setStatus(`¡Cuidado! −${SPRINT_PENALTY}s. Escucha otra vez.`, "warning");
    if (state.secondsLeft === 0) {
      endGame();
      return;
    }
  } else {
    setStatus("Sin prisa: volvamos a escuchar la secuencia.", "warning");
  }

  setPhase("watching");
  schedule(() => playSequence("Escucha otra vez…"), 650);
}

function replayWithEcho() {
  if (state.phase !== "input" || state.echoes <= 0) return;
  state.echoes -= 1;
  state.inputIndex = 0;
  updateProgress();
  setStatus(`Eco utilizado. Te ${state.echoes === 1 ? "queda" : "quedan"} ${state.echoes} ${state.echoes === 1 ? "repetición" : "repeticiones"}.`, "active");
  setPhase("watching");
  schedule(() => playSequence("La nave repite la señal…"), 250);
}

function startCountdown() {
  clearCountdown();
  state.countdown = window.setInterval(() => {
    if (state.phase === "paused" || state.phase === "over") return;
    state.secondsLeft = Math.max(0, state.secondsLeft - 1);
    timerValue.textContent = String(state.secondsLeft).padStart(2, "0");
    timerStat.classList.toggle("is-urgent", state.secondsLeft <= 10);
    if (state.secondsLeft === 0) endGame();
  }, 1000);
}

function togglePause() {
  if (state.phase === "watching" || state.phase === "input") {
    state.resumePhase = state.phase;
    clearTimers();
    clearCountdown();
    setPhase("paused");
    setStatus("Partida en pausa. Pulsa P o reanudar cuando estés listo.", "paused");
    return;
  }
  if (state.phase !== "paused") return;
  const resumePhase = state.resumePhase;
  setPhase(resumePhase);
  if (state.mode === "sprint") startCountdown();
  if (resumePhase === "watching") {
    playSequence("Retomando señal desde el principio…");
  } else {
    updateProgress();
    setStatus("Partida reanudada. Continúa la secuencia.", "active");
  }
}

function endGame() {
  if (state.phase === "over") return;
  clearTimers();
  clearCountdown();
  const newRecord = state.score > storage.records[state.mode].best;
  if (newRecord) storage.records[state.mode].best = state.score;
  storage.bestStreak = Math.max(storage.bestStreak, state.bestStreak);
  if (!state.gamesRecorded) {
    storage.gamesPlayed += 1;
    state.gamesRecorded = true;
  }
  saveStorage();
  renderRecords();
  setPhase("over");
  roundLabel.textContent = `MISIÓN FINALIZADA · RONDA ${String(state.round).padStart(2, "0")}`;
  updateProgress();
  overlayTitle.innerHTML = newRecord ? "¡RÉCORD <span>ESTELAR!</span>" : "La señal <span>descansa.</span>";
  overlayDescription.textContent = `Has conseguido ${formatScore(state.score)} puntos y alcanzado la ronda ${state.round}.${newRecord ? " Tu nombre queda grabado en la bitácora." : " ¿Listo para superar tu marca?"}`;
  startButtonLabel.textContent = "JUGAR OTRA VEZ";
  setStatus(newRecord ? "¡Nuevo récord! Tu hazaña ya está guardada." : `Fin de la misión. ${formatScore(state.score)} puntos conseguidos.`, "warning");
}

function restartGame() {
  startGame();
}

function setSound(enabled) {
  state.soundEnabled = enabled;
  storage.soundEnabled = enabled;
  soundToggle.setAttribute("aria-pressed", String(enabled));
  soundToggle.setAttribute("aria-label", enabled ? "Desactivar sonido" : "Activar sonido");
  soundLabel.textContent = enabled ? "SONIDO ON" : "SONIDO OFF";
  saveStorage();
  if (enabled) playTone(0, 170);
}

async function copyPromptToClipboard() {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(promptText);
      return;
    } catch (error) {
      console.warn("El portapapeles moderno no está disponible; se probará el método alternativo.", error);
    }
  }

  const field = document.createElement("textarea");
  field.value = promptText;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("El navegador no permitió copiar al portapapeles.");
}

async function copyPrompt() {
  try {
    await copyPromptToClipboard();
    copyPromptButton.innerHTML = '¡PROMPT COPIADO! <span aria-hidden="true">✓</span>';
    showToast("Prompt copiado al portapapeles.");
  } catch (error) {
    console.error("No se pudo copiar el prompt al portapapeles.", error);
    copyPromptButton.textContent = "NO SE PUDO COPIAR";
    showToast("No se pudo copiar el prompt. Selecciona el texto para copiarlo.");
  }
  window.setTimeout(() => {
    copyPromptButton.innerHTML = 'COPIAR PROMPT <span aria-hidden="true">↗</span>';
  }, 2000);
}

function handleKeydown(event) {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof Element && event.target.matches("input, textarea, select, [contenteditable='true']")) return;
  const key = event.key.toLowerCase();

  if (key in keySignals) {
    event.preventDefault();
    handleSignalPress(keySignals[key]);
  } else if (key === "p" && (state.phase === "watching" || state.phase === "input" || state.phase === "paused")) {
    event.preventDefault();
    togglePause();
  } else if (key === "r" && state.phase !== "ready") {
    event.preventDefault();
    restartGame();
  } else if (key === "enter" && (state.phase === "ready" || state.phase === "over")) {
    if (event.target instanceof Element && event.target.matches("button, summary")) return;
    event.preventDefault();
    startGame();
  }
}

signals.forEach((signal) => {
  signal.disabled = true;
  signal.addEventListener("click", () => handleSignalPress(Number(signal.dataset.signal)));
});
modeCards.forEach((card) => card.addEventListener("click", () => setMode(card.dataset.mode)));
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restartGame);
pauseButton.addEventListener("click", togglePause);
echoButton.addEventListener("click", replayWithEcho);
soundToggle.addEventListener("click", () => setSound(!state.soundEnabled));
copyPromptButton.addEventListener("click", copyPrompt);
document.addEventListener("keydown", handleKeydown);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && (state.phase === "watching" || state.phase === "input")) {
    togglePause();
    setStatus("Partida pausada mientras estabas fuera.", "paused");
  }
});

bestValue.textContent = formatScore(storage.records.classic.best);
gamesValue.textContent = String(storage.gamesPlayed);
streakRecordValue.innerHTML = `${storage.bestStreak} <small>×</small>`;
sprintBestValue.textContent = formatScore(storage.records.sprint.best);
soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
soundToggle.setAttribute("aria-label", state.soundEnabled ? "Desactivar sonido" : "Activar sonido");
soundLabel.textContent = state.soundEnabled ? "SONIDO ON" : "SONIDO OFF";
updateLives();
updateProgress();
updateModeDisplay();
setPhase("ready");

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("No se pudo activar el modo sin conexión.", error);
    });
  });
}
