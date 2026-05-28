/**
 * Safe arithmetic evaluator for amount inputs.
 *
 * Lets users type expressions like "435-18" or "100+25*2" into a number field
 * and have it resolved on blur/Enter — never uses eval(). Recursive-descent
 * parser supports + − × ÷ (incl. unary minus), parens, and decimal numbers.
 * Returns null for anything malformed or partial (so the caller can fall back).
 */

const NUMBER_RE = /^\s*-?\d*(?:\.\d+)?\s*$/

/** Plain numeric? (No operators to evaluate — common, fast path.) */
export function isPlainNumber(input: string): boolean {
  return NUMBER_RE.test(input)
}

/**
 * Evaluate an arithmetic expression. Returns the number, or `null` if the input
 * is empty, malformed, or contains anything outside digits, dot, + - x / and parens.
 */
export function evalMath(input: string): number | null {
  const src = (input ?? '').trim()
  if (!src) return null
  if (isPlainNumber(src)) {
    const n = parseFloat(src)
    return isFinite(n) ? n : null
  }
  // Whitelist characters — reject anything else immediately
  if (!/^[0-9.+\-*\/() ]+$/.test(src)) return null

  let i = 0
  const peek = () => src[i]
  const advance = () => src[i++]
  const skipWs = () => { while (i < src.length && src[i] === ' ') i++ }

  // expr   := term (('+'|'-') term)*
  // term   := factor (('*'|'/') factor)*
  // factor := '-' factor | '(' expr ')' | number
  const parseNumber = (): number | null => {
    skipWs()
    let s = ''
    while (i < src.length && /[0-9.]/.test(src[i])) s += advance()
    if (!s || s === '.') return null
    const n = parseFloat(s)
    return isFinite(n) ? n : null
  }
  const parseFactor = (): number | null => {
    skipWs()
    if (peek() === '-') { advance(); const v = parseFactor(); return v == null ? null : -v }
    if (peek() === '+') { advance(); return parseFactor() }
    if (peek() === '(') {
      advance()
      const v = parseExpr()
      skipWs()
      if (peek() !== ')') return null
      advance()
      return v
    }
    return parseNumber()
  }
  const parseTerm = (): number | null => {
    let left = parseFactor()
    if (left == null) return null
    while (true) {
      skipWs()
      const op = peek()
      if (op !== '*' && op !== '/') return left
      advance()
      const right = parseFactor()
      if (right == null) return null
      if (op === '*') left = left * right
      else if (right === 0) return null
      else left = left / right
    }
  }
  function parseExpr(): number | null {
    let left = parseTerm()
    if (left == null) return null
    while (true) {
      skipWs()
      const op = peek()
      if (op !== '+' && op !== '-') return left
      advance()
      const right = parseTerm()
      if (right == null) return null
      left = op === '+' ? left + right : left - right
    }
  }

  const out = parseExpr()
  skipWs()
  if (i !== src.length) return null
  return out
}

/** Round to 2 decimals — matches how amounts are stored across the app. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
