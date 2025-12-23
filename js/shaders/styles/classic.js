export const StyleClassic = {
    id: 1,
    name: "Classic",
    functions: `
        vec3 calcClassicWaves(vec2 uv, vec3 themeColor, vec3 bg) {
            // --- STYLING CONFIG ---
            float opacityTop = 0.6;
            float opacityBottom = 0.0;
            float waveIntensity = 1.3;
            float edgeSoftness = 0.003;
            float fadeWidth = 0.18;
            float gradientEase = 1.5;

            // --- SHADOW CONFIG ---
            float shadowStrength = 0.1;
            float shadowWidth = 0.5;
            float shadowTint = 1.0;

            // --- PHYSICS CONSTANTS ---
            float speed = 0.025;
            float rotSpeed = 0.15;
            float baseAmp = 0.10;
            float freq = 2.0;

            // --- MICRO RIPPLES ---
            float rippleAmp = 0.005;
            float rippleFreq = 6.0;
            float rippleSpeed = 0.15;

            vec3 currentBackground = bg;
            vec3 baseWaveColor = (uEnableBgTint == 1) ? themeColor : vec3(1.0);

            float brightness = length(baseWaveColor);
            float themeBoost = (brightness > 1.2) ? 0.8 : 1.2;
            vec3 colNear = baseWaveColor * themeBoost;
            vec3 colFar = vec3(0.0);

            for (float i = 0.0; i < 4.0; i++) {
                // 1. DETERMINE ZONE
                float isTop = step(2.0, i);
                float zoneCenter = mix(0.2, 0.8, isTop);
                float waveCenter = zoneCenter;

                // 2. PHYSICS
                float phase = i * 2.5;
                float rotPhase = i * (3.14159 / 2.0);

                float rotation = sin(uTime * rotSpeed + rotPhase);
                float xOffset = uTime * speed;
                float wave = sin((uv.x * freq) + xOffset + phase);

                float ripple = sin((uv.x * rippleFreq) + (uTime * rippleSpeed) + (i * 1.5));
                ripple *= rippleAmp;

                float waveY = waveCenter + (wave * baseAmp * rotation) + ripple;

                // --- SHADOW LOGIC ---
                if (isTop < 0.5) {
                    float shadowDist = waveY - uv.y;

                    if (shadowDist > 0.0 && shadowDist < shadowWidth) {
                        float shadowGrad = 1.0 - clamp(shadowDist / shadowWidth, 0.0, 1.0);
                        shadowGrad = pow(shadowGrad, 2.0);

                        float shadowMask = smoothstep(0.0, edgeSoftness, shadowDist);
                        float finalShadowAlpha = shadowStrength * shadowGrad * shadowMask;

                        vec3 targetShadowColor = mix(vec3(0.0), themeColor, shadowTint);

                        currentBackground = mix(currentBackground, targetShadowColor, finalShadowAlpha);
                    }
                }

                // 3. MAIN WAVE DIRECTION LOGIC
                float dist = mix(uv.y - waveY, waveY - uv.y, isTop);

                // 4. ANTI-ALIASED EDGE
                float mask = smoothstep(-edgeSoftness, 0.0, dist);

                // 5. CALCULATE FADE
                float rawGrad = clamp(dist / fadeWidth, 0.0, 1.0);
                float gradFactor = pow(rawGrad, gradientEase);

                float currentOpacity = mix(opacityTop, opacityBottom, gradFactor);

                // 6. CLIP TAIL
                if (dist > fadeWidth) {
                    currentOpacity = 0.0;
                }

                // 7. COMPOSITE
                vec3 wCol = mix(colNear, colFar, gradFactor);
                vec3 boostColor = clamp(wCol * waveIntensity, 0.0, 1.0);
                vec3 blendedResult = blendScreen(currentBackground, boostColor);

                float finalAlpha = mask * currentOpacity;
                currentBackground = mix(currentBackground, blendedResult, finalAlpha);
            }

            return currentBackground;
        }
    `,
    mainBody: `
        finalColor = calcClassicWaves(uv, uColorFilter, finalColor);
    `
};