(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var VER = "1.0.0", COLS = 13;
  var T = {
    ru: { score: "ОЧКИ", lives: "ЖИЗНИ", tag: "Ешь буквы по порядку и собирай слова", play: "ИГРАТЬ", how: "Как играть", ok: "ПОНЯТНО", over: "КОНЕЦ ИГРЫ", again: "ЕЩЁ РАЗ", menu: "В меню", pause: "ПАУЗА", resume: "ПРОДОЛЖИТЬ",
      best: "Рекорд: ", words: function (n) { return "слов собрано: " + n; }, newBest: "Новый рекорд!",
      rules: ["Сверху показано слово. Веди змею и ешь его буквы по порядку.", "Управление: свайп по полю или стрелки на клавиатуре. Назад поворачивать нельзя.", "Неверная буква или столкновение с собой отнимает жизнь. Жизней три.", "Края поля проходные: выйдешь справа, появишься слева.", "Чем больше слов подряд без ошибок, тем больше очков."] },
    uk: { score: "ОЧКИ", lives: "ЖИТТЯ", tag: "Їж літери по порядку й збирай слова", play: "ГРАТИ", how: "Як грати", ok: "ЗРОЗУМІЛО", over: "КІНЕЦЬ ГРИ", again: "ЩЕ РАЗ", menu: "У меню", pause: "ПАУЗА", resume: "ПРОДОВЖИТИ",
      best: "Рекорд: ", words: function (n) { return "слів зібрано: " + n; }, newBest: "Новий рекорд!",
      rules: ["Угорі показано слово. Веди змію й їж його літери по порядку.", "Керування: свайп по полю або стрілки на клавіатурі. Назад повертати не можна.", "Хибна літера або зіткнення з собою забирає життя. Життів три.", "Краї поля прохідні: вийдеш праворуч, з’явишся ліворуч.", "Чим більше слів поспіль без помилок, тим більше очок."] },
    en: { score: "SCORE", lives: "LIVES", tag: "Eat the letters in order to spell words", play: "PLAY", how: "How to play", ok: "GOT IT", over: "GAME OVER", again: "AGAIN", menu: "Menu", pause: "PAUSED", resume: "RESUME",
      best: "Best: ", words: function (n) { return "words spelled: " + n; }, newBest: "New best!",
      rules: ["The word is shown at the top. Steer the snake and eat its letters in order.", "Controls: swipe on the board or use the arrow keys. You cannot turn back on yourself.", "A wrong letter or bumping into yourself costs a life. You have three.", "The edges wrap around: leave on the right, appear on the left.", "The more words in a row without mistakes, the more points."] }
  };
  var lang = "ru", G = null, raf = 0, last = 0, acc = 0, state = "menu", flash = 0, shake = 0, pops = [];
  var cv = $("cv"), ctx = cv.getContext("2d"), cell = 20, rows = 19, dpr = 1;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function best() { return +store("best_" + lang) || 0; }
  function tr() { return T[lang]; }

  /* ---------- звук и вибрация ---------- */
  var ac = null;
  function tone(f, d, type, vol, slide) {
    if (store("mute") === "1") return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume();
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      g.gain.setValueAtTime(vol || .08, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .02);
    } catch (e) { }
  }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }
  var sfx = {
    eat: function (c) { tone(520 + Math.min(c, 10) * 40, .09, "triangle", .07); },
    word: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, .16, "triangle", .08); }, i * 80); }); },
    wrong: function () { tone(220, .22, "sawtooth", .07, 90); buzz(40); },
    crash: function () { tone(160, .3, "square", .06, 60); buzz([30, 40, 30]); },
    over: function () { [392, 330, 262, 196].forEach(function (f, i) { setTimeout(function () { tone(f, .22, "triangle", .08); }, i * 140); }); buzz(120); }
  };

  /* ---------- язык и тексты ---------- */
  function setLang(l) {
    lang = l; document.documentElement.lang = l; store("lang", l);
    var t = tr();
    $("tScore").textContent = t.score; $("tLives").textContent = t.lives; $("tag").textContent = t.tag; $("play").textContent = t.play;
    $("howB").textContent = t.how; $("howT").textContent = t.how; $("howOk").textContent = t.ok; $("overT").textContent = t.over; $("again").textContent = t.again;
    $("toMenu").textContent = t.menu; $("quit").textContent = t.menu; $("pauseT").textContent = t.pause; $("resume").textContent = t.resume;
    $("howL").innerHTML = ""; t.rules.forEach(function (r) { var li = document.createElement("li"); li.textContent = r; $("howL").appendChild(li); });
    $("best").textContent = best() ? t.best + best() : "";
    Array.prototype.forEach.call($("langs").children, function (b) { b.classList.toggle("on", b.dataset.l === l); });
  }

  /* ---------- размеры поля ---------- */
  function layout() {
    var st = $("stage"), r = st.getBoundingClientRect(), pw = Math.max(200, r.width - 16), ph = Math.max(200, r.height - 68);
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cell = Math.floor(pw / COLS); rows = Math.max(9, Math.floor(ph / cell));
    var cw = cell * COLS, ch = cell * rows;
    cv.style.width = cw + "px"; cv.style.height = ch + "px"; cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- HUD ---------- */
  function hud() {
    $("score").textContent = G.score;
    var h = ""; for (var i = 0; i < SZ.LIVES; i++) h += i < G.lives ? "♥" : "·"; $("lives").textContent = h;
    var w = $("word"), s = "";
    for (var k = 0; k < G.word.length; k++) s += '<i class="' + (k < G.idx ? "on" : k === G.idx ? "nx" : "") + '">' + (k < G.idx ? G.word[k] : k === G.idx ? "?" : "") + "</i>";
    w.innerHTML = s;
  }

  /* ---------- рисование ---------- */
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function draw(now) {
    var W = cell * COLS, H = cell * rows, c = ctx;
    c.save();
    if (shake > 0) c.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    c.clearRect(-10, -10, W + 20, H + 20);
    // фон: тёмная клетка с точками
    c.fillStyle = "#0d1a1c"; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(124,255,178,.07)";
    for (var x = 0; x < COLS; x++) for (var y = 0; y < rows; y++) { c.beginPath(); c.arc((x + .5) * cell, (y + .5) * cell, cell * .06, 0, 6.3); c.fill(); }
    if (G) {
      // буквы
      var pulse = .5 + .5 * Math.sin(now / 260);
      G.tiles.forEach(function (t) {
        var px = t.x * cell + cell * .08, py = t.y * cell + cell * .08, s = cell * .84;
        c.fillStyle = "rgba(0,0,0,.35)"; rr(px, py + cell * .05, s, s, cell * .2); c.fill();
        var g = c.createLinearGradient(px, py, px, py + s); g.addColorStop(0, "#fff6d2"); g.addColorStop(1, "#e8cf86");
        c.fillStyle = g; rr(px, py, s, s, cell * .2); c.fill();
        c.fillStyle = "#3a2a00"; c.font = "800 " + Math.floor(cell * .56) + "px system-ui,sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(t.ch, px + s / 2, py + s / 2 + cell * .03);
      });
      // змея: от хвоста к голове
      var n = G.snake.length;
      for (var i = n - 1; i >= 0; i--) {
        var sg = G.snake[i], k = i / Math.max(1, n - 1), sx = sg.x * cell + cell * .06, sy = sg.y * cell + cell * .06, ss = cell * .88;
        var r = Math.round(124 - 99 * k), gg = Math.round(255 - 70 * k), b = Math.round(178 - 12 * k);
        c.fillStyle = i === 0 ? "#9bffc6" : "rgb(" + r + "," + gg + "," + b + ")";
        rr(sx, sy, ss, ss, cell * (i === 0 ? .34 : .28)); c.fill();
        if (i > 0 && i <= G.idx) { // собранные буквы едут по телу
          c.fillStyle = "#052018"; c.font = "800 " + Math.floor(cell * .5) + "px system-ui,sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
          c.fillText(G.word[G.idx - i], sx + ss / 2, sy + ss / 2 + cell * .03);
        }
      }
      // глаза
      var h = G.snake[0], d = G.dir, cx = h.x * cell + cell / 2, cy = h.y * cell + cell / 2, ex = d.x * cell * .16, ey = d.y * cell * .16, px2 = -d.y * cell * .17, py2 = d.x * cell * .17;
      c.fillStyle = "#052018";
      [-1, 1].forEach(function (sd) { c.beginPath(); c.arc(cx + ex + px2 * sd, cy + ey + py2 * sd, cell * .075, 0, 6.3); c.fill(); });
      // всплывающие очки
      pops = pops.filter(function (p) { return now - p.t < 700; });
      pops.forEach(function (p) {
        var a = 1 - (now - p.t) / 700; c.globalAlpha = a; c.fillStyle = p.col; c.font = "800 " + Math.floor(cell * .6) + "px system-ui,sans-serif"; c.textAlign = "center";
        c.fillText(p.txt, p.x * cell + cell / 2, p.y * cell - (1 - a) * cell * 1.2); c.globalAlpha = 1;
      });
    }
    if (flash > 0) { c.fillStyle = "rgba(255,92,108," + flash * .35 + ")"; c.fillRect(0, 0, W, H); }
    c.restore();
  }

  /* ---------- цикл ---------- */
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (state === "play") {
      var dt = Math.min(100, now - last); acc += dt;
      var ms = SZ.speedMs(G.level);
      while (acc >= ms && state === "play") { acc -= ms; tick(now); }
    }
    last = now; flash = Math.max(0, flash - .05); shake = Math.max(0, shake - .6);
    draw(now);
  }
  function tick(now) {
    G.events.length = 0; SZ.step(G);
    var head = G.snake[0];
    G.events.forEach(function (e) {
      if (e === "eat") { sfx.eat(G.combo); pops.push({ t: now, x: head.x, y: head.y, txt: "+" + (10 + Math.min(G.combo, 10) * 2), col: "#7cffb2" }); }
      else if (e === "word") { sfx.word(); pops.push({ t: now, x: Math.min(COLS - 3, Math.max(2, head.x)), y: Math.max(2, head.y - 1), txt: G.lastWord + "!", col: "#ffd35c" }); }
      else if (e === "wrong") { sfx.wrong(); flash = 1; shake = 8; }
      else if (e === "crash") { sfx.crash(); flash = 1; shake = 12; }
      else if (e === "over") { finish(); }
    });
    hud();
  }

  function show(id) { ["menu", "how", "over", "paused"].forEach(function (p) { $(p).hidden = p !== id; }); }
  function start() {
    show(null); $("hud").hidden = false; $("pause").hidden = false; layout();
    G = SZ.createGame({ w: COLS, h: rows, lang: lang }); pops = []; acc = 0; flash = 0; shake = 0;
    state = "play"; hud(); last = performance.now();
  }
  function finish() {
    state = "over"; sfx.over(); $("pause").hidden = true;
    var t = tr(), nb = G.score > best(); if (nb) store("best_" + lang, G.score);
    $("oScore").textContent = G.score; $("oWords").textContent = t.words(G.done); $("oBest").textContent = nb ? "★ " + t.newBest : t.best + best();
    setTimeout(function () { show("over"); }, 650);
  }
  function toMenu() { state = "menu"; $("hud").hidden = true; $("pause").hidden = true; setLang(lang); show("menu"); }
  function pause() { if (state !== "play") return; state = "pause"; show("paused"); }
  function resume() { if (state !== "pause") return; show(null); state = "play"; acc = 0; last = performance.now(); }

  /* ---------- управление ---------- */
  var DIRS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  window.addEventListener("keydown", function (e) {
    var d = DIRS[e.code];
    if (d && state === "play") { e.preventDefault(); SZ.turn(G, d[0], d[1]); return; }
    if (e.code === "Space" || e.code === "Escape" || e.code === "KeyP") { e.preventDefault(); if (state === "play") pause(); else if (state === "pause") resume(); }
    if (e.code === "Enter" && (state === "menu" && !$("menu").hidden)) start();
  });
  var tx = 0, ty = 0, tOn = false;
  cv.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; tOn = true; e.preventDefault(); }, { passive: false });
  cv.addEventListener("touchmove", function (e) {
    e.preventDefault(); if (!tOn || state !== "play") return;
    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty, m = Math.max(18, cell * .9);
    if (Math.abs(dx) < m && Math.abs(dy) < m) return;
    if (Math.abs(dx) > Math.abs(dy)) SZ.turn(G, dx > 0 ? 1 : -1, 0); else SZ.turn(G, 0, dy > 0 ? 1 : -1);
    tx = t.clientX; ty = t.clientY;
  }, { passive: false });
  cv.addEventListener("touchend", function () { tOn = false; });
  // мышь: перетаскивание, чтобы можно было играть и на компьютере без клавиатуры
  var md = false;
  cv.addEventListener("mousedown", function (e) { md = true; tx = e.clientX; ty = e.clientY; });
  window.addEventListener("mouseup", function () { md = false; });
  window.addEventListener("mousemove", function (e) {
    if (!md || state !== "play") return; var dx = e.clientX - tx, dy = e.clientY - ty, m = Math.max(18, cell * .9);
    if (Math.abs(dx) < m && Math.abs(dy) < m) return;
    if (Math.abs(dx) > Math.abs(dy)) SZ.turn(G, dx > 0 ? 1 : -1, 0); else SZ.turn(G, 0, dy > 0 ? 1 : -1);
    tx = e.clientX; ty = e.clientY;
  });

  $("play").onclick = start; $("again").onclick = start; $("toMenu").onclick = toMenu; $("quit").onclick = toMenu;
  $("pause").onclick = pause; $("resume").onclick = resume;
  $("howB").onclick = function () { show("how"); }; $("howOk").onclick = function () { show("menu"); };
  Array.prototype.forEach.call($("langs").children, function (b) { b.onclick = function () { setLang(b.dataset.l); }; });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });
  window.addEventListener("resize", function () { if (state === "menu") layout(); });
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
  document.addEventListener("dblclick", function (e) { e.preventDefault(); });

  /* ---------- запуск ---------- */
  var sv = store("lang"); if (sv && T[sv]) lang = sv; else { var nl = (navigator.language || "ru").slice(0, 2); if (T[nl]) lang = nl; }
  setLang(lang); layout(); show("menu"); raf = requestAnimationFrame(loop);
  window.__sz = { start: start, get G() { return G; }, get state() { return state; }, VER: VER };
  if ("serviceWorker" in navigator && /^http/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(function () { });
})();
