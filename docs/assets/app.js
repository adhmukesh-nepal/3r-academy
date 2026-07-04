/* =========================================================================
   app.js — shared logic for 3R Academy.
   Reads content from /data/**.json (generated from the spreadsheets — see
   CLAUDE.md). Pages stay thin: each sets <body data-page="..."> and this file
   dispatches to the matching renderer. No framework, no build step.
   ========================================================================= */
(function () {
  "use strict";

  var FORM_URL = "https://forms.gle/f8mLCm8AzpxLduTV6";
  var DECK_ACCENT = { epi: "var(--read)", diseases: "var(--read)", confuse: "var(--rank)",
                      mnemonics: "var(--recall)", psc: "var(--rank)" };
  // exam tracks (home-page filter). Order here = order of the filter chips.
  var CATS = [
    { id: "loksewa", label: "Loksewa" },
    { id: "license", label: "Licensing" },
    { id: "entrance", label: "Entrance" }
  ];

  /* ---------- tiny helpers ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function qp(name) { return new URLSearchParams(location.search).get(name); }
  function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function loadJSON(path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + path);
      return r.json();
    });
  }
  function showError(container, msg) {
    if (!container) return;
    container.innerHTML = "";
    container.appendChild(el("div", "msg", esc(msg)));
  }

  /* ---------- content decryption (mirrors gate.js / build_data.py) ---------- */
  var _keyCache = {};
  function storedCodes() { try { return JSON.parse(localStorage.getItem("3r_keys") || "{}"); } catch (e) { return {}; } }
  function b64d(s) { var bin = atob(s), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function normCode(s) { return (s || "").toUpperCase().replace(/[\s-]/g, ""); }

  function bookKey(book) {
    if (_keyCache[book]) return Promise.resolve(_keyCache[book]);
    var code = storedCodes()[book];
    if (!code) return Promise.reject(new Error("locked"));
    return loadJSON("/data/books.json").then(function (books) {
      var b = null;
      for (var i = 0; i < books.length; i++) { if (books[i].id === book) { b = books[i]; break; } }
      if (!b || !b.salt) throw new Error("no-salt");
      return crypto.subtle.importKey("raw", new TextEncoder().encode(normCode(code)), "PBKDF2", false, ["deriveKey"])
        .then(function (base) {
          return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: b64d(b.salt), iterations: 200000, hash: "SHA-256" },
            base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        }).then(function (key) { _keyCache[book] = key; return key; });
    });
  }
  // fetch an .enc file and return the decrypted JSON object
  function loadEncrypted(book, path) {
    return bookKey(book).then(function (key) {
      return loadJSON(path).then(function (enc) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(enc.iv) }, key, b64d(enc.ct))
          .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
      });
    });
  }

  /* graceful Viber-link note until the real link is set */
  function wireViber() {
    var b = document.getElementById("viberBtn");
    if (!b) return;
    b.addEventListener("click", function (e) {
      if (this.getAttribute("href") === "REPLACE_WITH_VIBER_LINK") {
        e.preventDefault();
        alert("Viber group link coming soon!");
      }
    });
  }

  /* ---------- HOME: book grid + track filter ---------- */
  function renderHome() {
    var grid = document.getElementById("examGrid");
    var filterBar = document.getElementById("examFilter");

    function applyFilter(cat) {
      grid.querySelectorAll(".exam").forEach(function (card) {
        card.style.display = (cat === "all" || card.getAttribute("data-cat") === cat) ? "" : "none";
      });
    }

    loadJSON("/data/books.json").then(function (books) {
      grid.innerHTML = "";
      books.forEach(function (x) {
        var card = el("div", "exam" + (x.ready ? "" : " soon"));
        card.setAttribute("data-cat", x.category || "other");
        card.innerHTML =
          '<div><div class="board">' + esc(x.board) + '</div><h4>' + esc(x.name) +
          '</h4><div class="desc">' + esc(x.desc) + "</div></div>" +
          '<div class="row">' +
          (x.ready
            ? '<span></span><a class="open" href="/book.html?book=' + encodeURIComponent(x.id) + '">Open →</a>'
            : '<span class="badge">Coming soon</span>') +
          "</div>";
        grid.appendChild(card);
      });

      // build filter chips only for tracks that actually have books
      if (filterBar) {
        var present = {};
        books.forEach(function (x) { present[x.category || "other"] = true; });
        var chips = [{ id: "all", label: "All exams" }].concat(CATS.filter(function (c) { return present[c.id]; }));
        Object.keys(present).forEach(function (k) {
          if (k !== "other" && !CATS.some(function (c) { return c.id === k; })) chips.push({ id: k, label: k });
        });
        filterBar.innerHTML = "";
        if (chips.length > 2) { // only show chips when there's more than one track
          chips.forEach(function (c, i) {
            var b = el("button", i === 0 ? "active" : null, esc(c.label));
            b.onclick = function () {
              applyFilter(c.id);
              filterBar.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
              b.classList.add("active");
            };
            filterBar.appendChild(b);
          });
        }
      }
      applyFilter("all");
    }).catch(function () { showError(grid, "Couldn't load the book list. Please try again."); });
  }

  /* ---------- BOOK: chapter grid ---------- */
  function renderBook() {
    var id = qp("book");
    var grid = document.getElementById("chapGrid");
    if (!id) { showError(grid, "No book specified."); return; }
    loadJSON("/data/" + id + "/book.json").then(function (book) {
      setText("bookTitle", book.name);
      setText("edition", book.edition);
      if (book.tagline) setText("tagline", book.tagline);
      document.title = book.name + " · 3R Academy";
      grid.innerHTML = "";
      (book.chapters || []).forEach(function (c) {
        var card = el("div", "chap" + (c.ready ? "" : " soon"));
        var badge = "";
        if (c.ready) {
          var pr = getProg(id, c.n);
          if (pr.quiz && typeof pr.quiz.best === "number") {
            var done = pr.quiz.best === pr.quiz.total;
            badge = '<span class="pbadge ' + (done ? "done" : "part") + '">Quiz best ' + pr.quiz.best + "/" + pr.quiz.total + "</span>";
          } else if (Object.keys(pr.cards).length) {
            badge = '<span class="pbadge part">' + Object.keys(pr.cards).length + " cards reviewed</span>";
          }
        }
        card.innerHTML =
          '<div><div class="cn">Chapter ' + c.n + '</div><h4>' + esc(c.title) + badge + "</h4></div>" +
          '<div class="row">' +
          (c.ready
            ? '<span></span><a class="open" href="/chapter.html?book=' + encodeURIComponent(id) + "&ch=" + c.n + '">Open →</a>'
            : '<span class="badge">Coming soon</span>') +
          "</div>";
        grid.appendChild(card);
      });
    }).catch(function () { showError(grid, "Couldn't load this book. Check the link and try again."); });
  }

  /* ---------- CHAPTER: revision station ---------- */
  function renderChapter() {
    var id = qp("book"), n = qp("ch");
    var main = document.querySelector(".wrap.main");
    if (!id || !n) { if (main) showError(main, "No chapter specified."); return; }
    Promise.all([
      loadJSON("/data/" + id + "/book.json"),
      loadEncrypted(id, "/data/" + id + "/ch" + n + ".enc")
    ]).then(function (res) {
      var book = res[0], ch = res[1];
      var back = document.getElementById("backToBook");
      if (back) back.href = "/book.html?book=" + encodeURIComponent(id);
      setText("brandName", book.name);
      setText("chLabel", "Chapter " + ch.number + " · Revision Station");
      setText("chTitle", ch.title);
      setText("chEdition", book.edition);
      if (book.tagline) setText("tagline", book.tagline);
      setText("chFoot", "Chapter " + ch.number);
      document.title = "Revision Station — Chapter " + ch.number + " · " + ch.title;

      // videos
      var vg = document.getElementById("videoGrid");
      if (vg) {
        vg.innerHTML = "";
        (ch.videos || []).forEach(function (v) {
          var card = el("div", "card");
          if (v.yt) {
            var f = el("div", "vid");
            f.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(v.yt) +
              '" title="' + esc(v.title) + '" allowfullscreen loading="lazy"></iframe>';
            card.appendChild(f);
          } else {
            card.appendChild(el("div", "vid", "🎬 Video coming soon"));
          }
          var b = el("div", "body");
          b.appendChild(el("h4", null, esc(v.title)));
          if (!v.yt) b.appendChild(el("span", "soonpill", "Coming soon"));
          card.appendChild(b);
          vg.appendChild(card);
        });
      }

      // flashcard decks
      var dg = document.getElementById("deckGrid");
      if (dg) {
        dg.innerHTML = "";
        (ch.decks || []).forEach(function (d) {
          var card = el("div", "card deck");
          card.appendChild(el("h4", null, esc(d.name)));
          card.appendChild(el("div", "cnt", (d.desc ? esc(d.desc) + " · " : "") + d.cards.length + " cards"));
          var a = el("a", "btn", "Open deck →");
          a.href = "/flashcards.html?book=" + encodeURIComponent(id) + "&ch=" + n + "&deck=" + encodeURIComponent(d.id);
          card.appendChild(a);
          dg.appendChild(card);
        });
      }

      // progress + spaced-repetition coverage under flashcards
      var prog = getProg(id, n);
      var cov = coverage(prog, ch);
      var dp = document.getElementById("deckProg");
      if (dp && cov.totalCards) {
        dp.innerHTML = 'Reviewed <b>' + cov.seen + ' / ' + cov.totalCards + '</b> cards (' + cov.pct + '%)' +
          (cov.due ? ' · <b>' + cov.due + '</b> due for review' : '') +
          (prog.starCards.length ? ' · <b>' + prog.starCards.length + '</b> starred' : '');
      }

      // practice MCQs entry
      var qe = document.getElementById("quizEntry");
      if (qe) {
        var count = (ch.mcqs || []).length;
        if (count) {
          var base = "/quiz.html?book=" + encodeURIComponent(id) + "&ch=" + n;
          var extra = "";
          if (prog.weakMcqs.length) extra += '<a class="btn" style="background:#c0392b" href="' + base + '&mode=weak">Review weak areas (' + prog.weakMcqs.length + ') →</a>';
          if (prog.starMcqs.length) extra += '<a class="btn" style="background:var(--rank)" href="' + base + '&mode=starred">Starred (' + prog.starMcqs.length + ') →</a>';
          var best = prog.quiz && typeof prog.quiz.best === "number" ? '<div class="cnt">Best score: <b>' + prog.quiz.best + " / " + (prog.quiz.total || count) + '</b> · ' + prog.quiz.attempts + ' attempt' + (prog.quiz.attempts === 1 ? "" : "s") + '</div>' : "";
          qe.innerHTML =
            '<div class="card deck"><h4>' + count + ' question' + (count === 1 ? "" : "s") + '</h4>' +
            '<div class="cnt">See the answer + why each option is right or wrong.</div>' + best +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">' +
              '<a class="btn" style="background:var(--recall)" href="' + base + '&mode=study">Study mode →</a>' +
              '<a class="btn" style="background:var(--rank)" href="' + base + '&mode=timed">Timed test →</a>' + extra +
            '</div></div>';
        } else {
          qe.innerHTML = '<div class="msg">MCQs for this chapter are coming soon.</div>';
        }
      }

      // notes (most important to remember)
      var rl = document.getElementById("rapidList");
      if (rl) {
        rl.innerHTML = "";
        (ch.notes || []).forEach(function (t) { rl.appendChild(el("li", null, esc(t))); });
      }
    }).catch(function () { if (main) showError(main, "Couldn't load this chapter. Check the link and try again."); });
  }

  /* ---------- FLASHCARDS (with spaced repetition + stars) ---------- */
  function initFlashcards() {
    var id = qp("book"), n = qp("ch");
    var faceEl = document.getElementById("face");
    if (!id || !n) { if (faceEl) faceEl.textContent = "No chapter specified."; return; }

    loadEncrypted(id, "/data/" + id + "/ch" + n + ".enc").then(function (ch) {
      var realDecks = ch.decks || [];
      if (!realDecks.length) { faceEl.textContent = "No decks in this chapter yet."; return; }
      setText("fcTitle", "Flashcards — Chapter " + ch.number);
      var back = document.getElementById("fcBack");
      if (back) back.href = "/chapter.html?book=" + encodeURIComponent(id) + "&ch=" + n;

      var p = getProg(id, n);
      var lookup = {}; // "<deckId>:<i>" -> {front, back}
      realDecks.forEach(function (d) { d.cards.forEach(function (c, i) { lookup[d.id + ":" + i] = { front: c[0], back: c[1] }; }); });

      var cardEl = document.getElementById("flipcard"), hintEl = document.getElementById("hint"),
          countEl = document.getElementById("count"), tabs = document.getElementById("decks"),
          starBtn = document.getElementById("btnStar"), rateRow = document.getElementById("rateRow");
      var keys = [], pos = 0, flipped = false, currentDeckId = null;

      function deckList() {
        var list = [];
        var due = Object.keys(p.cards).filter(function (k) { return lookup[k] && isDue(p.cards[k]); });
        if (due.length) list.push({ id: "__due", name: "⏱ Review due (" + due.length + ")", keys: due });
        var starred = p.starCards.filter(function (k) { return lookup[k]; });
        if (starred.length) list.push({ id: "__starred", name: "★ Starred (" + starred.length + ")", keys: starred });
        realDecks.forEach(function (d) {
          list.push({ id: d.id, name: d.name + " (" + d.cards.length + ")", keys: d.cards.map(function (_, i) { return d.id + ":" + i; }) });
        });
        return list;
      }
      function buildTabs() {
        tabs.innerHTML = "";
        deckList().forEach(function (d) {
          var b = el("button", d.id === currentDeckId ? "active" : null, esc(d.name));
          b.onclick = function () { selectDeck(d.id); };
          tabs.appendChild(b);
        });
      }
      function selectDeck(deckId) {
        var list = deckList(), chosen = null;
        for (var i = 0; i < list.length; i++) { if (list[i].id === deckId) { chosen = list[i]; break; } }
        if (!chosen) chosen = list[list.length - 1];
        currentDeckId = chosen.id; keys = chosen.keys.slice(); pos = 0; flipped = false;
        var accentId = currentDeckId.indexOf("__") === 0 ? "psc" : currentDeckId;
        cardEl.style.borderTopColor = DECK_ACCENT[accentId] || "var(--read)";
        buildTabs(); render();
        history.replaceState(null, "", "?book=" + encodeURIComponent(id) + "&ch=" + n +
          (currentDeckId.indexOf("__") === 0 ? "" : "&deck=" + encodeURIComponent(currentDeckId)));
      }
      function curKey() { return keys[pos]; }
      function render() {
        if (!keys.length) { faceEl.textContent = "Nothing here yet — study some cards first."; countEl.textContent = ""; hintEl.textContent = ""; rateRow.style.display = "none"; starBtn.style.visibility = "hidden"; return; }
        var c = lookup[curKey()];
        faceEl.className = "face " + (flipped ? "a" : "q");
        faceEl.textContent = flipped ? c.back : c.front;
        hintEl.textContent = flipped ? "How well did you know it?" : "Tap card to reveal the answer";
        countEl.textContent = (pos + 1) + " / " + keys.length;
        rateRow.style.display = flipped ? "flex" : "none";
        starBtn.style.visibility = "visible";
        var starred = p.starCards.indexOf(curKey()) !== -1;
        starBtn.textContent = starred ? "★ Starred" : "☆ Star";
        starBtn.classList.toggle("on", starred);
      }
      function flip() { flipped = !flipped; render(); }
      function next() { pos = (pos + 1) % keys.length; flipped = false; render(); }
      function prev() { pos = (pos - 1 + keys.length) % keys.length; flipped = false; render(); }
      function shuffle() { for (var i = keys.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = keys[i]; keys[i] = keys[j]; keys[j] = t; } pos = 0; flipped = false; render(); }
      function rate(r) {
        if (!keys.length) return;
        rateCard(p, curKey(), r); setProg(id, n, p);
        pos = (pos + 1) % keys.length; flipped = false; buildTabs(); render();
      }
      function toggleStar() { if (!keys.length) return; toggleIn(p.starCards, curKey()); setProg(id, n, p); buildTabs(); render(); }

      cardEl.onclick = flip;
      document.getElementById("btnPrev").onclick = prev;
      document.getElementById("btnFlip").onclick = flip;
      document.getElementById("btnNext").onclick = next;
      document.getElementById("btnShuffle").onclick = shuffle;
      starBtn.onclick = toggleStar;
      rateRow.querySelectorAll("button[data-r]").forEach(function (b) { b.onclick = function () { rate(b.getAttribute("data-r")); }; });
      document.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") next();
        else if (e.key === "ArrowLeft") prev();
        else if (e.key === " ") { e.preventDefault(); flip(); }
        else if (flipped && (e.key === "1" || e.key === "2" || e.key === "3")) rate({ "1": "again", "2": "good", "3": "easy" }[e.key]);
      });

      var want = qp("deck");
      var first = deckList()[0];
      selectDeck(realDecks.some(function (d) { return d.id === want; }) ? want : (first ? first.id : realDecks[0].id));
    }).catch(function () { if (faceEl) faceEl.textContent = "Couldn't load this chapter."; });
  }

  function setText(id, text) { var e = document.getElementById(id); if (e) e.textContent = text; }

  /* ---------- progress store (coverage + spaced repetition + stars + weak areas) ---------- */
  function progKey(book, ch) { return "progress:" + book + ":" + ch; }
  function getProg(book, ch) {
    var p;
    try { p = JSON.parse(localStorage.getItem(progKey(book, ch)) || "{}"); } catch (e) { p = {}; }
    p.quiz = p.quiz || null;
    p.cards = p.cards || {};        // "<deck>:<i>" -> {due, ivl, ease, reps}
    p.starCards = p.starCards || []; // ["<deck>:<i>"]
    p.starMcqs = p.starMcqs || [];   // [questionIndex]
    p.weakMcqs = p.weakMcqs || [];   // [questionIndex]
    return p;
  }
  function setProg(book, ch, obj) {
    localStorage.setItem(progKey(book, ch), JSON.stringify(obj));
    if (window.TR && window.TR.pushProgress) window.TR.pushProgress(book, ch, obj); // sync when signed in
  }
  function today() { return Math.floor(Date.now() / 86400000); }

  // simplified SM-2: rating is "again" | "good" | "easy"
  function rateCard(p, key, rating) {
    var c = p.cards[key] || { ivl: 0, ease: 2.5, reps: 0 };
    if (rating === "again") { c.reps = 0; c.ivl = 0; c.ease = Math.max(1.3, c.ease - 0.2); }
    else if (rating === "good") { c.reps += 1; c.ivl = c.reps === 1 ? 1 : Math.round(c.ivl * c.ease); }
    else if (rating === "easy") { c.reps += 1; c.ivl = c.reps === 1 ? 3 : Math.round(c.ivl * c.ease * 1.3); c.ease += 0.15; }
    c.due = today() + c.ivl; // "again" -> due today (still due this session)
    p.cards[key] = c;
    return c;
  }
  function isDue(c) { return c && (c.ivl === 0 || c.due <= today()); }
  function toggleIn(arr, val) { var i = arr.indexOf(val); if (i === -1) arr.push(val); else arr.splice(i, 1); return i === -1; }

  // coverage summary for a chapter given its content
  function coverage(p, ch) {
    var totalCards = (ch.decks || []).reduce(function (s, d) { return s + d.cards.length; }, 0);
    var seen = Object.keys(p.cards).length;
    var due = 0;
    Object.keys(p.cards).forEach(function (k) { if (isDue(p.cards[k])) due++; });
    return { totalCards: totalCards, seen: Math.min(seen, totalCards), due: due,
             pct: totalCards ? Math.round(Math.min(seen, totalCards) / totalCards * 100) : 0 };
  }

  /* ---------- QUIZ / MCQ mode ---------- */
  function initQuiz() {
    var id = qp("book"), n = qp("ch"), mode = qp("mode");
    var root = document.getElementById("quizRoot");
    if (!id || !n) { showError(root, "No chapter specified."); return; }
    var LETTERS = ["A", "B", "C", "D", "E"];
    var behavior = mode === "timed" ? "timed" : "study"; // weak/starred run study-style
    var review = (mode === "weak" || mode === "starred") ? mode : null;

    loadEncrypted(id, "/data/" + id + "/ch" + n + ".enc").then(function (ch) {
      var mcqs = ch.mcqs || [];
      setText("quizTitle", "Practice MCQs — Chapter " + ch.number);
      var back = document.getElementById("backToChapter");
      if (back) back.href = "/chapter.html?book=" + encodeURIComponent(id) + "&ch=" + n;
      document.title = "Practice MCQs — Chapter " + ch.number + " · " + ch.title;
      var p = getProg(id, n);

      function computePool() {
        if (mode === "weak") return p.weakMcqs.filter(function (i) { return mcqs[i]; }).map(function (i) { return { q: mcqs[i], oi: i }; });
        if (mode === "starred") return p.starMcqs.filter(function (i) { return mcqs[i]; }).map(function (i) { return { q: mcqs[i], oi: i }; });
        return mcqs.map(function (q, i) { return { q: q, oi: i }; });
      }

      if (!mcqs.length) { root.innerHTML = ""; root.appendChild(el("div", "msg", "MCQs for this chapter are coming soon.")); return; }
      if (!mode) { renderPicker(mcqs.length); return; }

      var pool = computePool();
      if (!pool.length) {
        root.innerHTML = "";
        root.appendChild(el("div", "msg", review === "weak"
          ? "No weak questions yet — answer some MCQs first and the ones you miss will collect here."
          : "No starred questions yet — tap ☆ on a question to save it here."));
        return;
      }
      runQuiz(pool);

      function renderPicker(count) {
        root.innerHTML =
          '<p class="lead2">' + count + ' question' + (count === 1 ? "" : "s") + ' in this chapter. Choose how to practise:</p>' +
          '<div class="mode-pick">' +
            '<div class="mode-card study"><h4>Study mode</h4><p>See the answer and the reason each option is right or wrong straight after every question. Best for learning.</p><button data-mode="study">Start studying →</button></div>' +
            '<div class="mode-card"><h4>Mock test (timed)</h4><p>A countdown timer, no feedback until the end, then your score and a full review. Best for exam practice.</p><button data-mode="timed">Start timed test →</button></div>' +
          '</div>';
        root.querySelectorAll("button[data-mode]").forEach(function (b) {
          b.onclick = function () {
            mode = b.getAttribute("data-mode"); behavior = mode === "timed" ? "timed" : "study";
            history.replaceState(null, "", "?book=" + encodeURIComponent(id) + "&ch=" + n + "&mode=" + mode);
            runQuiz(computePool());
          };
        });
      }

      function runQuiz(pool) {
        var idx = 0, score = 0, answered = false;
        var answers = pool.map(function () { return -1; });
        var total = pool.length;
        var secsLeft = total * 60, timer = null;

        root.innerHTML =
          '<div class="quiz-bar"><span id="qProg"></span>' + (behavior === "timed" ? '<span class="timer" id="qTimer"></span>' : '<span></span>') + '</div>' +
          '<div class="progress-track"><span id="qFill"></span></div>' +
          '<div id="qHolder"></div>';
        var holder = document.getElementById("qHolder");

        if (behavior === "timed") {
          tick();
          timer = setInterval(function () { secsLeft--; if (secsLeft <= 0) { secsLeft = 0; tick(); finish(); } else tick(); }, 1000);
        }
        function tick() {
          var t = document.getElementById("qTimer");
          if (t) { var m = Math.floor(secsLeft / 60), s = secsLeft % 60; t.textContent = "⏱ " + m + ":" + (s < 10 ? "0" : "") + s; }
        }
        render();

        function render() {
          answered = false;
          var q = pool[idx].q, oi = pool[idx].oi;
          setText("qProg", "Question " + (idx + 1) + " of " + total + (review ? " · " + (review === "weak" ? "weak areas" : "starred") : ""));
          var fill = document.getElementById("qFill"); if (fill) fill.style.width = Math.round(idx / total * 100) + "%";

          var starred = p.starMcqs.indexOf(oi) !== -1;
          var html = '<div class="qcard"><div class="qhead"><p class="qtext">' + esc(q.q) + '</p>' +
                     '<button class="qstar' + (starred ? " on" : "") + '" id="qStar" title="Star this question">' + (starred ? "★" : "☆") + '</button></div><div class="opts">';
          q.options.forEach(function (o, i) {
            html += '<button class="opt" data-i="' + i + '"><span class="lab">' + LETTERS[i] + '</span><span>' + esc(o.text) + '</span></button>' +
                    '<div class="why" data-why="' + i + '">' + esc(o.why) + '</div>';
          });
          html += '</div><div class="qfoot"><span class="score" id="qScore"></span><button id="qNext" disabled>' +
                  (idx === total - 1 ? (behavior === "timed" ? "Finish test" : "See results") : "Next →") + '</button></div></div>';
          holder.innerHTML = html;

          if (behavior === "study") setText("qScore", "Score: " + score + " / " + total);
          holder.querySelectorAll(".opt").forEach(function (btn) {
            btn.onclick = function () { choose(parseInt(btn.getAttribute("data-i"), 10)); };
          });
          document.getElementById("qStar").onclick = function () {
            toggleIn(p.starMcqs, oi); setProg(id, n, p); render();
          };
          var nextBtn = document.getElementById("qNext");
          if (behavior === "timed") nextBtn.disabled = false;
          nextBtn.onclick = advance;
        }

        function choose(i) {
          var q = pool[idx].q, oi = pool[idx].oi;
          answers[idx] = i;
          if (behavior === "study") {
            if (answered) return;
            answered = true;
            var opts = holder.querySelectorAll(".opt"), whys = holder.querySelectorAll(".why");
            q.options.forEach(function (o, k) {
              opts[k].disabled = true;
              if (o.correct) { opts[k].classList.add("correct"); whys[k].classList.add("correct", "show"); }
              else if (k === i) { opts[k].classList.add("wrong"); whys[k].classList.add("wrong", "show"); }
              else { whys[k].classList.add("show"); }
            });
            var correct = q.options[i] && q.options[i].correct;
            if (correct) { score++; if (review === "weak") { var w = p.weakMcqs.indexOf(oi); if (w !== -1) p.weakMcqs.splice(w, 1); } }
            else if (p.weakMcqs.indexOf(oi) === -1) { p.weakMcqs.push(oi); } // auto-collect weak areas
            setProg(id, n, p);
            setText("qScore", "Score: " + score + " / " + total);
            document.getElementById("qNext").disabled = false;
          } else {
            holder.querySelectorAll(".opt").forEach(function (b) { b.classList.remove("selected"); });
            holder.querySelector('.opt[data-i="' + i + '"]').classList.add("selected");
          }
        }

        function advance() { if (idx === total - 1) { finish(); return; } idx++; render(); }

        function finish() {
          if (timer) { clearInterval(timer); timer = null; }
          if (behavior === "timed") {
            score = 0;
            pool.forEach(function (item, k) {
              var chosen = answers[k];
              if (chosen > -1 && item.q.options[chosen] && item.q.options[chosen].correct) score++;
              else if (item.q.options.some(function (o) { return o.correct; }) && p.weakMcqs.indexOf(item.oi) === -1) p.weakMcqs.push(item.oi);
            });
          }
          // record quiz stats only for full-chapter runs
          if (mode === "study" || mode === "timed") {
            p.quiz = p.quiz || { attempts: 0, best: 0 };
            p.quiz.attempts = (p.quiz.attempts || 0) + 1;
            p.quiz.total = total; p.quiz.lastScore = score;
            p.quiz.best = Math.max(p.quiz.best || 0, score);
          }
          setProg(id, n, p);

          var pct = Math.round(score / total * 100);
          var html = '<div class="result"><div>Your score</div><div class="big">' + score + ' / ' + total + '</div>' +
                     '<div class="pct">' + pct + '% correct</div>' +
                     '<div class="actions"><button id="qRetry">Try again</button>' +
                     '<a href="/chapter.html?book=' + encodeURIComponent(id) + '&ch=' + n + '">Back to chapter</a></div></div>';
          if (behavior === "timed") {
            html += '<h3 style="margin:26px 0 4px;font-size:18px">Review</h3><div class="review">';
            pool.forEach(function (item, k) {
              html += '<div class="rq"><p class="rqq">' + (k + 1) + '. ' + esc(item.q.q) + '</p>';
              item.q.options.forEach(function (o, j) {
                var cls = o.correct ? "correct" : (j === answers[k] ? "wrong" : "");
                var mark = o.correct ? "✓ " : (j === answers[k] ? "✗ " : "");
                html += '<div class="ro ' + cls + '">' + mark + LETTERS[j] + ". " + esc(o.text) +
                        ((o.correct || j === answers[k]) ? '<span class="w">' + esc(o.why) + '</span>' : "") + '</div>';
              });
              html += '</div>';
            });
            html += '</div>';
          }
          root.innerHTML = html;
          var retry = document.getElementById("qRetry");
          if (retry) retry.onclick = function () { var np = computePool(); if (np.length) runQuiz(np); else initQuiz(); };
        }
      }
    }).catch(function () { showError(root, "Couldn't load this chapter's questions."); });
  }

  /* ---------- PWA service worker ---------- */
  function registerSW() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").catch(function () { /* offline support unavailable */ });
      });
    }
  }

  /* ---------- dispatch ---------- */
  function renderPage() {
    switch (document.body.getAttribute("data-page")) {
      case "home": renderHome(); break;
      case "book": renderBook(); break;
      case "chapter": renderChapter(); break;
      case "flashcards": initFlashcards(); break;
      case "quiz": initQuiz(); break;
    }
  }
  document.addEventListener("DOMContentLoaded", function () {
    registerSW();
    wireViber();
    renderPage();
  });
  // re-render when account data (unlock codes / progress) syncs in after sign-in
  window.addEventListener("tr-synced", renderPage);
})();
