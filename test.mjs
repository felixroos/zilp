// run with "node test.mjs"
import assert from "node:assert";
import { ZilpParser, Zilp } from "./zilp.mjs";

const parser = new ZilpParser();

assert.deepEqual(parser.tokenize(""), []);
assert.deepEqual(parser.tokenize("("), [{ type: "open_list", value: "(" }]);
assert.deepEqual(parser.tokenize(")"), [{ type: "close_list", value: ")" }]);
assert.deepEqual(parser.tokenize(">"), [{ type: "pipe", value: ">" }]);
assert.deepEqual(parser.tokenize("x:"), [{ type: "set_var", value: "x:" }]);
assert.deepEqual(parser.tokenize("10"), [{ type: "number", value: "10" }]);
assert.deepEqual(parser.tokenize("foo"), [{ type: "word", value: "foo" }]);

assert.deepEqual(parser.tokenize("(foo bar)"), [
  { type: "open_list", value: "(" },
  { type: "word", value: "foo" },
  { type: "word", value: "bar" },
  { type: "close_list", value: ")" },
]);
assert.deepEqual(parser.parse_block("(foo bar)"), {
  type: "list",
  children: [
    { type: "word", value: "foo" },
    { type: "word", value: "bar" },
  ],
});

assert.deepEqual(parser.tokenize("(foo (bar baz))"), [
  { type: "open_list", value: "(" },
  { type: "word", value: "foo" },
  { type: "open_list", value: "(" },
  { type: "word", value: "bar" },
  { type: "word", value: "baz" },
  { type: "close_list", value: ")" },
  { type: "close_list", value: ")" },
]);
assert.deepEqual(parser.parse_block("(foo (bar baz))"), {
  type: "list",
  children: [
    { type: "word", value: "foo" },
    {
      type: "list",
      children: [
        { type: "word", value: "bar" },
        { type: "word", value: "baz" },
      ],
    },
  ],
});

assert.deepEqual(parser.parse_block("(saw 55 > lpf .5)"), {
  // (lpf (saw 55) .5)
  type: "list",
  children: [
    { type: "word", value: "lpf" },
    {
      type: "list",
      children: [
        { type: "word", value: "saw" },
        { type: "number", value: "55" },
      ],
    },
    { type: "number", value: ".5" },
  ],
});

let testblock = (code) => Zilp.print(parser.parse_block(code));

assert.equal(testblock("(foo bar)"), "(foo bar)");
assert.equal(testblock("(saw 55 > lpf .5)"), "(lpf (saw 55) .5)");
assert.equal(testblock("(saw 55 > lpf .5 > out)"), "(out (lpf (saw 55) .5))");
assert.equal(testblock("(imp: impulse 4)"), "(def imp (impulse 4))");
assert.equal(testblock("(imp: impulse 4)"), "(def imp (impulse 4))");

const zilp = new Zilp();
assert.equal(zilp.run_block(`saw 55 > lpf .5 > out`), "out(lpf(saw(55),.5))");
