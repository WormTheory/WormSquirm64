// How browsers reach each other. Both transports have the same shape:
//   { kind, self, on: { msg(peer, data), join(peer), leave(peer) }, send(data, to?), close() }
// There is no game server. Over the internet, Trystero finds the other players through public
// Nostr relays and then talks to them directly (WebRTC). It's only fetched when someone goes
// online, so the game still opens and plays with no network at all.
const TRYSTERO = 'https://cdn.jsdelivr.net/npm/trystero@0.26.0/+esm';
const APP = 'worm-squirm-64/net1';
// TURN servers, for players whose routers won't let a direct connection through. None are set, so two
// players who can't reach each other directly can't play. A build of your own can put some here, as
// [{ urls: ['turn:...'], username: '...', credential: '...' }]. Never commit real ones.
const TURN = null;

function newId() {
  try { return Array.from(crypto.getRandomValues(new Uint8Array(6)), (v) => v.toString(16).padStart(2, '0')).join(''); } catch (e) { return 'p' + Date.now().toString(36); }
}

// Tabs of one browser, through a BroadcastChannel: for trying things out on one machine, and for the tests.
// Open the game with ?net=local to use it.
function loopback(code) {
  const bc = new BroadcastChannel('ws64:' + code), self = newId(), seen = new Map();
  const tr = {
    kind: 'local', self, on: {},
    send(d, to) { bc.postMessage({ from: self, to: to || null, d }); },
    close() { clearInterval(beat); try { bc.postMessage({ from: self, bye: 1 }); bc.close(); } catch (e) { /* already closed */ } },
  };
  bc.onmessage = (e) => {
    const m = e.data;
    if (m.from === self || (m.to && m.to !== self)) return;
    if (m.bye) { if (seen.delete(m.from) && tr.on.leave) tr.on.leave(m.from); return; }
    if (!seen.has(m.from)) { seen.set(m.from, Date.now()); bc.postMessage({ from: self, hb: 1 }); if (tr.on.join) tr.on.join(m.from); }
    seen.set(m.from, Date.now());
    if (m.d !== undefined && tr.on.msg) tr.on.msg(m.from, m.d);
  };
  // A heartbeat each second; a tab not heard from for five is gone.
  const beat = setInterval(() => {
    bc.postMessage({ from: self, hb: 1 });
    for (const [p, t] of seen) if (Date.now() - t > 5000) { seen.delete(p); if (tr.on.leave) tr.on.leave(p); }
  }, 1000);
  bc.postMessage({ from: self, hb: 1 });
  return tr;
}

async function trystero(code) {
  const mod = await import(TRYSTERO);
  const cfg = { appId: APP };
  if (TURN) cfg.turnConfig = TURN;
  const room = mod.joinRoom(cfg, code), a = room.makeAction('m'), old = Array.isArray(a); // (older Trystero gave [send, receive]; newer an object)
  const tr = {
    kind: 'p2p', self: mod.selfId, on: {},
    send(d, to) { try { if (old) a[0](d, to || null); else a.send(d, to ? { target: to } : undefined); } catch (e) { /* peer just went */ } },
    close() { try { room.leave(); } catch (e) { /* already left */ } },
  };
  const got = (d, meta) => { const peer = typeof meta === 'string' ? meta : meta && meta.peerId; if (tr.on.msg) tr.on.msg(peer, d); };
  const join = (id) => { if (tr.on.join) tr.on.join(id); }, leave = (id) => { if (tr.on.leave) tr.on.leave(id); };
  if (old) { a[1](got); room.onPeerJoin(join); room.onPeerLeave(leave); } else { a.onMessage = got; room.onPeerJoin = join; room.onPeerLeave = leave; }
  return tr;
}

export const LOCAL = typeof location !== 'undefined' && new URLSearchParams(location.search).get('net') === 'local';
export async function openTransport(code) { return LOCAL ? loopback(code) : trystero(code); }
