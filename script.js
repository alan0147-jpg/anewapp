import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadString,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCc8V3NK6Gc32DaB_OEQX0GfJ6ly06_jv0",
  authDomain: "plane-survival-game.firebaseapp.com",
  projectId: "plane-survival-game",
  storageBucket: "plane-survival-game.firebasestorage.app",
  messagingSenderId: "374613673228",
  appId: "1:374613673228:web:8c55cbf6840aa9210bb529",
  measurementId: "G-X44D0S9F53",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const scoresCollection = collection(db, "scores");
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const survivalTimeEl = document.querySelector("#survivalTime");
const bestTimeEl = document.querySelector("#bestTime");
const levelEl = document.querySelector("#level");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startBtn = document.querySelector("#startBtn");
const leaderboard = document.querySelector("#leaderboard");
const scoresEl = document.querySelector("#scores");
const scoreForm = document.querySelector("#scoreForm");
const nicknameInput = document.querySelector("#nickname");
const avatarInput = document.querySelector("#avatarInput");
const skipScoreBtn = document.querySelector("#skipScoreBtn");
const formMessage = document.querySelector("#formMessage");
const MAX_AVATAR_SIZE = 1024 * 1024;
const MAX_LEADERBOARD_SCORES = 30;

const keys = new Set();
const bullets = [];

resizeCanvas();

const stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.7 + 0.4,
  speed: Math.random() * 22 + 10,
}));

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 13,
  speed: 285,
};

const pointer = {
  active: false,
  id: null,
  offsetX: 0,
  offsetY: 0,
};

const game = {
  running: false,
  over: false,
  startedAt: 0,
  lastTime: 0,
  spawnTimer: 0,
  survival: 0,
  level: 1,
  pendingScore: 0,
};

resizeCanvas.entitiesReady = true;
resizeCanvas();

async function getScores() {
  const scoreQuery = query(scoresCollection, orderBy("seconds", "desc"), limit(MAX_LEADERBOARD_SCORES));
  const snapshot = await getDocs(scoreQuery);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.();
    return {
      id: doc.id,
      name: data.name || "匿名飛行員",
      avatar: data.avatarUrl || "",
      seconds: Number(data.seconds || 0),
      date: createdAt ? createdAt.toLocaleDateString("zh-TW") : data.date || "",
    };
  });
}

async function saveScore(seconds, playerName = "匿名飛行員", avatar = "") {
  const scoreId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let avatarUrl = "";

  if (avatar) {
    const avatarRef = ref(storage, `avatars/${scoreId}.jpg`);
    await uploadString(avatarRef, avatar, "data_url");
    avatarUrl = await getDownloadURL(avatarRef);
  }

  await addDoc(scoresCollection, {
    name: playerName.trim() || "匿名飛行員",
    avatarUrl,
    seconds: Number(seconds.toFixed(2)),
    date: new Date().toLocaleDateString("zh-TW"),
    createdAt: serverTimestamp(),
  });

  renderScores();
  return true;
}

async function renderScores() {
  scoresEl.innerHTML = "";

  try {
    const scores = await getScores();
    bestTimeEl.textContent = `${(scores[0]?.seconds || 0).toFixed(1)}s`;

    if (scores.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-score";
      empty.textContent = "還沒有紀錄，先活下來再說。";
      scoresEl.append(empty);
      return;
    }

    scores.forEach((score, index) => {
      const item = document.createElement("li");
      item.className = "score-item";

      const avatar = document.createElement("div");
      avatar.className = "score-avatar";
      if (score.avatar) {
        const image = document.createElement("img");
        image.src = score.avatar;
        image.alt = `${score.name || "玩家"} 的照片`;
        avatar.append(image);
      } else {
        avatar.textContent = (score.name || "?").slice(0, 1).toUpperCase();
      }

      const detail = document.createElement("div");
      detail.innerHTML = `<strong>#${index + 1} ${escapeHtml(score.name || "匿名飛行員")}</strong><span>${score.seconds.toFixed(1)}s</span><small>${score.date}</small>`;

      item.append(avatar, detail);
      scoresEl.append(item);
    });
  } catch (error) {
    console.error(error);
    bestTimeEl.textContent = "--";
    const empty = document.createElement("li");
    empty.className = "empty-score";
    empty.textContent = "排行榜暫時無法讀取，請確認 Firebase 規則已開啟。";
    scoresEl.append(empty);
  }
}
function resetGame() {
  bullets.length = 0;
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  pointer.active = false;
  pointer.id = null;
  game.running = true;
  game.over = false;
  game.startedAt = performance.now();
  game.lastTime = game.startedAt;
  game.spawnTimer = 0;
  game.survival = 0;
  game.level = 1;
  game.pendingScore = 0;
  scoreForm.hidden = true;
  leaderboard.hidden = true;
  startBtn.hidden = false;
  startBtn.textContent = "開始遊戲";
  overlay.hidden = true;
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!game.running) return;

  const dt = Math.min((now - game.lastTime) / 1000, 0.033);
  game.lastTime = now;
  game.survival = (now - game.startedAt) / 1000;
  game.level = Math.floor(game.survival / 6) + 1;

  update(dt);
  draw();

  if (game.running) {
    requestAnimationFrame(loop);
  }
}

function update(dt) {
  updatePlayer(dt);
  updateStars(dt);
  spawnBullets(dt);
  updateBullets(dt);
  updateHud();
}

function updatePlayer(dt) {
  if (pointer.active) {
    player.x = clamp(player.x, player.radius + 6, canvas.width - player.radius - 6);
    player.y = clamp(player.y, player.radius + 6, canvas.height - player.radius - 6);
    return;
  }

  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    player.x += (dx / length) * player.speed * dt;
    player.y += (dy / length) * player.speed * dt;
  }

  player.x = clamp(player.x, player.radius + 6, canvas.width - player.radius - 6);
  player.y = clamp(player.y, player.radius + 6, canvas.height - player.radius - 6);
}

function updateStars(dt) {
  stars.forEach((star) => {
    star.y += star.speed * dt;
    if (star.y > canvas.height) {
      star.y = -4;
      star.x = Math.random() * canvas.width;
    }
  });
}

function spawnBullets(dt) {
  const spawnEvery = Math.max(0.045, 0.52 - game.level * 0.045);
  game.spawnTimer -= dt;

  while (game.spawnTimer <= 0) {
    game.spawnTimer += spawnEvery;
    const count = getSpawnCount();

    for (let i = 0; i < count; i += 1) {
      bullets.push(createBullet());
    }
  }
}

function getSpawnCount() {
  let count = 1;

  if (game.level >= 2 && Math.random() < 0.45) count += 1;
  if (game.level >= 4 && Math.random() < 0.55) count += 1;
  if (game.level >= 7 && Math.random() < 0.5) count += 1;
  if (game.level >= 10 && Math.random() < 0.4) count += 1;
  if (game.level >= 14 && Math.random() < 0.3) count += 1;

  return count;
}

function createBullet() {
  const side = Math.floor(Math.random() * 4);
  const margin = 28;
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = Math.random() * canvas.width;
    y = -margin;
  } else if (side === 1) {
    x = canvas.width + margin;
    y = Math.random() * canvas.height;
  } else if (side === 2) {
    x = Math.random() * canvas.width;
    y = canvas.height + margin;
  } else {
    x = -margin;
    y = Math.random() * canvas.height;
  }

  const type = pickBulletType();
  const aimSpread = Math.max(18, 78 - game.level * 3);
  const aimX = player.x + randomBetween(-aimSpread, aimSpread);
  const aimY = player.y + randomBetween(-aimSpread, aimSpread);
  const angle = Math.atan2(aimY - y, aimX - x);
  const speed = randomBetween(type.minSpeed, type.maxSpeed) + game.level * type.levelSpeed;

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: randomBetween(type.minRadius, type.maxRadius),
    hue: randomBetween(type.hueMin, type.hueMax),
    accentHue: randomBetween(type.accentHueMin, type.accentHueMax),
    angle,
    type: type.name,
  };
}

function pickBulletType() {
  const roll = Math.random();

  if (game.level >= 7 && roll < 0.22) {
    return {
      name: "fast",
      minSpeed: 245,
      maxSpeed: 330,
      levelSpeed: 15,
      minRadius: 4,
      maxRadius: 6,
      hueMin: 10,
      hueMax: 24,
      accentHueMin: 42,
      accentHueMax: 58,
    };
  }

  if (game.level >= 5 && roll < 0.44) {
    return {
      name: "slow",
      minSpeed: 72,
      maxSpeed: 115,
      levelSpeed: 6,
      minRadius: 8,
      maxRadius: 12,
      hueMin: 45,
      hueMax: 62,
      accentHueMin: 160,
      accentHueMax: 190,
    };
  }

  if (game.level >= 10 && roll < 0.58) {
    return {
      name: "heavy",
      minSpeed: 95,
      maxSpeed: 145,
      levelSpeed: 8,
      minRadius: 12,
      maxRadius: 17,
      hueMin: 265,
      hueMax: 292,
      accentHueMin: 300,
      accentHueMax: 330,
    };
  }

  return {
    name: "normal",
    minSpeed: 125,
    maxSpeed: 190,
    levelSpeed: 11,
    minRadius: 5,
    maxRadius: 8,
    hueMin: 185,
    hueMax: 330,
    accentHueMin: 20,
    accentHueMax: 75,
  };
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    const hitDistance = player.radius + bullet.radius - 2;
    if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < hitDistance) {
      endGame();
      return;
    }

    if (
      bullet.x < -100 ||
      bullet.x > canvas.width + 100 ||
      bullet.y < -100 ||
      bullet.y > canvas.height + 100
    ) {
      bullets.splice(i, 1);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPlayer();
  drawBullets();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0d1830");
  gradient.addColorStop(1, "#05070d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(213, 229, 255, 0.72)";
  stars.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = "rgba(94, 168, 255, 0.24)";
  ctx.beginPath();
  ctx.ellipse(0, 1, 25, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#bfe9ff";
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.bezierCurveTo(10, -14, 11, 9, 5, 22);
  ctx.lineTo(-5, 22);
  ctx.bezierCurveTo(-11, 9, -10, -14, 0, -24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#4bbdff";
  ctx.beginPath();
  ctx.moveTo(-7, -3);
  ctx.lineTo(-28, 15);
  ctx.lineTo(-9, 16);
  ctx.lineTo(-3, 5);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(7, -3);
  ctx.lineTo(28, 15);
  ctx.lineTo(9, 16);
  ctx.lineTo(3, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#2f8fff";
  ctx.beginPath();
  ctx.moveTo(-5, 14);
  ctx.lineTo(-15, 26);
  ctx.lineTo(-3, 23);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(5, 14);
  ctx.lineTo(15, 26);
  ctx.lineTo(3, 23);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, -8, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffb347";
  ctx.beginPath();
  ctx.moveTo(-5, 22);
  ctx.lineTo(0, 34);
  ctx.lineTo(5, 22);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBullets() {
  bullets.forEach((bullet) => {
    if (bullet.type === "fast") {
      drawRocket(bullet);
      return;
    }

    const gradient = ctx.createRadialGradient(
      bullet.x - bullet.radius * 0.35,
      bullet.y - bullet.radius * 0.35,
      1,
      bullet.x,
      bullet.y,
      bullet.radius * 1.6,
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.38, `hsl(${bullet.hue} 100% 62%)`);
    gradient.addColorStop(1, `hsl(${bullet.accentHue} 100% 48%)`);

    ctx.fillStyle = gradient;
    ctx.shadowColor = `hsl(${bullet.hue} 100% 55%)`;
    ctx.shadowBlur = bullet.type === "heavy" ? 22 : 15;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `hsla(${bullet.accentHue} 100% 78% / 0.75)`;
    ctx.lineWidth = bullet.type === "heavy" ? 2 : 1.2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });
}

function drawRocket(bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(bullet.angle + Math.PI / 2);

  ctx.shadowColor = "#ff7a1a";
  ctx.shadowBlur = 18;

  ctx.fillStyle = "#f5f7ff";
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.bezierCurveTo(8, -8, 7, 8, 3, 15);
  ctx.lineTo(-3, 15);
  ctx.bezierCurveTo(-7, 8, -8, -8, 0, -17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `hsl(${bullet.hue} 100% 55%)`;
  ctx.beginPath();
  ctx.moveTo(-5, 7);
  ctx.lineTo(-13, 17);
  ctx.lineTo(-3, 14);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(5, 7);
  ctx.lineTo(13, 17);
  ctx.lineTo(3, 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#5bd7ff";
  ctx.beginPath();
  ctx.arc(0, -4, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${bullet.accentHue} 100% 56%)`;
  ctx.beginPath();
  ctx.moveTo(-4, 15);
  ctx.lineTo(0, 27);
  ctx.lineTo(4, 15);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function endGame() {
  game.running = false;
  game.over = true;
  game.pendingScore = Number(game.survival.toFixed(2));
  overlayTitle.textContent = "墜機了";
  overlayText.textContent = `你撐了 ${game.survival.toFixed(1)} 秒。留下暱稱和照片，記錄這次飛行。`;
  startBtn.textContent = "再玩一次";
  startBtn.hidden = true;
  scoreForm.hidden = false;
  nicknameInput.value = localStorage.getItem("plane-survival-last-name") || "";
  avatarInput.value = "";
  formMessage.textContent = "";
  nicknameInput.focus();
  overlay.hidden = false;
}

function updateHud() {
  survivalTimeEl.textContent = `${game.survival.toFixed(1)}s`;
  levelEl.textContent = game.level;
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function movePlayerTo(point) {
  player.x = clamp(point.x - pointer.offsetX, player.radius + 6, canvas.width - player.radius - 6);
  player.y = clamp(point.y - pointer.offsetY, player.radius + 6, canvas.height - player.radius - 6);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function readAvatar(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => resizeAvatar(reader.result, resolve));
    reader.addEventListener("error", () => resolve(""));
    reader.readAsDataURL(file);
  });
}

function resizeAvatar(src, done) {
  const image = new Image();
  image.addEventListener("load", () => {
    const size = 96;
    const avatarCanvas = document.createElement("canvas");
    const avatarCtx = avatarCanvas.getContext("2d");
    avatarCanvas.width = size;
    avatarCanvas.height = size;

    const sourceSize = Math.min(image.width, image.height);
    const sourceX = (image.width - sourceSize) / 2;
    const sourceY = (image.height - sourceSize) / 2;
    avatarCtx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
    done(avatarCanvas.toDataURL("image/jpeg", 0.78));
  });
  image.addEventListener("error", () => done(""));
  image.src = src;
}

function showRestartPrompt() {
  scoreForm.hidden = true;
  leaderboard.hidden = false;
  startBtn.hidden = false;
  startBtn.textContent = "再玩一次";
  overlayText.textContent = "成績已處理。排行榜如下，準備好就再飛一次。";
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  keys.add(event.key.toLowerCase());

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", (event) => {
  if (!game.running) return;

  const point = getCanvasPoint(event);
  const distance = Math.hypot(point.x - player.x, point.y - player.y);
  if (distance > player.radius + 28) return;

  pointer.active = true;
  pointer.id = event.pointerId;
  pointer.offsetX = point.x - player.x;
  pointer.offsetY = point.y - player.y;
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointer.active || event.pointerId !== pointer.id) return;

  movePlayerTo(getCanvasPoint(event));
  event.preventDefault();
});

canvas.addEventListener("pointerup", (event) => {
  if (event.pointerId !== pointer.id) return;
  pointer.active = false;
  pointer.id = null;
});

canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
  pointer.id = null;
});

startBtn.addEventListener("click", resetGame);

scoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  const file = avatarInput.files[0];
  if (file && file.size > MAX_AVATAR_SIZE) {
    formMessage.textContent = "照片超過 1MB，請換一張小一點的圖片。";
    avatarInput.value = "";
    return;
  }

  const name = nicknameInput.value.trim() || "匿名飛行員";
  const avatar = await readAvatar(file);
  if (avatar === null) {
    formMessage.textContent = "照片超過 1MB，請換一張小一點的圖片。";
    avatarInput.value = "";
    return;
  }

  try {
    localStorage.setItem("plane-survival-last-name", name);
    await saveScore(game.pendingScore, name, avatar);
    showRestartPrompt();
  } catch (error) {
    console.error(error);
    formMessage.textContent = "成績上傳失敗，請確認 Firebase Firestore 和 Storage 規則已開啟。";
  }
});
skipScoreBtn.addEventListener("click", async () => {
  formMessage.textContent = "";

  try {
    await saveScore(game.pendingScore, "匿名飛行員", "");
    showRestartPrompt();
  } catch (error) {
    console.error(error);
    formMessage.textContent = "成績上傳失敗，請確認 Firebase Firestore 規則已開啟。";
  }
});

window.getGameDebug = () => ({
  bulletCount: bullets.length,
  level: game.level,
  running: game.running,
  survival: game.survival,
  pointerActive: pointer.active,
});

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const nextWidth = Math.max(320, Math.round(rect.width || 960));
  const nextHeight = Math.max(260, Math.round(rect.height || 600));
  const oldWidth = canvas.width || nextWidth;
  const oldHeight = canvas.height || nextHeight;

  if (canvas.width === nextWidth && canvas.height === nextHeight) return;

  canvas.width = nextWidth;
  canvas.height = nextHeight;

  if (resizeCanvas.entitiesReady) {
    player.x = clamp((player.x / oldWidth) * nextWidth, player.radius + 6, nextWidth - player.radius - 6);
    player.y = clamp((player.y / oldHeight) * nextHeight, player.radius + 6, nextHeight - player.radius - 6);

    stars.forEach((star) => {
      star.x = (star.x / oldWidth) * nextWidth;
      star.y = (star.y / oldHeight) * nextHeight;
    });
  }

  if (resizeCanvas.entitiesReady && typeof draw === "function") {
    draw();
  }
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => {
  setTimeout(resizeCanvas, 120);
});

renderScores();
draw();
