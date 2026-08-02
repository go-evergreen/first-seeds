/* ═══════════════════════════════════════════════════════════
   FIRST SEEDS — FAMILY TREE
   Build your ideal team as a living tree: branches within
   branches, each person marked hopeful 🌱 or committed 🌳.
   Data shape: { name, status: "hopeful"|"committed", children: [] }
   The tree lives in state.data.tree (an array = your front line).
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

  /* Resolve an index path like "0.2.1" to {parentArr, index, node} */
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
    html += '<span class="tnode-leaf">' + (isCommitted ? "🌳" : "🌱") + '</span>';
    html += '<input class="tnode-name" type="text" value="' + esc(node.name) + '" placeholder="name…" data-tname="' + path + '" maxlength="40">';
    html += '<button class="tnode-status" data-tstatus="' + path + '" title="Tap to switch status">' + (isCommitted ? "committed" : "hopeful") + '</button>';
    html += '<button class="tnode-add" data-tadd="' + path + '" title="Add a branch under ' + esc(node.name || "them") + '">＋ branch</button>';
    html += '<button class="tnode-del" data-tdel="' + path + '" title="Remove">×</button>';
    html += '</div>';
    if (node.children.length) {
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
        stats.innerHTML =
          '<span class="tstat"><strong>' + c.total + '</strong> in your tree</span>' +
          '<span class="tstat hopeful-c">🌱 <strong>' + c.hopeful + '</strong> hopeful</span>' +
          '<span class="tstat committed-c">🌳 <strong>' + c.committed + '</strong> committed</span>' +
          (c.depth > 1 ? '<span class="tstat">' + c.depth + ' levels deep</span>' : '');
      }

      var html = '<div class="tnode-row root-row"><span class="tnode-leaf">🌿</span><span class="tnode-root">You</span>';
      html += '<button class="tnode-add root-add" data-tadd="root">＋ add to your front line</button></div>';
      if (tree.length) {
        html += '<div class="tnode-kids root-kids">';
        for (var i = 0; i < tree.length; i++) html += renderNode(tree[i], String(i), 1);
        html += '</div>';
      } else {
        html += '<div class="tree-empty">Your tree starts with one name. Who do you dream of building this with?</div>';
      }
      wrap.innerHTML = html;
    },

    /* Event handlers — return true if state changed */
    add: function (state, path) {
      var tree = this.ensure(state);
      if (path === "root") {
        tree.push(newPerson());
        return true;
      }
      var r = resolve(tree, path);
      if (!r) return false;
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
      if (kids > 0 && !confirm("Remove " + (r.node.name || "this person") + " and the " + kids + " branch" + (kids === 1 ? "" : "es") + " under them?")) {
        return false;
      }
      r.parentArr.splice(r.index, 1);
      return true;
    },

    /* Flatten for the text export */
    exportLines: function (state) {
      var tree = this.ensure(state);
      var lines = [];
      (function walk(arr, indent) {
        for (var i = 0; i < arr.length; i++) {
          var n = arr[i];
          lines.push(indent + (n.status === "committed" ? "🌳 " : "🌱 ") + (n.name || "(unnamed)") + "  [" + n.status + "]");
          walk(n.children, indent + "    ");
        }
      })(tree, "");
      return lines.length ? lines : ["—"];
    }
  };
})();
