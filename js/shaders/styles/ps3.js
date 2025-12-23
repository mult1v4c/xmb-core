export const StylePS3 = {
    id: 2,
    name: "PS3",
    functions: `
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
            float o = 4.2 * sin(0.05 * p.x + uTime * 0.25) +
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
    `,
    mainBody: `
        vec3 rayOrigin = vec3(0.0);
        vec3 rayDir = normalize(vec3((uv - 0.5) * vec2(uResolution.x/uResolution.y, 1.0), 1.0));
        vec2 mg = raymarch(rayOrigin, rayDir, 1.2);
        vec3 waveColor = mix(vec3(1.0), uColorFilter, 0.3);
        finalColor = mix(finalColor, waveColor, mg.x * 2.0);
        finalColor += get_dust(uv, vec2(2000.0), mg.y) * 0.3;
    `
};