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

  // streak + daily-goal strip at the top of the home exams section
  function renderStudyStrip() {
    var section = document.getElementById("exams");
    if (!section) return;
    var s = streakInfo(), existing = document.getElementById("study-strip");
    if (!s.count && !s.cards && !s.quizzes) { if (existing) existing.remove(); return; }
    var goalText = s.goalMet ? "✓ Daily goal done" : "Daily goal · " + s.cards + "/" + DAILY_CARD_GOAL + " cards";
    var el = existing || document.createElement("div");
    el.id = "study-strip"; el.className = "study-strip";
    el.innerHTML =
      '<div class="streak"><span class="flame">🔥</span> ' + s.count + '-day streak</div>' +
      '<div class="goal ' + (s.goalMet ? "done" : "") + '">' + goalText +
      '<span class="goalbar"><span style="width:' + s.goalPct + '%"></span></span></div>';
    if (!existing) section.insertBefore(el, section.firstChild);
  }

  /* ---------- HOME: book grid + track filter ---------- */
  function renderHome() {
    renderStudyStrip();
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
      var testGrid = document.getElementById("testGrid");
      var testSection = document.getElementById("tests");
      if (testGrid) testGrid.innerHTML = "";
      var tests = [];

      (book.chapters || []).forEach(function (c) {
        if (c.kind === "test") { tests.push(c); return; } // full-length tests go in their own section
        var card = el("div", "chap" + (c.ready ? "" : " soon"));
        var badge = "";
        if (c.ready) {
          if (c.subtopics && c.subtopics.length) {
            var readyN = c.subtopics.filter(function (s) { return s.ready; }).length;
            badge = '<span class="pbadge part">' + readyN + " / " + c.subtopics.length + " subtopics</span>";
          } else {
            var pr = getProg(id, c.n);
            if (pr.quiz && typeof pr.quiz.best === "number") {
              var done = pr.quiz.best === pr.quiz.total;
              badge = '<span class="pbadge ' + (done ? "done" : "part") + '">Quiz best ' + pr.quiz.best + "/" + pr.quiz.total + "</span>";
            } else if (Object.keys(pr.cards).length) {
              badge = '<span class="pbadge part">' + Object.keys(pr.cards).length + " cards reviewed</span>";
            }
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

      // full-length mock tests → timed mode (percentile ranking comes later)
      if (testGrid) {
        tests.forEach(function (t) {
          var badge = "";
          if (t.ready) {
            var pr = getProg(id, t.n);
            if (pr.quiz && typeof pr.quiz.best === "number") badge = '<span class="pbadge part">Best ' + pr.quiz.best + "/" + pr.quiz.total + "</span>";
          }
          var card = el("div", "chap" + (t.ready ? "" : " soon"));
          card.innerHTML =
            '<div><div class="cn">Full-length · timed</div><h4>' + esc(t.title) + badge + "</h4></div>" +
            '<div class="row">' +
            (t.ready
              ? '<span></span><a class="open" href="/quiz.html?book=' + encodeURIComponent(id) + "&ch=" + t.n + '&mode=timed">Start test →</a>'
              : '<span class="badge">Coming soon</span>') +
            "</div>";
          testGrid.appendChild(card);
        });
        if (testSection) testSection.style.display = tests.length ? "" : "none";
      }
      renderRanking(id, book);
    }).catch(function () { showError(grid, "Couldn't load this book. Check the link and try again."); });
  }

  // "My ranking" panel: per-chapter/test percentiles + readiness nudge (signed-in only).
  function renderRanking(id, book) {
    var section = document.getElementById("ranking"), body = document.getElementById("rankingBody");
    if (!section || !body) return;
    if (!(window.TR && window.TR.session && window.TR.client)) { section.style.display = "none"; return; }
    var titles = {}, subTitles = {};
    (book.chapters || []).forEach(function (c) {
      titles[c.n] = c;
      (c.subtopics || []).forEach(function (s) { subTitles[c.n + "|" + s.id] = s.title; });
    });
    window.TR.client.rpc("book_ranking", { p_book: id }).then(function (res) {
      var d = res && res.data;
      if (!d || !d.signedIn || !d.chapters || !d.chapters.length) { section.style.display = "none"; return; }
      var html = "";
      // overall rank first (mean timed-test performance vs the whole cohort)
      var o = d.overall;
      if (o && o.attempted) {
        var oval = o.enough ? ("Top " + Math.max(1, 100 - o.percentile) + "% of " + o.count)
                            : ("Avg " + o.your_pct + "% · rank at 20+");
        html += '<div class="rank-row"><div class="rank-label"><b>Overall</b></div>' +
                '<div class="rank-bar"><span style="width:' + (o.enough ? o.percentile : 0) + '%"></span></div>' +
                '<div class="rank-val"><b>' + esc(oval) + '</b></div></div>';
      }
      d.chapters.forEach(function (r) {
        var c = titles[r.chapter] || {};
        var label;
        if (r.subtopic) label = (c.title ? c.title + " · " : "") + (subTitles[r.chapter + "|" + r.subtopic] || r.subtopic);
        else if (c.kind === "test") label = c.title || "Full-length test";
        else label = "Ch " + r.chapter + (c.title ? " · " + c.title : "");
        var val, w;
        if (r.enough) { val = "Top " + Math.max(1, 100 - r.percentile) + "% of " + r.count; w = r.percentile; }
        else { val = "You: " + r.your_pct + "% · rank at 20+"; w = 0; }
        html += '<div class="rank-row"><div class="rank-label">' + esc(label) + '</div>' +
                '<div class="rank-bar"><span style="width:' + w + '%"></span></div>' +
                '<div class="rank-val">' + esc(val) + '</div></div>';
      });
      if (typeof d.avg_percentile === "number" && d.avg_percentile >= 60) {
        html += '<div class="rank-nudge">🚀 You\'re in the top ' + Math.max(1, 100 - Math.round(d.avg_percentile)) +
                '% across chapters — you\'re ready for a full-length mock test!</div>';
      }
      body.innerHTML = html;
      section.style.display = "";
    }).catch(function () { section.style.display = "none"; });
  }

  /* ---------- CHAPTER: subtopic chooser (when a chapter has subtopics) ---------- */
  function renderSubtopicList(id, n, ch, book) {
    ["watch", "flashcards", "practice", "rapid"].forEach(function (sid) {
      var s = document.getElementById(sid); if (s) s.style.display = "none";
    });
    var sec = document.getElementById("subtopics"); if (sec) sec.style.display = "";
    var back = document.getElementById("backToBook");
    if (back) { back.href = "/book.html?book=" + encodeURIComponent(id); back.textContent = "← Chapters"; }
    setText("brandName", book.name);
    setText("chLabel", "Chapter " + ch.number);
    setText("chTitle", ch.title);
    setText("chEdition", book.edition);
    if (book.tagline) setText("tagline", book.tagline);
    setText("chFoot", "Chapter " + ch.number);
    document.title = ch.title + " · 3R Academy";
    var grid = document.getElementById("subtopicGrid");
    if (!grid) return;
    grid.innerHTML = "";
    (ch.subtopics || []).forEach(function (s) {
      var card = el("div", "chap" + (s.ready ? "" : " soon"));
      var badge = "";
      if (s.ready) {
        var pr = getUnitProg(id, n, s.id);
        if (pr.quiz && typeof pr.quiz.best === "number") {
          var done = pr.quiz.best === pr.quiz.total;
          badge = '<span class="pbadge ' + (done ? "done" : "part") + '">Quiz best ' + pr.quiz.best + "/" + pr.quiz.total + "</span>";
        } else if (Object.keys(pr.cards).length) {
          badge = '<span class="pbadge part">' + Object.keys(pr.cards).length + " cards reviewed</span>";
        }
      }
      card.innerHTML =
        '<div><div class="cn">Subtopic</div><h4>' + esc(s.title) + badge + "</h4></div>" +
        '<div class="row">' +
        (s.ready
          ? '<span></span><a class="open" href="/chapter.html?book=' + encodeURIComponent(id) + "&ch=" + n + "&sub=" + encodeURIComponent(s.id) + '">Open →</a>'
          : '<span class="badge">Coming soon</span>') +
        "</div>";
      grid.appendChild(card);
    });
  }

  /* ---------- CHAPTER: revision station ---------- */
  function renderChapter() {
    var id = qp("book"), n = qp("ch"), sub = qp("sub");
    var main = document.querySelector(".wrap.main");
    if (!id || !n) { if (main) showError(main, "No chapter specified."); return; }
    Promise.all([
      loadJSON("/data/" + id + "/book.json"),
      loadEncrypted(id, "/data/" + id + "/ch" + n + ".enc")
    ]).then(function (res) {
      var book = res[0], ch = res[1];
      var subs = ch.subtopics || null;

      // A subtopic-chapter with no ?sub selected → show the subtopic chooser.
      if (subs && subs.length && !sub) { renderSubtopicList(id, n, ch, book); return; }

      // Resolve the study unit: a chosen subtopic, or the chapter itself (no subtopics).
      var unit = ch, subId = null;
      if (subs && subs.length) {
        for (var i = 0; i < subs.length; i++) { if (subs[i].id === sub) { unit = subs[i]; subId = sub; break; } }
        if (subId === null) { if (main) showError(main, "That subtopic doesn't exist."); return; }
      }
      var subParam = subId ? "&sub=" + encodeURIComponent(subId) : "";

      var subSec = document.getElementById("subtopics"); if (subSec) subSec.style.display = "none";
      ["watch", "flashcards", "practice", "rapid"].forEach(function (sid) {
        var s = document.getElementById(sid); if (s) s.style.display = "";
      });

      var back = document.getElementById("backToBook");
      if (back) {
        if (subId) { back.href = "/chapter.html?book=" + encodeURIComponent(id) + "&ch=" + n; back.textContent = "← Subtopics"; }
        else { back.href = "/book.html?book=" + encodeURIComponent(id); }
      }
      setText("brandName", book.name);
      setText("chLabel", (subId ? ch.title : "Chapter " + ch.number) + " · Revision Station");
      setText("chTitle", unit.title || ch.title);
      setText("chEdition", book.edition);
      if (book.tagline) setText("tagline", book.tagline);
      setText("chFoot", "Chapter " + ch.number);
      document.title = "Revision Station — " + (unit.title || ch.title);

      // videos
      var vg = document.getElementById("videoGrid");
      if (vg) {
        vg.innerHTML = "";
        var vids = unit.videos || [];
        if (!vids.length) { vg.appendChild(el("div", "msg", "🎬 Video lessons are coming soon.")); }
        vids.forEach(function (v) {
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
        (unit.decks || []).forEach(function (d) {
          var card = el("div", "card deck");
          card.appendChild(el("h4", null, esc(d.name)));
          card.appendChild(el("div", "cnt", (d.desc ? esc(d.desc) + " · " : "") + d.cards.length + " cards"));
          var a = el("a", "btn", "Open deck →");
          a.href = "/flashcards.html?book=" + encodeURIComponent(id) + "&ch=" + n + subParam + "&deck=" + encodeURIComponent(d.id);
          card.appendChild(a);
          dg.appendChild(card);
        });
      }

      // progress + spaced-repetition coverage under flashcards
      var prog = getUnitProg(id, n, subId);
      if (pruneProgress(prog, unitKeys(unit))) setUnitProg(id, n, subId, prog);
      var cov = coverage(prog, unit);
      var dp = document.getElementById("deckProg");
      if (dp && cov.totalCards) {
        dp.innerHTML = 'Reviewed <b>' + cov.seen + ' / ' + cov.totalCards + '</b> cards (' + cov.pct + '%)' +
          (cov.due ? ' · <b>' + cov.due + '</b> due for review' : '') +
          (prog.starCards.length ? ' · <b>' + prog.starCards.length + '</b> starred' : '');
      }

      // practice MCQs entry
      var qe = document.getElementById("quizEntry");
      if (qe) {
        var count = (unit.mcqs || []).length;
        if (count) {
          var base = "/quiz.html?book=" + encodeURIComponent(id) + "&ch=" + n + subParam;
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
        (unit.notes || []).forEach(function (t) { rl.appendChild(el("li", null, esc(t))); });
      }
    }).catch(function () { if (main) showError(main, "Couldn't load this chapter. Check the link and try again."); });
  }

  /* ---------- FLASHCARDS (with spaced repetition + stars) ---------- */
  function initFlashcards() {
    var id = qp("book"), n = qp("ch"), sub = qp("sub");
    var faceEl = document.getElementById("face");
    if (!id || !n) { if (faceEl) faceEl.textContent = "No chapter specified."; return; }

    loadEncrypted(id, "/data/" + id + "/ch" + n + ".enc").then(function (ch) {
      var subs = ch.subtopics || null, unit = ch, subId = null;
      if (subs && subs.length) {
        for (var si = 0; si < subs.length; si++) { if (subs[si].id === sub) { unit = subs[si]; subId = sub; break; } }
        if (subId === null) { if (faceEl) faceEl.textContent = "That subtopic doesn't exist."; return; }
      }
      var subParam = subId ? "&sub=" + encodeURIComponent(subId) : "";
      var realDecks = unit.decks || [];
      if (!realDecks.length) { faceEl.textContent = "No decks here yet."; return; }
      setText("fcTitle", "Flashcards — " + (unit.title || "Chapter " + ch.number));
      var back = document.getElementById("fcBack");
      if (back) back.href = "/chapter.html?book=" + encodeURIComponent(id) + "&ch=" + n + subParam;

      var p = getUnitProg(id, n, subId);
      var ukeys = unitKeys(unit);          // content-identity keys for this unit
      var lookup = ukeys.cardOf;           // "c<hash>" -> {front, back}
      if (pruneProgress(p, ukeys)) setUnitProg(id, n, subId, p);  // one-time reset of stale keys

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
          list.push({ id: d.id, name: d.name + " (" + d.cards.length + ")", keys: (ukeys.deckKeys[d.id] || []).slice() });
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
        history.replaceState(null, "", "?book=" + encodeURIComponent(id) + "&ch=" + n + subParam +
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
      var animating = false;
      function flip() {
        if (animating || !keys.length) return;
        animating = true; cardEl.classList.add("flip-anim");
        setTimeout(function () { flipped = !flipped; render(); cardEl.classList.remove("flip-anim"); animating = false; }, 160);
      }
      function next() { pos = (pos + 1) % keys.length; flipped = false; render(); }
      function prev() { pos = (pos - 1 + keys.length) % keys.length; flipped = false; render(); }
      function shuffle() { for (var i = keys.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = keys[i]; keys[i] = keys[j]; keys[j] = t; } pos = 0; flipped = false; render(); }
      function rate(r) {
        if (!keys.length) return;
        recordActivity("card");
        rateCard(p, curKey(), r); setUnitProg(id, n, subId, p);
        pos = (pos + 1) % keys.length; flipped = false; buildTabs(); render();
      }
      function toggleStar() { if (!keys.length) return; toggleIn(p.starCards, curKey()); setUnitProg(id, n, subId, p); buildTabs(); render(); }

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
  // Per-subtopic progress nests inside the chapter blob under p.subs[<sub>], so the
  // storage key stays "progress:book:ch" (3 segments) and account sync is unchanged.
  // With no sub (a chapter that has no subtopics) it falls back to the top-level fields.
  function getUnitProg(book, ch, sub) {
    if (!sub) return getProg(book, ch);
    var p = getProg(book, ch);
    p.subs = p.subs || {};
    var u = p.subs[sub] || {};
    u.quiz = u.quiz || null;
    u.cards = u.cards || {};
    u.starCards = u.starCards || [];
    u.starMcqs = u.starMcqs || [];
    u.weakMcqs = u.weakMcqs || [];
    return u;
  }
  function setUnitProg(book, ch, sub, unit) {
    if (!sub) { setProg(book, ch, unit); return; }
    var p = getProg(book, ch);
    p.subs = p.subs || {};
    p.subs[sub] = unit;
    setProg(book, ch, p);
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

  /* ---------- content-identity progress keys ----------
     Progress attaches to a card/MCQ by a stable hash of its IDENTITY TEXT (a card's
     FRONT, an MCQ's QUESTION stem) — NOT its position. So the author can add, insert,
     reorder or delete rows without shifting anyone's SRS/stars/weak-areas, and editing
     an answer/options/explanation keeps progress; only rewriting the prompt itself
     resets that one item. See HOW-TO-UPDATE.md. */
  function hashStr(s) {
    var h = 5381, t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  // Compute stable keys for every card/MCQ in a study unit (chapter or subtopic),
  // disambiguating the rare case of two identical prompts. Returns lookups used by the UI.
  function unitKeys(unit) {
    var cardOf = {}, deckKeys = {}, seen = {};
    (unit.decks || []).forEach(function (d) {
      deckKeys[d.id] = [];
      (d.cards || []).forEach(function (c) {
        var k = "c" + hashStr(c[0]);
        if (seen[k]) { seen[k]++; k += "~" + seen[k]; } else seen[k] = 1;
        deckKeys[d.id].push(k); cardOf[k] = { front: c[0], back: c[1] };
      });
    });
    var mcqKeys = [], seenq = {};
    (unit.mcqs || []).forEach(function (m) {
      var k = "q" + hashStr(m.q);
      if (seenq[k]) { seenq[k]++; k += "~" + seenq[k]; } else seenq[k] = 1;
      mcqKeys.push(k);
    });
    return { cardOf: cardOf, deckKeys: deckKeys, mcqKeys: mcqKeys };
  }
  // Drop progress entries that no longer match any current content key (this is what
  // performs the one-time reset of the older position-based keys). Returns true if it
  // changed anything, so the caller can persist only when needed.
  function pruneProgress(prog, keys) {
    var changed = false, mset = {};
    keys.mcqKeys.forEach(function (k) { mset[k] = 1; });
    Object.keys(prog.cards).forEach(function (k) { if (!keys.cardOf[k]) { delete prog.cards[k]; changed = true; } });
    function keep(arr, ok) { var n = arr.filter(ok); if (n.length !== arr.length) changed = true; return n; }
    prog.starCards = keep(prog.starCards, function (k) { return keys.cardOf[k]; });
    prog.starMcqs = keep(prog.starMcqs, function (k) { return mset[k]; });
    prog.weakMcqs = keep(prog.weakMcqs, function (k) { return mset[k]; });
    return changed;
  }

  // coverage summary for a chapter given its content
  function coverage(p, ch) {
    var totalCards = (ch.decks || []).reduce(function (s, d) { return s + d.cards.length; }, 0);
    var seen = Object.keys(p.cards).length;
    var due = 0;
    Object.keys(p.cards).forEach(function (k) { if (isDue(p.cards[k])) due++; });
    return { totalCards: totalCards, seen: Math.min(seen, totalCards), due: due,
             pct: totalCards ? Math.round(Math.min(seen, totalCards) / totalCards * 100) : 0 };
  }

  /* ---------- streak + daily goal (local, no backend) ---------- */
  var DAILY_CARD_GOAL = 20;
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return {}; } }
  function recordActivity(kind) {
    var t = today();
    var s = lsGet("tr_streak");
    if (s.last !== t) { s.count = (s.last === t - 1) ? (s.count || 0) + 1 : 1; s.last = t; localStorage.setItem("tr_streak", JSON.stringify(s)); }
    var g = lsGet("tr_goal");
    if (g.day !== t) g = { day: t, cards: 0, quizzes: 0 };
    if (kind === "card") g.cards = (g.cards || 0) + 1; else if (kind === "quiz") g.quizzes = (g.quizzes || 0) + 1;
    localStorage.setItem("tr_goal", JSON.stringify(g));
  }
  function streakInfo() {
    var t = today(), s = lsGet("tr_streak"), g = lsGet("tr_goal");
    var count = (s.last === t || s.last === t - 1) ? (s.count || 0) : 0; // streak lapses if a day was missed
    var cards = (g.day === t ? g.cards : 0) || 0, quizzes = (g.day === t ? g.quizzes : 0) || 0;
    var goalMet = quizzes > 0 || cards >= DAILY_CARD_GOAL;
    var goalPct = goalMet ? 100 : Math.min(100, Math.round(cards / DAILY_CARD_GOAL * 100));
    return { count: count, cards: cards, quizzes: quizzes, goalMet: goalMet, goalPct: goalPct };
  }

  /* ---------- small effects: count-up + confetti ---------- */
  function countUp(el, to, ms) {
    if (!el) return; var start = null, from = 0;
    function fmt(v) { var r = Math.round(v * 10) / 10; return (r % 1 === 0) ? String(r) : r.toFixed(1); }
    function step(ts) { if (!start) start = ts; var p = Math.min(1, (ts - start) / ms);
      el.textContent = fmt(from + (to - from) * p) + el.getAttribute("data-suffix");
      if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  function confetti() {
    var c = document.createElement("div"); c.className = "confetti";
    var cols = ["#1F6F8B", "#548235", "#BF8F00", "#7360F2", "#e2574c"];
    for (var i = 0; i < 40; i++) {
      var s = document.createElement("i");
      s.style.left = Math.random() * 100 + "vw";
      s.style.background = cols[i % cols.length];
      s.style.animationDuration = (1.6 + Math.random() * 1.4) + "s";
      s.style.animationDelay = (Math.random() * 0.5) + "s";
      s.style.transform = "rotate(" + (Math.random() * 360) + "deg)";
      c.appendChild(s);
    }
    document.body.appendChild(c);
    setTimeout(function () { c.remove(); }, 3200);
  }

  /* ---------- dark-mode toggle (data-theme already set by the head script) ---------- */
  function initTheme() {
    var wrap = document.querySelector(".topbar .wrap");
    if (!wrap || document.getElementById("tr-theme")) return;
    var btn = document.createElement("button");
    btn.id = "tr-theme"; btn.className = "theme-toggle"; btn.type = "button"; btn.title = "Toggle dark mode";
    function cur() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
    function paint() { btn.textContent = cur() === "dark" ? "☀️" : "🌙"; }
    paint();
    btn.onclick = function () {
      var next = cur() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", next === "dark" ? "#12242c" : "#16323d");
      paint();
    };
    wrap.appendChild(btn);
  }

  /* ---------- feedback + error logging (pilot) ---------- */
  function trFeedback(kind, message) {
    try {
      var c = window.TR && window.TR.client; if (!c) return Promise.resolve({});
      var u = window.TR.user;
      return c.from("feedback").insert({
        user_id: u ? u.id : null, email: u ? u.email : null, kind: kind,
        message: String(message || "").slice(0, 2000),
        page: (location.pathname + location.search).slice(0, 300),
        ua: navigator.userAgent.slice(0, 300)
      });
    } catch (e) { return Promise.resolve({}); }
  }
  var _errCount = 0;
  function logError(msg) { if (_errCount >= 5) return; _errCount++; trFeedback("error", msg).then(function () {}, function () {}); }
  window.addEventListener("error", function (e) { logError((e.message || "error") + " @ " + (e.filename || "") + ":" + (e.lineno || "")); });
  window.addEventListener("unhandledrejection", function (e) { logError("promise: " + ((e.reason && e.reason.message) || e.reason || "")); });

  function initFeedback() {
    if (document.getElementById("tr-fb-btn")) return;
    var btn = document.createElement("button");
    btn.id = "tr-fb-btn"; btn.className = "fb-btn"; btn.type = "button"; btn.textContent = "💬 Feedback";
    btn.onclick = openFeedback;
    document.body.appendChild(btn);
  }
  function openFeedback() {
    if (document.getElementById("tr-fb")) return;
    var ov = document.createElement("div"); ov.id = "tr-fb"; ov.className = "tr-modal";
    ov.innerHTML = '<div class="tr-box"><button class="tr-x" id="fb-x">×</button>' +
      '<h3>Send feedback</h3><p>Found a bug or have a suggestion? Tell us — it helps improve 3R Academy.</p>' +
      '<textarea id="fb-msg" rows="4" placeholder="What happened, or your idea…"></textarea>' +
      '<button id="fb-send" class="tr-primary">Send</button>' +
      '<div id="fb-out" class="tr-msg"></div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); };
    document.getElementById("fb-x").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    var out = document.getElementById("fb-out");
    document.getElementById("fb-send").onclick = function () {
      var m = (document.getElementById("fb-msg").value || "").trim(); if (!m) return;
      this.disabled = true; out.textContent = "Sending…"; out.className = "tr-msg"; var self = this;
      trFeedback("feedback", m).then(function (r) {
        if (r && r.error) { out.textContent = "Couldn't send — please try again."; out.className = "tr-msg err"; self.disabled = false; }
        else { out.textContent = "Thanks! 🙏"; out.className = "tr-msg ok"; setTimeout(close, 900); }
      }, function () { out.textContent = "Couldn't send — please try again."; out.className = "tr-msg err"; self.disabled = false; });
    };
    document.getElementById("fb-msg").focus();
  }

  /* ---------- QUIZ / MCQ mode ---------- */
  function initQuiz() {
    var id = qp("book"), n = qp("ch"), mode = qp("mode"), sub = qp("sub");
    var root = document.getElementById("quizRoot");
    if (!id || !n) { showError(root, "No chapter specified."); return; }
    var LETTERS = ["A", "B", "C", "D", "E"];
    var behavior = mode === "timed" ? "timed" : "study"; // weak/starred run study-style
    var review = (mode === "weak" || mode === "starred") ? mode : null;

    loadEncrypted(id, "/data/" + id + "/ch" + n + ".enc").then(function (ch) {
      var subs = ch.subtopics || null, unit = ch, subId = null;
      if (subs && subs.length) {
        for (var si = 0; si < subs.length; si++) { if (subs[si].id === sub) { unit = subs[si]; subId = sub; break; } }
        if (subId === null) { showError(root, "That subtopic doesn't exist."); return; }
      }
      var subParam = subId ? "&sub=" + encodeURIComponent(subId) : "";
      var mcqs = unit.mcqs || [];
      setText("quizTitle", "Practice MCQs — " + (unit.title || "Chapter " + ch.number));
      var back = document.getElementById("backToChapter");
      if (back) back.href = "/chapter.html?book=" + encodeURIComponent(id) + "&ch=" + n + subParam;
      document.title = "Practice MCQs — " + (unit.title || ch.title);
      var p = getUnitProg(id, n, subId);
      var ukeys = unitKeys(unit), mcqKeys = ukeys.mcqKeys;   // content-identity key per MCQ
      if (pruneProgress(p, ukeys)) setUnitProg(id, n, subId, p);  // one-time reset of stale keys

      function computePool() {
        var all = mcqs.map(function (q, i) { return { q: q, oi: i, key: mcqKeys[i] }; });
        if (mode === "weak") return all.filter(function (it) { return p.weakMcqs.indexOf(it.key) !== -1; });
        if (mode === "starred") return all.filter(function (it) { return p.starMcqs.indexOf(it.key) !== -1; });
        return all;
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
            history.replaceState(null, "", "?book=" + encodeURIComponent(id) + "&ch=" + n + subParam + "&mode=" + mode);
            runQuiz(computePool());
          };
        });
      }

      function runQuiz(pool) {
        var idx = 0, score = 0, answered = false;
        var isTimed = behavior === "timed";
        var answers = pool.map(function () { return -1; });   // selected option index, -1 = unanswered
        var marked = pool.map(function () { return false; });  // timed: "mark for review" flags
        var total = pool.length;
        var NEG_MARK = 0.2;   // timed test: each WRONG answer deducts 0.2 (skipped = no penalty)
        var SECS_PER_Q = 45;  // timed test allots 45 seconds per question
        var secsLeft = total * SECS_PER_Q, timer = null;

        function fmtScore(x) { var r = Math.round(x * 10) / 10; return (r % 1 === 0) ? String(r) : r.toFixed(1); }

        root.innerHTML =
          '<div class="quiz-bar"><span id="qProg"></span>' + (isTimed ? '<span class="timer" id="qTimer"></span>' : '<span></span>') + '</div>' +
          '<div class="progress-track"><span id="qFill"></span></div>' +
          '<div id="qHolder"></div>' +
          (isTimed ? '<div class="qpalette" id="qPalette"></div>' : '');
        var holder = document.getElementById("qHolder");

        if (isTimed) {
          tick();
          timer = setInterval(function () { secsLeft--; if (secsLeft <= 0) { secsLeft = 0; tick(); finish(); } else tick(); }, 1000);
        }
        function tick() {
          var t = document.getElementById("qTimer");
          if (t) { var m = Math.floor(secsLeft / 60), s = secsLeft % 60; t.textContent = "⏱ " + m + ":" + (s < 10 ? "0" : "") + s; }
        }

        function buildPalette() {
          var pal = document.getElementById("qPalette");
          if (!pal) return;
          var h = '<div class="pal-legend"><span class="answered">Answered</span><span class="marked">Marked for review</span><span class="unseen">Skipped</span></div><div class="pal-grid">';
          for (var k = 0; k < total; k++) {
            var cls = "pal-cell" + (k === idx ? " cur" : "") + (answers[k] > -1 ? " answered" : "") + (marked[k] ? " marked" : "");
            h += '<button class="' + cls + '" data-k="' + k + '">' + (k + 1) + (marked[k] ? " ⚑" : "") + '</button>';
          }
          pal.innerHTML = h + '</div>';
          pal.querySelectorAll(".pal-cell").forEach(function (c) {
            c.onclick = function () { idx = parseInt(c.getAttribute("data-k"), 10); render(); };
          });
        }

        render();

        function render() {
          answered = false;
          var q = pool[idx].q, key = pool[idx].key;
          setText("qProg", "Question " + (idx + 1) + " of " + total + (review ? " · " + (review === "weak" ? "weak areas" : "starred") : ""));
          var done = answers.filter(function (a) { return a > -1; }).length;
          var fill = document.getElementById("qFill"); if (fill) fill.style.width = Math.round(done / total * 100) + "%";

          var starred = p.starMcqs.indexOf(key) !== -1;
          var html = '<div class="qcard"><div class="qhead"><p class="qtext">' + esc(q.q) + '</p>' +
                     '<button class="qstar' + (starred ? " on" : "") + '" id="qStar" title="Star this question">' + (starred ? "★" : "☆") + '</button></div><div class="opts">';
          q.options.forEach(function (o, i) {
            var sel = (isTimed && answers[idx] === i) ? " selected" : "";
            html += '<button class="opt' + sel + '" data-i="' + i + '"><span class="lab">' + LETTERS[i] + '</span><span>' + esc(o.text) + '</span></button>' +
                    '<div class="why" data-why="' + i + '">' + esc(o.why) + '</div>';
          });
          html += '</div><div class="qfoot">';
          if (isTimed) {
            html += '<button class="qmark' + (marked[idx] ? " on" : "") + '" id="qMark">' + (marked[idx] ? "⚑ Marked" : "⚑ Mark for review") + '</button>' +
                    '<div class="qnav">' +
                      '<button id="qPrev"' + (idx === 0 ? " disabled" : "") + '>← Prev</button>' +
                      '<button id="qNext"' + (idx === total - 1 ? " disabled" : "") + '>Next →</button>' +
                      '<button id="qFinish">Finish test</button>' +
                    '</div>';
          } else {
            html += '<span class="score" id="qScore"></span><button id="qNext" disabled>' +
                    (idx === total - 1 ? "See results" : "Next →") + '</button>';
          }
          html += '</div></div>';
          holder.innerHTML = html;

          if (!isTimed) setText("qScore", "Score: " + fmtScore(score) + " / " + total);
          holder.querySelectorAll(".opt").forEach(function (btn) {
            btn.onclick = function () { choose(parseInt(btn.getAttribute("data-i"), 10)); };
          });
          document.getElementById("qStar").onclick = function () {
            toggleIn(p.starMcqs, key); setUnitProg(id, n, subId, p); render();
          };
          if (isTimed) {
            document.getElementById("qMark").onclick = function () { marked[idx] = !marked[idx]; render(); };
            document.getElementById("qPrev").onclick = function () { if (idx > 0) { idx--; render(); } };
            document.getElementById("qNext").onclick = function () { if (idx < total - 1) { idx++; render(); } };
            document.getElementById("qFinish").onclick = confirmFinish;
            buildPalette();
          } else {
            document.getElementById("qNext").onclick = advance;
          }
        }

        function choose(i) {
          var q = pool[idx].q, key = pool[idx].key;
          answers[idx] = i;
          if (!isTimed) {
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
            if (correct) { score++; if (review === "weak") { var w = p.weakMcqs.indexOf(key); if (w !== -1) p.weakMcqs.splice(w, 1); } }
            else if (p.weakMcqs.indexOf(key) === -1) { p.weakMcqs.push(key); } // auto-collect weak areas
            setUnitProg(id, n, subId, p);
            setText("qScore", "Score: " + fmtScore(score) + " / " + total);
            document.getElementById("qNext").disabled = false;
          } else {
            // timed: record the choice, no feedback; refresh highlight + palette
            holder.querySelectorAll(".opt").forEach(function (b) { b.classList.remove("selected"); });
            var chosen = holder.querySelector('.opt[data-i="' + i + '"]'); if (chosen) chosen.classList.add("selected");
            var done = answers.filter(function (a) { return a > -1; }).length;
            var fill = document.getElementById("qFill"); if (fill) fill.style.width = Math.round(done / total * 100) + "%";
            buildPalette();
          }
        }

        function advance() { if (idx === total - 1) { finish(); return; } idx++; render(); }  // study-mode linear flow

        function confirmFinish() {
          var un = answers.filter(function (a) { return a === -1; }).length;
          var mk = marked.filter(Boolean).length;
          var parts = [];
          if (un) parts.push(un + " unanswered");
          if (mk) parts.push(mk + " marked for review");
          var msg = parts.length ? "You still have " + parts.join(" and ") + ". Finish the test now?" : "Finish the test and see your score?";
          if (window.confirm(msg)) finish();
        }

        function finish() {
          if (timer) { clearInterval(timer); timer = null; }
          var correctN = 0, wrongN = 0, skippedN = 0;
          if (isTimed) {
            pool.forEach(function (item, k) {
              var chosen = answers[k];
              if (chosen === -1) { skippedN++; return; }          // skipped: no penalty, not "weak"
              if (item.q.options[chosen] && item.q.options[chosen].correct) correctN++;
              else { wrongN++; if (p.weakMcqs.indexOf(item.key) === -1) p.weakMcqs.push(item.key); }
            });
            score = correctN - NEG_MARK * wrongN;   // negative marking
            if (score < 0) score = 0;               // floor at 0
            score = Math.round(score * 100) / 100;
          }
          var prevPct = (p.quiz && typeof p.quiz.lastScore === "number") ? Math.round(p.quiz.lastScore / total * 100) : null;
          // record quiz stats only for full-chapter runs
          if (mode === "study" || mode === "timed") {
            recordActivity("quiz");
            p.quiz = p.quiz || { attempts: 0, best: 0 };
            p.quiz.attempts = (p.quiz.attempts || 0) + 1;
            p.quiz.total = total; p.quiz.lastScore = score;
            p.quiz.best = Math.max(p.quiz.best || 0, score);
          }
          setUnitProg(id, n, subId, p);

          var pct = Math.round(score / total * 100);
          var isTest = ch.kind === "test";
          var backHref = isTest ? "/book.html?book=" + encodeURIComponent(id)
                                : "/chapter.html?book=" + encodeURIComponent(id) + "&ch=" + n + subParam;
          var delta = "";
          if (prevPct !== null && (mode === "study" || mode === "timed")) {
            var d = pct - prevPct;
            delta = '<div class="delta ' + (d >= 0 ? "up" : "down") + '">' + (d >= 0 ? "▲ +" : "▼ ") + Math.abs(d) + "% vs your last attempt</div>";
          }
          var breakdown = isTimed
            ? '<div class="breakdown">' + correctN + ' correct · ' + wrongN + ' wrong (−' + NEG_MARK + ' each) · ' + skippedN + ' skipped</div>'
            : "";
          var html = '<div class="result"><div>Your score</div>' +
                     '<div class="big" id="qBig" data-suffix=" / ' + total + '">0 / ' + total + '</div>' +
                     '<div class="pct">' + pct + '% correct</div>' + breakdown + delta +
                     '<div id="qRank" class="qrank"></div>' +
                     '<div class="actions"><button id="qRetry">Try again</button>' +
                     '<a href="' + backHref + '">' + (isTest ? "Back to book" : "Back to chapter") + '</a></div></div>';
          if (isTimed) {
            html += '<h3 style="margin:26px 0 4px;font-size:18px">Review</h3><div class="review">';
            pool.forEach(function (item, k) {
              var skip = answers[k] === -1 ? ' <span class="w">· skipped</span>' : "";
              html += '<div class="rq"><p class="rqq">' + (k + 1) + '. ' + esc(item.q.q) + skip + '</p>';
              item.q.options.forEach(function (o, j) {
                var cls = o.correct ? "correct" : (j === answers[k] ? "wrong" : "");
                var mk = o.correct ? "✓ " : (j === answers[k] ? "✗ " : "");
                html += '<div class="ro ' + cls + '">' + mk + LETTERS[j] + ". " + esc(o.text) +
                        '<span class="w">' + esc(o.why) + '</span></div>'; // show every option's rationale
              });
              html += '</div>';
            });
            html += '</div>';
          }
          root.innerHTML = html;
          countUp(document.getElementById("qBig"), score, 600);
          if (pct >= 80) confetti();
          var retry = document.getElementById("qRetry");
          if (retry) retry.onclick = function () { var np = computePool(); if (np.length) runQuiz(np); else initQuiz(); };
          if (mode === "timed") showRanking();
        }

        // Submit the timed score and show the caller's percentile (chapters=recent, tests=first attempt).
        function showRanking() {
          var rankEl = document.getElementById("qRank");
          if (!rankEl) return;
          if (!(window.TR && window.TR.session && window.TR.client)) {
            rankEl.innerHTML = '<a href="#" id="qRankSignin">Sign in to see how you rank</a>';
            var s = document.getElementById("qRankSignin");
            if (s) s.onclick = function (e) { e.preventDefault(); if (window.TR.openSignIn) window.TR.openSignIn(); };
            return;
          }
          rankEl.textContent = "Checking your ranking…";
          var kind = ch.kind === "test" ? "test" : "chapter", chNum = parseInt(n, 10), subKey = subId || "";
          window.TR.client.rpc("submit_score", { p_book: id, p_chapter: chNum, p_subtopic: subKey, p_kind: kind, p_score: score, p_total: total })
            .then(function () { return window.TR.client.rpc("chapter_percentile", { p_book: id, p_chapter: chNum, p_subtopic: subKey }); })
            .then(function (res) {
              var d = res && res.data;
              if (!d || !d.signedIn) { rankEl.style.display = "none"; return; }
              if (d.enough) {
                rankEl.innerHTML = "🎯 You're ahead of <b>" + d.percentile + "%</b> of " + d.count + " candidates" +
                  (kind === "test" ? ' <span class="muted">(first attempt)</span>' : "") + ".";
              } else {
                rankEl.innerHTML = 'Your ranking unlocks once <b>20</b> candidates have taken this — <b>' + (d.count || 0) + "</b> so far.";
              }
            })
            .catch(function () { rankEl.style.display = "none"; });
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
    initTheme();
    initFeedback();
    wireViber();
    // "Get free access" becomes the sign-up entry (falls back to the form link if auth unavailable)
    document.querySelectorAll(".btn-get").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (window.TR && window.TR.openSignIn) { e.preventDefault(); window.TR.openSignIn(); }
      });
    });
    renderPage();
  });
  // re-render when account data (unlock codes / progress) syncs in after sign-in
  window.addEventListener("tr-synced", renderPage);
})();
