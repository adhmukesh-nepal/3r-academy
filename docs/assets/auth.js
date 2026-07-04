/* =========================================================================
   auth.js — Phase A accounts + cross-device sync (Supabase, email magic-link).
   Adds optional sign-in. When signed in:
     • book unlock codes sync to the account (unlock once, open on any device)
     • study progress syncs across devices
   Logged-out behaviour is unchanged (everything works locally, offline).
   Loads AFTER supabase.js + config.js and BEFORE app.js/gate.js can use window.TR.
   ========================================================================= */
(function () {
  var cfg = window.TR_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL) { window.TR = { session: null }; return; }

  var client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
  });

  var TR = window.TR = { client: client, session: null, user: null };

  /* ---- local storage helpers (shared shape with app.js / gate.js) ---- */
  function getCodes() { try { return JSON.parse(localStorage.getItem("3r_keys") || "{}"); } catch (e) { return {}; } }
  function setCodes(o) { localStorage.setItem("3r_keys", JSON.stringify(o)); }
  function localProgressKeys() { return Object.keys(localStorage).filter(function (k) { return k.indexOf("progress:") === 0; }); }
  function parseKey(k) { var p = k.split(":"); return { book: p[1], ch: parseInt(p[2], 10) }; }

  /* ---- sync API used by app.js (progress) and gate.js (entitlements) ---- */
  TR.pushProgress = function (book, ch, data) {
    if (!TR.user) return;
    client.from("progress").upsert(
      { user_id: TR.user.id, book_id: book, chapter: ch, data: data, updated_at: new Date().toISOString() },
      { onConflict: "user_id,book_id,chapter" }
    ).then(function () {}, function () {}); // fire-and-forget
  };
  TR.saveEntitlement = function (book, code) {
    if (!TR.user) return Promise.resolve();
    return client.from("entitlements").upsert(
      { user_id: TR.user.id, book_id: book, code: code },
      { onConflict: "user_id,book_id" }
    ).then(function () {}, function () {});
  };

  /* ---- pull the account's data down, merge with local, seed anything local-only up ---- */
  function pullAccountData() {
    if (!TR.user) return Promise.resolve();
    return Promise.all([
      client.from("entitlements").select("book_id,code"),
      client.from("progress").select("book_id,chapter,data")
    ]).then(function (res) {
      var ent = (res[0].data) || [], prog = (res[1].data) || [];

      // entitlements: server -> local, and push any local-only codes up
      var codes = getCodes(), serverBooks = {};
      ent.forEach(function (e) { serverBooks[e.book_id] = true; if (e.code) codes[e.book_id] = e.code; });
      setCodes(codes);
      Object.keys(codes).forEach(function (bid) { if (!serverBooks[bid]) TR.saveEntitlement(bid, codes[bid]); });

      // progress: server wins per chapter; push local-only chapters up
      var serverSeen = {};
      prog.forEach(function (r) {
        var key = "progress:" + r.book_id + ":" + r.chapter;
        serverSeen[key] = true;
        try { localStorage.setItem(key, JSON.stringify(r.data)); } catch (e) {}
      });
      localProgressKeys().forEach(function (k) {
        if (!serverSeen[k]) { var m = parseKey(k); try { TR.pushProgress(m.book, m.ch, JSON.parse(localStorage.getItem(k))); } catch (e) {} }
      });
    }).catch(function () {});
  }

  /* ---- UI: account control injected into the top bar + a sign-in modal ---- */
  function renderAcct() {
    var wrap = document.querySelector(".topbar .wrap");
    if (!wrap) return;
    var el = document.getElementById("tr-acct");
    if (!el) { el = document.createElement("div"); el.id = "tr-acct"; el.className = "tr-acct"; wrap.appendChild(el); }
    if (TR.user) {
      var email = TR.user.email || "Account";
      el.innerHTML = '<span class="tr-email" title="' + email + '">' + email + '</span> <button id="tr-out">Sign out</button>';
      document.getElementById("tr-out").onclick = function () { client.auth.signOut(); };
    } else {
      el.innerHTML = '<button id="tr-in">Sign in</button>';
      document.getElementById("tr-in").onclick = openModal;
    }
  }
  function openModal() {
    if (document.getElementById("tr-modal")) return;
    var ov = document.createElement("div");
    ov.id = "tr-modal"; ov.className = "tr-modal";
    ov.innerHTML =
      '<div class="tr-box"><button class="tr-x" id="tr-x">×</button>' +
      '<h3>Sign in to 3R Academy</h3>' +
      '<p id="tr-lead">Save your progress and unlock your books on any device. We\'ll email you a login code — no password.</p>' +
      '<div id="tr-step1">' +
        '<input id="tr-email" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email">' +
        '<button id="tr-send" class="tr-primary">Email me a code</button>' +
      '</div>' +
      '<div id="tr-step2" style="display:none">' +
        '<input id="tr-otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Enter your code">' +
        '<button id="tr-verify" class="tr-primary">Verify &amp; sign in</button>' +
        '<button id="tr-back" class="tr-link">Use a different email</button>' +
      '</div>' +
      '<div id="tr-msg" class="tr-msg"></div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); };
    document.getElementById("tr-x").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });

    var msg = document.getElementById("tr-msg");
    var emailInput = document.getElementById("tr-email");
    var currentEmail = "";
    function show(step) {
      document.getElementById("tr-step1").style.display = (step === 1) ? "" : "none";
      document.getElementById("tr-step2").style.display = (step === 2) ? "" : "none";
    }

    document.getElementById("tr-send").onclick = function () {
      var email = (emailInput.value || "").trim();
      if (!email) return;
      this.disabled = true; msg.textContent = "Sending…"; msg.className = "tr-msg";
      var self = this;
      client.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } }).then(function (r) {
        self.disabled = false;
        if (r.error) { msg.textContent = r.error.message; msg.className = "tr-msg err"; return; }
        currentEmail = email;
        document.getElementById("tr-lead").textContent = "We emailed a code to " + email + ". Enter it below.";
        show(2); msg.textContent = ""; document.getElementById("tr-otp").focus();
      });
    };
    document.getElementById("tr-verify").onclick = function () {
      var token = (document.getElementById("tr-otp").value || "").replace(/\s/g, "");
      if (!token) return;
      this.disabled = true; msg.textContent = "Verifying…"; msg.className = "tr-msg";
      var self = this;
      client.auth.verifyOtp({ email: currentEmail, token: token, type: "email" }).then(function (r) {
        if (r.error) { msg.textContent = r.error.message; msg.className = "tr-msg err"; self.disabled = false; }
        else { close(); } // onAuthStateChange handles the session + sync
      });
    };
    document.getElementById("tr-back").onclick = function () {
      document.getElementById("tr-lead").textContent = "Save your progress and unlock your books on any device. We'll email you a login code — no password.";
      show(1); msg.textContent = ""; emailInput.focus();
    };
    emailInput.focus();
  }
  TR.openSignIn = function () { openModal(); }; // used by "Get free access" CTA

  /* ---- onboarding: collect profile details on first sign-in ---- */
  var PROVINCES = ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"];
  function oval(id) { var e = document.getElementById(id); return e ? (e.value || "").trim() : ""; }
  function escAttr(s) { return (s || "").replace(/"/g, "&quot;"); }

  function examOptions() {
    return fetch("/data/books.json", { cache: "no-cache" }).then(function (r) { return r.json(); })
      .then(function (bs) { return bs.map(function (b) { return '<option value="' + escAttr(b.name) + '">' + (b.name || "") + "</option>"; }).join(""); })
      .catch(function () { return ""; });
  }

  function maybeOnboard() {
    if (!TR.user) return;
    client.from("profiles").select("onboarded_at").eq("id", TR.user.id).maybeSingle()
      .then(function (r) { if (!r.data || !r.data.onboarded_at) openOnboard(); }, function () {});
  }

  function openOnboard() {
    if (document.getElementById("tr-modal") || document.getElementById("tr-onb")) return;
    examOptions().then(function (exams) {
      var ov = document.createElement("div");
      ov.id = "tr-onb"; ov.className = "tr-modal";
      ov.innerHTML =
        '<div class="tr-box wide">' +
        '<h3>Tell us about you</h3>' +
        '<p>This helps us send the right materials and exam alerts. Takes about 20 seconds.</p>' +
        '<label>Full name *</label><input id="o-name" type="text" placeholder="Your name">' +
        '<label>Phone (optional)</label><input id="o-phone" type="tel" inputmode="tel" placeholder="98XXXXXXXX">' +
        '<label>Which exam are you preparing for? *</label>' +
        '<select id="o-exam"><option value="">Select…</option>' + exams + '<option value="Other / not sure">Other / not sure</option></select>' +
        '<label>Profession / field *</label><input id="o-prof" type="text" placeholder="e.g. Health Assistant, Nurse, Student">' +
        '<label>Province *</label><select id="o-prov"><option value="">Select…</option>' +
        PROVINCES.map(function (p) { return '<option value="' + p + '">' + p + "</option>"; }).join("") + "</select>" +
        '<label>Do you have the book? *</label><select id="o-book"><option value="">Select…</option><option value="yes">Yes</option><option value="no">No</option></select>' +
        '<button id="o-save" class="tr-primary">Save &amp; continue</button>' +
        '<button id="o-skip" class="tr-link">Skip for now</button>' +
        '<div id="o-msg" class="tr-msg"></div></div>';
      document.body.appendChild(ov);
      document.getElementById("o-skip").onclick = function () { ov.remove(); };
      var msg = document.getElementById("o-msg");
      document.getElementById("o-save").onclick = function () {
        var name = oval("o-name"), phone = oval("o-phone"), exam = oval("o-exam"),
            prof = oval("o-prof"), prov = oval("o-prov"), book = oval("o-book");
        if (!name || !exam || !prof || !prov || !book) { msg.textContent = "Please fill the required (*) fields."; msg.className = "tr-msg err"; return; }
        this.disabled = true; msg.textContent = "Saving…"; msg.className = "tr-msg";
        var self = this;
        client.from("profiles").upsert({
          id: TR.user.id, email: TR.user.email, full_name: name, phone: phone || null,
          exam: exam, profession: prof, province: prov, has_book: (book === "yes"),
          onboarded_at: new Date().toISOString()
        }, { onConflict: "id" }).then(function (r) {
          if (r.error) { msg.textContent = r.error.message; msg.className = "tr-msg err"; self.disabled = false; }
          else { ov.remove(); }
        });
      };
    });
  }

  /* ---- react to auth state ---- */
  function setSession(session) {
    TR.session = session || null;
    TR.user = session ? session.user : null;
    renderAcct();
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderAcct();
    client.auth.getSession().then(function (r) {
      setSession(r.data.session);
      if (TR.user) pullAccountData().then(afterSync);
    });
    client.auth.onAuthStateChange(function (event, session) {
      var wasUser = !!TR.user;
      setSession(session);
      if (TR.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) pullAccountData().then(afterSync);
      if (!TR.user && wasUser) { /* signed out: keep local data as-is */ }
    });
  });

  // After a sync, refresh the page's content; if we just unlocked the current book, drop the gate.
  function afterSync() {
    var book = new URLSearchParams(location.search).get("book");
    if (book && getCodes()[book] && document.getElementById("__gate")) { location.reload(); return; }
    window.dispatchEvent(new Event("tr-synced"));
    maybeOnboard(); // prompt for profile details if not done yet
  }
})();
