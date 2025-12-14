class ColorConverter {
    // --- BASIC CONVERSIONS ---
    static hexToRgb(hex) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const bigint = parseInt(hex, 16);
        if (isNaN(bigint)) return null;
        return {
            r: ((bigint >> 16) & 255) / 255.0,
            g: ((bigint >> 8) & 255) / 255.0,
            b: (bigint & 255) / 255.0
        };
    }

    static sRgbToLinear(val) {
        return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    }

    static linearRgbToXyz(r, g, b) {
        return {
            x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
            y: 0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
            z: 0.0193339 * r + 0.1191920 * g + 0.9503041 * b
        };
    }

    static xyzToOklab(x, y, z) {
        const l = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
        const m = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
        const s = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z;
        const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
        return {
            L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
        };
    }

    static oklabToOklch(L, a, b) {
        const C = Math.sqrt(a * a + b * b);
        let h = Math.atan2(b, a) * (180 / Math.PI);
        if (h < 0) h += 360;
        if (C < 0.0001) h = 0;
        return { L, C, h };
    }

    // --- REVERSE ---
    static oklchToRgb(L, C, h) {
        const hRad = h * (Math.PI / 180);
        const a = C * Math.cos(hRad);
        const b = C * Math.sin(hRad);

        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;

        const x = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        const y = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        const z = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

        const rLin =  3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
        const gLin = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
        const bLin =  0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

        const toSrgb = (v) => {
            if (v <= 0.0031308) return 12.92 * v;
            return 1.055 * Math.pow(v, 1.0 / 2.4) - 0.055;
        };

        return { r: toSrgb(rLin), g: toSrgb(gLin), b: toSrgb(bLin) };
    }

    static process(hex) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return null;
        const linR = this.sRgbToLinear(rgb.r);
        const linG = this.sRgbToLinear(rgb.g);
        const linB = this.sRgbToLinear(rgb.b);
        const xyz = this.linearRgbToXyz(linR, linG, linB);
        const lab = this.xyzToOklab(xyz.x, xyz.y, xyz.z);
        const lch = this.oklabToOklch(lab.L, lab.a, lab.b);
        return { rgb, lch };
    }

    static isGamut(rgb) {
        return rgb.r >= 0 && rgb.r <= 1 && rgb.g >= 0 && rgb.g <= 1 && rgb.b >= 0 && rgb.b <= 1;
    }

    static rgbToHex(r, g, b) {
        const toHex = (c) => {
            const hex = Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };
        return "#" + toHex(r) + toHex(g) + toHex(b);
    }
}

// --- APP LOGIC ---
const els = {
    hex: document.getElementById('hexInput'),
    picker: document.getElementById('colorPicker'),
    reset: document.getElementById('resetBtn'),
    sliderL: document.getElementById('sliderL'),
    sliderC: document.getElementById('sliderC'),
    sliderH: document.getElementById('sliderH'),
    valL: document.getElementById('valL'),
    valC: document.getElementById('valC'),
    valH: document.getElementById('valH'),
    steps: document.getElementById('stepsInput'),
    stepsVal: document.getElementById('stepsVal'),
    output: document.getElementById('oklchOutput'),
    palette: document.getElementById('palette')
};

let currentLch = { L: 0.7, C: 0.1, h: 200 };
const DEFAULT_COLOR = "#6495ED";

function updateFromAnchor(hex) {
    const data = ColorConverter.process(hex);
    if (!data) return;

    currentLch = data.lch;
    
    // Update visual controls
    els.hex.value = hex;
    els.picker.value = hex.length === 7 ? hex : els.picker.value;
    els.sliderL.value = currentLch.L;
    els.sliderC.value = currentLch.C;
    els.sliderH.value = currentLch.h;
    
    updateDisplay();
}

function updateFromSliders() {
    currentLch = {
        L: parseFloat(els.sliderL.value),
        C: parseFloat(els.sliderC.value),
        h: parseFloat(els.sliderH.value)
    };

    const rgb = ColorConverter.oklchToRgb(currentLch.L, currentLch.C, currentLch.h);
    const hex = ColorConverter.rgbToHex(rgb.r, rgb.g, rgb.b);
    els.hex.value = hex;
    els.picker.value = hex; 

    updateDisplay();
}

function updateDisplay() {
    els.valL.textContent = currentLch.L.toFixed(2);
    els.valC.textContent = currentLch.C.toFixed(2);
    els.valH.textContent = currentLch.h.toFixed(0);
    els.stepsVal.textContent = els.steps.value;

    const oklchStr = `oklch(${(currentLch.L*100).toFixed(2)}% ${currentLch.C.toFixed(4)} ${currentLch.h.toFixed(2)})`;
    els.output.textContent = oklchStr;

    renderPalette();
}

function renderPalette() {
    els.palette.innerHTML = '';
    
    const steps = parseInt(els.steps.value);
    
    // Find matched index for highlighting
    // We calculate which step's Lightness is closest to currentLch.L
    let closestIndex = -1;
    let minDiff = 100;

    for (let i = 0; i < steps; i++) {
        let targetL = 0.02 + (i * (0.96 / (steps - 1)));
        
        let diff = Math.abs(targetL - currentLch.L);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
        }
    }

    // Render loop
    for (let i = 0; i < steps; i++) {
        let targetL = 0.02 + (i * (0.96 / (steps - 1)));
        let displayC = currentLch.C;
        
        // Gamut Mapping
        let rgb = ColorConverter.oklchToRgb(targetL, displayC, currentLch.h);
        while (!ColorConverter.isGamut(rgb) && displayC > 0) {
            displayC -= 0.001;
            rgb = ColorConverter.oklchToRgb(targetL, displayC, currentLch.h);
        }

        const oklchStr = `oklch(${(targetL*100).toFixed(2)}% ${displayC.toFixed(4)} ${currentLch.h.toFixed(2)})`;

        const div = document.createElement('div');
        div.className = 'swatch';
        div.style.backgroundColor = oklchStr;
        div.style.color = targetL > 0.5 ? '#000' : '#fff';
        
        // Add active class if this is the closest match
        if (i === closestIndex) {
            div.classList.add('active');
        }

        div.title = "Click to Copy: " + oklchStr;
        div.innerHTML = `
            <div class="info">
                <span>${(targetL*100).toFixed(0)}%</span>
                <span>${displayC.toFixed(3)}</span>
            </div>
            <div class="copy-overlay">${oklchStr}</div>
        `;

        div.addEventListener('click', () => {
            navigator.clipboard.writeText(oklchStr);
            div.classList.add('copied');
            const overlay = div.querySelector('.copy-overlay');
            const originalText = overlay.textContent;
            overlay.textContent = "COPIED!";
            setTimeout(() => {
                div.classList.remove('copied');
                overlay.textContent = originalText;
            }, 1000);
        });
        
        els.palette.appendChild(div);
    }
}

// Event Listeners
els.hex.addEventListener('input', (e) => updateFromAnchor(e.target.value));
els.picker.addEventListener('input', (e) => updateFromAnchor(e.target.value));
els.reset.addEventListener('click', () => updateFromAnchor(DEFAULT_COLOR));

els.sliderL.addEventListener('input', updateFromSliders);
els.sliderC.addEventListener('input', updateFromSliders);
els.sliderH.addEventListener('input', updateFromSliders);
els.steps.addEventListener('input', updateDisplay);

// Init
updateFromAnchor(DEFAULT_COLOR);