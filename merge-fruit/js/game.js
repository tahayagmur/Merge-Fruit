const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Composite = Matter.Composite,
      Events = Matter.Events;

const FRUITS = [
    { level: 0, label: 'Erik', emoji: '🟣', color: '#5e2165', radius: 22, score: 2, imgSource: 'assets/images/plum.png?v=10' },
    { level: 1, label: 'Çilek', emoji: '🍓', color: '#ff3366', radius: 30, score: 4, imgSource: 'assets/images/strawberry.png?v=10' },
    { level: 2, label: 'Üzüm', emoji: '🍇', color: '#b300b3', radius: 40, score: 8, imgSource: 'assets/images/grape.png?v=10' },
    { level: 3, label: 'Elma', emoji: '🍎', color: '#e60000', radius: 52, score: 16, imgSource: 'assets/images/apple.png?v=10' },
    { level: 4, label: 'Portakal', emoji: '🍊', color: '#ff8000', radius: 64, score: 32, imgSource: 'assets/images/orange.png?v=10' },
    { level: 5, label: 'Şeftali', emoji: '🍑', color: '#ff9999', radius: 76, score: 64, imgSource: 'assets/images/peach.png?v=10' },
    { level: 6, label: 'Mango', emoji: '🥭', color: '#ffcc00', radius: 88, score: 128, imgSource: 'assets/images/mango.png?v=10' },
    { level: 7, label: 'Ejder Meyvesi', emoji: '🐉', color: '#ff0066', radius: 88, score: 256, imgSource: 'assets/images/dragonfruit.png?v=12', imgScale: 1.25 },
    { level: 8, label: 'Ananas', emoji: '🍍', color: '#ffb300', radius: 126, score: 512, imgSource: 'assets/images/pineapple.png?v=10' },
    { level: 9, label: 'Kavun', emoji: '🍈', color: '#ccff66', radius: 135, score: 1024, imgSource: 'assets/images/melon.png?v=10', imgScale: 1.08 },
    { level: 10, label: 'Karpuz', emoji: '🍉', color: '#00cc00', radius: 158, score: 2048, imgSource: 'assets/images/watermelon.png?v=10', imgScale: 1.08 }
];

// Preload images
FRUITS.forEach(fruit => {
    if (fruit.imgSource) {
        fruit.img = new Image();
        fruit.img.src = fruit.imgSource;
    }
});

let engine;
let runner;
let world;
let canvas, ctx;

let width, height;
let currentFruit = null;
let nextFruitLevel = 0;
let isDropping = false;
let score = 0;
let isGameOver = false;

// Physics boundaries
const WALL_THICKNESS = 60;
const BOTTOM_MARGIN = 0;

// Render loop variables
let particles = [];
let gameLoopId;

// DOM Elements
const scoreDisplay = document.getElementById('score-display');
const nextItemDisplay = document.getElementById('next-item-display');
const gameContainer = document.getElementById('game-container');
const canvasContainer = document.getElementById('canvas-container');
const gameOverLine = document.getElementById('game-over-line');
const modal = document.getElementById('game-over-modal');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const saveBtn = document.getElementById('save-score-btn');
const playerNameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');

// Meta-Game State
let coins = 0;
let boosts = { shake: 0, bomb: 0, swap: 0, upgrade: 0 };
let isGameStarted = false;
let bombMode = false;

// Meta-Game DOM Elements
const mainMenu = document.getElementById('main-menu');
const storeMenu = document.getElementById('store-menu');
const inGameHeader = document.getElementById('in-game-header');
const boostHud = document.getElementById('boost-hud');
const adOverlay = document.getElementById('ad-overlay');
const playBtn = document.getElementById('play-btn');
const storeBtn = document.getElementById('store-btn');
const storeBackBtn = document.getElementById('store-back-btn');
const storeReturnBtn = document.getElementById('store-return-btn');

function loadGameState() {
    try {
        const data = JSON.parse(localStorage.getItem('suikaGameState'));
        if (data) {
            coins = data.coins || 0;
            boosts = data.boosts || { shake: 0, bomb: 0, swap: 0, upgrade: 0 };
        }
    } catch(e) { console.error(e); }
    updateHUDs();
}

function saveGameState() {
    localStorage.setItem('suikaGameState', JSON.stringify({ coins, boosts }));
}

function updateHUDs() {
    document.getElementById('coin-display').innerText = coins;
    document.getElementById('store-coin-display').innerText = coins;
    // Store card badges (new design)
    const shakeBadge   = document.getElementById('store-count-shake-badge');
    const bombBadge    = document.getElementById('store-count-bomb-badge');
    const swapBadge    = document.getElementById('store-count-swap-badge');
    const upgradeBadge = document.getElementById('store-count-upgrade-badge');
    if (shakeBadge)   shakeBadge.innerText   = '×' + boosts.shake;
    if (bombBadge)    bombBadge.innerText    = '×' + boosts.bomb;
    if (swapBadge)    swapBadge.innerText    = '×' + boosts.swap;
    if (upgradeBadge) upgradeBadge.innerText = '×' + boosts.upgrade;
    // In-game HUD
    document.getElementById('count-shake').innerText   = boosts.shake;
    document.getElementById('count-bomb').innerText    = boosts.bomb;
    document.getElementById('count-swap').innerText    = boosts.swap;
    document.getElementById('count-upgrade').innerText = boosts.upgrade;
}

function initGame() {
    // Canvas setup
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    canvasContainer.appendChild(canvas);
    
    // Resize handler
    const resizeCanvas = () => {
        const rect = canvasContainer.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = width;
        canvas.height = height;
        ctx.imageSmoothingEnabled = true; // Use default anti-aliasing for smooth images
        
        if (world) {
            // Update boundaries if already initialized (simple approach: just reload, but we'll try to keep them)
            // For a simpler implementation, we assume mostly fixed aspect ratio and just set it once at start
        }
    };
    
    // Initial size
    resizeCanvas();
    
    // Physics Engine setup
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1.5; // Slightly higher gravity for snappier feel
    
    createBoundaries();
    
    // UI update
    updateScore(0);
    setNextFruit();
    createPreviewFruit();
    
    // Input Handlers
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    canvas.addEventListener('mouseup', handlePointerDrop);
    canvas.addEventListener('touchend', handlePointerDrop, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    
    // Collision handling
    Events.on(engine, 'collisionStart', handleCollisions);
    
    // Start game loop
    engine.positionIterations = 8;
    engine.velocityIterations = 8;
    
    lastTime = performance.now();
    gameLoopId = requestAnimationFrame(renderLoop);
    
    updateLeaderboardUI();
    loadGameState();
}

function createBoundaries() {
    const wallOptions = {
        isStatic: true,
        render: { fillStyle: 'transparent' },
        friction: 0.1,
        restitution: 0.2 // Bounciness
    };
    
    // Left, Right, Bottom walls
    const leftWall = Bodies.rectangle(-WALL_THICKNESS/2, height/2, WALL_THICKNESS, height * 2, wallOptions);
    const rightWall = Bodies.rectangle(width + WALL_THICKNESS/2, height/2, WALL_THICKNESS, height * 2, wallOptions);
    const bottomWall = Bodies.rectangle(width/2, height + WALL_THICKNESS/2 - BOTTOM_MARGIN, width * 2, WALL_THICKNESS, wallOptions);
    
    Composite.add(world, [leftWall, rightWall, bottomWall]);
}

function getRandomFruitLevel() {
    // Bias towards smaller fruits for drops (0, 1, 2)
    return Math.floor(Math.random() * 3);
}

function setNextFruit() {
    nextFruitLevel = getRandomFruitLevel();
    const nextFruit = FRUITS[nextFruitLevel];
    if (nextFruit.imgSource) {
        nextItemDisplay.innerHTML = `<img src="${nextFruit.imgSource}" style="width: 100%; height: 100%; object-fit: contain;">`;
    } else {
        nextItemDisplay.innerHTML = nextFruit.emoji;
        nextItemDisplay.style.fontSize = `${Math.min(nextFruit.radius * 1.5, 30)}px`;
    }
}

let previewX = 0;
function createPreviewFruit() {
    if (isGameOver) return;
    previewX = width / 2;
}

// Bomba modu: tiklanan meyveyi patlat
function handlePointerDown(e) {
    if (!bombMode || isGameOver || !isGameStarted) return;
    e.preventDefault();

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const bodies = Composite.allBodies(world);
    for (let body of bodies) {
        if (body.label === 'fruit') {
            const dx = body.position.x - x;
            const dy = body.position.y - y;
            if (Math.sqrt(dx*dx + dy*dy) <= body.circleRadius) {
                Composite.remove(world, body);
                boosts.bomb--;
                saveGameState();
                updateHUDs();
                bombMode = false;
                document.getElementById('btn-bomb').style.outline = '';
                break;
            }
        }
    }
}

function handlePointerMove(e) {
    if (isDropping || isGameOver || !isGameStarted || bombMode) return;
    
    e.preventDefault(); // Prevent scrolling on touch
    
    let clientX;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
    } else {
        clientX = e.clientX;
    }
    
    const rect = canvas.getBoundingClientRect();
    let x = clientX - rect.left;
    
    // Constrain x so fruit doesn't overlap walls
    const currentFruitConfig = FRUITS[nextFruitLevel];
    const r = currentFruitConfig.radius;
    x = Math.max(r, Math.min(x, width - r));
    
    previewX = x;
}

function handlePointerDrop(e) {
    if (isDropping || isGameOver || !isGameStarted || bombMode) return;
    if (e) e.preventDefault();
    
    isDropping = true;
    
    const fruitConfig = FRUITS[nextFruitLevel];
    const dropY = 50; // Drop from near top
    
    // Add physical body
    const body = Bodies.circle(previewX, dropY, fruitConfig.radius, {
        restitution: 0.2, // Bounciness
        friction: 0.1,
        density: 0.001 * (fruitConfig.level + 1), // Heavier fruits
        label: 'fruit',
        customData: {
            level: fruitConfig.level,
            emoji: fruitConfig.emoji,
            color: fruitConfig.color,
            hasDropped: true // Track if it has been dropped to prevent game over check on preview
        }
    });
    
    Composite.add(world, body);
    
    // Setup next fruit
    setNextFruit();
    
    // Cooldown
    setTimeout(() => {
        isDropping = false;
        createPreviewFruit();
    }, 1000);
}

function handleCollisions(event) {
    const pairs = event.pairs;
    
    let bodiesToRemove = [];
    let bodiesToAdd = [];
    
    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;
        
        if (bodyA.label === 'fruit' && bodyB.label === 'fruit') {
            const levelA = bodyA.customData.level;
            const levelB = bodyB.customData.level;
            
            if (levelA === levelB && levelA < FRUITS.length - 1) {
                // To prevent double processing, check if they are already in the remove list
                if (bodiesToRemove.includes(bodyA) || bodiesToRemove.includes(bodyB)) {
                    continue;
                }
                
                // Mark for removal
                bodiesToRemove.push(bodyA, bodyB);
                
                // Spawn new fruit
                const nextLevel = levelA + 1;
                const config = FRUITS[nextLevel];
                
                // Spawn at average position
                const newX = (bodyA.position.x + bodyB.position.x) / 2;
                const newY = (bodyA.position.y + bodyB.position.y) / 2;
                
                const newBody = Bodies.circle(newX, newY, config.radius, {
                    restitution: 0.2,
                    friction: 0.1,
                    density: 0.001 * (config.level + 1),
                    label: 'fruit',
                    customData: {
                        level: config.level,
                        emoji: config.emoji,
                        color: config.color,
                        hasDropped: true
                    }
                });
                
                // Add tiny random velocity to prevent perfect stacking lock
                Body.setVelocity(newBody, {
                    x: (Math.random() - 0.5) * 2,
                    y: (Math.random() - 0.5) * 2
                });
                
                bodiesToAdd.push(newBody);
                
                // Effects
                coins += 5;
                saveGameState();
                updateHUDs();
                updateScore(score + config.score);
                spawnParticles(newX, newY, config.color);
                triggerShake();
            }
        }
    }
    
    if (bodiesToRemove.length > 0) {
        Composite.remove(world, bodiesToRemove);
        Composite.add(world, bodiesToAdd);
    }
}

function spawnParticles(x, y, color) {
    const count = 15;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: color,
            life: 1.0,
            decay: Math.random() * 0.02 + 0.02,
            radius: Math.random() * 4 + 2
        });
    }
}

function triggerShake() {
    gameContainer.classList.remove('shake');
    void gameContainer.offsetWidth; // trigger reflow
    gameContainer.classList.add('shake');
    setTimeout(() => {
        gameContainer.classList.remove('shake');
    }, 300);
}

function updateScore(newScore) {
    score = newScore;
    scoreDisplay.innerText = score;
    
    // Scale animation
    scoreDisplay.style.transform = 'scale(1.3)';
    setTimeout(() => {
        scoreDisplay.style.transform = 'scale(1)';
    }, 150);
}

function checkGameOver() {
    if (isGameOver) return;
    
    const thresholdY = height * 0.15; // Match #game-over-line top: 15%
    let isDanger = false;
    
    const bodies = Composite.allBodies(world);
    for (let body of bodies) {
        if (body.label === 'fruit' && body.customData && body.customData.hasDropped) {
            // Check if top of the fruit is above threshold
            if (body.position.y - body.circleRadius < thresholdY) {
                // Only consider it danger if it's relatively still
                if (Math.abs(body.velocity.y) < 1 && Math.abs(body.velocity.x) < 1) {
                    isDanger = true;
                    // In a real implementation, we'd need a timer here.
                    // For now, simple instant game over or short delay
                    if (!body.dangerTime) {
                        body.dangerTime = Date.now();
                    } else if (Date.now() - body.dangerTime > 1500) { // 1.5s above line
                        triggerGameOver();
                        break;
                    }
                }
            } else {
                body.dangerTime = 0;
            }
        }
    }
    
    if (isDanger) {
        gameOverLine.classList.add('danger');
    } else {
        gameOverLine.classList.remove('danger');
    }
}

function triggerGameOver() {
    isGameOver = true;
    
    finalScoreEl.innerText = score;
    modal.classList.remove('hidden');
    playerNameInput.focus();
}

function restartGame() {
    // Clear world
    Composite.clear(world);
    Engine.clear(engine);
    
    createBoundaries();
    
    score = 0;
    updateScore(0);
    isGameOver = false;
    isDropping = false;
    particles = [];
    
    modal.classList.add('hidden');
    gameOverLine.classList.remove('danger');
    
    setNextFruit();
    createPreviewFruit();
    
    lastTime = performance.now();
}

function saveScore() {
    const name = playerNameInput.value.trim() || 'Gizemli Oyuncu';
    const currentScores = JSON.parse(localStorage.getItem('suikaScores')) || [];
    
    currentScores.push({ name, score, date: new Date().toLocaleDateString() });
    currentScores.sort((a, b) => b.score - a.score); // Descending
    const topScores = currentScores.slice(0, 5); // Keep top 5
    
    localStorage.setItem('suikaScores', JSON.stringify(topScores));
    updateLeaderboardUI();
    playerNameInput.value = ''; // clear input
    
    // Optionally change button text to indicate success
    saveBtn.innerText = 'KAYDEDİLDİ!';
    setTimeout(() => { saveBtn.innerText = 'SKORU KAYDET'; }, 2000);
}

function updateLeaderboardUI() {
    const scores = JSON.parse(localStorage.getItem('suikaScores')) || [];
    leaderboardList.innerHTML = '';
    
    if (scores.length === 0) {
        leaderboardList.innerHTML = '<li>Henüz skor kaydedilmedi.</li>';
        return;
    }
    
    scores.forEach((s, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${idx + 1}. ${s.name}</span> <span>${s.score}</span>`;
        leaderboardList.appendChild(li);
    });
}

let lastTime = 0;

function renderLoop(time) {
    if (!ctx) return;
    
    const delta = time - lastTime;
    lastTime = time;
    
    // Update physics manually for perfect frame sync (cap delta to 33ms to avoid huge jumps)
    if (isGameStarted && !isGameOver) {
        Engine.update(engine, Math.min(delta || 16.66, 33));
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    checkGameOver();
    
    // Draw preview fruit
    if (!isDropping && !isGameOver && isGameStarted) {
        const config = FRUITS[nextFruitLevel];
        const r = config.radius;
        const dropY = 50;
        
        ctx.save();
        ctx.globalAlpha = 0.5; // Make preview translucent
        
        // Draw fruit body
        if (config.img && config.img.complete && config.img.naturalWidth > 0) {
            const scale = config.imgScale || 1.0;
            const drawR = r * scale;
            ctx.drawImage(config.img, previewX - drawR, dropY - drawR, drawR * 2, drawR * 2);
        } else {
            // Draw emoji
            ctx.font = `${r * 1.2}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(config.emoji, previewX, dropY + r * 0.1);
        }
        
        ctx.restore();
    }
    
    // Draw physical bodies
    const bodies = Composite.allBodies(world);
    for (let body of bodies) {
        if (body.label === 'fruit' && body.customData) {
            const data = body.customData;
            const r = body.circleRadius;
            const pos = body.position;
            
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(body.angle);
            
            const config = FRUITS[data.level];
            
            if (config.img && config.img.complete && config.img.naturalWidth > 0) {
                // Let it rotate with the physics body
                const scale = config.imgScale || 1.0;
                const drawR = r * scale;
                ctx.drawImage(config.img, -drawR, -drawR, drawR * 2, drawR * 2);
            } else {
                // Fallback for fruits without images yet
                // Draw emoji
                ctx.font = `${r * 1.2}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Disable rotation for emoji to keep them upright, or let them spin. Spinning is funnier.
                ctx.fillText(data.emoji, 0, r * 0.1);
            }
            
            ctx.restore();
        }
    }
    
    // Draw and update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
        
        // Update physics
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // Gravity for particles
        p.life -= p.decay;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
    
    gameLoopId = requestAnimationFrame(renderLoop);
}

// Menu particle stub fonksiyonları (ileride animasyon eklenebilir)
function startMenuParticles() { /* TODO: menu arka plan animasyonu */ }
function stopMenuParticles()  { /* TODO: menu arka plan animasyonu durdur */ }

// Event Listeners for UI
restartBtn.addEventListener('click', () => {
    // Hide game over, show main menu
    modal.classList.add('hidden');
    canvasContainer.classList.add('hidden');
    inGameHeader.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    isGameStarted = false;
    startMenuParticles();
});
saveBtn.addEventListener('click', saveScore);

// Menu Navigation
playBtn.addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    canvasContainer.classList.remove('hidden');
    inGameHeader.classList.remove('hidden');
    
    // Update canvas dimensions now that it is visible
    const rect = canvasContainer.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        width = rect.width;
        height = rect.height;
        canvas.width = width;
        canvas.height = height;
        ctx.imageSmoothingEnabled = true;
    }
    
    restartGame();
    isGameStarted = true;
    stopMenuParticles();
});

function openStore(fromGame) {
    storeMenu.classList.remove('hidden');
    updateHUDs();
    // "Oyuna Dön" butonunu sadece oyun sırasında göster
    if (fromGame && isGameStarted && !isGameOver) {
        storeReturnBtn.style.display = 'block';
    } else {
        storeReturnBtn.style.display = 'none';
    }
}

storeBtn.addEventListener('click', () => {
    openStore(false);
});

storeBackBtn.addEventListener('click', () => {
    storeMenu.classList.add('hidden');
});

storeReturnBtn.addEventListener('click', () => {
    storeMenu.classList.add('hidden');
});

// ── REWARDED AD SİSTEMİ ──────────────────────────────────────────
// AdSense H5 Game Ad Placement API kullanımı.
// Publisher ID'ni index.html'de ca-pub-XXXXXXXXXXXXXXXX yerine yaz.

// adConfig başlangıçta bir kez çağrılır
if (typeof adConfig === 'function') {
    adConfig({
        preloadAdBreaks: 'on', // reklamları önceden yükle
        sound: 'on'
    });
}

// Ad overlay state yönetimi
const adStateLoading  = document.getElementById('ad-state-loading');
const adStateWatching = document.getElementById('ad-state-watching');
const adStateReward   = document.getElementById('ad-state-reward');
const adStateError    = document.getElementById('ad-state-error');
const adProgressFill  = document.getElementById('ad-progress-fill');
const adRewardText    = document.getElementById('ad-reward-text');
const adCloseBtn      = document.getElementById('ad-close-btn');

function setAdState(state) {
    adStateLoading.style.display  = state === 'loading'  ? '' : 'none';
    adStateWatching.style.display = state === 'watching' ? '' : 'none';
    adStateReward.style.display   = state === 'reward'   ? '' : 'none';
    adStateError.style.display    = state === 'error'    ? '' : 'none';
}

function showRewardedAd(boostType, boostName) {
    // Overlay'i aç, yükleniyor göster
    adOverlay.classList.remove('hidden');
    setAdState('loading');

    // AdSense hazır değilse simülasyon modu (geliştirme/test ortamı)
    const adsenseReady = typeof adBreak === 'function';

    if (adsenseReady) {
        adBreak({
            type: 'reward',
            name: 'boost-reward-' + boostType,

            // Reklam gösterilmeden önce çağrılır, showAdFn() ile reklamı başlatırız
            beforeReward: (showAdFn) => {
                setAdState('watching');
                animateAdProgress(30); // ~30 saniyelik progress bar
                showAdFn();
            },

            // Kullanıcı reklamı tam izlemeden kapattı
            adDismissed: () => {
                stopAdProgress();
                adOverlay.classList.add('hidden');
            },

            // Kullanıcı reklamı tam izledi → ödül ver
            adViewed: () => {
                stopAdProgress();
                giveBoostReward(boostType, boostName);
            },

            // Reklam bulunamadı veya hata
            afterAd: () => {
                // adViewed ya da adDismissed zaten çağrıldıysa burada ek işlem yok
            }
        });

        // Eğer birkaç saniye içinde beforeReward gelmezse reklam yok demektir
        const noAdTimer = setTimeout(() => {
            if (adStateLoading.style.display !== 'none') {
                setAdState('error');
            }
        }, 8000);
        adOverlay._noAdTimer = noAdTimer;

    } else {
        // ---- GELİŞTİRME / TEST MODU ----
        // AdSense Publisher ID girilmemiş ortamlarda simülasyon çalışır
        console.warn('[Ad] AdSense hazır değil – simülasyon modu aktif');
        setAdState('watching');
        let progress = 0;
        adProgressFill.style.width = '0%';
        const sim = setInterval(() => {
            progress += 3.3;
            adProgressFill.style.width = Math.min(progress, 100) + '%';
            if (progress >= 100) {
                clearInterval(sim);
                giveBoostReward(boostType, boostName);
            }
        }, 1000);
        adOverlay._simInterval = sim;
    }
}

// Progress bar animasyonu
let adProgressInterval = null;
function animateAdProgress(durationSec) {
    adProgressFill.style.width = '0%';
    let elapsed = 0;
    const step = 200; // ms
    adProgressInterval = setInterval(() => {
        elapsed += step;
        const pct = Math.min((elapsed / (durationSec * 1000)) * 100, 99);
        adProgressFill.style.width = pct + '%';
    }, step);
}
function stopAdProgress() {
    if (adProgressInterval) { clearInterval(adProgressInterval); adProgressInterval = null; }
    if (adOverlay._noAdTimer)   { clearTimeout(adOverlay._noAdTimer);   adOverlay._noAdTimer = null; }
    if (adOverlay._simInterval) { clearInterval(adOverlay._simInterval); adOverlay._simInterval = null; }
    adProgressFill.style.width = '100%';
}

// Ödül ver ve overlay'i kapat
function giveBoostReward(boostType, boostName) {
    boosts[boostType]++;
    saveGameState();
    updateHUDs();

    const icons = { shake:'🫨', bomb:'💣', swap:'🔄', upgrade:'⭐' };
    adRewardText.innerText = `${icons[boostType] || '🎁'} ${boostName} boost'u kazanıldı!`;
    setAdState('reward');

    setTimeout(() => {
        adOverlay.classList.add('hidden');
    }, 2200);
}

// Hata ekranındaki "Tamam" butonu
if (adCloseBtn) {
    adCloseBtn.addEventListener('click', () => {
        adOverlay.classList.add('hidden');
    });
}

// ── STORE PURCHASES ──────────────────────────────────────────────

// ── STORE PURCHASES ──────────────────────────────────────────────
const BOOST_NAMES = { shake: 'Sarsinti', bomb: 'Bomba', swap: 'Donusturucu', upgrade: 'Seviye Atlama' };

document.querySelectorAll('.buy-coin-btn, .store-buy-coin').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type  = btn.dataset.type;
        const price = parseInt(btn.dataset.price, 10);
        if (coins >= price) {
            coins -= price;
            boosts[type]++;
            saveGameState();
            updateHUDs();
            // Kisa titresim efekti
            btn.style.transform = 'scale(0.92)';
            setTimeout(() => btn.style.transform = '', 150);
        } else {
            btn.style.background = '#ef4444';
            btn.textContent = 'Yetersiz!';
            setTimeout(() => {
                btn.style.background = '';
                btn.textContent = '🪙 ' + price;
            }, 1200);
        }
    });
});

document.querySelectorAll('.buy-ad-btn, .store-buy-ad').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type = btn.dataset.type;
        const name = BOOST_NAMES[type] || type;
        showRewardedAd(type, name);
    });
});

// ── BOOST HUD BUTONLARI ──────────────────────────────────────────
document.getElementById('btn-shake').addEventListener('click', () => {
    if (boosts.shake > 0 && isGameStarted && !isGameOver) {
        boosts.shake--;
        saveGameState();
        updateHUDs();
        // Tum meyveler rastgele itilir
        const bodies = Matter.Composite.allBodies(world).filter(b => b.label === 'fruit');
        bodies.forEach(b => {
            Matter.Body.applyForce(b, b.position, {
                x: (Math.random() - 0.5) * 0.08,
                y: -Math.random() * 0.06
            });
        });
    } else if (boosts.shake === 0) {
        openStore(true);
    }
});

document.getElementById('btn-bomb').addEventListener('click', () => {
    if (boosts.bomb > 0 && isGameStarted && !isGameOver) {
        bombMode = true;
        document.getElementById('btn-bomb').style.outline = '3px solid #ef4444';
    } else if (boosts.bomb === 0) {
        openStore(true);
    }
});

document.getElementById('btn-swap').addEventListener('click', () => {
    if (boosts.swap > 0 && isGameStarted && !isGameOver) {
        boosts.swap--;
        saveGameState();
        updateHUDs();
        setNextFruit();
        createPreviewFruit();
    } else if (boosts.swap === 0) {
        openStore(true);
    }
});

document.getElementById('btn-upgrade').addEventListener('click', () => {
    if (boosts.upgrade > 0 && isGameStarted && !isGameOver) {
        boosts.upgrade--;
        saveGameState();
        updateHUDs();
        if (nextFruitLevel < FRUITS.length - 1) {
            nextFruitLevel++;
            createPreviewFruit();
        }
    } else if (boosts.upgrade === 0) {
        openStore(true);
    }
});


// ── OYUNU BASLAT (script body sonunda yuklendigindan direkt cagri) ──
initGame();
