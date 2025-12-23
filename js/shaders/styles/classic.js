export const StyleClassic = {
    id: 1,
    name: "Classic",
    functions: `
        float calcComplexSine(vec2 uv, float speed, float freq, float amp, float shift, float offset, float width, float sharp, bool invert) {
            float angle = uTime * speed * freq * -1.0 + (shift + uv.x) * 2.0;
            float waveY = sin(angle) * amp + offset;
            float deltaY = waveY - uv.y;
            float dist = distance(waveY, uv.y);
            if (invert) {
                if (deltaY > 0.0) dist *= 4.0;
            } else {
                if (deltaY < 0.0) dist *= 4.0;
            }
            return pow(smoothstep(width * 1.5, 0.0, dist), sharp);
        }
    `,
    mainBody: `
        float intensity = 0.0;
        intensity += calcComplexSine(uv, 0.2, 0.20, 0.2, 0.0, 0.5, 0.1, 15.0, false);
        intensity += calcComplexSine(uv, 0.4, 0.40, 0.15, 0.0, 0.5, 0.1, 17.0, false);
        intensity += calcComplexSine(uv, 0.3, 0.60, 0.15, 0.0, 0.5, 0.05, 23.0, false);
        intensity += calcComplexSine(uv, 0.1, 0.26, 0.07, 0.0, 0.3, 0.1, 17.0, true);
        intensity += calcComplexSine(uv, 0.3, 0.36, 0.07, 0.0, 0.3, 0.1, 17.0, true);
        intensity += calcComplexSine(uv, 0.5, 0.46, 0.07, 0.0, 0.3, 0.05, 23.0, true);
        intensity += calcComplexSine(uv, 0.2, 0.58, 0.05, 0.0, 0.3, 0.2, 15.0, true);
        finalColor += (vec3(1.0) * intensity * 0.5);
    `
};