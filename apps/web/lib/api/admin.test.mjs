import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadApi(file, { requestApi, invalidations }) {
    const moduleStub = { exports: {} };
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(code, {
        module: moduleStub,
        exports: moduleStub.exports,
        require(name) {
            if (name === './client') return { requestApi };
            if (name === './events') return { invalidateEventCatalogs: (...args) => invalidations.push(args) };
            throw new Error(`Import inesperado: ${name}`);
        },
    });
    return moduleStub.exports;
}

test('mutaciones de comité invalidan el evento del resultado confirmado solo tras éxito', async () => {
    const invalidations = [];
    const admin = loadApi('./admin.ts', {
        requestApi: async () => ({ message: 'ok', committee: { event_id: 'server-event' } }),
        invalidations,
    });

    await admin.createCommittee('token-a', { event_id: 'caller-event' });
    await admin.updateCommittee('token-a', 'committee-1', {});
    await admin.deleteCommittee('token-a', 'committee-1', 'route-event');

    assert.deepEqual(JSON.parse(JSON.stringify(invalidations)), [
        ['token-a', 'server-event'],
        ['token-a', 'server-event'],
        ['token-a', 'route-event'],
    ]);
});

test('un fallo de mutación no invalida catálogos', async () => {
    const invalidations = [];
    const admin = loadApi('./admin.ts', { requestApi: async () => { throw new Error('fallo'); }, invalidations });
    await assert.rejects(admin.deleteCommittee('token-a', 'committee-1', 'event-1'), /fallo/);
    assert.deepEqual(invalidations, []);
});

test('importar participantes invalida el evento indicado solo después de confirmar éxito', async () => {
    const invalidations = [];
    const participants = loadApi('./participants.ts', {
        requestApi: async () => ({ message: 'ok', summary: { requested: 1, created: 1, failed: 0 }, created: [], failed: [] }),
        invalidations,
    });
    await participants.confirmParticipantImport('token-a', 'event-1', []);
    assert.deepEqual(JSON.parse(JSON.stringify(invalidations)), [['token-a', 'event-1']]);

    const failed = loadApi('./participants.ts', {
        requestApi: async () => { throw new Error('fallo'); },
        invalidations,
    });
    await assert.rejects(failed.confirmParticipantImport('token-a', 'event-1', []), /fallo/);
    assert.deepEqual(JSON.parse(JSON.stringify(invalidations)), [['token-a', 'event-1']]);
});
