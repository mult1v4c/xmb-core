import { commonGLSL } from './utils.js';
import { StyleClassic } from './styles/classic.js';
import { StyleOriginal } from './styles/original.js';
import { StylePS3 } from './styles/ps3.js';

// --- REGISTER STYLES HERE ---
// To add a new style, import it above and add it to this array.
export const ShaderStyles = [
    StyleClassic,
    StyleOriginal,
    StylePS3
];

export function assembleFragmentShader() {
    let src = commonGLSL;

    // Append functions
    ShaderStyles.forEach(style => {
        src += `\n// --- STYLE: ${style.name} ---\n`;
        src += style.functions;
    });

    // Main
    src += `
    void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;

        vec2 textureUV = vec2(uv.x, 1.0 - uv.y);
        vec4 dayColor = texture2D(uDayTexture, textureUV);
        vec4 nightColor = texture2D(uNightTexture, textureUV);
        vec3 background = mix(dayColor.rgb, nightColor.rgb, uTimeMix);
        vec3 finalColor = background;
    `;

    // Branching Logic
    ShaderStyles.forEach((style, index) => {
        const branch = (index === 0) ? "if" : "else if";
        src += `
        ${branch} (uWaveStyle == ${style.id}) {
            ${style.mainBody}
        }
        `;
    });

    src += `
        finalColor = finalColor * uBrightness;
        gl_FragColor = vec4(finalColor, 1.0);
    }
    `;

    return src;
}