// A room: one host and the browsers that have joined it. The host's browser runs the race and is
// the only one that decides anything; everyone else sends their controls and shows what comes back.
// A browser can bring several players (its split screen), and a room holds eight racers at most.
// Nothing here touches the page, so the same code would run in Node. Every message is a plain
// object with a type `t`:
//   guest -> host   hello {v, want: [worm each of its players would like]}
//                   pick {l: which of its players, d: -1 or 1}     (change worm, in the lobby)
//                   in {p: [[look, [action numbers]], ...]}        (controls, one entry per player it brought)
//   host -> guests  room {room}                                    (the whole lobby state, whenever it changes)
//                   deny {why}
//                   start {track, racers: [{char, human}], seats, seatIdx: [worm number for each seat]}
//                   s {c, st, w}                                   (a snapshot of the race; see net/mirror.js)
export const PROTO = 1, MAX_RACERS = 8;
const LOBBY = 'open-games-v' + PROTO; // (a new protocol gets its own list, so nobody's shown a game they can't join)

// A room code: four letters, no look-alikes.
export function roomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  try { for (const v of crypto.getRandomValues(new Uint8Array(4))) s += A[v % A.length]; } catch (e) { for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; }
  return s;
}

export class Room {
  // want: the worm each local player would like. cb: { onRoom(), onStart(msg), onSnap(msg), onInput(peer, p), onPeerLeft(peer), onEnd(why) }
  constructor(tr, role, code, want, cb) {
    this.tr = tr; this.role = role; this.cb = cb; this.self = tr.self; this.code = code;
    this.hostPeer = role === 'host' ? tr.self : null;
    this.state = null;
    if (role === 'host') {
      this.state = { code, priv: false, track: 0, cpu: true, phase: 'lobby', seats: [] };
      want.forEach((c, i) => this.state.seats.push({ peer: this.self, local: i, char: this.free(c, 1) }));
    } else {
      this.waiting = setTimeout(() => { if (!this.state) this.end("Couldn't find that game."); }, 25000);
    }
    tr.on.msg = (p, m) => this.msg(p, m);
    tr.on.join = (p) => { if (role === 'guest' && !this.state) tr.send({ t: 'hello', v: PROTO, want }, p); };
    tr.on.leave = (p) => this.left(p);
  }

  get isHost() { return this.role === 'host'; }
  mine() { return this.state ? this.state.seats.filter((s) => s.peer === this.self) : []; }

  // The nearest worm to `want` that nobody has, looking in direction dir.
  free(want, dir) {
    const used = new Set(this.state.seats.map((s) => s.char));
    let c = ((want % 8) + 8) % 8;
    for (let k = 0; k < 8; k++, c = (c + dir + 8) % 8) if (!used.has(c)) return c;
    return 0;
  }

  sync() { this.tr.send({ t: 'room', room: this.state }); this.cb.onRoom(); }

  msg(p, m) {
    if (!m || typeof m.t !== 'string') return;
    if (this.isHost) {
      const st = this.state;
      if (m.t === 'hello') {
        if (st.seats.some((s) => s.peer === p)) return;
        const want = Array.isArray(m.want) ? m.want.slice(0, 4) : [];
        if (m.v !== PROTO) return this.tr.send({ t: 'deny', why: 'That game is on a different version. Reload the page and try again.' }, p);
        if (!want.length || st.seats.length + want.length > MAX_RACERS) return this.tr.send({ t: 'deny', why: 'That game is full.' }, p);
        want.forEach((c, i) => st.seats.push({ peer: p, local: i, char: this.free(c | 0, 1) }));
        this.sync();
      } else if (m.t === 'pick') this.applyPick(p, m.l | 0, m.d < 0 ? -1 : 1);
      else if (m.t === 'in' && Array.isArray(m.p)) this.cb.onInput(p, m.p);
    } else if (m.t === 'room' && m.room && (!this.hostPeer || p === this.hostPeer)) {
      clearTimeout(this.waiting);
      this.hostPeer = p; this.state = m.room;
      this.cb.onRoom();
    } else if (m.t === 'deny' && !this.state) this.end(m.why || "Couldn't join.");
    else if (p !== this.hostPeer) return;
    else if (m.t === 'start') this.cb.onStart(m);
    else if (m.t === 's') this.cb.onSnap(m);
  }

  left(p) {
    if (this.isHost) {
      if (!this.state.seats.some((s) => s.peer === p)) return;
      this.cb.onPeerLeft(p);
      this.state.seats = this.state.seats.filter((s) => s.peer !== p);
      this.sync();
    } else if (p === this.hostPeer) this.end('The host left.');
  }

  // One of this browser's players changes worm.
  pick(local, dir) { if (this.isHost) this.applyPick(this.self, local, dir); else this.tr.send({ t: 'pick', l: local, d: dir }, this.hostPeer); }
  applyPick(peer, local, dir) {
    const seat = this.state.seats.find((s) => s.peer === peer && s.local === local);
    if (!seat || this.state.phase !== 'lobby') return;
    const was = seat.char;
    seat.char = -1;
    seat.char = this.free(was + dir, dir);
    this.sync();
  }

  // Host only: change a lobby setting, start the race, come back to the lobby.
  set(key, value) { this.state[key] = value; this.sync(); }
  start() {
    const st = this.state;
    if (st.seats.length < 2) st.cpu = true; // a race needs someone to race
    const used = new Set(st.seats.map((s) => s.char));
    const ai = st.cpu ? [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => !used.has(c)) : [];
    const msg = {
      t: 'start', track: st.track,
      racers: ai.map((char) => ({ char, human: false })).concat(st.seats.map((s) => ({ char: s.char, human: true }))),
      seats: st.seats.map((s) => ({ peer: s.peer, local: s.local })), seatIdx: st.seats.map((_, k) => ai.length + k),
    };
    st.phase = 'race';
    this.tr.send(msg);
    this.sync();
    this.cb.onStart(msg);
  }
  toLobby() { this.state.phase = 'lobby'; this.sync(); }

  sendSnap(s) { this.tr.send(s); }
  sendInput(p) { this.tr.send({ t: 'in', p }, this.hostPeer); }

  end(why) { this.close(); this.cb.onEnd(why); }
  close() { clearTimeout(this.waiting); this.tr.on = {}; this.tr.close(); }
}

// The list of open games. There's no server to keep one, so everyone looking at the list, and every
// host whose game isn't private, joins one more room. A host sends an advert to each browser that
// arrives, whenever it changes, and every three seconds; a browser lists the adverts heard in the last ten.
export class OpenGames {
  constructor(open) {
    this.games = new Map(); this.ad = null; this.tr = null; this.failed = null;
    open(LOBBY).then((tr) => {
      if (this.closed) return tr.close();
      this.tr = tr;
      tr.on.join = (p) => tr.send(this.ad ? { t: 'ad', ...this.ad } : { t: 'ask' }, p);
      tr.on.leave = (p) => this.games.delete(p);
      tr.on.msg = (p, m) => {
        if (!m) return;
        if (m.t === 'ad' && typeof m.code === 'string') this.games.set(p, { code: m.code.slice(0, 8), n: m.n | 0, track: m.track | 0, racing: !!m.racing, at: Date.now() });
        else if (m.t === 'gone') this.games.delete(p);
        else if (m.t === 'ask' && this.ad) tr.send({ t: 'ad', ...this.ad }, p);
      };
      if (this.ad) tr.send({ t: 'ad', ...this.ad });
      this.timer = setInterval(() => { if (this.ad) tr.send({ t: 'ad', ...this.ad }); }, 3000);
    }).catch((e) => { this.failed = e; });
  }
  list() {
    for (const [p, g] of this.games) if (Date.now() - g.at > 10000) this.games.delete(p);
    return [...this.games.values()].sort((a, b) => a.code.localeCompare(b.code));
  }
  // Host: what to tell browsers about this game, or null to stop.
  advertise(ad) {
    if (!ad && this.ad && this.tr) this.tr.send({ t: 'gone' });
    this.ad = ad;
    if (ad && this.tr) this.tr.send({ t: 'ad', ...ad });
  }
  close() { this.closed = true; clearInterval(this.timer); if (this.tr) { if (this.ad) this.tr.send({ t: 'gone' }); this.tr.close(); } }
}
