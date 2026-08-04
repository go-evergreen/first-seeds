/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — PLANT
   Seed sits on dirt from day one.
   Roots grow from the three Roots answers.
   Sprout grows with each checklist item outside Roots.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

(function () {
  "use strict";

  /* Three primary roots = the three Roots answers.
     Side whiskers only appear when Roots is complete (rf ≈ 1). */
  var ROOTS = [
    { d: "M60 122 C54 134, 40 148, 32 164 C26 174, 22 180, 20 186", th: 0.00, w: 3.0 },
    { d: "M60 122 C66 134, 80 148, 88 164 C94 174, 98 180, 100 186", th: 0.34, w: 3.0 },
    { d: "M60 122 C58 136, 56 152, 55 168 C54 178, 54 184, 55 188", th: 0.67, w: 3.2 },
    { d: "M60 122 C48 130, 34 138, 24 148 C16 156, 12 162, 10 168", th: 0.95, w: 1.8 },
    { d: "M60 122 C72 130, 86 138, 96 148 C104 156, 108 162, 110 168", th: 0.95, w: 1.8 }
  ];

  function leafPath(cx, cy, len, rot, fill, opacity) {
    /* Soft pointed leaf — more plant-like than a flat ellipse */
    var tip = -len;
    var w = Math.max(3.2, len * 0.38);
    return '<path d="M' + cx + ' ' + cy +
      ' C' + (cx - w) + ' ' + (cy + tip * 0.35) + ', ' + (cx - w * 0.55) + ' ' + (cy + tip * 0.75) + ', ' + cx + ' ' + (cy + tip) +
      ' C' + (cx + w * 0.55) + ' ' + (cy + tip * 0.75) + ', ' + (cx + w) + ' ' + (cy + tip * 0.35) + ', ' + cx + ' ' + cy +
      ' Z" fill="' + fill + '" opacity="' + (opacity || 1) +
      '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"/>';
  }

  function rootProgress(rf, th) {
    return Math.max(0, Math.min(1, (rf - th) / 0.28));
  }

  function seedOnDirt() {
    var s = '<g class="plant-seed">';
    s += '<ellipse cx="60" cy="117" rx="6.5" ry="4.8" fill="#a89060"/>';
    s += '<ellipse cx="60" cy="115.2" rx="4.5" ry="3.1" fill="#d4bc86" opacity=".9"/>';
    s += '<path d="M57 114 Q60 110.5 63 114" stroke="#8a7348" stroke-width="1" fill="none" opacity=".55"/>';
    s += '<ellipse cx="58.5" cy="114.5" rx="1.2" ry="0.8" fill="#efe4c4" opacity=".5"/>';
    s += '</g>';
    return s;
  }

  /* sproutStage: 0 seed · 1–5 growing · 6 bloom · units = Roots answers
     idPrefix keeps gradient ids unique when multiple plants are on screen */
  window.FS.plantSVG = function (modulesDone, units, maxUnits, idPrefix) {
    var g = Math.max(0, Math.min(6, modulesDone | 0));
    var rf = Math.max(0, Math.min(units / maxUnits, 1));
    /* Let the stem climb a little more at full bloom */
    var climb = g >= 6 ? 5.4 : Math.min(g, 5);
    var stemTop = 118 - climb * 14.5;
    var p = idPrefix || "";
    var soil = p + "soilGrad";
    var stem = p + "stemGrad";
    var bloom = p + "bloomGrad";
    var root = p + "rootGrad";
    var leafA = p + "leafA";
    var leafB = p + "leafB";
    var s = '<svg viewBox="0 0 120 190" width="100%" height="100%" aria-hidden="true">';
    s += '<defs>';
    s += '<linearGradient id="' + soil + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6b5844"/><stop offset="100%" stop-color="#3d3226"/></linearGradient>';
    s += '<linearGradient id="' + stem + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#5f7a62"/><stop offset="100%" stop-color="#9eae8e"/></linearGradient>';
    s += '<linearGradient id="' + leafA + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c5d0b4"/><stop offset="100%" stop-color="#7f9474"/></linearGradient>';
    s += '<linearGradient id="' + leafB + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#d5deca"/><stop offset="100%" stop-color="#8fa484"/></linearGradient>';
    s += '<radialGradient id="' + bloom + '" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff4c8"/><stop offset="55%" stop-color="#f0d06a"/><stop offset="100%" stop-color="#c9922e"/></radialGradient>';
    s += '<linearGradient id="' + root + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#efe4c4"/><stop offset="100%" stop-color="#b9a47a"/></linearGradient>';
    s += '</defs>';

    /* underground bed */
    s += '<rect class="plant-soil-bed" x="6" y="118" width="108" height="66" rx="12" fill="url(#' + soil + ')" opacity=".92"/>';
    s += '<ellipse cx="60" cy="120" rx="50" ry="9" fill="#4a3d2e" opacity=".55"/>';

    /* roots — grow with Roots answers only */
    s += '<g class="plant-roots">';
    for (var j = 0; j < ROOTS.length; j++) {
      var q = ROOTS[j];
      var loc = rootProgress(rf, q.th);
      if (loc <= 0.02) continue;
      var visible = Math.max(4, Math.round(loc * 100));
      var gap = 100 - visible;
      s += '<path class="root-strand" pathLength="100" d="' + q.d +
        '" stroke="url(#' + root + ')" stroke-width="' + q.w +
        '" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="' +
        (0.45 + loc * 0.5).toFixed(2) +
        '" stroke-dasharray="' + visible + ' ' + gap + '" stroke-dashoffset="0"/>';
    }
    if (rf > 0.01) {
      s += '<path d="M56 122 Q60 126 64 122" stroke="#dccba0" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/>';
    }
    s += '</g>';

    /* soil surface */
    s += '<ellipse cx="60" cy="122" rx="46" ry="9" fill="#5a4a37"/>';
    s += '<ellipse cx="60" cy="119.5" rx="40" ry="6" fill="#6b5844"/>';
    s += '<ellipse cx="42" cy="120" rx="5" ry="2" fill="#4a3d2e" opacity=".35"/>';
    s += '<ellipse cx="78" cy="121" rx="4" ry="1.5" fill="#4a3d2e" opacity=".3"/>';

    /* Stage 0: seed rests on the dirt */
    if (g === 0) {
      s += seedOnDirt();
    }

    /* Above ground only after first non-Roots checklist progress */
    if (g >= 1) {
      s += '<g class="plant-sprout">';
      s += '<path d="M60 120 C58.8 ' + ((120 + stemTop) / 2) + ', 61.2 ' + ((120 + stemTop) / 2 + 3) + ', 60 ' + stemTop +
        '" stroke="url(#' + stem + ')" stroke-width="' + (3.4 + Math.min(g, 5) * 0.4) +
        '" fill="none" stroke-linecap="round"/>';

      if (g >= 1) {
        s += leafPath(60, 108, 14, -48, "url(#" + leafA + ")", 0.96);
        s += leafPath(60, 107, 13, 46, "url(#" + leafB + ")", 0.96);
      }
      if (g >= 2) {
        s += leafPath(60, 94, 16, -52, "url(#" + leafB + ")", 1);
        s += leafPath(60, 92, 15, 50, "url(#" + leafA + ")", 1);
        s += leafPath(60, 88, 11, 8, "url(#" + leafA + ")", 0.92);
      }
      if (g >= 3) {
        s += leafPath(60, 76, 15, -58, "url(#" + leafA + ")", 0.95);
        s += leafPath(60, 74, 15, 56, "url(#" + leafB + ")", 0.95);
        s += leafPath(60, 70, 12, -18, "url(#" + leafB + ")", 0.9);
        s += leafPath(60, 68, 12, 22, "url(#" + leafA + ")", 0.9);
      }
      if (g >= 4) {
        s += leafPath(60, 58, 13, -38, "url(#" + leafB + ")", 0.9);
        s += leafPath(60, 56, 13, 36, "url(#" + leafA + ")", 0.9);
        s += '<ellipse cx="60" cy="' + (stemTop + 3) + '" rx="5.5" ry="8.5" fill="#d9a93f" opacity=".7"/>';
        s += '<ellipse cx="60" cy="' + (stemTop + 1.5) + '" rx="3.2" ry="5.5" fill="#f5e08a" opacity=".85"/>';
      }
      if (g >= 5) {
        var degs = [0, 72, 144, 216, 288];
        for (var d = 0; d < degs.length; d++) {
          s += '<ellipse cx="60" cy="' + stemTop + '" rx="7" ry="13.5" fill="url(#' + bloom + ')" transform="rotate(' +
            degs[d] + ' 60 ' + stemTop + ')" opacity=".94"/>';
        }
        s += '<circle cx="60" cy="' + stemTop + '" r="5.8" fill="#5a4a37"/>';
        s += '<circle cx="60" cy="' + stemTop + '" r="3.2" fill="#e8c45a" opacity=".9"/>';
      }
      if (g >= 6) {
        var outer = [36, 108, 180, 252, 324];
        for (var o = 0; o < outer.length; o++) {
          s += '<ellipse cx="60" cy="' + stemTop + '" rx="6" ry="16" fill="#f8e28a" opacity=".62" transform="rotate(' +
            outer[o] + ' 60 ' + stemTop + ')"/>';
        }
        s += '<circle cx="60" cy="' + stemTop + '" r="4" fill="#fff4c8" opacity=".55"/>';
      }
      s += '</g>';
    }

    s += '</svg>';
    return s;
  };

  /* Grove dots: start as seeds, become mini trees once names land */
  window.FS.miniSeedSVG = function () {
    return '<svg viewBox="0 0 26 34" width="26" height="34" aria-hidden="true">' +
      '<ellipse cx="13" cy="28" rx="9" ry="3" fill="#c4b89a" opacity=".55"/>' +
      '<ellipse cx="13" cy="24" rx="4.5" ry="3.2" fill="#a89060"/>' +
      '<ellipse cx="13" cy="23" rx="3" ry="2" fill="#c9b07a" opacity=".85"/>' +
      '</svg>';
  };

  window.FS.miniTreeSVG = function (hue) {
    return '<svg viewBox="0 0 26 34" width="26" height="34" aria-hidden="true">' +
      '<path d="M13 33 L13 21" stroke="#5a4a37" stroke-width="2.2" stroke-linecap="round"/>' +
      '<ellipse cx="13" cy="12" rx="8.5" ry="9" fill="' + hue + '"/>' +
      '<ellipse cx="8" cy="17" rx="5" ry="5.5" fill="' + hue + '" opacity=".88"/>' +
      '<ellipse cx="18" cy="17" rx="5" ry="5.5" fill="' + hue + '" opacity=".88"/>' +
      '<ellipse cx="13" cy="9" rx="3" ry="2.5" fill="#a8c4a8" opacity=".35"/>' +
      '</svg>';
  };

  window.FS.miniSproutSVG = function (hue) {
    return '<svg viewBox="0 0 26 34" width="26" height="34" aria-hidden="true">' +
      '<ellipse cx="13" cy="30" rx="8" ry="2.5" fill="#c4b89a" opacity=".5"/>' +
      '<path d="M13 28 L13 16" stroke="#5f8a5f" stroke-width="2" stroke-linecap="round"/>' +
      '<ellipse cx="9" cy="15" rx="5" ry="3" fill="' + hue + '" transform="rotate(-35 9 15)"/>' +
      '<ellipse cx="17" cy="14" rx="5" ry="3" fill="' + (hue || "#7ba07b") + '" transform="rotate(35 17 14)" opacity=".9"/>' +
      '</svg>';
  };
})();
