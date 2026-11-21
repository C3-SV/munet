// Base en memoria con la parte de la API de supabase-js que usa el seed: from(tabla) con
// select/insert/update/delete, filtros eq/neq/is/in, limit/order y single/maybeSingle.
// No valida esquemas ni restricciones: sirve para comprobar el flujo, no la base real.
const { randomUUID } = require('node:crypto');

function memoryDb(initial = {}) {
  const tables = {};
  const log = [];
  for (const [name, rows] of Object.entries(initial)) tables[name] = rows.map((row) => ({ ...row }));
  const rowsOf = (name) => (tables[name] ??= []);

  const matches = (row, filters) => filters.every(({ op, column, value }) => {
    const actual = row[column] === undefined ? null : row[column];
    if (op === 'eq') return actual === value;
    if (op === 'neq') return actual !== value;
    if (op === 'is') return actual === value;
    if (op === 'in') return value.includes(actual);
    return true;
  });

  function from(table) {
    const state = { action: 'select', payload: null, filters: [], returning: false, limit: null, single: null };

    const run = () => {
      const rows = rowsOf(table);
      if (state.action === 'insert') {
        const list = Array.isArray(state.payload) ? state.payload : [state.payload];
        const inserted = list.map((row) => ({ id: randomUUID(), ...row }));
        rows.push(...inserted);
        log.push({ op: 'insert', table, count: inserted.length });
        if (!state.returning) return { data: null, error: null };
        return { data: Array.isArray(state.payload) ? inserted.map((r) => ({ ...r })) : { ...inserted[0] }, error: null };
      }
      const selected = rows.filter((row) => matches(row, state.filters));
      if (state.action === 'update') {
        selected.forEach((row) => Object.assign(row, state.payload));
        log.push({ op: 'update', table, count: selected.length, payload: state.payload });
        return { data: state.returning ? selected.map((r) => ({ ...r })) : null, error: null };
      }
      if (state.action === 'delete') {
        tables[table] = rows.filter((row) => !selected.includes(row));
        log.push({ op: 'delete', table, count: selected.length });
        return { data: null, error: null };
      }
      let result = selected.map((row) => ({ ...row }));
      if (state.limit !== null) result = result.slice(0, state.limit);
      if (state.single === 'maybe') return { data: result[0] ?? null, error: null };
      if (state.single === 'one') return result.length === 1 ? { data: result[0], error: null } : { data: null, error: { message: `se esperaba 1 fila y hay ${result.length}` } };
      return { data: result, error: null };
    };

    const builder = {
      select() { state.returning = true; return builder; },
      insert(payload) { state.action = 'insert'; state.payload = payload; return builder; },
      update(payload) { state.action = 'update'; state.payload = payload; return builder; },
      delete() { state.action = 'delete'; return builder; },
      eq(column, value) { state.filters.push({ op: 'eq', column, value }); return builder; },
      neq(column, value) { state.filters.push({ op: 'neq', column, value }); return builder; },
      is(column, value) { state.filters.push({ op: 'is', column, value }); return builder; },
      in(column, value) { state.filters.push({ op: 'in', column, value }); return builder; },
      limit(n) { state.limit = n; return builder; },
      order() { return builder; },
      maybeSingle() { state.single = 'maybe'; return Promise.resolve(run()); },
      single() { state.single = 'one'; return Promise.resolve(run()); },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return builder;
  }

  return { from, tables, log, rowsOf };
}

module.exports = { memoryDb };
