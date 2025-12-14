// Main Class structure as recommended 
class ColorConverter {
    
    // Stage 1: Decoding and Normalization [cite: 16, 17]
    static hexToRgb(hex) {
        // Remove hash if present
        hex = hex.replace(/^#/, '');

        // Expand shorthand (e.g. "F00" -> "FF0000") [cite: 43]
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }

        // Parse to integer [cite: 36]
        const bigint = parseInt(hex, 16);
        if (isNaN(bigint)) return null;

        // Bitwise extraction [cite: 40]
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;

        // Normalize to [0.0, 1.0] [cite: 49]
        return {
            r: r / 255.0,
            g: g / 255.0,
            b: b / 255.0
        };
    }

    // Stage 2: Linearization (EOTF Decoding) [cite: 18, 57]
    // We must use the piecewise function, not simple gamma 2.2 [cite: 66]
    static sRgbToLinear(val) {
        // Constants defined in IEC 61966-2-1:1999 [cite: 58, 62]
        const limit = 0.04045;
        if (val <= limit) {
            return val / 12.92;
        } else {
            return Math.pow((val + 0.055) / 1.055, 2.4);
        }
    }

    // Stage 3: Linear sRGB to CIE XYZ [cite: 19]
    // Using high-precision matrix for D65 white point [cite: 92]
    static linearRgbToXyz(linR, linG, linB) {
        // Matrix multiplication M_sRGB->XYZ [cite: 91]
        const x = 0.4124564 * linR + 0.3575761 * linG + 0.1804375 * linB;
        const y = 0.2126729 * linR + 0.7151522 * linG + 0.0721750 * linB;
        const z = 0.0193339 * linR + 0.1191920 * linG + 0.9503041 * linB;
        return { x, y, z };
    }

    // Stage 4 & 5: XYZ to Oklab [cite: 22, 108]
    static xyzToOklab(x, y, z) {
        // Step 4.1: XYZ to LMS (Sharpened Cone Response) [cite: 118]
        // Note the negative coefficient for spectral sharpening [cite: 125]
        const l = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
        const m = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
        const s = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z;

        // Step 4.2: Non-linear compression (Cube Root) [cite: 21, 131]
        // Must handle negative roots using Math.cbrt 
        const l_ = Math.cbrt(l);
        const m_ = Math.cbrt(m);
        const s_ = Math.cbrt(s);

        // Step 4.3: LMS to Oklab (Opponent Process) [cite: 22, 140]
        // Matrix M2 transforms to Lightness, a, and b axes [cite: 143]
        const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
        const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
        const b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

        return { L, a, b };
    }

    // Stage 6: Oklab to Oklch (Cylindrical Mapping) [cite: 23, 149]
    static oklabToOklch(L, a, b) {
        // Chroma: Vector magnitude [cite: 157]
        const C = Math.sqrt(a * a + b * b);

        // Hue: Angle in radians [cite: 165]
        let h = Math.atan2(b, a);

        // Convert radians to degrees [cite: 166]
        let hDeg = h * (180 / Math.PI);

        // Normalize degrees to 0-360 range
        if (hDeg < 0) hDeg += 360;

        // Handle achromatic singularity (Gray/Black/White) 
        if (C < 0.0001) hDeg = 0; 

        return { L, C, h: hDeg };
    }

    // Master function to run the full pipeline
    static process(hex) {
        // 1. Decode
        const rgb = this.hexToRgb(hex);
        if (!rgb) return null;

        // 2. Linearize
        const linR = this.sRgbToLinear(rgb.r);
        const linG = this.sRgbToLinear(rgb.g);
        const linB = this.sRgbToLinear(rgb.b);

        // 3. To XYZ
        const xyz = this.linearRgbToXyz(linR, linG, linB);

        // 4. To Oklab
        const lab = this.xyzToOklab(xyz.x, xyz.y, xyz.z);

        // 5. To Oklch
        const lch = this.oklabToOklch(lab.L, lab.a, lab.b);

        return { rgb, linRgb: {r: linR, g: linG, b: linB}, xyz, lab, lch };
    }
}

// UI Interaction
const input = document.getElementById('hexInput');
const output = document.getElementById('oklchOutput');
const preview = document.getElementById('colorPreview');
const debugEls = {
    norm: document.getElementById('normRgbVal'),
    lin: document.getElementById('linRgbVal'),
    xyz: document.getElementById('xyzVal'),
    lms: document.getElementById('lmsVal'), // We didn't explicitly return LMS in 'process' but we can infer or add it if needed
    oklab: document.getElementById('oklabVal')
};

function update() {
    const hex = input.value;
    const data = ColorConverter.process(hex);

    if (data) {
        // Format Output: oklch(L% C h) [cite: 203]
        // Rounding L and h to reasonable decimals, keeping C precise
        const L_percent = (data.lch.L * 100).toFixed(2) + "%";
        const C_val = data.lch.C.toFixed(4);
        const h_val = data.lch.h.toFixed(2);

        output.textContent = `oklch(${L_percent} ${C_val} ${h_val})`;
        preview.style.backgroundColor = hex;

        // Populate Debug info (Rounding to 4 decimals for display)
        const f = (n) => n.toFixed(4);
        debugEls.norm.textContent = `R:${f(data.rgb.r)} G:${f(data.rgb.g)} B:${f(data.rgb.b)}`;
        debugEls.lin.textContent = `R:${f(data.linRgb.r)} G:${f(data.linRgb.g)} B:${f(data.linRgb.b)}`;
        debugEls.xyz.textContent = `X:${f(data.xyz.x)} Y:${f(data.xyz.y)} Z:${f(data.xyz.z)}`;
        debugEls.oklab.textContent = `L:${f(data.lab.L)} a:${f(data.lab.a)} b:${f(data.lab.b)}`;
    }
}

input.addEventListener('input', update);
update(); // Run once on load