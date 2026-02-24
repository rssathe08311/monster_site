let monsterTypes = ["cat", "demon", "mummy", "lava", "spider", "wolf"];
let monsterType = null;

let bgImg;
let finalBgImg = null;
let finalBgLoading = false;
let finalBgError = false;

// fonts
let pixelFont;
let dogicaFont;

// ---------- Modular part state ----------
const PARTS = ["leftArm", "rightArm", "torso", "head", "leftLeg", "rightLeg"];
let monsterImgs = {};
let monsterLoading = {};
let monsterError = {};

for (const p of PARTS) {
  monsterImgs[p] = null;
  monsterLoading[p] = false;
  monsterError[p] = "";
}

// This will be filled from the form
let sessionSet = {
  eyeScore: 0,
  brainScore: 0,
  bleedingScore: 0,
  stomachScore: 0,
  headScore: 0,
};

// Which limb score drives which part quality
const SCORE_FOR_PART = {
  torso: (s) => s.stomachScore,
  leftArm: (s) => s.brainScore,
  rightArm: (s) => s.brainScore,
  head: (s) => s.eyeScore,
  leftLeg: (s) => s.bleedingScore,
  rightLeg: (s) => s.bleedingScore,
};

// Draw order (back -> front)
const LAYERS = ["leftArm", "rightArm", "leftLeg", "rightLeg", "torso", "head"];

// canvas variable
let cnv;

function preload() {
  bgImg = loadImage("./media/background.png"); // fallback
  pixelFont = loadFont("./media/fonts/MatrixtypeDisplayBold-6R4e6.ttf");
  dogicaFont = loadFont("./media/fonts/dogica.ttf");
}

function setup() {
  cnv = createCanvas(1078, 1915);
  cnv.parent("canvasWrap");
  imageMode(CORNER);

  document.getElementById("submitButton")
    .addEventListener("click", applyFormAndLoadAssets);

  document.getElementById("downloadButton")
    .addEventListener("click", downloadImage);

  // ✅ NEW: if URL has params, auto-generate
  autofillFromParamsAndGenerate();
}

function downloadImage() {
  if (!monsterType) {
    console.warn("No monster generated yet.");
    return;
  }

  const stillLoading = Object.values(monsterLoading).some(v => v);
  if (stillLoading || finalBgLoading) {
    console.warn("Still loading images; wait a moment.");
    return;
  }

  const filename = `monster-${monsterType}`;
  saveCanvas(cnv, filename, "png");
}

/* ---------------------------
   ✅ NEW: URL PARAM SUPPORT
---------------------------- */

function getParams() {
  const params = new URLSearchParams(window.location.search);

  // helper: parse numbers safely
  const num = (key) => {
    const v = Number(params.get(key));
    return Number.isFinite(v) ? v : 0;
  };

  return {
    monsterType: (params.get("monsterType") || "").trim().toLowerCase(),
    eyeScore: num("eyeScore"),
    brainScore: num("brainScore"),
    bleedingScore: num("bleedingScore"),
    stomachScore: num("stomachScore"),
  };
}

function autofillFromParamsAndGenerate() {
  const p = getParams();

  // only autorun if monsterType is in the link
  if (!p.monsterType) return;

  // Fill inputs (nice for debugging / still allows manual edits)
  document.getElementById("monsterType").value = p.monsterType;
  document.getElementById("eyeScore").value = String(p.eyeScore);
  document.getElementById("brainScore").value = String(p.brainScore);
  document.getElementById("bleedingScore").value = String(p.bleedingScore);
  document.getElementById("stomachScore").value = String(p.stomachScore);

  // Generate
  applyFormAndLoadAssets();

  // Optional: hide inputs so it feels like a "result page"
  hideControls();
}

function hideControls() {
  const el = document.getElementById("controls");
  if (el) el.style.display = "none";
}

// ✅ NEW: makes the current monster shareable by updating the URL
function updateURLFromCurrentValues() {
  if (!monsterType) return;

  const params = new URLSearchParams({
    monsterType: monsterType,
    eyeScore: String(sessionSet.eyeScore),
    brainScore: String(sessionSet.brainScore),
    bleedingScore: String(sessionSet.bleedingScore),
    stomachScore: String(sessionSet.stomachScore),
  });

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  history.replaceState(null, "", newUrl);
}

/* ---------------------------
   Existing logic
---------------------------- */

function applyFormAndLoadAssets() {
  const monsterInput = (document.getElementById("monsterType").value || "").trim().toLowerCase();

  let resolvedType = null;

  // If user typed a number, treat as index
  const maybeIndex = Number(monsterInput);
  if (!Number.isNaN(maybeIndex) && monsterInput !== "") {
    const idx = Math.floor(maybeIndex);
    if (idx >= 0 && idx < monsterTypes.length) {
      resolvedType = monsterTypes[idx];
    }
  }

  // Otherwise treat as string
  if (!resolvedType) {
    if (monsterTypes.includes(monsterInput)) resolvedType = monsterInput;
  }

  if (!resolvedType) {
    console.error("Invalid monsterType. Use one of:", monsterTypes, "or 0-5");
    return;
  }

  monsterType = resolvedType;

  const readNum = (id) => {
    const v = Number((document.getElementById(id)?.value || "0").trim());
    return Number.isFinite(v) ? v : 0;
  };

  sessionSet.eyeScore = readNum("eyeScore");
  sessionSet.brainScore = readNum("brainScore");
  sessionSet.bleedingScore = readNum("bleedingScore");
  sessionSet.stomachScore = readNum("stomachScore");
  sessionSet.headScore = 0;

  // ✅ NEW: update URL so the result is shareable
  updateURLFromCurrentValues();

  loadFinalBg();
  loadAllParts();
}

function loadFinalBg() {
  finalBgLoading = true;
  finalBgError = false;
  finalBgImg = null;

  const finalBgPath = `./media/${monsterType}/${monsterType}-finalcard.png`;
  console.log("loading final bg:", finalBgPath);

  loadImage(
    finalBgPath,
    (img) => {
      finalBgImg = img;
      finalBgLoading = false;
      console.log("Loaded final bg OK:", finalBgPath);
    },
    (err) => {
      finalBgLoading = false;
      finalBgError = true;
      console.error("Failed to load final bg:", finalBgPath, err);
    }
  );
}

function loadAllParts() {
  for (const p of PARTS) {
    monsterImgs[p] = null;
    monsterLoading[p] = false;
    monsterError[p] = "";
  }

  for (const p of PARTS) {
    loadMonsterPart(p);
  }
}

function loadMonsterPart(part) {
  const limbScore = SCORE_FOR_PART[part](sessionSet);
  const q = limbQuality(limbScore);
  const path = `./media/${monsterType}/${q}/${q}-${part}.png`;

  console.log(`loading ${part}:`, path);

  monsterLoading[part] = true;
  monsterError[part] = "";
  monsterImgs[part] = null;

  loadImage(
    path,
    (img) => {
      monsterImgs[part] = img;
      monsterLoading[part] = false;
      console.log(`Loaded ${part} OK:`, path);
    },
    (err) => {
      monsterLoading[part] = false;
      monsterError[part] = path;
      console.error(`Failed to load ${part}:`, path, err);
    }
  );
}

function drawMonster(x = 0, y = 0, w = width, h = height) {
  for (const part of LAYERS) {
    const img = monsterImgs[part];
    if (img) image(img, x, y, w, h);
  }
}

function drawGlowingText(txt, x, y, {
  font,
  size = 100,
  glowColor = [255, 255, 255],
  glowAlpha = 60,
  glowRadius = 4,
  mainColor = [255, 255, 255],
  mainAlpha = 220
}) {
  push();
  textFont(font);
  textAlign(CENTER, CENTER);

  fill(glowColor[0], glowColor[1], glowColor[2], glowAlpha);
  for (let dx = -glowRadius; dx <= glowRadius; dx++) {
    for (let dy = -glowRadius; dy <= glowRadius; dy++) {
      if (dx !== 0 || dy !== 0) {
        textSize(size);
        text(txt, x + dx, y + dy);
      }
    }
  }

  fill(mainColor[0], mainColor[1], mainColor[2], mainAlpha);
  textSize(size);
  text(txt, x, y);
  pop();
}

function draw() {
  if (finalBgImg) image(finalBgImg, 0, 0, width, height);
  else if (bgImg) image(bgImg, 0, 0, width, height);
  else background(0);

  if (!monsterType) {
    fill(255);
    textSize(18);
    text("Enter monsterType + scores, then click Submit.", 30, 40);
    return;
  }

  if (monsterType === "wolf" || monsterType === "spider") {
    const scale = 0.65;
    drawMonster(200, 300, width * scale, height * scale);
  } else {
    const scale = 0.58;
    drawMonster(250, 370, width * scale, height * scale);
  }

  const totalScore =
    (sessionSet.brainScore || 0) +
    (sessionSet.eyeScore || 0) +
    (sessionSet.stomachScore || 0) +
    (sessionSet.bleedingScore || 0);

  drawGlowingText(totalScore, 830, 1620, {
    font: pixelFont,
    size: 115,
    glowColor: [255, 255, 255],
    glowAlpha: 5,
    glowRadius: 5,
    mainColor: [255, 255, 255],
    mainAlpha: 200,
  });

  drawGlowingText(`Eye Score: ${sessionSet.eyeScore}`, 305, 1610, {
    font: dogicaFont, size: 29, glowAlpha: 5, glowRadius: 5, mainAlpha: 200
  });

  drawGlowingText(`Brain Score: ${sessionSet.brainScore}`, 330, 1560, {
    font: dogicaFont, size: 29, glowAlpha: 5, glowRadius: 5, mainAlpha: 200
  });

  drawGlowingText(`Stomach Score: ${sessionSet.stomachScore}`, 365, 1660, {
    font: dogicaFont, size: 29, glowAlpha: 5, glowRadius: 5, mainAlpha: 200
  });

  drawGlowingText(`Bleeding Score: ${sessionSet.bleedingScore}`, 380, 1710, {
    font: dogicaFont, size: 29, glowAlpha: 5, glowRadius: 5, mainAlpha: 191
  });

  textFont("sans-serif");
  textAlign(LEFT, TOP);

  if (finalBgLoading) {
    fill(255);
    textSize(14);
    text("Loading final card...", 20, 20);
  } else if (finalBgError) {
    fill(255, 100, 100);
    textSize(14);
    text("Final card missing (using fallback bg)", 20, 20);
  }
}

function limbQuality(limbScore) {
  if (limbScore <= 200) return "bad";
  if (limbScore <= 399) return "medium";
  return "good";
}
