/*
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
Copyright (C) 2025 zilp contributors
*/

export class ZilpParser {
  // these are the tokens we expect
  token_types = {
    open_list: /^\(/,
    close_list: /^\)/,
    pipe: /^\>/,
    set_var: /^[a-zA-Z_][a-zA-Z0-9_]*\:/, // imp: impulse 2
    // todo: change ":" to "=" and allow arbitrary spaces
    //assignment: /^\=/, // <- use this and do pattern matching later
    number: /^[0-9\.\/]+/, // not super accurate..
    word: /^[a-zA-Z0-9\.\#\=\+\-\*\/]+/,
  };
  // matches next token
  next_token(code) {
    for (let type in this.token_types) {
      const match = code.match(this.token_types[type]);
      if (match) {
        return { type, value: match[0] };
      }
    }
    throw new Error(`could not match "${code}"`);
  }
  // takes code string, returns list of matched tokens (if valid)
  tokenize(code) {
    let tokens = [];
    while (code.length > 0) {
      code = code.trim();
      const token = this.next_token(code);
      code = code.slice(token.value.length);
      tokens.push(token);
    }
    return tokens;
  }
  // take code, return abstract syntax tree
  parse_block(code) {
    this.tokens = this.tokenize(code);
    return this.parse_expr();
  }
  parse(code) {
    this.tokens = this.tokenize(code);
    const expressions = [];
    while (this.tokens.length) {
      expressions.push(this.parse_expr());
    }
    return expressions;
  }
  // parses any valid expression see
  parse_expr() {
    if (!this.tokens[0]) {
      throw new Error(`unexpected end of file`);
    }
    let next = this.tokens[0].type;
    if (next === "open_list") {
      return this.parse_list();
    }
    return this.consume(next);
  }
  resolve_pipes(children) {
    // saw 55 > lpf .5 = lpf (saw 55) .5
    while (true) {
      let pipeIndex = children.findIndex((child) => child.type === "pipe");
      if (pipeIndex === -1) break;
      let leftSide = children.slice(0, pipeIndex);
      if (leftSide.length === 1) {
        leftSide = leftSide[0];
      } else {
        // wrap in (..) if multiple items on the left side
        leftSide = { type: "list", children: leftSide };
      }
      const callee = children[pipeIndex + 1];
      const rightSide = children.slice(pipeIndex + 2);
      children = [callee, leftSide, ...rightSide];
    }
    return children;
  }
  resolve_set_var(children) {
    const varIndex = children.findIndex((child) => child.type === "set_var");
    if (varIndex === -1) return children;
    if (varIndex !== 0) {
      throw new Error('assignments need to be of format "x: ..."');
    }
    const name = children[0].value.slice(0, -1); // cut off :

    let rightSide = children.slice(1);
    rightSide = this.make_list(rightSide);

    return [
      { type: "word", value: "def" },
      { type: "word", value: name },
      rightSide,
    ];
  }

  make_list(children) {
    // children = this.reify_list(children).children; // (imp: (impulse 2)) = (imp: impulse 2)
    children = this.resolve_set_var(children);
    children = this.resolve_pipes(children);
    return { type: "list", children };
  }
  parse_list() {
    this.consume("open_list");
    let children = [];
    while (this.tokens[0]?.type !== "close_list") {
      children.push(this.parse_expr());
    }
    this.consume("close_list");
    return this.make_list(children);
  }
  consume(type) {
    // shift removes first element and returns it
    const token = this.tokens.shift();
    if (token.type !== type) {
      throw new Error(`expected token type ${type}, got ${token.type}`);
    }
    return token;
  }
}

// https://garten.salat.dev/lisp/interpreter.html
export class Zilp {
  constructor(evaluator, preprocessor) {
    this.parser = new ZilpParser();
    this.evaluator = evaluator;
    this.preprocessor = preprocessor;
  }
  static print(ast) {
    if (ast.type === "list") {
      return `(${ast.children.map((child) => this.print(child)).join(" ")})`;
    }
    return ast.value;
  }
  // a helper to check conditions and throw if they are not met
  assert(condition, error) {
    if (!condition) {
      throw new Error(error);
    }
  }
  // evaluates a single code block, wraps in (..) automatically
  run_block(code) {
    const block = code.trim();
    const expression = this.parser.parse_block(`(${code})`);
    return this.evaluate(expression);
  }
  // evaluates multiple blocks, separated by double line breaks, wraps each in (...)
  run_blocks(code) {
    const blocks = code.trim().split("\n\n").filter(Boolean);
    return blocks.map((block) => this.run_block(block));
  }
  process_args(args) {
    return args.map((arg) => {
      if (arg.type === "list") {
        return this.evaluate(arg);
      }
      return arg.value;
    });
  }
  evaluate(ast) {
    // console.log("call", ast);
    // for a node to be callable, it needs to be a list
    if (ast.type === "word") {
      // non-lists evaluate to their value
      return ast.value;
    }
    this.assert(
      ast.type === "list",
      `function call: expected list, got ${ast.type}`
    );
    // the first element is expected to be the function name
    this.assert(
      ast.children[0]?.type === "word",
      `function call: expected first child to be word, got ${ast.type}`
    );
    // look up function in lib
    const name = ast.children[0].value;

    // lambda function
    if (name === "fn") {
      const fnArgs = ast.children[1].children.map((arg) => arg.value);
      let lines = [];
      const statements = ast.children.slice(2);
      let fnBody;
      // multiple statements
      for (let i in statements) {
        let evaluated = this.evaluate(statements[i]);
        if (i == statements.length - 1) {
          evaluated = `return ${evaluated}`;
        }
        lines.push(evaluated);
      }
      fnBody = `{${lines.join(";")}}`;
      //const fnBody = this.evaluate(ast.children[2]);
      return `(${fnArgs.join(",")}) => ${fnBody}`;
    }
    if (name === "def") {
      const pName = ast.children[1].value;
      const pBody = this.evaluate(ast.children[2]);
      //return `let ${pName} = ${pBody};`;
      return `let ${pName} = ${pBody}`;
    }

    // process args
    const args = this.process_args(ast.children.slice(1));

    return `${name}(${args.join(",")})`;
  }
}
