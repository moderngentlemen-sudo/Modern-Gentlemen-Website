/* Modern Gentlemen — shared shopping bag (localStorage + events).
   Loaded as a plain <script> in each store page's <helmet>, AFTER mg-catalog.js.
   Sets window.MGBag. Persists to localStorage key 'mg-bag' and broadcasts
   'mg-bag-change' on window for any mounted DC to re-render. */
(function () {
  var KEY = 'mg-bag';
  var MEMBER_KEY = 'mg-member';

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(function (x) { return x && x.slug && x.qty > 0; }) : [];
    } catch (e) { return []; }
  }
  function write(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {}
    emit();
  }
  function emit() {
    try { window.dispatchEvent(new CustomEvent('mg-bag-change')); } catch (e) {}
  }

  var api = {
    raw: read,
    // enriched line items joined against the catalog
    items: function () {
      var cat = window.MGCatalog;
      return read().map(function (line) {
        var p = cat && cat.get ? cat.get(line.slug) : null;
        return {
          slug: line.slug,
          qty: line.qty,
          name: p ? p.name : line.slug,
          price: p ? p.price : 0,
          catLabel: p ? p.catLabel : '',
          image: p ? p.images[0] : '',
          lineTotal: (p ? p.price : 0) * line.qty
        };
      });
    },
    count: function () { return read().reduce(function (a, l) { return a + l.qty; }, 0); },
    subtotal: function () {
      var cat = window.MGCatalog;
      return read().reduce(function (a, l) {
        var p = cat && cat.get ? cat.get(l.slug) : null;
        return a + (p ? p.price : 0) * l.qty;
      }, 0);
    },
    has: function (slug) { return read().some(function (l) { return l.slug === slug; }); },
    qtyOf: function (slug) { var f = read().filter(function (l) { return l.slug === slug; })[0]; return f ? f.qty : 0; },
    add: function (slug, qty) {
      qty = qty || 1;
      var arr = read(), found = false;
      arr.forEach(function (l) { if (l.slug === slug) { l.qty += qty; found = true; } });
      if (!found) arr.push({ slug: slug, qty: qty });
      write(arr);
    },
    setQty: function (slug, qty) {
      var arr = read();
      if (qty <= 0) { api.remove(slug); return; }
      arr.forEach(function (l) { if (l.slug === slug) l.qty = qty; });
      write(arr);
    },
    remove: function (slug) {
      write(read().filter(function (l) { return l.slug !== slug; }));
    },
    clear: function () { write([]); },
    // membership (drives 15% pricing)
    isMember: function () { try { return localStorage.getItem(MEMBER_KEY) === '1'; } catch (e) { return false; } },
    setMember: function (v) { try { localStorage.setItem(MEMBER_KEY, v ? '1' : '0'); } catch (e) {} emit(); },
    memberRate: 0.15
  };

  // keep pages in sync when the bag changes in another tab
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === MEMBER_KEY) emit();
  });

  window.MGBag = api;
  try { window.dispatchEvent(new CustomEvent('mg-bag-ready')); } catch (e) {}
})();
