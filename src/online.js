// The online screens: hosting or joining (by code, or from the list of open games) and the room's
// lobby, where everyone picks a worm and the host picks the track and starts.
import { CHARS, hex } from './characters.js';
import { Room, OpenGames, roomCode, MAX_RACERS } from './net/room.js';
import { openTransport, LOCAL } from './net/transport.js';
import { PCOL } from './menus.js';

export const CSS = `
#ws .code{font:inherit;font-size:clamp(16px,4vmin,30px);width:5.2em;text-align:center;text-transform:uppercase;letter-spacing:.15em;
  border:3px solid #000;border-radius:10px;padding:.3em .2em;background:#fff;color:#102040;font-style:normal}
#ws .games{display:flex;flex-direction:column;gap:1vmin;width:min(94%,32em);max-height:34vh;overflow:auto;padding:4px}
#ws .games .btn{font-size:clamp(11px,2.5vmin,19px);display:flex;justify-content:space-between;gap:1em;text-align:left}
#ws .seats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1vmin;width:min(94%,34em)}
#ws .seat{display:flex;align-items:center;gap:.5em;border:3px solid #000;border-radius:10px;padding:.3em .5em;background:rgba(0,0,0,.45);
  font:inherit;color:#fff;font-size:clamp(10px,2.4vmin,18px);min-width:0;text-align:left}
#ws .seat.mine{cursor:pointer}
#ws .seat small{margin-left:auto;font-size:.7em;font-style:normal;font-weight:700;color:#b8c4e0;white-space:nowrap}
#ws .big-code{font-size:clamp(26px,8vmin,70px);letter-spacing:.12em;color:#fff}
`;

export class Online {
  // hooks: { start(room, msg), ended(), phase(), snap(msg), input(peer, p), peerLeft(peer) }
  constructor(menus, inputs, tracks, hooks) {
    this.menus = menus; this.inputs = inputs; this.tracks = tracks; this.hooks = hooks;
    this.room = null; this.games = null; this.humans = [];
  }

  // Called once the local players have joined. humans: [{devs}]
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
      m.btns = [...m.panel.querySelectorAll('.btn')];
      m.setFocus(Math.max(0, m.btns.indexOf(at)));
    };
    list();
    m.tickFn = (nav) => {
      list();
      if (document.activeElement === box) { if (this.inputs.esc) box.blur(); return; }
      if (nav.back) return this.quit();
      m.steer({ dx: nav.dx, dy: nav.dy, ok: nav.ok });
    };
  }

  wait(text) {
    this.menus.put('online-wait', `<div class="head">${text}</div><div class="help">Finding the other players can take a few seconds.</div>
      <div class="row"><button class="btn" type="button" data-a="x">CANCEL</button></div>`, { x: () => this.leave() });
    this.menus.tickFn = (nav) => { if (nav.back) this.leave(); else this.menus.steer(nav); };
  }

  callbacks() {
    return {
      onRoom: () => { this.advert(); if (this.room.state.phase === 'lobby' || this.hooks.phase() === 'menu') this.lobby(); },
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
      this.room = new Room(tr, 'host', code, this.humans.map((_, i) => i), this.callbacks());
      this.advert(); this.lobby();
    }).catch(() => this.browse("Couldn't go online. Check your connection and try again."));
  }

  join(code) {
    this.wait('JOINING ' + code);
    const want = this.humans.map((_, i) => i);
    openTransport(code).then((tr) => {
      if (this.menus.screen !== 'online-wait') return tr.close(); // cancelled meanwhile
      this.room = new Room(tr, 'guest', code, want, this.callbacks());
    }).catch(() => this.browse("Couldn't go online. Check your connection and try again."));
  }

  advert() {
    const r = this.room;
    if (!r || !r.isHost || !this.games) return;
    this.games.advertise(r.state.priv ? null : { code: r.code, n: r.state.seats.length, track: r.state.track, racing: r.state.phase === 'race' });
  }

  // The room: who's in, on which worm, and (for the host) the settings and START.
  lobby() {
    const r = this.room, st = r.state, m = this.menus, host = r.isHost;
    const seat = (s) => {
      const mine = s.peer === r.self, c = CHARS[s.char];
      const who = mine ? `YOU${this.humans.length > 1 ? ' P' + (s.local + 1) : ''}` : s.peer === r.hostPeer ? 'HOST' : 'GUEST';
      return `<${mine ? 'button type="button" data-a="pick" data-v="' + s.local + '"' : 'div'} class="seat ${mine ? 'mine' : ''}" style="border-color:${mine ? PCOL[s.local] : '#000'}">
        <i class="dot" style="background:${hex(c.color)}"></i><span>${c.name}</span><small>${who}</small></${mine ? 'button' : 'div'}>`;
    };
    const racing = st.phase === 'race';
    m.put('room', `<div class="help">ROOM CODE${st.priv ? ' (private: not in the list)' : ''}</div><div class="big-code t">${st.code}</div>
      <div class="seats">${st.seats.map(seat).join('')}</div>
      <div class="help">${racing ? 'A race is under way. You\'re in the next one.' : `Left and right change your worm.${st.cpu ? ' Computer worms take the other places.' : ''}`}
      ${host ? '' : `<br>Track: ${this.tracks[st.track].name}. ${racing ? '' : 'Waiting for the host to start.'}`}</div>
      <div class="row">${host && !racing ? `<button class="btn" type="button" data-a="track">TRACK: ${this.tracks[st.track].name.toUpperCase()}</button>
      <button class="btn" type="button" data-a="cpu">COMPUTER WORMS: ${st.cpu ? 'ON' : 'OFF'}</button>
      <button class="btn" type="button" data-a="priv">PRIVATE: ${st.priv ? 'ON' : 'OFF'}</button>
      <button class="btn" type="button" data-a="go">START</button>` : ''}
      <button class="btn" type="button" data-a="leave">LEAVE</button></div>`,
    {
      pick: (v) => r.pick(+v, 1),
      track: () => r.set('track', (st.track + 1) % this.tracks.length),
      cpu: () => r.set('cpu', !st.cpu),
      priv: () => r.set('priv', !st.priv),
      go: () => r.start(),
      leave: () => this.leave(),
    }, this.lobbyFocus || 0);
    m.tickFn = (nav) => {
      // Each local player's left and right change their own worm; up, down and OK work the buttons.
      this.humans.forEach((h, i) => { const n = this.inputs.nav(h.devs); if (n.dx && !racing) r.pick(i, Math.sign(n.dx)); });
      if (nav.back) return this.leave();
      m.steer({ dx: 0, dy: nav.dy, ok: nav.ok });
      this.lobbyFocus = m.focus;
    };
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
