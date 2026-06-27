const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const survivalTimeEl = document.querySelector("#survivalTime");
const bestTimeEl = document.querySelector("#bestTime");
const levelEl = document.querySelector("#level");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const startBtn = document.querySelector("#startBtn");
const scoresEl = document.querySelector("#scores");
const clearBoard = document.querySelector("#clearBoard");

const keys = new Set();
const bullets = [];
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
};

function getScores() {
  return JSON.parse(localStorage.getItem("plane-survival-scores") || "[]");
}

function saveScore(seconds) {
  const scores = getScores();
  scores.push({
    seconds: Number(seconds.toFixed(2)),
    date: new Date().toLocaleDateString("zh-TW"),
  });
  scores.sort((a, b) => b.seconds - a.seconds);
  localStorage.setItem("plane-survival-scores", JSON.stringify(scores.slice(0, 5)));
  renderScores();
}

function renderScores() {
  const scores = getScores();
  bestTimeEl.textContent = `${(scores[0]?.seconds || 0).toFixed(1)}s`;
  scoresEl.innerHTML = "";

  if (scores.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "還沒有紀錄，先活下來再說。";
    scoresEl.append(empty);
    return;
  }

  scores.forEach((score, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>#${index + 1}</strong> ${score.seconds.toFixed(1)}s<br>${score.date}`;
    scoresEl.append(item);
  });
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
  overlay.hidden = true;
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!game.running) return;

  const dt = Math.min((now - game.lastTime) / 1000, 0.033);
  game.lastTime = now;
  game.survival = (now - game.startedAt) / 1000;
  game.level = Math.floor(game.survival / 8) + 1;

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
  const spawnEvery = Math.max(0.075, 0.62 - game.level * 0.038);
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

  if (game.level >= 3 && Math.random() < 0.35) count += 1;
  if (game.level >= 6 && Math.random() < 0.45) count += 1;
  if (game.level >= 10 && Math.random() < 0.35) count += 1;
  if (game.level >= 14 && Math.random() < 0.25) count += 1;

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
    type: type.name,
  };
}

function pickBulletType() {
  const roll = Math.random();

  if (game.level >= 9 && roll < 0.18) {
    return {
      name: "fast",
      minSpeed: 245,
      maxSpeed: 330,
      levelSpeed: 15,
      minRadius: 4,
      maxRadius: 6,
      hueMin: 330,
      hueMax: 360,
    };
  }

  if (game.level >= 6 && roll < 0.4) {
    return {
      name: "slow",
      minSpeed: 72,
      maxSpeed: 115,
      levelSpeed: 6,
      minRadius: 8,
      maxRadius: 12,
      hueMin: 45,
      hueMax: 62,
    };
  }

  if (game.level >= 12 && roll < 0.52) {
    return {
      name: "heavy",
      minSpeed: 95,
      maxSpeed: 145,
      levelSpeed: 8,
      minRadius: 12,
      maxRadius: 17,
      hueMin: 265,
      hueMax: 292,
    };
  }

  return {
    name: "normal",
    minSpeed: 125,
    maxSpeed: 190,
    levelSpeed: 11,
    minRadius: 5,
    maxRadius: 8,
    hueMin: 8,
    hueMax: 38,
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

  ctx.fillStyle = "rgba(94, 168, 255, 0.28)";
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#77d7ff";
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(16, 17);
  ctx.lineTo(0, 10);
  ctx.lineTo(-16, 17);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, -3, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBullets() {
  bullets.forEach((bullet) => {
    ctx.fillStyle = `hsl(${bullet.hue} 100% 60%)`;
    ctx.shadowColor = `hsl(${bullet.hue} 100% 55%)`;
    ctx.shadowBlur = bullet.type === "fast" ? 20 : 14;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();

    if (bullet.type === "fast") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  });
}

function endGame() {
  game.running = false;
  game.over = true;
  saveScore(game.survival);
  overlayTitle.textContent = "墜機了";
  overlayText.textContent = `你撐了 ${game.survival.toFixed(1)} 秒。再來一次，下一把會更穩。`;
  startBtn.textContent = "再玩一次";
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

clearBoard.addEventListener("click", () => {
  localStorage.removeItem("plane-survival-scores");
  renderScores();
});

window.getGameDebug = () => ({
  bulletCount: bullets.length,
  level: game.level,
  running: game.running,
  survival: game.survival,
  pointerActive: pointer.active,
});

renderScores();
draw();
