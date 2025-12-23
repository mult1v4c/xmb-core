export const StyleOriginal = {
    id: 0,
    name: "Original",
    functions: `
        vec3 calcOriginalWaves(vec2 uv, vec3 themeColor, vec3 bg) {
            // --- CONFIGURATION ---
            float opacityTop = 0.5;
            float opacityBottom = 0.0;
            float waveIntensity = 1.5;
            float edgeSoftness = 0.004;
            float gradientEase = 0.5;

            // --- PHYSICS ---
            float mainWaveFreq = 3.2;
            float mainWaveSpeed = 0.15;
            float ampBase = 0.15;
            float ampVariance = 0.05;
            float swellSpeed = 0.3;

            float subWaveFreq = 4.0;
            float subWaveSpeed = 0.6;
            float subWaveAmp = 0.02;
            float subWaveOffset = 1.2;

            float driftSpeed = 0.2;
            float driftMaxGap = 0.01;

            // --- SETUP ---
            vec3 currentBackground = bg;
            vec3 baseWaveColor = (uEnableBgTint == 1) ? themeColor : vec3(1.0);

            float brightness = length(baseWaveColor);
            float themeBoost = (brightness > 1.2) ? 0.8 : 1.2;

            vec3 colTop = baseWaveColor * themeBoost;
            vec3 colBot = vec3(0.0);

            // --- LOOP ---
            for (float i = 0.0; i < 2.0; i++) {
                float t = uTime;

                float swellNoise = sin(t * swellSpeed) + sin(t * (swellSpeed * 0.5) + i);
                float currentAmp = ampBase + (swellNoise * ampVariance);

                float driftCycle = sin(t * driftSpeed);
                float gapSize    = (driftCycle * 0.5 + 0.5) * driftMaxGap;
                float phaseOffset = i * gapSize;

                float subWave = sin((uv.x * subWaveFreq) - (t * subWaveSpeed) + (i * subWaveOffset)) * subWaveAmp;
                float mainWave = sin((uv.x * mainWaveFreq) - (t * mainWaveSpeed) + phaseOffset);

                float waveY = 0.5 + (mainWave * currentAmp) + subWave;

                float mask = smoothstep(waveY + edgeSoftness, waveY, uv.y);
                float rawGrad = clamp((waveY - uv.y) / waveY, 0.0, 1.0);
                float gradFactor = pow(rawGrad, gradientEase);

                float currentOpacity = mix(opacityTop, opacityBottom, gradFactor);
                vec3 wCol = mix(colTop, colBot, gradFactor);

                vec3 boostColor = clamp(wCol * waveIntensity, 0.0, 1.0);
                vec3 blendedResult = blendScreen(currentBackground, boostColor);

                float finalAlpha = mask * currentOpacity;
                currentBackground = mix(currentBackground, blendedResult, finalAlpha);
            }
            return currentBackground;
        }
    `,
    mainBody: `
        finalColor = calcOriginalWaves(uv, uColorFilter, finalColor);
    `
};