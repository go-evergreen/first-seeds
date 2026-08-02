/* First Seeds — public personal lead page */
(function () {
  "use strict";

  var Cloud = window.FS.Cloud;
  var params = new URLSearchParams(window.location.search);
  var slug = (params.get("p") || params.get("with") || "").trim().toLowerCase();
  var fromApp = params.get("from") === "app";
  var back = document.getElementById("leadBack");
  if (back) back.hidden = !fromApp;

  var loading = document.getElementById("leadLoading");
  var missing = document.getElementById("leadMissing");
  var page = document.getElementById("leadPage");
  var thanks = document.getElementById("leadThanks");
  var form = document.getElementById("leadForm");
  var msg = document.getElementById("leadFormMsg");
  var interestInput = document.getElementById("leadInterest");
  var partnerName = "";

  function show(el) {
    [loading, missing, page, thanks].forEach(function (n) {
      if (n) n.hidden = n !== el;
    });
  }

  function firstName(full) {
    return (full || "").trim().split(/\s+/)[0] || "your friend";
  }

  function setInterest(value) {
    interestInput.value = value || "";
    var chips = document.querySelectorAll(".lead-chip");
    for (var i = 0; i < chips.length; i++) {
      var on = chips[i].getAttribute("data-interest") === value;
      chips[i].classList.toggle("on", on);
      chips[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  var interestRow = document.querySelector(".lead-interest-row");
  if (interestRow) {
    interestRow.addEventListener("click", function (e) {
      var t = e.target.closest("[data-interest]");
      if (!t) return;
      setInterest(t.getAttribute("data-interest"));
      if (msg) msg.textContent = "";
    });
  }

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (msg) msg.textContent = "";
      var btn = document.getElementById("leadSubmit");
      var payload = {
        name: (document.getElementById("leadName").value || "").trim(),
        email: (document.getElementById("leadEmail").value || "").trim(),
        phone: (document.getElementById("leadPhone").value || "").trim(),
        interest: (interestInput.value || "").trim()
      };
      try {
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Sending…";
        }
        await Cloud.submitLead(slug, payload);
        var thanksBody = document.getElementById("leadThanksBody");
        if (thanksBody) {
          thanksBody.textContent = partnerName
            ? ("Thanks — " + firstName(partnerName) + " will be in touch soon.")
            : "Thanks — they’ll be in touch soon.";
        }
        show(thanks);
      } catch (err) {
        if (msg) msg.textContent = (err && err.message) || "Something went wrong. Try again.";
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Get first access →";
        }
      }
    });
  }

  async function boot() {
    if (!slug) {
      show(missing);
      return;
    }
    try {
      await Cloud.init();
      var info = await Cloud.getLeadPage(slug);
      if (!info) {
        show(missing);
        return;
      }
      partnerName = info.display_name || "your friend";
      var first = firstName(partnerName);
      document.title = partnerName + " — Ringana · first access";
      document.getElementById("leadPartnerName").textContent = partnerName;
      var brand = document.getElementById("leadBrandName");
      if (brand) brand.textContent = first;
      var blurbEl = document.getElementById("leadBlurb");
      var blurb = (info.blurb || "").trim();
      if (blurbEl) {
        blurbEl.textContent = blurb ||
          ("I’m gathering a small founding circle before launch — leave your info and I’ll follow up personally.");
      }
      show(page);
    } catch (err) {
      show(missing);
    }
  }

  boot();
})();
