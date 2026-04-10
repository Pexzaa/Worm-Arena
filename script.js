const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const lengthEl = document.getElementById("length");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlay-kicker");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startButton = document.getElementById("start-button");

const gridSize = 24;
const tileCount = canvas.width / gridSize;
const initialLength = 3;
const storageKey = "worm-arena-best-score";

let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = { x: 10, y: 10 };
let score = 0;
let bestScore = Number(localStorage.getItem(storageKey) || 0);
let gameOver = false;
let gameStarted = false;
let speed = 7;
let lastFrameTime = 0;
let frameAccumulator = 0;

bestScoreEl.textContent = bestScore;

function createSnake() {
  snake = [];
  const startX = Math.floor(tileCount / 2);
  const startY = Math.floor(tileCount / 2);

  for (let index = 0; index < initialLength; index += 1) {
    snake.push({ x: startX - index, y: startY });
  }
}

function randomFoodPosition() {
  let position;

  do {
    position = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (snake.some((segment) => segment.x === position.x && segment.y === position.y));

  return position;
}

function updateHud() {
  scoreEl.textContent = score;
  lengthEl.textContent = snake.length;
  bestScoreEl.textContent = bestScore;
}

function resetGame() {
  createSnake();
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  food = randomFoodPosition();
  score = 0;
  speed = 7;
  gameOver = false;
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

function setDirection(newDirection) {
  if (!gameStarted || gameOver) {
    return;
  }

  const isReversing =
    direction.x + newDirection.x === 0 &&
    direction.y + newDirection.y === 0;

  if (!isReversing) {
    nextDirection = newDirection;
  }
}

function moveSnake() {
  direction = nextDirection;
  const head = snake[0];
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };
  const isEating = newHead.x === food.x && newHead.y === food.y;
  const bodyToCheck = isEating ? snake : snake.slice(0, -1);

  const hitWall =
    newHead.x < 0 ||
    newHead.y < 0 ||
    newHead.x >= tileCount ||
    newHead.y >= tileCount;

  const hitSelf = bodyToCheck.some(
    (segment) => segment.x === newHead.x && segment.y === newHead.y
  );

  if (hitWall || hitSelf) {
    gameOver = true;
    gameStarted = false;
    bestScore = Math.max(bestScore, score);
    localStorage.setItem(storageKey, String(bestScore));
    updateHud();
    showOverlay(
      "Game Over",
      "โดนจับได้แล้ว",
      `คุณทำได้ ${score} คะแนน และหนอนยาว ${snake.length} ปล้อง`
    );
    return;
  }

  snake.unshift(newHead);

  if (isEating) {
    score += 10;
    speed = Math.min(14, speed + 0.35);
    food = randomFoodPosition();
    bestScore = Math.max(bestScore, score);
    localStorage.setItem(storageKey, String(bestScore));
  } else {
    snake.pop();
  }

  updateHud();
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawFood() {
  const x = food.x * gridSize;
  const y = food.y * gridSize;

  ctx.save();
  ctx.shadowBlur = 25;
  ctx.shadowColor = "#ffb347";
  ctx.fillStyle = "#ff9752";
  ctx.beginPath();
  ctx.arc(x + gridSize / 2, y + gridSize / 2, gridSize * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffe8c2";
  ctx.beginPath();
  ctx.arc(x + gridSize / 2 - 2, y + gridSize / 2 - 3, gridSize * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnake() {
  snake.forEach((segment, index) => {
    const x = segment.x * gridSize;
    const y = segment.y * gridSize;
    const isHead = index === 0;

    ctx.save();
    ctx.shadowBlur = isHead ? 18 : 10;
    ctx.shadowColor = isHead ? "#70d4ff" : "#2ce38e";
    ctx.fillStyle = isHead ? "#8fe5ff" : "#54e39f";
    roundRect(ctx, x + 2, y + 2, gridSize - 4, gridSize - 4, 8);
    ctx.fill();

    if (isHead) {
      ctx.fillStyle = "#092130";
      const eyeOffsetX = direction.x !== 0 ? 14 : 7;
      const eyeOffsetY = direction.y !== 0 ? 14 : 7;
      const eyeGapX = direction.x !== 0 ? 0 : 10;
      const eyeGapY = direction.y !== 0 ? 0 : 10;

      ctx.beginPath();
      ctx.arc(x + eyeOffsetX, y + eyeOffsetY, 2.6, 0, Math.PI * 2);
      ctx.arc(x + eyeOffsetX + eyeGapX, y + eyeOffsetY + eyeGapY, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
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

function drawTrail() {
  ctx.save();
  ctx.strokeStyle = "rgba(111, 223, 255, 0.08)";
  ctx.lineWidth = 1;

  for (let index = 0; index < tileCount; index += 1) {
    const offset = index * gridSize;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(canvas.width, offset);
    ctx.stroke();
  }

  ctx.restore();
}

function render() {
  drawBoard();
  drawTrail();
  drawFood();
  drawSnake();
}

function gameLoop(timestamp) {
  if (!gameStarted) {
    render();
    return;
  }

  if (!lastFrameTime) {
    lastFrameTime = timestamp;
  }

  const deltaTime = timestamp - lastFrameTime;
  lastFrameTime = timestamp;
  frameAccumulator += deltaTime;

  const stepTime = 1000 / speed;

  while (frameAccumulator >= stepTime && gameStarted) {
    moveSnake();
    frameAccumulator -= stepTime;
  }

  render();

  if (gameStarted) {
    requestAnimationFrame(gameLoop);
  }
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();

  if (!gameStarted && (key === "enter" || key === " ")) {
    resetGame();
    return;
  }

  if (key === "arrowup" || key === "w") {
    setDirection({ x: 0, y: -1 });
  } else if (key === "arrowdown" || key === "s") {
    setDirection({ x: 0, y: 1 });
  } else if (key === "arrowleft" || key === "a") {
    setDirection({ x: -1, y: 0 });
  } else if (key === "arrowright" || key === "d") {
    setDirection({ x: 1, y: 0 });
  }
}

document.addEventListener("keydown", handleKeydown);
startButton.addEventListener("click", resetGame);

document.querySelectorAll(".touch-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const dir = button.dataset.dir;

    if (dir === "up") {
      setDirection({ x: 0, y: -1 });
    } else if (dir === "down") {
      setDirection({ x: 0, y: 1 });
    } else if (dir === "left") {
      setDirection({ x: -1, y: 0 });
    } else if (dir === "right") {
      setDirection({ x: 1, y: 0 });
    }
  });
});

createSnake();
updateHud();
render();
