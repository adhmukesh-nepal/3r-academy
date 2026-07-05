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
      '<h3 id="tr-title">Sign in to 3R Academy</h3>' +
      '<p id="tr-lead"></p>' +
      '<div id="tr-body"></div>' +
      '<div id="tr-msg" class="tr-msg"></div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); };
    document.getElementById("tr-x").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    var body = document.getElementById("tr-body"),
        msg = document.getElementById("tr-msg"),
        lead = document.getElementById("tr-lead"),
        title = document.getElementById("tr-title");
    function gv(id) { var e = document.getElementById(id); return e ? (e.value || "").trim() : ""; }
    function setMsg(t, cls) { msg.textContent = t || ""; msg.className = "tr-msg" + (cls ? " " + cls : ""); }

    function renderPassword() {
      title.textContent = "Sign in to 3R Academy";
      lead.textContent = "Sign in to save your progress and open your books on any device.";
      body.innerHTML =
        '<input id="tr-email" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email">' +
        '<input id="tr-pass" type="password" placeholder="Password" autocomplete="current-password">' +
        '<button id="tr-signin" class="tr-primary">Sign in</button>' +
        '<button id="tr-tocreate" class="tr-link">New here? Create an account</button>' +
        '<button id="tr-tootp" class="tr-link">Email me a code instead / forgot password</button>';
      setMsg("");
      document.getElementById("tr-signin").onclick = function () {
        var email = gv("tr-email"), pass = gv("tr-pass");
        if (!email || !pass) { setMsg("Enter your email and password.", "err"); return; }
        this.disabled = true; setMsg("Signing in…"); var self = this;
        client.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
          if (r.error) { setMsg(r.error.message, "err"); self.disabled = false; } else close();
        });
      };
      document.getElementById("tr-tocreate").onclick = renderCreate;
      document.getElementById("tr-tootp").onclick = renderOtpEmail;
      var e = document.getElementById("tr-email"); if (e) e.focus();
    }

    function renderCreate() {
      title.textContent = "Create your account";
      lead.textContent = "Pick a password (6+ characters). One sign-up unlocks everything.";
      body.innerHTML =
        '<input id="tr-email" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email">' +
        '<input id="tr-pass" type="password" placeholder="Create a password" autocomplete="new-password">' +
        '<button id="tr-create" class="tr-primary">Create account</button>' +
        '<button id="tr-toback" class="tr-link">Already have an account? Sign in</button>';
      setMsg("");
      document.getElementById("tr-create").onclick = function () {
        var email = gv("tr-email"), pass = gv("tr-pass");
        if (!email || pass.length < 6) { setMsg("Enter an email and a password of at least 6 characters.", "err"); return; }
        this.disabled = true; setMsg("Creating your account…"); var self = this;
        client.auth.signUp({ email: email, password: pass }).then(function (r) {
          if (r.error) { setMsg(r.error.message, "err"); self.disabled = false; return; }
          if (r.data && r.data.session) { close(); } // signed in immediately (email confirmation off)
          else { renderOtpCode(email, "signup"); } // confirmation required → collect the emailed code
        });
      };
      document.getElementById("tr-toback").onclick = renderPassword;
      document.getElementById("tr-email").focus();
    }

    function renderOtpEmail() {
      title.textContent = "Sign in with an email code";
      lead.textContent = "We'll email you a one-time code — useful if you forgot your password.";
      body.innerHTML =
        '<input id="tr-email" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email">' +
        '<button id="tr-send" class="tr-primary">Email me a code</button>' +
        '<button id="tr-toback" class="tr-link">Back to password sign-in</button>';
      setMsg("");
      document.getElementById("tr-send").onclick = function () {
        var email = gv("tr-email"); if (!email) return;
        this.disabled = true; setMsg("Sending…"); var self = this;
        client.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } }).then(function (r) {
          self.disabled = false;
          if (r.error) { setMsg(r.error.message, "err"); return; }
          renderOtpCode(email, "email");
        });
      };
      document.getElementById("tr-toback").onclick = renderPassword;
      document.getElementById("tr-email").focus();
    }

    function renderOtpCode(email, type) {
      title.textContent = "Enter your code";
      lead.textContent = "We emailed a code to " + email + ". Enter it below to " +
        (type === "signup" ? "confirm your account." : "sign in.");
      body.innerHTML =
        '<input id="tr-otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Enter your code">' +
        '<button id="tr-verify" class="tr-primary">Verify &amp; sign in</button>' +
        '<button id="tr-toback" class="tr-link">Use a different email</button>';
      setMsg("");
      document.getElementById("tr-verify").onclick = function () {
        var token = gv("tr-otp").replace(/\s/g, ""); if (!token) return;
        this.disabled = true; setMsg("Verifying…"); var self = this;
        client.auth.verifyOtp({ email: email, token: token, type: type || "email" }).then(function (r) {
          if (r.error) { setMsg(r.error.message, "err"); self.disabled = false; } else close();
        });
      };
      document.getElementById("tr-toback").onclick = renderPassword;
      document.getElementById("tr-otp").focus();
    }

    renderPassword();
  }
  TR.openSignIn = function () { openModal(); }; // used by "Get free access" CTA

  /* ---- onboarding: collect profile details on first sign-in ---- */
  var PROVINCES = ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"];
  function oval(id) { var e = document.getElementById(id); return e ? (e.value || "").trim() : ""; }
  function escAttr(s) { return (s || "").replace(/"/g, "&quot;"); }

  // decrypt-check a code against a book (same crypto as gate.js) — lets a code entered at
  // sign-up actually unlock the matching book.
  function b64d(s) { var bin = atob(s), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function normCode(s) { return (s || "").toUpperCase().replace(/[\s-]/g, ""); }
  function codeMatchesBook(code, saltB64, bookId) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(normCode(code)), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64d(saltB64), iterations: 200000, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      })
      .then(function (key) {
        return fetch("/data/" + bookId + "/unlock.enc", { cache: "no-cache" }).then(function (r) { return r.json(); })
          .then(function (m) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(m.iv) }, key, b64d(m.ct)); });
      })
      .then(function () { return true; }).catch(function () { return false; });
  }
  function tryUnlockAny(code) { // returns the matching book id, or null
    return fetch("/data/books.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (books) {
      var ready = books.filter(function (b) { return b.salt; }), i = 0;
      function step() {
        if (i >= ready.length) return Promise.resolve(null);
        var b = ready[i++];
        return codeMatchesBook(code, b.salt, b.id).then(function (ok) { return ok ? b.id : step(); });
      }
      return step();
    }).catch(function () { return null; });
  }

  function maybeOnboard() {
    if (!TR.user) return;
    client.from("profiles").select("onboarded_at").eq("id", TR.user.id).maybeSingle()
      .then(function (r) { if (!r.data || !r.data.onboarded_at) openOnboard(); }, function () {});
  }

  var PROFESSIONS = ["Public Health Officer", "Health Assistant / AHW", "Staff Nurse / ANM", "Other"];
  var EXAM_TRACKS = ["Loksewa / PSC (government job)", "Licensing exam (Council — NHPC / Nursing / Pharmacy / Medical)", "Both", "Not sure yet"];
  var BOOK_STATUS = ["Yes", "Planning to buy", "No — just want free updates"];

  function openOnboard() {
    if (document.getElementById("tr-modal") || document.getElementById("tr-onb")) return;
    var ov = document.createElement("div");
    ov.id = "tr-onb"; ov.className = "tr-modal";
    ov.innerHTML =
      '<div class="tr-box wide">' +
      '<h3>Complete your sign-up</h3>' +
      '<p>One sign-up unlocks everything — tell us what you\'re preparing for and we\'ll send what\'s relevant.</p>' +
      '<label>Full name *</label><input id="o-name" type="text" placeholder="Your name">' +
      '<label>Phone (optional — for SMS/Viber exam updates)</label><input id="o-phone" type="tel" inputmode="tel" placeholder="98XXXXXXXX">' +
      '<label>Profession / field *</label><select id="o-prof"><option value="">Select…</option>' +
        PROFESSIONS.map(function (x) { return '<option value="' + x + '">' + x + "</option>"; }).join("") + "</select>" +
      '<label>Which exams are you preparing for? *</label>' +
        EXAM_TRACKS.map(function (x) { return '<label class="chk"><input type="checkbox" class="o-exam" value="' + x + '"> ' + x + "</label>"; }).join("") +
      '<label>Province *</label><select id="o-prov"><option value="">Select…</option>' +
        PROVINCES.map(function (p) { return '<option value="' + p + '">' + p + "</option>"; }).join("") + "</select>" +
      '<label>Do you have the book? *</label><select id="o-book"><option value="">Select…</option>' +
        BOOK_STATUS.map(function (x) { return '<option value="' + x + '">' + x + "</option>"; }).join("") + "</select>" +
      '<label>Book access code (optional)</label><input id="o-code" type="text" placeholder="Code from inside your book" autocapitalize="characters">' +
      '<div class="hint">If you have the book, enter the code to unlock it right now.</div>' +
      '<label class="chk" style="margin-top:14px"><input type="checkbox" id="o-consent"> Yes, send me free study resources and exam updates *</label>' +
      '<button id="o-save" class="tr-primary">Save &amp; continue</button>' +
      '<button id="o-skip" class="tr-link">Skip for now</button>' +
      '<div id="o-msg" class="tr-msg"></div></div>';
    document.body.appendChild(ov);
    document.getElementById("o-skip").onclick = function () { ov.remove(); };
    var msg = document.getElementById("o-msg");
    document.getElementById("o-save").onclick = function () {
      var name = oval("o-name"), phone = oval("o-phone"), prof = oval("o-prof"),
          prov = oval("o-prov"), book = oval("o-book"), code = oval("o-code");
      var exams = Array.prototype.slice.call(document.querySelectorAll(".o-exam:checked")).map(function (c) { return c.value; });
      var consent = document.getElementById("o-consent").checked;
      if (!name || !prof || !exams.length || !prov || !book) { msg.textContent = "Please fill the required (*) fields."; msg.className = "tr-msg err"; return; }
      if (!consent) { msg.textContent = "Please tick the consent box to continue."; msg.className = "tr-msg err"; return; }
      this.disabled = true; msg.textContent = "Saving…"; msg.className = "tr-msg";
      var self = this;
      client.from("profiles").upsert({
        id: TR.user.id, email: TR.user.email, full_name: name, phone: phone || null,
        profession: prof, exam: exams.join(", "), province: prov,
        book_status: book, has_book: (book === "Yes"), consent: true,
        onboarded_at: new Date().toISOString()
      }, { onConflict: "id" }).then(function (r) {
        if (r.error) { msg.textContent = r.error.message; msg.className = "tr-msg err"; self.disabled = false; return; }
        if (code) {
          msg.textContent = "Checking your code…";
          tryUnlockAny(code).then(function (bookId) {
            if (bookId) {
              var c = getCodes(); c[bookId] = code; setCodes(c);
              if (TR.saveEntitlement) TR.saveEntitlement(bookId, code);
              window.dispatchEvent(new Event("tr-synced"));
            }
            ov.remove();
          });
        } else { ov.remove(); }
      });
    };
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
