// ==========================================
// VERTEX SHADER
// ==========================================
const vertexShaderSource = `
attribute vec2 aVertexPosition;
void main() {
    gl_Position = vec4(aVertexPosition, 0.0, 1.0);
}
`;

// ==========================================
// FRAGMENT SHADER
// ==========================================
const fragmentShaderSource = `
precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform sampler2D uDayTexture;
uniform sampler2D uNightTexture;
uniform float     uTimeMix;
uniform float     uBrightness;
uniform vec3      uColorFilter;
uniform int       uWaveStyle;    // 0=Original, 1=Classic, 2=PS3
uniform int       uEnableBgTint; // 0=White Waves, 1=Colored Waves

// ==========================================
// BLEND MODE LIBRARY
// ==========================================

vec3 blendScreen(vec3 base, vec3 blend) {
    return 1.0 - ((1.0 - base) * (1.0 - blend));
}

// ==========================================
// UTILS
// ==========================================
float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float value2d(vec2 p) {
    vec2 pg = floor(p);
    vec2 pc = p - pg;
    vec2 k = vec2(0, 1);
    pc *= pc * pc * (3.0 - 2.0 * pc);
    return mix(
        mix(hash12(pg + k.xx), hash12(pg + k.yx), pc.x),
        mix(hash12(pg + k.xy), hash12(pg + k.yy), pc.x),
        pc.y
    );
}

float get_stars_rough(vec2 p) {
    float s = smoothstep(0.99, 1.0, hash12(p));
    if (s >= 0.99) s = pow((s - 0.99) / (1.0 - 0.99), 10.0);
    return s;
}

float get_stars(vec2 p, float a, float t) {
    vec2 pg = floor(p);
    vec2 pc = p - pg;
    vec2 k = vec2(0, 1);
    pc *= pc * pc * (3.0 - 2.0 * pc);
    float s = mix(
        mix(get_stars_rough(pg + k.xx), get_stars_rough(pg + k.yx), pc.x),
        mix(get_stars_rough(pg + k.xy), get_stars_rough(pg + k.yy), pc.x),
        pc.y
    );
    return smoothstep(a, a + t, s) * pow(value2d(p * 0.1 + uTime) * 0.5 + 0.5, 8.3);
}

float get_dust(vec2 p, vec2 size, float f) {
    vec2 ar = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 pp = p * size * ar;
    return pow(0.64 + 0.46 * cos(p.x * 6.28), 1.7) * f * (
        get_stars(0.1 * pp + uTime * vec2(20.0, -10.1), 0.11, 0.71) * 4.0 +
        get_stars(0.2 * pp + uTime * vec2(30.0, -10.1), 0.1, 0.31) * 5.0 +
        get_stars(0.32 * pp + uTime * vec2(40.0, -10.1), 0.1, 0.91) * 2.0
    );
}

float sdf(vec3 p) {
    p *= 2.0;
    float o =
        4.2 * sin(0.05 * p.x + uTime * 0.25) +
        (0.04 * p.z) * sin(p.x * 0.11 + uTime) * 2.0 * sin(p.z * 0.2 + uTime) * value2d(vec2(0.03, 0.4) * p.xz + vec2(uTime * 0.5, 0.0));
    return abs(dot(p, normalize(vec3(0, 1, 0.05))) + 2.5 + o * 0.5);
}

vec2 raymarch(vec3 o, vec3 d, float omega) {
    float t = 0.0;
    float a = 0.0;
    float g = 40.0;
    float dt = 0.0;
    float sl = 0.0;
    float emin = 0.03;
    float ed = emin;

    for (int i = 0; i < 40; i++) {
        vec3 p = o + d * t;
        float ndt = sdf(p);
        if (abs(dt) + abs(ndt) < sl) { sl -= omega * sl; omega = 1.0; }
        else { sl = ndt * omega; }
        dt = ndt; t += sl;
        g = (t > 10.0) ? min(g, abs(dt)) : 40.0;
        if (t >= 40.0) break;
        if (dt < 0.13) {
             float f = smoothstep(0.09, 0.11, (p.z * 0.9) / 100.0);
             if (a == 0.0) a = 0.01;
             ed = 2.0 * max(emin, abs(ndt));
             a += 0.0135 * f;
             t += ed;
        }
    }
    g /= 3.0;
    return vec2(a, max(1.0 - g, 0.0));
}

// --- CLASSIC STYLE FUNCTIONS ---
float calcComplexSine(vec2 uv, float speed, float frequency, float amplitude, float phaseShift, float verticalOffset, float lineWidth, float sharpness, bool invertFalloff) {
    float angle = uTime * speed * frequency * -1.0 + (phaseShift + uv.x) * 2.0;
    float waveY = sin(angle) * amplitude + verticalOffset;
    float deltaY = waveY - uv.y;
    float distanceVal = distance(waveY , uv.y);
    if (invertFalloff) {
        if (deltaY > 0.0) distanceVal *= 4.0;
    } else {
        if (deltaY < 0.0) distanceVal *= 4.0;
    }
    float smoothVal = smoothstep(lineWidth * 1.5, 0.0, distanceVal);
    return pow(smoothVal, sharpness);
}

// --- ORIGINAL STYLE FUNCTIONS (PSP) ---
vec3 calcOriginalWaves(vec2 uv, vec3 themeColor, vec3 bg) {
    // ==========================================
    // 1. CONFIGURATION
    // ==========================================

    // --- VISUALS ---
    float opacityTop        = 0.5;   // Opacity at the peak of the wave
    float opacityBottom     = 0.0;   // Opacity at the bottom of the gradient
    float waveIntensity     = 1.5;   // Brightness multiplier for the wave color
    float edgeSoftness      = 0.004; // Antialiasing for the wave edge
    float colorShadowFactor = 0.0;   // How dark the bottom color gets (0.0 = Black/None)

    // --- MAIN WAVE PHYSICS ---
    float mainWaveFreq      = 3.2;   // "Width" of the wave (3.2 fits ~1 hump on screen)
    float mainWaveSpeed     = 0.15;  // How fast the main wave crawls left-to-right
    float ampBase           = 0.15;  // Minimum height of the wave
    float ampVariance       = 0.05;  // How much the height swells up/down
    float swellSpeed        = 0.3;   // Speed of the height breathing cycle

    // --- SUB-WAVE PHYSICS (The "Gliding Bump") ---
    float subWaveFreq       = 4.0;   // Width of the gliding bump
    float subWaveSpeed      = 0.6;   // Speed of the bump (should be != mainSpeed)
    float subWaveAmp        = 0.02;  // Height of the bump (0.02 is subtle)
    float subWaveOffset     = 1.2;   // Offset to de-sync bump between layers (i * val)

    // --- SYNC & DRIFT (Elastic Partner Logic) ---
    float driftSpeed        = 0.2;   // How fast they move apart/together
    float driftMaxGap       = 0.08;  // Maximum distance between the two waves

    // ==========================================
    // 2. SETUP
    // ==========================================
    vec3 currentBackground = bg;

    // Determine Wave Color
    // 0 = Use Theme Color, 1 = Use Pure White
    vec3 baseWaveColor = (uEnableBgTint == 0) ? themeColor : vec3(1.0);

    float brightness = length(baseWaveColor);
    float themeBoost = (brightness > 1.2) ? 0.8 : 1.2;

    vec3 colTop = baseWaveColor * themeBoost;
    vec3 colBot = baseWaveColor * colorShadowFactor;

    // ==========================================
    // 3. WAVE LOOP
    // ==========================================
    for (float i = 0.0; i < 2.0; i++) {
        float t = uTime;

        // --- A. AMPLITUDE CALCULATION ---
        // Calculates the breathing height of the wave
        float swellNoise = sin(t * swellSpeed) + sin(t * (swellSpeed * 0.5) + i);
        float currentAmp = ampBase + (swellNoise * ampVariance);

        // --- B. SYNC & DRIFT CALCULATION ---
        // Calculates the gap between the two wave layers
        float driftCycle = sin(t * driftSpeed);
        float gapSize    = (driftCycle * 0.5 + 0.5) * driftMaxGap;
        float phaseOffset = i * gapSize;

        // --- C. SUB-WAVE (GLIDING BUMP) ---
        // The secondary shape that rides along the main wave
        float subWave = sin((uv.x * subWaveFreq) - (t * subWaveSpeed) + (i * subWaveOffset)) * subWaveAmp;

        // --- D. MAIN WAVE CALCULATION ---
        // The primary crawling sine wave
        float mainWave = sin((uv.x * mainWaveFreq) - (t * mainWaveSpeed) + phaseOffset);

        // Combine: Base Y + (Main Wave * Amplitude) + Sub-Wave
        float waveY = 0.5 + (mainWave * currentAmp) + subWave;

        // --- E. RENDERING (Masking & Gradient) ---
        float mask = smoothstep(waveY + edgeSoftness, waveY, uv.y);
        float gradFactor = clamp((waveY - uv.y) / waveY, 0.0, 1.0);

        // Interpolate Opacity & Color
        float currentOpacity = mix(opacityTop, opacityBottom, gradFactor);
        vec3 wCol = mix(colTop, colBot, gradFactor);

        // Composition (Screen Blend)
        vec3 boostColor = clamp(wCol * waveIntensity, 0.0, 1.0);
        vec3 blendedResult = blendScreen(currentBackground, boostColor);

        // Final Mix
        float finalAlpha = mask * currentOpacity;
        currentBackground = mix(currentBackground, blendedResult, finalAlpha);
    }

    return currentBackground;
}

// --- MAIN ---
void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;

    vec2 textureUV = vec2(uv.x, 1.0 - uv.y);
    vec4 dayColor = texture2D(uDayTexture, textureUV);
    vec4 nightColor = texture2D(uNightTexture, textureUV);

    vec3 background = mix(dayColor.rgb, nightColor.rgb, uTimeMix);
    vec3 finalColor = background;

    if (uWaveStyle == 0) {
        // --- CLASSIC STYLE ---
        float intensity = 0.0;
        intensity += calcComplexSine(uv, 0.2, 0.20, 0.2, 0.0, 0.5, 0.1, 15.0, false);
        intensity += calcComplexSine(uv, 0.4, 0.40, 0.15, 0.0, 0.5, 0.1, 17.0, false);
        intensity += calcComplexSine(uv, 0.3, 0.60, 0.15, 0.0, 0.5, 0.05, 23.0, false);
        intensity += calcComplexSine(uv, 0.1, 0.26, 0.07, 0.0, 0.3, 0.1, 17.0, true);
        intensity += calcComplexSine(uv, 0.3, 0.36, 0.07, 0.0, 0.3, 0.1, 17.0, true);
        intensity += calcComplexSine(uv, 0.5, 0.46, 0.07, 0.0, 0.3, 0.05, 23.0, true);
        intensity += calcComplexSine(uv, 0.2, 0.58, 0.05, 0.0, 0.3, 0.2, 15.0, true);
        finalColor += (vec3(1.0) * intensity * 0.5);
    }
    else if (uWaveStyle == 1) {
        // ORIGINAL (PSP Style)
        finalColor = calcOriginalWaves(uv, uColorFilter, finalColor);
    }
    else if (uWaveStyle == 2) {
        // PS3 Style
        vec3 rayOrigin = vec3(0.0);
        vec3 rayDir = normalize(vec3((uv - 0.5) * vec2(uResolution.x/uResolution.y, 1.0), 1.0));
        vec2 mg = raymarch(rayOrigin, rayDir, 1.2);
        vec3 waveColor = mix(vec3(1.0), uColorFilter, 0.3);
        finalColor = mix(finalColor, waveColor, mg.x * 2.0);
        finalColor += get_dust(uv, vec2(2000.0), mg.y) * 0.3;
    }

    // --- GLOBAL BRIGHTNESS ---
    finalColor = finalColor * uBrightness;

    gl_FragColor = vec4(finalColor, 1.0);
}
`;