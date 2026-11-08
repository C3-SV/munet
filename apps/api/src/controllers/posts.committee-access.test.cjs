const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ project: 'apps/api/tsconfig.json' });

const plain = (val) => JSON.parse(JSON.stringify(val));

function compile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
}

// Carga controladora de posts mockeando Supabase y walls.service
function loadPostsController(mockSupabase, mockWalls = []) {
  const module = { exports: {} };
  const controllerCode = compile(__dirname + '/posts.controller.ts');

  vm.runInNewContext(controllerCode, {
    exports: module.exports,
    module,
    console,
    require(name) {
      if (name === '../services/comments.service') return {};
      if (name === '../services/posts.service') {
        // Cargamos posts.service real transpilado
        const serviceModule = { exports: {} };
        const serviceCode = compile(__dirname + '/../services/posts.service.ts');
        vm.runInNewContext(serviceCode, {
          exports: serviceModule.exports,
          module: serviceModule,
          console,
          require(serviceDep) {
            if (serviceDep === '../lib/supabase') return { supabaseAdmin: mockSupabase };
            if (serviceDep === '../types/posts.types') return { POST_SELECT: 'id' };
            if (serviceDep === '../utils/audit.logger') return { logAudit: async () => {} };
            if (serviceDep === '../utils/posts.utils') return require('../utils/posts.utils.ts');
            if (serviceDep === '../utils/rbac.utils') return require('../utils/rbac.utils.ts');
            if (serviceDep === './walls.service') {
              const wallsCode = compile(__dirname + '/../services/walls.service.ts');
              const wallsModule = { exports: {} };
              vm.runInNewContext(wallsCode, {
                exports: wallsModule.exports,
                module: wallsModule,
                console,
                require(wDep) {
                  if (wDep === '../lib/supabase') return { supabaseAdmin: mockSupabase };
                  if (wDep === '../utils/rbac.utils') return require('../utils/rbac.utils.ts');
                  if (wDep === '../utils/walls.utils') return require('../utils/walls.utils.ts');
                  throw new Error(`Dependencia no mockeada en walls.service: ${wDep}`);
                },
              });
              return {
                ...wallsModule.exports,
                loadWallsByEvent: async () => mockWalls,
              };
            }
            throw new Error(`Dependencia no mockeada en posts.service: ${serviceDep}`);
          },
        });
        return serviceModule.exports;
      }
      throw new Error(`Dependencia no mockeada en posts.controller: ${name}`);
    },
  });

  return module.exports;
}

const EVENT_1 = 'event-1';
const COMMITTEE_CS = 'comm-cs'; // Consejo de Seguridad
const COMMITTEE_AG = 'comm-ag'; // Asamblea General

const WALL_CS = {
  id: 'wall-cs',
  event_id: EVENT_1,
  name: 'Consejo de Seguridad',
  slug: 'comite-cs',
  wall_type: 'COMMITTEE',
  committee_id: COMMITTEE_CS,
  committees: { id: COMMITTEE_CS, name: 'Consejo de Seguridad', code: 'CS' },
  deleted_at: null,
};

const WALL_AG = {
  id: 'wall-ag',
  event_id: EVENT_1,
  name: 'Asamblea General',
  slug: 'comite-ag',
  wall_type: 'COMMITTEE',
  committee_id: COMMITTEE_AG,
  committees: { id: COMMITTEE_AG, name: 'Asamblea General', code: 'AG' },
  deleted_at: null,
};

const WALL_GENERAL = {
  id: 'wall-general',
  event_id: EVENT_1,
  name: 'General',
  slug: 'general',
  wall_type: 'GENERAL',
  committee_id: null,
  committees: null,
  deleted_at: null,
};

const ALL_WALLS = [WALL_GENERAL, WALL_CS, WALL_AG];

test('GET /posts: responde 403 cuando un delegado intenta ver posts de un comité ajeno', async () => {
  const { listPosts } = loadPostsController({}, ALL_WALLS);

  // Delegado pertenece a Asamblea General (COMMITTEE_AG), pero intenta entrar al muro de Consejo de Seguridad
  const req = {
    query: { muro: 'comite-cs' },
    header: (h) => (h.toLowerCase() === 'x-event-id' ? EVENT_1 : null),
    auth: {
      userId: 'user-delegado',
      memberships: [
        {
          id: 'mem-1',
          eventId: EVENT_1,
          role: 'PARTICIPANT',
          committeeId: COMMITTEE_AG,
        },
      ],
    },
  };

  let statusCode = 200;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
  };

  await listPosts(req, res);

  assert.equal(statusCode, 403);
  assert.equal(body.error, 'No tienes acceso a este muro');
});

test('POST /posts: responde 403 cuando un delegado intenta publicar en un comité ajeno', async () => {
  const { createPost } = loadPostsController({}, ALL_WALLS);

  // Delegado de Asamblea General intenta publicar en el muro de Consejo de Seguridad
  const req = {
    body: {
      muro: 'comite-cs',
      content: 'Mensaje no permitido en comite ajeno',
    },
    header: (h) => (h.toLowerCase() === 'x-event-id' ? EVENT_1 : null),
    auth: {
      userId: 'user-delegado',
      memberships: [
        {
          id: 'mem-1',
          eventId: EVENT_1,
          role: 'PARTICIPANT',
          committeeId: COMMITTEE_AG,
        },
      ],
    },
  };

  let statusCode = 200;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
  };

  await createPost(req, res);

  assert.equal(statusCode, 403);
  assert.equal(body.error, 'No tienes acceso a este muro');
});

test('GET /posts: responde 403 si el delegado no tiene comité asignado e intenta ver muro de comité', async () => {
  const { listPosts } = loadPostsController({}, ALL_WALLS);

  const req = {
    query: { muro: 'comite-cs' },
    header: (h) => (h.toLowerCase() === 'x-event-id' ? EVENT_1 : null),
    auth: {
      userId: 'user-delegado-sin-comite',
      memberships: [
        {
          id: 'mem-sin-comite',
          eventId: EVENT_1,
          role: 'PARTICIPANT',
          committeeId: null,
        },
      ],
    },
  };

  let statusCode = 200;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
  };

  await listPosts(req, res);

  assert.equal(statusCode, 403);
  assert.equal(body.error, 'No tienes acceso a este muro');
});

test('GET /posts: un administrador de MUN sí puede acceder a cualquier muro de comité', async () => {
  const mockSupabase = {
    from(table) {
      if (table === 'posts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  order: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    },
  };

  const { listPosts } = loadPostsController(mockSupabase, ALL_WALLS);

  const req = {
    query: { muro: 'comite-cs' },
    header: (h) => (h.toLowerCase() === 'x-event-id' ? EVENT_1 : null),
    auth: {
      userId: 'user-admin',
      memberships: [
        {
          id: 'mem-admin',
          eventId: EVENT_1,
          role: 'ADMIN_MUN',
          committeeId: null,
        },
      ],
    },
  };

  let statusCode = 200;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      body = data;
      return this;
    },
  };

  await listPosts(req, res);

  assert.equal(statusCode, 200);
  assert.equal(body.wall.slug, 'comite-cs');
  assert.equal(body.wall.canAccess, true);
});
