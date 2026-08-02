/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — PLANT
   Roots grow per answer. Sprout grows per completed section.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

(function () {
  "use strict";

  /* 6 sections map to visual stages; full bloom only when all done */
  var STAGE_MAP = [0, 1, 2, 3, 4, 5, 6];

  /* Final organic root paths — all start under the seed at (60, 122).
     Growth uses pathLength + dash so curves stay attached (no floating sticks). */
  var ROOTS = [
    { d: "M60 122 C54 132, 42 142, 34 156 C28 166, 24 174, 22 182", th: 0.02, w: 2.8 },
    { d: "M60 122 C66 132, 78 142, 86 156 C92 166, 96 174, 98 182", th: 0.10, w: 2.8 },
    { d: "M60 122 C58 134, 56 148, 54 164 C52 174, 52 180, 53 186", th: 0.20, w: 3.0 },
    { d: "M60 122 C48 128, 34 134, 24 144 C16 152, 12 160, 10 168", th: 0.34, w: 2.2 },
    { d: "M60 122 C72 128, 86 134, 96 144 C104 152, 108 160, 110 168", th: 0.46, w: 2.2 },
    { d: "M60 122 C52 136, 44 150, 40 166 C37 176, 36 182, 38 188", th: 0.62, w: 1.9 },
    { d: "M60 122 C68 136, 76 150, 80 166 C83 176, 84 182, 82 188", th: 0.74, w: 1.9 },
    /* soft side whiskers — unlock late */
    { d: "M60 122 C50 130, 40 138, 30 140 C22 142, 18 146, 16 152", th: 0.86, w: 1.5 },
    { d: "M60 122 C70 130, 80 138, 90 140 C98 142, 102 146, 104 152", th: 0.92, w: 1.5 }
  ];

  function leaf(cx, cy, rx, ry, rot, fill, opacity) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
      '" fill="' + fill + '" opacity="' + (opacity || 1) +
      '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"/>';
  }

  function rootProgress(rf, th) {
    /* Each strand fades in over ~18% of total root fill after its threshold */
    return Math.max(0, Math.min(1, (rf - th) / 0.18));
  }

  /* sectionsDone: 0..6 · units / maxUnits drive root growth */
  window.FS.plantSVG = function (sectionsDone, units, maxUnits) {
    var g = STAGE_MAP[Math.max(0, Math.min(6, sectionsDone))];
    var rf = Math.max(0, Math.min(units / maxUnits, 1));
    var stemTop = 118 - Math.min(g, 5) * 14;
    var s = '<svg viewBox="0 0 120 190" width="100%" height="100%" aria-hidden="true">';
    s += '<defs>';
    s += '<linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6b5844"/><stop offset="100%" stop-color="#3d3226"/></linearGradient>';
    s += '<linearGradient id="stemGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#4a6a56"/><stop offset="100%" stop-color="#7ba07b"/></linearGradient>';
    s += '<radialGradient id="bloomGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f5e6a8"/><stop offset="70%" stop-color="#e8c86a"/><stop offset="100%" stop-color="#c9a24b"/></radialGradient>';
    s += '<linearGradient id="rootGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8d9b0"/><stop offset="100%" stop-color="#b9a47a"/></linearGradient>';
    s += '</defs>';

    /* underground bed */
    s += '<rect class="plant-soil-bed" x="6" y="118" width="108" height="66" rx="12" fill="url(#soilGrad)" opacity=".9"/>';
    s += '<ellipse cx="60" cy="120" rx="50" ry="9" fill="#4a3d2e" opacity=".55"/>';

    /* roots — same curve always; dash reveals length from the seed down */
    s += '<g class="plant-roots">';
    for (var j = 0; j < ROOTS.length; j++) {
      var q = ROOTS[j];
      var loc = rootProgress(rf, q.th);
      if (loc <= 0.02) continue;
      var visible = Math.max(4, Math.round(loc * 100));
      var gap = 100 - visible;
      s += '<path class="root-strand" pathLength="100" d="' + q.d +
        '" stroke="url(#rootGrad)" stroke-width="' + q.w +
        '" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="' +
        (0.45 + loc * 0.5).toFixed(2) +
        '" stroke-dasharray="' + visible + ' ' + gap + '" stroke-dashoffset="0"/>';
    }
    /* tiny crown under the seed so roots feel connected even at low fill */
    if (rf > 0.01) {
      s += '<path d="M56 122 Q60 126 64 122" stroke="#dccba0" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/>';
    }
    s += '</g>';

    /* soil surface */
    s += '<ellipse cx="60" cy="122" rx="46" ry="9" fill="#5a4a37"/>';
    s += '<ellipse cx="60" cy="119.5" rx="40" ry="6" fill="#6b5844"/>';
    s += '<ellipse cx="42" cy="120" rx="5" ry="2" fill="#4a3d2e" opacity=".35"/>';
    s += '<ellipse cx="78" cy="121" rx="4" ry="1.5" fill="#4a3d2e" opacity=".3"/>';

    /* seed / early sprout before real stem */
    if (g === 0) {
      if (rf > 0) {
        s += '<g class="plant-sprout plant-seed">';
        s += '<ellipse cx="60" cy="116" rx="5.5" ry="7" fill="#c9b07a"/>';
        s += '<ellipse cx="60" cy="114" rx="3.5" ry="4" fill="#ddc892" opacity=".7"/>';
        s += '<path d="M60 109 C62 104, 61 100, 60 97 C59 100, 58 104, 60 109Z" fill="#7ba07b"/>';
        s += '<path d="M60 104 C55 102, 52 97, 53 93 C56 95, 59 99, 60 104Z" fill="#6b8f6b"/>';
        s += '<path d="M60 104 C65 102, 68 97, 67 93 C64 95, 61 99, 60 104Z" fill="#8fb48f"/>';
        s += '</g>';
      } else {
        s += '<ellipse cx="60" cy="118" rx="4" ry="3" fill="#a89060" opacity=".5"/>';
      }
    }

    /* above-ground plant — grows with completed sections */
    if (g >= 1) {
      s += '<g class="plant-sprout">';
      /* stem */
      s += '<path d="M60 120 C59 ' + ((120 + stemTop) / 2) + ', 61 ' + ((120 + stemTop) / 2 + 4) + ', 60 ' + stemTop +
        '" stroke="url(#stemGrad)" stroke-width="' + (3.2 + Math.min(g, 4) * 0.35) +
        '" fill="none" stroke-linecap="round"/>';

      /* tender first leaves */
      if (g >= 1) {
        s += leaf(52, 108, 9, 4.5, -35, "#6b8f6b", 0.95);
        s += leaf(68, 106, 9, 4.5, 35, "#7ba07b", 0.95);
        s += '<path d="M60 112 C54 110, 50 106, 48 102" stroke="#5f8a5f" stroke-width="1" fill="none" opacity=".4"/>';
        s += '<path d="M60 110 C66 108, 70 104, 72 100" stroke="#5f8a5f" stroke-width="1" fill="none" opacity=".4"/>';
      }

      /* fuller canopy */
      if (g >= 2) {
        s += leaf(46, 92, 11, 5.5, -40, "#5f8a5f", 1);
        s += leaf(74, 90, 11, 5.5, 40, "#7ba07b", 1);
        s += leaf(60, 86, 7, 10, 0, "#6b8f6b", 0.95);
      }
      if (g >= 3) {
        s += leaf(42, 74, 10, 5, -48, "#7ba07b", 0.95);
        s += leaf(78, 72, 10, 5, 48, "#6b8f6b", 0.95);
        s += leaf(54, 68, 8, 5, -20, "#8fb48f", 0.9);
        s += leaf(66, 66, 8, 5, 20, "#6b8f6b", 0.9);
      }
      if (g >= 4) {
        s += leaf(48, 56, 9, 4.5, -30, "#7ba07b", 0.9);
        s += leaf(72, 54, 9, 4.5, 30, "#8fb48f", 0.9);
        /* bud */
        s += '<ellipse cx="60" cy="' + (stemTop + 2) + '" rx="6" ry="9" fill="#c9a24b" opacity=".65"/>';
        s += '<ellipse cx="60" cy="' + (stemTop + 1) + '" rx="3.5" ry="6" fill="#e8c86a" opacity=".8"/>';
      }
      if (g >= 5) {
        /* opening bloom */
        var degs = [0, 72, 144, 216, 288];
        for (var d = 0; d < degs.length; d++) {
          s += '<ellipse cx="60" cy="' + stemTop + '" rx="6.5" ry="12" fill="url(#bloomGrad)" transform="rotate(' +
            degs[d] + ' 60 ' + stemTop + ')" opacity=".92"/>';
        }
        s += '<circle cx="60" cy="' + stemTop + '" r="5.5" fill="#5a4a37"/>';
        s += '<circle cx="60" cy="' + stemTop + '" r="3" fill="#c9a24b" opacity=".85"/>';
      }
      if (g >= 6) {
        /* full bloom — extra outer petals */
        var outer = [36, 108, 180, 252, 324];
        for (var o = 0; o < outer.length; o++) {
          s += '<ellipse cx="60" cy="' + stemTop + '" rx="5" ry="14" fill="#f0d878" opacity=".55" transform="rotate(' +
            outer[o] + ' 60 ' + stemTop + ')"/>';
        }
      }
      s += '</g>';
    }

    s += '</svg>';
    return s;
  };

  /* mini tree for the grove visual */
  window.FS.miniTreeSVG = function (hue) {
    return '<svg viewBox="0 0 26 34" width="26" height="34">' +
      '<path d="M13 33 L13 21" stroke="#5a4a37" stroke-width="2.2" stroke-linecap="round"/>' +
      '<ellipse cx="13" cy="12" rx="8.5" ry="9" fill="' + hue + '"/>' +
      '<ellipse cx="8" cy="17" rx="5" ry="5.5" fill="' + hue + '" opacity=".88"/>' +
      '<ellipse cx="18" cy="17" rx="5" ry="5.5" fill="' + hue + '" opacity=".88"/>' +
      '<ellipse cx="13" cy="9" rx="3" ry="2.5" fill="#a8c4a8" opacity=".35"/>' +
      '</svg>';
  };
})();
