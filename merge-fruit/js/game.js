'use strict';

const Engine    = Matter.Engine;
const Bodies    = Matter.Bodies;
const Body      = Matter.Body;
const Composite = Matter.Composite;
const Events    = Matter.Events;

// ── MEYVE TANIMLARI ─────────────────────────────────────────────
const FRUITS = [
    { level:0,  label:'Erik',          emoji:'🟣', color:'#5e2165', radius:22,  score:2,    imgSource:'assets/images/plum.png?v=10' },
    { level:1,  label:'Cilek',         emoji:'🍓', color:'#ff3366', radius:30,  score:4,    imgSource:'assets/images/strawberry.png?v=10' },
    { level:2,  label:'Uzum',          emoji:'🍇', color:'#b300b3', radius:40,  score:8,    imgSource:'assets/images/grape.png?v=10' },
    { level:3,  label:'Elma',          emoji:'🍎', color:'#e60000', radius:52,  score:16,   imgSource:'assets/images/apple.png?v=10' },
    { level:4,  label:'Portakal',      emoji:'🍊', color:'#ff8000', radius:64,  score:32,   imgSource:'assets/images/orange.png?v=10' },
    { level:5,  label:'Seftali',       emoji:'🍑', color:'#ff9999', radius:76,  score:64,   imgSource:'assets/images/peach.png?v=10' },
    { level:6,  label:'Mango',         emoji:'🥭', color:'#ffcc00', radius:88,  score:128,  imgSource:'assets/images/mango.png?v=10' },
    { level:7,  label:'Ejder Meyvesi', emoji:'🐉', color:'#ff0066', radius:88,  score:256,  imgSource:'assets/images/dragonfruit.png?v=12', imgScale:1.25 },
    { level:8,  label:'Ananas',        emoji:'🍍', color:'#ffb300', radius:126, score:512,  imgSource:'assets/images/pineapple.png?v=10' },
    { level:9,  label:'Kavun',         emoji:'🍈', color:'#ccff66', radius:135, score:1024, imgSource:'assets/images/melon.png?v=10',       imgScale:1.08 },
    { level:10, label:'Karpuz',        emoji:'🍉', color:'#00cc00', radius:158, score:2048, imgSource:'assets/images/watermelon.png?v=10',  imgScale:1.08 }
];

FRUITS.forEach(function(f) {
    if (f.imgSource) { f.img = new Image(); f.img.src = f.imgSource; }
});

// ── DURUM DEGİSKENLERİ ──────────────────────────────────────────
var engine, world, canvas, ctx;
var width = 0, height = 0;
var nextFruitLevel = 0;
var previewX = 0;
var isDropping   = false;
var isGameOver   = false;
var isGameStarted= false;
var bombMode     = false;
var score  = 0;
var coins  = 0;
var boosts = { shake:0, bomb:0, swap:0, upgrade:0 };
var particles  = [];
var gameLoopId = null;
var lastTime   = 0;
var WALL_T = 60;

// ── SES SİSTEMİ ──────────────────────────────────────────────────
var audioCtx = null;
var isMuted  = (localStorage.getItem('mf_muted') === '1');
var audioUnlocked = false;

function unlockAudio() {
    if (audioUnlocked) return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        // Sessiz bir ses çal — tarayıcı kilidini açar
        var buf = audioCtx.createBuffer(1, 1, 22050);
        var src = audioCtx.createBufferSource();
        src.buffer = buf; src.connect(audioCtx.destination); src.start(0);
        audioUnlocked = true;
    } catch(e) {}
}
// İlk tıklamada AudioContext'i aç
document.addEventListener('click',     unlockAudio, { once: false });
document.addEventListener('touchstart',unlockAudio, { once: false });

function getAudioCtx() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}
function playTone(freq, type, dur, vol, delay) {
    if (isMuted) return;
    var ac = getAudioCtx(); if (!ac) return;
    if (ac.state === 'suspended') { ac.resume(); return; }
    try {
        var t  = ac.currentTime + (delay || 0);
        var o  = ac.createOscillator();
        var g  = ac.createGain();
        // Compressor ekle — sesi daha belirgin yapar
        var comp = ac.createDynamicsCompressor();
        o.connect(g); g.connect(comp); comp.connect(ac.destination);
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(Math.min(vol || 0.4, 0.8), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.2));
        o.start(t); o.stop(t + (dur || 0.2) + 0.05);
    } catch(e) {}
}
function playMergeSound(level) {
    var f = 260 + level * 80;
    playTone(f,       'sine',     0.15, 0.5);
    playTone(f * 1.5, 'triangle', 0.12, 0.3, 0.07);
}
function playDropSound() {
    playTone(180, 'sine', 0.08, 0.3);
    playTone(120, 'sine', 0.06, 0.2, 0.04);
}
function playGameOverSound() {
    playTone(440, 'sawtooth', 0.3, 0.5);
    playTone(330, 'sawtooth', 0.3, 0.4, 0.2);
    playTone(220, 'sawtooth', 0.5, 0.4, 0.4);
    playTone(150, 'sawtooth', 0.6, 0.35, 0.65);
}
function playWatermelonSound() {
    [523, 659, 784, 880, 1047].forEach(function(f, i) {
        playTone(f, 'sine', 0.4, 0.5, i * 0.1);
    });
}
function playComboSound(count) {
    var f = 400 + count * 100;
    playTone(f,       'triangle', 0.2, 0.5);
    playTone(f * 1.2, 'sine',     0.15, 0.3, 0.08);
}

// ── EN İYİ SKOR ──────────────────────────────────────────────────
var bestScore = parseInt(localStorage.getItem('mf_best') || '0', 10);
function updateBestScore() {
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('mf_best', bestScore);
        return true;
    }
    return false;
}
function refreshBestScoreUI() {
    var el = $('best-score-header');
    if (el) el.innerText = bestScore;
}

// ── COMBO SİSTEMİ ─────────────────────────────────────────────────
var comboCount    = 0;
var lastMergeTime = 0;
var COMBO_TIMEOUT = 2200;
var mergeFlashes  = [];

function showComboDisplay(text) {
    var el = $('combo-display');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    el.classList.remove('hidden');
    setTimeout(function() { el.classList.add('hidden'); }, 900);
}

// ── TUTORIAL ──────────────────────────────────────────────────────
var hasSeenTutorial = !!localStorage.getItem('mf_tutorial');
function showTutorial() {
    if (hasSeenTutorial) return;
    var el = $('tutorial-overlay');
    if (!el) return;
    el.classList.remove('hidden');
    setTimeout(function() { el.classList.add('hidden'); }, 3200);
    localStorage.setItem('mf_tutorial', '1');
    hasSeenTutorial = true;
}

// ── DOM ─────────────────────────────────────────────────────────
function $(id){ return document.getElementById(id); }
var scoreDisplay    = $('score-display');
var nextItemDisplay = $('next-item-display');
var gameContainer   = $('game-container');
var canvasContainer = $('canvas-container');
var gameOverLine    = $('game-over-line');
var modal           = $('game-over-modal');
var finalScoreEl    = $('final-score');
var restartBtn      = $('restart-btn');
var saveBtn         = $('save-score-btn');
var playerNameInput = $('player-name');
var leaderboardList = $('leaderboard-list');
var mainMenu        = $('main-menu');
var storeMenu       = $('store-menu');
var inGameHeader    = $('in-game-header');
var adOverlay       = $('ad-overlay');
var playBtn         = $('play-btn');
var storeBtn        = $('store-btn');
var storeBackBtn    = $('store-back-btn');
var storeReturnBtn  = $('store-return-btn');
var adStateLoading  = $('ad-state-loading');
var adStateWatching = $('ad-state-watching');
var adStateReward   = $('ad-state-reward');
var adStateError    = $('ad-state-error');
var adProgressFill  = $('ad-progress-fill');
var adRewardText    = $('ad-reward-text');
var adCloseBtn      = $('ad-close-btn');

// ── KAYIT ────────────────────────────────────────────────────────
function loadGameState() {
    try {
        var d = JSON.parse(localStorage.getItem('suikaGameState'));
        if (d) { coins = d.coins || 0; boosts = d.boosts || { shake:0, bomb:0, swap:0, upgrade:0 }; }
    } catch(e) {}
    updateHUDs();
}
function saveGameState() {
    localStorage.setItem('suikaGameState', JSON.stringify({ coins: coins, boosts: boosts }));
}
function updateHUDs() {
    $('coin-display').innerText       = coins;
    $('store-coin-display').innerText = coins;
    var sb = $('store-count-shake-badge');   if(sb) sb.innerText   = 'x' + boosts.shake;
    var bb = $('store-count-bomb-badge');    if(bb) bb.innerText   = 'x' + boosts.bomb;
    var wb = $('store-count-swap-badge');    if(wb) wb.innerText   = 'x' + boosts.swap;
    var ub = $('store-count-upgrade-badge'); if(ub) ub.innerText   = 'x' + boosts.upgrade;
    $('count-shake').innerText   = boosts.shake;
    $('count-bomb').innerText    = boosts.bomb;
    $('count-swap').innerText    = boosts.swap;
    $('count-upgrade').innerText = boosts.upgrade;
}

// ── SKOR ─────────────────────────────────────────────────────────
function updateScore(v) {
    score = v;
    scoreDisplay.innerText = score;
    scoreDisplay.style.transform = 'scale(1.3)';
    setTimeout(function(){ scoreDisplay.style.transform = 'scale(1)'; }, 150);
}

// ── LIDERLIK ─────────────────────────────────────────────────────
function updateLeaderboardUI() {
    var scores = JSON.parse(localStorage.getItem('suikaScores')) || [];
    if (scores.length === 0) { leaderboardList.innerHTML = '<li>Henuz skor kaydedilmedi.</li>'; return; }
    leaderboardList.innerHTML = scores.map(function(s,i){ return '<li><span>'+(i+1)+'. '+s.name+'</span><span>'+s.score+'</span></li>'; }).join('');
}
function saveScore() {
    var name = playerNameInput.value.trim() || 'Gizemli Oyuncu';
    var list = JSON.parse(localStorage.getItem('suikaScores')) || [];
    list.push({ name:name, score:score, date:new Date().toLocaleDateString() });
    list.sort(function(a,b){ return b.score - a.score; });
    localStorage.setItem('suikaScores', JSON.stringify(list.slice(0,5)));
    updateLeaderboardUI();
    playerNameInput.value = '';
    saveBtn.innerText = 'KAYDEDILDI!';
    setTimeout(function(){ saveBtn.innerText = 'SKORU KAYDET'; }, 2000);
}

// ── FİZİK SINIRLARI ──────────────────────────────────────────────
function createBoundaries() {
    var opt = { isStatic:true, friction:0.1, restitution:0.2, render:{ fillStyle:'transparent' } };
    Composite.add(world, [
        Bodies.rectangle(-WALL_T/2,        height/2, WALL_T,  height*2, opt),
        Bodies.rectangle(width + WALL_T/2, height/2, WALL_T,  height*2, opt),
        Bodies.rectangle(width/2, height + WALL_T/2, width*2, WALL_T,   opt)
    ]);
}

// ── SIRADAKI MEYVE ───────────────────────────────────────────────
function getRandomFruitLevel() { return Math.floor(Math.random() * 3); }
function setNextFruit() {
    nextFruitLevel = getRandomFruitLevel();
    var f = FRUITS[nextFruitLevel];
    nextItemDisplay.innerHTML = f.imgSource
        ? '<img src="' + f.imgSource + '" style="width:100%;height:100%;object-fit:contain;">'
        : f.emoji;
}
function createPreviewFruit() {
    if (!isGameOver) previewX = width / 2;
}

// ── GİRİŞ OLAYLARI ───────────────────────────────────────────────
function getXY(e) {
    var rect = canvas.getBoundingClientRect();
    var src  = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

function handlePointerMove(e) {
    if (isDropping || isGameOver || !isGameStarted || bombMode) return;
    e.preventDefault();
    var p = getXY(e);
    var r = FRUITS[nextFruitLevel].radius;
    previewX = Math.max(r, Math.min(p.x, width - r));
}

function handlePointerDown(e) {
    if (!isGameStarted || isGameOver || !bombMode) return;
    e.preventDefault();
    var p = getXY(e);
    var bodies = Composite.allBodies(world);
    for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        if (b.label !== 'fruit') continue;
        var dx = b.position.x - p.x, dy = b.position.y - p.y;
        if (Math.sqrt(dx*dx + dy*dy) <= b.circleRadius) {
            Composite.remove(world, b);
            boosts.bomb--;
            saveGameState();
            updateHUDs();
            bombMode = false;
            $('btn-bomb').style.outline = '';
            break;
        }
    }
}

function handlePointerDrop(e) {
    if (isDropping || isGameOver || !isGameStarted || bombMode) return;
    if (e) e.preventDefault();
    isDropping = true;
    playDropSound();
    var cfg = FRUITS[nextFruitLevel];
    var body = Bodies.circle(previewX, 50, cfg.radius, {
        restitution:0.2, friction:0.1,
        density: 0.001 * (cfg.level + 1),
        label:'fruit',
        customData:{ level:cfg.level, emoji:cfg.emoji, color:cfg.color, hasDropped:true }
    });
    Composite.add(world, body);
    setNextFruit();
    setTimeout(function(){ isDropping = false; createPreviewFruit(); }, 600);
}

// ── ÇARPIŞMA ─────────────────────────────────────────────────────
function handleCollisions(event) {
    var toRemove = [], toAdd = [];
    var pairs = event.pairs;
    for (var i = 0; i < pairs.length; i++) {
        var bA = pairs[i].bodyA, bB = pairs[i].bodyB;
        if (bA.label !== 'fruit' || bB.label !== 'fruit') continue;
        if (bA.customData.level !== bB.customData.level) continue;
        if (toRemove.indexOf(bA) >= 0 || toRemove.indexOf(bB) >= 0) continue;
        if (bA.customData.level >= FRUITS.length - 1) continue;
        toRemove.push(bA, bB);
        var lvl = bA.customData.level + 1;
        var cfg = FRUITS[lvl];
        var nx = (bA.position.x + bB.position.x) / 2;
        var ny = (bA.position.y + bB.position.y) / 2;
        var nb = Bodies.circle(nx, ny, cfg.radius, {
            restitution:0.2, friction:0.1,
            density:0.001*(lvl+1), label:'fruit',
            customData:{ level:cfg.level, emoji:cfg.emoji, color:cfg.color, hasDropped:true }
        });
        Body.setVelocity(nb, { x:(Math.random()-.5)*2, y:(Math.random()-.5)*2 });
        toAdd.push(nb);
        coins += 5; saveGameState(); updateHUDs();

        // Combo sistemi
        var now = Date.now();
        if (now - lastMergeTime < COMBO_TIMEOUT) { comboCount++; } else { comboCount = 1; }
        lastMergeTime = now;
        var multiplier = comboCount >= 6 ? 4 : comboCount >= 4 ? 3 : comboCount >= 2 ? 2 : 1;
        var points = cfg.score * multiplier;
        updateScore(score + points);

        // Combo göster
        if (comboCount >= 2) {
            playComboSound(comboCount);
            if      (comboCount >= 6) showComboDisplay('🔥 x4 COMBO!');
            else if (comboCount >= 4) showComboDisplay('⚡ x3 COMBO!');
            else                      showComboDisplay('✨ x2 COMBO!');
        }

        // Merge sesi
        playMergeSound(lvl);

        // Birleşme flash efekti
        mergeFlashes.push({ x:nx, y:ny, r:cfg.radius*1.8, life:1, color:cfg.color });

        // Karpuz özel animasyon
        if (lvl === FRUITS.length - 1) {
            playWatermelonSound();
            for (var w = 0; w < 30; w++) {
                var a = Math.random()*Math.PI*2, s = Math.random()*9+4;
                particles.push({ x:nx, y:ny, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
                    color: w%2===0 ? '#00cc00' : '#ff3366',
                    life:1.5, decay:0.02, radius:Math.random()*7+3 });
            }
        }

        spawnParticles(nx, ny, cfg.color);
        triggerShake();
    }
    if (toRemove.length) { Composite.remove(world, toRemove); Composite.add(world, toAdd); }
}

function spawnParticles(x, y, color) {
    for (var i = 0; i < 15; i++) {
        var a = Math.random()*Math.PI*2, s = Math.random()*5+2;
        particles.push({ x:x, y:y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, color:color, life:1, decay:Math.random()*.02+.02, radius:Math.random()*4+2 });
    }
}
function triggerShake() {
    gameContainer.classList.remove('shake');
    void gameContainer.offsetWidth;
    gameContainer.classList.add('shake');
    setTimeout(function(){ gameContainer.classList.remove('shake'); }, 300);
}

// ── OYUN BİTİŞİ ──────────────────────────────────────────────────
function checkGameOver() {
    if (isGameOver) return;
    var threshold = height * 0.15;
    var danger = false;
    var bodies = Composite.allBodies(world);
    for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        if (b.label !== 'fruit' || !b.customData || !b.customData.hasDropped) continue;
        if (b.position.y - b.circleRadius < threshold) {
            if (Math.abs(b.velocity.y) < 1 && Math.abs(b.velocity.x) < 1) {
                danger = true;
                if (!b.dangerTime) b.dangerTime = Date.now();
                else if (Date.now() - b.dangerTime > 1500) { triggerGameOver(); return; }
            }
        } else { b.dangerTime = 0; }
    }
    if (danger) gameOverLine.classList.add('danger');
    else        gameOverLine.classList.remove('danger');
}
function triggerGameOver() {
    isGameOver = true;
    playGameOverSound();
    finalScoreEl.innerText = score;
    var isNewBest = updateBestScore();
    var bestLine = $('best-score-line');
    if (bestLine) {
        bestLine.innerText = isNewBest ? '🏆 YENİ REKORsun! En İyi: ' + bestScore : '🥇 En İyi Skorun: ' + bestScore;
    }
    refreshBestScoreUI();
    modal.classList.remove('hidden');
    playerNameInput.focus();
}

// ── RENDER ───────────────────────────────────────────────────────
function drawFruit(cfg, cx, cy, r, centered) {
    var dr = r * (cfg.imgScale || 1.0);
    if (cfg.img && cfg.img.complete && cfg.img.naturalWidth > 0) {
        if (centered) ctx.drawImage(cfg.img, -dr, -dr, dr*2, dr*2);
        else          ctx.drawImage(cfg.img, cx-dr, cy-dr, dr*2, dr*2);
    } else {
        ctx.font = (r*1.2) + 'px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.emoji, centered ? 0 : cx, centered ? r*0.1 : cy+r*0.1);
    }
}

function renderLoop(time) {
    gameLoopId = requestAnimationFrame(renderLoop);
    var delta = time - lastTime;
    lastTime = time;
    if (isGameStarted && !isGameOver)
        Engine.update(engine, Math.min(delta || 16.66, 33));
    ctx.clearRect(0, 0, width, height);
    checkGameOver();

    // Onizleme
    if (!isDropping && !isGameOver && isGameStarted) {
        var cfg = FRUITS[nextFruitLevel];
        ctx.save(); ctx.globalAlpha = 0.55;
        drawFruit(cfg, previewX, 50, cfg.radius, false);
        ctx.restore();
    }

    // Cisimler
    var bodies = Composite.allBodies(world);
    for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        if (b.label !== 'fruit' || !b.customData) continue;
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        drawFruit(FRUITS[b.customData.level], 0, 0, b.circleRadius, true);
        ctx.restore();
    }

    // Parcaciklar
    for (var j = particles.length - 1; j >= 0; j--) {
        var p = particles[j];
        ctx.save(); ctx.globalAlpha = p.life > 1 ? 1 : p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
        ctx.fillStyle = p.color; ctx.fill(); ctx.restore();
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= p.decay;
        if (p.life <= 0) particles.splice(j, 1);
    }

    // Merge flash efektleri
    for (var k = mergeFlashes.length - 1; k >= 0; k--) {
        var fl = mergeFlashes[k];
        ctx.save();
        ctx.globalAlpha = fl.life * 0.6;
        ctx.beginPath();
        ctx.arc(fl.x, fl.y, fl.r * (2 - fl.life), 0, Math.PI*2);
        ctx.strokeStyle = fl.color;
        ctx.lineWidth = 4 * fl.life;
        ctx.stroke();
        ctx.restore();
        fl.life -= 0.08;
        if (fl.life <= 0) mergeFlashes.splice(k, 1);
    }
}

// ── YENIDEN BASLAT ───────────────────────────────────────────────
function restartGame() {
    Composite.clear(world);
    createBoundaries();
    score = 0; updateScore(0);
    comboCount = 0; lastMergeTime = 0; mergeFlashes = [];
    isGameOver = false; isDropping = false; bombMode = false; particles = [];
    $('btn-bomb').style.outline = '';
    modal.classList.add('hidden');
    gameOverLine.classList.remove('danger');
    setNextFruit(); createPreviewFruit();
    lastTime = performance.now();
}

function initGame() {
    canvas = document.createElement('canvas');
    ctx    = canvas.getContext('2d');
    canvasContainer.appendChild(canvas);

    engine = Engine.create();
    world  = engine.world;
    engine.gravity.y = 1.5;

    width  = 400; height = 600;
    canvas.width = width; canvas.height = height;
    ctx.imageSmoothingEnabled = true;

    createBoundaries();
    updateScore(0); setNextFruit(); createPreviewFruit();

    canvas.addEventListener('mousemove',   handlePointerMove,  { passive:false });
    canvas.addEventListener('touchmove',   handlePointerMove,  { passive:false });
    canvas.addEventListener('mouseup',     handlePointerDrop,  { passive:false });
    canvas.addEventListener('touchend',    handlePointerDrop,  { passive:false });
    canvas.addEventListener('pointerdown', handlePointerDown,  { passive:false });

    Events.on(engine, 'collisionStart', handleCollisions);
    lastTime = performance.now();
    gameLoopId = requestAnimationFrame(renderLoop);
    updateLeaderboardUI();
    loadGameState();
}

// ── MAGAZA ───────────────────────────────────────────────────────
function openStore(fromGame) {
    storeMenu.classList.remove('hidden');
    updateHUDs();
    storeReturnBtn.style.display = (fromGame && isGameStarted && !isGameOver) ? 'block' : 'none';
}

// ── REKLAM ───────────────────────────────────────────────────────
function setAdState(s) {
    adStateLoading.style.display  = s==='loading'  ? '' : 'none';
    adStateWatching.style.display = s==='watching' ? '' : 'none';
    adStateReward.style.display   = s==='reward'   ? '' : 'none';
    adStateError.style.display    = s==='error'    ? '' : 'none';
}
var adProgressInterval = null;
function stopAdProgress() {
    if (adProgressInterval) { clearInterval(adProgressInterval); adProgressInterval = null; }
    if (adOverlay._noAdTimer)   { clearTimeout(adOverlay._noAdTimer);    adOverlay._noAdTimer   = null; }
    if (adOverlay._simInterval) { clearInterval(adOverlay._simInterval); adOverlay._simInterval = null; }
    adProgressFill.style.width = '100%';
}
function giveBoostReward(type, name) {
    boosts[type]++;
    saveGameState(); updateHUDs();
    var icons = { shake:'🫨', bomb:'💣', swap:'🔄', upgrade:'⭐' };
    adRewardText.innerText = (icons[type]||'🎁') + ' ' + name + " boost'u kazanildi!";
    setAdState('reward');
    setTimeout(function(){ adOverlay.classList.add('hidden'); }, 2500);
}
function showRewardedAd(type, name) {
    adOverlay.classList.remove('hidden');
    setAdState('loading');
    if (typeof adBreak === 'function') {
        adBreak({
            type:'reward', name:'boost-reward-'+type,
            beforeReward: function(show){ setAdState('watching'); adProgressFill.style.width='0%'; var e=0; adProgressInterval=setInterval(function(){ e+=200; adProgressFill.style.width=Math.min(e/30000*100,99)+'%'; },200); show(); },
            adDismissed:  function(){ stopAdProgress(); adOverlay.classList.add('hidden'); },
            adViewed:     function(){ stopAdProgress(); giveBoostReward(type, name); },
            afterAd:      function(){}
        });
        adOverlay._noAdTimer = setTimeout(function(){ if(adStateLoading.style.display!=='none') setAdState('error'); }, 8000);
    } else {
        setAdState('watching');
        var p = 0; adProgressFill.style.width = '0%';
        adOverlay._simInterval = setInterval(function(){
            p += 3.3; adProgressFill.style.width = Math.min(p,100)+'%';
            if(p>=100){ clearInterval(adOverlay._simInterval); giveBoostReward(type,name); }
        }, 1000);
    }
}

// ── UI OLAYLARI ──────────────────────────────────────────────────
playBtn.addEventListener('click', function() {
    mainMenu.classList.add('hidden');
    canvasContainer.classList.remove('hidden');
    inGameHeader.classList.remove('hidden');

    // offsetWidth/offsetHeight layout'u zorlar — senkron ve güvenilir
    try {
        var cw = gameContainer.offsetWidth  || 400;
        var hh = inGameHeader.offsetHeight  || 80;
        var ch = gameContainer.offsetHeight || 700;
        width  = cw;
        height = Math.max(ch - hh, 300);
    } catch(e) {
        width = 400; height = 580;
    }
    canvas.width  = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;

    restartGame();
    isGameStarted = true;
    showTutorial();
    refreshBestScoreUI();
});

restartBtn.addEventListener('click', function() {
    modal.classList.add('hidden');
    canvasContainer.classList.add('hidden');
    inGameHeader.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    isGameStarted = false;
});

saveBtn.addEventListener('click', saveScore);
storeBtn.addEventListener('click',       function(){ openStore(false); });
storeBackBtn.addEventListener('click',   function(){ storeMenu.classList.add('hidden'); });
storeReturnBtn.addEventListener('click', function(){ storeMenu.classList.add('hidden'); });
if (adCloseBtn) adCloseBtn.addEventListener('click', function(){ adOverlay.classList.add('hidden'); });

$('btn-shake').addEventListener('click', function() {
    if (!isGameStarted || isGameOver) return;
    if (boosts.shake > 0) {
        boosts.shake--; saveGameState(); updateHUDs();
        var bodies = Composite.allBodies(world);
        for (var i = 0; i < bodies.length; i++) {
            if (bodies[i].label === 'fruit')
                Body.applyForce(bodies[i], bodies[i].position, { x:(Math.random()-.5)*.08, y:-Math.random()*.06 });
        }
    } else openStore(true);
});
$('btn-bomb').addEventListener('click', function() {
    if (!isGameStarted || isGameOver) return;
    if (boosts.bomb > 0) { bombMode = true; $('btn-bomb').style.outline = '3px solid #ef4444'; }
    else openStore(true);
});
$('btn-swap').addEventListener('click', function() {
    if (!isGameStarted || isGameOver) return;
    if (boosts.swap > 0) { boosts.swap--; saveGameState(); updateHUDs(); setNextFruit(); createPreviewFruit(); }
    else openStore(true);
});
$('btn-upgrade').addEventListener('click', function() {
    if (!isGameStarted || isGameOver) return;
    if (boosts.upgrade > 0) {
        boosts.upgrade--; saveGameState(); updateHUDs();
        if (nextFruitLevel < FRUITS.length-1) { nextFruitLevel++; createPreviewFruit(); }
    } else openStore(true);
});

var BOOST_NAMES = { shake:'Sarsinti', bomb:'Bomba', swap:'Donusturucu', upgrade:'Seviye Atlama' };
document.querySelectorAll('.buy-coin-btn, .store-buy-coin').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var type = btn.dataset.type, price = parseInt(btn.dataset.price, 10);
        if (coins >= price) {
            coins -= price; boosts[type]++; saveGameState(); updateHUDs();
            btn.style.transform = 'scale(0.92)';
            setTimeout(function(){ btn.style.transform = ''; }, 150);
        } else {
            var orig = btn.textContent;
            btn.textContent = 'Yetersiz!'; btn.style.background = '#ef4444';
            setTimeout(function(){ btn.textContent = orig; btn.style.background = ''; }, 1200);
        }
    });
});
document.querySelectorAll('.buy-ad-btn, .store-buy-ad').forEach(function(btn) {
    btn.addEventListener('click', function(){ showRewardedAd(btn.dataset.type, BOOST_NAMES[btn.dataset.type] || btn.dataset.type); });
});


// ── MUTE BUTONU ───────────────────────────────────────────────────
var muteBtn = $('mute-btn');
if (muteBtn) {
    muteBtn.innerText = isMuted ? '🔇' : '🔊';
    muteBtn.addEventListener('click', function() {
        isMuted = !isMuted;
        localStorage.setItem('mf_muted', isMuted ? '1' : '0');
        muteBtn.innerText = isMuted ? '🔇' : '🔊';
        if (!isMuted) getAudioCtx(); // AudioContext'i başlat
    });
}

if (typeof adConfig === 'function') adConfig({ preloadAdBreaks:'on', sound:'on' });

initGame();
