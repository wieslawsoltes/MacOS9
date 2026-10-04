/** Bounded Pratt parser for graph expressions. No eval or Function constructor. */
const functions = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, min: Math.min, max: Math.max, pow: Math.pow, sinh: Math.sinh, cosh: Math.cosh };
export function compileExpression(source) {
    if (typeof source !== 'string' || source.length > 512)
        throw new Error('Use an expression with at most 512 characters.');
    source = source.trim().replace(/^y\s*=\s*/i, '').toLowerCase();
    const matches = source.match(/(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?|[a-z]+|[+\-*/^(),]|\S/g) ?? [];
    const raw = [];
    for (const text of matches) {
        if (/^\d|^\./.test(text)) {
            const value = Number(text);
            if (!Number.isFinite(value))
                throw new Error(`Invalid number: ${text}`);
            raw.push({ type: 'number', value });
        }
        else if (/^[a-z]+$/.test(text))
            raw.push({ type: 'id', value: text });
        else if ('+-*/^(),'.includes(text))
            raw.push({ type: text });
        else
            throw new Error(`Unexpected character: ${text}`);
    }
    const tokens = [];
    for (let i = 0; i < raw.length; i++) {
        const token = raw[i], next = raw[i + 1];
        tokens.push(token);
        const ends = token.type === 'number' || token.type === ')' || token.type === 'id' && !functions[token.value];
        const starts = next && (next.type === 'number' || next.type === 'id' || next.type === '(');
        if (ends && starts)
            tokens.push({ type: '*' });
    }
    let at = 0, depth = 0;
    const peek = () => tokens[at];
    const take = type => { if (peek()?.type !== type)
        throw new Error(`Expected “${type}”.`); return tokens[at++]; };
    function expression(min = 0) {
        if (++depth > 50)
            throw new Error('Expression is too deeply nested.');
        let token = tokens[at++], left;
        if (!token)
            throw new Error('The expression is incomplete.');
        if (token.type === 'number')
            left = () => token.value;
        else if (token.type === '+' || token.type === '-') {
            const right = expression(4);
            left = token.type === '-' ? (x, y) => -right(x, y) : right;
        }
        else if (token.type === '(') {
            left = expression();
            take(')');
        }
        else if (token.type === 'id') {
            if (token.value === 'x')
                left = x => x;
            else if (token.value === 'y')
                left = (_, y) => y;
            else if (token.value === 'pi')
                left = () => Math.PI;
            else if (token.value === 'e')
                left = () => Math.E;
            else if (functions[token.value]) {
                take('(');
                const args = [expression()];
                while (peek()?.type === ',') {
                    at++;
                    args.push(expression());
                }
                take(')');
                if (args.length > 2)
                    throw new Error('Use at most two function arguments.');
                left = (x, y) => functions[token.value](...args.map(a => a(x, y)));
            }
            else
                throw new Error(`Unknown name “${token.value}”.`);
        }
        else
            throw new Error(`Unexpected “${token.type}”.`);
        while (peek()) {
            const op = peek().type, bp = { '+': 1, '-': 1, '*': 3, '/': 3, '^': 5 }[op];
            if (bp == null || bp < min)
                break;
            at++;
            const right = expression(op === '^' ? bp : bp + 1), prior = left;
            left = op === '+' ? (x, y) => prior(x, y) + right(x, y) : op === '-' ? (x, y) => prior(x, y) - right(x, y) : op === '*' ? (x, y) => prior(x, y) * right(x, y) : op === '/' ? (x, y) => prior(x, y) / right(x, y) : (x, y) => Math.pow(prior(x, y), right(x, y));
        }
        depth--;
        return left;
    }
    const evaluate = expression();
    if (at !== tokens.length)
        throw new Error('Unexpected text after the expression.');
    return evaluate;
}
export class CalculatorEngine {
    constructor() { this.clear(); }
    clear() { this.display = '0'; this.accumulator = null; this.operation = null; this.replace = true; this.lastOperation = null; this.lastOperand = null; this.memory = 0; }
    input(value) {
        if (/^\d$/.test(value)) {
            if (this.replace || this.display === '0') {
                this.display = value;
                this.replace = false;
            }
            else if (this.display.length < 14)
                this.display += value;
            return this.display;
        }
        if (value === '.') {
            if (this.replace) {
                this.display = '0.';
                this.replace = false;
            }
            else if (!this.display.includes('.'))
                this.display += '.';
            return this.display;
        }
        if (value === 'C' || value === 'AC') {
            this.clear();
            return this.display;
        }
        if (value === 'CE') {
            this.display = '0';
            this.replace = true;
            return this.display;
        }
        if (value === '±') {
            this.display = String(-Number(this.display));
            return this.display;
        }
        if (value === '%') {
            const current = Number(this.display);
            this.display = String(this.accumulator != null && ['+', '−'].includes(this.operation) ? this.accumulator * current / 100 : current / 100);
            return this.display;
        }
        if (value === '⌫') {
            this.display = this.display.length > 1 ? this.display.slice(0, -1) : '0';
            return this.display;
        }
        if (value === 'M+') {
            this.memory += Number(this.display);
            this.replace = true;
            return this.display;
        }
        if (value === 'MR') {
            this.display = String(this.memory);
            this.replace = true;
            return this.display;
        }
        if (value === 'MC') {
            this.memory = 0;
            return this.display;
        }
        const calculate = (a, b, op) => op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : op === '÷' ? a / b : b;
        const format = n => Number.isFinite(n) ? String(Number(n.toPrecision(12))) : 'Error';
        if (value === '=') {
            const op = this.operation ?? this.lastOperation, operand = this.operation ? Number(this.display) : this.lastOperand;
            if (op && operand != null) {
                const a = this.operation ? this.accumulator : Number(this.display);
                this.display = format(calculate(a, operand, op));
                this.lastOperation = op;
                this.lastOperand = operand;
                this.accumulator = null;
                this.operation = null;
                this.replace = true;
            }
            return this.display;
        }
        if (['+', '−', '×', '÷'].includes(value)) {
            const current = Number(this.display);
            if (this.accumulator != null && this.operation && !this.replace)
                this.display = format(calculate(this.accumulator, current, this.operation));
            this.accumulator = Number(this.display);
            this.operation = value;
            this.replace = true;
            return this.display;
        }
        return this.display;
    }
}
