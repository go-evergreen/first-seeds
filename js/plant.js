/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — PLANT
   The living plant in the sidebar. Roots grow per answer,
   the plant above ground grows per completed section.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

(function () {
  "use strict";

  /* 6 sections map to 5 visual stages; full bloom only when all done */
  var STAGE_MAP = [0, 1, 2, 3, 3, 4, 5];

  var ROOTS = [
    { x1: 60, c1x: 52, c1y: 132, c2x: 44, c2y: 146, x2: 34,  y2: 170, th: 0.05 },
    { x1: 60, c1x: 68, c1y: 132, c2x: 78, c2y: 146, x2: 88,  y2: 168, th: 0.18 },
    { x1: 60, c1x: 58, c1y: 136, c2x: 56, c2y: 154, x2: 57,  y2: 176, th: 0.34 },
    { x1: 60, c1x: 48, c1y: 130, c2x: 32, c2y: 138, x2: 20,  y2: 152, th: 0.52 },
    { x1: 60, c1x: 72, c1y: 130, c2x: 90, c2y: 138, x2: 102, y2: 150, th: 0.70 }
  ];

  /* sectionsDone: 0..6 · units / maxUnits drive root growth */
  window.FS.plantSVG = function (sectionsDone, units, maxUnits) {
    var g = STAGE_MAP[Math.max(0, Math.min(6, sectionsDone))];
    var rf = Math.max(0, Math.min(units / maxUnits, 1));
    var topY = 148 - g * 17;
    var s = '<svg viewBox="0 0 120 190" width="100%" height="100%" aria-hidden="true">';

    /* underground zone */
    s += '<rect x="8" y="120" width="104" height="62" rx="10" fill="#3d3226" opacity=".55"/>';
    s += '<rect x="8" y="120" width="104" height="8" fill="#4a3d2e" opacity=".7"/>';

    /* roots — staggered strands, each grows as rf passes its threshold */
    for (var j = 0; j < ROOTS.length; j++) {
      var q = ROOTS[j];
      var loc = Math.max(0, Math.min(1, (rf - q.th) / (1 - q.th + 0.0001)));
      if (loc <= 0) continue;
      var qx = q.x1 + (q.x2 - q.x1) * loc;
      var qy = 122 + (q.y2 - 122) * loc;
      var qc1y = 122 + (q.c1y - 122) * loc;
      var qc2y = 122 + (q.c2y - 122) * loc;
      s += '<path d="M' + q.x1 + ' 122 C' + q.c1x + ' ' + qc1y.toFixed(1) + ', ' + q.c2x + ' ' + qc2y.toFixed(1) + ', ' + qx.toFixed(1) + ' ' + qy.toFixed(1) + '" stroke="#cdb98f" stroke-width="' + (2.6 - j * 0.28) + '" fill="none" stroke-linecap="round" opacity=".9"/>';
      if (loc > 0.6) {
        s += '<path d="M' + qx.toFixed(1) + ' ' + qy.toFixed(1) + ' l-4 4 M' + qx.toFixed(1) + ' ' + qy.toFixed(1) + ' l4 3" stroke="#cdb98f" stroke-width="1" opacity=".6" stroke-linecap="round"/>';
      }
    }

    /* soil */
    s += '<ellipse cx="60" cy="122" rx="48" ry="10" fill="#5a4a37"/>';
    s += '<ellipse cx="60" cy="119" rx="42" ry="7" fill="#6b5844"/>';

    /* seed peeking through before the first section completes */
    if (g === 0 && rf > 0) {
      s += '<ellipse cx="60" cy="118" rx="5" ry="6.5" fill="#cdb98f"/><path d="M60 112 q3 -4 0 -7" stroke="#7ba07b" stroke-width="2" fill="none" stroke-linecap="round"/>';
    }

    /* stem & leaves */
    if (g >= 1) s += '<path d="M60 120 L60 ' + topY + '" stroke="#6b8f6b" stroke-width="4" fill="none" stroke-linecap="round"/>';
    if (g >= 2) {
      s += '<path d="M60 100 C40 98, 30 84, 34 76 C50 80, 60 90, 60 100 Z" fill="#6b8f6b"/>';
      s += '<path d="M60 96 C80 94, 90 80, 86 72 C70 76, 60 86, 60 96 Z" fill="#7ba07b"/>';
    }
    if (g >= 3) {
      s += '<path d="M60 78 C46 76, 38 66, 42 58 C54 62, 60 70, 60 78 Z" fill="#7ba07b"/>';
      s += '<path d="M60 74 C74 72, 82 62, 78 54 C66 58, 60 66, 60 74 Z" fill="#6b8f6b"/>';
    }
    if (g === 4) s += '<ellipse cx="60" cy="' + (topY + 2) + '" rx="8" ry="12" fill="#c9a24b" opacity=".55"/>';
    if (g >= 5) {
      var degs = [0, 72, 144, 216, 288];
      for (var d = 0; d < degs.length; d++) {
        s += '<ellipse cx="60" cy="' + topY + '" rx="7" ry="13" fill="#e8c86a" transform="rotate(' + degs[d] + ' 60 ' + topY + ')"/>';
      }
      s += '<circle cx="60" cy="' + topY + '" r="6" fill="#5a4a37"/>';
    }
    s += '</svg>';
    return s;
  };

  /* mini tree for the grove visual */
  window.FS.miniTreeSVG = function (hue) {
    return '<svg viewBox="0 0 26 34" width="26" height="34"><path d="M13 33 L13 22" stroke="#5a4a37" stroke-width="2.5" stroke-linecap="round"/><circle cx="13" cy="14" r="9" fill="' + hue + '"/><circle cx="8" cy="18" r="5.5" fill="' + hue + '" opacity=".85"/><circle cx="18" cy="18" r="5.5" fill="' + hue + '" opacity=".85"/></svg>';
  };
})();
