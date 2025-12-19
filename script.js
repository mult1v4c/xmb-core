/*******************************
* XMB WAVE BACKGROUND BEHAVIOR *
*******************************/

const canvas = document.getElementById("webgl-canvas");
const context = canvas.getContext("webgl");

if (!context) {
    console.error("WebGL not supported");
}

// --- CONFIGURATION ---
const texturePath = "./assets/textures/";

// --- DATA TABLES ---

// [UPDATED] Authentic Brightness Values from PS3 Dev Wiki
// Converted from Hex table: 00h (#1e1e1e) to 23h (#2d2d2d)
const brightnessTable = [
    0.118, // 00:00 (Night)
    0.059, // 01:00
    0.000, // 02:00 (Darkest Point - texture swap happens here)
    0.122, // 03:00 (Sunrise start)
    0.243, // 04:00
    0.365, // 05:00
    0.486, // 06:00
    0.608, // 07:00
    0.729, // 08:00
    0.851, // 09:00
    0.973, // 10:00 (Peak Brightness)
    0.882, // 11:00
    0.824, // 12:00
    0.765, // 13:00
    0.706, // 14:00
    0.647, // 15:00
    0.588, // 16:00
    0.529, // 17:00 (Day ends)
    0.471, // 18:00 (Night starts)
    0.412, // 19:00
    0.353, // 20:00
    0.294, // 21:00
    0.235, // 22:00
    0.176  // 23:00
];

const monthColors = {
    1:  [0.80, 0.80, 0.80], 2:  [0.85, 0.75, 0.10], 3:  [0.42, 0.70, 0.09],
    4:  [0.88, 0.49, 0.60], 5:  [0.09, 0.53, 0.08], 6:  [0.60, 0.38, 0.78],
    7:  [0.01, 0.80, 0.78], 8:  [0.05, 0.46, 0.75], 9:  [0.70, 0.27, 0.75],
    10: [0.90, 0.65, 0.03], 11: [0.53, 0.35, 0.12], 12: [0.89, 0.25, 0.16]
};

// --- GLOBALS ---
let shaderProgram;
// Locations
let timeUniformLocation, resolutionUniformLocation, dayTextureLocation,
    nightTextureLocation, timeMixLocation, brightnessLocation,
    colorFilterLocation, waveStyleLocation, mouseUniformLocation;

let currentDayTexture, currentNightTexture;
let loadedMonth = -1;

// State
let overrideMonth = 8; // Default to Blue
let waveStyle = 0; // Default to Waves

// Mouse State
let mouse = { x: 0, y: 0 };
let targetMouse = { x: 0, y: 0 };

// Brightness State
let isAutoBrightness = true;
let manualHour = 12; // Default to Noon

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

function updateTexturesForMonth(monthIndex) {
    if (loadedMonth === monthIndex) return;
    const monthStr = monthIndex.toString().padStart(2, '0');
    currentDayTexture = loadTexture(context, `${texturePath}day_${monthStr}.png`);
    currentNightTexture = loadTexture(context, `${texturePath}night_${monthStr}.png`);
    loadedMonth = monthIndex;
}

// --- RENDER ---
function renderFrame(timeMs) {
    context.clear(context.COLOR_BUFFER_BIT);

    // Smooth Mouse
    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;

    const date = new Date();
    let month = (overrideMonth > 0) ? overrideMonth : date.getMonth() + 1;
    const sysHour = date.getHours();

    updateTexturesForMonth(month);

    // --- TIME OF DAY LOGIC ---
    let targetHour;

    if (isAutoBrightness) {
        targetHour = sysHour;

        // Sync slider UI to real time
        const slider = document.getElementById('brightness-slider');
        const display = document.getElementById('time-display');
        if (slider && display) {
            slider.value = targetHour;
            display.textContent = `${targetHour.toString().padStart(2, '0')}:00`;
        }
    } else {
        targetHour = manualHour;
    }

    // 1. Get Brightness from Authentic Wiki Table
    const brightness = brightnessTable[targetHour];

    // 2. Determine Day/Night Texture
    // Wiki: Night ends at 02:59, Day starts 03:00. Day ends 17:59.
    let timeMix;
    if (targetHour >= 3 && targetHour < 18) {
        timeMix = 0.0; // Day
    } else {
        timeMix = 1.0; // Night
    }

    const colorFilter = monthColors[month] || [1.0, 1.0, 1.0];
    const timeSec = timeMs * 0.001;

    // Uniforms
    context.uniform1f(timeUniformLocation, timeSec);
    context.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    context.uniform2f(mouseUniformLocation, mouse.x, mouse.y);

    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, currentDayTexture);
    context.uniform1i(dayTextureLocation, 0);

    context.activeTexture(context.TEXTURE1);
    context.bindTexture(context.TEXTURE_2D, currentNightTexture);
    context.uniform1i(nightTextureLocation, 1);

    context.uniform1f(timeMixLocation, timeMix);
    context.uniform1f(brightnessLocation, brightness);
    context.uniform3f(colorFilterLocation, colorFilter[0], colorFilter[1], colorFilter[2]);
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
const styleBtns = document.querySelectorAll('.style-btn');

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


// 3. Color List Logic
const colorGrid = document.getElementById('color-grid');

// Detailed Names matching authentic XMB colors
const monthLabels = [
    "Automatic",
    "January (Silver)",
    "February (Gold)",
    "March (Light Green)",
    "April (Pink)",
    "May (Emerald)",
    "June (Purple)",
    "July (Cyan)",
    "August (Blue)",
    "September (Violet)",
    "October (Orange)",
    "November (Brown)",
    "December (Red)"
];

function initColorGrid() {
    if (!colorGrid) return;
    colorGrid.innerHTML = '';

    for (let i = 0; i <= 12; i++) {
        // Container Row (The clickable button)
        const btn = document.createElement('div');
        btn.className = 'color-row'; // Changed class name for clarity
        btn.dataset.month = i;

        // 1. The Preview Box (Left side)
        const preview = document.createElement('div');
        preview.className = 'color-preview';

        if (i === 0) {
            // Auto Icon
            preview.style.background = "linear-gradient(135deg, #555, #999)";
            preview.innerHTML = '<i class="bi bi-magic" style="color:white; font-size: 0.8rem;"></i>';
            preview.style.display = 'grid';
            preview.style.placeContent = 'center';
        } else {
            // Texture Preview
            const monthStr = i.toString().padStart(2, '0');
            preview.style.backgroundImage = `url('${texturePath}day_${monthStr}.png')`;
            preview.style.backgroundSize = 'cover';

            // Fallback Color
            const c = monthColors[i];
            preview.style.backgroundColor = `rgb(${c[0]*255}, ${c[1]*255}, ${c[2]*255})`;
        }

        // 2. The Text Label (Right side)
        const label = document.createElement('span');
        label.className = 'color-label';
        label.textContent = monthLabels[i];

        // Assemble
        btn.appendChild(preview);
        btn.appendChild(label);

        // Click Handler
        btn.addEventListener('click', () => {
            setTheme(i);
        });

        colorGrid.appendChild(btn);
    }

    updateGridSelection();
    updateStyleSelection();
}

function setTheme(monthIndex) {
    overrideMonth = monthIndex;
    loadedMonth = -1;
    updateGridSelection();
}

function updateGridSelection() {
    // Update active class on the ROW
    document.querySelectorAll('.color-row').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.color-row[data-month="${overrideMonth}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

// 4. Time/Brightness Logic
const autoCheck = document.getElementById('auto-brightness-check');
const brightSlider = document.getElementById('brightness-slider');
const timeDisplay = document.getElementById('time-display');

if (autoCheck && brightSlider) {
    // Checkbox Toggle
    autoCheck.addEventListener('change', (e) => {
        isAutoBrightness = e.target.checked;
        brightSlider.disabled = isAutoBrightness;

        if (isAutoBrightness) {
            brightSlider.classList.add('disabled');
        } else {
            brightSlider.classList.remove('disabled');
            // When switching to manual, set manualHour to current slider value
            manualHour = parseInt(brightSlider.value, 10);
        }
    });

    // Slider Input (Dragging)
    brightSlider.addEventListener('input', (e) => {
        manualHour = parseInt(e.target.value, 10);
        // Update text immediately for feedback
        if (timeDisplay) {
            timeDisplay.textContent = `${manualHour.toString().padStart(2, '0')}:00`;
        }
    });
}

// --- INIT ---
initColorGrid();
initializeWebGL();