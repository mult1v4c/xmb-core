export const vertexShaderSource = `
    attribute vec2 aVertexPosition;
    void main() {
        gl_Position = vec4(aVertexPosition, 0.0, 1.0);
    }
`;

export const commonGLSL = `
    precision highp float;

    uniform float uTime;
    uniform vec2  uResolution;
    uniform sampler2D uDayTexture;
    uniform sampler2D uNightTexture;
    uniform float     uTimeMix;
    uniform float     uBrightness;
    uniform vec3      uColorFilter;
    uniform int       uWaveStyle;
    uniform int       uEnableBgTint;

    // --- BLEND MODES ---
    vec3 blendScreen(vec3 base, vec3 blend) {
        return 1.0 - ((1.0 - base) * (1.0 - blend));
    }

    // --- NOISE & MATH HELPERS ---
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
`;