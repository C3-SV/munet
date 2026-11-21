// Cliente Supabase falso para pruebas de servicios. Cada consulta se resuelve con
// `handler(call)`, donde call = { table, op, steps, payload }:
//   op      primera escritura de la cadena (insert, update, delete) o 'select'
//   steps   [[método, ...args], ...] en orden
//   payload argumento de la escritura (para update/insert)
function fakeSupabase(handler) {
  return {
    from(table) {
      const steps = [];
      let op = 'select';
      let payload;
      const query = new Proxy({}, {
        get(_, method) {
          if (method === 'then') {
            return (resolve, reject) => {
              let result;
              try {
                result = handler({ table, op, steps, payload });
              } catch (error) {
                return Promise.reject(error).then(resolve, reject);
              }
              return Promise.resolve(result ?? { data: null, error: null }).then(resolve, reject);
            };
          }
          return (...args) => {
            if (op === 'select' && ['insert', 'update', 'delete', 'upsert'].includes(method)) {
              op = method;
              payload = args[0];
            }
            steps.push([method, ...args]);
            return query;
          };
        },
      });
      return query;
    },
  };
}

// ¿La cadena aplicó este filtro/método con estos argumentos?
const hasStep = (steps, method, ...args) =>
  steps.some((step) => step[0] === method && args.every((arg, index) => step[index + 1] === arg));

module.exports = { fakeSupabase, hasStep };
