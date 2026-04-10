const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const lengthEl = document.getElementById("length");
const rankEl = document.getElementById("rank");
const aliveBotsEl = document.getElementById("alive-bots");
const foodCountEl = document.getElementById("food-count");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlay-kicker");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startButton = document.getElementById("start-button");

const gridSize = 24;
const worldTiles = 96;
const worldSize = worldTiles * gridSize;
const viewportWidth = canvas.width;
const viewportHeight = canvas.height;
const initialLength = 4;
const botCount = 6;
const foodTarget = 52;
const storageKey = "worm-arena-best-score";

const botPalettes = [
  { head: "#ff8a80", body: "#ff6b7d", glow: "rgba(255, 107, 125, 0.55)" },
  { head: "#ffd36e", body: "#ffb347", glow: "rgba(255, 179, 71, 0.52)" },
  { head: "#6ef2d4", body: "#3dd9be", glow: "rgba(61, 217, 190, 0.5)" },
  { head: "#d39aff", body: "#b774ff", glow: "rgba(183, 116, 255, 0.5)" },
  { head: "#88a8ff", body: "#5f80ff", glow: "rgba(95, 128, 255, 0.5)" },
  { head: "#ff9ed1", body: "#ff71b6", glow: "rgba(255, 113, 182, 0.5)" },
];

let player;
let bots = [];
let foods = [];
let score = 0;
let bestScore = Number(localStorage.getItem(storageKey) || 0);
let gameStarted = false;
let lastFrameTime = 0;
let frameAccumulator = 0;
let pointerStart = null;
let lastSwipeTime = 0;

bestScoreEl.textContent = bestScore;

function makeSnake(name, color, isPlayer, startX, startY, direction) {
  const segments = [];

  for (let index = 0; index < initialLength; index += 1) {
    segments.push({
      x: startX - direction.x * index,
      y: startY - direction.y * index,
    });
  }

  return {
    name,
    color,
    isPlayer,
    segments,
    direction: { ...direction },
    nextDirection: { ...direction },
    speed: isPlayer ? 7.8 : 7 + Math.random() * 1.2,
    alive: true,
    aiCooldown: 0,
    stepAccumulator: 0,
    respawnTimer: 0,
    wiggleSeed: Math.random() * Math.PI * 2,
  };
}

function randomGridPosition(margin = 2) {
  return {
    x: Math.floor(Math.random() * (worldTiles - margin * 2)) + margin,
    y: Math.floor(Math.random() * (worldTiles - margin * 2)) + margin,
  };
}

function createPlayer() {
  const center = { x: Math.floor(worldTiles / 2), y: Math.floor(worldTiles / 2) };
  player = makeSnake(
    "You",
    { head: "#8fe5ff", body: "#57dfa2", glow: "rgba(111, 223, 255, 0.6)" },
    true,
    center.x,
    center.y,
    { x: 1, y: 0 }
  );
}

function createBot(index) {
  const directionOptions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  let start = randomGridPosition(10);
  let tries = 0;

  while (occupiedBySnake(start) && tries < 80) {
    start = randomGridPosition(10);
    tries += 1;
  }

  const direction = directionOptions[Math.floor(Math.random() * directionOptions.length)];
  const bot = makeSnake(
    `Bot ${index + 1}`,
    botPalettes[index % botPalettes.length],
    false,
    start.x,
    start.y,
    direction
  );
  bot.speed = 6.6 + Math.random() * 1.2;
  bot.botIndex = index;
  return bot;
}

function createBots() {
  bots = [];

  for (let index = 0; index < botCount; index += 1) {
    bots.push(createBot(index));
  }
}

function spawnInitialFoods() {
  foods = [];

  while (foods.length < foodTarget) {
    foods.push(createFood());
  }
}

function occupiedBySnake(position) {
  const allSnakes = [player, ...bots];
  return allSnakes.some((snake) =>
    snake.segments.some((segment) => segment.x === position.x && segment.y === position.y)
  );
}

function createFood(anchor) {
  let position = anchor || randomGridPosition(1);
  let attempts = 0;

  while ((occupiedBySnake(position) || foods.some((food) => food.x === position.x && food.y === position.y)) && attempts < 200) {
    position = randomGridPosition(1);
    attempts += 1;
  }

  return {
    x: position.x,
    y: position.y,
    energy: 1 + Math.floor(Math.random() * 3),
    hue: Math.random() > 0.82 ? "#ffd36e" : "#ff9752",
  };
}

function refillFoods() {
  while (foods.length < foodTarget) {
    foods.push(createFood());
  }
}

function resetGame() {
  createPlayer();
  createBots();
  spawnInitialFoods();
  score = 0;
  gameStarted = true;
  lastFrameTime = 0;
  frameAccumulator = 0;
  overlay.classList.add("hidden");
  updateHud();
  requestAnimationFrame(gameLoop);
}

function showOverlay(kicker, title, text) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function updateHud() {
  const livingBots = bots.filter((bot) => bot.alive).length;
  const snakesByLength = [player, ...bots]
    .filter((snake) => snake.alive)
    .sort((left, right) => right.segments.length - left.segments.length);
  const rank = Math.max(1, snakesByLength.findIndex((snake) => snake === player) + 1);

  scoreEl.textContent = score;
  lengthEl.textContent = player.segments.length;
  bestScoreEl.textContent = bestScore;
  rankEl.textContent = `${rank}/${livingBots + (player.alive ? 1 : 0)}`;
  aliveBotsEl.textContent = livingBots;
  foodCountEl.textContent = foods.length;
}

function setPlayerDirection(newDirection) {
  if (!gameStarted || !player.alive) {
    return;
  }

  const isReversing =
    player.direction.x + newDirection.x === 0 &&
    player.direction.y + newDirection.y === 0;

  if (!isReversing) {
    player.nextDirection = newDirection;
  }
}

function getAllSegmentsExceptTail(snake, isEating) {
  return isEating ? snake.segments : snake.segments.slice(0, -1);
}

function getCollisionAt(snake, nextHead, isEating) {
  if (
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= worldTiles ||
    nextHead.y >= worldTiles
  ) {
    return true;
  }

  const allSnakes = [player, ...bots];

  return allSnakes.some((otherSnake) => {
    if (!otherSnake.alive) {
      return false;
    }

    const body =
      otherSnake === snake
        ? getAllSegmentsExceptTail(otherSnake, isEating)
        : otherSnake.segments;

    return body.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
  });
}

function killSnake(snake, reason) {
  snake.alive = false;

  snake.segments.forEach((segment, index) => {
    if (index % 2 === 0) {
      foods.push({
        x: segment.x,
        y: segment.y,
        energy: 1 + (index % 3),
        hue: snake.isPlayer ? "#ffd36e" : snake.color.body,
      });
    }
  });

  if (snake.isPlayer) {
    gameStarted = false;
    bestScore = Math.max(bestScore, score);
    localStorage.setItem(storageKey, String(bestScore));
    updateHud();
    showOverlay(
      "Match Over",
      "คุณถูกโค่นแล้ว",
      `${reason} คะแนนสุดท้าย ${score} | ความยาว ${snake.segments.length}`
    );
  } else {
    snake.respawnTimer = 2.4;
  }
}

function consumeFoodAt(position) {
  const index = foods.findIndex((food) => food.x === position.x && food.y === position.y);

  if (index === -1) {
    return null;
  }

  return foods.splice(index, 1)[0];
}

function stepSnake(snake) {
  if (!snake.alive) {
    return;
  }

  snake.direction = snake.nextDirection;
  const head = snake.segments[0];
  const nextHead = {
    x: head.x + snake.direction.x,
    y: head.y + snake.direction.y,
  };
  const food = foods.find((item) => item.x === nextHead.x && item.y === nextHead.y);
  const isEating = Boolean(food);

  if (getCollisionAt(snake, nextHead, isEating)) {
    killSnake(snake, snake.isPlayer ? "ชนกำแพงหรือชนหนอนตัวอื่น" : "bot_down");
    return;
  }

  snake.segments.unshift(nextHead);

  if (isEating) {
    const eatenFood = consumeFoodAt(nextHead);
    if (snake.isPlayer) {
      score += (eatenFood?.energy || 1) * 10;
      snake.speed = Math.min(12.8, snake.speed + 0.08);
      bestScore = Math.max(bestScore, score);
      localStorage.setItem(storageKey, String(bestScore));
    } else {
      snake.speed = Math.min(10.2, snake.speed + 0.03);
    }
  } else {
    snake.segments.pop();
  }
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function chooseBotDirection(bot) {
  const head = bot.segments[0];
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ].filter(
    (dir) => !(bot.direction.x + dir.x === 0 && bot.direction.y + dir.y === 0)
  );

  const nearbyFood = foods
    .slice()
    .sort((left, right) => distanceSquared(left, head) - distanceSquared(right, head))
    .slice(0, 6);

  let bestDirection = bot.direction;
  let bestScoreValue = -Infinity;

  directions.forEach((dir) => {
    const probe = { x: head.x + dir.x, y: head.y + dir.y };

    if (getCollisionAt(bot, probe, false)) {
      return;
    }

    let scoreValue = 0;

    nearbyFood.forEach((food) => {
      scoreValue += 220 / (distanceSquared(food, probe) + 1);
    });

    const centerBias = {
      x: worldTiles / 2,
      y: worldTiles / 2,
    };
    scoreValue += 60 / (distanceSquared(centerBias, probe) + 10);

    const margin = 4;
    if (
      probe.x < margin ||
      probe.y < margin ||
      probe.x > worldTiles - margin ||
      probe.y > worldTiles - margin
    ) {
      scoreValue -= 20;
    }

    scoreValue += Math.sin(performance.now() / 600 + bot.wiggleSeed) * 0.4;

    if (scoreValue > bestScoreValue) {
      bestScoreValue = scoreValue;
      bestDirection = dir;
    }
  });

  bot.nextDirection = bestDirection;
}

function updateBots(deltaSeconds) {
  bots.forEach((bot) => {
    if (!bot.alive) {
      bot.respawnTimer -= deltaSeconds;

      if (bot.respawnTimer <= 0) {
        const refreshedBot = createBot(bot.botIndex || 0);
        Object.assign(bot, refreshedBot);
      }

      return;
    }

    bot.aiCooldown -= deltaSeconds;
    if (bot.aiCooldown <= 0) {
      chooseBotDirection(bot);
      bot.aiCooldown = 0.14 + Math.random() * 0.12;
    }
  });
}

function getCamera() {
  const head = player.segments[0];
  const rawX = head.x * gridSize + gridSize / 2 - viewportWidth / 2;
  const rawY = head.y * gridSize + gridSize / 2 - viewportHeight / 2;

  return {
    x: clamp(rawX, 0, worldSize - viewportWidth),
    y: clamp(rawY, 0, worldSize - viewportHeight),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawBackground(camera) {
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.strokeStyle = "rgba(111, 223, 255, 0.08)";
  ctx.lineWidth = 1;

  for (let tile = 0; tile <= worldTiles; tile += 1) {
    const offset = tile * gridSize;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, worldSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(worldSize, offset);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(140, 243, 157, 0.18)";
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, worldSize, worldSize);
  ctx.restore();
}

function drawFoods(camera) {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  foods.forEach((food) => {
    const x = food.x * gridSize + gridSize / 2;
    const y = food.y * gridSize + gridSize / 2;
    const radius = 4 + food.energy * 1.8;

    ctx.shadowBlur = 18;
    ctx.shadowColor = food.hue;
    ctx.fillStyle = food.hue;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 245, 220, 0.95)";
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, Math.max(2, radius * 0.28), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawSnake(snake, camera) {
  if (!snake.alive) {
    return;
  }

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  snake.segments.forEach((segment, index) => {
    const x = segment.x * gridSize;
    const y = segment.y * gridSize;
    const isHead = index === 0;

    ctx.shadowBlur = isHead ? 20 : 10;
    ctx.shadowColor = snake.color.glow;
    ctx.fillStyle = isHead ? snake.color.head : snake.color.body;
    roundRect(ctx, x + 2, y + 2, gridSize - 4, gridSize - 4, isHead ? 9 : 8);
    ctx.fill();

    if (isHead) {
      ctx.fillStyle = "#08141d";
      const eyeBaseX = snake.direction.x !== 0 ? 14 : 7;
      const eyeBaseY = snake.direction.y !== 0 ? 14 : 7;
      const eyeGapX = snake.direction.x !== 0 ? 0 : 10;
      const eyeGapY = snake.direction.y !== 0 ? 0 : 10;

      ctx.beginPath();
      ctx.arc(x + eyeBaseX, y + eyeBaseY, 2.4, 0, Math.PI * 2);
      ctx.arc(x + eyeBaseX + eyeGapX, y + eyeBaseY + eyeGapY, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.restore();
}

function drawMinimap(camera) {
  const mapSize = 120;
  const pad = 16;
  const scale = mapSize / worldSize;
  const x = viewportWidth - mapSize - pad;
  const y = viewportHeight - mapSize - pad;

  ctx.save();
  ctx.fillStyle = "rgba(5, 15, 23, 0.72)";
  ctx.strokeStyle = "rgba(143, 227, 255, 0.25)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, mapSize, mapSize, 16);
  ctx.fill();
  ctx.stroke();

  foods.slice(0, 80).forEach((food) => {
    ctx.fillStyle = "rgba(255, 183, 71, 0.85)";
    ctx.fillRect(x + food.x * gridSize * scale, y + food.y * gridSize * scale, 2, 2);
  });

  [player, ...bots].forEach((snake) => {
    if (!snake.alive) {
      return;
    }

    const head = snake.segments[0];
    ctx.fillStyle = snake.isPlayer ? "#8fe5ff" : snake.color.body;
    ctx.beginPath();
    ctx.arc(x + head.x * gridSize * scale, y + head.y * gridSize * scale, snake.isPlayer ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = "rgba(140, 243, 157, 0.8)";
  ctx.strokeRect(x + camera.x * scale, y + camera.y * scale, viewportWidth * scale, viewportHeight * scale);
  ctx.restore();
}

function render() {
  const camera = getCamera();
  drawBackground(camera);
  drawFoods(camera);
  bots.forEach((bot) => drawSnake(bot, camera));
  drawSnake(player, camera);
  drawMinimap(camera);
}

function update(deltaMs) {
  const deltaSeconds = deltaMs / 1000;

  updateBots(deltaSeconds);

  [player, ...bots].forEach((snake) => {
    if (!snake.alive) {
      return;
    }

    snake.stepAccumulator = (snake.stepAccumulator || 0) + deltaMs;
    const stepTime = 1000 / snake.speed;

    while (snake.stepAccumulator >= stepTime && snake.alive) {
      stepSnake(snake);
      snake.stepAccumulator -= stepTime;
    }
  });

  refillFoods();
  updateHud();
}

function gameLoop(timestamp) {
  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  const deltaTime = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  if (gameStarted && player.alive) {
    frameAccumulator += deltaTime;
    while (frameAccumulator >= 16) {
      update(16);
      frameAccumulator -= 16;
    }
  }

  render();

  if (gameStarted || overlay.classList.contains("hidden")) {
    requestAnimationFrame(gameLoop);
  }
}

function handleDirectionKey(key) {
  if (key === "arrowup" || key === "w") {
    setPlayerDirection({ x: 0, y: -1 });
  } else if (key === "arrowdown" || key === "s") {
    setPlayerDirection({ x: 0, y: 1 });
  } else if (key === "arrowleft" || key === "a") {
    setPlayerDirection({ x: -1, y: 0 });
  } else if (key === "arrowright" || key === "d") {
    setPlayerDirection({ x: 1, y: 0 });
  }
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();

  if (!gameStarted && (key === "enter" || key === " ")) {
    resetGame();
    return;
  }

  handleDirectionKey(key);
}

function handleSwipeEnd(endPoint) {
  if (!pointerStart || !endPoint) {
    return;
  }

  const dx = endPoint.x - pointerStart.x;
  const dy = endPoint.y - pointerStart.y;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
    return;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    setPlayerDirection({ x: dx > 0 ? 1 : -1, y: 0 });
  } else {
    setPlayerDirection({ x: 0, y: dy > 0 ? 1 : -1 });
  }
}

document.addEventListener("keydown", handleKeydown);
startButton.addEventListener("click", () => {
  resetGame();
});

document.querySelectorAll(".touch-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const dir = button.dataset.dir;

    if (dir === "up") {
      setPlayerDirection({ x: 0, y: -1 });
    } else if (dir === "down") {
      setPlayerDirection({ x: 0, y: 1 });
    } else if (dir === "left") {
      setPlayerDirection({ x: -1, y: 0 });
    } else if (dir === "right") {
      setPlayerDirection({ x: 1, y: 0 });
    }
  });
});

canvas.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  if (Date.now() - lastSwipeTime < 50) {
    return;
  }

  handleSwipeEnd({ x: event.clientX, y: event.clientY });
  lastSwipeTime = Date.now();
  pointerStart = null;
});

canvas.addEventListener("pointercancel", () => {
  pointerStart = null;
});

createPlayer();
createBots();
spawnInitialFoods();
updateHud();
render();
