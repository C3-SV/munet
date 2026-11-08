const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('ts-node').register({ project: 'apps/api/tsconfig.json' });

const plain = (val) => JSON.parse(JSON.stringify(val));

function loadEventsController(mockSupabase, mockSearch) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/events.controller.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;

  vm.runInNewContext(code, {
    exports: module.exports,
    module,
    console,
    require(name) {
      if (name === '../lib/supabase') return { supabaseAdmin: mockSupabase };
      if (name === '../services/walls.service') return { loadWallsByEvent: async () => [], mapWallForMembership: () => ({}) };
      if (name === '../utils/rbac.utils') return require('../utils/rbac.utils.ts');
      if (name === '../services/participant-search.service') return { searchParticipants: mockSearch || (async () => ({})) };
      throw new Error(`Dependencia no mockeada: ${name}`);
    },
  });

  return module.exports;
}

test('listEventDirectory: rechaza con 403 si el usuario no tiene membresía en el evento', async () => {
  const { listEventDirectory } = loadEventsController({});

  const req = {
    params: { eventId: 'event-1' },
    query: {},
    header: () => null,
    auth: {
      userId: 'user-1',
      memberships: [{ id: 'm-2', eventId: 'otro-evento', role: 'PARTICIPANT' }],
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

  await listEventDirectory(req, res);

  assert.equal(statusCode, 403);
  assert.deepEqual(plain(body), { error: 'No perteneces a este evento' });
});

test('listEventDirectory: rechaza paginación inválida con 400', async () => {
  const { listEventDirectory } = loadEventsController({});

  const req = {
    params: { eventId: 'event-1' },
    query: { page: '0', limit: '20' },
    header: () => null,
    auth: {
      userId: 'user-1',
      memberships: [{ id: 'm-1', eventId: 'event-1', role: 'PARTICIPANT' }],
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

  await listEventDirectory(req, res);

  assert.equal(statusCode, 400);
  assert.deepEqual(plain(body), { error: 'Parámetros de paginación inválidos' });
});

test('listEventDirectory: con búsqueda delega a searchParticipants y mapea al contrato sin exponer campos privados', async () => {
  const mockSearch = async ({ eventId, q, filters, page, limit }) => {
    return {
      body: {
        participants: [
          {
            id: 'mem-1',
            event_id: eventId,
            participant_code: 'SECRETO_LOGIN_123',
            delegation_code: '#007',
            delegation_name: 'Francia',
            role: 'PARTICIPANT',
            institution_name: 'Colegio A',
            committee_id: 'comm-1',
            account_status: 'ACTIVE',
            profile: {
              first_name: 'Ana',
              last_name: 'Pérez',
              alias: 'Anita',
              profile_image_path: 'https://avatar.png',
            },
          },
        ],
        pagination: { page, limit, total: 1, total_pages: 1 },
      },
    };
  };

  const client = {
    from(table) {
      if (table === 'committees') {
        return {
          select: () => ({
            eq: () => ({
              is: async () => ({
                data: [{ id: 'comm-1', name: 'Consejo de Seguridad', code: 'CS' }],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    },
  };

  const { listEventDirectory } = loadEventsController(client, mockSearch);

  const req = {
    params: { eventId: 'event-1' },
    query: { search: 'perez', page: '1', limit: '20' },
    header: () => null,
    auth: {
      userId: 'user-1',
      memberships: [{ id: 'm-1', eventId: 'event-1', role: 'PARTICIPANT' }],
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

  await listEventDirectory(req, res);

  assert.equal(statusCode, 200);
  assert.equal(body.delegates.length, 1);
  const delegate = body.delegates[0];

  // Comprobar campos según contrato oficial
  assert.equal(delegate.membershipId, 'mem-1');
  assert.equal(delegate.firstName, 'Ana');
  assert.equal(delegate.lastName, 'Pérez');
  assert.equal(delegate.alias, 'Anita');
  assert.equal(delegate.delegationName, 'Francia');
  assert.equal(delegate.delegationCode, '#007');
  assert.equal(delegate.role, 'PARTICIPANT');
  assert.equal(delegate.institutionName, 'Colegio A');
  assert.deepEqual(plain(delegate.committee), { id: 'comm-1', name: 'Consejo de Seguridad', code: 'CS' });
  assert.equal(delegate.avatarUrl, 'https://avatar.png');

  // Comprobación estricta de seguridad: NUNCA participant_code ni email
  assert.equal(delegate.participant_code, undefined);
  assert.equal(delegate.participantCode, undefined);
  assert.equal(delegate.email, undefined);
  assert.equal(JSON.stringify(body).includes('SECRETO_LOGIN_123'), false);
});

test('listEventDirectory: sin búsqueda lista delegados paginados y aplica filtro committee_id', async () => {
  let committeeFiltered = null;

  const client = {
    from(table) {
      if (table === 'committees') {
        return {
          select: () => ({
            eq: () => ({
              is: async () => ({
                data: [{ id: 'comm-1', name: 'Consejo de Seguridad', code: 'CS' }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'event_memberships') {
        const query = {
          steps: [],
          eq(col, val) {
            if (col === 'committee_id') committeeFiltered = val;
            return query;
          },
          is() { return query; },
          order() { return query; },
          range: async () => ({
            data: [
              {
                id: 'mem-2',
                event_id: 'event-1',
                participant_code: 'LOGIN_456',
                delegation_code: '#010',
                delegation_name: 'Alemania',
                role: 'PARTICIPANT',
                institution_name: 'Colegio B',
                committee_id: 'comm-1',
                account_status: 'ACTIVE',
              },
            ],
            count: 1,
            error: null,
          }),
        };
        return {
          select: () => query,
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  event_membership_id: 'mem-2',
                  first_name: 'Carlos',
                  last_name: 'Gómez',
                  display_name: 'Carlos G',
                  alias: null,
                  profile_image_path: null,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {};
    },
  };

  const { listEventDirectory } = loadEventsController(client);

  const req = {
    params: { eventId: 'event-1' },
    query: { committee_id: 'comm-1', page: '1', limit: '20' },
    header: () => null,
    auth: {
      userId: 'user-1',
      memberships: [{ id: 'm-1', eventId: 'event-1', role: 'PARTICIPANT' }],
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

  await listEventDirectory(req, res);

  assert.equal(statusCode, 200);
  assert.equal(committeeFiltered, 'comm-1');
  assert.equal(body.delegates.length, 1);
  assert.equal(body.pagination.total, 1);
  assert.equal(body.pagination.total_pages, 1);

  const delegate = body.delegates[0];
  assert.equal(delegate.membershipId, 'mem-2');
  assert.equal(delegate.firstName, 'Carlos');
  assert.equal(delegate.lastName, 'Gómez');
  assert.equal(delegate.alias, null);
  assert.equal(delegate.delegationCode, '#010');
  assert.equal(delegate.avatarUrl, null);
  assert.equal(delegate.participant_code, undefined);
  assert.equal(delegate.email, undefined);
});

