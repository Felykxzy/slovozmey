const assert = require("assert"), SZ = require("../core.js");
function seeded(s) { return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }
function mk(lang) { return SZ.createGame({ w: 13, h: 19, lang: lang || "ru", rng: seeded(7) }); }
// 1. старт: змея из 3 клеток, нужная буква на поле
let g = mk(); assert.strictEqual(g.snake.length, 3); assert.ok(g.tiles.some(t => t.ch === g.word[0]), "нужная буква есть");
assert.ok(g.tiles.length >= 5);
// 2. нельзя развернуться назад, лишний поворот в очередь не лезет
assert.strictEqual(SZ.turn(g, -1, 0), false); assert.strictEqual(SZ.turn(g, 0, 1), true);
assert.strictEqual(SZ.turn(g, 0, -1), false); // назад относительно последнего поворота
// 3. переход через край
g = mk(); g.snake = [{ x: 12, y: 5 }, { x: 11, y: 5 }, { x: 10, y: 5 }]; g.tiles = []; g.dir = { x: 1, y: 0 }; SZ.step(g);
assert.strictEqual(g.snake[0].x, 0, "выход за край справа");
// 4. съесть нужную букву: растём, очки, индекс
g = mk(); const need = g.word[0]; g.snake = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }]; g.tiles = [{ x: 5, y: 4, ch: need }]; g.dir = { x: 1, y: 0 };
SZ.step(g); assert.strictEqual(g.idx, 1); assert.ok(g.score > 0); assert.strictEqual(g.snake.length, 3); SZ.step(g); assert.strictEqual(g.snake.length, 4, "выросла");
// 5. неверная буква: минус жизнь, комбо сброшено
g = mk(); g.snake = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }]; g.dir = { x: 1, y: 0 };
const wrong = g.word[0] === "Я" ? "А" : "Я"; g.tiles = [{ x: 5, y: 4, ch: wrong }]; g.combo = 3; SZ.step(g);
assert.strictEqual(g.lives, 2); assert.strictEqual(g.combo, 0); assert.ok(g.events.includes("wrong"));
// 6. столкновение с собой: жизнь минус, змея сбрасывается
g = mk(); g.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 4 }, { x: 5, y: 4 }]; g.dir = { x: 1, y: 0 }; g.tiles = [];
SZ.step(g); assert.strictEqual(g.lives, 2); assert.strictEqual(g.snake.length, 3); assert.ok(g.events.includes("crash"));
// 7. слово собрано целиком: очки, новое слово, уровень растёт
g = mk(); const w = g.word; for (let i = 0; i < w.length; i++) {
  g.snake = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }]; g.dir = { x: 1, y: 0 }; g.queue = []; g.tiles = [{ x: 5, y: 4, ch: w[i] }]; SZ.step(g);
}
assert.strictEqual(g.done, 1); assert.ok(g.events.includes("word")); assert.notStrictEqual(g.word, w); assert.strictEqual(g.idx, 0);
// 8. игра заканчивается на нуле жизней и дальше не двигается
g = mk(); g.lives = 1; g.snake = [{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 2, y: 4 }]; g.dir = { x: 1, y: 0 }; g.tiles = [{ x: 5, y: 4, ch: g.word[0] === "Я" ? "А" : "Я" }];
SZ.step(g); assert.ok(g.over); const before = JSON.stringify(g.snake); SZ.step(g); assert.strictEqual(JSON.stringify(g.snake), before);
// 9. слова в словарях состоят только из букв своего алфавита; скорость растёт, но не быстрее предела
for (const l of ["ru", "uk", "en"]) for (const x of SZ.WORDS[l]) for (const ch of x) assert.ok(SZ.ALPHA[l].includes(ch), l + " " + x + " " + ch);
assert.ok(SZ.speedMs(1) > SZ.speedMs(10)); assert.strictEqual(SZ.speedMs(99), 75);
// 10. долгая игра на автопилоте не падает и не оставляет поле без нужной буквы
g = mk("en"); const r = seeded(3); for (let i = 0; i < 4000 && !g.over; i++) { if (r() < .2) SZ.turn(g, [[1,0],[-1,0],[0,1],[0,-1]][(r()*4)|0][0], 0); SZ.step(g); if (!g.over) assert.ok(g.tiles.some(t => t.ch === g.word[g.idx]), "нужная буква есть всегда"); }
console.log("core: все проверки прошли");
