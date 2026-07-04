/* ============================================================
   gate.js — per-book unlock via content DEcryption.
   Include on any gated page (chapter.html, flashcards.html, quiz.html):
       <script src="/gate.js"></script>
   The page carries ?book=<id>. Book content is served ENCRYPTED
   (AES-256-GCM, key = PBKDF2 of the access code). The code is validated
   by actually decrypting the book's unlock.enc marker — so a wrong code
   is rejected and, crucially, the content itself is unreadable without a
   valid code (the served .enc files are ciphertext). The entered code is
   stored on-device so app.js can decrypt content on later visits.
   ============================================================ */
(function () {
  var FORM_URL = "https://forms.gle/f8mLCm8AzpxLduTV6";
  var BUY_URL = "#";

  var book = new URLSearchParams(location.search).get("book");
  if (!book) return;

  function norm(s) { return (s || "").toUpperCase().replace(/[\s-]/g, ""); }
  function b64d(s) { var bin = atob(s), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function codes() { try { return JSON.parse(localStorage.getItem("3r_keys") || "{}"); } catch (e) { return {}; } }

  if (codes()[book]) return; // we already hold a code for this book

  document.documentElement.style.overflow = "hidden";

  fetch("/data/books.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (books) {
      var b = null;
      for (var i = 0; i < books.length; i++) { if (books[i].id === book) { b = books[i]; break; } }
      if (!b || !b.salt) { document.documentElement.style.overflow = ""; return; } // nothing to unlock
      showGate(b);
    })
    .catch(function () { document.documentElement.style.overflow = ""; });

  // Derive the AES key from (code, salt) and try to decrypt unlock.enc.
  function tryUnlock(code, saltB64) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(norm(code)), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: b64d(saltB64), iterations: 200000, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      })
      .then(function (key) {
        return fetch("/data/" + book + "/unlock.enc", { cache: "no-cache" })
          .then(function (r) { return r.json(); })
          .then(function (m) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(m.iv) }, key, b64d(m.ct)); });
      }); // rejects if the code (key) is wrong — GCM auth tag fails
  }

  function showGate(b) {
    var css = ''
      + '#__gate{position:fixed;inset:0;z-index:99999;background:#16323d;color:#fff;'
      + 'display:flex;align-items:center;justify-content:center;padding:20px;'
      + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}'
      + '#__gate .box{background:#fff;color:#23303a;max-width:440px;width:100%;border-radius:16px;'
      + 'padding:28px 26px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.3)}'
      + '#__gate .threeR{display:inline-flex;border-radius:999px;overflow:hidden;font-weight:700;font-size:12px;margin-bottom:14px}'
      + '#__gate .threeR span{padding:5px 12px;color:#fff}'
      + '#__gate h2{margin:0 0 6px;font-size:20px}'
      + '#__gate p{margin:0 0 16px;color:#6b7a85;font-size:14px}'
      + '#__gate input{width:100%;padding:13px 14px;border:1px solid #d7dee2;border-radius:10px;font-size:16px;text-align:center;letter-spacing:1px}'
      + '#__gate button{width:100%;margin-top:12px;background:#548235;color:#fff;border:0;border-radius:10px;'
      + 'padding:13px;font-size:15px;font-weight:700;cursor:pointer}'
      + '#__gate button:disabled{opacity:.6;cursor:default}'
      + '#__gerr{display:none;color:#a3271f;font-size:13px;margin-top:10px}'
      + '#__gate .alt{margin-top:18px;padding-top:16px;border-top:1px solid #eef2f4;font-size:13px;color:#6b7a85}'
      + '#__gate .alt a{color:#1F6F8B;font-weight:600;text-decoration:none}';
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

    var name = b && b.name ? b.name : "your book";
    var ov = document.createElement("div");
    ov.id = "__gate";
    ov.innerHTML =
      '<div class="box">'
      + '<div class="threeR"><span style="background:#1F6F8B">Read</span><span style="background:#548235">Recall</span><span style="background:#BF8F00">Rank</span></div>'
      + '<h2>Unlock your resources</h2>'
      + '<p>Enter the access code printed inside <strong>' + name + '</strong> to open the chapters, flashcards and MCQs.</p>'
      + '<input id="__gcode" type="text" placeholder="Access code" autocomplete="off" autocapitalize="characters">'
      + '<button id="__gbtn">Unlock</button>'
      + '<div id="__gerr">That code didn’t match. Check the code printed in your book and try again.</div>'
      + '<div class="alt">Don’t have the book yet? <a href="' + BUY_URL + '">Get the book</a><br>'
      + 'Just want updates? <a href="' + FORM_URL + '" target="_blank" rel="noopener">Sign up here</a></div>'
      + '</div>';
    document.body.appendChild(ov);

    var input = document.getElementById("__gcode");
    var btn = document.getElementById("__gbtn");
    var errEl = document.getElementById("__gerr");

    function unlock() {
      var v = input.value;
      if (!v) return;
      btn.disabled = true; errEl.style.display = "none";
      tryUnlock(v, b.salt).then(function () {
        var c = codes(); c[book] = v; localStorage.setItem("3r_keys", JSON.stringify(c));
        location.reload(); // reload so app.js renders the now-decryptable content
      }).catch(function () {
        errEl.style.display = "block"; btn.disabled = false;
      });
    }
    btn.addEventListener("click", unlock);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") unlock(); });
    input.focus();
  }
})();
