// ==========================================
// IMPORTS (Modular Shader System)
// ==========================================
import { assembleFragmentShader, ShaderStyles } from './shaders/assembler.js';
import { vertexShaderSource } from './shaders/utils.js';

/*******************************
* XMB WAVE BACKGROUND BEHAVIOR *
*******************************/

const canvas = document.getElementById("webgl-canvas");
const context = canvas.getContext("webgl");

if (!context) {
    console.error("WebGL not supported");
}

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
    // Assets
    TEXTURE_PATH: "./assets/textures/PSP/",
    FILE_PREFIX: "bg_",
    FILE_EXT: ".bmp",

    // Safety: Stop checking after this many files
    MAX_CHECK_LIMIT: 100,

    // Analysis
    ANALYSIS_SIZE: 50, // Size of temp canvas for color averaging

    // Interaction
    MOUSE_SMOOTHING: 0.05,

    // Geometry
    QUAD_VERTICES: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
};

// ==========================================
// 2. STATE & GLOBALS
// ==========================================
let shaderProgram;
let locations = {}; // Grouped Uniform Locations

let currentTexture;
let blackTexture;   // For debug mode
let loadedBgIndex = -1;

// Application State
let state = {
    totalBackgrounds: 0, // Auto-detected
    bgIndex: 8,
    waveStyle: 0,        // Default ID (Matches Original/PSP)
    isAutoMonth: false,
    enableBgTint: 1,     // 1 = Theme Color, 0 = White
    isDebugBlack: false,
    themeColor: [1.0, 1.0, 1.0],
    brightnessBoost: 1.0
};

// Mouse State
let mouse = { x: 0, y: 0 };
let targetMouse = { x: 0, y: 0 };

// ==========================================
// 3. UTILITIES
// ==========================================

function getTextureUrl(index) {
    const bgStr = index.toString().padStart(2, '0');
    return `${CONFIG.TEXTURE_PATH}${CONFIG.FILE_PREFIX}${bgStr}${CONFIG.FILE_EXT}`;
}

// Auto-Discovery: Checks for files bg_01...bg_N until 404
async function discoverBackgrounds() {
    console.log("Scanning for backgrounds...");
    let count = 0;

    for (let i = 1; i <= CONFIG.MAX_CHECK_LIMIT; i++) {
        const url = getTextureUrl(i);

        const exists = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });

        if (exists) {
            count++;
        } else {
            break; // Stop at first missing file
        }
    }

    state.totalBackgrounds = count;
    console.log(`Discovery Complete. Found ${count} backgrounds.`);
    return count;
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

window.addEventListener("mousemove", (e) => {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// --- SHADER COMPILATION ---
function compileShader(source, type) {
    const shader = context.createShader(type);
    context.shaderSource(shader, source);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        console.error("Shader Error: " + context.getShaderInfoLog(shader));
        context.deleteShader(shader);
        return null;
    }
    return shader;
}

// --- COLOR ANALYSIS ---
function analyzeImageColor(image) {
    const size = CONFIG.ANALYSIS_SIZE;
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');

    tempCanvas.width = size;
    tempCanvas.height = size;
    ctx.drawImage(image, 0, 0, size, size);

    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0;
    const pixelCount = size * size;

    for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
    }

    return {
        color: [(r / pixelCount) / 255, (g / pixelCount) / 255, (b / pixelCount) / 255],
        brightness: 1.0
    };
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));

    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        const analysis = analyzeImageColor(image);
        state.themeColor = analysis.color;
        state.brightnessBoost = analysis.brightness;

        console.log(`Loaded BG. Color: [${state.themeColor}]`);
    };
    image.src = url;
    return texture;
}

// ==========================================
// 4. INITIALIZATION
// ==========================================
function initializeWebGL() {
    // 1. GENERATE SHADERS via Assembler
    // This pulls all your modular style files together into one string
    const fragmentSource = assembleFragmentShader();

    const vs = compileShader(vertexShaderSource, context.VERTEX_SHADER);
    const fs = compileShader(fragmentSource, context.FRAGMENT_SHADER);

    shaderProgram = context.createProgram();
    context.attachShader(shaderProgram, vs);
    context.attachShader(shaderProgram, fs);
    context.linkProgram(shaderProgram);

    if (!context.getProgramParameter(shaderProgram, context.LINK_STATUS)) {
        console.error("Link Error: " + context.getProgramInfoLog(shaderProgram));
    }
    context.useProgram(shaderProgram);

    // 2. SETUP TEXTURES
    blackTexture = context.createTexture();
    context.bindTexture(context.TEXTURE_2D, blackTexture);
    context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, 1, 1, 0, context.RGBA, context.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));

    // 3. GET LOCATIONS
    locations = {
        position:    context.getAttribLocation(shaderProgram, "aVertexPosition"),
        time:        context.getUniformLocation(shaderProgram, "uTime"),
        resolution:  context.getUniformLocation(shaderProgram, "uResolution"),
        dayTex:      context.getUniformLocation(shaderProgram, "uDayTexture"),
        nightTex:    context.getUniformLocation(shaderProgram, "uNightTexture"),
        timeMix:     context.getUniformLocation(shaderProgram, "uTimeMix"),
        brightness:  context.getUniformLocation(shaderProgram, "uBrightness"),
        colorFilter: context.getUniformLocation(shaderProgram, "uColorFilter"),
        waveStyle:   context.getUniformLocation(shaderProgram, "uWaveStyle"),
        mouse:       context.getUniformLocation(shaderProgram, "uMouse"),
        bgTint:      context.getUniformLocation(shaderProgram, "uEnableBgTint")
    };

    // 4. SETUP GEOMETRY
    const buffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, CONFIG.QUAD_VERTICES, context.STATIC_DRAW);
    context.enableVertexAttribArray(locations.position);
    context.vertexAttribPointer(locations.position, 2, context.FLOAT, false, 0, 0);

    requestAnimationFrame(renderFrame);
}

function updateBackground(index) {
    if (loadedBgIndex === index) return;

    // Check against detected total
    if (state.totalBackgrounds > 0) {
        if (index > state.totalBackgrounds) index = 1;
        if (index < 1) index = state.totalBackgrounds;
    }

    currentTexture = loadTexture(context, getTextureUrl(index));
    loadedBgIndex = index;
}

// ==========================================
// 5. RENDER LOOP
// ==========================================
function renderFrame(timeMs) {
    context.clear(context.COLOR_BUFFER_BIT);

    // Mouse Smoothing
    mouse.x += (targetMouse.x - mouse.x) * CONFIG.MOUSE_SMOOTHING;
    mouse.y += (targetMouse.y - mouse.y) * CONFIG.MOUSE_SMOOTHING;

    // Auto Month Logic
    if (!state.isDebugBlack && state.isAutoMonth) {
        const date = new Date();
        const monthIndex = date.getMonth() + 1;
        if (state.totalBackgrounds >= monthIndex && state.bgIndex !== monthIndex) {
            state.bgIndex = monthIndex;
        }
    }

    updateBackground(state.bgIndex);

    const timeSec = timeMs * 0.001;

    // Update Uniforms
    context.uniform1f(locations.time, timeSec);
    context.uniform2f(locations.resolution, canvas.width, canvas.height);
    context.uniform2f(locations.mouse, mouse.x, mouse.y);

    // Handle Debug Black Screen
    let renderTexture = state.isDebugBlack ? blackTexture : currentTexture;
    let renderTint    = state.isDebugBlack ? 0 : state.enableBgTint;

    if (renderTexture) {
        context.activeTexture(context.TEXTURE0);
        context.bindTexture(context.TEXTURE_2D, renderTexture);
        context.uniform1i(locations.dayTex, 0);

        context.activeTexture(context.TEXTURE1);
        context.bindTexture(context.TEXTURE_2D, renderTexture);
        context.uniform1i(locations.nightTex, 1);
    }

    context.uniform1f(locations.timeMix, 0.0);
    context.uniform1f(locations.brightness, state.brightnessBoost);
    context.uniform3f(locations.colorFilter, state.themeColor[0], state.themeColor[1], state.themeColor[2]);
    context.uniform1i(locations.waveStyle, state.waveStyle);
    context.uniform1i(locations.bgTint, renderTint);

    context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(renderFrame);
}

// ==========================================
// 6. UI LOGIC
// ==========================================
const settingsBtn = document.getElementById('settings-btn');
const settingsSidebar = document.getElementById('settings-sidebar');

if (settingsBtn && settingsSidebar) {
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = settingsSidebar.classList.toggle('open');
        if (isOpen) settingsBtn.classList.add('open');
        else settingsBtn.classList.remove('open');
    });

    window.addEventListener('click', (e) => {
        if (!settingsSidebar.contains(e.target) && e.target !== settingsBtn) {
            settingsSidebar.classList.remove('open');
            settingsBtn.classList.remove('open');
        }
    });
}

// --- STYLE LIST (AUTO-GENERATED) ---
const styleListContainer = document.querySelector('.style-list');

function initStyleList() {
    if (!styleListContainer) return;
    styleListContainer.innerHTML = '';

    // [UPDATED] Sort styles by ID (Ascending: 0, 1, 2...)
    // We use [...ShaderStyles] to create a copy so we don't mess up the original array order
    const sortedStyles = [...ShaderStyles].sort((a, b) => a.id - b.id);

    sortedStyles.forEach(style => {
        const btn = document.createElement('div');
        btn.className = 'menu-item';
        btn.dataset.value = style.id;

        const span = document.createElement('span');
        span.textContent = style.name;

        btn.appendChild(span);

        btn.addEventListener('click', () => {
            state.waveStyle = style.id;
            updateStyleSelection();
        });

        styleListContainer.appendChild(btn);
    });

    updateStyleSelection();
}

function updateStyleSelection() {
    const btns = styleListContainer.querySelectorAll('.menu-item');
    btns.forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.value) === state.waveStyle) {
            btn.classList.add('active');
        }
    });
}

// --- COLOR GRID ---
const colorGrid = document.getElementById('color-grid');

function initColorGrid() {
    if (!colorGrid) return;
    colorGrid.innerHTML = '';

    // Auto Button
    const autoBtn = document.createElement('div');
    autoBtn.className = 'menu-item';
    autoBtn.dataset.type = 'auto';
    autoBtn.textContent = "By Month";
    autoBtn.addEventListener('click', () => {
        state.isAutoMonth = true;
        const date = new Date();
        state.bgIndex = date.getMonth() + 1;
        updateGridSelection();
    });
    colorGrid.appendChild(autoBtn);

    // BG Buttons (Loop based on auto-detected total)
    for (let i = 1; i <= state.totalBackgrounds; i++) {
        const btn = document.createElement('div');
        btn.className = 'menu-item';
        btn.dataset.index = i;

        const preview = document.createElement('div');
        preview.className = 'color-preview';
        preview.style.backgroundImage = `url('${getTextureUrl(i)}')`;
        preview.style.backgroundSize = 'cover';

        btn.appendChild(preview);

        btn.addEventListener('click', () => {
            state.isAutoMonth = false;
            state.bgIndex = i;
            updateGridSelection();
        });
        colorGrid.appendChild(btn);
    }

    updateGridSelection();
    updateStyleSelection();
}

function updateGridSelection() {
    const gridItems = document.querySelectorAll('#color-grid .menu-item');
    gridItems.forEach(btn => btn.classList.remove('active'));

    if (state.isAutoMonth) {
        const autoBtn = document.querySelector('#color-grid .menu-item[data-type="auto"]');
        if (autoBtn) autoBtn.classList.add('active');
    } else {
        const activeBtn = document.querySelector(`#color-grid .menu-item[data-index="${state.bgIndex}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

// ==========================================
// 7. BOOTSTRAP
// ==========================================
// 1. Scan for backgrounds
// 2. Build UI (Colors & Styles)
// 3. Start WebGL
discoverBackgrounds().then(() => {
    initColorGrid();
    initStyleList();
    initializeWebGL();
});

// Debug Utilities
window.toggleBlackScreen = function() {
    state.isDebugBlack = !state.isDebugBlack;
    console.log("Debug Mode:", state.isDebugBlack ? "ON" : "OFF");
}

window.addEventListener('keydown', (e) => {
    if (e.key === '0') window.toggleBlackScreen();
});