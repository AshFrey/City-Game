const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startScreen = document.querySelector("#startScreen");
const gameOverScreen = document.querySelector("#gameOverScreen");
const gameOverTitle = document.querySelector("#gameOverTitle");
const gameOverStats = document.querySelector("#gameOverStats");
const batButton = document.querySelector("#batButton");
const squareButton = document.querySelector("#squareButton");
const demonButton = document.querySelector("#demonButton");
const paladinButton = document.querySelector("#paladinButton");
const adminButton = document.querySelector("#adminButton");
const teleportToggle = document.querySelector("#teleportToggle");
const teleportMenu = document.querySelector("#teleportMenu");
const levelSelect = document.querySelector("#levelSelect");
const teleportCharacterPrompt = document.querySelector("#teleportCharacterPrompt");
const restartButton = document.querySelector("#restartButton");

const keys = new Set();
const tileSize = 50;
const world = { width: tileSize * 36, height: tileSize * 36 };
const camera = { x: 0, y: 0 };
const bat = {
  range: 88,
  arc: Math.PI * 0.95,
  cooldown: 0.58,
  duration: 0.22,
  damage: 1,
};
const paladinSword = {
  range: 118,
  arc: Math.PI * 0.86,
  cooldown: 0.78,
  duration: 0.28,
  damage: 1.5,
};
const paladinSlam = {
  windup: 1.44,
  cooldown: 8.5,
  radius: 144,
  fireDuration: 4,
  damage: 2,
};
const spinAbility = {
  range: 112,
  duration: 1.15,
  cooldown: 6.5,
  tickRate: 0.18,
  damage: 1,
};
const barrelAbility = {
  cooldown: 8.5,
  speed: 360,
  fuse: 0.9,
  explosionRange: 96,
  fireRange: 70,
  fireDuration: 3.2,
  fireTickRate: 0.28,
  damage: 1,
};
const squareTrail = {
  radius: 24,
  duration: 1.35,
  dropRate: 0.1,
  damage: 0.25,
};
const demonSlash = {
  range: 92,
  arc: Math.PI * 0.86,
  windup: 0.24,
  duration: 0.2,
  cooldown: 0.72,
  dash: 46,
  damage: 1.5,
};
const demonBreath = {
  range: 210,
  spread: Math.PI * 0.22,
  duration: 0.9,
  cooldown: 6.5,
  tickRate: 0.12,
  damage: 1,
};
const demonFireball = {
  cooldown: 8.5,
  speed: 560,
  size: 15,
  life: 2.7,
  damage: 2,
};
const ultimateAbility = {
  chargeTime: 1.5,
  cooldown: 28,
  batDuration: 7.5,
  demonDuration: 5,
  adminDuration: 10,
};
const adminPower = {
  maxShield: 50,
  shieldRegen: 0,
  beamRange: 760,
  beamWidth: 0.33,
  beamLife: 0.16,
  beamCooldown: paladinSword.cooldown * 1.5,
  boltRadius: paladinSlam.radius,
  boltDamage: 1,
  boltCooldown: 1.2,
  blitzCooldown: 15,
  blitzWidth: 70,
  blitzDamage: 12,
  blitzCharge: 0.16,
  blitzTravelTime: 0.28,
  rayDuration: 2.5,
  rayWidth: 1.65,
  rayDamage: 5,
  rayBossDamageMultiplier: 0.5,
  rayTickRate: 0.22,
};

let player;
let enemies;
let projectiles;
let squareShots;
let barrels;
let fires;
let pickups;
let buildings;
let particles;
let heatWaves;
let adminBeams;
let thunderbolts;
let lastTime = 0;
let spawnTimer = 0;
let waveTimer = 0;
let score = 0;
let wave = 1;
let waveStarting = 0;
let bossFight = false;
let bossStage = 0;
let state = "menu";
let selectedCharacter = "bat";
let unlockedCharacters = loadCharacterUnlocks();
let teleportEnabled = false;
let teleportLevel = 1;
let pointerWorld = { x: world.width / 2, y: world.height / 2 };
let aimingWithPointer = false;

function loadCharacterUnlocks() {
  try {
    const saved = JSON.parse(localStorage.getItem("cityBattleRivalUnlocks") || "{}");
    const newUnlockRules = saved.unlockVersion === 2;
    return {
      bat: true,
      demon: Boolean(saved.demon),
      square: Boolean(saved.square),
      paladin: newUnlockRules && Boolean(saved.paladin),
      admin: newUnlockRules && Boolean(saved.admin),
      unlockVersion: 2,
    };
  } catch {
    return { bat: true, demon: false, square: false, paladin: false, admin: false, unlockVersion: 2 };
  }
}

function saveCharacterUnlocks() {
  localStorage.setItem("cityBattleRivalUnlocks", JSON.stringify(unlockedCharacters));
}

function unlockCharacter(character) {
  if (unlockedCharacters[character]) return;

  unlockedCharacters[character] = true;
  saveCharacterUnlocks();
  updateCharacterButtons();
}

function canUseCharacter(character) {
  if (teleportEnabled) return true;
  return Boolean(unlockedCharacters[character]);
}

function updateCharacterButtons() {
  batButton.disabled = false;
  batButton.textContent = "Baseball Dude";
  demonButton.disabled = !canUseCharacter("demon");
  demonButton.textContent = canUseCharacter("demon") ? "Demon Dude" : "Demon Dude (Locked)";
  squareButton.disabled = !canUseCharacter("square");
  squareButton.textContent = canUseCharacter("square") ? "Square Dude" : "Square Dude (Locked)";
  paladinButton.disabled = !canUseCharacter("paladin");
  paladinButton.textContent = canUseCharacter("paladin") ? "Paladin Dude" : "Paladin Dude (Locked)";
  adminButton.disabled = !canUseCharacter("admin");
  adminButton.textContent = canUseCharacter("admin") ? "Lightning Dude" : "Lightning Dude (Locked)";
  updateTeleportMenu();
}

function updateTeleportMenu() {
  teleportToggle.checked = teleportEnabled;
  teleportMenu.classList.toggle("hidden", !teleportEnabled);
  teleportCharacterPrompt.classList.toggle("hidden", !teleportEnabled);
  for (const button of levelSelect.querySelectorAll("button")) {
    button.classList.toggle("selected", Number(button.dataset.level) === teleportLevel);
  }
}

function resetGame() {
  player = {
    x: world.width / 2,
    y: world.height / 2,
    character: selectedCharacter,
    size: 28,
    speed: 255,
    health: 100,
    maxHealth: 100,
    shield: 0,
    maxShield: 60,
    healingTime: 0,
    invulnerable: 0,
    swingTime: 0,
    swingCooldown: 0,
    spinTime: 0,
    spinCooldown: 0,
    spinTick: 0,
    spinUnlocked: false,
    barrelCooldown: 0,
    barrelUnlocked: false,
    squareOrbs: [],
    squareRegen: selectedCharacter === "square" ? 0.9 : 0.45,
    squareOrbit: 0,
    squareShotCooldown: 0,
    squareShotLocked: false,
    squareTrailTimer: 0,
    demonSlashWindup: 0,
    demonSlashTime: 0,
    demonSlashAngle: 0,
    demonBreathTime: 0,
    demonBreathTick: 0,
    demonBreathAngle: 0,
    paladinSlamWindup: 0,
    paladinLastStandUsed: false,
    paladinDemonForm: false,
    paladinLastStandFlash: 0,
    paladinLastStandFireDone: false,
    ultimateUnlocked: false,
    ultimateCharge: 0,
    ultimateCooldown: 0,
    ultimateActive: 0,
    ultimateTick: 0,
    adminBlitzTime: 0,
    adminBlitzCharge: 0,
    adminBlitzStart: null,
    adminBlitzEnd: null,
    adminBlitzAngle: 0,
    adminBlitzElapsed: 0,
    adminBlitzHits: new Set(),
    adminBlitzTick: 0,
    adminRayTick: 0,
    facing: 0,
  };

  if (selectedCharacter === "admin") {
    player.speed = 315;
    player.shield = adminPower.maxShield;
    player.maxShield = adminPower.maxShield;
  }

  enemies = [];
  projectiles = [];
  squareShots = [];
  barrels = [];
  fires = [];
  pickups = [];
  particles = [];
  heatWaves = [];
  adminBeams = [];
  thunderbolts = [];
  buildings = makeBuildings();
  spawnTimer = 0;
  waveTimer = 0;
  score = 0;
  wave = 1;
  waveStarting = 0;
  bossFight = false;
  bossStage = 0;
  lastTime = performance.now();
}

function makeBuildings() {
  return [];
}

function startGame(character = "bat") {
  if (!canUseCharacter(character)) return;

  selectedCharacter = character;
  const startingWave = teleportEnabled ? teleportLevel : 1;
  teleportEnabled = false;
  resetGame();
  applyTeleportProgress(startingWave);
  state = "playing";
  startWave(startingWave);
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  updateCharacterButtons();
}

function showCharacterSelect() {
  state = "menu";
  teleportEnabled = false;
  updateCharacterButtons();
  startScreen.classList.remove("hidden");
  gameOverScreen.classList.add("hidden");
}

function applyTeleportProgress(startingWave) {
  if (startingWave > 2) {
    player.spinUnlocked = true;
  }
  if (startingWave > 6) {
    player.spinUnlocked = true;
    player.barrelUnlocked = true;
  }
  if (startingWave > 10) {
    player.ultimateUnlocked = true;
  }
}

function endGame(won = false) {
  state = "over";
  gameOverTitle.textContent = won ? "You Win" : "Game Over";
  gameOverStats.textContent = won
    ? `You defeated the wave 15 boss and knocked out ${score} enemies.`
    : `You survived wave ${wave} and knocked out ${score} enemies.`;
  gameOverScreen.classList.remove("hidden");
}

function startWave(nextWave) {
  wave = nextWave;
  waveStarting = 0.9;
  projectiles = [];
  barrels = [];
  fires = [];
  heatWaves = [];

  if (wave === 5) {
    startBossFight(1);
    return;
  }
  if (wave === 10) {
    startBossFight(2);
    return;
  }
  if (wave === 15) {
    startBossFight(3);
    return;
  }

  const waveCounts = { 1: 5, 2: 7, 3: 9, 4: 11, 6: 12, 7: 14, 8: 16, 9: 18, 11: 16, 12: 18, 13: 19, 14: 21 };
  const count = waveCounts[wave] || 5;
  if (wave === 13 || wave === 14) spawnGuardianPillars();
  for (let i = 0; i < count; i += 1) {
    spawnEnemy();
  }
}

function startBossFight(stage = 1) {
  bossFight = true;
  bossStage = stage;
  if (stage >= 2) {
    player.ultimateUnlocked = true;
    player.ultimateCharge = 0;
    burst(player.x, player.y, "#ffd166", 24);
  }
  clearBossArena();
  player.x = world.width / 2;
  player.y = world.height / 2;
  enemies = [];
  const secondBoss = stage === 2;
  const thirdBoss = stage === 3;
  enemies.push({
    x: world.width / 2 + 260,
    y: world.height / 2 - 40,
    size: thirdBoss ? 78 : secondBoss ? 72 : 62,
    speed: thirdBoss ? 116 : secondBoss ? 108 : 96,
    health: thirdBoss ? 48 : secondBoss ? 38 : 24,
    maxHealth: thirdBoss ? 48 : secondBoss ? 38 : 24,
    hitCooldown: 0,
    type: "boss",
    bossKind: thirdBoss ? "stormBoss" : secondBoss ? "beamBoss" : "arenaBoss",
    stormSecondPhase: false,
    stormSecondPhaseDone: false,
    finalShieldPhase: false,
    finalShieldDone: false,
    invincibleShield: false,
    splitOnDefeat: false,
    miniBoss: false,
    abilityScale: 1,
    attackCooldown: 1.2,
    swingTime: 0,
    shield: thirdBoss ? 13 : secondBoss ? 9 : 5,
    maxShield: thirdBoss ? 13 : secondBoss ? 9 : 5,
    projectileCooldown: secondBoss || thirdBoss ? 999 : 1.4,
    specialCooldown: thirdBoss ? 1.15 : secondBoss ? 1.6 : 2.2,
    specialName: "",
    slamTime: 0,
    slamTargetX: world.width / 2,
    slamTargetY: world.height / 2,
    slamHit: false,
    reviveTime: 0,
    reviveDone: false,
    breathTime: 0,
    breathAngle: 0,
    breathTick: 0,
    breathHitTick: 0,
    beamTime: 0,
    beamAngle: 0,
    beamHit: false,
    teleportFlash: 0,
  });
  burst(player.x, player.y, "#8fb7ff", 28);
}

function clearBossArena() {
  buildings = [];
}

function spawnEnemy(typeOverride = null) {
  const spawnPoint = findEnemySpawnPoint();
  const x = spawnPoint.x;
  const y = spawnPoint.y;

  const type = typeOverride || chooseEnemyType();
  const enemy = {
    x,
    y,
    size: 24,
    speed: 76 + wave * 7 + Math.random() * 18,
    health: Math.min(3, 2 + Math.floor(wave / 4)),
    hitCooldown: 0,
    type,
    attackCooldown: 1.2 + Math.random() * 0.8,
    swingTime: 0,
    shield: 0,
  };

  if (type === "runner") {
    enemy.speed += 42;
    enemy.health = 2;
    enemy.size = 21;
  } else if (type === "shield") {
    enemy.health = 3;
    enemy.speed -= 14;
    enemy.shield = 1;
    enemy.size = 28;
  } else if (type === "shooter") {
    enemy.health = 2;
    enemy.speed -= 24;
    enemy.attackCooldown = 0.8;
  } else if (type === "slugger") {
    enemy.health = 3;
    enemy.speed -= 4;
    enemy.attackCooldown = 0.7;
    enemy.size = 27;
    enemy.swingHit = false;
  } else if (type === "beam") {
    enemy.health = 3;
    enemy.speed -= 30;
    enemy.size = 26;
    enemy.beamCooldown = 1.2 + Math.random() * 0.8;
    enemy.beamTime = 0;
    enemy.beamAngle = 0;
    enemy.beamHit = false;
  } else if (type === "teleporter") {
    enemy.health = 3;
    enemy.speed += 8;
    enemy.size = 23;
    enemy.teleportCooldown = 1.6 + Math.random() * 1.2;
    enemy.teleportFlash = 0;
  } else if (type === "charger") {
    enemy.health = 3;
    enemy.speed += 22;
    enemy.size = 25;
    enemy.chargeCooldown = 0.8 + Math.random() * 0.8;
    enemy.chargeTime = 0;
    enemy.chargeVx = 0;
    enemy.chargeVy = 0;
  } else if (type === "jumper") {
    enemy.health = 4;
    enemy.speed -= 18;
    enemy.size = 27;
    enemy.jumpCooldown = 0.8 + Math.random() * 1.1;
    enemy.jumpTime = 0;
    enemy.jumpTargetX = x;
    enemy.jumpTargetY = y;
    enemy.jumpHit = false;
  } else if (type === "tankShield") {
    enemy.health = 6;
    enemy.maxHealth = 6;
    enemy.speed -= 28;
    enemy.shield = 3;
    enemy.maxShield = 3;
    enemy.size = 32;
  } else if (type === "blinkCharger") {
    enemy.health = 4;
    enemy.speed += 18;
    enemy.size = 25;
    enemy.teleportCooldown = 1.0 + Math.random() * 0.8;
    enemy.teleportFlash = 0;
    enemy.chargeCooldown = 0.65 + Math.random() * 0.8;
    enemy.chargeTime = 0;
    enemy.chargeVx = 0;
    enemy.chargeVy = 0;
  }

  enemies.push(enemy);
}

function spawnGuardianPillars() {
  const margin = 145;
  const spots = [
    { x: margin, y: margin },
    { x: world.width - margin, y: margin },
    { x: margin, y: world.height - margin },
    { x: world.width - margin, y: world.height - margin },
  ];

  for (const spot of spots) {
    enemies.push({
      x: spot.x,
      y: spot.y,
      size: 42,
      speed: 0,
      health: 5,
      maxHealth: 5,
      hitCooldown: 0,
      type: "guardianPillar",
      passive: true,
      attackCooldown: 0.65 + Math.random() * 0.7,
      shield: 0,
    });
  }
}

function findEnemySpawnPoint() {
  for (let i = 0; i < 40; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const range = 390 + Math.random() * 260;
    const x = Math.max(40, Math.min(world.width - 40, player.x + Math.cos(angle) * range));
    const y = Math.max(40, Math.min(world.height - 40, player.y + Math.sin(angle) * range));
    if (!collidesWithBuilding(x, y, 18)) return { x, y };
  }

  return { x: player.x + 430, y: player.y };
}

function chooseEnemyType() {
  const options = [{ type: "runner", weight: 6 }];

  if (wave >= 2) options.push({ type: "shield", weight: wave + 1 });
  if (wave >= 3) options.push({ type: "shooter", weight: wave });
  if (wave >= 4) options.push({ type: "slugger", weight: wave + 2 });
  if (wave >= 6) options.push({ type: "beam", weight: wave + 1 });
  if (wave >= 7) options.push({ type: "teleporter", weight: wave });
  if (wave >= 9) options.push({ type: "charger", weight: wave + 4 });
  if (wave >= 11) options.push({ type: "jumper", weight: wave + 3 });
  if (wave >= 12) options.push({ type: "tankShield", weight: wave + 2 });
  if (wave >= 14) options.push({ type: "blinkCharger", weight: wave + 4 });

  const totalWeight = options.reduce((total, option) => total + option.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.type;
  }

  return "runner";
}

function update(delta) {
  if (state !== "playing") return;

  waveStarting = Math.max(0, waveStarting - delta);

  const move = getMoveVector();
  const adminBlitzLocked = player.character === "admin" && (player.adminBlitzCharge > 0 || player.adminBlitzTime > 0);
  const speedBoost = player.character === "bat" && player.ultimateActive > 0 ? 1.75 : player.character === "demon" && player.ultimateActive > 0 ? 1.28 : 1;
  if (!adminBlitzLocked) {
    const nextX = player.x + move.x * player.speed * speedBoost * delta;
    const nextY = player.y + move.y * player.speed * speedBoost * delta;
    movePlayer(nextX, nextY);
  }

  if (adminBlitzLocked) {
    player.facing = player.adminBlitzAngle;
  } else if (aimingWithPointer) {
    player.facing = Math.atan2(pointerWorld.y - player.y, pointerWorld.x - player.x);
  } else if (move.active) {
    player.facing = Math.atan2(move.y, move.x);
  }
  updateUltimate(delta, move);
  updateSquareTrail(delta, move);
  updateDemonCombat(delta);
  updatePaladinCombat(delta);
  updateAdminCombat(delta);
  player.swingTime = Math.max(0, player.swingTime - delta);
  player.swingCooldown = Math.max(0, player.swingCooldown - delta);
  player.spinTime = Math.max(0, player.spinTime - delta);
  player.spinCooldown = Math.max(0, player.spinCooldown - delta);
  player.barrelCooldown = Math.max(0, player.barrelCooldown - delta);
  player.squareShotCooldown = Math.max(0, player.squareShotCooldown - delta);
  player.ultimateCooldown = Math.max(0, player.ultimateCooldown - delta);
  player.ultimateActive = Math.max(0, player.ultimateActive - delta);
  player.invulnerable = Math.max(0, player.invulnerable - delta);
  if (player.healingTime > 0) {
    player.healingTime = Math.max(0, player.healingTime - delta);
    player.health = Math.min(player.maxHealth, player.health + 5 * delta);
  }
  if (player.character === "admin" && player.shield < player.maxShield) {
    player.shield = Math.min(player.maxShield, player.shield + adminPower.shieldRegen * delta);
  }
  if (player.paladinDemonForm && player.paladinLastStandFlash > 0) {
    player.paladinLastStandFlash = Math.max(0, player.paladinLastStandFlash - delta);
    if (player.paladinLastStandFlash <= 0 && !player.paladinLastStandFireDone) {
      createPaladinLastStandFire();
    }
  }
  if (player.paladinDemonForm && player.paladinLastStandFlash <= 0) {
    const drain = 10 * delta;
    const shieldDrain = Math.min(player.shield, drain);
    player.shield -= shieldDrain;
    player.health -= drain - shieldDrain;
  }

  updateEnemies(delta);
  updateProjectiles(delta);
  updateSquareShots(delta);
  updateBarrels(delta);
  updateFires(delta);
  updateSquareOrbs(delta);
  updateSpinAttack(delta);
  updatePickups(delta);
  updateHeatWaves(delta);
  updateParticles(delta);
  updateCamera();
  checkWaveClear();

  if (player.health <= 0) {
    if (tryPaladinLastStand()) return;
    player.health = 0;
    endGame();
  }
}

function tryPaladinLastStand() {
  if (player.character !== "paladin" || player.paladinLastStandUsed) return false;

  player.character = "demon";
  player.health = 100;
  player.maxHealth = 100;
  player.shield = player.maxShield;
  player.healingTime = 0;
  player.invulnerable = 0.8;
  player.spinTime = 0;
  player.spinCooldown = 0;
  player.barrelCooldown = 0;
  player.paladinSlamWindup = 0;
  player.paladinLastStandUsed = true;
  player.paladinDemonForm = true;
  player.paladinLastStandFlash = 1;
  player.paladinLastStandFireDone = false;
  burst(player.x, player.y, "#fff2b4", 72);
  return true;
}

function createPaladinLastStandFire() {
  player.paladinLastStandFireDone = true;
  fires.push({
    x: player.x,
    y: player.y,
    radius: paladinSlam.radius,
    life: paladinSlam.fireDuration,
    tick: 0,
    tickRate: 0.26,
    damage: 1,
    damageColor: "#ff6f32",
  });
  burst(player.x, player.y, "#ff6f32", 62);
}

function checkWaveClear() {
  if (waveStarting > 0 || enemies.length > 0 || state !== "playing") return;
  if (bossFight) return;
  startWave(wave + 1);
}

function updateUltimate(delta, move) {
  if (!player.ultimateUnlocked) return;

  if (keys.has("Space") && player.ultimateCooldown <= 0 && player.ultimateActive <= 0) {
    player.ultimateCharge = Math.min(ultimateAbility.chargeTime, player.ultimateCharge + delta);
    if (player.ultimateCharge >= ultimateAbility.chargeTime) {
      activateUltimate();
    }
  } else if (!keys.has("Space") && player.ultimateActive <= 0) {
    player.ultimateCharge = 0;
  }

  if (player.character === "bat" && player.ultimateActive > 0) {
    updateBatUltimate(delta);
  }

  if (player.character === "demon" && player.ultimateActive > 0) {
    player.invulnerable = Math.max(player.invulnerable, 0.18);
  }
}

function activateUltimate() {
  player.ultimateCharge = 0;
  player.ultimateCooldown = ultimateAbility.cooldown;
  player.ultimateTick = 0;

  if (player.character === "admin") {
    player.ultimateActive = adminPower.rayDuration;
    player.adminRayTick = 0;
    burst(player.x, player.y, "#d8ffff", 46);
  } else if (player.character === "bat") {
    player.ultimateActive = ultimateAbility.batDuration;
    player.shield = Math.min(player.maxShield, player.shield + 28);
    burst(player.x, player.y, "#8fb7ff", 32);
  } else if (player.character === "square") {
    player.ultimateActive = 0.8;
    const count = 9;
    for (let i = 0; i < count; i += 1) {
      fireSquareShot((Math.PI * 2 * i) / count, 3, 24, "#d37cff", Infinity, true, 1 / 3);
    }
    burst(player.x, player.y, "#d37cff", 38);
  } else if (player.character === "demon") {
    player.ultimateActive = ultimateAbility.demonDuration;
    player.invulnerable = Math.max(player.invulnerable, ultimateAbility.demonDuration);
    burst(player.x, player.y, "#ff6f32", 34);
  } else if (player.character === "paladin") {
    player.ultimateActive = 1.1;
    createPaladinFireCross();
  }
}

function updateBatUltimate(delta) {
  player.ultimateTick -= delta;
  if (player.ultimateTick > 0) return;
  player.ultimateTick = 0.16;

  for (const enemy of enemies) {
    if (enemy.defeated || distance(enemy, player) > 66 + enemy.size) continue;
    const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    const rushDamage = enemy.shield > 0 ? 0 : enemy.type === "boss" ? 0.625 : 1.25;
    damageEnemy(enemy, rushDamage, "#8fb7ff");
    enemy.x += Math.cos(angle) * 20;
    enemy.y += Math.sin(angle) * 20;
    burst(enemy.x, enemy.y, "#8fb7ff", 7);
    registerEnemyDefeat(enemy);
  }

  for (const projectile of projectiles) {
    if (projectile.friendly || distance(projectile, player) > 78) continue;
    projectile.life = 0;
    burst(projectile.x, projectile.y, "#d8ecff", 5);
  }
}

function getMoveVector() {
  let x = 0;
  let y = 0;

  if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) y -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) y += 1;

  const length = Math.hypot(x, y);
  if (length === 0) return { x: 0, y: 0, active: false };
  return { x: x / length, y: y / length, active: true };
}

function movePlayer(nextX, nextY) {
  const clamped = {
    x: Math.max(player.size, Math.min(world.width - player.size, nextX)),
    y: Math.max(player.size, Math.min(world.height - player.size, nextY)),
  };

  if (!collidesWithBuilding(clamped.x, player.y, player.size / 2)) player.x = clamped.x;
  if (!collidesWithBuilding(player.x, clamped.y, player.size / 2)) player.y = clamped.y;
}

function updateEnemies(delta) {
  for (const enemy of enemies) {
    if (enemy.defeated) continue;
    enemy.boundTime = Math.max(0, (enemy.boundTime || 0) - delta);

    if (enemy.type === "boss") {
      updateBoss(enemy, delta);
      continue;
    }

    if (enemy.type === "pillar" || enemy.type === "guardianPillar") {
      updatePillar(enemy, delta);
      continue;
    }

    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - delta);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
    enemy.swingTime = Math.max(0, enemy.swingTime - delta);
    enemy.beamCooldown = Math.max(0, (enemy.beamCooldown || 0) - delta);
    enemy.beamTime = Math.max(0, (enemy.beamTime || 0) - delta);
    enemy.teleportCooldown = Math.max(0, (enemy.teleportCooldown || 0) - delta);
    enemy.teleportFlash = Math.max(0, (enemy.teleportFlash || 0) - delta);
    enemy.chargeCooldown = Math.max(0, (enemy.chargeCooldown || 0) - delta);
    enemy.chargeTime = Math.max(0, (enemy.chargeTime || 0) - delta);
    enemy.jumpCooldown = Math.max(0, (enemy.jumpCooldown || 0) - delta);
    enemy.jumpTime = Math.max(0, (enemy.jumpTime || 0) - delta);
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const enemyDistance = distance(enemy, player);
    const wantsRange = (enemy.type === "shooter" || enemy.type === "beam") && enemyDistance < 360;
    const isBound = enemy.boundTime > 0;
    const protectionSlow = guardianPillarsActive() && enemy.type !== "guardianPillar" && enemy.type !== "pillar" ? 0.5 : 1;
    const movementSpeed = isBound || enemy.chargeTime > 0 || enemy.jumpTime > 0 ? 0 : wantsRange ? enemy.speed * 0.25 * protectionSlow : enemy.speed * protectionSlow;
    const nextX = enemy.x + Math.cos(angle) * movementSpeed * delta;
    const nextY = enemy.y + Math.sin(angle) * movementSpeed * delta;

    if (!wantsRange && !collidesWithBuilding(nextX, enemy.y, enemy.size / 2)) enemy.x = nextX;
    if (!wantsRange && !collidesWithBuilding(enemy.x, nextY, enemy.size / 2)) enemy.y = nextY;

    if (enemy.type === "shooter" && enemyDistance < 430 && enemy.attackCooldown <= 0) {
      shootProjectile(enemy, angle);
      enemy.attackCooldown = Math.max(0.8, 2 - wave * 0.16);
    }

    if (enemy.type === "slugger") {
      updateSluggerAttack(enemy, angle, enemyDistance);
    }

    if (enemy.type === "beam") {
      updateBeamEnemy(enemy, angle, enemyDistance);
    }

    if (!isBound && enemy.type === "teleporter") {
      updateTeleporterEnemy(enemy);
    }

    if (!isBound && enemy.type === "charger") {
      updateChargerEnemy(enemy, angle, delta);
    }

    if (!isBound && enemy.type === "jumper") {
      updateJumperEnemy(enemy, angle);
    }

    if (!isBound && enemy.type === "blinkCharger") {
      updateTeleporterEnemy(enemy);
      updateChargerEnemy(enemy, angle, delta);
    }

    if (distance(enemy, player) < enemy.size + player.size * 0.72 && enemy.hitCooldown <= 0) {
      enemy.hitCooldown = 0.72;
      if (player.invulnerable <= 0) {
        damagePlayer(11);
        player.invulnerable = 0.38;
        burst(player.x, player.y, "#df6659", 8);
      }
    }
  }

  enemies = enemies.filter((enemy) => !enemy.defeated);
  updateFinalBossShield();
}

function updatePillar(pillar, delta) {
  pillar.hitCooldown = Math.max(0, pillar.hitCooldown - delta);
  if (pillar.passive) return;

  pillar.attackCooldown = Math.max(0, pillar.attackCooldown - delta);

  if (pillar.attackCooldown <= 0) {
    const angle = Math.atan2(player.y - pillar.y, player.x - pillar.x);
    shootProjectile(pillar, angle, {
      speed: 250,
      size: 10,
      life: 3,
      damage: 13,
      color: "#73e0d1",
    });
    pillar.attackCooldown = 1.45 + Math.random() * 0.65;
    burst(pillar.x, pillar.y, "#73e0d1", 8);
  }
}

function updateFinalBossShield() {
  const finalBoss = enemies.find((enemy) => enemy.type === "boss" && enemy.bossKind === "beamBoss" && enemy.finalShieldPhase && !enemy.defeated);
  if (!finalBoss) return;

  const pillarsLeft = enemies.some((enemy) => enemy.type === "pillar" && !enemy.defeated);
  if (pillarsLeft || !finalBoss.invincibleShield) return;

  finalBoss.invincibleShield = false;
  finalBoss.finalShieldPhase = false;
  finalBoss.shield = 0;
  burst(finalBoss.x, finalBoss.y, "#ffd166", 34);
}

function guardianPillarsActive() {
  return enemies.some((enemy) => enemy.type === "guardianPillar" && !enemy.defeated);
}

function updateJumperEnemy(enemy, angle) {
  if (enemy.jumpTime > 0) {
    if (enemy.jumpTime < 0.18 && !enemy.jumpHit) {
      enemy.jumpHit = true;
      enemy.x = enemy.jumpTargetX;
      enemy.y = enemy.jumpTargetY;
      shootBossRadial(enemy, 8, 210, 7, 2.2, 8, "#ffb04a");
      burst(enemy.x, enemy.y, "#ffb04a", 18);
      if (distance(enemy, player) < 82 && player.invulnerable <= 0) {
        damagePlayer(15);
        player.invulnerable = 0.42;
        burst(player.x, player.y, "#df6659", 10);
      }
    }
    return;
  }

  if (enemy.jumpCooldown <= 0) {
    enemy.jumpTime = 0.72;
    enemy.jumpHit = false;
    enemy.jumpCooldown = 1.6 + Math.random() * 1.2;
    const range = 70 + Math.random() * 140;
    enemy.jumpTargetX = Math.max(60, Math.min(world.width - 60, player.x - Math.cos(angle) * range));
    enemy.jumpTargetY = Math.max(60, Math.min(world.height - 60, player.y - Math.sin(angle) * range));
  }
}

function updateChargerEnemy(enemy, angle, delta) {
  if (enemy.chargeTime > 0) {
    const nextX = enemy.x + enemy.chargeVx * delta;
    const nextY = enemy.y + enemy.chargeVy * delta;
    if (!collidesWithBuilding(nextX, enemy.y, enemy.size / 2)) enemy.x = nextX;
    if (!collidesWithBuilding(enemy.x, nextY, enemy.size / 2)) enemy.y = nextY;
    return;
  }

  if (enemy.chargeCooldown <= 0) {
    enemy.chargeTime = 0.62;
    enemy.chargeCooldown = 2.15 + Math.random() * 1.0;
    const chargeSpeed = enemy.speed * 1.35;
    enemy.chargeVx = Math.cos(angle) * chargeSpeed;
    enemy.chargeVy = Math.sin(angle) * chargeSpeed;
    burst(enemy.x, enemy.y, "#ff493f", 10);
  }
}

function updateBeamEnemy(enemy, angle, enemyDistance) {
  if (enemy.beamTime <= 0 && enemy.beamCooldown <= 0 && enemyDistance < 520) {
    enemy.beamTime = 0.72;
    enemy.beamAngle = angle;
    enemy.beamHit = false;
    enemy.beamCooldown = 2.4;
  }

  if (enemy.beamTime > 0 && enemy.beamTime < 0.18 && !enemy.beamHit) {
    enemy.beamHit = true;
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const angleDiff = Math.abs(shortAngle(enemy.beamAngle, angleToPlayer));
    if (enemyDistance < 560 && angleDiff < 0.11 && player.invulnerable <= 0) {
      damagePlayer(18);
      player.invulnerable = 0.42;
      burst(player.x, player.y, "#df6659", 10);
    }
  }
}

function updateTeleporterEnemy(enemy) {
  if (enemy.teleportCooldown > 0) return;

  const angle = Math.random() * Math.PI * 2;
  const range = 120 + Math.random() * 120;
  enemy.x = Math.max(55, Math.min(world.width - 55, player.x + Math.cos(angle) * range));
  enemy.y = Math.max(55, Math.min(world.height - 55, player.y + Math.sin(angle) * range));
  enemy.teleportCooldown = 2.0 + Math.random() * 1.2;
  enemy.teleportFlash = 0.42;
  burst(enemy.x, enemy.y, "#73e0d1", 12);
}

function updateSluggerAttack(enemy, angle, enemyDistance) {
  if (enemyDistance < 92 && enemy.attackCooldown <= 0) {
    enemy.swingTime = 0.34;
    enemy.swingHit = false;
    enemy.attackCooldown = 1.05;
  }

  const swingProgress = enemy.swingTime > 0 ? 1 - enemy.swingTime / 0.34 : 0;
  if (enemy.swingTime > 0 && !enemy.swingHit && swingProgress > 0.42) {
    enemy.swingHit = true;
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const angleDiff = Math.abs(shortAngle(angle, angleToPlayer));

    if (enemyDistance < 90 && angleDiff < Math.PI * 0.42 && player.invulnerable <= 0) {
      damagePlayer(17);
      player.invulnerable = 0.46;
      burst(player.x, player.y, "#df6659", 12);
    }
  }
}

function updateBoss(boss, delta) {
  const phaseSlow = boss.finalShieldPhase && boss.invincibleShield ? 0.5 : 1;
  const isBound = boss.boundTime > 0;
  boss.hitCooldown = Math.max(0, boss.hitCooldown - delta);
  boss.projectileCooldown = Math.max(0, boss.projectileCooldown - delta * phaseSlow);
  boss.specialCooldown = Math.max(0, boss.specialCooldown - delta * phaseSlow);
  boss.slamTime = Math.max(0, boss.slamTime - delta * phaseSlow);
  if (typeof boss.pendingBreathDelay === "number" && boss.pendingBreathDelay > 0) {
    boss.pendingBreathDelay = Math.max(0, boss.pendingBreathDelay - delta * phaseSlow);
  }
  boss.reviveTime = Math.max(0, boss.reviveTime - delta * phaseSlow);
  boss.breathTime = Math.max(0, boss.breathTime - delta * phaseSlow);
  boss.breathTick = Math.max(0, boss.breathTick - delta * phaseSlow);
  boss.breathHitTick = Math.max(0, boss.breathHitTick - delta * phaseSlow);
  boss.beamTime = Math.max(0, (boss.beamTime || 0) - delta * phaseSlow);
  boss.teleportFlash = Math.max(0, (boss.teleportFlash || 0) - delta * phaseSlow);

  const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  const bossDistance = distance(boss, player);
  const usingSpecial = boss.slamTime > 0 || boss.reviveTime > 0 || boss.breathTime > 0 || boss.beamTime > 0;
  const desiredDistance = isBound || usingSpecial ? 0 : bossDistance > 230 ? 1 : bossDistance < 150 ? -0.55 : 0.15;
  const nextX = boss.x + Math.cos(angle) * boss.speed * phaseSlow * desiredDistance * delta;
  const nextY = boss.y + Math.sin(angle) * boss.speed * phaseSlow * desiredDistance * delta;

  if (!collidesWithBuilding(nextX, boss.y, boss.size / 2)) boss.x = nextX;
  if (!collidesWithBuilding(boss.x, nextY, boss.size / 2)) boss.y = nextY;

  if (!boss.miniBoss && boss.projectileCooldown <= 0) {
    const projectileScale = boss.projectileScale || boss.abilityScale || 1;
    shootProjectile(boss, angle, {
      speed: 285,
      size: Math.max(3, 10 * projectileScale),
      life: 2.8,
      damage: 14,
      color: "#d8ecff",
    });
    boss.projectileCooldown = 1.25;
  }

  if (!isBound && !usingSpecial && boss.specialCooldown <= 0) {
    startBossSpecial(boss);
  }

  if (boss.slamTime > 0 && boss.slamTime < 0.18 && !boss.slamHit) {
    const stompScale = boss.stompScale || boss.abilityScale || 1;
    const projectileScale = boss.projectileScale || boss.abilityScale || 1;
    const slamRadius = 118 * stompScale;
    boss.slamHit = true;
    if (!isBound) {
      boss.x = boss.slamTargetX;
      boss.y = boss.slamTargetY;
    }
    burst(boss.x, boss.y, "#ff493f", 28);
    if (!boss.miniBoss) {
      shootBossRadial(boss, 12, 220, Math.max(3, 8 * projectileScale), 2.6, 9, "#ffb04a");
    } else {
      boss.pendingBreathDelay = 0.42 + Math.random() * 0.28;
    }
    if (distance(player, { x: boss.slamTargetX, y: boss.slamTargetY }) < slamRadius && player.invulnerable <= 0) {
      damagePlayer(24);
      player.invulnerable = 0.58;
      burst(player.x, player.y, "#df6659", 16);
    }
  }

  if (boss.reviveTime > 0 && boss.reviveTime < 0.2 && !boss.reviveDone) {
    boss.reviveDone = true;
    reviveBossMinions(boss);
    burst(boss.x, boss.y, "#b66ad7", 26);
  }

  updateBossBeam(boss, bossDistance);
  updateBossBreath(boss, bossDistance, delta);
  startPendingMiniBossBreath(boss);
}

function startPendingMiniBossBreath(boss) {
  if (!boss.miniBoss || boss.pendingBreathDelay !== 0 || boss.breathTime > 0 || boss.slamTime > 0) return;

  boss.pendingBreathDelay = null;
  boss.breathTime = 1.1;
  boss.breathDuration = 1.1;
  boss.breathWindup = 0.2;
  boss.breathAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
  boss.breathTick = 0;
  boss.breathHitTick = 0;
}

function startBossSpecial(boss) {
  const activeMinions = enemies.filter((enemy) => enemy.type !== "boss" && !enemy.defeated).length;
  if (boss.miniBoss) {
    boss.specialName = "slam";
    boss.specialCooldown = 1.3 + Math.random() * 2.4;
    boss.slamTime = 0.82;
    boss.slamHit = false;
    const target = findMiniBossSlamTarget(boss);
    boss.slamTargetX = target.x;
    boss.slamTargetY = target.y;
    return;
  }

  if (boss.bossKind === "beamBoss") {
    startSecondBossSpecial(boss);
    return;
  }
  if (boss.bossKind === "stormBoss") {
    startThirdBossSpecial(boss);
    return;
  }

  const minionLimit = 4;
  const choices = activeMinions < minionLimit ? ["radial", "slam", "revive", "breath"] : ["radial", "slam", "breath"];
  const choice = choices[Math.floor(Math.random() * choices.length)];
  boss.specialName = choice;
  boss.specialCooldown = 3.2;
  const projectileScale = boss.projectileScale || boss.abilityScale || 1;

  if (choice === "radial") {
    shootBossRadial(boss, 12, 215, Math.max(3, 8 * projectileScale), 2.7, 9, "#b9d2ff");
    burst(boss.x, boss.y, "#8fb7ff", 22);
  } else if (choice === "slam") {
    boss.slamTime = 0.95;
    boss.slamHit = false;
    boss.slamTargetX = player.x;
    boss.slamTargetY = player.y;
  } else {
    if (choice === "revive") {
      boss.reviveTime = 1.05;
      boss.reviveDone = false;
    } else {
      boss.breathTime = 1.55;
      boss.breathDuration = 1.55;
      boss.breathWindup = 0.6;
      boss.breathAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
      boss.breathTick = 0;
      boss.breathHitTick = 0;
    }
  }
}

function startSecondBossSpecial(boss) {
  const choices = ["teleportBeam", "beamFan", "teleportBurst"];
  const choice = choices[Math.floor(Math.random() * choices.length)];
  boss.specialName = choice;
  boss.specialCooldown = 2.25;

  teleportBossNearPlayer(boss);

  if (choice === "teleportBeam") {
    boss.beamTime = 0.78;
    boss.beamAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.beamHit = false;
  } else if (choice === "beamFan") {
    const base = Math.atan2(player.y - boss.y, player.x - boss.x);
    for (let i = -1; i <= 1; i += 1) {
      shootProjectile(boss, base + i * 0.3, {
        speed: 340,
        size: 12,
        life: 2.4,
        damage: 12,
        color: "#54cfd1",
      });
    }
    burst(boss.x, boss.y, "#54cfd1", 18);
  } else {
    shootBossRadial(boss, 8, 285, 10, 2.3, 10, "#73e0d1");
    boss.beamTime = 0.62;
    boss.beamAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.beamHit = false;
  }
}

function startThirdBossSpecial(boss) {
  const choices = boss.stormSecondPhase
    ? ["doubleSlam", "spiralBurst", "blinkCross", "beamStorm"]
    : ["tripleJump", "pillarBurst", "dashRing", "crossBeams"];
  const choice = choices[Math.floor(Math.random() * choices.length)];
  boss.specialName = choice;
  boss.specialCooldown = boss.stormSecondPhase ? 1.25 : 1.75;

  if (choice === "tripleJump" || choice === "doubleSlam") {
    boss.slamTime = 0.82;
    boss.slamHit = false;
    const angle = Math.random() * Math.PI * 2;
    const range = boss.stormSecondPhase ? 160 + Math.random() * 320 : 90 + Math.random() * 260;
    boss.slamTargetX = Math.max(90, Math.min(world.width - 90, player.x + Math.cos(angle) * range));
    boss.slamTargetY = Math.max(90, Math.min(world.height - 90, player.y + Math.sin(angle) * range));
    boss.stompScale = boss.stormSecondPhase ? 1.45 : 1.25;
    if (choice === "doubleSlam") {
      shootBossRadial(boss, 10, 260, 10, 2.3, 10, "#d37cff");
    }
  } else if (choice === "pillarBurst" || choice === "spiralBurst") {
    const shots = boss.stormSecondPhase ? 8 : 5;
    for (let i = 0; i < shots; i += 1) {
      const angle = Math.atan2(player.y - boss.y, player.x - boss.x) + (i - (shots - 1) / 2) * (boss.stormSecondPhase ? 0.26 : 0.18);
      shootProjectile(boss, angle, {
        speed: 330 + i * 18,
        size: boss.stormSecondPhase ? 13 : 12,
        life: 2.6,
        damage: 13,
        color: boss.stormSecondPhase ? "#d37cff" : "#ffd166",
      });
    }
    burst(boss.x, boss.y, boss.stormSecondPhase ? "#d37cff" : "#ffd166", 24);
  } else if (choice === "dashRing" || choice === "blinkCross") {
    teleportBossNearPlayer(boss);
    shootBossRadial(boss, boss.stormSecondPhase ? 20 : 16, boss.stormSecondPhase ? 285 : 250, 9, 2.4, 10, boss.stormSecondPhase ? "#d37cff" : "#ff6f32");
    boss.specialCooldown = boss.stormSecondPhase ? 1.65 : 2.05;
  } else {
    boss.beamTime = boss.stormSecondPhase ? 1.05 : 0.9;
    boss.beamAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.beamHit = false;
    shootBossRadial(boss, boss.stormSecondPhase ? 8 : 4, boss.stormSecondPhase ? 330 : 300, 11, 2.5, 12, "#d37cff");
  }
}

function teleportBossNearPlayer(boss) {
  const angle = Math.random() * Math.PI * 2;
  const range = 260 + Math.random() * 170;
  boss.x = Math.max(100, Math.min(world.width - 100, player.x + Math.cos(angle) * range));
  boss.y = Math.max(100, Math.min(world.height - 100, player.y + Math.sin(angle) * range));
  boss.teleportFlash = 0.55;
  burst(boss.x, boss.y, "#73e0d1", 24);
}

function updateBossBeam(boss, bossDistance) {
  if (boss.beamTime <= 0) return;

  if (boss.beamTime < 0.2 && !boss.beamHit) {
    boss.beamHit = true;
    const angleToPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
    const angleDiff = Math.abs(shortAngle(boss.beamAngle, angleToPlayer));
    if (bossDistance < 680 && angleDiff < 0.12 && player.invulnerable <= 0) {
      damagePlayer(24);
      player.invulnerable = 0.48;
      burst(player.x, player.y, "#df6659", 14);
    }
  }
}

function findMiniBossSlamTarget(boss) {
  const otherTargets = enemies
    .filter((enemy) => enemy.type === "boss" && enemy !== boss && !enemy.defeated && enemy.slamTime > 0)
    .map((enemy) => ({ x: enemy.slamTargetX, y: enemy.slamTargetY }));

  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distanceFromPlayer = 80 + Math.random() * 170;
    const target = {
      x: Math.max(90, Math.min(world.width - 90, player.x + Math.cos(angle) * distanceFromPlayer)),
      y: Math.max(90, Math.min(world.height - 90, player.y + Math.sin(angle) * distanceFromPlayer)),
    };
    const tooClose = otherTargets.some((other) => distance(other, target) < 170);
    if (!tooClose) return target;
  }

  return {
    x: Math.max(90, Math.min(world.width - 90, player.x + Math.cos(boss.x) * 190)),
    y: Math.max(90, Math.min(world.height - 90, player.y + Math.sin(boss.y) * 190)),
  };
}

function shootBossRadial(boss, count, speed, size, life, damage, color) {
  for (let i = 0; i < count; i += 1) {
    shootProjectile(boss, (Math.PI * 2 * i) / count, { speed, size, life, damage, color });
  }
}

function updateBossBreath(boss, bossDistance, delta) {
  if (boss.breathTime <= 0) return;

  const scale = boss.breathScale || boss.abilityScale || 1;
  const breathRange = 430 * scale;
  const breathSpread = Math.PI * 0.17 * scale;
  const breathDuration = boss.breathDuration || 1.55;
  const windup = boss.breathWindup ?? 0.6;
  const windupDone = boss.breathTime < breathDuration - windup;
  if (!windupDone) return;

  boss.breathTick -= delta;
  if (boss.breathTick <= 0) {
    boss.breathTick = 0.12;
    const forward = (90 + Math.random() * 300) * scale;
    const side = (Math.random() - 0.5) * forward * 0.42;
    const sideAngle = boss.breathAngle + Math.PI / 2;
    fires.push({
      x: boss.x + Math.cos(boss.breathAngle) * forward + Math.cos(sideAngle) * side,
      y: boss.y + Math.sin(boss.breathAngle) * forward + Math.sin(sideAngle) * side,
      radius: Math.max(10, 50 * scale),
      life: 1.8,
      tick: 0,
      owner: "boss",
    });
  }

  if (boss.breathHitTick > 0) return;
  boss.breathHitTick = 0.22;
  const angleToPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
  const angleDiff = Math.abs(shortAngle(boss.breathAngle, angleToPlayer));
  if (bossDistance < breathRange && angleDiff < breathSpread && player.invulnerable <= 0) {
    damagePlayer(11);
    player.invulnerable = 0.25;
    burst(player.x, player.y, "#ff6f32", 10);
  }
}

function reviveBossMinions(boss) {
  const types = ["runner", "shooter", "shield"];
  const count = boss.miniBoss ? 1 : 3;
  for (let i = 0; i < count; i += 1) {
    const type = boss.miniBoss ? types[Math.floor(Math.random() * types.length)] : types[i];
    spawnBossMinion(type, boss, (Math.PI * 2 * i) / Math.max(1, count));
  }
}

function spawnBossMinion(type, boss, angle) {
  const enemy = {
    x: boss.x + Math.cos(angle) * 130,
    y: boss.y + Math.sin(angle) * 130,
    size: 24,
    speed: 102,
    health: 2,
    hitCooldown: 0,
    type,
    attackCooldown: 1.2 + Math.random() * 0.8,
    swingTime: 0,
    shield: 0,
  };

  if (type === "shield") {
    enemy.health = 3;
    enemy.shield = 1;
    enemy.size = 28;
    enemy.speed = 88;
  } else if (type === "shooter") {
    enemy.speed = 72;
    enemy.attackCooldown = 0.7;
  }

  enemies.push(enemy);
}

function shootProjectile(enemy, angle, options = {}) {
  const speed = options.speed || 245;
  projectiles.push({
    x: enemy.x + Math.cos(angle) * 18,
    y: enemy.y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: options.size || 7,
    life: options.life || 2.4,
    damage: options.damage || 13,
    color: options.color || "#d8ecff",
  });
}

function updateProjectiles(delta) {
  for (const projectile of projectiles) {
    const nextX = projectile.x + projectile.vx * delta;
    const nextY = projectile.y + projectile.vy * delta;
    projectile.life -= delta;

    if (projectile.friendly) {
      const hitWallX = collidesWithBuilding(nextX, projectile.y, projectile.size);
      const hitWallY = collidesWithBuilding(projectile.x, nextY, projectile.size);

      if ((hitWallX || hitWallY) && projectile.wallBounces > 0) {
        if (hitWallX) projectile.vx *= -1;
        if (hitWallY) projectile.vy *= -1;
        projectile.wallBounces -= 1;
        burst(projectile.x, projectile.y, projectile.burstColor || "#f4bd4b", 7);
      } else if (hitWallX || hitWallY) {
        projectile.life = 0;
        burst(projectile.x, projectile.y, projectile.burstColor || "#f4bd4b", 8);
      } else {
        projectile.x = nextX;
        projectile.y = nextY;
      }
    } else {
      projectile.x = nextX;
      projectile.y = nextY;

      if (collidesWithBuilding(projectile.x, projectile.y, projectile.size)) {
        projectile.life = 0;
        burst(projectile.x, projectile.y, "#d8ecff", 5);
      }
    }

    if (projectile.friendly && projectile.life > 0) {
      for (const enemy of enemies) {
        if (enemy.defeated || distance(projectile, enemy) > projectile.size + enemy.size * 0.65) continue;
        const hitColor = projectile.burstColor || "#f4bd4b";
        damageEnemy(enemy, projectile.enemyDamage || 1, hitColor);
        registerEnemyDefeat(enemy);
        if (projectile.coneExplosion) explodeDemonFireballCone(projectile, enemy);
        projectile.life = 0;
        burst(projectile.x, projectile.y, hitColor, 10);
        break;
      }
    }

    if (!projectile.friendly && projectile.life > 0 && distance(projectile, player) < projectile.size + player.size * 0.65) {
      projectile.life = 0;
      if (player.invulnerable <= 0) {
        damagePlayer(projectile.damage);
        player.invulnerable = 0.38;
        burst(player.x, player.y, "#df6659", 8);
      }
    }
  }

  projectiles = projectiles.filter((projectile) => projectile.life > 0);
}

function throwBarrel() {
  if (!player.barrelUnlocked || state !== "playing" || player.barrelCooldown > 0) return;

  const angle = player.facing;
  barrels.push({
    x: player.x + Math.cos(angle) * 28,
    y: player.y + Math.sin(angle) * 28,
    vx: Math.cos(angle) * barrelAbility.speed,
    vy: Math.sin(angle) * barrelAbility.speed,
    size: 15,
    life: barrelAbility.fuse,
    rotation: 0,
  });
  player.barrelCooldown = barrelAbility.cooldown;
}

function updateSquareTrail(delta, move) {
  if (player.character !== "square") return;

  player.squareTrailTimer = Math.max(0, player.squareTrailTimer - delta);
  if (!move.active || player.squareTrailTimer > 0) return;

  const x = player.x - move.x * 18;
  const y = player.y - move.y * 18;
  fires.push({
    x,
    y,
    radius: squareTrail.radius,
    life: squareTrail.duration,
    duration: squareTrail.duration,
    tick: 0,
    tickRate: barrelAbility.fireTickRate,
    damage: squareTrail.damage,
    damageColor: "#b66ad7",
    type: "squareTrail",
  });
  player.squareTrailTimer = squareTrail.dropRate;
}

function updateSquareOrbs(delta) {
  if (player.character !== "square") return;

  player.squareOrbit += delta * (player.spinTime > 0 ? 8 : 2.2);
  player.squareRegen -= delta;
  if (player.squareOrbs.length < 3 && player.squareRegen <= 0) {
    player.squareOrbs.push({ hitCooldown: 0 });
    player.squareRegen = 3.4;
  }

  for (const orb of player.squareOrbs) {
    orb.hitCooldown = Math.max(0, orb.hitCooldown - delta);
  }

  const positions = getSquareOrbPositions();
  for (let i = 0; i < positions.length; i += 1) {
    const orb = player.squareOrbs[i];
    if (!orb || orb.hitCooldown > 0) continue;
    for (const enemy of enemies) {
      if (enemy.defeated || distance(positions[i], enemy) > 18 + enemy.size * 0.6) continue;
      damageEnemy(enemy, 1, "#b66ad7");
      registerEnemyDefeat(enemy);
      orb.hitCooldown = player.spinTime > 0 ? 0.16 : 0.55;
      burst(enemy.x, enemy.y, "#b66ad7", 7);
      break;
    }
  }
}

function getSquareOrbPositions() {
  if (!player || player.character !== "square") return [];
  const radius = player.spinTime > 0 ? 86 : player.spinUnlocked ? 58 : 38;
  return player.squareOrbs.map((_, index) => {
    const angle = player.squareOrbit + (Math.PI * 2 * index) / Math.max(1, player.squareOrbs.length);
    return {
      x: player.x + Math.cos(angle) * radius,
      y: player.y + Math.sin(angle) * radius,
      angle,
    };
  });
}

function shootSquareOrb() {
  if (player.character !== "square" || state !== "playing" || player.squareShotLocked || player.squareShotCooldown > 0 || player.squareOrbs.length === 0) return;

  player.squareShotLocked = true;
  player.squareOrbs.pop();
  fireSquareShot(player.facing, 1, 15, "#b66ad7");
  player.squareShotCooldown = 0.18;
  player.squareRegen = Math.min(player.squareRegen, 1.5);
}

function shootSquareLine() {
  if (player.character !== "square" || !player.barrelUnlocked || state !== "playing" || player.barrelCooldown > 0 || player.squareOrbs.length < 2) return;

  player.squareOrbs.pop();
  player.squareOrbs.pop();
  fireSquareShot(player.facing, 3, 24, "#d37cff", Infinity, true, 1 / 3);
  player.barrelCooldown = barrelAbility.cooldown;
  player.squareRegen = Math.min(player.squareRegen, 1.6);
}

function fireSquareShot(angle, damage, size, color, pierce = 0, leavesTrail = false, bossDamageMultiplier = 1, hitCount = 1) {
  squareShots.push({
    x: player.x + Math.cos(angle) * 34,
    y: player.y + Math.sin(angle) * 34,
    vx: Math.cos(angle) * 430,
    vy: Math.sin(angle) * 430,
    size,
    damage,
    hitCount,
    pierce,
    bossDamageMultiplier,
    color,
    leavesTrail,
    trailTimer: 0,
    hitEnemies: new Set(),
    life: 1.6,
  });
  burst(player.x, player.y, color, 8);
}

function updateSquareShots(delta) {
  for (const shot of squareShots) {
    shot.x += shot.vx * delta;
    shot.y += shot.vy * delta;
    shot.life -= delta;
    dropSquareShotTrail(shot, delta);

    if (collidesWithBuilding(shot.x, shot.y, shot.size)) {
      shot.life = 0;
      burst(shot.x, shot.y, shot.color, 8);
      continue;
    }

    for (const enemy of enemies) {
      if (enemy.defeated || distance(shot, enemy) > shot.size + enemy.size * 0.65) continue;
      if (shot.hitEnemies.has(enemy)) continue;
      shot.hitEnemies.add(enemy);
      const hitCount = shot.hitCount || 1;
      for (let hit = 0; hit < hitCount; hit += 1) {
        const damage = enemy.type === "boss" ? shot.damage * shot.bossDamageMultiplier : shot.damage;
        damageEnemy(enemy, damage, shot.color);
        registerEnemyDefeat(enemy);
        if (enemy.defeated) break;
      }
      if (Number.isFinite(shot.pierce)) {
        shot.pierce -= 1;
        if (shot.pierce < 0) shot.life = 0;
      }
      burst(shot.x, shot.y, shot.color, hitCount > 1 ? 18 : 10);
      if (shot.life <= 0) break;
    }
  }

  squareShots = squareShots.filter((shot) => shot.life > 0);
}

function dropSquareShotTrail(shot, delta) {
  if (!shot.leavesTrail) return;

  shot.trailTimer -= delta;
  if (shot.trailTimer > 0) return;

  fires.push({
    x: shot.x,
    y: shot.y,
    radius: 20,
    life: 0.9,
    duration: 0.9,
    tick: 0,
    tickRate: barrelAbility.fireTickRate,
    damage: squareTrail.damage,
    damageColor: "#d37cff",
    type: "squareTrail",
    affectsBosses: false,
  });
  shot.trailTimer = 0.06;
}

function activateSquareSpin() {
  if (player.character !== "square" || !player.spinUnlocked || state !== "playing" || player.spinCooldown > 0 || player.spinTime > 0) return;

  player.spinTime = spinAbility.duration;
  player.spinCooldown = spinAbility.cooldown;
  player.spinTick = 0;
  burst(player.x, player.y, "#b66ad7", 18);
}

function updateBarrels(delta) {
  for (const barrel of barrels) {
    barrel.x += barrel.vx * delta;
    barrel.y += barrel.vy * delta;
    barrel.rotation += delta * 10;
    barrel.life -= delta;

    const hitEnemy = enemies.some((enemy) => !enemy.defeated && distance(enemy, barrel) < enemy.size / 2 + barrel.size);
    if (barrel.life <= 0 || collidesWithBuilding(barrel.x, barrel.y, barrel.size)) {
      barrel.life = 0;
      explodeBarrel(barrel.x, barrel.y);
    } else if (hitEnemy) {
      barrel.life = 0;
      explodeBarrel(barrel.x, barrel.y);
    }
  }

  barrels = barrels.filter((barrel) => barrel.life > 0);
}

function explodeBarrel(x, y) {
  burst(x, y, "#ff9b3f", 24);
  fires.push({
    x,
    y,
    radius: barrelAbility.fireRange,
    life: barrelAbility.fireDuration,
    tick: 0,
  });

  for (const enemy of enemies) {
    if (enemy.defeated || distance(enemy, { x, y }) > barrelAbility.explosionRange + enemy.size) continue;
    damageEnemy(enemy, 2, "#ffb04a");
    burst(enemy.x, enemy.y, "#ffb04a", 10);
    registerEnemyDefeat(enemy);
  }
}

function updateFires(delta) {
  for (const fire of fires) {
    fire.life -= delta;
    fire.tick -= delta;

    if (fire.owner === "boss") continue;
    if (fire.tick > 0) continue;
    fire.tick = fire.tickRate || barrelAbility.fireTickRate;

    for (const enemy of enemies) {
      if (enemy.defeated || distance(enemy, fire) > fire.radius + enemy.size * 0.35) continue;
      if (enemy.type === "boss" && fire.affectsBosses === false) continue;
      const damageColor = fire.damageColor || "#ff6f32";
      const damage = enemy.type === "boss" ? (fire.damage || barrelAbility.damage) * (fire.bossDamageMultiplier || 1) : fire.damage || barrelAbility.damage;
      damageEnemy(enemy, damage, damageColor);
      burst(enemy.x, enemy.y, damageColor, fire.type === "squareTrail" ? 2 : 4);
      registerEnemyDefeat(enemy);
    }
  }

  fires = fires.filter((fire) => fire.life > 0);
}

function startDemonSlash() {
  if (player.character !== "demon" || state !== "playing" || player.ultimateActive > 0 || player.swingCooldown > 0 || player.demonSlashWindup > 0 || player.demonSlashTime > 0) return;

  player.demonSlashWindup = demonSlash.windup;
  player.demonSlashAngle = player.facing;
  player.swingCooldown = demonSlash.cooldown;
}

function updateDemonCombat(delta) {
  if (player.character !== "demon") return;

  const wasWindingUp = player.demonSlashWindup > 0;
  player.demonSlashWindup = Math.max(0, player.demonSlashWindup - delta);
  player.demonSlashTime = Math.max(0, player.demonSlashTime - delta);

  if (wasWindingUp && player.demonSlashWindup <= 0) {
    performDemonSlash();
  }

  updateDemonBreath(delta);
}

function shootAdminBeam() {
  if (player.character !== "admin" || state !== "playing" || player.swingCooldown > 0) return;

  const angle = player.facing;
  player.swingCooldown = adminPower.beamCooldown;
  adminBeams.push({
    x: player.x,
    y: player.y,
    angle,
    width: adminPower.beamWidth,
    range: adminPower.beamRange,
    life: adminPower.beamLife,
    duration: adminPower.beamLife,
  });
  for (const enemy of enemies) {
    if (enemy.defeated) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleDiff = Math.abs(shortAngle(angle, Math.atan2(dy, dx)));
    if (dist > adminPower.beamRange + enemy.size || angleDiff > adminPower.beamWidth) continue;

    damageEnemy(enemy, bat.damage, "#d8ffff");
    burst(enemy.x, enemy.y, "#d8ffff", 6);
    registerEnemyDefeat(enemy);
  }
}

function summonAdminThunderbolt(x = pointerWorld.x, y = pointerWorld.y, damage = adminPower.boltDamage, radius = adminPower.boltRadius) {
  thunderbolts.push({ x, y, radius, life: 0.28, duration: 0.28 });
  burst(x, y, "#d8ffff", 22);
  for (const enemy of enemies) {
    if (enemy.defeated || distance(enemy, { x, y }) > radius + enemy.size) continue;
    damageEnemy(enemy, damage, "#d8ffff");
    burst(enemy.x, enemy.y, "#d8ffff", 10);
    registerEnemyDefeat(enemy);
  }
}

function activateAdminThunderbolt() {
  if (player.character !== "admin" || !player.spinUnlocked || state !== "playing" || player.spinCooldown > 0) return;

  summonAdminThunderbolt(pointerWorld.x, pointerWorld.y);
  player.spinCooldown = adminPower.boltCooldown;
}

function activateAdminBlitz() {
  if (player.character !== "admin" || !player.barrelUnlocked || state !== "playing" || player.barrelCooldown > 0 || player.adminBlitzTime > 0 || player.adminBlitzCharge > 0) return;

  const start = { x: player.x, y: player.y };
  const angle = Math.atan2(pointerWorld.y - player.y, pointerWorld.x - player.x);
  const end = findBlitzEndPoint(angle);
  player.facing = angle;
  player.adminBlitzCharge = adminPower.blitzCharge;
  player.adminBlitzStart = start;
  player.adminBlitzEnd = end;
  player.adminBlitzAngle = angle;
  player.adminBlitzElapsed = 0;
  player.adminBlitzHits = new Set();
  player.barrelCooldown = adminPower.blitzCooldown;
  player.invulnerable = Math.max(player.invulnerable, adminPower.blitzCharge + adminPower.blitzTravelTime + 0.15);
  burst(start.x, start.y, "#d8ffff", 32);
}

function startAdminBlitzTravel() {
  const start = player.adminBlitzStart || { x: player.x, y: player.y };
  const end = player.adminBlitzEnd || findBlitzEndPoint(player.adminBlitzAngle);
  const angle = player.adminBlitzAngle;

  player.adminBlitzTime = adminPower.blitzTravelTime;
  player.adminBlitzElapsed = 0;
  adminBeams.push({
    x: start.x,
    y: start.y,
    angle,
    range: distance(start, end),
    life: adminPower.blitzTravelTime + 0.08,
    duration: adminPower.blitzTravelTime + 0.08,
    blitz: true,
  });
  burst(end.x, end.y, "#d8ffff", 36);

  for (const enemy of enemies) {
    if (enemy.defeated || player.adminBlitzHits.has(enemy)) continue;
    const pathDistance = distancePointToSegment(enemy, start, end);
    if (pathDistance > adminPower.blitzWidth + enemy.size) continue;
    player.adminBlitzHits.add(enemy);
    damageEnemy(enemy, adminPower.blitzDamage, "#d8ffff");
    burst(enemy.x, enemy.y, "#d8ffff", 16);
    registerEnemyDefeat(enemy);
  }
}

function updateAdminCombat(delta) {
  if (player.character !== "admin") return;

  for (const beam of adminBeams) beam.life -= delta;
  for (const bolt of thunderbolts) bolt.life -= delta;
  adminBeams = adminBeams.filter((beam) => beam.life > 0);
  thunderbolts = thunderbolts.filter((bolt) => bolt.life > 0);

  if (player.adminBlitzCharge > 0) {
    player.adminBlitzCharge = Math.max(0, player.adminBlitzCharge - delta);
    player.invulnerable = Math.max(player.invulnerable, 0.12);
    if (Math.random() < 0.55) burst(player.x, player.y, "#d8ffff", 3);
    if (player.adminBlitzCharge <= 0) startAdminBlitzTravel();
  }

  if (player.adminBlitzTime > 0) {
    player.invulnerable = Math.max(player.invulnerable, 0.12);
    player.adminBlitzElapsed += delta;
    const progress = Math.min(1, player.adminBlitzElapsed / adminPower.blitzTravelTime);
    const eased = 1 - Math.pow(1 - progress, 3);
    const start = player.adminBlitzStart;
    const end = player.adminBlitzEnd;
    if (start && end) {
      player.x = start.x + (end.x - start.x) * eased;
      player.y = start.y + (end.y - start.y) * eased;
      if (Math.random() < 0.9) burst(player.x, player.y, "#d8ffff", 4);
      if (progress >= 1) {
        player.x = end.x;
        player.y = end.y;
        player.adminBlitzTime = 0;
      }
    }
  }

  if (player.ultimateActive > 0) {
    player.adminRayTick -= delta;
    if (player.adminRayTick > 0) return;
    player.adminRayTick = adminPower.rayTickRate;

    const angle = player.facing;
    for (const enemy of enemies) {
      if (enemy.defeated) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy);
      const angleDiff = Math.abs(shortAngle(angle, Math.atan2(dy, dx)));
      if (dist > adminPower.beamRange + enemy.size || angleDiff > adminPower.rayWidth) continue;

      const damage = enemy.type === "boss" ? adminPower.rayDamage * adminPower.rayBossDamageMultiplier : adminPower.rayDamage;
      damageEnemy(enemy, damage, "#d8ffff");
      burst(enemy.x, enemy.y, "#d8ffff", 16);
      registerEnemyDefeat(enemy);
    }
  }
}

function performDemonSlash() {
  const angle = player.demonSlashAngle;
  movePlayer(player.x + Math.cos(angle) * demonSlash.dash, player.y + Math.sin(angle) * demonSlash.dash);
  player.facing = angle;
  player.demonSlashTime = demonSlash.duration;
  burst(player.x, player.y, "#ff5a43", 12);

  for (const enemy of enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleToEnemy = Math.atan2(dy, dx);
    const angleDiff = Math.abs(shortAngle(angle, angleToEnemy));

    if (dist < demonSlash.range + enemy.size && angleDiff < demonSlash.arc / 2) {
      if (enemy.shield > 0) {
        damageEnemy(enemy, 0, "#ff9b3f");
      } else {
        damageEnemy(enemy, demonSlash.damage, "#ff5a43");
      }
      enemy.x += Math.cos(angleToEnemy) * 26;
      enemy.y += Math.sin(angleToEnemy) * 26;
      burst(enemy.x, enemy.y, "#ff5a43", 12);
      registerEnemyDefeat(enemy);
    }
  }
}

function activateDemonBreath() {
  if (player.character !== "demon" || !player.spinUnlocked || state !== "playing" || player.spinCooldown > 0 || player.demonBreathTime > 0) return;

  player.demonBreathTime = demonBreath.duration;
  player.demonBreathTick = 0;
  player.demonBreathAngle = player.facing;
  player.spinCooldown = demonBreath.cooldown;
  burst(player.x, player.y, "#ff6f32", 16);
}

function updateDemonBreath(delta) {
  if (player.demonBreathTime <= 0) return;

  player.demonBreathTime = Math.max(0, player.demonBreathTime - delta);
  player.demonBreathAngle = player.facing;
  player.demonBreathTick -= delta;
  if (player.demonBreathTick > 0) return;
  player.demonBreathTick = demonBreath.tickRate;

  for (const enemy of enemies) {
    if (enemy.defeated) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleToEnemy = Math.atan2(dy, dx);
    const angleDiff = Math.abs(shortAngle(player.demonBreathAngle, angleToEnemy));
    if (dist > demonBreath.range + enemy.size || angleDiff > demonBreath.spread) continue;

    damageEnemy(enemy, demonBreath.damage, "#ff6f32");
    burst(enemy.x, enemy.y, "#ff6f32", 5);
    registerEnemyDefeat(enemy);
  }
}

function shootDemonFireball() {
  if (player.character !== "demon" || !player.barrelUnlocked || state !== "playing" || player.barrelCooldown > 0) return;

  const angle = player.facing;
  projectiles.push({
    x: player.x + Math.cos(angle) * 34,
    y: player.y + Math.sin(angle) * 34,
    vx: Math.cos(angle) * demonFireball.speed,
    vy: Math.sin(angle) * demonFireball.speed,
    size: demonFireball.size,
    life: demonFireball.life,
    damage: 0,
    friendly: true,
    enemyDamage: demonFireball.damage,
    wallBounces: 0,
    coneExplosion: true,
    color: "#ff6f32",
    burstColor: "#ff6f32",
  });
  player.barrelCooldown = demonFireball.cooldown;
  burst(player.x, player.y, "#ff9b3f", 14);
}

function explodeDemonFireballCone(projectile, hitEnemy) {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const range = 62;
  const arc = Math.PI * 0.68;
  const center = {
    x: hitEnemy.x + Math.cos(angle) * 38,
    y: hitEnemy.y + Math.sin(angle) * 38,
  };

  burst(center.x, center.y, "#ff9b3f", 20);
  for (let i = 0; i < 7; i += 1) {
    const stepAngle = angle + (Math.random() - 0.5) * arc;
    const forward = 16 + Math.random() * range;
    fires.push({
      x: hitEnemy.x + Math.cos(stepAngle) * forward,
      y: hitEnemy.y + Math.sin(stepAngle) * forward,
      radius: 18 + Math.random() * 10,
      life: 0.85,
      tick: 0,
      tickRate: 0.24,
      damage: 0.45,
      damageColor: "#ff6f32",
    });
  }

  for (const enemy of enemies) {
    if (enemy.defeated || enemy === hitEnemy) continue;
    const dx = enemy.x - hitEnemy.x;
    const dy = enemy.y - hitEnemy.y;
    const dist = Math.hypot(dx, dy);
    const angleToEnemy = Math.atan2(dy, dx);
    const angleDiff = Math.abs(shortAngle(angle, angleToEnemy));
    if (dist > range + enemy.size || angleDiff > arc / 2) continue;
    damageEnemy(enemy, 1, "#ff6f32");
    burst(enemy.x, enemy.y, "#ff6f32", 8);
    registerEnemyDefeat(enemy);
  }
}

function swingPaladinSword() {
  if (player.character !== "paladin" || state !== "playing" || player.swingCooldown > 0 || player.paladinSlamWindup > 0) return;

  player.swingTime = paladinSword.duration;
  player.swingCooldown = paladinSword.cooldown;

  for (const enemy of enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleToEnemy = Math.atan2(dy, dx);
    const angleDiff = Math.abs(shortAngle(player.facing, angleToEnemy));

    if (dist < paladinSword.range + enemy.size && angleDiff < paladinSword.arc / 2) {
      if (enemy.shield > 0) {
        damageEnemy(enemy, 0, "#ffd166");
      } else {
        damageEnemy(enemy, paladinSword.damage, "#ffd166");
      }
      enemy.x += Math.cos(angleToEnemy) * 28;
      enemy.y += Math.sin(angleToEnemy) * 28;
      burst(enemy.x, enemy.y, "#ffd166", 12);
      registerEnemyDefeat(enemy);
    }
  }
}

function activatePaladinHeal() {
  if (player.character !== "paladin" || !player.barrelUnlocked || state !== "playing" || player.barrelCooldown > 0) return;

  player.healingTime = Math.max(player.healingTime, 4);
  player.health = Math.min(player.maxHealth, player.health + 6);
  player.barrelCooldown = barrelAbility.cooldown;
  burst(player.x, player.y, "#78c7a8", 22);
}

function startPaladinSlam() {
  if (player.character !== "paladin" || !player.spinUnlocked || state !== "playing" || player.spinCooldown > 0 || player.paladinSlamWindup > 0) return;

  player.paladinSlamWindup = paladinSlam.windup;
  player.spinCooldown = paladinSlam.cooldown;
  burst(player.x, player.y, "#ffd166", 24);
}

function updatePaladinCombat(delta) {
  if (player.character !== "paladin") return;

  const wasCharging = player.paladinSlamWindup > 0;
  player.paladinSlamWindup = Math.max(0, player.paladinSlamWindup - delta);
  if (wasCharging && player.paladinSlamWindup <= 0) {
    performPaladinSlam();
  }
}

function performPaladinSlam() {
  burst(player.x, player.y, "#ffb04a", 58);
  fires.push({
    x: player.x,
    y: player.y,
    radius: paladinSlam.radius,
    life: paladinSlam.fireDuration,
    tick: 0,
    tickRate: 0.26,
    damage: 1,
    damageColor: "#ff9b3f",
  });

  for (const enemy of enemies) {
    if (enemy.defeated || distance(enemy, player) > paladinSlam.radius + enemy.size) continue;
    damageEnemy(enemy, paladinSlam.damage, "#ffb04a");
    burst(enemy.x, enemy.y, "#ffb04a", 10);
    registerEnemyDefeat(enemy);
  }
}

function createPaladinFireCross() {
  const target = findUltimateTarget() || player;
  const length = 620;
  const width = 54;
  heatWaves.push({
    x: target.x,
    y: target.y,
    length,
    width,
    life: 1.15,
    duration: 1.15,
  });

  for (const enemy of enemies) {
    if (enemy.defeated) continue;
    const inHorizontal = Math.abs(enemy.y - target.y) <= width + enemy.size && Math.abs(enemy.x - target.x) <= length + enemy.size;
    const inVertical = Math.abs(enemy.x - target.x) <= width + enemy.size && Math.abs(enemy.y - target.y) <= length + enemy.size;
    if (!inHorizontal && !inVertical) continue;

    damageEnemyHeavy(enemy, 22.5, "#ffb04a");
    burst(enemy.x, enemy.y, "#ffb04a", 18);
    registerEnemyDefeat(enemy);
  }
  burst(target.x, target.y, "#ffd166", 48);
}

function findUltimateTarget() {
  let closest = null;
  let closestDistance = Infinity;
  for (const enemy of enemies) {
    if (enemy.defeated) continue;
    const d = distance(enemy, pointerWorld);
    if (d < closestDistance) {
      closest = enemy;
      closestDistance = d;
    }
  }
  return closest;
}

function swingBat() {
  if (state !== "playing" || player.swingCooldown > 0 || player.spinTime > 0) return;

  player.swingTime = bat.duration;
  player.swingCooldown = bat.cooldown;

  for (const enemy of enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleToEnemy = Math.atan2(dy, dx);
    const angleDiff = Math.abs(shortAngle(player.facing, angleToEnemy));

    if (dist < bat.range + enemy.size && angleDiff < bat.arc / 2) {
      if (enemy.shield > 0) {
        damageEnemy(enemy, 0, "#8fb7ff");
        burst(enemy.x, enemy.y, "#8fb7ff", 12);
      } else {
        damageEnemy(enemy, bat.damage, "#f4bd4b");
        burst(enemy.x, enemy.y, "#f4bd4b", 10);
      }
      enemy.x += Math.cos(angleToEnemy) * 24;
      enemy.y += Math.sin(angleToEnemy) * 24;
      registerEnemyDefeat(enemy);
    }
  }

  for (const projectile of projectiles) {
    const dx = projectile.x - player.x;
    const dy = projectile.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleToProjectile = Math.atan2(dy, dx);
    const angleDiff = Math.abs(shortAngle(player.facing, angleToProjectile));

    if (dist < bat.range + projectile.size && angleDiff < bat.arc / 2) {
      projectile.vx = Math.cos(angleToProjectile) * 360;
      projectile.vy = Math.sin(angleToProjectile) * 360;
      projectile.life = Math.max(projectile.life, 0.9);
      projectile.damage = 0;
      projectile.friendly = true;
      projectile.enemyDamage = 1;
      projectile.wallBounces = 2;
      projectile.color = "#f4bd4b";
      burst(projectile.x, projectile.y, "#f4bd4b", 8);
    }
  }
}

function activateSpin() {
  if (!player.spinUnlocked || state !== "playing" || player.spinCooldown > 0 || player.spinTime > 0) return;

  player.spinTime = spinAbility.duration;
  player.spinCooldown = spinAbility.cooldown;
  player.spinTick = 0;
  burst(player.x, player.y, "#8fb7ff", 18);
}

function updateSpinAttack(delta) {
  if (player.character !== "bat" || player.spinTime <= 0) return;

  player.spinTick -= delta;
  player.facing += delta * 16;

  if (player.spinTick > 0) return;
  player.spinTick = spinAbility.tickRate;

  for (const enemy of enemies) {
    if (distance(enemy, player) > spinAbility.range + enemy.size) continue;

    const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    if (enemy.shield > 0) {
      damageEnemy(enemy, 0, "#8fb7ff");
      burst(enemy.x, enemy.y, "#8fb7ff", 10);
    } else {
      damageEnemy(enemy, spinAbility.damage, "#f4bd4b");
      burst(enemy.x, enemy.y, "#f4bd4b", 8);
    }
    enemy.x += Math.cos(angle) * 18;
    enemy.y += Math.sin(angle) * 18;
    registerEnemyDefeat(enemy);
  }

  for (const projectile of projectiles) {
    if (distance(projectile, player) <= spinAbility.range) {
      projectile.life = 0;
      burst(projectile.x, projectile.y, "#d8ecff", 5);
    }
  }
}

function damageEnemy(enemy, amount, shieldColor) {
  enemy.hitCooldown = 0.58;
  if (guardianPillarsActive() && enemy.type !== "guardianPillar" && enemy.type !== "pillar" && enemy.type !== "boss") {
    burst(enemy.x, enemy.y, "#73e0d1", 8);
    return;
  }

  if (enemy.invincibleShield) {
    burst(enemy.x, enemy.y, shieldColor || "#ffd166", 10);
    return;
  }

  if (enemy.shield > 0) {
    enemy.shield -= 1;
    burst(enemy.x, enemy.y, shieldColor || "#8fb7ff", 8);
    return;
  }

  enemy.health -= amount;
}

function damageEnemyHeavy(enemy, amount, shieldColor) {
  enemy.hitCooldown = 0.58;
  if (guardianPillarsActive() && enemy.type !== "guardianPillar" && enemy.type !== "pillar" && enemy.type !== "boss") {
    burst(enemy.x, enemy.y, "#73e0d1", 8);
    return;
  }

  if (enemy.invincibleShield) {
    burst(enemy.x, enemy.y, shieldColor || "#ffd166", 10);
    return;
  }

  const shieldBlock = Math.min(enemy.shield || 0, amount);
  enemy.shield = Math.max(0, (enemy.shield || 0) - shieldBlock);
  enemy.health -= amount - shieldBlock;
  burst(enemy.x, enemy.y, shieldColor || "#ffb04a", enemy.shield > 0 ? 10 : 16);
}

function damagePlayer(amount) {
  const shieldBlock = Math.min(player.shield, amount);
  player.shield -= shieldBlock;
  player.health -= amount - shieldBlock;

  if (shieldBlock > 0) {
    burst(player.x, player.y, "#8fb7ff", 8);
  }
}

function registerEnemyDefeat(enemy) {
  if (enemy.health > 0 || enemy.defeated) return;

  if (enemy.type === "boss" && enemy.bossKind === "beamBoss" && !enemy.finalShieldDone) {
    startFinalBossPillarPhase(enemy);
    return;
  }

  if (enemy.type === "boss" && enemy.bossKind === "stormBoss" && !enemy.stormSecondPhaseDone) {
    startStormBossSecondPhase(enemy);
    return;
  }

  if (enemy.type === "boss" && enemy.splitOnDefeat) {
    enemy.defeated = true;
    splitBoss(enemy);
    return;
  }

  enemy.defeated = true;
  score += 1;
  if (player.paladinDemonForm) {
    player.health = Math.min(player.maxHealth, player.health + 5);
    burst(player.x, player.y, "#ff6f32", 8);
  }
  maybeDropPickup(enemy);
  if (enemy.type === "shield") {
    player.spinUnlocked = true;
  } else if (enemy.type === "beam") {
    player.barrelUnlocked = true;
  } else if (enemy.type === "pillar" || enemy.type === "guardianPillar") {
    burst(enemy.x, enemy.y, "#73e0d1", 24);
  } else if (enemy.type === "boss") {
    if (!enemies.some((other) => other.type === "boss" && !other.defeated && other !== enemy)) {
      restorePlayerFully();
      if (bossStage === 1) {
        if (player.character === "bat") unlockCharacter("demon");
        if (player.character === "demon") unlockCharacter("square");
        bossFight = false;
        bossStage = 0;
        startWave(6);
      } else if (bossStage === 2) {
        if (player.character === "square") unlockCharacter("paladin");
        if (player.character === "paladin") unlockCharacter("admin");
        bossFight = false;
        bossStage = 0;
        startWave(11);
      } else {
        endGame(true);
      }
    }
  }
}

function restorePlayerFully() {
  player.health = player.maxHealth;
  player.shield = player.maxShield;
  player.healingTime = 0;
  burst(player.x, player.y, "#78c7a8", 20);
  burst(player.x, player.y, "#8fb7ff", 20);
}

function startStormBossSecondPhase(boss) {
  boss.health = boss.maxHealth;
  boss.shield = boss.maxShield;
  boss.x = world.width / 2;
  boss.y = world.height / 2;
  boss.stormSecondPhase = true;
  boss.stormSecondPhaseDone = true;
  boss.hitCooldown = 0.7;
  boss.specialCooldown = 0.9;
  boss.speed += 22;
  boss.size += 8;
  boss.teleportFlash = 1;
  boss.beamTime = 0;
  boss.slamTime = 0;
  boss.breathTime = 0;
  projectiles = [];
  burst(boss.x, boss.y, "#d37cff", 52);
}

function startFinalBossPillarPhase(boss) {
  boss.health = boss.maxHealth;
  boss.shield = boss.maxShield;
  boss.x = world.width / 2;
  boss.y = world.height / 2;
  boss.finalShieldPhase = true;
  boss.finalShieldDone = true;
  boss.invincibleShield = true;
  boss.hitCooldown = 0.58;
  boss.specialCooldown = 2.6;
  boss.teleportFlash = 0.9;
  boss.beamTime = 0;
  boss.slamTime = 0;
  boss.breathTime = 0;
  projectiles = [];

  const margin = 150;
  const pillarSpots = [
    { x: margin, y: margin },
    { x: world.width - margin, y: margin },
    { x: margin, y: world.height - margin },
    { x: world.width - margin, y: world.height - margin },
  ];

  for (const spot of pillarSpots) {
    enemies.push({
      x: spot.x,
      y: spot.y,
      size: 46,
      speed: 0,
      health: 7,
      maxHealth: 7,
      hitCooldown: 0,
      type: "pillar",
      passive: true,
      attackCooldown: 0.45 + Math.random() * 0.8,
      shield: 0,
    });
  }

  burst(boss.x, boss.y, "#ffd166", 44);
}

function maybeDropPickup(enemy) {
  if (enemy.type === "boss" || Math.random() > 0.18) return;

  pickups.push({
    x: enemy.x,
    y: enemy.y,
    type: Math.random() < 0.55 ? "heal" : "shield",
    size: 18,
    life: 12,
    bob: Math.random() * Math.PI * 2,
  });
}

function updatePickups(delta) {
  for (const pickup of pickups) {
    pickup.life -= delta;
    pickup.bob += delta * 4;

    if (distance(pickup, player) < pickup.size + player.size * 0.6) {
      pickup.life = 0;
      if (pickup.type === "heal") {
        player.healingTime = Math.max(player.healingTime, 4);
        player.health = Math.min(player.maxHealth, player.health + 6);
        burst(player.x, player.y, "#78c7a8", 16);
      } else {
        player.shield = Math.min(player.maxShield, player.shield + 28);
        burst(player.x, player.y, "#8fb7ff", 16);
      }
    }
  }

  pickups = pickups.filter((pickup) => pickup.life > 0);
}

function splitBoss(boss) {
  const offsets = [
    { x: -120, y: -120 },
    { x: 120, y: -120 },
    { x: -120, y: 120 },
    { x: 120, y: 120 },
  ];

  for (const offset of offsets) {
    enemies.push({
      x: boss.x + offset.x,
      y: boss.y + offset.y,
      size: Math.max(22, boss.size * 0.5),
      speed: boss.speed + 18,
      health: Math.max(1, Math.ceil(boss.maxHealth / 8)),
      maxHealth: Math.max(1, Math.ceil(boss.maxHealth / 8)),
      hitCooldown: 0,
      type: "boss",
      splitOnDefeat: false,
      miniBoss: true,
      abilityScale: 0.125,
      breathScale: 0.62,
      projectileScale: 0.25,
      stompScale: 0.58,
      attackCooldown: 1.2,
      swingTime: 0,
      shield: Math.max(1, Math.ceil(boss.maxShield / 8)),
      maxShield: Math.max(1, Math.ceil(boss.maxShield / 8)),
      projectileCooldown: 0.9 + Math.random() * 0.35,
      specialCooldown: 1.2 + Math.random() * 3.2,
      specialName: "",
      slamTime: 0,
      slamTargetX: boss.x + offset.x,
      slamTargetY: boss.y + offset.y,
      slamHit: false,
      pendingBreathDelay: null,
      reviveTime: 0,
      reviveDone: false,
      breathTime: 0,
      breathAngle: 0,
      breathWindup: 0.08,
      breathTick: 0,
      breathHitTick: 0,
    });
  }

  score += 1;
  bossBreakPieces(boss);
  burst(boss.x, boss.y, "#b66ad7", 42);
}

function bossBreakPieces(boss) {
  const colors = ["#6a4fd8", "#8fb7ff", "#b66ad7", "#291b42"];
  for (let i = 0; i < 34; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 230;
    particles.push({
      x: boss.x + (Math.random() - 0.5) * boss.size,
      y: boss.y + (Math.random() - 0.5) * boss.size,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.65 + Math.random() * 0.55,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 12,
    });
  }
}

function findNearestEnemy(maxDistance) {
  let nearest = null;
  let nearestDistance = maxDistance;

  for (const enemy of enemies) {
    const enemyDistance = distance(enemy, player);
    if (enemyDistance < nearestDistance) {
      nearest = enemy;
      nearestDistance = enemyDistance;
    }
  }

  return nearest;
}

function updateParticles(delta) {
  for (const p of particles) {
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.life -= delta;
  }
  particles = particles.filter((p) => p.life > 0);
}

function updateHeatWaves(delta) {
  for (const waveEffect of heatWaves) {
    waveEffect.life -= delta;
  }
  heatWaves = heatWaves.filter((waveEffect) => waveEffect.life > 0);
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 120;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.18 + Math.random() * 0.24,
      color,
    });
  }
}

function collidesWithBuilding(x, y, radius) {
  return x - radius < 0
    || x + radius > world.width
    || y - radius < 0
    || y + radius > world.height
    || buildings.some((building) => circleRectCollision(x, y, radius, building));
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectCollision(cx, cy, radius, rect) {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return Math.hypot(cx - closestX, cy - closestY) < radius;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findBlitzEndPoint(angle) {
  const margin = player.size;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const distances = [];

  if (dx > 0) distances.push((world.width - margin - player.x) / dx);
  if (dx < 0) distances.push((margin - player.x) / dx);
  if (dy > 0) distances.push((world.height - margin - player.y) / dy);
  if (dy < 0) distances.push((margin - player.y) / dy);

  const travel = Math.max(0, Math.min(...distances.filter((value) => value > 0)));
  return {
    x: Math.max(margin, Math.min(world.width - margin, player.x + dx * travel)),
    y: Math.max(margin, Math.min(world.height - margin, player.y + dy * travel)),
  };
}

function distancePointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, start);

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const closest = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
  return distance(point, closest);
}

function shortAngle(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function updateCamera() {
  camera.x = Math.max(0, Math.min(world.width - canvas.width, player.x - canvas.width / 2));
  camera.y = Math.max(0, Math.min(world.height - canvas.height, player.y - canvas.height / 2));
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCity();

  drawBossWarnings();
  for (const fire of fires) drawFire(fire);
  for (const waveEffect of heatWaves) drawHeatWave(waveEffect);
  for (const pickup of pickups) drawPickup(pickup);
  for (const particle of particles) drawParticle(particle);
  for (const barrel of barrels) drawBarrel(barrel);
  for (const shot of squareShots) drawSquareShot(shot);
  for (const projectile of projectiles) drawProjectile(projectile);
  for (const beam of adminBeams) drawAdminBeam(beam);
  for (const bolt of thunderbolts) drawThunderbolt(bolt);
  for (const enemy of enemies) drawEnemy(enemy);
  drawPlayer();
  drawHud();

  if (state === "menu") {
    drawTitleBackground();
  }
}

function drawBossWarnings() {
  const bosses = enemies.filter((enemy) => enemy.type === "boss" && !enemy.defeated);
  if (bosses.length === 0) return;

  for (const boss of bosses) {
    const scale = boss.abilityScale || 1;
    const breathScale = boss.breathScale || scale;
    const stompScale = boss.stompScale || scale;

    if (boss.slamTime > 0) {
      const pulse = 0.34 + Math.sin(performance.now() / 55) * 0.22;
      const radius = 118 * stompScale;
      ctx.fillStyle = `rgba(255, 55, 45, ${pulse})`;
      ctx.beginPath();
      ctx.arc(boss.slamTargetX - camera.x, boss.slamTargetY - camera.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 190, 66, 0.9)";
      ctx.lineWidth = Math.max(2, 5 * scale);
      ctx.beginPath();
      ctx.arc(boss.slamTargetX - camera.x, boss.slamTargetY - camera.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (boss.reviveTime > 0) {
      const pulse = 0.3 + Math.sin(performance.now() / 70) * 0.18;
      ctx.strokeStyle = `rgba(182, 106, 215, ${pulse + 0.28})`;
      ctx.lineWidth = Math.max(2, 8 * scale);
      ctx.beginPath();
      ctx.arc(boss.x - camera.x, boss.y - camera.y, 132 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(182, 106, 215, ${pulse})`;
      ctx.beginPath();
      ctx.arc(boss.x - camera.x, boss.y - camera.y, 82 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    if (boss.breathTime > 0) {
      const x = boss.x - camera.x;
      const y = boss.y - camera.y;
      const spread = (Math.PI / 6) * breathScale;
      const range = 430 * breathScale;
      const breathDuration = boss.breathDuration || 1.55;
      const windup = boss.breathWindup ?? 0.6;
      const windingUp = boss.breathTime > breathDuration - windup;
      const pulse = 0.28 + Math.sin(performance.now() / 52) * 0.18;

      ctx.fillStyle = windingUp ? `rgba(255, 55, 45, ${pulse})` : "rgba(255, 95, 35, 0.42)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, range, boss.breathAngle - spread, boss.breathAngle + spread);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = windingUp ? "rgba(255, 190, 66, 0.9)" : "rgba(255, 220, 110, 0.74)";
      ctx.lineWidth = Math.max(2, windingUp ? 5 * scale : 8 * scale);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, range, boss.breathAngle - spread, boss.breathAngle + spread);
      ctx.closePath();
      ctx.stroke();
    }

    if (boss.beamTime > 0) {
      const x = boss.x - camera.x;
      const y = boss.y - camera.y;
      const active = boss.beamTime < 0.2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(boss.beamAngle);
      ctx.strokeStyle = active ? "rgba(84, 207, 209, 0.95)" : "rgba(255, 75, 65, 0.7)";
      ctx.lineWidth = active ? 16 : 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(680, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawCity() {
  ctx.fillStyle = "#202427";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  ctx.fillStyle = "#24292c";
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.strokeStyle = "rgba(243, 240, 232, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.width; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }
  for (let y = 0; y <= world.height; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#535a60";
  ctx.lineWidth = 28;
  ctx.strokeRect(14, 14, world.width - 28, world.height - 28);

  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x - camera.x, player.y - camera.y);
  const paladinTransforming = player.paladinDemonForm && player.paladinLastStandFlash > 0;

  if (player.ultimateActive > 0) {
    const pulse = 0.48 + Math.sin(performance.now() / 75) * 0.18;
    ctx.strokeStyle = player.character === "bat"
      ? `rgba(143, 183, 255, ${pulse + 0.25})`
      : player.character === "square"
        ? `rgba(211, 124, 255, ${pulse + 0.2})`
        : player.character === "paladin"
          ? `rgba(255, 209, 102, ${pulse + 0.2})`
          : `rgba(255, 111, 50, ${pulse + 0.2})`;
    ctx.lineWidth = player.character === "bat" ? 9 : 7;
    ctx.beginPath();
    ctx.arc(0, 0, player.character === "bat" ? 68 : 43, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (player.spinTime > 0) {
    const pulse = 0.65 + Math.sin(player.spinTime * 28) * 0.18;
    ctx.strokeStyle = `rgba(143, 183, 255, ${pulse})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, spinAbility.range * 0.72, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (player.demonBreathTime > 0) {
    const pulse = 0.28 + Math.sin(performance.now() / 55) * 0.12;
    ctx.save();
    ctx.rotate(player.demonBreathAngle);
    ctx.fillStyle = `rgba(255, 77, 48, ${pulse})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, demonBreath.range, -demonBreath.spread, demonBreath.spread);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (player.character === "admin" && player.ultimateActive > 0) {
    drawAdminRayOfDoom();
  }

  if (player.character === "admin" && player.adminBlitzCharge > 0) {
    drawAdminBlitzCharge();
  }

  if (player.paladinSlamWindup > 0) {
    const charge = 1 - player.paladinSlamWindup / paladinSlam.windup;
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.35 + charge * 0.4})`;
    ctx.lineWidth = 5 + charge * 6;
    ctx.beginPath();
    ctx.arc(0, 0, 42 + charge * paladinSlam.radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (player.shield > 0) {
    ctx.strokeStyle = "rgba(143, 183, 255, 0.75)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, player.size * 0.82, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (paladinTransforming) {
    drawPaladinLastStandBeams();
  } else if (player.character === "square") {
    drawSquareOrbs();
  } else if (player.character === "demon") {
    drawDemonSlash();
  } else if (player.character === "paladin") {
    drawPaladinSword();
  } else if (player.character !== "admin") {
    drawBat();
  }


  if (paladinTransforming) {
    drawPaladinBody();
    drawPaladinLastStandCore();
  } else if (player.character === "admin") {
    drawAdminBody();
  } else if (player.character === "demon") {
    drawDemonBody();
  } else if (player.character === "paladin") {
    drawPaladinBody();
  } else {
    ctx.fillStyle = player.invulnerable > 0 ? "#fff2b4" : player.character === "square" ? "#b66ad7" : "#78c7a8";
    ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
  }
  ctx.restore();
}

function drawPaladinLastStandBeams() {
  const progress = 1 - player.paladinLastStandFlash;
  const pulse = 0.55 + Math.sin(performance.now() / 38) * 0.18;
  ctx.save();
  ctx.rotate(performance.now() / 380);
  ctx.strokeStyle = `rgba(255, 242, 180, ${pulse})`;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10;
    const inner = 18 + progress * 8;
    const outer = 68 + progress * 86 + (i % 2) * 22;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPaladinLastStandCore() {
  const progress = 1 - player.paladinLastStandFlash;
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = "#fff2b4";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 28 + progress * 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPaladinBody() {
  ctx.save();
  ctx.fillStyle = player.invulnerable > 0 ? "#fff2b4" : "#f3f0e8";
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 5;
  ctx.strokeRect(-player.size / 2 - 2, -player.size / 2 - 2, player.size + 4, player.size + 4);
  ctx.fillStyle = "#5f80d8";
  ctx.fillRect(-5, -player.size / 2 - 8, 10, 8);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(-3, -player.size / 2 - 13, 6, 6);
  ctx.restore();
}

function drawDemonBody() {
  ctx.save();
  ctx.rotate(player.facing);
  ctx.fillStyle = player.invulnerable > 0 ? "#fff2b4" : "#c8322d";
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);

  ctx.fillStyle = "rgba(94, 19, 28, 0.9)";
  ctx.beginPath();
  ctx.moveTo(-8, -player.size / 2);
  ctx.lineTo(-34, -27);
  ctx.lineTo(-22, 0);
  ctx.lineTo(-8, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8, player.size / 2);
  ctx.lineTo(-34, 27);
  ctx.lineTo(-22, 0);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffd166";
  ctx.fillRect(8, -9, 5, 5);
  ctx.fillRect(8, 4, 5, 5);
  ctx.restore();
}

function drawAdminBody() {
  ctx.save();
  const blitzing = player.adminBlitzTime > 0 || player.adminBlitzCharge > 0;
  const pulse = blitzing ? 0.65 + Math.sin(performance.now() / 42) * 0.25 : 0.25;
  ctx.fillStyle = blitzing ? "#d8ffff" : "#101114";
  ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
  ctx.strokeStyle = `rgba(216, 255, 255, ${0.65 + pulse * 0.25})`;
  ctx.lineWidth = 5;
  ctx.strokeRect(-player.size / 2 - 3, -player.size / 2 - 3, player.size + 6, player.size + 6);
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, -3);
  ctx.lineTo(0, -13);
  ctx.lineTo(0, -3);
  ctx.lineTo(8, -3);
  ctx.lineTo(-1, 13);
  ctx.lineTo(1, 2);
  ctx.lineTo(-8, 2);
  ctx.stroke();
  ctx.restore();
}

function drawAdminBlitzCharge() {
  const charge = 1 - player.adminBlitzCharge / adminPower.blitzCharge;
  const pulse = 0.45 + Math.sin(performance.now() / 34) * 0.22;
  ctx.save();
  ctx.strokeStyle = `rgba(216, 255, 255, ${pulse})`;
  ctx.lineWidth = 4 + charge * 5;
  ctx.beginPath();
  ctx.arc(0, 0, 34 + charge * 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.rotate(player.adminBlitzAngle);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + pulse * 0.25})`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  drawLightningBoltPath(86 + charge * 42, 14);
  ctx.stroke();
  ctx.restore();
}

function drawAdminBeam(beam) {
  const alpha = Math.max(0, beam.life / beam.duration);
  const outerWidth = beam.blitz ? 82 : 30;
  const innerWidth = beam.blitz ? 26 : 10;
  ctx.save();
  ctx.translate(beam.x - camera.x, beam.y - camera.y);
  ctx.rotate(beam.angle);
  ctx.strokeStyle = `rgba(216, 255, 255, ${0.35 + alpha * 0.45})`;
  ctx.lineWidth = outerWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  drawLightningBoltPath(beam.range, beam.blitz ? 32 : 18);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + alpha * 0.35})`;
  ctx.lineWidth = innerWidth;
  ctx.beginPath();
  drawLightningBoltPath(beam.range, beam.blitz ? 18 : 10);
  ctx.stroke();
  ctx.restore();
}

function drawLightningBoltPath(range, jag) {
  const segments = 9;
  ctx.moveTo(0, 0);
  for (let i = 1; i <= segments; i += 1) {
    const x = (range * i) / segments;
    const y = i === segments ? 0 : (i % 2 === 0 ? -1 : 1) * (jag + (i % 3) * jag * 0.55);
    ctx.lineTo(x, y);
  }
}

function drawAdminRayOfDoom() {
  const pulse = 0.62 + Math.sin(performance.now() / 48) * 0.2;
  ctx.save();
  ctx.rotate(player.facing);
  ctx.strokeStyle = `rgba(216, 255, 255, ${pulse * 0.55})`;
  ctx.lineWidth = 132;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(adminPower.beamRange, 0);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 255, 255, ${pulse})`;
  ctx.lineWidth = 42;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(adminPower.beamRange, 0);
  ctx.stroke();
  ctx.restore();
}

function drawThunderbolt(bolt) {
  const alpha = Math.max(0, bolt.life / bolt.duration);
  const x = bolt.x - camera.x;
  const y = bolt.y - camera.y;
  ctx.save();
  ctx.strokeStyle = `rgba(216, 255, 255, ${0.5 + alpha * 0.4})`;
  ctx.lineWidth = 4 + alpha * 6;
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 260);
  ctx.lineTo(x + 16, y - 170);
  ctx.lineTo(x - 10, y - 95);
  ctx.lineTo(x + 20, y);
  ctx.stroke();
  ctx.fillStyle = `rgba(143, 232, 255, ${0.18 + alpha * 0.22})`;
  ctx.beginPath();
  ctx.arc(x, y, bolt.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPaladinSword() {
  const swingProgress = player.swingTime > 0 ? 1 - player.swingTime / paladinSword.duration : 0;
  const easedSwing = 1 - Math.pow(1 - swingProgress, 3);
  const swingAngle = player.facing - paladinSword.arc / 2 + paladinSword.arc * easedSwing;
  const idleAngle = player.facing + Math.PI * 0.66;
  const angle = player.swingTime > 0 ? swingAngle : idleAngle;

  if (player.swingTime > 0) {
    ctx.save();
    ctx.rotate(player.facing);
    ctx.strokeStyle = "rgba(255, 209, 102, 0.36)";
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, 72, -paladinSword.arc / 2, -paladinSword.arc / 2 + paladinSword.arc * easedSwing);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = "#d8ecff";
  ctx.fillRect(10, -4, 12, 8);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(18, -5, 10, 10);
  ctx.fillStyle = "#f3f0e8";
  ctx.fillRect(26, -4, 62, 8);
  ctx.fillStyle = "#d8ecff";
  ctx.fillRect(80, -7, 10, 14);
  ctx.restore();
}

function drawDemonSlash() {
  const charge = player.demonSlashWindup > 0 ? 1 - player.demonSlashWindup / demonSlash.windup : 0;
  if (player.demonSlashWindup > 0) {
    ctx.save();
    ctx.rotate(player.demonSlashAngle);
    ctx.strokeStyle = `rgba(255, 111, 50, ${0.25 + charge * 0.45})`;
    ctx.lineWidth = 5 + charge * 7;
    ctx.beginPath();
    ctx.arc(0, 0, 36 + charge * 30, -demonSlash.arc / 2, demonSlash.arc / 2);
    ctx.stroke();
    ctx.restore();
  }

  if (player.demonSlashTime <= 0) return;

  const progress = 1 - player.demonSlashTime / demonSlash.duration;
  ctx.save();
  ctx.rotate(player.demonSlashAngle);
  ctx.strokeStyle = "rgba(255, 90, 67, 0.72)";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, 58, -demonSlash.arc / 2, -demonSlash.arc / 2 + demonSlash.arc * progress);
  ctx.stroke();
  ctx.restore();
}

function drawSquareOrbs() {
  const positions = getSquareOrbPositions();
  for (const orb of positions) {
    ctx.save();
    ctx.translate(orb.x - player.x, orb.y - player.y);
    ctx.rotate(orb.angle);
    ctx.fillStyle = "#b66ad7";
    ctx.fillRect(-9, -9, 18, 18);
    ctx.fillStyle = "#e7c4ff";
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
}

function drawBat() {
  const swingProgress = player.swingTime > 0 ? 1 - player.swingTime / bat.duration : 0;
  const easedSwing = 1 - Math.pow(1 - swingProgress, 3);
  const swingAngle = player.facing - bat.arc / 2 + bat.arc * easedSwing;
  const idleAngle = player.facing + Math.PI * 0.78;
  const angle = player.swingTime > 0 ? swingAngle : idleAngle;

  if (player.swingTime > 0) {
    ctx.save();
    ctx.rotate(player.facing);
    ctx.strokeStyle = "rgba(244, 189, 75, 0.28)";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, 54, -bat.arc / 2, -bat.arc / 2 + bat.arc * easedSwing);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = "#f3f0e8";
  ctx.fillRect(11, -5, 9, 10);
  ctx.fillStyle = "#d79b45";
  ctx.fillRect(18, -6, 44, 12);
  ctx.fillStyle = "#f4bd4b";
  ctx.fillRect(52, -7, 13, 14);
  ctx.restore();
}

function drawEnemy(enemy) {
  if (enemy.type === "boss") {
    drawBoss(enemy);
    return;
  }

  ctx.save();
  ctx.translate(enemy.x - camera.x, enemy.y - camera.y);
  const colors = {
    runner: "#c64f55",
    shield: "#5f80d8",
    shooter: "#b66ad7",
    slugger: "#d98242",
    beam: "#54cfd1",
    teleporter: "#73e0d1",
    charger: "#ff493f",
    pillar: "#2dd7c8",
    guardianPillar: "#2dd7c8",
    jumper: "#ff8a3d",
    tankShield: "#5f80d8",
    blinkCharger: "#f75fc7",
  };
  ctx.fillStyle = enemy.hitCooldown > 0.48 ? "#ffbe8a" : colors[enemy.type];
  ctx.fillRect(-enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size);

  if (enemy.boundTime > 0) {
    const pulse = 0.45 + Math.sin(performance.now() / 65) * 0.18;
    ctx.strokeStyle = `rgba(255, 209, 102, ${pulse + 0.35})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.size * 0.82, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.type === "pillar" || enemy.type === "guardianPillar") {
    const pulse = 0.45 + Math.sin(performance.now() / 115 + enemy.x) * 0.18;
    ctx.fillStyle = "#0d3d43";
    ctx.fillRect(-enemy.size / 2 + 7, -enemy.size / 2 - 8, enemy.size - 14, enemy.size + 16);
    ctx.strokeStyle = `rgba(115, 224, 209, ${pulse + 0.35})`;
    ctx.lineWidth = 5;
    ctx.strokeRect(-enemy.size / 2 - 4, -enemy.size / 2 - 10, enemy.size + 8, enemy.size + 20);
    ctx.fillStyle = "#d8ffff";
    ctx.beginPath();
    ctx.arc(0, 0, 8 + pulse * 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.type === "jumper") {
    if (enemy.jumpTime > 0) {
      const pulse = 0.32 + Math.sin(performance.now() / 55) * 0.18;
      ctx.strokeStyle = `rgba(255, 176, 74, ${pulse + 0.35})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(enemy.jumpTargetX - enemy.x, enemy.jumpTargetY - enemy.y, 58, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#2b1114";
    ctx.fillRect(-7, -enemy.size / 2 - 8, 14, 8);
  } else if (enemy.type === "tankShield") {
    ctx.strokeStyle = enemy.shield > 0 ? "#d8ecff" : "rgba(185, 210, 255, 0.45)";
    ctx.lineWidth = 7;
    ctx.strokeRect(-enemy.size / 2 - 7, -enemy.size / 2 - 7, enemy.size + 14, enemy.size + 14);
  } else if (enemy.type === "blinkCharger") {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    ctx.strokeStyle = enemy.teleportFlash > 0 ? "#ffd6f5" : "rgba(247, 95, 199, 0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.size * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = enemy.chargeTime > 0 ? "#ffd166" : "#2b1114";
    ctx.beginPath();
    ctx.moveTo(enemy.size / 2 + 10, 0);
    ctx.lineTo(enemy.size / 2 - 3, -9);
    ctx.lineTo(enemy.size / 2 - 3, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (enemy.type === "beam" && enemy.beamTime > 0) {
    const active = enemy.beamTime < 0.18;
    ctx.save();
    ctx.rotate(enemy.beamAngle);
    ctx.strokeStyle = active ? "rgba(84, 207, 209, 0.9)" : "rgba(255, 75, 65, 0.65)";
    ctx.lineWidth = active ? 9 : 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(560, 0);
    ctx.stroke();
    ctx.restore();
  }

  if (enemy.type === "shield") {
    ctx.strokeStyle = enemy.shield > 0 ? "#b9d2ff" : "rgba(185, 210, 255, 0.45)";
    ctx.lineWidth = 5;
    ctx.strokeRect(-enemy.size / 2 - 5, -enemy.size / 2 - 5, enemy.size + 10, enemy.size + 10);
  } else if (enemy.type === "shooter") {
    ctx.fillStyle = "#d8ecff";
    ctx.fillRect(-4, -enemy.size / 2 - 9, 8, 8);
  } else if (enemy.type === "beam") {
    ctx.fillStyle = "#101114";
    ctx.fillRect(-10, -3, 20, 6);
    ctx.fillStyle = "#d8ffff";
    ctx.fillRect(3, -5, 8, 10);
  } else if (enemy.type === "teleporter") {
    ctx.strokeStyle = enemy.teleportFlash > 0 ? "#d8ffff" : "rgba(216, 255, 255, 0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.size * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  } else if (enemy.type === "charger") {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = enemy.chargeTime > 0 ? "#ffd166" : "#2b1114";
    ctx.beginPath();
    ctx.moveTo(enemy.size / 2 + 10, 0);
    ctx.lineTo(enemy.size / 2 - 3, -9);
    ctx.lineTo(enemy.size / 2 - 3, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (enemy.type === "slugger") {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const progress = enemy.swingTime > 0 ? 1 - enemy.swingTime / 0.34 : 0;
    const swing = enemy.swingTime > 0 ? -0.95 + progress * 2.1 : -0.8;
    if (enemy.swingTime > 0) {
      ctx.save();
      ctx.rotate(angle);
      ctx.strokeStyle = "rgba(244, 189, 75, 0.28)";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 45, -0.95, swing);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(angle + swing);
    ctx.fillStyle = "#f4bd4b";
    ctx.fillRect(14, -4, 42, 8);
    ctx.restore();
  }

  ctx.fillStyle = "#2b1114";
  ctx.fillRect(-6, -7, 4, 4);
  ctx.fillRect(4, -7, 4, 4);
  ctx.restore();
}

function drawBoss(boss) {
  ctx.save();
  const jumpLift = boss.slamTime > 0 && !boss.slamHit ? Math.sin((1 - boss.slamTime / 0.95) * Math.PI) * 56 : 0;
  ctx.translate(boss.x - camera.x, boss.y - camera.y - jumpLift);

  const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  ctx.fillStyle = boss.hitCooldown > 0.48 ? "#ffbe8a" : boss.bossKind === "stormBoss" ? (boss.stormSecondPhase ? "#8b2fd1" : "#4b1b73") : boss.bossKind === "beamBoss" ? "#1f9ba0" : "#6a4fd8";
  ctx.fillRect(-boss.size / 2, -boss.size / 2, boss.size, boss.size);

  if (boss.boundTime > 0) {
    const pulse = 0.45 + Math.sin(performance.now() / 65) * 0.18;
    ctx.strokeStyle = `rgba(255, 209, 102, ${pulse + 0.35})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, boss.size * 0.75, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (boss.teleportFlash > 0) {
    ctx.strokeStyle = "rgba(216, 255, 255, 0.9)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, boss.size * 0.72, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = boss.shield > 0 ? "#b9d2ff" : "rgba(185, 210, 255, 0.28)";
  ctx.lineWidth = 7;
  ctx.strokeRect(-boss.size / 2 - 9, -boss.size / 2 - 9, boss.size + 18, boss.size + 18);

  if (boss.invincibleShield) {
    const pulse = 0.55 + Math.sin(performance.now() / 80) * 0.2;
    ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, boss.size * 0.9, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#291b42";
  ctx.fillRect(-15, -15, 7, 7);
  ctx.fillRect(8, -15, 7, 7);

  ctx.restore();
}

function drawProjectile(projectile) {
  ctx.fillStyle = projectile.color || "#d8ecff";
  ctx.beginPath();
  ctx.arc(projectile.x - camera.x, projectile.y - camera.y, projectile.size, 0, Math.PI * 2);
  ctx.fill();
}

function drawSquareShot(shot) {
  ctx.save();
  ctx.translate(shot.x - camera.x, shot.y - camera.y);
  ctx.rotate(performance.now() / 130);
  ctx.fillStyle = shot.color;
  ctx.fillRect(-shot.size / 2, -shot.size / 2, shot.size, shot.size);
  ctx.fillStyle = "#f0d7ff";
  ctx.fillRect(-shot.size / 5, -shot.size / 5, (shot.size * 2) / 5, (shot.size * 2) / 5);
  ctx.restore();
}

function drawBarrel(barrel) {
  ctx.save();
  ctx.translate(barrel.x - camera.x, barrel.y - camera.y);
  ctx.rotate(barrel.rotation);
  ctx.fillStyle = "#8b5330";
  ctx.fillRect(-barrel.size, -barrel.size * 0.75, barrel.size * 2, barrel.size * 1.5);
  ctx.fillStyle = "#c7823c";
  ctx.fillRect(-barrel.size, -barrel.size * 0.35, barrel.size * 2, barrel.size * 0.28);
  ctx.fillStyle = "#f5ca62";
  ctx.fillRect(-barrel.size * 0.3, -barrel.size * 1.05, barrel.size * 0.6, barrel.size * 0.5);
  ctx.restore();
}

function drawFire(fire) {
  if (fire.type === "squareTrail") {
    drawSquareTrail(fire);
    return;
  }

  const alpha = Math.max(0.16, fire.life / barrelAbility.fireDuration * 0.58);
  const x = fire.x - camera.x;
  const y = fire.y - camera.y;

  ctx.fillStyle = `rgba(255, 92, 35, ${alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, fire.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 190, 66, ${alpha * 0.82})`;
  for (let i = 0; i < 5; i += 1) {
    const flicker = performance.now() / 180 + i * 1.8;
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(flicker) * fire.radius * 0.38,
      y + Math.sin(flicker * 1.3) * fire.radius * 0.28,
      13 + Math.sin(flicker) * 4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawHeatWave(waveEffect) {
  const progress = 1 - waveEffect.life / waveEffect.duration;
  const alpha = Math.max(0, waveEffect.life / waveEffect.duration);
  const x = waveEffect.x - camera.x;
  const y = waveEffect.y - camera.y;
  const pulseWidth = waveEffect.width * (0.85 + progress * 0.65);
  const pulseLength = waveEffect.length * (0.25 + progress * 0.75);

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(255, 176, 74, 0.86)";
  ctx.lineWidth = pulseWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-pulseLength, 0);
  ctx.lineTo(pulseLength, 0);
  ctx.moveTo(0, -pulseLength);
  ctx.lineTo(0, pulseLength);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 242, 180, 0.85)";
  ctx.lineWidth = Math.max(8, pulseWidth * 0.28);
  ctx.beginPath();
  ctx.moveTo(-pulseLength, 0);
  ctx.lineTo(pulseLength, 0);
  ctx.moveTo(0, -pulseLength);
  ctx.lineTo(0, pulseLength);
  ctx.stroke();
  ctx.restore();
}

function drawSquareTrail(fire) {
  const alpha = Math.max(0, fire.life / (fire.duration || squareTrail.duration));
  const x = fire.x - camera.x;
  const y = fire.y - camera.y;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((fire.x + fire.y) * 0.015);
  ctx.fillStyle = `rgba(182, 106, 215, ${alpha * 0.42})`;
  ctx.fillRect(-fire.radius, -fire.radius, fire.radius * 2, fire.radius * 2);
  ctx.strokeStyle = `rgba(240, 215, 255, ${alpha * 0.58})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(-fire.radius * 0.7, -fire.radius * 0.7, fire.radius * 1.4, fire.radius * 1.4);
  ctx.restore();
}

function drawPickup(pickup) {
  const x = pickup.x - camera.x;
  const y = pickup.y - camera.y + Math.sin(pickup.bob) * 4;

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = pickup.type === "heal" ? "#78c7a8" : "#8fb7ff";
  ctx.strokeStyle = "rgba(243, 240, 232, 0.75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, pickup.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#101114";
  if (pickup.type === "heal") {
    ctx.fillRect(-4, -11, 8, 22);
    ctx.fillRect(-11, -4, 22, 8);
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(11, -6);
    ctx.lineTo(8, 10);
    ctx.lineTo(0, 15);
    ctx.lineTo(-8, 10);
    ctx.lineTo(-11, -6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawParticle(particle) {
  ctx.globalAlpha = Math.min(1, Math.max(0, particle.life / 0.36));
  ctx.fillStyle = particle.color;
  const size = particle.size || 4;
  ctx.fillRect(particle.x - camera.x - size / 2, particle.y - camera.y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

function drawHud() {
  const barWidth = Math.min(310, canvas.width - 32);
  const healthWidth = barWidth * (player.health / player.maxHealth);

  ctx.fillStyle = "rgba(12, 13, 15, 0.72)";
  ctx.fillRect(16, 16, barWidth, 30);
  ctx.fillStyle = "#df6659";
  ctx.fillRect(20, 20, Math.max(0, healthWidth - 8), 22);
  if (player.shield > 0) {
    const shieldWidth = barWidth * (player.shield / player.maxShield);
    ctx.fillStyle = "rgba(143, 183, 255, 0.9)";
    ctx.fillRect(20, 46, Math.max(0, shieldWidth - 8), 8);
  }
  ctx.strokeStyle = "rgba(243, 240, 232, 0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, barWidth, 30);

  ctx.fillStyle = "#f3f0e8";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillText(`Health ${Math.ceil(player.health)}`, 26, 38);
  if (player.shield > 0) ctx.fillText(`Shield ${Math.ceil(player.shield)}`, 26, 60);
  ctx.fillText(`Wave ${wave}`, 18, 72);
  ctx.fillText(`Knockouts ${score}`, 18, 96);
  const protectedBoss = enemies.some((enemy) => enemy.type === "boss" && enemy.invincibleShield && !enemy.defeated);
  const objective = protectedBoss
    ? `Pillars left ${enemies.filter((enemy) => enemy.type === "pillar" && !enemy.defeated).length}`
    : bossFight ? (bossStage === 3 ? "Defeat the third boss" : bossStage === 2 ? "Defeat the second boss" : "Defeat the boss") : "Clear all enemies";
  ctx.fillText(objective, 18, 120);
  drawPillarWarning();
  drawBossHud();
  drawAbilityHud();
}

function drawPillarWarning() {
  const pillars = enemies.filter((enemy) => (enemy.type === "pillar" || enemy.type === "guardianPillar") && !enemy.defeated);
  if (pillars.length === 0) return;

  const centerX = canvas.width / 2;
  const topY = 28;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "900 18px system-ui, sans-serif";
  ctx.fillStyle = "rgba(12, 13, 15, 0.74)";
  ctx.fillRect(centerX - 155, 9, 310, 42);
  ctx.strokeStyle = "rgba(115, 224, 209, 0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(centerX - 155, 9, 310, 42);
  ctx.fillStyle = "#d8ffff";
  ctx.fillText("WARNING: PILLARS PROTECTING", centerX, topY + 4);

  for (const pillar of pillars) {
    const angle = Math.atan2(pillar.y - player.y, pillar.x - player.x);
    const arrowX = centerX + Math.cos(angle) * 190;
    const arrowY = 62 + Math.sin(angle) * 18;
    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);
    ctx.fillStyle = "#73e0d1";
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawBossHud() {
  if (!bossFight || enemies.length === 0) return;

  const bosses = enemies.filter((enemy) => enemy.type === "boss" && !enemy.defeated);
  if (bosses.length === 0) return;

  const width = Math.min(420, canvas.width - 36);
  const x = canvas.width / 2 - width / 2;
  const y = 136;
  const health = bosses.reduce((total, boss) => total + Math.max(0, boss.health), 0);
  const maxHealth = bosses.reduce((total, boss) => total + boss.maxHealth, 0);
  const shield = bosses.reduce((total, boss) => total + Math.max(0, boss.shield), 0);
  const maxShield = bosses.reduce((total, boss) => total + boss.maxShield, 0);
  const healthRatio = Math.max(0, health / maxHealth);
  const shieldRatio = Math.max(0, shield / maxShield);

  ctx.fillStyle = "rgba(12, 13, 15, 0.78)";
  ctx.fillRect(x, y, width, 42);
  ctx.fillStyle = "#6a4fd8";
  ctx.fillRect(x + 5, y + 7, (width - 10) * healthRatio, 16);
  ctx.fillStyle = "#8fb7ff";
  ctx.fillRect(x + 5, y + 27, (width - 10) * shieldRatio, 7);
  ctx.strokeStyle = "rgba(243, 240, 232, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, 42);
  ctx.fillStyle = "#f3f0e8";
  ctx.font = "800 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(bosses.some((boss) => boss.invincibleShield) ? "Boss Shielded" : bosses.some((boss) => boss.stormSecondPhase) ? "Boss Phase 2" : bosses.length > 1 ? `Bosses x${bosses.length}` : "Boss", canvas.width / 2, y + 21);
  ctx.textAlign = "left";
}

function drawAbilityHud() {
  drawSpinHud();
  drawBarrelHud();
  drawUltimateHud();
}

function drawUltimateHud() {
  const width = 168;
  const height = 42;
  const x = canvas.width / 2 - width / 2;
  const y = canvas.height - height - 18;
  const ready = player.ultimateUnlocked && player.ultimateCooldown <= 0 && player.ultimateActive <= 0;
  const charging = player.ultimateCharge > 0 && player.ultimateActive <= 0;
  const active = player.ultimateActive > 0;
  const cooldownProgress = player.ultimateCooldown > 0 ? player.ultimateCooldown / ultimateAbility.cooldown : 0;
  const chargeProgress = player.ultimateCharge / ultimateAbility.chargeTime;

  ctx.fillStyle = "rgba(12, 13, 15, 0.78)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = active ? "#ffd166" : ready ? "#f3f0e8" : "rgba(243, 240, 232, 0.38)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);

  if (player.ultimateUnlocked) {
    ctx.fillStyle = active ? "rgba(255, 209, 102, 0.42)" : charging ? "rgba(255, 209, 102, 0.35)" : "rgba(143, 183, 255, 0.2)";
    const activeDuration = player.character === "admin" ? adminPower.rayDuration : player.character === "demon" ? ultimateAbility.demonDuration : player.character === "bat" ? ultimateAbility.batDuration : player.character === "paladin" ? 1.1 : 0.8;
    ctx.fillRect(x + 4, y + 4, (width - 8) * (active ? player.ultimateActive / activeDuration : charging ? chargeProgress : ready ? 1 : 0), height - 8);
  }

  if (player.ultimateCooldown > 0 && !active) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(x, y, width * cooldownProgress, height);
  }

  ctx.fillStyle = "#f3f0e8";
  ctx.font = "800 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  const name = player.character === "admin" ? "Ray of Doom" : player.character === "bat" ? "Shield Rush" : player.character === "square" ? "Nine Lines" : player.character === "paladin" ? "Fire Cross" : "Demon Flight";
  const label = !player.ultimateUnlocked ? "Ultimate at Boss 2" : active ? name : player.ultimateCooldown > 0 ? `Ultimate ${Math.ceil(player.ultimateCooldown)}` : charging ? "Hold Space" : "Space Ultimate";
  ctx.fillText(label, x + width / 2, y + 17);
  ctx.fillStyle = "#cfc8b8";
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.fillText(player.ultimateUnlocked ? name : "Locked", x + width / 2, y + 33);
  ctx.textAlign = "left";
}

function drawSpinHud() {
  const size = 58;
  const x = 18;
  const y = canvas.height - size - 18;
  const cooldownLeft = player.spinCooldown > 0 && player.spinTime <= 0;
  const spinCooldownMax = player.character === "admin" ? adminPower.boltCooldown : player.character === "paladin" ? paladinSlam.cooldown : spinAbility.cooldown;
  const cooldownProgress = cooldownLeft ? player.spinCooldown / spinCooldownMax : 0;
  const readyOrActive = player.spinUnlocked && (player.spinCooldown <= 0 || player.spinTime > 0);
  const pulse = readyOrActive ? 0.55 + Math.sin(performance.now() / 115) * 0.28 : 0.18;

  ctx.fillStyle = "rgba(12, 13, 15, 0.78)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = readyOrActive ? "#8fb7ff" : "rgba(243, 240, 232, 0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, size, size);

  ctx.strokeStyle = `rgba(143, 183, 255, ${pulse})`;
  ctx.lineWidth = readyOrActive ? 5 : 3;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, readyOrActive ? 22 + pulse * 4 : 21, 0, Math.PI * 2);
  ctx.stroke();

  const swirl = player.spinTime > 0 ? performance.now() / 120 : 0.4;
  if (player.character === "square") {
    for (let i = 0; i < 3; i += 1) {
      const angle = swirl + (Math.PI * 2 * i) / 3;
      ctx.fillStyle = player.spinUnlocked ? "#c64f55" : "rgba(207, 200, 184, 0.35)";
      ctx.beginPath();
      ctx.arc(x + size / 2 + Math.cos(angle) * 17, y + size / 2 + Math.sin(angle) * 17, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (player.character === "demon") {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2 + 4);
    ctx.globalAlpha = player.spinUnlocked ? 1 : 0.35;
    ctx.fillStyle = "#ff6f32";
    ctx.beginPath();
    ctx.moveTo(-6, 12);
    ctx.quadraticCurveTo(0, -24, 9, 5);
    ctx.quadraticCurveTo(2, 0, 2, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(4, 13);
    ctx.quadraticCurveTo(9, -4, 16, 9);
    ctx.quadraticCurveTo(9, 5, 8, 17);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (player.character === "paladin") {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.globalAlpha = player.spinUnlocked ? 1 : 0.35;
    ctx.fillStyle = "#ff9b3f";
    ctx.beginPath();
    ctx.arc(0, 8, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f3f0e8";
    ctx.fillRect(-4, -22, 8, 28);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(-14, 1, 28, 7);
    ctx.restore();
  } else if (player.character === "admin") {
    ctx.strokeStyle = player.spinUnlocked ? "#d8ffff" : "rgba(207, 200, 184, 0.35)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + size / 2 - 11, y + size / 2 - 20);
    ctx.lineTo(x + size / 2 + 4, y + size / 2 - 2);
    ctx.lineTo(x + size / 2 - 4, y + size / 2 - 2);
    ctx.lineTo(x + size / 2 + 12, y + size / 2 + 20);
    ctx.stroke();
  } else {
    ctx.strokeStyle = player.spinUnlocked ? "#8fb7ff" : "rgba(207, 200, 184, 0.35)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, 10 + i * 6, swirl + i, swirl + i + 1.9);
      ctx.stroke();
    }
  }

  if (cooldownLeft) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(x, y, size, size * cooldownProgress);
    ctx.fillStyle = "#f3f0e8";
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(Math.ceil(player.spinCooldown), x + size / 2, y + 37);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#cfc8b8";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.fillText(player.spinUnlocked ? "Right-click" : "Defeat", x + size + 10, y + 24);
  const spinLabel = player.character === "admin" ? "Bolt" : player.character === "square" ? "Orbit" : player.character === "demon" ? "Breath" : player.character === "paladin" ? "Slam" : "Spin";
  ctx.fillText(player.spinUnlocked ? spinLabel : "Shield", x + size + 10, y + 43);
}

function drawBarrelHud() {
  const size = 58;
  const x = canvas.width - size - 18;
  const y = canvas.height - size - 18;
  const cooldownLeft = player.barrelUnlocked && player.barrelCooldown > 0;
  const barrelCooldownMax = player.character === "admin" ? adminPower.blitzCooldown : barrelAbility.cooldown;
  const cooldownProgress = cooldownLeft ? player.barrelCooldown / barrelCooldownMax : 0;
  const readyPulse = !player.barrelUnlocked || cooldownLeft ? 0.18 : 0.5 + Math.sin(performance.now() / 130) * 0.2;

  ctx.fillStyle = "rgba(12, 13, 15, 0.78)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = player.barrelUnlocked && !cooldownLeft ? "#ff9b3f" : "rgba(243, 240, 232, 0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, size, size);

  ctx.fillStyle = `rgba(255, 110, 42, ${readyPulse})`;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x + size / 2, y + size / 2 + 4);
  ctx.globalAlpha = player.barrelUnlocked ? 1 : 0.35;
  if (player.character === "square") {
    ctx.rotate(-0.1);
    ctx.fillStyle = "#d37cff";
    ctx.fillRect(-18, -11, 28, 22);
    ctx.fillStyle = "#f0d7ff";
    ctx.fillRect(-8, -5, 10, 10);
    ctx.fillStyle = "rgba(211, 124, 255, 0.45)";
    ctx.fillRect(11, -7, 18, 14);
  } else if (player.character === "demon") {
    ctx.fillStyle = "#ff6f32";
    ctx.beginPath();
    ctx.arc(1, -1, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(5, -5, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 111, 50, 0.5)";
    ctx.fillRect(-28, -5, 20, 10);
  } else if (player.character === "paladin") {
    ctx.fillStyle = "#78c7a8";
    ctx.fillRect(-5, -18, 10, 36);
    ctx.fillRect(-18, -5, 36, 10);
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 4;
    ctx.strokeRect(-20, -20, 40, 40);
  } else if (player.character === "admin") {
    ctx.strokeStyle = "#d8ffff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.lineTo(-2, -10);
    ctx.lineTo(-9, 2);
    ctx.lineTo(10, 2);
    ctx.lineTo(-6, 20);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#8b5330";
    ctx.fillRect(-13, -13, 26, 25);
    ctx.fillStyle = "#c7823c";
    ctx.fillRect(-13, -5, 26, 6);
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(-4, -16);
    ctx.quadraticCurveTo(0, -30, 7, -16);
    ctx.quadraticCurveTo(2, -20, 1, -11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff6f32";
    ctx.beginPath();
    ctx.moveTo(1, -14);
    ctx.quadraticCurveTo(5, -23, 10, -13);
    ctx.quadraticCurveTo(6, -16, 5, -8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (cooldownLeft) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(x, y, size, size * cooldownProgress);
    ctx.fillStyle = "#f3f0e8";
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(Math.ceil(player.barrelCooldown), x + size / 2, y + 37);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#cfc8b8";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(player.barrelUnlocked ? "E" : "Defeat", x - 10, y + 24);
  const secondLabel = player.character === "admin" ? "Blitz" : player.character === "square" ? "Line Shot" : player.character === "demon" ? "Fireball" : player.character === "paladin" ? "Heal" : "Barrel";
  ctx.fillText(player.barrelUnlocked ? secondLabel : "Beam", x - 10, y + 43);
  ctx.textAlign = "left";
}

function drawTitleBackground() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
  if (player) updateCamera();
}

function pointerToWorld(event) {
  const rect = canvas.getBoundingClientRect();
  aimingWithPointer = true;
  pointerWorld = {
    x: camera.x + ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: camera.y + ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function frame(now) {
  const delta = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(frame);
}

batButton.addEventListener("click", () => startGame("bat"));
squareButton.addEventListener("click", () => startGame("square"));
demonButton.addEventListener("click", () => startGame("demon"));
paladinButton.addEventListener("click", () => startGame("paladin"));
adminButton.addEventListener("click", () => startGame("admin"));
teleportToggle.addEventListener("change", () => {
  teleportEnabled = teleportToggle.checked;
  updateCharacterButtons();
});
levelSelect.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-level]");
  if (!button) return;

  teleportLevel = Number(button.dataset.level);
  updateTeleportMenu();
});
restartButton.addEventListener("click", showCharacterSelect);

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
  }
  if (event.code === "KeyE") {
    event.preventDefault();
    if (player.character === "admin") {
      activateAdminBlitz();
    } else if (player.character === "square") {
      shootSquareLine();
    } else if (player.character === "demon") {
      shootDemonFireball();
    } else if (player.character === "paladin") {
      activatePaladinHeal();
    } else {
      throwBarrel();
    }
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("pointermove", pointerToWorld);
canvas.addEventListener("pointerdown", (event) => {
  pointerToWorld(event);
  if (event.button === 0) {
    if (player.character === "admin") shootAdminBeam();
    else if (player.character === "square") shootSquareOrb();
    else if (player.character === "demon") startDemonSlash();
    else if (player.character === "paladin") swingPaladinSword();
    else swingBat();
  }
  if (event.button === 2) {
    if (player.character === "admin") activateAdminThunderbolt();
    else if (player.character === "square") activateSquareSpin();
    else if (player.character === "demon") activateDemonBreath();
    else if (player.character === "paladin") startPaladinSlam();
    else activateSpin();
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (event.button === 0 && player) {
    player.squareShotLocked = false;
  }
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

window.addEventListener("resize", resizeCanvas);

resetGame();
resizeCanvas();
updateCharacterButtons();
requestAnimationFrame(frame);
