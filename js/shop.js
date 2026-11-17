// Fragrance picker, cart drawer and checkout. Everything stays in this browser; nothing is sent.

const PRICES = { 30: 79, 50: 119, 100: 169 };
const SET_PRICE = 39;
const SCALE = { 30: 0.84, 50: 1, 100: 1.17 };
const NAMES = { xezri: 'Xəzri', gilavar: 'Gilavar' };
const DESC = {
  xezri: 'Berqamot və limon qabığı ilə açılır, Xəzər duzunun ürəyindən keçir, sidr və ağ müşkdə qalır.',
  gilavar: 'Zəfəran və naringi ilə açılır, əncir və qızılgülün ürəyindən keçir, ənbər və vanildə qalır.',
};
const KEY = 'kulek-cart-v1';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => `${n} AZN`;

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
function save(lines) { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) { /* private mode */ } }

export function initShop() {
  const state = { pick: 'gilavar', vol: 50, lines: load(), view: 'cart', lastFocus: null };
  const cart = $('#cart');
  const body = $('[data-cart-body]');
  const title = $('[data-cart-title]');
  const count = $('[data-cart-count]');
  const pickEl = $('.pick');

  function setPick(k) {
    state.pick = k;
    pickEl.dataset.at = k;
    $$('[data-pick]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.pick === k)));
    $('[data-desc]').textContent = DESC[k];
  }
  function setVol(v) {
    state.vol = v;
    $$('[data-vol]').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.vol === v)));
    const el = $('[data-price]');
    el.classList.add('flip');
    setTimeout(() => { el.textContent = PRICES[v]; el.classList.remove('flip'); }, 180);
  }
  $$('[data-pick]').forEach((b) => b.addEventListener('click', () => setPick(b.dataset.pick)));
  $$('[data-vol]').forEach((b) => b.addEventListener('click', () => setVol(+b.dataset.vol)));
  radioKeys($('.pick'), '[data-pick]', (b) => setPick(b.dataset.pick));
  radioKeys($('.vol'), '[data-vol]', (b) => setVol(+b.dataset.vol));
  setPick('gilavar');

  function add(line) {
    const same = state.lines.find((l) => l.id === line.id);
    if (same) same.qty += 1; else state.lines.push({ ...line, qty: 1 });
    save(state.lines);
    updateCount(true);
    state.view = 'cart';
    open();
  }
  $('[data-add]').addEventListener('click', () => add({ id: `${state.pick}-${state.vol}`, kind: state.pick, name: NAMES[state.pick], sub: `Eau de Parfum · ${state.vol} ml`, price: PRICES[state.vol] }));
  $('[data-add-set]').addEventListener('click', () => add({ id: 'set', kind: 'set', name: 'Kəşf dəsti', sub: 'Xəzri + Gilavar · 2 × 10 ml', price: SET_PRICE }));

  function updateCount(bump) {
    const n = state.lines.reduce((a, l) => a + l.qty, 0);
    count.textContent = n;
    if (bump) { count.classList.add('bump'); setTimeout(() => count.classList.remove('bump'), 380); }
  }
  updateCount(false);

  const subtotal = () => state.lines.reduce((a, l) => a + l.price * l.qty, 0);

  function render() {
    if (state.view === 'done') return;
    if (state.view === 'form') return renderForm();
    title.textContent = 'Səbət';
    if (!state.lines.length) {
      body.innerHTML = '<p class="empty">Səbət hələ boşdur. Bir külək seçin.</p>';
      return;
    }
    const st = subtotal();
    body.innerHTML = state.lines.map((l, i) => `
      <div class="line">
        <span class="line__chip line__chip--${l.kind}" aria-hidden="true"></span>
        <div><p class="line__t">${l.name}</p><p class="line__s">${l.sub}</p>
          <div class="qty" role="group" aria-label="${l.name}, say"><button type="button" data-q="${i}" data-d="-1" aria-label="Azalt">−</button><span>${l.qty}</span><button type="button" data-q="${i}" data-d="1" aria-label="Artır">+</button></div>
        </div>
        <div><p class="line__p">${money(l.price * l.qty)}</p><button type="button" class="line__rm" data-rm="${i}">Sil</button></div>
      </div>`).join('') + `
      <div class="sum"><p><span>Məhsullar</span><span>${money(st)}</span></p><p><span>Çatdırılma</span><span>növbəti addımda</span></p><p class="sum__total"><span>Cəmi</span><span>${money(st)}</span></p></div>
      <button class="btn btn--solid" type="button" data-checkout>Sifarişə keç</button>`;
  }

  function renderForm(errors = {}) {
    title.textContent = 'Sifariş';
    const st = subtotal();
    const d = state.form || { name: '', phone: '', addr: '', ship: 'kuryer' };
    body.innerHTML = `
      <form class="form" novalidate>
        <button class="back" type="button" data-back>← Səbətə qayıt</button>
        <label>Ad, soyad<input name="name" autocomplete="name" value="${esc(d.name)}" required>${errors.name ? `<span class="err">${errors.name}</span>` : ''}</label>
        <label>Telefon<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+994 50 000 00 00" value="${esc(d.phone)}" required>${errors.phone ? `<span class="err">${errors.phone}</span>` : ''}</label>
        <div class="radios" role="radiogroup" aria-label="Çatdırılma">
          <label><input type="radio" name="ship" value="kuryer" ${d.ship !== 'poct' ? 'checked' : ''}> Bakı daxili kuryer <small>${st >= 150 ? 'pulsuz' : '5 AZN'}</small></label>
          <label><input type="radio" name="ship" value="poct" ${d.ship === 'poct' ? 'checked' : ''}> Rayonlara poçt <small>8 AZN</small></label>
        </div>
        <label>Ünvan<textarea name="addr" rows="2" autocomplete="street-address" required>${esc(d.addr)}</textarea>${errors.addr ? `<span class="err">${errors.addr}</span>` : ''}</label>
        <div class="radios" role="radiogroup" aria-label="Ödəniş">
          <label><input type="radio" name="pay" value="cash" checked> Qapıda nağd və ya kartla</label>
          <label class="off"><input type="radio" name="pay" value="online" disabled> Onlayn kartla <small>real saytda bank qoşulur</small></label>
        </div>
        <div class="sum" data-sum></div>
        <button class="btn btn--solid" type="submit">Sifarişi təsdiqlə</button>
      </form>`;
    const f = $('form', body);
    const sum = () => {
      const sh = read(f).ship === 'poct' ? 8 : st >= 150 ? 0 : 5;
      $('[data-sum]', f).innerHTML = `<p><span>Məhsullar</span><span>${money(st)}</span></p><p><span>Çatdırılma</span><span>${sh ? money(sh) : 'pulsuz'}</span></p><p class="sum__total"><span>Cəmi</span><span>${money(st + sh)}</span></p>`;
    };
    sum();
    f.addEventListener('change', (e) => { if (e.target.name === 'ship') sum(); });
    f.addEventListener('input', () => { state.form = read(f); });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = read(f);
      state.form = v;
      const err = {};
      if (v.name.trim().length < 2) err.name = 'Adınızı yazın.';
      if (v.phone.replace(/\D/g, '').length < 9) err.phone = 'Nömrə ən azı 9 rəqəm olmalıdır.';
      if (v.addr.trim().length < 5) err.addr = 'Ünvanı yazın.';
      if (Object.keys(err).length) { renderForm(err); const first = $(`[name="${Object.keys(err)[0]}"]`, body); first && first.focus(); return; }
      const ref = 'KLK-' + String(Math.floor(10000 + Math.random() * 89999));
      state.lines = []; save(state.lines); updateCount(false);
      state.view = 'done'; state.form = null;
      title.textContent = 'Təşəkkürlər';
      body.innerHTML = `<div class="done" role="status"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="38"/><path d="M26 43 L37 54 L59 31"/></svg>
        <h3>Sifariş qəbul olundu</h3><p class="ref">${ref}</p><p>Bu nümunə saytdır: sifariş heç yerə göndərilmədi, məlumatlarınız saxlanmadı.</p>
        <button class="btn btn--line" type="button" data-close-cart style="margin-top:26px">Sayta qayıt</button></div>`;
    });
  }
  const read = (f) => ({ name: f.name.value, phone: f.phone.value, addr: f.addr.value, ship: (f.querySelector('[name="ship"]:checked') || {}).value || 'kuryer' });

  body.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (q) {
      const l = state.lines[+q.dataset.q];
      l.qty += +q.dataset.d;
      if (l.qty <= 0) state.lines.splice(+q.dataset.q, 1);
      save(state.lines); updateCount(false); render(); return;
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) { state.lines.splice(+rm.dataset.rm, 1); save(state.lines); updateCount(false); render(); return; }
    if (e.target.closest('[data-checkout]')) { state.view = 'form'; render(); const n = $('[name="name"]', body); n && n.focus(); return; }
    if (e.target.closest('[data-back]')) { state.view = 'cart'; render(); }
  });

  function open() {
    if (!cart.hidden && cart.classList.contains('is-open')) { render(); return; }
    state.lastFocus = document.activeElement;
    if (state.view === 'done') state.view = 'cart';
    render();
    cart.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => cart.classList.add('is-open')));
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => $('.cart__x').focus(), 60);
  }
  function close() {
    cart.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    setTimeout(() => { cart.hidden = true; if (state.view === 'done') state.view = 'cart'; }, 450);
    state.lastFocus && state.lastFocus.focus && state.lastFocus.focus();
  }
  $$('[data-open-cart]').forEach((b) => b.addEventListener('click', open));
  cart.addEventListener('click', (e) => { if (e.target.closest('[data-close-cart]')) close(); });
  document.addEventListener('keydown', (e) => {
    if (cart.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = $$('button, input, textarea, a[href]', cart).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  return {
    get pick() { return state.pick === 'gilavar' ? 1 : 0; },
    get volScale() { return SCALE[state.vol]; },
  };
}

function radioKeys(group, sel, act) {
  group.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const items = $$(sel, group);
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n = items[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
    n.focus(); act(n);
  });
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
