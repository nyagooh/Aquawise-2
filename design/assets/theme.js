(function () {
  var KEY = 'aquawise-theme';
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  }

  function svg(paths) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }
  var SUN = svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>');
  var MOON = svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');

  function build() {
    var btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.setAttribute('data-tooltip', 'Toggle theme');
    btn.innerHTML = '<span class="icon-sun">' + SUN + '</span><span class="icon-moon">' + MOON + '</span>';
    btn.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      if (!current) {
        var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        current = prefersLight ? 'light' : 'dark';
      }
      var next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
    return btn;
  }

  function mount() {
    if (document.querySelector('.theme-toggle')) return;
    var slot = document.querySelector('.topbar-actions') ||
               document.querySelector('.mobile-topbar') ||
               document.querySelector('.topbar');
    if (slot) {
      var btn = build();
      var firstIcon = slot.querySelector('.icon-btn');
      if (firstIcon) slot.insertBefore(btn, firstIcon);
      else slot.appendChild(btn);
      return;
    }
    var btn = build();
    btn.style.position = 'fixed';
    btn.style.top = '16px';
    btn.style.right = '16px';
    btn.style.zIndex = '9999';
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
