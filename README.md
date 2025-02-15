# zilp

*Z*mall *I*nterpreted *L*isp with *P*ipes.

## What is zilp?

zilp is a small domain specific language based on _s-expressions_ and _syntax sugar_.
Here's an example of an s-expression:

```txt
(out (lpf (saw 55) .5))
```

If you're not familar with this type of syntax, here's an equivalent version using c-style syntax:

```js
out(lpf(saw(55), 0.5));
```

(note that the function names are just examples)

### Pipes

zilp allows you to use ">" to pipe functions into one another. the last example could be rewritten as:

```
saw 55 > lpf .5 > out
```

this is now less nested and easier to read. pipes are especially useful if you have long chains of input output plumbing, like in signal processing.

internally, the parser will immediately rewrite this to nested lists, which means ">" is only syntax sugar.

### Variables

you can declare variables with "x: ...", for example:

```
clock: impulse 4

saw 55 > mul (clock > ad .1) > out
```

like with pipes, this syntax is only syntax sugar. the s-expression for this would be:

```
(def clock (impulse 4))
```

## Usage

```js
import { Zilp } from "zilp";
const zilp = new Zilp();
const jsCode = zilp.run_block(`saw 55 > lpf .5 > out`);
console.log(jsCode);
// out(lpf(saw(55),.5))
```

checkout `test.mjs` for more examples!

## Status

This lib is still in development, so don't expect any stability.
If you want to use it, you are probably better off by copy pasting the zilp.js file into your project (if you respect the license).
