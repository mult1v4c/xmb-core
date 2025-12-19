// ==========================================
// CREDITS
// PS3 Menu Effect by int_45h https://www.shadertoy.com/view/tXy3DK
// PSP XMB by cosmicspace777 https://www.shadertoy.com/view/tft3WB
// PS3 XMB by sharads https://www.shadertoy.com/view/7slcWj
// XMB Wave Background by fchavonet https://github.com/fchavonet/creative_coding-xmb_wave_background
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
uniform int       uWaveStyle; // 0=Original, 1=Classic, 2=PS3

// --- PS3 ---
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

// --- WAVES ---
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

// --- CLASSIC ---
vec3 calcClassicWaves(vec2 uv, vec3 themeColor) {
    float baseY = 0.5;
    vec3 accColor = vec3(0.0);

    // SMART DIMMER:
    // Check how bright the theme is.
    // If > 1.2 (like Silver), drop the boost. If dark, increase it.
    float brightness = length(themeColor);
    float boost = (brightness > 1.2) ? 0.8 : 1.2;

    vec3 waveColorTop = themeColor * boost;
    vec3 waveColorBottom = themeColor * 0.6;

    for (float i = 0.0; i < 2.0; i++) {
        float t = uTime;
        float wave = sin((uv.x - t * 0.08) * 2.0 + (i * 1.5)) * 0.06;
        float waveY = baseY + (0.05 * i) + wave;

        float edgeSoftness = 0.004;
        float mask = smoothstep(waveY + edgeSoftness, waveY, uv.y);

        // This gradient makes the body visible
        float gradFactor = clamp((waveY - uv.y) / waveY, 0.0, 1.0);
        vec3 wCol = mix(waveColorTop, waveColorBottom, gradFactor);

        // Rim Light (Always bright white for glass edge)
        float rim = smoothstep(waveY + edgeSoftness, waveY, uv.y) * smoothstep(waveY - 0.003, waveY, uv.y);
        vec3 finalWave = wCol + (vec3(1.0) * rim * 0.6);

        // Alpha Mix:
        // Use a lower alpha (0.25) if bright, higher (0.5) if dark
        float alpha = (brightness > 1.2) ? 0.25 : 0.5;

        accColor += finalWave * mask * alpha;
    }
    return accColor;
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
        finalColor += calcClassicWaves(uv, uColorFilter);
    }

    else if (uWaveStyle == 2) {
        vec3 rayOrigin = vec3(0.0);
        vec3 rayDir = normalize(vec3((uv - 0.5) * vec2(uResolution.x/uResolution.y, 1.0), 1.0));
        vec2 mg = raymarch(rayOrigin, rayDir, 1.2);
        vec3 waveColor = mix(vec3(1.0), uColorFilter, 0.3);
        finalColor = mix(finalColor, waveColor, mg.x * 2.0);
        finalColor += get_dust(uv, vec2(2000.0), mg.y) * 0.3;
    }

    vec3 tint = mix(vec3(1.0), uColorFilter, 0.6);
    finalColor = finalColor * tint * uBrightness;

    gl_FragColor = vec4(finalColor, 1.0);
}
`;