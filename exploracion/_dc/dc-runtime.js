/* Omnicon Lab · visor de bocetos de diseño (.dc.html).
   Interpreta el formato de los bocetos: {{huecos}}, <sc-if>, <sc-for>, eventos y estado.
   Sin dependencias; corre en GitHub Pages. */
(function () {
  'use strict';
  var HOLE = /\{\{([^}]*)\}\}/g, WHOLE = /^\s*\{\{([^}]*)\}\}\s*$/;

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (p, cb) {
    var n = typeof p === 'function' ? p(this.state, this.props) : p;
    this.state = Object.assign({}, this.state, n || {});
    if (this._r) this._r();
    if (cb) cb();
  };
  DCLogic.prototype.forceUpdate = function () { if (this._r) this._r(); };
  window.DCLogic = DCLogic;

  function lookup(scope, expr) {
    var e = String(expr).trim();
    if (e === 'true') return true;
    if (e === 'false') return false;
    if (e === 'null') return null;
    if (e === 'undefined' || e === '') return undefined;
    if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
    if (/^(['"]).*\1$/.test(e)) return e.slice(1, -1);
    var parts = e.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (m, p) { var v = lookup(scope, p); return v == null ? '' : String(v); });
  }
  function evName(attr, el) {
    var n = attr.slice(2).toLowerCase();
    if (n === 'change') {
      var t = (el.getAttribute('type') || '').toLowerCase();
      if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(checkbox|radio|file|range|color|date)$/.test(t))) return 'input';
    }
    if (n === 'doubleclick') return 'dblclick';
    return n;
  }
  var BOOL = { checked: 1, disabled: 1, selected: 1, hidden: 1, readonly: 1, required: 1, open: 1, multiple: 1 };

  function render(src, scope, out) {
    for (var c = src.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { out.appendChild(document.createTextNode(c.nodeValue.indexOf('{{') < 0 ? c.nodeValue : interp(c.nodeValue, scope))); continue; }
      if (c.nodeType !== 1) continue;
      var tag = c.tagName.toLowerCase();
      if (tag === 'helmet' || tag === 'script') continue;
      if (tag === 'sc-if') {
        var raw = c.getAttribute('value') || '', m = raw.match(WHOLE);
        var cond = m ? lookup(scope, m[1]) : interp(raw, scope);
        if (cond && cond !== 'false') render(c, scope, out);
        continue;
      }
      if (tag === 'sc-for') {
        var lraw = c.getAttribute('list') || '', lm = lraw.match(WHOLE);
        var list = lm ? lookup(scope, lm[1]) : null, as = c.getAttribute('as') || 'item';
        if (list && list.length) for (var i = 0; i < list.length; i++) {
          var s = Object.create(scope); s[as] = list[i]; s.$index = i; render(c, s, out);
        }
        continue;
      }
      if (tag === 'template') continue;
      var el = c.cloneNode(false), attrs = [].slice.call(c.attributes);
      for (var a = 0; a < attrs.length; a++) {
        var name = attrs[a].name, val = attrs[a].value;
        if (name.indexOf('hint-') === 0) { el.removeAttribute(name); continue; }
        if (val.indexOf('{{') < 0) continue;
        var wm = val.match(WHOLE);
        if (/^on[a-z]/.test(name)) {
          el.removeAttribute(name);
          var fn = wm ? lookup(scope, wm[1]) : null;
          if (typeof fn === 'function') el.addEventListener(evName(name, c), (function (f) { return function (e) { f(e); }; })(fn));
          continue;
        }
        if (wm) {
          var rv = lookup(scope, wm[1]);
          if (BOOL[name]) { if (rv && rv !== 'false') el.setAttribute(name, ''); else el.removeAttribute(name); if (name === 'checked') el.checked = !!rv; continue; }
          if (rv == null || rv === false && !/^aria-/.test(name)) { el.removeAttribute(name); continue; }
          if (name === 'value' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) { el.setAttribute('value', String(rv)); el._dcValue = String(rv); continue; }
          if (typeof rv === 'function' || typeof rv === 'object') { el.removeAttribute(name); continue; }
          el.setAttribute(name, String(rv));
        } else el.setAttribute(name, interp(val, scope));
      }
      if (tag === 'a') {
        var href = el.getAttribute('href') || '';
        if (/\.dc\.html(#.*)?$/.test(href) && !/^https?:/.test(href)) {
          el.addEventListener('click', (function (h) { return function (e) { e.preventDefault(); if (window.parent && window.parent !== window) window.parent.postMessage({ dcGo: h }, '*'); }; })(href));
        }
      }
      render(c, scope, el);
      if (el._dcValue != null) el.value = el._dcValue;
      out.appendChild(el);
    }
  }

  function pathOf(node, root) {
    var p = []; while (node && node !== root) { var i = 0, s = node; while ((s = s.previousSibling)) i++; p.unshift(i); node = node.parentNode; } return p;
  }
  function byPath(root, p) { var n = root; for (var i = 0; i < p.length && n; i++) n = n.childNodes[p[i]]; return n; }

  function mount(container, url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'text/html');
      var xdc = doc.querySelector('x-dc'); if (!xdc) throw new Error('sin x-dc');
      var title = doc.querySelector('title'); if (title) document.title = title.textContent;
      if (doc.documentElement.lang) document.documentElement.lang = doc.documentElement.lang;
      var helmet = xdc.querySelector('helmet');
      if (helmet) [].forEach.call(helmet.children, function (h) { document.head.appendChild(document.importNode(h, true)); });
      var sc = doc.querySelector('script[data-dc-script]'), props = {}, Comp = DCLogic;
      if (sc) {
        try { var dp = JSON.parse(sc.getAttribute('data-props') || '{}'); Object.keys(dp).forEach(function (k) { if (k.charAt(0) !== '$' && dp[k] && 'default' in dp[k]) props[k] = dp[k]['default']; }); } catch (e) {}
        Comp = new Function('DCLogic', sc.textContent + '\n;return typeof Component !== "undefined" ? Component : DCLogic;')(DCLogic);
      }
      var inst = new Comp(props); if (!inst.props) inst.props = props; if (!inst.state) inst.state = {};
      var rerender = function () {
        var ae = document.activeElement, fp = null, ss = null, se = null;
        if (ae && container.contains(ae) && ae !== container) { fp = pathOf(ae, container); try { ss = ae.selectionStart; se = ae.selectionEnd; } catch (e) {} }
        var vals = typeof inst.renderVals === 'function' ? inst.renderVals() || {} : {};
        var frag = document.createDocumentFragment(); render(xdc, vals, frag);
        container.replaceChildren(frag);
        if (fp) { var n = byPath(container, fp); if (n && n.focus) { n.focus(); try { if (ss != null) n.setSelectionRange(ss, se); } catch (e) {} } }
      };
      inst._r = rerender; rerender();
      if (typeof inst.componentDidMount === 'function') inst.componentDidMount();
      return inst;
    });
  }
  window.DCRender = { mount: mount };
})();
