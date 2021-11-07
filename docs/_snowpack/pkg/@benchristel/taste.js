const originalFunctionKey = Symbol();
const curriedFunctionKey = Symbol();
const partialArgsKey = Symbol();
const nameKey = Symbol();

function curry(f, name) {
  function curried(...args) {
    if (args.length >= f.length) {
      return f(...args)
    } else {
      const f2 = (...moreArgs) => curried(...args, ...moreArgs);
      f2[originalFunctionKey] = f;
      f2[curriedFunctionKey] = curried;
      f2[partialArgsKey] = args;
      f2[nameKey] = curried[nameKey];
      return f2
    }
  }

  curried[originalFunctionKey] = f;
  curried[curriedFunctionKey] = curried;
  curried[partialArgsKey] = [];
  curried[nameKey] = name || functionName(f);
  return curried
}

function originalFunction(f) {
  return f[originalFunctionKey]
}

function curriedFunction(f) {
  return f[curriedFunctionKey]
}

function partialArgs(f) {
  return f[partialArgsKey] || []
}

function functionName(f) {
  return f[nameKey] || f.name
}

function createSuite() {
  const testCases = [];

  return {test, getAllTests}

  function test(subject, definitions) {
    testCases.push(
      ...Object.entries(definitions)
        .map(([behavior, fn]) =>
          TestCase(subject, behavior, fn))
    );
  }

  function getAllTests() {
    return testCases
  }
}

function expect(subject, expectation, ...args) {
  const pass = expectation(...args, subject);
  // if the expectation returns a function, that's almost
  // certainly a mistake on the part of the test-writer.
  // Possibly they forgot to pass all needed arguments to
  // a curried function.
  if (typeof pass === "function") {
    throw new Error("The matcher function `" + prettyFunctionName(pass) + "` returned a function instead of a boolean. You might need to pass another argument to it.")
  }
  if (!pass) {
    throw new ExpectationFailure([subject, expectation, ...args])
  }
}

function TestCase(subject, scenario, fn) {
  return {subject, scenario, fn}
}

class ExpectationFailure extends Error {
  constructor(expectArgs) {
    super("Expectation failed");
    this.expectArgs = expectArgs;
  }
}

function lastOf(a) {
  return a[a.length - 1]
}

function firstOf(a) {
  return a[0]
}

const which = curry(function(predicate, x) {
  return predicate(x)
}, "which");

const equals = curry(function(a, b) {
  if (isCustomMatcher(a)) {
    return a(b)
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length
      && a.every((_, i) => equals(a[i], b[i]))
  }
  if (a instanceof Function && b instanceof Function) {
    if (originalFunction(a) && originalFunction(a) === originalFunction(b)) {
      return equals(partialArgs(a), partialArgs(b))
    }
    return a === b
  }
  if (a instanceof Date && b instanceof Date) {
    return a.toISOString() === b.toISOString()
  }
  if (a instanceof Object && b instanceof Object) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length
      && aKeys.every(k => equals(a[k], b[k]))
      && a.__proto__.constructor === b.__proto__.constructor
  }
  return a === b
}, "equals");

const is = curry(function(a, b) {
  return a === b
}, "is");

const not = curry(function(predicate, subject, ...args) {
  return !predicate(subject, ...args)
}, "not");

const isBlank = curry(function(s) {
  return /^\s*$/.test(s)
}, "isBlank");

function isCustomMatcher(f) {
  return f instanceof Function
    && curriedFunction(f) === which
    && partialArgs(f).length === 1
}

function prettyFunctionName(f) {
  return functionName(f) || "<function>"
}

function pretty(x) {
  const stack = [];
  return _pretty(x)

  function _pretty(x) {
    if (null === x)
      return "null"
    if ("function" === typeof x)
      return preventInfiniteLoop(x, prettyFunction)
    if ("string" === typeof x)
      return quote(x)
    if ("bigint" === typeof x)
      return `${x}n`
    if (Array.isArray(x))
      return preventInfiniteLoop(x, prettyArray)
    if (x instanceof Date)
      return `Date(${x.toISOString().replace("T", " ").replace("Z", " UTC")})`
    if (x instanceof RegExp)
      return String(x)
    if (x instanceof Error)
      return `${prettyConstructor(x)}(${quote(x.message)})`
    if (x && Object === x.__proto__.constructor)
      return preventInfiniteLoop(x, prettyObject)
    if ("object" === typeof x)
      return `${prettyConstructor(x)} ${preventInfiniteLoop(x, prettyObject)}`
    return String(x)
  }

  function preventInfiniteLoop(x, cb) {
    if (stack.indexOf(x) > -1) return "<circular reference>"
    stack.push(x);
    const result = cb(x);
    stack.pop();
    return result
  }

  function prettyFunction(f) {
    const args = partialArgs(f).map(_pretty);
    const name = prettyFunctionName(f);
    if (!args.length) return name
    return formatStructure(name + "(", args, ",", ")")
  }

  function prettyArray(a) {
    return formatStructure("[", a.map(_pretty), ",", "]")
  }

  function prettyObject(x) {
    const innards = Object.entries(x)
      .map(([k, v]) => `${prettyKey(k)}: ${_pretty(v)}`);
    return formatStructure("{", innards, ",", "}")
  }
}

function prettyKey(k) {
  return /^[a-zA-Z0-9_$]+$/.test(k) ? k : quote(k)
}

function prettyConstructor(obj) {
  return prettyFunctionName(obj.__proto__.constructor)
}

function quote(s) {
  return '"' + String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/"/g, '\\"')
    .replace(/[\x00-\x1f\x7f]/g, hexEscape)
    + '"'
}

function hexEscape(c) {
  const hex = c.charCodeAt(0).toString(16);
  return "\\x" + (hex.length < 2 ? "0" + hex : hex)
}

function indent(level, s) {
  return s.split("\n")
    .map(l => !l ? l : prepend(repeat(level, " "))(l))
    .join("\n")
}

function repeat(n, s) {
  return Array(n + 1).join(s)
}

const prepend = prefix => s => prefix + s;

const removePrefix = curry(
  function removePrefix(prefix, s) {
    const hasPrefix = s.slice(0, prefix.length) === prefix;
    return hasPrefix ? s.slice(prefix.length) : s
  });

function lines(s) {
  return String(s).split(/\r?\n/)
}

function trimMargin(s) {
  const lns = lines(s);
  if (isBlank(firstOf(lns))) lns.shift();
  if (isBlank( lastOf(lns))) lns.pop();
  const initialIndent = /^[ \t]*/.exec(firstOf(lns))[0];
  return lns
    .map(removePrefix(initialIndent))
    .join("\n")
}

function formatStructure(prefix, innards, delim, suffix) {
  if (innards.length < 2) {
    return prefix + innards.join("") + suffix
  } else {
    return prefix + "\n"
      + indent(2, innards.join(delim + "\n"))
      + "\n" + suffix
  }
}

async function runTests(tests) {
  const results = [];
  for (const test of tests) {
    const error = await errorFrom(test.fn);
    const instrumentLog = debugLogs.map(args => ({type: "debug", args}));
    debugLogs.length = 0;
    results.push({
      test,
      error,
      instrumentLog
    });
  }
  return {results}
}

// WARNING: if you change the name of errorFrom, you must
// also update the test result formatter, which uses the
// errorFrom name to identify the end of the useful
// stacktrace.
function errorFrom(f) {
  let caught;
  try {
    const result = f();
    if (result instanceof Promise) {
      return new Promise(resolve => {
        result.then(() => resolve()).catch(resolve);
      })
    }
  } catch(e) {
    caught = e;
  }
  return Promise.resolve(caught);
}

const debugLogs = [];

const isExpectationFailure = curry(
  function isExpectationFailure(args, error) {
    return error instanceof ExpectationFailure &&
      equals(args, error.expectArgs)
  });

const blankLine = "\n\n";

function formatTestResultsAsText({results}) {
  let anyErrors = false;
  let anyInstrumentation = false;
  let resultsNeedingAttention = [];
  for (const r of results) {
    let needsAttention = false;
    if (r.error) {
      needsAttention = anyErrors = true;
    }
    if (r.instrumentLog.length) {
      needsAttention = anyInstrumentation = true;
    }
    if (needsAttention) {
      resultsNeedingAttention.push(r);
    }
  }
  if (anyErrors) {
    return suiteFailed(resultsNeedingAttention)
  }
  if (anyInstrumentation) {
    return suitePassedWithInstrumentation(
      results.length,
      resultsNeedingAttention,
    )
  }
  return suitePassed(results.length)
}

function suiteFailed(failures) {
  return failures
    .map(formatFailure)
    .join(blankLine)
    + blankLine + "Tests failed."
}

function suitePassed(numPassed) {
  switch (numPassed) {
    case 0: return "No tests to run."
    case 1: return "One test ran, and found no issues."
    default: return `${numPassed} tests ran, and found no issues.`
  }
}

function suitePassedWithInstrumentation(numPassed, resultsWithLogs) {
  return resultsWithLogs
    .map(formatFailure)
    .join(blankLine)
    + blankLine
    + countPasses(numPassed) + ", but debugging instrumentation is present.\n"
    + "Remove it before shipping."
}

function countPasses(n) {
  switch (n) {
    case 1: return "The test passed"
    case 2: return "Both tests passed"
    default: return `All ${n} tests passed`
  }
}

function formatFailure({test, error, instrumentLog}) {
  const title = test.subject + " " + test.scenario;
  const sections = [title];
  if (instrumentLog.length)
    sections.push(indent(2, formatDebugLog(instrumentLog)));
  if (error)
    sections.push(indent(2, formatError(error)));
  return sections.join("\n")
}

function formatError(error) {
  return error instanceof ExpectationFailure
    ? formatExpectationFailure(error)
    : formatException(error)
}

function formatDebugLog(log) {
  return log
    .map(({args}) => formatFunctionCall("debug", args))
    .join("")
}

function formatExpectationFailure(error) {
  return formatFunctionCall(
    "expect",
    error.expectArgs
  )
}

function formatException(error) {
  return pretty(error) + " thrown"
    + indent(2, simplifyStacktrace(error.stack))
}

function formatFunctionCall(name, args) {
  return formatStructure(name + "(", args.map(pretty), ",", ")")
}

function simplifyStacktrace(stack) {
  if (!stack) return ""
  const lines = trimMargin(stack).split("\n");
  return "\n"
    + lines.slice(0, indexOfFirstIrrelevantStackFrame(lines))
      .map(line =>
        line
          .replace(/(file:\/\/|http:\/\/[^/]*)/, "")
          .replace(/^([^@]*)@(.*)$/, "at $1 ($2)")
      )
      .join("\n")
}

function indexOfFirstIrrelevantStackFrame(lines) {
  const i = lines.findIndex(l => l.includes("errorFrom"));
  // If the error is thrown from async code, errorFrom
  // won't be on the stack. In that case, consider all stack
  // frames relevant.
  if (i === -1) return lines.length
  else return i
}

const basePassingTest = Object.freeze({
  test: {
    subject: "a thing",
    scenario: "does something",
    fn() {},
  },
  error: undefined,
  instrumentLog: [],
});

const suite = createSuite();

const {getAllTests} = suite;

function test(...args) {
}

export { equals, expect, formatTestResultsAsText, getAllTests, is, runTests, test };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFzdGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AYmVuY2hyaXN0ZWwvdGFzdGUvc3JjL2N1cnJ5LmltcGwuanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQGJlbmNocmlzdGVsL3Rhc3RlL3NyYy90ZXN0aW5nLmltcGwuanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvQGJlbmNocmlzdGVsL3Rhc3RlL3NyYy9pbmRleGFibGVzLmpzIiwiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0BiZW5jaHJpc3RlbC90YXN0ZS9zcmMvcHJlZGljYXRlcy5pbXBsLmpzIiwiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0BiZW5jaHJpc3RlbC90YXN0ZS9zcmMvZm9ybWF0dGluZy5pbXBsLmpzIiwiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0BiZW5jaHJpc3RlbC90YXN0ZS9zcmMvdGVzdC1ydW5uZXIuaW1wbC5qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AYmVuY2hyaXN0ZWwvdGFzdGUvc3JjL3Rlc3QtcnVubmVyLmpzIiwiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0BiZW5jaHJpc3RlbC90YXN0ZS9zcmMvcGxhaW4tdGV4dC10ZXN0LWZvcm1hdHRlci5pbXBsLmpzIiwiLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0BiZW5jaHJpc3RlbC90YXN0ZS9zcmMvcGxhaW4tdGV4dC10ZXN0LWZvcm1hdHRlci5qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9AYmVuY2hyaXN0ZWwvdGFzdGUvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiY29uc3Qgb3JpZ2luYWxGdW5jdGlvbktleSA9IFN5bWJvbCgpXG5jb25zdCBjdXJyaWVkRnVuY3Rpb25LZXkgPSBTeW1ib2woKVxuY29uc3QgcGFydGlhbEFyZ3NLZXkgPSBTeW1ib2woKVxuY29uc3QgbmFtZUtleSA9IFN5bWJvbCgpXG5cbmV4cG9ydCBmdW5jdGlvbiBjdXJyeShmLCBuYW1lKSB7XG4gIGZ1bmN0aW9uIGN1cnJpZWQoLi4uYXJncykge1xuICAgIGlmIChhcmdzLmxlbmd0aCA+PSBmLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGYoLi4uYXJncylcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZjIgPSAoLi4ubW9yZUFyZ3MpID0+IGN1cnJpZWQoLi4uYXJncywgLi4ubW9yZUFyZ3MpXG4gICAgICBmMltvcmlnaW5hbEZ1bmN0aW9uS2V5XSA9IGZcbiAgICAgIGYyW2N1cnJpZWRGdW5jdGlvbktleV0gPSBjdXJyaWVkXG4gICAgICBmMltwYXJ0aWFsQXJnc0tleV0gPSBhcmdzXG4gICAgICBmMltuYW1lS2V5XSA9IGN1cnJpZWRbbmFtZUtleV1cbiAgICAgIHJldHVybiBmMlxuICAgIH1cbiAgfVxuXG4gIGN1cnJpZWRbb3JpZ2luYWxGdW5jdGlvbktleV0gPSBmXG4gIGN1cnJpZWRbY3VycmllZEZ1bmN0aW9uS2V5XSA9IGN1cnJpZWRcbiAgY3VycmllZFtwYXJ0aWFsQXJnc0tleV0gPSBbXVxuICBjdXJyaWVkW25hbWVLZXldID0gbmFtZSB8fCBmdW5jdGlvbk5hbWUoZilcbiAgcmV0dXJuIGN1cnJpZWRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9yaWdpbmFsRnVuY3Rpb24oZikge1xuICByZXR1cm4gZltvcmlnaW5hbEZ1bmN0aW9uS2V5XVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3VycmllZEZ1bmN0aW9uKGYpIHtcbiAgcmV0dXJuIGZbY3VycmllZEZ1bmN0aW9uS2V5XVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFydGlhbEFyZ3MoZikge1xuICByZXR1cm4gZltwYXJ0aWFsQXJnc0tleV0gfHwgW11cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZ1bmN0aW9uTmFtZShmKSB7XG4gIHJldHVybiBmW25hbWVLZXldIHx8IGYubmFtZVxufVxuIiwiaW1wb3J0IHtwcmV0dHlGdW5jdGlvbk5hbWV9IGZyb20gXCIuL2Zvcm1hdHRpbmcuaW1wbC5qc1wiXG5cbmNvbnN0IHN1aXRlID0gY3JlYXRlU3VpdGUoKVxuXG5leHBvcnQgY29uc3Qge2dldEFsbFRlc3RzfSA9IHN1aXRlXG5cbmV4cG9ydCBmdW5jdGlvbiB0ZXN0KC4uLmFyZ3MpIHtcbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSBcInByb2R1Y3Rpb25cIilcbiAgICBzdWl0ZS50ZXN0KC4uLmFyZ3MpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdWl0ZSgpIHtcbiAgY29uc3QgdGVzdENhc2VzID0gW11cblxuICByZXR1cm4ge3Rlc3QsIGdldEFsbFRlc3RzfVxuXG4gIGZ1bmN0aW9uIHRlc3Qoc3ViamVjdCwgZGVmaW5pdGlvbnMpIHtcbiAgICB0ZXN0Q2FzZXMucHVzaChcbiAgICAgIC4uLk9iamVjdC5lbnRyaWVzKGRlZmluaXRpb25zKVxuICAgICAgICAubWFwKChbYmVoYXZpb3IsIGZuXSkgPT5cbiAgICAgICAgICBUZXN0Q2FzZShzdWJqZWN0LCBiZWhhdmlvciwgZm4pKVxuICAgIClcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEFsbFRlc3RzKCkge1xuICAgIHJldHVybiB0ZXN0Q2FzZXNcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZXhwZWN0KHN1YmplY3QsIGV4cGVjdGF0aW9uLCAuLi5hcmdzKSB7XG4gIGNvbnN0IHBhc3MgPSBleHBlY3RhdGlvbiguLi5hcmdzLCBzdWJqZWN0KVxuICAvLyBpZiB0aGUgZXhwZWN0YXRpb24gcmV0dXJucyBhIGZ1bmN0aW9uLCB0aGF0J3MgYWxtb3N0XG4gIC8vIGNlcnRhaW5seSBhIG1pc3Rha2Ugb24gdGhlIHBhcnQgb2YgdGhlIHRlc3Qtd3JpdGVyLlxuICAvLyBQb3NzaWJseSB0aGV5IGZvcmdvdCB0byBwYXNzIGFsbCBuZWVkZWQgYXJndW1lbnRzIHRvXG4gIC8vIGEgY3VycmllZCBmdW5jdGlvbi5cbiAgaWYgKHR5cGVvZiBwYXNzID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgbWF0Y2hlciBmdW5jdGlvbiBgXCIgKyBwcmV0dHlGdW5jdGlvbk5hbWUocGFzcykgKyBcImAgcmV0dXJuZWQgYSBmdW5jdGlvbiBpbnN0ZWFkIG9mIGEgYm9vbGVhbi4gWW91IG1pZ2h0IG5lZWQgdG8gcGFzcyBhbm90aGVyIGFyZ3VtZW50IHRvIGl0LlwiKVxuICB9XG4gIGlmICghcGFzcykge1xuICAgIHRocm93IG5ldyBFeHBlY3RhdGlvbkZhaWx1cmUoW3N1YmplY3QsIGV4cGVjdGF0aW9uLCAuLi5hcmdzXSlcbiAgfVxufVxuXG5mdW5jdGlvbiBUZXN0Q2FzZShzdWJqZWN0LCBzY2VuYXJpbywgZm4pIHtcbiAgcmV0dXJuIHtzdWJqZWN0LCBzY2VuYXJpbywgZm59XG59XG5cbmV4cG9ydCBjbGFzcyBFeHBlY3RhdGlvbkZhaWx1cmUgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGV4cGVjdEFyZ3MpIHtcbiAgICBzdXBlcihcIkV4cGVjdGF0aW9uIGZhaWxlZFwiKVxuICAgIHRoaXMuZXhwZWN0QXJncyA9IGV4cGVjdEFyZ3NcbiAgfVxufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIGxhc3RPZihhKSB7XG4gIHJldHVybiBhW2EubGVuZ3RoIC0gMV1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpcnN0T2YoYSkge1xuICByZXR1cm4gYVswXVxufVxuIiwiaW1wb3J0IHtjdXJyeSwgY3VycmllZEZ1bmN0aW9uLCBwYXJ0aWFsQXJncywgb3JpZ2luYWxGdW5jdGlvbn0gZnJvbSBcIi4vY3VycnkuanNcIlxuXG5leHBvcnQgY29uc3Qgd2hpY2ggPSBjdXJyeShmdW5jdGlvbihwcmVkaWNhdGUsIHgpIHtcbiAgcmV0dXJuIHByZWRpY2F0ZSh4KVxufSwgXCJ3aGljaFwiKVxuXG5leHBvcnQgY29uc3QgZXF1YWxzID0gY3VycnkoZnVuY3Rpb24oYSwgYikge1xuICBpZiAoaXNDdXN0b21NYXRjaGVyKGEpKSB7XG4gICAgcmV0dXJuIGEoYilcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheShhKSAmJiBBcnJheS5pc0FycmF5KGIpKSB7XG4gICAgcmV0dXJuIGEubGVuZ3RoID09PSBiLmxlbmd0aFxuICAgICAgJiYgYS5ldmVyeSgoXywgaSkgPT4gZXF1YWxzKGFbaV0sIGJbaV0pKVxuICB9XG4gIGlmIChhIGluc3RhbmNlb2YgRnVuY3Rpb24gJiYgYiBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgaWYgKG9yaWdpbmFsRnVuY3Rpb24oYSkgJiYgb3JpZ2luYWxGdW5jdGlvbihhKSA9PT0gb3JpZ2luYWxGdW5jdGlvbihiKSkge1xuICAgICAgcmV0dXJuIGVxdWFscyhwYXJ0aWFsQXJncyhhKSwgcGFydGlhbEFyZ3MoYikpXG4gICAgfVxuICAgIHJldHVybiBhID09PSBiXG4gIH1cbiAgaWYgKGEgaW5zdGFuY2VvZiBEYXRlICYmIGIgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIGEudG9JU09TdHJpbmcoKSA9PT0gYi50b0lTT1N0cmluZygpXG4gIH1cbiAgaWYgKGEgaW5zdGFuY2VvZiBPYmplY3QgJiYgYiBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgIGNvbnN0IGFLZXlzID0gT2JqZWN0LmtleXMoYSlcbiAgICBjb25zdCBiS2V5cyA9IE9iamVjdC5rZXlzKGIpXG4gICAgcmV0dXJuIGFLZXlzLmxlbmd0aCA9PT0gYktleXMubGVuZ3RoXG4gICAgICAmJiBhS2V5cy5ldmVyeShrID0+IGVxdWFscyhhW2tdLCBiW2tdKSlcbiAgICAgICYmIGEuX19wcm90b19fLmNvbnN0cnVjdG9yID09PSBiLl9fcHJvdG9fXy5jb25zdHJ1Y3RvclxuICB9XG4gIHJldHVybiBhID09PSBiXG59LCBcImVxdWFsc1wiKVxuXG5leHBvcnQgY29uc3QgaXMgPSBjdXJyeShmdW5jdGlvbihhLCBiKSB7XG4gIHJldHVybiBhID09PSBiXG59LCBcImlzXCIpXG5cbmV4cG9ydCBjb25zdCBub3QgPSBjdXJyeShmdW5jdGlvbihwcmVkaWNhdGUsIHN1YmplY3QsIC4uLmFyZ3MpIHtcbiAgcmV0dXJuICFwcmVkaWNhdGUoc3ViamVjdCwgLi4uYXJncylcbn0sIFwibm90XCIpXG5cbmV4cG9ydCBjb25zdCBpc0JsYW5rID0gY3VycnkoZnVuY3Rpb24ocykge1xuICByZXR1cm4gL15cXHMqJC8udGVzdChzKVxufSwgXCJpc0JsYW5rXCIpXG5cbmZ1bmN0aW9uIGlzQ3VzdG9tTWF0Y2hlcihmKSB7XG4gIHJldHVybiBmIGluc3RhbmNlb2YgRnVuY3Rpb25cbiAgICAmJiBjdXJyaWVkRnVuY3Rpb24oZikgPT09IHdoaWNoXG4gICAgJiYgcGFydGlhbEFyZ3MoZikubGVuZ3RoID09PSAxXG59XG4iLCJpbXBvcnQge2N1cnJ5LCBwYXJ0aWFsQXJncywgZnVuY3Rpb25OYW1lfSBmcm9tIFwiLi9jdXJyeS5qc1wiXG5pbXBvcnQge2ZpcnN0T2YsIGxhc3RPZn0gZnJvbSBcIi4vaW5kZXhhYmxlcy5qc1wiXG5pbXBvcnQge2lzQmxhbmt9IGZyb20gXCIuL3ByZWRpY2F0ZXMuanNcIlxuXG5leHBvcnQgZnVuY3Rpb24gcHJldHR5RnVuY3Rpb25OYW1lKGYpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uTmFtZShmKSB8fCBcIjxmdW5jdGlvbj5cIlxufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJldHR5KHgpIHtcbiAgY29uc3Qgc3RhY2sgPSBbXVxuICByZXR1cm4gX3ByZXR0eSh4KVxuXG4gIGZ1bmN0aW9uIF9wcmV0dHkoeCkge1xuICAgIGlmIChudWxsID09PSB4KVxuICAgICAgcmV0dXJuIFwibnVsbFwiXG4gICAgaWYgKFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHgpXG4gICAgICByZXR1cm4gcHJldmVudEluZmluaXRlTG9vcCh4LCBwcmV0dHlGdW5jdGlvbilcbiAgICBpZiAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIHgpXG4gICAgICByZXR1cm4gcXVvdGUoeClcbiAgICBpZiAoXCJiaWdpbnRcIiA9PT0gdHlwZW9mIHgpXG4gICAgICByZXR1cm4gYCR7eH1uYFxuICAgIGlmIChBcnJheS5pc0FycmF5KHgpKVxuICAgICAgcmV0dXJuIHByZXZlbnRJbmZpbml0ZUxvb3AoeCwgcHJldHR5QXJyYXkpXG4gICAgaWYgKHggaW5zdGFuY2VvZiBEYXRlKVxuICAgICAgcmV0dXJuIGBEYXRlKCR7eC50b0lTT1N0cmluZygpLnJlcGxhY2UoXCJUXCIsIFwiIFwiKS5yZXBsYWNlKFwiWlwiLCBcIiBVVENcIil9KWBcbiAgICBpZiAoeCBpbnN0YW5jZW9mIFJlZ0V4cClcbiAgICAgIHJldHVybiBTdHJpbmcoeClcbiAgICBpZiAoeCBpbnN0YW5jZW9mIEVycm9yKVxuICAgICAgcmV0dXJuIGAke3ByZXR0eUNvbnN0cnVjdG9yKHgpfSgke3F1b3RlKHgubWVzc2FnZSl9KWBcbiAgICBpZiAoeCAmJiBPYmplY3QgPT09IHguX19wcm90b19fLmNvbnN0cnVjdG9yKVxuICAgICAgcmV0dXJuIHByZXZlbnRJbmZpbml0ZUxvb3AoeCwgcHJldHR5T2JqZWN0KVxuICAgIGlmIChcIm9iamVjdFwiID09PSB0eXBlb2YgeClcbiAgICAgIHJldHVybiBgJHtwcmV0dHlDb25zdHJ1Y3Rvcih4KX0gJHtwcmV2ZW50SW5maW5pdGVMb29wKHgsIHByZXR0eU9iamVjdCl9YFxuICAgIHJldHVybiBTdHJpbmcoeClcbiAgfVxuXG4gIGZ1bmN0aW9uIHByZXZlbnRJbmZpbml0ZUxvb3AoeCwgY2IpIHtcbiAgICBpZiAoc3RhY2suaW5kZXhPZih4KSA+IC0xKSByZXR1cm4gXCI8Y2lyY3VsYXIgcmVmZXJlbmNlPlwiXG4gICAgc3RhY2sucHVzaCh4KVxuICAgIGNvbnN0IHJlc3VsdCA9IGNiKHgpXG4gICAgc3RhY2sucG9wKClcbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cblxuICBmdW5jdGlvbiBwcmV0dHlGdW5jdGlvbihmKSB7XG4gICAgY29uc3QgYXJncyA9IHBhcnRpYWxBcmdzKGYpLm1hcChfcHJldHR5KVxuICAgIGNvbnN0IG5hbWUgPSBwcmV0dHlGdW5jdGlvbk5hbWUoZilcbiAgICBpZiAoIWFyZ3MubGVuZ3RoKSByZXR1cm4gbmFtZVxuICAgIHJldHVybiBmb3JtYXRTdHJ1Y3R1cmUobmFtZSArIFwiKFwiLCBhcmdzLCBcIixcIiwgXCIpXCIpXG4gIH1cblxuICBmdW5jdGlvbiBwcmV0dHlBcnJheShhKSB7XG4gICAgcmV0dXJuIGZvcm1hdFN0cnVjdHVyZShcIltcIiwgYS5tYXAoX3ByZXR0eSksIFwiLFwiLCBcIl1cIilcbiAgfVxuXG4gIGZ1bmN0aW9uIHByZXR0eU9iamVjdCh4KSB7XG4gICAgY29uc3QgaW5uYXJkcyA9IE9iamVjdC5lbnRyaWVzKHgpXG4gICAgICAubWFwKChbaywgdl0pID0+IGAke3ByZXR0eUtleShrKX06ICR7X3ByZXR0eSh2KX1gKVxuICAgIHJldHVybiBmb3JtYXRTdHJ1Y3R1cmUoXCJ7XCIsIGlubmFyZHMsIFwiLFwiLCBcIn1cIilcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmV0dHlLZXkoaykge1xuICByZXR1cm4gL15bYS16QS1aMC05XyRdKyQvLnRlc3QoaykgPyBrIDogcXVvdGUoaylcbn1cblxuZnVuY3Rpb24gcHJldHR5Q29uc3RydWN0b3Iob2JqKSB7XG4gIHJldHVybiBwcmV0dHlGdW5jdGlvbk5hbWUob2JqLl9fcHJvdG9fXy5jb25zdHJ1Y3Rvcilcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHF1b3RlKHMpIHtcbiAgcmV0dXJuICdcIicgKyBTdHJpbmcocylcbiAgICAucmVwbGFjZSgvXFxcXC9nLCBcIlxcXFxcXFxcXCIpXG4gICAgLnJlcGxhY2UoL1xcbi9nLCBcIlxcXFxuXCIpXG4gICAgLnJlcGxhY2UoL1xcdC9nLCBcIlxcXFx0XCIpXG4gICAgLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKVxuICAgIC5yZXBsYWNlKC9bXFx4MDAtXFx4MWZcXHg3Zl0vZywgaGV4RXNjYXBlKVxuICAgICsgJ1wiJ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGV4RXNjYXBlKGMpIHtcbiAgY29uc3QgaGV4ID0gYy5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gXCJcXFxceFwiICsgKGhleC5sZW5ndGggPCAyID8gXCIwXCIgKyBoZXggOiBoZXgpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmRlbnQobGV2ZWwsIHMpIHtcbiAgcmV0dXJuIHMuc3BsaXQoXCJcXG5cIilcbiAgICAubWFwKGwgPT4gIWwgPyBsIDogcHJlcGVuZChyZXBlYXQobGV2ZWwsIFwiIFwiKSkobCkpXG4gICAgLmpvaW4oXCJcXG5cIilcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvTGluZXMoLi4uc3Rycykge1xuICByZXR1cm4gc3Rycy5tYXAoYXBwZW5kKFwiXFxuXCIpKS5qb2luKFwiXCIpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXBlYXQobiwgcykge1xuICByZXR1cm4gQXJyYXkobiArIDEpLmpvaW4ocylcbn1cblxuY29uc3QgcHJlcGVuZCA9IHByZWZpeCA9PiBzID0+IHByZWZpeCArIHNcblxuY29uc3QgYXBwZW5kID0gc3VmZml4ID0+IHMgPT4gcyArIHN1ZmZpeFxuXG5leHBvcnQgY29uc3QgcmVtb3ZlUHJlZml4ID0gY3VycnkoXG4gIGZ1bmN0aW9uIHJlbW92ZVByZWZpeChwcmVmaXgsIHMpIHtcbiAgICBjb25zdCBoYXNQcmVmaXggPSBzLnNsaWNlKDAsIHByZWZpeC5sZW5ndGgpID09PSBwcmVmaXhcbiAgICByZXR1cm4gaGFzUHJlZml4ID8gcy5zbGljZShwcmVmaXgubGVuZ3RoKSA6IHNcbiAgfSlcblxuZXhwb3J0IGZ1bmN0aW9uIGxpbmVzKHMpIHtcbiAgcmV0dXJuIFN0cmluZyhzKS5zcGxpdCgvXFxyP1xcbi8pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmltTWFyZ2luKHMpIHtcbiAgY29uc3QgbG5zID0gbGluZXMocylcbiAgaWYgKGlzQmxhbmsoZmlyc3RPZihsbnMpKSkgbG5zLnNoaWZ0KClcbiAgaWYgKGlzQmxhbmsoIGxhc3RPZihsbnMpKSkgbG5zLnBvcCgpXG4gIGNvbnN0IGluaXRpYWxJbmRlbnQgPSAvXlsgXFx0XSovLmV4ZWMoZmlyc3RPZihsbnMpKVswXVxuICByZXR1cm4gbG5zXG4gICAgLm1hcChyZW1vdmVQcmVmaXgoaW5pdGlhbEluZGVudCkpXG4gICAgLmpvaW4oXCJcXG5cIilcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFN0cnVjdHVyZShwcmVmaXgsIGlubmFyZHMsIGRlbGltLCBzdWZmaXgpIHtcbiAgaWYgKGlubmFyZHMubGVuZ3RoIDwgMikge1xuICAgIHJldHVybiBwcmVmaXggKyBpbm5hcmRzLmpvaW4oXCJcIikgKyBzdWZmaXhcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJlZml4ICsgXCJcXG5cIlxuICAgICAgKyBpbmRlbnQoMiwgaW5uYXJkcy5qb2luKGRlbGltICsgXCJcXG5cIikpXG4gICAgICArIFwiXFxuXCIgKyBzdWZmaXhcbiAgfVxufVxuIiwiaW1wb3J0IHtwcmV0dHksIGluZGVudCwgdG9MaW5lcywgdHJpbU1hcmdpbiwgZm9ybWF0U3RydWN0dXJlfSBmcm9tIFwiLi9mb3JtYXR0aW5nLmpzXCJcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1blRlc3RzKHRlc3RzKSB7XG4gIGNvbnN0IHJlc3VsdHMgPSBbXVxuICBmb3IgKGNvbnN0IHRlc3Qgb2YgdGVzdHMpIHtcbiAgICBjb25zdCBlcnJvciA9IGF3YWl0IGVycm9yRnJvbSh0ZXN0LmZuKVxuICAgIGNvbnN0IGluc3RydW1lbnRMb2cgPSBkZWJ1Z0xvZ3MubWFwKGFyZ3MgPT4gKHt0eXBlOiBcImRlYnVnXCIsIGFyZ3N9KSlcbiAgICBkZWJ1Z0xvZ3MubGVuZ3RoID0gMFxuICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICB0ZXN0LFxuICAgICAgZXJyb3IsXG4gICAgICBpbnN0cnVtZW50TG9nXG4gICAgfSlcbiAgfVxuICByZXR1cm4ge3Jlc3VsdHN9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXN1bHQodGVzdCkge1xuICAvLyBXQVJOSU5HOiBpZiB5b3UgcmVtb3ZlIHRoZSBjYWxsIHRvIGVycm9yRnJvbSwgeW91IG11c3RcbiAgLy8gYWxzbyB1cGRhdGUgdGhlIHRlc3QgcmVzdWx0IGZvcm1hdHRlciwgd2hpY2ggdXNlcyB0aGVcbiAgLy8gZXJyb3JGcm9tIG5hbWUgdG8gaWRlbnRpZnkgdGhlIGVuZCBvZiB0aGUgdXNlZnVsXG4gIC8vIHN0YWNrdHJhY2UuXG4gIGNvbnN0IGVycm9yUHJvbWlzZSA9IGVycm9yRnJvbSh0ZXN0LmZuKVxuICBjb25zdCBpbnN0cnVtZW50TG9nID0gZGVidWdMb2dzLm1hcChhcmdzID0+ICh7dHlwZTogXCJkZWJ1Z1wiLCBhcmdzfSkpXG4gIHJldHVybiBlcnJvclByb21pc2UudGhlbihlcnJvciA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgdGVzdCxcbiAgICAgIGVycm9yLFxuICAgICAgaW5zdHJ1bWVudExvZyxcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdFxuICB9KVxufVxuXG4vLyBXQVJOSU5HOiBpZiB5b3UgY2hhbmdlIHRoZSBuYW1lIG9mIGVycm9yRnJvbSwgeW91IG11c3Rcbi8vIGFsc28gdXBkYXRlIHRoZSB0ZXN0IHJlc3VsdCBmb3JtYXR0ZXIsIHdoaWNoIHVzZXMgdGhlXG4vLyBlcnJvckZyb20gbmFtZSB0byBpZGVudGlmeSB0aGUgZW5kIG9mIHRoZSB1c2VmdWxcbi8vIHN0YWNrdHJhY2UuXG5leHBvcnQgZnVuY3Rpb24gZXJyb3JGcm9tKGYpIHtcbiAgbGV0IGNhdWdodDtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBmKClcbiAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICByZXN1bHQudGhlbigoKSA9PiByZXNvbHZlKCkpLmNhdGNoKHJlc29sdmUpXG4gICAgICB9KVxuICAgIH1cbiAgfSBjYXRjaChlKSB7XG4gICAgY2F1Z2h0ID0gZVxuICB9XG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUoY2F1Z2h0KTtcbn1cblxuZXhwb3J0IGNvbnN0IGRlYnVnTG9ncyA9IFtdXG5leHBvcnQgZnVuY3Rpb24gZGVidWcoLi4uYXJncykge1xuICBkZWJ1Z0xvZ3MucHVzaChhcmdzKVxufVxuIiwiZXhwb3J0IHtydW5UZXN0cywgZGVidWd9IGZyb20gXCIuL3Rlc3QtcnVubmVyLmltcGwuanNcIlxuaW1wb3J0IHtydW5UZXN0cywgZGVidWcsIGRlYnVnTG9nc30gZnJvbSBcIi4vdGVzdC1ydW5uZXIuaW1wbC5qc1wiXG5cbmltcG9ydCB7Y3Vycnl9IGZyb20gXCIuL2N1cnJ5LmpzXCJcbmltcG9ydCB7dGVzdCwgZXhwZWN0LCBFeHBlY3RhdGlvbkZhaWx1cmV9IGZyb20gXCIuL3Rlc3RpbmcuanNcIlxuaW1wb3J0IHtpcywgbm90LCBlcXVhbHMsIHdoaWNofSBmcm9tIFwiLi9wcmVkaWNhdGVzLmpzXCJcbmltcG9ydCB7dHJpbU1hcmdpbn0gZnJvbSBcIi4vZm9ybWF0dGluZy5qc1wiXG5cbmZ1bmN0aW9uIGlzRGVmaW5lZCh4KSB7XG4gIHJldHVybiB0eXBlb2YgeCAhPT0gXCJ1bmRlZmluZWRcIlxufVxuXG5jb25zdCBpc0V4cGVjdGF0aW9uRmFpbHVyZSA9IGN1cnJ5KFxuICBmdW5jdGlvbiBpc0V4cGVjdGF0aW9uRmFpbHVyZShhcmdzLCBlcnJvcikge1xuICAgIHJldHVybiBlcnJvciBpbnN0YW5jZW9mIEV4cGVjdGF0aW9uRmFpbHVyZSAmJlxuICAgICAgZXF1YWxzKGFyZ3MsIGVycm9yLmV4cGVjdEFyZ3MpXG4gIH0pXG5cbnRlc3QoXCJydW5UZXN0c1wiLCB7XG4gIGFzeW5jIFwiZ2l2ZW4gbm8gdGVzdHNcIigpIHtcbiAgICBleHBlY3QoYXdhaXQgcnVuVGVzdHMoW10pLCBlcXVhbHMsIHtcbiAgICAgIHJlc3VsdHM6IFtdLFxuICAgIH0pXG4gIH0sXG5cbiAgYXN5bmMgXCJnaXZlbiBhIHBhc3NpbmcgdGVzdFwiKCkge1xuICAgIGNvbnN0IGR1bW15VGVzdEZuID0gKCkgPT4ge31cbiAgICBjb25zdCB7cmVzdWx0c30gPSBhd2FpdCBydW5UZXN0cyhbXG4gICAgICB7XG4gICAgICAgIHN1YmplY3Q6IFwiYSB0aGluZ1wiLFxuICAgICAgICBzY2VuYXJpbzogXCJkb2VzIHNvbWV0aGluZ1wiLFxuICAgICAgICBmbjogZHVtbXlUZXN0Rm4sXG4gICAgICB9LFxuICAgIF0pXG4gICAgZXhwZWN0KHJlc3VsdHMsIGVxdWFscywgW1xuICAgICAge1xuICAgICAgICB0ZXN0OiB7XG4gICAgICAgICAgc3ViamVjdDogXCJhIHRoaW5nXCIsXG4gICAgICAgICAgc2NlbmFyaW86IFwiZG9lcyBzb21ldGhpbmdcIixcbiAgICAgICAgICBmbjogZHVtbXlUZXN0Rm4sXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiB1bmRlZmluZWQsXG4gICAgICAgIGluc3RydW1lbnRMb2c6IFtdLFxuICAgICAgfVxuICAgIF0pXG4gIH0sXG5cbiAgYXN5bmMgXCJnaXZlbiBhIGZhaWxpbmcgdGVzdFwiKCkge1xuICAgIGNvbnN0IHtyZXN1bHRzfSA9IGF3YWl0IHJ1blRlc3RzKFtcbiAgICAgIHtcbiAgICAgICAgc3ViamVjdDogXCJhIHRoaW5nXCIsXG4gICAgICAgIHNjZW5hcmlvOiBcImRvZXMgc29tZXRoaW5nXCIsXG4gICAgICAgIGZuKCkgeyBleHBlY3QoZmFsc2UsIGlzLCB0cnVlKSB9LFxuICAgICAgfSxcbiAgICBdKVxuICAgIGV4cGVjdChyZXN1bHRzLCBlcXVhbHMsIFtcbiAgICAgIHtcbiAgICAgICAgdGVzdDogd2hpY2goaXNEZWZpbmVkKSxcbiAgICAgICAgZXJyb3I6IHdoaWNoKGlzRXhwZWN0YXRpb25GYWlsdXJlKFtmYWxzZSwgaXMsIHRydWVdKSksXG4gICAgICAgIGluc3RydW1lbnRMb2c6IFtdLFxuICAgICAgfVxuICAgIF0pXG4gIH0sXG5cbiAgYXN5bmMgXCJnaXZlbiBhIHRlc3QgdGhhdCBkZWJ1Z3NcIigpIHtcbiAgICBjb25zdCB7cmVzdWx0c30gPSBhd2FpdCBydW5UZXN0cyhbXG4gICAgICB7XG4gICAgICAgIHN1YmplY3Q6IFwiYSB0aGluZ1wiLFxuICAgICAgICBzY2VuYXJpbzogXCJkb2VzIHNvbWV0aGluZ1wiLFxuICAgICAgICBmbigpIHtcbiAgICAgICAgICBkZWJ1ZyhcImhlbGxvXCIsIFwidGhlcmVcIilcbiAgICAgICAgICBkZWJ1ZyhcImFub3RoZXJcIilcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSlcbiAgICBleHBlY3QocmVzdWx0cywgZXF1YWxzLCBbXG4gICAgICB7XG4gICAgICAgIHRlc3Q6IHdoaWNoKGlzRGVmaW5lZCksXG4gICAgICAgIGVycm9yOiB1bmRlZmluZWQsXG4gICAgICAgIGluc3RydW1lbnRMb2c6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiBcImRlYnVnXCIsXG4gICAgICAgICAgICBhcmdzOiBbXCJoZWxsb1wiLCBcInRoZXJlXCJdXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiBcImRlYnVnXCIsXG4gICAgICAgICAgICBhcmdzOiBbXCJhbm90aGVyXCJdXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH1cbiAgICBdKVxuICAgIGRlYnVnTG9ncy5sZW5ndGggPSAwXG4gIH0sXG5cbiAgYXN5bmMgXCJnaXZlbiBhbiBhc3luYyB0ZXN0IHRoYXQgZGVidWdzXCIoKSB7XG4gICAgY29uc3Qge3Jlc3VsdHN9ID0gYXdhaXQgcnVuVGVzdHMoW1xuICAgICAge1xuICAgICAgICBzdWJqZWN0OiBcImEgdGhpbmdcIixcbiAgICAgICAgc2NlbmFyaW86IFwiZG9lcyBzb21ldGhpbmdcIixcbiAgICAgICAgYXN5bmMgZm4oKSB7XG4gICAgICAgICAgZGVidWcoXCJiZWZvcmUgYXdhaXRcIilcbiAgICAgICAgICBhd2FpdCBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICAgIGRlYnVnKFwiYWZ0ZXIgYXdhaXRcIilcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSlcblxuICAgIGV4cGVjdChyZXN1bHRzLCBlcXVhbHMsIFtcbiAgICAgIHtcbiAgICAgICAgdGVzdDogd2hpY2goaXNEZWZpbmVkKSxcbiAgICAgICAgZXJyb3I6IHVuZGVmaW5lZCxcbiAgICAgICAgaW5zdHJ1bWVudExvZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6IFwiZGVidWdcIixcbiAgICAgICAgICAgIGFyZ3M6IFtcImJlZm9yZSBhd2FpdFwiXVxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogXCJkZWJ1Z1wiLFxuICAgICAgICAgICAgYXJnczogW1wiYWZ0ZXIgYXdhaXRcIl1cbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfVxuICAgIF0pXG4gIH1cbn0pXG5cbnRlc3QoXCJkZWJ1ZyBsb2dnaW5nXCIsIHtcbiAgXCJsb2dzIGFsbCBhcmdzIHBhc3NlZFwiKCkge1xuICAgIGRlYnVnKFwiYXJnIDFcIiwgXCJhcmcgMlwiKVxuICAgIGV4cGVjdChkZWJ1Z0xvZ3MsIGVxdWFscywgW1tcImFyZyAxXCIsIFwiYXJnIDJcIl1dKVxuICAgIGRlYnVnTG9ncy5sZW5ndGggPSAwXG4gIH1cbn0pXG4iLCJpbXBvcnQge3RyaW1NYXJnaW4sIGluZGVudCwgZm9ybWF0U3RydWN0dXJlLCBwcmV0dHl9IGZyb20gXCIuL2Zvcm1hdHRpbmcuanNcIlxuaW1wb3J0IHtFeHBlY3RhdGlvbkZhaWx1cmV9IGZyb20gXCIuL3Rlc3RpbmcuanNcIlxuXG5jb25zdCBibGFua0xpbmUgPSBcIlxcblxcblwiXG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRUZXN0UmVzdWx0c0FzVGV4dCh7cmVzdWx0c30pIHtcbiAgbGV0IGFueUVycm9ycyA9IGZhbHNlXG4gIGxldCBhbnlJbnN0cnVtZW50YXRpb24gPSBmYWxzZVxuICBsZXQgcmVzdWx0c05lZWRpbmdBdHRlbnRpb24gPSBbXVxuICBmb3IgKGNvbnN0IHIgb2YgcmVzdWx0cykge1xuICAgIGxldCBuZWVkc0F0dGVudGlvbiA9IGZhbHNlXG4gICAgaWYgKHIuZXJyb3IpIHtcbiAgICAgIG5lZWRzQXR0ZW50aW9uID0gYW55RXJyb3JzID0gdHJ1ZVxuICAgIH1cbiAgICBpZiAoci5pbnN0cnVtZW50TG9nLmxlbmd0aCkge1xuICAgICAgbmVlZHNBdHRlbnRpb24gPSBhbnlJbnN0cnVtZW50YXRpb24gPSB0cnVlXG4gICAgfVxuICAgIGlmIChuZWVkc0F0dGVudGlvbikge1xuICAgICAgcmVzdWx0c05lZWRpbmdBdHRlbnRpb24ucHVzaChyKVxuICAgIH1cbiAgfVxuICBpZiAoYW55RXJyb3JzKSB7XG4gICAgcmV0dXJuIHN1aXRlRmFpbGVkKHJlc3VsdHNOZWVkaW5nQXR0ZW50aW9uKVxuICB9XG4gIGlmIChhbnlJbnN0cnVtZW50YXRpb24pIHtcbiAgICByZXR1cm4gc3VpdGVQYXNzZWRXaXRoSW5zdHJ1bWVudGF0aW9uKFxuICAgICAgcmVzdWx0cy5sZW5ndGgsXG4gICAgICByZXN1bHRzTmVlZGluZ0F0dGVudGlvbixcbiAgICApXG4gIH1cbiAgcmV0dXJuIHN1aXRlUGFzc2VkKHJlc3VsdHMubGVuZ3RoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVwb3J0c0ZhaWx1cmUodGVzdE91dHB1dCkge1xuICByZXR1cm4gL2ZhaWwvaS50ZXN0KHRlc3RPdXRwdXQpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdWl0ZUZhaWxlZChmYWlsdXJlcykge1xuICByZXR1cm4gZmFpbHVyZXNcbiAgICAubWFwKGZvcm1hdEZhaWx1cmUpXG4gICAgLmpvaW4oYmxhbmtMaW5lKVxuICAgICsgYmxhbmtMaW5lICsgXCJUZXN0cyBmYWlsZWQuXCJcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN1aXRlUGFzc2VkKG51bVBhc3NlZCkge1xuICBzd2l0Y2ggKG51bVBhc3NlZCkge1xuICAgIGNhc2UgMDogcmV0dXJuIFwiTm8gdGVzdHMgdG8gcnVuLlwiXG4gICAgY2FzZSAxOiByZXR1cm4gXCJPbmUgdGVzdCByYW4sIGFuZCBmb3VuZCBubyBpc3N1ZXMuXCJcbiAgICBkZWZhdWx0OiByZXR1cm4gYCR7bnVtUGFzc2VkfSB0ZXN0cyByYW4sIGFuZCBmb3VuZCBubyBpc3N1ZXMuYFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdWl0ZVBhc3NlZFdpdGhJbnN0cnVtZW50YXRpb24obnVtUGFzc2VkLCByZXN1bHRzV2l0aExvZ3MpIHtcbiAgcmV0dXJuIHJlc3VsdHNXaXRoTG9nc1xuICAgIC5tYXAoZm9ybWF0RmFpbHVyZSlcbiAgICAuam9pbihibGFua0xpbmUpXG4gICAgKyBibGFua0xpbmVcbiAgICArIGNvdW50UGFzc2VzKG51bVBhc3NlZCkgKyBcIiwgYnV0IGRlYnVnZ2luZyBpbnN0cnVtZW50YXRpb24gaXMgcHJlc2VudC5cXG5cIlxuICAgICsgXCJSZW1vdmUgaXQgYmVmb3JlIHNoaXBwaW5nLlwiXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb3VudFBhc3NlcyhuKSB7XG4gIHN3aXRjaCAobikge1xuICAgIGNhc2UgMTogcmV0dXJuIFwiVGhlIHRlc3QgcGFzc2VkXCJcbiAgICBjYXNlIDI6IHJldHVybiBcIkJvdGggdGVzdHMgcGFzc2VkXCJcbiAgICBkZWZhdWx0OiByZXR1cm4gYEFsbCAke259IHRlc3RzIHBhc3NlZGBcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RmFpbHVyZSh7dGVzdCwgZXJyb3IsIGluc3RydW1lbnRMb2d9KSB7XG4gIGNvbnN0IHRpdGxlID0gdGVzdC5zdWJqZWN0ICsgXCIgXCIgKyB0ZXN0LnNjZW5hcmlvXG4gIGNvbnN0IHNlY3Rpb25zID0gW3RpdGxlXVxuICBpZiAoaW5zdHJ1bWVudExvZy5sZW5ndGgpXG4gICAgc2VjdGlvbnMucHVzaChpbmRlbnQoMiwgZm9ybWF0RGVidWdMb2coaW5zdHJ1bWVudExvZykpKVxuICBpZiAoZXJyb3IpXG4gICAgc2VjdGlvbnMucHVzaChpbmRlbnQoMiwgZm9ybWF0RXJyb3IoZXJyb3IpKSlcbiAgcmV0dXJuIHNlY3Rpb25zLmpvaW4oXCJcXG5cIilcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdEVycm9yKGVycm9yKSB7XG4gIHJldHVybiBlcnJvciBpbnN0YW5jZW9mIEV4cGVjdGF0aW9uRmFpbHVyZVxuICAgID8gZm9ybWF0RXhwZWN0YXRpb25GYWlsdXJlKGVycm9yKVxuICAgIDogZm9ybWF0RXhjZXB0aW9uKGVycm9yKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RGVidWdMb2cobG9nKSB7XG4gIHJldHVybiBsb2dcbiAgICAubWFwKCh7YXJnc30pID0+IGZvcm1hdEZ1bmN0aW9uQ2FsbChcImRlYnVnXCIsIGFyZ3MpKVxuICAgIC5qb2luKFwiXCIpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRFeHBlY3RhdGlvbkZhaWx1cmUoZXJyb3IpIHtcbiAgcmV0dXJuIGZvcm1hdEZ1bmN0aW9uQ2FsbChcbiAgICBcImV4cGVjdFwiLFxuICAgIGVycm9yLmV4cGVjdEFyZ3NcbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RXhjZXB0aW9uKGVycm9yKSB7XG4gIHJldHVybiBwcmV0dHkoZXJyb3IpICsgXCIgdGhyb3duXCJcbiAgICArIGluZGVudCgyLCBzaW1wbGlmeVN0YWNrdHJhY2UoZXJyb3Iuc3RhY2spKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RnVuY3Rpb25DYWxsKG5hbWUsIGFyZ3MpIHtcbiAgcmV0dXJuIGZvcm1hdFN0cnVjdHVyZShuYW1lICsgXCIoXCIsIGFyZ3MubWFwKHByZXR0eSksIFwiLFwiLCBcIilcIilcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpbXBsaWZ5U3RhY2t0cmFjZShzdGFjaykge1xuICBpZiAoIXN0YWNrKSByZXR1cm4gXCJcIlxuICBjb25zdCBsaW5lcyA9IHRyaW1NYXJnaW4oc3RhY2spLnNwbGl0KFwiXFxuXCIpXG4gIHJldHVybiBcIlxcblwiXG4gICAgKyBsaW5lcy5zbGljZSgwLCBpbmRleE9mRmlyc3RJcnJlbGV2YW50U3RhY2tGcmFtZShsaW5lcykpXG4gICAgICAubWFwKGxpbmUgPT5cbiAgICAgICAgbGluZVxuICAgICAgICAgIC5yZXBsYWNlKC8oZmlsZTpcXC9cXC98aHR0cDpcXC9cXC9bXi9dKikvLCBcIlwiKVxuICAgICAgICAgIC5yZXBsYWNlKC9eKFteQF0qKUAoLiopJC8sIFwiYXQgJDEgKCQyKVwiKVxuICAgICAgKVxuICAgICAgLmpvaW4oXCJcXG5cIilcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluZGV4T2ZGaXJzdElycmVsZXZhbnRTdGFja0ZyYW1lKGxpbmVzKSB7XG4gIGNvbnN0IGkgPSBsaW5lcy5maW5kSW5kZXgobCA9PiBsLmluY2x1ZGVzKFwiZXJyb3JGcm9tXCIpKVxuICAvLyBJZiB0aGUgZXJyb3IgaXMgdGhyb3duIGZyb20gYXN5bmMgY29kZSwgZXJyb3JGcm9tXG4gIC8vIHdvbid0IGJlIG9uIHRoZSBzdGFjay4gSW4gdGhhdCBjYXNlLCBjb25zaWRlciBhbGwgc3RhY2tcbiAgLy8gZnJhbWVzIHJlbGV2YW50LlxuICBpZiAoaSA9PT0gLTEpIHJldHVybiBsaW5lcy5sZW5ndGhcbiAgZWxzZSByZXR1cm4gaVxufVxuIiwiZXhwb3J0IHtmb3JtYXRUZXN0UmVzdWx0c0FzVGV4dCwgcmVwb3J0c0ZhaWx1cmV9IGZyb20gXCIuL3BsYWluLXRleHQtdGVzdC1mb3JtYXR0ZXIuaW1wbC5qc1wiXG5cbmltcG9ydCB7Zm9ybWF0VGVzdFJlc3VsdHNBc1RleHQsIHJlcG9ydHNGYWlsdXJlLCBmb3JtYXRGdW5jdGlvbkNhbGx9IGZyb20gXCIuL3BsYWluLXRleHQtdGVzdC1mb3JtYXR0ZXIuaW1wbC5qc1wiXG5pbXBvcnQge3Rlc3QsIGV4cGVjdCwgRXhwZWN0YXRpb25GYWlsdXJlfSBmcm9tIFwiLi90ZXN0aW5nLmpzXCJcbmltcG9ydCB7aXMsIG5vdH0gZnJvbSBcIi4vcHJlZGljYXRlcy5qc1wiXG5pbXBvcnQge3RyaW1NYXJnaW59IGZyb20gXCIuL2Zvcm1hdHRpbmcuanNcIlxuXG5jb25zdCBiYXNlUGFzc2luZ1Rlc3QgPSBPYmplY3QuZnJlZXplKHtcbiAgdGVzdDoge1xuICAgIHN1YmplY3Q6IFwiYSB0aGluZ1wiLFxuICAgIHNjZW5hcmlvOiBcImRvZXMgc29tZXRoaW5nXCIsXG4gICAgZm4oKSB7fSxcbiAgfSxcbiAgZXJyb3I6IHVuZGVmaW5lZCxcbiAgaW5zdHJ1bWVudExvZzogW10sXG59KVxuXG5mdW5jdGlvbiBleHBlY3RPdXRwdXQodGVzdFJlc3VsdHMsIGV4cGVjdGVkKSB7XG4gIGV4cGVjdChcbiAgICBmb3JtYXRUZXN0UmVzdWx0c0FzVGV4dCh7cmVzdWx0czogdGVzdFJlc3VsdHN9KSxcbiAgICBpcywgZXhwZWN0ZWQpXG59XG5cbnRlc3QoXCJmb3JtYXRUZXN0UmVzdWx0c0FzVGV4dFwiLCB7XG4gIFwiZ2l2ZW4gbm8gdGVzdHNcIigpIHtcbiAgICBleHBlY3RPdXRwdXQoW10sIFwiTm8gdGVzdHMgdG8gcnVuLlwiKVxuICB9LFxuXG4gIFwiZ2l2ZW4gb25lIHBhc3NpbmcgdGVzdFwiKCkge1xuICAgIGV4cGVjdE91dHB1dChbYmFzZVBhc3NpbmdUZXN0XSxcbiAgICAgIFwiT25lIHRlc3QgcmFuLCBhbmQgZm91bmQgbm8gaXNzdWVzLlwiKVxuICB9LFxuXG4gIFwiZ2l2ZW4gbXVsdGlwbGUgcGFzc2luZyB0ZXN0c1wiKCkge1xuICAgIGNvbnN0IHRlc3RSZXN1bHRzID0gW1xuICAgICAgYmFzZVBhc3NpbmdUZXN0LFxuICAgICAgYmFzZVBhc3NpbmdUZXN0LFxuICAgIF1cbiAgICBleHBlY3RPdXRwdXQodGVzdFJlc3VsdHMsXG4gICAgICBcIjIgdGVzdHMgcmFuLCBhbmQgZm91bmQgbm8gaXNzdWVzLlwiKVxuICB9LFxuXG4gIFwiZ2l2ZW4gYSBmYWlsaW5nIHRlc3RcIigpIHtcbiAgICBjb25zdCB0ZXN0UmVzdWx0cyA9IFtcbiAgICAgIHtcbiAgICAgICAgLi4uYmFzZVBhc3NpbmdUZXN0LFxuICAgICAgICBlcnJvcjogbmV3IEV4cGVjdGF0aW9uRmFpbHVyZShbMSwgaXMsIDJdKVxuICAgICAgfVxuICAgIF1cbiAgICBleHBlY3RPdXRwdXQodGVzdFJlc3VsdHMsIHRyaW1NYXJnaW5gXG4gICAgICBhIHRoaW5nIGRvZXMgc29tZXRoaW5nXG4gICAgICAgIGV4cGVjdChcbiAgICAgICAgICAxLFxuICAgICAgICAgIGlzLFxuICAgICAgICAgIDJcbiAgICAgICAgKVxuXG4gICAgICBUZXN0cyBmYWlsZWQuXG4gICAgYClcbiAgfSxcblxuICBcImdpdmVuIG11bHRpcGxlIGZhaWxpbmcgdGVzdHNcIigpIHtcbiAgICBjb25zdCB0ZXN0UmVzdWx0cyA9IFtcbiAgICAgIHtcbiAgICAgICAgLi4uYmFzZVBhc3NpbmdUZXN0LFxuICAgICAgICBlcnJvcjogbmV3IEV4cGVjdGF0aW9uRmFpbHVyZShbMSwgaXMsIDJdKVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgLi4uYmFzZVBhc3NpbmdUZXN0LFxuICAgICAgICB0ZXN0OiB7XG4gICAgICAgICAgLi4uYmFzZVBhc3NpbmdUZXN0LnRlc3QsXG4gICAgICAgICAgc2NlbmFyaW86IFwiZG9lcyBhIHNlY29uZCB0aGluZ1wiXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yOiBuZXcgRXhwZWN0YXRpb25GYWlsdXJlKFszLCBpcywgNF0pXG4gICAgICB9XG4gICAgXVxuICAgIGV4cGVjdE91dHB1dCh0ZXN0UmVzdWx0cywgdHJpbU1hcmdpbmBcbiAgICAgIGEgdGhpbmcgZG9lcyBzb21ldGhpbmdcbiAgICAgICAgZXhwZWN0KFxuICAgICAgICAgIDEsXG4gICAgICAgICAgaXMsXG4gICAgICAgICAgMlxuICAgICAgICApXG5cbiAgICAgIGEgdGhpbmcgZG9lcyBhIHNlY29uZCB0aGluZ1xuICAgICAgICBleHBlY3QoXG4gICAgICAgICAgMyxcbiAgICAgICAgICBpcyxcbiAgICAgICAgICA0XG4gICAgICAgIClcblxuICAgICAgVGVzdHMgZmFpbGVkLlxuICAgIGApXG4gIH0sXG5cbiAgXCJzaG93cyBkZWJ1ZyBsb2dzXCIoKSB7XG4gICAgY29uc3QgdGVzdFJlc3VsdHMgPSBbXG4gICAgICB7XG4gICAgICAgIC4uLmJhc2VQYXNzaW5nVGVzdCxcbiAgICAgICAgaW5zdHJ1bWVudExvZzogW1xuICAgICAgICAgIHt0eXBlOiBcImRlYnVnXCIsIGFyZ3M6IFtcImhlbGxvXCJdfVxuICAgICAgICBdXG4gICAgICB9XG4gICAgXVxuICAgIGV4cGVjdE91dHB1dCh0ZXN0UmVzdWx0cywgdHJpbU1hcmdpbmBcbiAgICAgIGEgdGhpbmcgZG9lcyBzb21ldGhpbmdcbiAgICAgICAgZGVidWcoXCJoZWxsb1wiKVxuXG4gICAgICBUaGUgdGVzdCBwYXNzZWQsIGJ1dCBkZWJ1Z2dpbmcgaW5zdHJ1bWVudGF0aW9uIGlzIHByZXNlbnQuXG4gICAgICBSZW1vdmUgaXQgYmVmb3JlIHNoaXBwaW5nLlxuICAgIGApXG4gIH0sXG5cbiAgXCJzaG93cyBkZWJ1ZyBsb2dzIGZvciB0d28gdGVzdHNcIigpIHtcbiAgICBjb25zdCB0ZXN0UmVzdWx0cyA9IFtcbiAgICAgIHtcbiAgICAgICAgLi4uYmFzZVBhc3NpbmdUZXN0LFxuICAgICAgICBpbnN0cnVtZW50TG9nOiBbXG4gICAgICAgICAge3R5cGU6IFwiZGVidWdcIiwgYXJnczogW1wiaGVsbG9cIl19XG4gICAgICAgIF1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIC4uLmJhc2VQYXNzaW5nVGVzdCxcbiAgICAgICAgaW5zdHJ1bWVudExvZzogW1xuICAgICAgICAgIHt0eXBlOiBcImRlYnVnXCIsIGFyZ3M6IFtcImJsYWhcIl19XG4gICAgICAgIF1cbiAgICAgIH0sXG4gICAgXVxuICAgIGV4cGVjdE91dHB1dCh0ZXN0UmVzdWx0cywgdHJpbU1hcmdpbmBcbiAgICAgIGEgdGhpbmcgZG9lcyBzb21ldGhpbmdcbiAgICAgICAgZGVidWcoXCJoZWxsb1wiKVxuXG4gICAgICBhIHRoaW5nIGRvZXMgc29tZXRoaW5nXG4gICAgICAgIGRlYnVnKFwiYmxhaFwiKVxuXG4gICAgICBCb3RoIHRlc3RzIHBhc3NlZCwgYnV0IGRlYnVnZ2luZyBpbnN0cnVtZW50YXRpb24gaXMgcHJlc2VudC5cbiAgICAgIFJlbW92ZSBpdCBiZWZvcmUgc2hpcHBpbmcuXG4gICAgYClcbiAgfSxcblxuICBcInNob3dzIGRlYnVnIGxvZ3MgZm9yIHRocmVlIHRlc3RzXCIoKSB7XG4gICAgY29uc3QgdGVzdFJlc3VsdHMgPSBbXG4gICAgICB7XG4gICAgICAgIC4uLmJhc2VQYXNzaW5nVGVzdCxcbiAgICAgICAgaW5zdHJ1bWVudExvZzogW1xuICAgICAgICAgIHt0eXBlOiBcImRlYnVnXCIsIGFyZ3M6IFtcImhlbGxvXCJdfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAuLi5iYXNlUGFzc2luZ1Rlc3QsXG4gICAgICAgIGluc3RydW1lbnRMb2c6IFtcbiAgICAgICAgICB7dHlwZTogXCJkZWJ1Z1wiLCBhcmdzOiBbXCJibGFoXCJdfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAuLi5iYXNlUGFzc2luZ1Rlc3QsXG4gICAgICB9LFxuICAgIF1cbiAgICBleHBlY3RPdXRwdXQodGVzdFJlc3VsdHMsIHRyaW1NYXJnaW5gXG4gICAgICBhIHRoaW5nIGRvZXMgc29tZXRoaW5nXG4gICAgICAgIGRlYnVnKFwiaGVsbG9cIilcblxuICAgICAgYSB0aGluZyBkb2VzIHNvbWV0aGluZ1xuICAgICAgICBkZWJ1ZyhcImJsYWhcIilcblxuICAgICAgQWxsIDMgdGVzdHMgcGFzc2VkLCBidXQgZGVidWdnaW5nIGluc3RydW1lbnRhdGlvbiBpcyBwcmVzZW50LlxuICAgICAgUmVtb3ZlIGl0IGJlZm9yZSBzaGlwcGluZy5cbiAgICBgKVxuICB9LFxuXG4gIFwic2hvd3MgZGVidWcgbG9ncyBpbiB0aGUgcHJlc2VuY2Ugb2YgZmFpbHVyZXNcIigpIHtcbiAgICBjb25zdCB0ZXN0UmVzdWx0cyA9IFtcbiAgICAgIHtcbiAgICAgICAgLi4uYmFzZVBhc3NpbmdUZXN0LFxuICAgICAgICBpbnN0cnVtZW50TG9nOiBbXG4gICAgICAgICAge3R5cGU6IFwiZGVidWdcIiwgYXJnczogW1wiaGVsbG9cIl19XG4gICAgICAgIF0sXG4gICAgICAgIGVycm9yOiBuZXcgRXhwZWN0YXRpb25GYWlsdXJlKFsxLCBpcywgMl0pXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAuLi5iYXNlUGFzc2luZ1Rlc3QsXG4gICAgICAgIGluc3RydW1lbnRMb2c6IFtcbiAgICAgICAgICB7dHlwZTogXCJkZWJ1Z1wiLCBhcmdzOiBbXCJibGFoXCJdfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAuLi5iYXNlUGFzc2luZ1Rlc3QsXG4gICAgICAgIGVycm9yOiBuZXcgRXhwZWN0YXRpb25GYWlsdXJlKFszLCBpcywgNF0pXG4gICAgICB9LFxuICAgIF1cbiAgICBleHBlY3RPdXRwdXQodGVzdFJlc3VsdHMsIHRyaW1NYXJnaW5gXG4gICAgICBhIHRoaW5nIGRvZXMgc29tZXRoaW5nXG4gICAgICAgIGRlYnVnKFwiaGVsbG9cIilcbiAgICAgICAgZXhwZWN0KFxuICAgICAgICAgIDEsXG4gICAgICAgICAgaXMsXG4gICAgICAgICAgMlxuICAgICAgICApXG5cbiAgICAgIGEgdGhpbmcgZG9lcyBzb21ldGhpbmdcbiAgICAgICAgZGVidWcoXCJibGFoXCIpXG5cbiAgICAgIGEgdGhpbmcgZG9lcyBzb21ldGhpbmdcbiAgICAgICAgZXhwZWN0KFxuICAgICAgICAgIDMsXG4gICAgICAgICAgaXMsXG4gICAgICAgICAgNFxuICAgICAgICApXG5cbiAgICAgIFRlc3RzIGZhaWxlZC5cbiAgICBgKVxuICB9LFxuXG4gIFwiZm9ybWF0cyBhbiBlcnJvciB3aXRoIGEgRmlyZWZveCBzdGFja3RyYWNlXCIoKSB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoXCJ0ZXN0IGVycm9yXCIpXG4gICAgLy8gVGhpcyBpcyBhIHJlYWwgc3RhY2t0cmFjZSBjb3B5LXBhc3RlZCBmcm9tIEZpcmVmb3hcbiAgICBlcnJvci5zdGFjayA9IHRyaW1NYXJnaW5gXG4gICAgICBrYWJsb29pZUBodHRwOi8vbG9jYWxob3N0OjgwODAvc3JjL3BsYWluLXRleHQtdGVzdC1mb3JtYXR0ZXIuanM6MjE3OjEzXG4gICAgICBmb3JtYXRzIGFuIGVycm9yIHdpdGggYSBzdGFja3RyYWNlQGh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9zcmMvcGxhaW4tdGV4dC10ZXN0LWZvcm1hdHRlci5qczoyMjE6N1xuICAgICAgZXJyb3JGcm9tQGh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9zcmMvdGVzdC1ydW5uZXIuanM6MTU6OVxuICAgICAgcmVzdWx0QGh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9zcmMvdGVzdC1ydW5uZXIuanM6MjQ6MjZcbiAgICAgIHJ1blRlc3RzQGh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC9zcmMvdGVzdC1ydW5uZXIuanM6MjA6MjZcbiAgICAgIHJ1bkFuZEZvcm1hdEBodHRwOi8vbG9jYWxob3N0OjgwODAvOjE0OjQ5XG4gICAgICBAaHR0cDovL2xvY2FsaG9zdDo4MDgwLzoxNzoyMlxuICAgIGBcbiAgICBjb25zdCB0ZXN0UmVzdWx0cyA9IFt7Li4uYmFzZVBhc3NpbmdUZXN0LCBlcnJvcn1dXG4gICAgZXhwZWN0T3V0cHV0KHRlc3RSZXN1bHRzLCB0cmltTWFyZ2luYFxuICAgICAgYSB0aGluZyBkb2VzIHNvbWV0aGluZ1xuICAgICAgICBFcnJvcihcInRlc3QgZXJyb3JcIikgdGhyb3duXG4gICAgICAgICAgYXQga2FibG9vaWUgKC9zcmMvcGxhaW4tdGV4dC10ZXN0LWZvcm1hdHRlci5qczoyMTc6MTMpXG4gICAgICAgICAgYXQgZm9ybWF0cyBhbiBlcnJvciB3aXRoIGEgc3RhY2t0cmFjZSAoL3NyYy9wbGFpbi10ZXh0LXRlc3QtZm9ybWF0dGVyLmpzOjIyMTo3KVxuXG4gICAgICBUZXN0cyBmYWlsZWQuXG4gICAgYClcbiAgfSxcblxuICBcImZvcm1hdHMgYW4gZXJyb3Igd2l0aCBhIENocm9tZSBzdGFja3RyYWNlXCIoKSB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoXCJ0ZXN0IGVycm9yXCIpXG4gICAgLy8gVGhpcyBpcyByZWFsIHN0YWNrdHJhY2UgY29weS1wYXN0ZWQgZnJvbSBDaHJvbWUuXG4gICAgZXJyb3Iuc3RhY2sgPSB0cmltTWFyZ2luYFxuICAgICAgRXJyb3I6IHRlc3QgZXJyb3JcbiAgICAgICAgICBhdCByZXBlYXRzIGEgc3RyaW5nIHplcm8gdGltZXMgKGZvcm1hdHRpbmcuanM6MTQpXG4gICAgICAgICAgYXQgZXJyb3JGcm9tICh0ZXN0LXJ1bm5lci5pbXBsLmpzOjQyKVxuICAgICAgICAgIGF0IHJ1blRlc3RzICh0ZXN0LXJ1bm5lci5pbXBsLmpzOjYpXG4gICAgICAgICAgYXQgYXN5bmMgKGluZGV4KToxN1xuICAgIGBcbiAgICBjb25zdCB0ZXN0UmVzdWx0cyA9IFt7Li4uYmFzZVBhc3NpbmdUZXN0LCBlcnJvcn1dXG4gICAgZXhwZWN0T3V0cHV0KHRlc3RSZXN1bHRzLCB0cmltTWFyZ2luYFxuICAgICAgYSB0aGluZyBkb2VzIHNvbWV0aGluZ1xuICAgICAgICBFcnJvcihcInRlc3QgZXJyb3JcIikgdGhyb3duXG4gICAgICAgICAgRXJyb3I6IHRlc3QgZXJyb3JcbiAgICAgICAgICAgICAgYXQgcmVwZWF0cyBhIHN0cmluZyB6ZXJvIHRpbWVzIChmb3JtYXR0aW5nLmpzOjE0KVxuXG4gICAgICBUZXN0cyBmYWlsZWQuXG4gICAgYClcbiAgfSxcblxuICBcImZvcm1hdHMgYW4gZXJyb3IgdGhyb3duIGZyb20gYXN5bmMgY29kZSBvbiBGaXJlZm94XCIoKSB7XG4gICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IoXCJ0ZXN0IGVycm9yXCIpXG4gICAgLy8gVGhpcyBpcyBhIHJlYWwgc3RhY2t0cmFjZSBjb3B5LXBhc3RlZCBmcm9tIEZpcmVmb3hcbiAgICBlcnJvci5zdGFjayA9IHRyaW1NYXJnaW5gXG4gICAgICByZXBlYXRzIGEgc3RyaW5nIHplcm8gdGltZXNAaHR0cDovL2xvY2FsaG9zdDo4MDgwL3NyYy9mb3JtYXR0aW5nLmpzOjE1OjExXG4gICAgICBhc3luYyplcnJvckZyb21AaHR0cDovL2xvY2FsaG9zdDo4MDgwL3NyYy90ZXN0LXJ1bm5lci5pbXBsLmpzOjQyOjIwXG4gICAgICBydW5UZXN0c0BodHRwOi8vbG9jYWxob3N0OjgwODAvc3JjL3Rlc3QtcnVubmVyLmltcGwuanM6NjoyNVxuICAgICAgYXN5bmMqQGh0dHA6Ly9sb2NhbGhvc3Q6ODA4MC86MTc6MjNcbiAgICBgXG4gICAgY29uc3QgdGVzdFJlc3VsdHMgPSBbey4uLmJhc2VQYXNzaW5nVGVzdCwgZXJyb3J9XVxuICAgIGV4cGVjdE91dHB1dCh0ZXN0UmVzdWx0cywgdHJpbU1hcmdpbmBcbiAgICAgIGEgdGhpbmcgZG9lcyBzb21ldGhpbmdcbiAgICAgICAgRXJyb3IoXCJ0ZXN0IGVycm9yXCIpIHRocm93blxuICAgICAgICAgIGF0IHJlcGVhdHMgYSBzdHJpbmcgemVybyB0aW1lcyAoL3NyYy9mb3JtYXR0aW5nLmpzOjE1OjExKVxuXG4gICAgICBUZXN0cyBmYWlsZWQuXG4gICAgYClcbiAgfSxcblxuICBcImZvcm1hdHMgYW4gZXJyb3IgdGhyb3duIGZyb20gYXN5bmMgY29kZSBvbiBDaHJvbWVcIigpIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcInRlc3QgZXJyb3JcIilcbiAgICAvLyBUaGlzIGlzIHJlYWwgc3RhY2t0cmFjZSBjb3B5LXBhc3RlZCBmcm9tIENocm9tZS5cbiAgICBlcnJvci5zdGFjayA9IHRyaW1NYXJnaW5gXG4gICAgICBFcnJvcjogdGVzdCBlcnJvclxuICAgICAgICAgIGF0IHJlcGVhdHMgYSBzdHJpbmcgemVybyB0aW1lcyAoZm9ybWF0dGluZy5qczoxNSlcbiAgICBgXG4gICAgY29uc3QgdGVzdFJlc3VsdHMgPSBbey4uLmJhc2VQYXNzaW5nVGVzdCwgZXJyb3J9XVxuICAgIGV4cGVjdE91dHB1dCh0ZXN0UmVzdWx0cywgdHJpbU1hcmdpbmBcbiAgICAgIGEgdGhpbmcgZG9lcyBzb21ldGhpbmdcbiAgICAgICAgRXJyb3IoXCJ0ZXN0IGVycm9yXCIpIHRocm93blxuICAgICAgICAgIEVycm9yOiB0ZXN0IGVycm9yXG4gICAgICAgICAgICAgIGF0IHJlcGVhdHMgYSBzdHJpbmcgemVybyB0aW1lcyAoZm9ybWF0dGluZy5qczoxNSlcblxuICAgICAgVGVzdHMgZmFpbGVkLlxuICAgIGApXG4gIH0sXG5cbiAgXCJmb3JtYXRzIGEgdGhyb3dhYmxlIHdpdGhvdXQgYSBzdGFja3RyYWNlXCIoKSB7XG4gICAgY29uc3QgdGVzdFJlc3VsdHMgPSBbey4uLmJhc2VQYXNzaW5nVGVzdCwgZXJyb3I6IFwidGVzdCBlcnJvclwifV1cbiAgICBleHBlY3RPdXRwdXQodGVzdFJlc3VsdHMsIHRyaW1NYXJnaW5gXG4gICAgICBhIHRoaW5nIGRvZXMgc29tZXRoaW5nXG4gICAgICAgIFwidGVzdCBlcnJvclwiIHRocm93blxuXG4gICAgICBUZXN0cyBmYWlsZWQuXG4gICAgYClcbiAgfVxufSlcblxudGVzdChcImZvcm1hdEZ1bmN0aW9uQ2FsbFwiLCB7XG4gIFwiZ2l2ZW4gbm8gZnVuY3Rpb24gYXJnc1wiKCkge1xuICAgIGV4cGVjdChmb3JtYXRGdW5jdGlvbkNhbGwoXCJteUZ1bmNcIiwgW10pLCBpcywgXCJteUZ1bmMoKVwiKVxuICB9LFxuXG4gIFwiZ2l2ZW4gb25lIGFyZ1wiKCkge1xuICAgIGV4cGVjdChmb3JtYXRGdW5jdGlvbkNhbGwoXCJteUZ1bmNcIiwgW1wiYVwiXSksIGlzLCAnbXlGdW5jKFwiYVwiKScpXG4gIH0sXG5cbiAgXCJnaXZlbiBtdWx0aXBsZSBhcmdzXCIoKSB7XG4gICAgZXhwZWN0KGZvcm1hdEZ1bmN0aW9uQ2FsbChcIm15RnVuY1wiLCBbXCJhXCIsIFwiYlwiXSksIGlzLCB0cmltTWFyZ2luYFxuICAgICAgbXlGdW5jKFxuICAgICAgICBcImFcIixcbiAgICAgICAgXCJiXCJcbiAgICAgIClcbiAgICBgKVxuICB9LFxufSlcblxudGVzdChcInJlcG9ydHNGYWlsdXJlXCIsIHtcbiAgXCJnaXZlbiBzdWNjZXNzXCIoKSB7XG4gICAgZXhwZWN0KHJlcG9ydHNGYWlsdXJlKFwiMTAgdGVzdHMgcmFuXCIpLCBpcywgZmFsc2UpXG4gIH0sXG5cbiAgXCJnaXZlbiBmYWlsdXJlXCIoKSB7XG4gICAgZXhwZWN0KHJlcG9ydHNGYWlsdXJlKFwiVGVzdHMgZmFpbGVkXCIpLCBpcywgdHJ1ZSlcbiAgfSxcblxuICBcIm1hdGNoZXMgJ2ZhaWwnIGNhc2UgaW5zZW5zaXRpdmVseVwiKCkge1xuICAgIGV4cGVjdChcIkZBSUxcIiwgcmVwb3J0c0ZhaWx1cmUpXG4gICAgZXhwZWN0KFwiQSBGQUlMVVJFXCIsIHJlcG9ydHNGYWlsdXJlKVxuICAgIGV4cGVjdChcImZhaWxcIiwgcmVwb3J0c0ZhaWx1cmUpXG4gICAgZXhwZWN0KFwic29tZXRoaW5nIGZhaWxlZFwiLCByZXBvcnRzRmFpbHVyZSlcbiAgICBleHBlY3QoXCJmXCIsIG5vdChyZXBvcnRzRmFpbHVyZSkpXG4gIH1cbn0pXG4iLCJleHBvcnQge3J1blRlc3RzLCBkZWJ1Z30gZnJvbSBcIi4vc3JjL3Rlc3QtcnVubmVyLmpzXCJcbmV4cG9ydCB7ZXhwZWN0LCBjcmVhdGVTdWl0ZX0gZnJvbSBcIi4vc3JjL3Rlc3RpbmcuanNcIlxuZXhwb3J0IHtpcywgbm90LCBlcXVhbHMsIHdoaWNofSBmcm9tIFwiLi9zcmMvcHJlZGljYXRlcy5qc1wiXG5leHBvcnQge2N1cnJ5fSBmcm9tIFwiLi9zcmMvY3VycnkuanNcIlxuZXhwb3J0IHtmb3JtYXRUZXN0UmVzdWx0c0FzVGV4dCwgcmVwb3J0c0ZhaWx1cmV9IGZyb20gXCIuL3NyYy9wbGFpbi10ZXh0LXRlc3QtZm9ybWF0dGVyLmpzXCJcblxuaW1wb3J0IHtjcmVhdGVTdWl0ZX0gZnJvbSBcIi4vc3JjL3Rlc3RpbmcuanNcIlxuaW1wb3J0IHtkZWJ1Z30gZnJvbSBcIi4vc3JjL3Rlc3QtcnVubmVyLmpzXCJcblxuY29uc3Qgc3VpdGUgPSBjcmVhdGVTdWl0ZSgpXG5cbmV4cG9ydCBjb25zdCB7Z2V0QWxsVGVzdHN9ID0gc3VpdGVcblxuZXhwb3J0IGZ1bmN0aW9uIHRlc3QoLi4uYXJncykge1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09IFwicHJvZHVjdGlvblwiKVxuICAgIHN1aXRlLnRlc3QoLi4uYXJncylcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLG1CQUFtQixHQUFHLE1BQU0sR0FBRTtBQUNwQyxNQUFNLGtCQUFrQixHQUFHLE1BQU0sR0FBRTtBQUNuQyxNQUFNLGNBQWMsR0FBRyxNQUFNLEdBQUU7QUFDL0IsTUFBTSxPQUFPLEdBQUcsTUFBTSxHQUFFO0FBQ3hCO0FBQ08sU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRTtBQUMvQixFQUFFLFNBQVMsT0FBTyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQzVCLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUU7QUFDakMsTUFBTSxPQUFPLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUN2QixLQUFLLE1BQU07QUFDWCxNQUFNLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxRQUFRLEtBQUssT0FBTyxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsUUFBUSxFQUFDO0FBQy9ELE1BQU0sRUFBRSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBQztBQUNqQyxNQUFNLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLFFBQU87QUFDdEMsTUFBTSxFQUFFLENBQUMsY0FBYyxDQUFDLEdBQUcsS0FBSTtBQUMvQixNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxPQUFPLENBQUMsT0FBTyxFQUFDO0FBQ3BDLE1BQU0sT0FBTyxFQUFFO0FBQ2YsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBQztBQUNsQyxFQUFFLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLFFBQU87QUFDdkMsRUFBRSxPQUFPLENBQUMsY0FBYyxDQUFDLEdBQUcsR0FBRTtBQUM5QixFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLElBQUksWUFBWSxDQUFDLENBQUMsRUFB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
