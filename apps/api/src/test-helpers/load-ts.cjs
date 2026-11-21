// Carga un módulo TypeScript de la API en un contexto aislado, con importaciones simuladas.
// Mismo patrón que el resto de pruebas .cjs: sin ts-node ni resolución de rutas sin extensión.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

function loadTs(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      URL,
      Date,
      Set,
      Uint8Array,
      Error,
      ...globals,
      require(name) {
        assert.ok(name in imports, `Import inesperado: ${name}`);
        return imports[name];
      },
    },
  );

  return module.exports;
}

module.exports = { loadTs };
