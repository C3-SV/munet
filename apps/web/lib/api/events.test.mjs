import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadEvents({ state = { token: null, activeEventId: null, activeMembershipId: null, memberships: [], practice: false }, requestApi, now = () => 1_000 } = {}) {
    const moduleStub = { exports: {} };
    const source = readFileSync(new URL('./events.ts', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const listeners = [];
    const store = {
        getState: () => state,
        subscribe: listener => { listeners.push(listener); return () => {}; },
        change: next => {
            const previous = state;
            state = next;
            for (const listener of listeners) listener(state, previous);
        },
    };
    class ClockDate extends Date { static now = now; }
    vm.runInNewContext(code, {
        module: moduleStub,
        exports: moduleStub.exports,
        Date: ClockDate,
        require(name) {
            if (name === './client') return { requestApi };
            if (name === '../../stores/auth.store') return { useAuthStore: store };
            if (name === '../practice/constants') return { isPracticeEvent: id => id === 'practice-local' };
            throw new Error(`Import inesperado: ${name}`);
        },
    });
    return { ...moduleStub.exports, store };
}

const wallsResponse = { event: { id: 'e1' }, membership: { id: 'm1' }, walls: [] };

test('catálogos deduplican solicitudes activas y comparten resultado solo para mismo token/evento', async () => {
    let calls = 0;
    let resolve;
    const events = loadEvents({ state: { token: 't1', activeEventId: 'e1', activeMembershipId: 'm1', memberships: [], practice: false }, requestApi: () => { calls++; return calls === 1 ? new Promise(r => { resolve = r; }) : Promise.resolve(wallsResponse); } });
    const first = events.getEventWalls({ token: 't1', eventId: 'e1' });
    const concurrent = events.getEventWalls({ token: 't1', eventId: 'e1' });
    assert.equal(calls, 1);
    resolve(wallsResponse);
    assert.strictEqual(await first, await concurrent);
    assert.strictEqual(await events.getEventWalls({ token: 't1', eventId: 'e1' }), wallsResponse);
    assert.equal(calls, 1);
    await events.getEventCommittees({ token: 't1', eventId: 'e1' });
    await events.getEventWalls({ token: 't2', eventId: 'e1' });
    await events.getEventWalls({ token: 't1', eventId: 'e2' });
    assert.equal(calls, 4);
});

test('catálogos no guardan errores y evitan cachear solicitudes de práctica', async () => {
    let calls = 0;
    const events = loadEvents({ state: { token: 't1', activeEventId: 'e1', activeMembershipId: 'm1', memberships: [], practice: false }, requestApi: async (_path, options) => { calls++; if (options.eventId === 'e1' && calls === 1) throw new Error('fallo'); return wallsResponse; } });
    await assert.rejects(events.getEventWalls({ token: 't1', eventId: 'e1' }), /fallo/);
    await events.getEventWalls({ token: 't1', eventId: 'e1' });
    await events.getEventWalls({ token: 't1', eventId: 'practice-local' });
    await events.getEventWalls({ token: 't1', eventId: 'practice-local' });
    assert.equal(calls, 4);
});

test('catálogos vencen a los 30 segundos y no repueblan tras cambiar contexto', async () => {
    let clock = 1_000;
    let calls = 0;
    let resolve;
    const events = loadEvents({ state: { token: 't1', activeEventId: 'e1', activeMembershipId: 'm1', memberships: [], practice: false }, now: () => clock, requestApi: async () => { calls++; if (calls === 1) return new Promise(r => { resolve = r; }); return wallsResponse; } });
    const late = events.getEventWalls({ token: 't1', eventId: 'e1' });
    events.store.change({ token: 't2', activeEventId: 'e2', activeMembershipId: 'm2', memberships: [], practice: false });
    resolve(wallsResponse);
    await late;
    events.store.change({ token: 't1', activeEventId: 'e1', activeMembershipId: 'm1', memberships: [], practice: false });
    await events.getEventWalls({ token: 't1', eventId: 'e1' });
    assert.equal(calls, 2);
    clock += 30_001;
    await events.getEventWalls({ token: 't1', eventId: 'e1' });
    assert.equal(calls, 3);
});

test('invalidar evento descarta caché y peticiones viejas en vuelo sin pisar el resultado nuevo', async () => {
    let calls = 0;
    let resolveOld;
    const fresh = { event: { id: 'e1' }, membership: { id: 'm1' }, walls: [{ id: 'fresh' }] };
    const stale = { event: { id: 'e1' }, membership: { id: 'm1' }, walls: [{ id: 'stale' }] };
    const events = loadEvents({
        state: { token: 't1', activeEventId: 'e1', activeMembershipId: 'm1', memberships: [], practice: false },
        requestApi: () => ++calls === 1 ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve(fresh),
    });

    const oldRequest = events.getEventWalls({ token: 't1', eventId: 'e1' });
    events.invalidateEventCatalogs('t1', 'e1');
    assert.deepEqual(JSON.parse(JSON.stringify(await events.getEventWalls({ token: 't1', eventId: 'e1' }))), fresh);
    resolveOld(stale);
    await oldRequest;
    assert.deepEqual(JSON.parse(JSON.stringify(await events.getEventWalls({ token: 't1', eventId: 'e1' }))), fresh);
    assert.equal(calls, 2);
});
