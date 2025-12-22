/*******************************
* XMB WAVE BACKGROUND BEHAVIOR *
*******************************/

const canvas = document.getElementById("webgl-canvas");
const context = canvas.getContext("webgl");

if (!context) {
    console.error("WebGL not supported");
}

// --- CONFIGURATION ---
const texturePath = "./assets/textures/PSP/";
const totalBackgrounds = 34;

// --- GLOBALS ---
let shaderProgram;
let timeUniformLocation, resolutionUniformLocation, dayTextureLocation,
    nightTextureLocation, timeMixLocation, brightnessLocation,
    colorFilterLocation, waveStyleLocation, mouseUniformLocation,
    bgTintLocation; // Added specific location for Tint toggle

let currentTexture;
let loadedBgIndex = -1;

// State
let currentBgIndex = 1;
let waveStyle = 1; // Default to Original (PSP)
let isAutoMonth = true;
let enableBgTint = 0; // 0 = Use Theme Color, 1 = Pure White (Matches your Shader logic)

// Dynamic Color State
let currentThemeColor = [1.0, 1.0, 1.0]; // Default White
let currentBrightnessBoost = 1.0;        // Default Normal

// Mouse State
let mouse = { x: 0, y: 0 };
let targetMouse = { x: 0, y: 0 };

// --- RESIZE ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    context.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- MOUSE TRACKING ---
window.addEventListener("mousemove", (e) => {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// --- HELPERS ---
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

// --- COLOR ANALYSIS HELPER (FIXED) ---
function analyzeImageColor(image) {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');

    // Use small size for performance
    tempCanvas.width = 50;
    tempCanvas.height = 50;

    ctx.drawImage(image, 0, 0, 50, 50);

    const data = ctx.getImageData(0, 0, 50, 50).data;
    let r = 0, g = 0, b = 0;
    const pixelCount = 50 * 50;

    for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
    }

    // Average RGB (0.0 to 1.0)
    const avgR = (r / pixelCount) / 255;
    const avgG = (g / pixelCount) / 255;
    const avgB = (b / pixelCount) / 255;
    return {
        color: [avgR, avgG, avgB],
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

        // Run Analysis
        const analysis = analyzeImageColor(image);
        currentThemeColor = analysis.color;
        currentBrightnessBoost = analysis.brightness;

        console.log(`Loaded BG. Color: [${currentThemeColor}], Brightness: ${currentBrightnessBoost}`);
    };
    image.src = url;
    return texture;
}

// --- INIT ---
function initializeWebGL() {
    const vs = compileShader(vertexShaderSource, context.VERTEX_SHADER);
    const fs = compileShader(fragmentShaderSource, context.FRAGMENT_SHADER);

    shaderProgram = context.createProgram();
    context.attachShader(shaderProgram, vs);
    context.attachShader(shaderProgram, fs);
    context.linkProgram(shaderProgram);

    if (!context.getProgramParameter(shaderProgram, context.LINK_STATUS)) {
        console.error("Link Error: " + context.getProgramInfoLog(shaderProgram));
    }
    context.useProgram(shaderProgram);

    // Get Locations
    const posLoc = context.getAttribLocation(shaderProgram, "aVertexPosition");
    timeUniformLocation = context.getUniformLocation(shaderProgram, "uTime");
    resolutionUniformLocation = context.getUniformLocation(shaderProgram, "uResolution");
    dayTextureLocation = context.getUniformLocation(shaderProgram, "uDayTexture");
    nightTextureLocation = context.getUniformLocation(shaderProgram, "uNightTexture");
    timeMixLocation = context.getUniformLocation(shaderProgram, "uTimeMix");
    brightnessLocation = context.getUniformLocation(shaderProgram, "uBrightness");
    colorFilterLocation = context.getUniformLocation(shaderProgram, "uColorFilter");
    waveStyleLocation = context.getUniformLocation(shaderProgram, "uWaveStyle");
    mouseUniformLocation = context.getUniformLocation(shaderProgram, "uMouse");
    bgTintLocation = context.getUniformLocation(shaderProgram, "uEnableBgTint"); // Added

    // Quad Buffer
    const buffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), context.STATIC_DRAW);
    context.enableVertexAttribArray(posLoc);
    context.vertexAttribPointer(posLoc, 2, context.FLOAT, false, 0, 0);

    requestAnimationFrame(renderFrame);
}

function updateBackground(index) {
    if (loadedBgIndex === index) return;

    if (index > totalBackgrounds) index = 1;
    if (index < 1) index = totalBackgrounds;

    const bgStr = index.toString().padStart(2, '0');
    const url = `${texturePath}bg_${bgStr}.bmp`;

    currentTexture = loadTexture(context, url);
    loadedBgIndex = index;
}

// --- RENDER ---
function renderFrame(timeMs) {
    context.clear(context.COLOR_BUFFER_BIT);

    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;

    // --- AUTO MONTH LOGIC ---
    if (isAutoMonth) {
        const date = new Date();
        const monthIndex = date.getMonth() + 1;
        if (currentBgIndex !== monthIndex) {
            currentBgIndex = monthIndex;
        }
    }

    updateBackground(currentBgIndex);

    const timeSec = timeMs * 0.001;

    context.uniform1f(timeUniformLocation, timeSec);
    context.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    context.uniform2f(mouseUniformLocation, mouse.x, mouse.y);

    if (currentTexture) {
        context.activeTexture(context.TEXTURE0);
        context.bindTexture(context.TEXTURE_2D, currentTexture);
        context.uniform1i(dayTextureLocation, 0);

        context.activeTexture(context.TEXTURE1);
        context.bindTexture(context.TEXTURE_2D, currentTexture);
        context.uniform1i(nightTextureLocation, 1);
    }

    // --- UNIFORM UPDATES ---
    context.uniform1f(timeMixLocation, 0.0);
    context.uniform1f(brightnessLocation, currentBrightnessBoost);
    context.uniform3f(colorFilterLocation, currentThemeColor[0], currentThemeColor[1], currentThemeColor[2]);
    context.uniform1i(waveStyleLocation, waveStyle);

    // Pass the Tint Enable Flag (0=ThemeColor, 1=White)
    context.uniform1i(bgTintLocation, enableBgTint);

    context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(renderFrame);
}

// --- UI LOGIC ---

// 1. Sidebar Toggle
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

// 2. Style List Logic
const styleBtns = document.querySelectorAll('.style-list .menu-item');
function updateStyleSelection() {
    styleBtns.forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.value) === waveStyle) {
            btn.classList.add('active');
        }
    });
}
styleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        waveStyle = parseInt(e.target.dataset.value, 10);
        updateStyleSelection();
    });
});

// 3. Color Grid Logic
const colorGrid = document.getElementById('color-grid');

function initColorGrid() {
    if (!colorGrid) return;
    colorGrid.innerHTML = '';

    // A. "Automatic" Button
    const autoBtn = document.createElement('div');
    autoBtn.className = 'menu-item';
    autoBtn.dataset.type = 'auto';
    autoBtn.textContent = "By Month";

    autoBtn.addEventListener('click', () => {
        isAutoMonth = true;
        const date = new Date();
        currentBgIndex = date.getMonth() + 1;
        updateGridSelection();
    });
    colorGrid.appendChild(autoBtn);


    // B. Background Buttons (1 to 34)
    for (let i = 1; i <= totalBackgrounds; i++) {
        const btn = document.createElement('div');
        btn.className = 'menu-item';
        btn.dataset.index = i;

        const preview = document.createElement('div');
        preview.className = 'color-preview';

        const bgStr = i.toString().padStart(2, '0');
        preview.style.backgroundImage = `url('${texturePath}bg_${bgStr}.bmp')`;
        preview.style.backgroundSize = 'cover';

        btn.appendChild(preview);

        btn.addEventListener('click', () => {
            isAutoMonth = false;
            currentBgIndex = i;
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

    if (isAutoMonth) {
        const autoBtn = document.querySelector('#color-grid .menu-item[data-type="auto"]');
        if (autoBtn) autoBtn.classList.add('active');
    } else {
        const activeBtn = document.querySelector(`#color-grid .menu-item[data-index="${currentBgIndex}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

// --- INIT ---
initColorGrid();
initializeWebGL();