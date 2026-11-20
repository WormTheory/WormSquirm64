// The online screens: hosting or joining (by code, or from the list of open games), the room's
// worm select, and its lobby, where the host picks the track and starts.
import { CHARS, hex } from './characters.js';
import { Room, OpenGames, roomCode, MAX_RACERS } from './net/room.js';
import { openTransport, LOCAL } from './net/transport.js';
import { PCOL, wormCard, moveCursor } from './menus.js';

export const CSS = `
#ws .code{font:inherit;font-size:clamp(16px,4vmin,30px);width:5.2em;text-align:center;text-transform:uppercase;letter-spacing:.15em;
  border:3px solid #000;border-radius:10px;padding:.3em .2em;background:#fff;color:#102040;font-style:normal}
#ws .games{display:flex;flex-direction:column;gap:1vmin;width:min(94%,32em);max-height:34vh;overflow:auto;padding:4px}
#ws .games .btn{font-size:clamp(11px,2.5vmin,19px);display:flex;justify-content:space-between;gap:1em;text-align:left}
#ws .seats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1vmin;width:min(94%,34em)}
#ws .seat{display:flex;align-items:center;gap:.5em;border:3px solid #000;border-radius:10px;padding:.25em .5em;background:rgba(0,0,0,.45);
  font-size:clamp(10px,2.4vmin,18px);min-width:0;text-align:left}
#ws .seat .pic{width:2.2em;border-width:2px}
#ws .seat small{margin-left:auto;font-size:.7em;font-style:normal;font-weight:700;color:#b8c4e0;white-space:nowrap}
#ws .big-code{font-size:clamp(26px,8vmin,70px);letter-spacing:.12em;color:#fff}
`;

export class Online {
  // hooks: { start(room, msg), ended(), phase(), snap(msg), input(peer, p), peerLeft(peer) }
  constructor(menus, inputs, tracks, hooks) {
    this.menus = menus; this.inputs = inputs; this.tracks = tracks; this.hooks = hooks;
    this.room = null; this.games = null; this.humans = []; this.cur = [];
  }

  // Called once the local players are settled. humans: [{dev, devs}]
  open(humans) {
    this.humans = humans;
    this.browse();
  }

  // Host or join: buttons, a box for a code, and the open games.
  browse(note) {
    if (!this.games) this.games = new OpenGames(openTransport);
    const m = this.menus;
    m.put('online', `<div class="head">ONLINE</div>${note ? `<div class="help" style="color:#ffe24a">${note}</div>` : ''}
      <div class="row"><button class="btn" type="button" data-a="host">HOST A GAME</button>
      <input class="code" id="ws-code" maxlength="4" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Room code">
      <button class="btn" type="button" data-a="join">JOIN</button></div>
      <div class="help">Open games${LOCAL ? ' (this browser only)' : ''}:</div><div class="games" id="ws-games"></div>
      <div class="row"><button class="btn" type="button" data-a="back">BACK</button></div>`,
    {
      host: () => this.host(),
      join: () => { const c = m.panel.querySelector('#ws-code').value.toUpperCase().replace(/[^A-Z]/g, ''); if (c.length === 4) this.join(c); },
      game: (code) => this.join(code),
      back: () => this.quit(),
    });
    const box = m.panel.querySelector('#ws-code');
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter') m.acts.join(); });
    let shown = null;
    const list = () => {
      const games = this.games.list(), key = JSON.stringify(games.map((g) => [g.code, g.n, g.track, g.racing]));
      if (key === shown) return;
      shown = key;
      m.panel.querySelector('#ws-games').innerHTML = games.length ? games.map((g) =>
        `<button class="btn" type="button" data-a="game" data-v="${g.code}"><span>${g.code}</span><span>${(this.tracks[g.track] || this.tracks[0]).name}</span>
        <span>${g.racing ? 'racing' : 'in lobby'} · ${g.n}/${MAX_RACERS}</span></button>`).join('')
        : `<div class="help">${this.games.failed ? "Couldn't reach the list of games. You can still join by code." : 'None yet. Host one, or wait: this list fills in by itself.'}</div>`;
      const at = m.btns[m.focus];
      m.btns = [...m.panel.querySelectorAll('.btn:not(:disabled)')];
      m.setFocus(Math.max(0, m.btns.indexOf(at)));
    };
    list();
    m.tickFn = (nav) => {
      list();
      if (document.activeElement === box) { if (this.inputs.esc) box.blur(); return; }
      if (nav.back) return this.quit();
      m.steer(nav);
    };
  }

  wait(text) {
    this.menus.put('online-wait', `<div class="head">${text}</div><div class="help">Finding the other players can take a few seconds.</div>
      <div class="row"><button class="btn" type="button" data-a="x">CANCEL</button></div>`, { x: () => this.leave() });
    this.menus.tickFn = (nav) => { if (nav.back) this.leave(); else this.menus.steer(nav); };
  }

  // The room changed. Unless this screen is busy racing, show where things stand:
  // the worm select while any of this browser's players has yet to choose, otherwise the lobby.
  show() {
    const r = this.room;
    if (!r || !r.state) return;
    if (r.state.phase !== 'lobby' && this.hooks.phase() !== 'menu') return;
    if (r.state.phase === 'lobby' && r.mine().some((s) => s.char < 0)) this.select(); else this.lobby();
  }

  callbacks() {
    return {
      onRoom: () => { this.advert(); this.show(); },
      onStart: (msg) => this.hooks.start(this.room, msg),
      onSnap: (msg) => this.hooks.snap(msg),
      onInput: (peer, p) => this.hooks.input(peer, p),
      onPeerLeft: (peer) => this.hooks.peerLeft(peer),
      onEnd: (why) => { this.room = null; this.hooks.ended(); this.browse(why); },
    };
  }

  host() {
    const code = roomCode();
    this.wait('OPENING ROOM');
    openTransport(code).then((tr) => {
      this.cur = this.humans.map((_, i) => i);
      this.room = new Room(tr, 'host', code, this.humans.length, this.callbacks());
      this.advert(); this.show();
    }).catch(() => this.browse("Couldn't go online. Check your connection and try again."));
  }

  join(code) {
    this.wait('JOINING ' + code);
    openTransport(code).then((tr) => {
      if (this.menus.screen !== 'online-wait') return tr.close(); // cancelled meanwhile
      this.cur = this.humans.map((_, i) => i);
      this.room = new Room(tr, 'guest', code, this.humans.length, this.callbacks());
    }).catch(() => this.browse("Couldn't go online. Check your connection and try again."));
  }

  advert() {
    const r = this.room;
    if (!r || !r.isHost || !this.games) return;
    this.games.advertise(r.state.priv ? null : { code: r.code, n: r.state.seats.length, track: r.state.track, racing: r.state.phase === 'race' });
  }

  // Who a seat belongs to, as this browser sees it.
  who(s) {
    const r = this.room;
    if (s.peer === r.self) return `YOU${this.humans.length > 1 ? ' P' + (s.local + 1) : ''}`;
    return s.peer === r.hostPeer ? 'HOST' : 'GUEST';
  }

  // The room's worm select: the same grid as offline, with everyone's choices on it as they're made.
  // A worm someone has can't be taken; the host has the last word if two reach for one at once.
  select() {
    const r = this.room, st = r.state, m = this.menus, mine = r.mine();
    const card = (c, i) => {
      const owner = st.seats.find((s) => s.char === i);
      let tags = owner ? `<span class="tag" style="${owner.peer === r.self ? 'background:' + PCOL[owner.local] : ''}">${this.who(owner)} OK</span>` : '';
      mine.forEach((s) => { if (s.char < 0 && this.cur[s.local] === i) tags += `<span class="tag" style="background:${PCOL[s.local]}">${this.humans.length > 1 ? 'P' + (s.local + 1) : 'YOU'}</span>`; });
      return wormCard(i, m.portraits[i], tags, !!owner);
    };
    m.put('room-select', `<div class="head">SELECT WORM</div><div class="help">ROOM ${st.code} · ${st.seats.length}/${MAX_RACERS} here</div>
      <div class="grid">${CHARS.map(card).join('')}</div>`,
    {
      pick: (v) => {
        const s = mine.find((q) => q.char < 0 && this.humans[q.local].dev === 'touch') || mine.find((q) => q.char < 0);
        if (s) r.pick(s.local, +v);
      },
    });
    m.tickFn = () => {
      for (const s of mine) {
        const n = this.inputs.nav(this.humans[s.local].devs);
        if (s.char < 0 && (n.dx || n.dy)) { this.cur[s.local] = moveCursor(this.cur[s.local], n); m.sound('move'); return this.select(); }
        if (s.char < 0 && n.ok) { m.sound('select'); return r.pick(s.local, this.cur[s.local]); }
        if (n.back) return s.char >= 0 ? r.pick(s.local, -1) : this.leave();
      }
      if (this.inputs.esc) this.leave();
    };
  }

  // The lobby: who's in, on which worm, and (for the host) the settings and START.
  lobby() {
    const r = this.room, st = r.state, m = this.menus, host = r.isHost, racing = st.phase === 'race';
    const seat = (s) => {
      const mine = s.peer === r.self, c = CHARS[s.char];
      return `<div class="seat" style="border-color:${mine ? PCOL[s.local] : '#000'}">${c ? `<img class="pic" src="${m.portraits[s.char]}" alt=""><span>${c.name}</span>`
        : `<i class="dot" style="background:#555"></i><span>choosing…</span>`}<small>${this.who(s)}</small></div>`;
    };
    m.put('room', `<div class="help">ROOM CODE${st.priv ? ' (private: not in the list)' : ''}</div><div class="big-code t">${st.code}</div>
      <div class="seats">${st.seats.map(seat).join('')}</div>
      <div class="help">${racing ? 'A race is under way. You\'re in the next one.' : st.cpu ? 'Computer worms take the other places.' : 'No computer worms.'}
      ${host ? '' : `<br>Track: ${this.tracks[st.track].name}. ${racing ? '' : 'Waiting for the host to start.'}`}</div>
      <div class="row">${host && !racing ? `<button class="btn" type="button" data-a="go">START</button>
      <button class="btn" type="button" data-a="track">TRACK: ${this.tracks[st.track].name.toUpperCase()}</button>
      <button class="btn" type="button" data-a="cpu">COMPUTER WORMS: ${st.cpu ? 'ON' : 'OFF'}</button>
      <button class="btn" type="button" data-a="priv">PRIVATE: ${st.priv ? 'ON' : 'OFF'}</button>` : ''}
      ${racing ? '' : '<button class="btn" type="button" data-a="worm">CHANGE WORM</button>'}
      <button class="btn" type="button" data-a="leave">LEAVE</button></div>`,
    {
      track: () => r.set('track', (st.track + 1) % this.tracks.length),
      cpu: () => r.set('cpu', !st.cpu),
      priv: () => r.set('priv', !st.priv),
      go: () => r.start(this.hooks.eaten()),
      worm: () => r.mine().forEach((s) => r.pick(s.local, -1)),
      leave: () => this.leave(),
    }, m.screen === 'room' ? m.focus : 0);
    m.tickFn = (nav) => { if (nav.back) this.leave(); else m.steer(nav); };
  }

  // Out of the room, back to the host-or-join screen.
  leave() {
    if (this.room) { this.room.close(); this.room = null; }
    if (this.games) this.games.advertise(null);
    this.hooks.ended();
    this.browse();
  }

  // Out of online play altogether.
  quit() {
    if (this.room) { this.room.close(); this.room = null; }
    if (this.games) { this.games.close(); this.games = null; }
    this.hooks.ended();
    this.menus.mode();
  }
}
