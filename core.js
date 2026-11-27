/* Словозмей: чистая логика игры, без экрана. Проверяется тестами в tests/ */
(function (root) {
  "use strict";
  var WORDS = {
    ru: "КОТ ДОМ ЛЕС МОРЕ РЕКА ЛУНА СНЕГ ВЕТЕР ЗВЕЗДА ДРАКОН ГОРА ПЕСНЯ ОГОНЬ ЗМЕЯ ТРАВА ОБЛАКО КОМЕТА ПЛАНЕТА КАРТА РАКЕТА ШТОРМ ПОЛЕ ВОЛНА ЛЕТО ЗИМА ВЕСНА ОСЕНЬ ПТИЦА РЫБА ЛИСА ВОЛК МЕДВЕДЬ КЛЮЧ МОСТ ЗАМОК ЦВЕТОК РАДУГА МАЯК ПАРУС ОСТРОВ".split(" "),
    uk: "КІТ ДІМ ЛІС МОРЕ РІКА МІСЯЦЬ СНІГ ВІТЕР ЗІРКА ДРАКОН ГОРА ПІСНЯ ВОГОНЬ ЗМІЯ ТРАВА ХМАРА КОМЕТА ПЛАНЕТА КАРТА РАКЕТА ШТОРМ ПОЛЕ ХВИЛЯ ЛІТО ЗИМА ВЕСНА ОСІНЬ ПТАХ РИБА ЛИСА ВОВК ВЕДМІДЬ КЛЮЧ МІСТ ЗАМОК КВІТКА ВЕСЕЛКА МАЯК ВІТРИЛО ОСТРІВ".split(" "),
    en: "CAT SUN SEA MOON STAR WIND SNOW RAIN FIRE TREE LEAF BIRD FISH WOLF BEAR PLANET ROCKET DRAGON SNAKE CLOUD STORM RIVER OCEAN FOREST ISLAND RAINBOW COMET GALAXY LANTERN BRIDGE CASTLE FLOWER SUMMER WINTER SPRING AUTUMN THUNDER MOUNTAIN".split(" ")
  };
  var ALPHA = {
    ru: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЬЭЮЯ".split(""),
    uk: "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ".split(""),
    en: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
  };
  var LIVES = 3, START_LEN = 3, DECOYS = 4;

  function speedMs(level) { return Math.max(75, 190 - level * 7); }

  function createGame(o) {
    var rng = o.rng || Math.random, lang = o.lang || "ru";
    var g = {
      w: o.w, h: o.h, lang: lang, rng: rng, words: WORDS[lang], alpha: ALPHA[lang],
      lives: LIVES, score: 0, level: 1, done: 0, combo: 0, over: false,
      word: "", idx: 0, prev: "", tiles: [], grow: 0, dir: { x: 1, y: 0 }, queue: [], events: [], snake: []
    };
    resetSnake(g); nextWord(g); fill(g);
    return g;
  }

  function resetSnake(g) {
    var cy = g.h >> 1, cx = Math.max(START_LEN, g.w >> 1);
    g.snake = [];
    for (var i = 0; i < START_LEN; i++) g.snake.push({ x: cx - i, y: cy });
    g.dir = { x: 1, y: 0 }; g.queue = []; g.grow = 0;
    // убрать буквы, оказавшиеся под змеёй
    g.tiles = g.tiles.filter(function (t) { return !onSnake(g, t.x, t.y); });
  }

  function onSnake(g, x, y) {
    for (var i = 0; i < g.snake.length; i++) if (g.snake[i].x === x && g.snake[i].y === y) return true;
    return false;
  }
  function tileAt(g, x, y) {
    for (var i = 0; i < g.tiles.length; i++) if (g.tiles[i].x === x && g.tiles[i].y === y) return i;
    return -1;
  }
  function freeCell(g) {
    for (var n = 0; n < 200; n++) {
      var x = (g.rng() * g.w) | 0, y = (g.rng() * g.h) | 0;
      if (!onSnake(g, x, y) && tileAt(g, x, y) < 0) return { x: x, y: y };
    }
    return null;
  }
  function pickWord(g) {
    var maxLen = Math.min(9, 3 + Math.ceil(g.level / 2) + 1);
    var pool = g.words.filter(function (w) { return w.length <= maxLen && w !== g.prev; });
    if (!pool.length) pool = g.words;
    return pool[(g.rng() * pool.length) | 0];
  }
  // Можно собрать своё слово: если съеденная буква не из задуманного слова,
  // но подходит другому слову той же длины (с теми же первыми буквами), играем его
  function findAlt(g, ch) {
    var pre = g.word.slice(0, g.idx) + ch, n = g.word.length, seen = {}, pool = [];
    g.words.forEach(function (w) {
      if (w.length === n && w !== g.word && w.indexOf(pre) === 0 && !seen[w]) { seen[w] = 1; pool.push(w); }
    });
    return pool.length ? pool[(g.rng() * pool.length) | 0] : null;
  }
  function nextWord(g) { g.prev = g.word; g.word = pickWord(g); g.idx = 0; }

  function randLetter(g) {
    // чаще берём буквы из текущего слова, чтобы выбор был непростым
    if (g.rng() < 0.4) return g.word[(g.rng() * g.word.length) | 0];
    return g.alpha[(g.rng() * g.alpha.length) | 0];
  }
  // Держим на поле нужную букву и несколько лишних
  function fill(g) {
    var need = g.word[g.idx], has = false, i;
    for (i = 0; i < g.tiles.length; i++) if (g.tiles[i].ch === need) has = true;
    var c;
    if (!has && (c = freeCell(g))) g.tiles.push({ x: c.x, y: c.y, ch: need });
    while (g.tiles.length < DECOYS + 1 && (c = freeCell(g))) g.tiles.push({ x: c.x, y: c.y, ch: randLetter(g) });
  }

  function turn(g, dx, dy) {
    var last = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
    if (dx === -last.x && dy === -last.y) return false;   // назад нельзя
    if (dx === last.x && dy === last.y) return false;
    if (g.queue.length >= 2) return false;
    g.queue.push({ x: dx, y: dy });
    return true;
  }

  function loseLife(g, why) {
    g.lives--; g.combo = 0; g.events.push(why);
    if (g.lives <= 0) { g.over = true; g.events.push("over"); }
  }

  function step(g) {
    if (g.over) return;
    if (g.queue.length) g.dir = g.queue.shift();
    var h = g.snake[0];
    var nx = (h.x + g.dir.x + g.w) % g.w, ny = (h.y + g.dir.y + g.h) % g.h;
    // хвост освобождается, если змея не растёт
    var body = g.grow > 0 ? g.snake : g.snake.slice(0, -1);
    for (var i = 0; i < body.length; i++) {
      if (body[i].x === nx && body[i].y === ny) {
        loseLife(g, "crash");
        if (!g.over) { resetSnake(g); fill(g); }
        return;
      }
    }
    g.snake.unshift({ x: nx, y: ny });
    if (g.grow > 0) g.grow--; else g.snake.pop();
    var ti = tileAt(g, nx, ny);
    if (ti < 0) return;
    var t = g.tiles.splice(ti, 1)[0];
    var alt = null;
    if (t.ch !== g.word[g.idx]) alt = findAlt(g, t.ch);
    if (alt) { g.word = alt; g.events.push("switch"); }
    if (t.ch === g.word[g.idx]) {
      g.idx++; g.combo++; g.grow++;
      g.score += 10 + Math.min(g.combo, 10) * 2;
      g.events.push("eat");
      if (g.idx >= g.word.length) {
        g.score += g.word.length * 15; g.done++; g.level = 1 + ((g.done / 2) | 0);
        g.events.push("word");
        g.lastWord = g.word;
        nextWord(g);
      }
    } else {
      loseLife(g, "wrong");
    }
    if (!g.over) fill(g);
  }

  var api = { createGame: createGame, step: step, turn: turn, speedMs: speedMs, WORDS: WORDS, ALPHA: ALPHA, LIVES: LIVES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SZ = api;
})(typeof window !== "undefined" ? window : this);
