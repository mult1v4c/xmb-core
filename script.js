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
    colorFilterLocation, waveStyleLocation, mouseUniformLocation;

let currentTexture;
let loadedBgIndex = -1;

// State
let currentBgIndex = 1;
let waveStyle = 0;
let isAutoMonth = true; // Default to Auto on load

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

    // --- AUTO DATE LOGIC ---
    if (isAutoMonth) {
        const date = new Date();
        const monthIndex = date.getMonth() + 1; // 1-12

        if (currentBgIndex !== monthIndex) {
            currentBgIndex = monthIndex;
            // No UI update here to avoid infinite loops/visual flickering,
            // but the texture will update below.
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

    context.uniform1f(timeMixLocation, 0.0);
    context.uniform1f(brightnessLocation, 1.0);
    context.uniform3f(colorFilterLocation, 1.0, 1.0, 1.0);
    context.uniform1i(waveStyleLocation, waveStyle);

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
        if (isOpen) {
            settingsBtn.classList.add('open');
        } else {
            settingsBtn.classList.remove('open');
        }
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

    // --- A. Create "Automatic" Row (The Multi-Color Option) ---
    const autoBtn = document.createElement('div');
    autoBtn.className = 'menu-item';
    autoBtn.dataset.type = 'auto'; // Helper for selection logic

    autoBtn.textContent = "By Month";

    autoBtn.addEventListener('click', () => {
        isAutoMonth = true;
        // Trigger an immediate update
        const date = new Date();
        currentBgIndex = date.getMonth() + 1;
        updateGridSelection();
    });

    colorGrid.appendChild(autoBtn);


    // --- B. Create Standard Color Rows (1 to 34) ---
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