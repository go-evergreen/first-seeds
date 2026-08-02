/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — PLANT
   Roots grow per answer. Sprout grows per completed section.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

(function () {
  "use strict";

  /* 6 sections map to visual stages; full bloom only when all done */
  var STAGE_MAP = [0, 1, 2, 3, 4, 5, 6];

  /* Root strands — each unlocks as answer-progress (rf) rises */
  var ROOTS = [
    { x1: 60, c1x: 50, c1y: 138, c2x: 38, c2y: 152, x2: 28,  y2: 172, th: 0.02, w: 3.2 },
    { x1: 60, c1x: 70, c1y: 136, c2x: 82, c2y: 150, x2: 94,  y2: 168, th: 0.12, w: 2.8 },
    { x1: 60, c1x: 56, c1y: 140, c2x: 52, c2y: 158, x2: 50,  y2: 178, th: 0.24, w: 3.4 },
    { x1: 60, c1x: 44, c1y: 134, c2x: 26, c2y: 142, x2: 14,  y2: 156, th: 0.40, w: 2.4 },
    { x1: 60, c1x: 76, c1y: 134, c2x: 96, c2y: 142, x2: 108, y2: 154, th: 0.55, w: 2.4 },
    { x1: 60, c1x: 48, c1y: 142, c2x: 36, c2y: 160, x2: 32,  y2: 180, th: 0.70, w: 2.0 },
    { x1: 60, c1x: 72, c1y: 142, c2x: 88, c2y: 162, x2: 96,  y2: 178, th: 0.82, w: 2.0 }
  ];

  function leaf(cx, cy, rx, ry, rot, fill, opacity) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
      '" fill="' + fill + '" opacity="' + (opacity || 1) +
      '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"/>';
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
    s += '</defs>';

    /* underground bed */
    s += '<rect class="plant-soil-bed" x="6" y="118" width="108" height="66" rx="12" fill="url(#soilGrad)" opacity=".9"/>';
    s += '<ellipse cx="60" cy="120" rx="50" ry="9" fill="#4a3d2e" opacity=".55"/>';

    /* roots — grow as answers fill in */
    s += '<g class="plant-roots">';
    for (var j = 0; j < ROOTS.length; j++) {
      var q = ROOTS[j];
      var loc = Math.max(0, Math.min(1, (rf - q.th) / 0.22));
      if (loc <= 0) continue;
      var qx = q.x1 + (q.x2 - q.x1) * loc;
      var qy = 122 + (q.y2 - 122) * loc;
      var qc1y = 122 + (q.c1y - 122) * loc;
      var qc2y = 122 + (q.c2y - 122) * loc;
      s += '<path class="root-strand" d="M' + q.x1 + ' 122 C' + q.c1x + ' ' + qc1y.toFixed(1) + ', ' +
        q.c2x + ' ' + qc2y.toFixed(1) + ', ' + qx.toFixed(1) + ' ' + qy.toFixed(1) +
        '" stroke="#d4c09a" stroke-width="' + q.w + '" fill="none" stroke-linecap="round" opacity="' +
        (0.55 + loc * 0.4).toFixed(2) + '"/>';
      if (loc > 0.55) {
        s += '<circle cx="' + qx.toFixed(1) + '" cy="' + qy.toFixed(1) + '" r="1.6" fill="#e8d5a8" opacity=".75"/>';
        s += '<path d="M' + qx.toFixed(1) + ' ' + qy.toFixed(1) + ' l-3.5 3.5 M' + qx.toFixed(1) + ' ' +
          qy.toFixed(1) + ' l3.5 2.8" stroke="#cbb892" stroke-width="1.1" opacity=".7" stroke-linecap="round"/>';
      }
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
