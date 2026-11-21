(function () {
  'use strict';
  function fit() {
    document.querySelectorAll('.board').forEach(function (b) {
      var st = b.querySelector('.stage'), fr = st.querySelector('iframe');
      var w = +fr.getAttribute('width'), h = +fr.getAttribute('height');
      var max = b.classList.contains('wide') ? b.parentNode.clientWidth : Math.min(w, b.parentNode.clientWidth, 360);
      var s = Math.min(1, max / w);
      st.style.width = (w * s) + 'px'; st.style.height = (h * s) + 'px';
      fr.style.transform = 'scale(' + s + ')';
    });
  }
  addEventListener('resize', fit); fit();
  addEventListener('message', function (e) {
    var go = e.data && e.data.dcGo; if (!go) return;
    var id = 'b-' + String(go).replace(/^.*\//, '').replace(/\.dc\.html.*$/, '').replace(/[^A-Za-z0-9_-]/g, '-');
    var t = document.getElementById(id); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
