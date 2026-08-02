/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — FAMILY TREE
   Clean front-line builder. Add people. Nest branches. Toggle status.
   ═══════════════════════════════════════════════════════════ */

window.FS = window.FS || {};

(function () {
  "use strict";

  function esc(t) {
    return (t + "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function newPerson() {
    return { name: "", status: "hopeful", children: [] };
  }

  function resolve(tree, path) {
    var parts = path.split(".").map(Number);
    var arr = tree, node = null, idx = -1;
    for (var i = 0; i < parts.length; i++) {
      idx = parts[i];
      node = arr[idx];
      if (!node) return null;
      if (i < parts.length - 1) arr = node.children;
    }
    return { parentArr: arr, index: idx, node: node };
  }

  function countAll(tree) {
    var total = 0, hopeful = 0, committed = 0, depth = 1;
    (function walk(arr, d) {
      for (var i = 0; i < arr.length; i++) {
        if (d > depth) depth = d;
        total++;
        if (arr[i].status === "committed") committed++; else hopeful++;
        walk(arr[i].children, d + 1);
      }
    })(tree, 1);
    return { total: total, hopeful: hopeful, committed: committed, depth: tree.length ? depth : 0 };
  }

  function renderNode(node, path, depth) {
    var isCommitted = node.status === "committed";
    var html = '<div class="tnode" data-depth="' + depth + '">';
    html += '<div class="tnode-row' + (isCommitted ? " committed" : " hopeful") + '">';
    html += '<button type="button" class="tnode-status" data-tstatus="' + path + '" title="Tap to flip hopeful / committed" aria-label="Status">' +
      (isCommitted ? "🌳" : "🌱") + '</button>';
    html += '<input class="tnode-name" type="text" value="' + esc(node.name) + '" placeholder="Name" data-tname="' + path + '" maxlength="40" aria-label="Name">';
    html += '<button type="button" class="tnode-add" data-tadd="' + path + '" title="Add someone under them">＋</button>';
    html += '<button type="button" class="tnode-del" data-tdel="' + path + '" title="Remove" aria-label="Remove">×</button>';
    html += '</div>';
    if (node.children && node.children.length) {
      html += '<div class="tnode-kids">';
      for (var i = 0; i < node.children.length; i++) {
        html += renderNode(node.children[i], path + "." + i, depth + 1);
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  window.FS.tree = {
    ensure: function (state) {
      if (!Array.isArray(state.data.tree)) state.data.tree = [];
      return state.data.tree;
    },

    counts: countAll,

    render: function (state) {
      var tree = this.ensure(state);
      var wrap = document.getElementById("familyTree");
      var stats = document.getElementById("treeStats");
      if (!wrap) return;

      var c = countAll(tree);
      if (stats) {
        stats.innerHTML = c.total
          ? ('<strong>' + c.total + '</strong> · 🌱 ' + c.hopeful + ' · 🌳 ' + c.committed)
          : "";
      }

      var html = "";
      if (!tree.length) {
        html += '<div class="tree-empty-state">';
        html += '<button type="button" class="tree-primary-add" data-tadd="root">＋ Add someone</button>';
        html += '</div>';
      } else {
        html += '<div class="tree-you">You</div>';
        html += '<div class="tnode-kids root-kids">';
        for (var i = 0; i < tree.length; i++) html += renderNode(tree[i], String(i), 1);
        html += '</div>';
        html += '<button type="button" class="tree-primary-add ghost" data-tadd="root">＋ Add to front line</button>';
      }
      wrap.innerHTML = html;
    },

    add: function (state, path) {
      var tree = this.ensure(state);
      if (path === "root") {
        tree.push(newPerson());
        return true;
      }
      var r = resolve(tree, path);
      if (!r) return false;
      if (!r.node.children) r.node.children = [];
      r.node.children.push(newPerson());
      return true;
    },

    toggleStatus: function (state, path) {
      var r = resolve(this.ensure(state), path);
      if (!r) return false;
      r.node.status = r.node.status === "committed" ? "hopeful" : "committed";
      return true;
    },

    setName: function (state, path, name) {
      var r = resolve(this.ensure(state), path);
      if (!r) return false;
      r.node.name = name;
      return true;
    },

    remove: function (state, path) {
      var r = resolve(this.ensure(state), path);
      if (!r) return false;
      var kids = r.node.children.length;
      if (kids > 0 && !confirm("Remove " + (r.node.name || "this person") + " and " + kids + " under them?")) {
        return false;
      }
      r.parentArr.splice(r.index, 1);
      return true;
    },

    exportLines: function (state) {
      var tree = this.ensure(state);
      var lines = [];
      (function walk(arr, indent) {
        for (var i = 0; i < arr.length; i++) {
          var n = arr[i];
          lines.push(indent + (n.status === "committed" ? "🌳 " : "🌱 ") + (n.name || "(unnamed)"));
          walk(n.children || [], indent + "    ");
        }
      })(tree, "");
      return lines.length ? lines : ["—"];
    },

    mergeLiveTeam: function (state, roots) {
      var tree = this.ensure(state);
      var added = 0;
      var updated = 0;
      roots = roots || [];

      function findByName(arr, name) {
        var n = (name || "").trim().toLowerCase();
        if (!n) return null;
        for (var i = 0; i < arr.length; i++) {
          if ((arr[i].name || "").trim().toLowerCase() === n) return arr[i];
        }
        return null;
      }

      function ensureNode(arr, person) {
        var name = (person.display_name || person.email || "").trim();
        if (!name) return null;
        var existing = findByName(arr, name);
        if (existing) {
          if (existing.status !== "committed") {
            existing.status = "committed";
            updated++;
          }
          if (!existing.liveId) existing.liveId = person.id;
          return existing;
        }
        arr.push({ name: name, status: "committed", children: [], liveId: person.id });
        added++;
        return arr[arr.length - 1];
      }

      roots.forEach(function (front) {
        (function walk(person, arr) {
          var node = ensureNode(arr, person);
          if (!node) return;
          if (!node.children) node.children = [];
          (person.children || []).forEach(function (kid) {
            walk(kid, node.children);
          });
        })(front, tree);
      });

      return { added: added, updated: updated };
    }
  };
})();
