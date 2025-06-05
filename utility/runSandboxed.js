import 'ses';

// Lock down the global environment for security
lockdown();

/**
 * Executes a given function in a sandboxed environment.
 * @param {string} code - The code to execute.
 * @param {any} param - The parameter to pass to the function.
 * @returns {any} The result of the function execution.
 */
const execFunc = (code, param) => {
  const c = new Compartment({
    console,
  });
  const wrappedCode = `
    (${code})
  `;
  const func = c.evaluate(wrappedCode);
  const output = func(param);

  return output;
};

export default execFunc;