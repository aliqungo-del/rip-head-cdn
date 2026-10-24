
(function () {
  'use strict';

  /* ==================== НАСТРОЙКИ ==================== */
  var CFG = {

    /* ── ОБЩИЕ НАСТРОЙКИ: действуют на все группы ────────────────────
       Любую из них можно переопределить внутри отдельной группы.      */
    duration: 0.95,          /* сек — ПОТОЛОК времени полёта одного элемента */
    speed: 850,              /* px/сек — крейсерская скорость: время полёта
                                считается от дистанции, поэтому короткий
                                подъём из-под края экрана не выглядит вялым.
                                0 = выключить и жить по duration */
    durationMin: 0.45,       /* сек — минимум времени для коротких дистанций */
    stagger: 0.09,           /* сек — пауза между элементами внутри группы */
    bounce: 14,              /* px — ПОТОЛОК отскока */
    bounceShare: 0.06,       /* отскок = дистанция × эта доля (но не больше
                                bounce). 0 = всегда ровно bounce px */
    distance: 'auto',        /* 'auto' — ровно из-под нижнего края экрана; или число px */
    extra: 24,               /* запас к авто-дистанции, px */
    minDistance: 180,        /* ближе этого не отлетаем, px */
    maxDistance: 0,          /* 0 — без потолка. 200–300 = полёт короче и спокойнее,
                                если во время анимации «дёргается» прокрутка */
    fade: true,              /* true — элемент проявляется по ходу полёта */
    delay: 0.05,             /* сек — пауза перед первым элементом группы */

    /* ── ГРУППЫ ЭЛЕМЕНТОВ ────────────────────────────────────────────
       Каждая группа — свой список целей и свой момент запуска:

         { name:    'как называть в консоли',
           trigger: 'load' | 'scroll',
           targets: ['.класс-1', '#rec1234567890'] }

       trigger: 'load'   — вылетает сразу при открытии страницы
       trigger: 'scroll' — вылетает, когда элемент доехал до экрана

       targets: [] — авто-режим внутри группы:
           для 'load'   — берутся блоки Tilda первого экрана,
           для 'scroll' — берутся все остальные блоки страницы.
       Блок, попавший в одну группу, в другую уже не попадает.

       В группе можно переопределить ЛЮБУЮ общую настройку:
           duration, speed, durationMin, stagger, bounce, bounceShare,
           distance, extra, minDistance, maxDistance, fade, delay,
           repeat, oncePerSession, autoFactor, exclude,
           raiseZ, zIndex, onlyFirstScreen

       Дополнительно у группы есть:
           repeat: true          — взлетать заново при каждом доезде
                                   до экрана (только для 'scroll')
           oncePerSession: true  — проиграть один раз за сессию браузера
           exclude: ['.t-popup'] — что игнорировать в авто-режиме        */
    groups: [
      { name: 'Первый экран', trigger: 'load',
        targets: ['.rip-card-1', '.rip-card-2', '.rip-card-3', '.rip-card-4', '.rip-card-5',
                  '.rip-card-6', '.rip-card-7', '.rip-card-8'] },

      { name: 'Ниже сгиба', trigger: 'scroll', stagger: 0.12, bounce: 18,
        targets: ['.rip-card-scroll'] }
    ],

    /* ── СТАРЫЙ ФОРМАТ (одна группа). Работает, если groups пуст ─────── */
    trigger: 'load',         /* 'load' — при открытии; 'scroll' — при доезде */
    targets: [],             /* классы элементов или номера блоков */

    /* ── ТЕХНИКА ───────────────────────────────────────────────────── */
    noFlash: true,           /* true — часть 1 вставлена, блоки спрятаны до старта */
    raiseZ: true,            /* true — поднимать летящий элемент над соседями */
    zIndex: 3,
    stripTildaAnimate: true, /* true — гасить родную анимацию Tilda внутри целей */
    once: false,             /* true = oncePerSession сразу для всех групп */
    log: false,               /* true — отчёт в консоль браузера */
    debug: false             /* true — то же + красная рамка вокруг целей */
  };
  /* ================== /НАСТРОЙКИ ================== */


  var docEl = document.documentElement;
  var groups = [];
  var claimed = [];

  /* настройки, которые можно переопределить внутри группы */
  var GROUP_KEYS = [
    'trigger', 'stagger', 'duration', 'speed', 'durationMin', 'bounce', 'bounceShare',
    'distance', 'extra', 'minDistance', 'maxDistance', 'fade', 'delay', 'repeat',
    'oncePerSession', 'autoFactor', 'exclude', 'raiseZ', 'zIndex', 'onlyFirstScreen'
  ];

  /* ---------- утилиты ---------- */

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function toSelector(item) {
    if (/^[#.[]/.test(item)) return item;          /* уже CSS-селектор */
    if (/^rec\d+$/.test(item)) return '#' + item;  /* «rec123…»          */
    if (/^\d+$/.test(item)) return '#rec' + item;  /* «123…»             */
    return item;
  }

  function unique(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && out.indexOf(list[i]) === -1) out.push(list[i]);
    }
    return out;
  }

  function describe(el) {
    if (el.id) return '#' + el.id;
    var cls = (typeof el.className === 'string') ? el.className : '';
    cls = cls.split(/\s+/).filter(function (c) { return c && c !== 'r' && c !== 't-rec'; });
    return cls.length ? '.' + cls.slice(0, 3).join('.') : el.tagName.toLowerCase();
  }

  function skip(el, strict) {
    if (!el || !el.getBoundingClientRect) return true;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    var r = el.getBoundingClientRect();
    if (r.height < 8 || r.width < 8) return true;
    if (!strict) return false;
    if (r.height < 24 || r.width < 24) return true;                  /* пустышка  */
    if (cs.position === 'fixed' || cs.position === 'sticky') return true; /* меню/хедер */
    return false;
  }

  function matchesExclude(el, g) {
    var list = (g && g.exclude) || CFG.exclude || [];
    for (var i = 0; i < list.length; i++) {
      try { if (el.matches(list[i])) return true; } catch (e) {}
    }
    return false;
  }

  function allRecords() {
    var list = [].slice.call(document.querySelectorAll('#allrecords > .t-rec'));
    if (!list.length) list = [].slice.call(document.querySelectorAll('#allrecords .t-rec'));
    return list;
  }

  function byTop(a, b) {
    return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
  }

  /* ---------- группы ---------- */

  function makeGroups() {
    var raw = (CFG.groups && CFG.groups.length)
      ? CFG.groups
      : [{ name: 'основная (старый формат)', trigger: CFG.trigger, targets: CFG.targets }];

    var out = [], i, j, k;

    for (i = 0; i < raw.length; i++) {
      var src = raw[i] || {};
      var g = { name: src.name || ('группа ' + (i + 1)), index: i, targets: src.targets || [], items: [] };

      /* сначала общие настройки, затем переопределения группы */
      for (k in CFG) { if (k !== 'groups' && k !== 'trigger' && k !== 'targets') g[k] = CFG[k]; }
      for (j = 0; j < GROUP_KEYS.length; j++) {
        k = GROUP_KEYS[j];
        if (src[k] !== undefined) g[k] = src[k];
      }

      g.trigger = src.trigger || 'load';
      g.exclude = g.exclude || [];
      if (g.delay === undefined) g.delay = CFG.delay;
      if (g.oncePerSession === undefined) g.oncePerSession = !!CFG.once;
      if (g.onlyFirstScreen === undefined) g.onlyFirstScreen = (g.trigger === 'load');
      out.push(g);
    }
    return out;
  }

  function collectGroup(g) {
    var picked = [], i, explicit = !!(g.targets && g.targets.length);

    if (explicit) {
      for (i = 0; i < g.targets.length; i++) {
        var found = [];
        try { found = [].slice.call(document.querySelectorAll(toSelector(g.targets[i]))); } catch (e) {}
        if (!found.length) {
          console.warn('[rip-fly] группа «' + g.name + '»: по селектору "' + g.targets[i] +
            '" ничего не найдено — проверьте поле «Класс» у элемента и точку перед именем класса.');
        }
        picked = picked.concat(found);
      }
    } else {
      var limit = window.innerHeight * (g.autoFactor || 0.92);
      var recs = allRecords();
      for (i = 0; i < recs.length; i++) {
        var el = recs[i];
        if (matchesExclude(el, g) || skip(el, true)) continue;
        var top = el.getBoundingClientRect().top;
        if (g.onlyFirstScreen && top > limit) continue;        /* только первый экран */
        if (!g.onlyFirstScreen && top <= limit) continue;      /* только то, что ниже */
        picked.push(el);
      }
      picked.sort(byTop);
    }

    return unique(picked).filter(function (el) {
      if (skip(el, false)) return false;
      if (claimed.indexOf(el) !== -1) {
        if (explicit) console.warn('[rip-fly] ' + describe(el) + ' уже занят другой группой — пропускаю.');
        return false;
      }
      return true;
    });
  }

  /* ---------- подготовка ---------- */

  function stripAnimate(el) {
    var inner = [].slice.call(el.querySelectorAll('.t-animate, .t-animate_started'));
    for (var i = 0; i < inner.length; i++) {
      inner[i].classList.remove('t-animate', 't-animate_started', 't-animate_init');
      inner[i].style.opacity = '';
      inner[i].style.transform = '';
      inner[i].style.transition = '';
    }
  }

  function distanceFor(el, g) {
    var d;
    if (typeof g.distance === 'number') {
      d = g.distance;
    } else {
      d = Math.max(g.minDistance, window.innerHeight - el.getBoundingClientRect().top + g.extra);
    }
    if (g.maxDistance) d = Math.min(d, g.maxDistance);
    return d;
  }

  function prepare(el, g) {
    el.classList.add('rip-fly-el');
    if (g.raiseZ) {
      el.classList.add('rip-fly-z');
      el.style.setProperty('--rip-fly-z', g.zIndex);
    }
    if (CFG.stripTildaAnimate) stripAnimate(el);
    /* дистанцию считаем до того, как элемент сдвинут */
    el.ripFlyDist = distanceFor(el, g);
    return el;
  }

  /* quiet = true: прячем только прозрачностью, без сдвига. Так элемент
     не удлиняет прокручиваемую область, пока ждёт своей очереди. */
  function hide(el, g, quiet) {
    if (!quiet) {
      if (el.ripFlyDist === undefined) el.ripFlyDist = distanceFor(el, g);
      el.style.transform = 'translateY(' + el.ripFlyDist + 'px)';
    }
    el.style.opacity = g.fade ? '0' : '1';
  }

  /* Сразу по окончании полёта возвращаем элементу обычные transform и opacity.
     А will-change и «поднятие» по z-index снимаем с задержкой (settle):
     их снятие вызывает перерисовку, и если сделать это ровно в момент
     остановки элемента, виден короткий провал прозрачности. */
  function cleanup(el, anim) {
    el.style.transform = '';
    el.style.opacity = '';
    el.ripFlyBusy = false;
    if (anim && anim.cancel) anim.cancel();
  }

  /* ---------- ловушка прокрутки ----------
     Пока элемент сдвинут вниз, он временно удлиняет прокручиваемую
     область. Если у предка стоит overflow-x: hidden (браузер тогда
     считает overflow-y = auto), предок на время становится собственным
     скроллером: колесо мыши крутит его, а не страницу. В конце анимации
     всё откатывается — выглядит как «страница не листается, пока грузится».
     Лечим: у таких предков на время полёта меняем overflow-x на clip —
     обрезка остаётся, а скроллер не создаётся. Потом возвращаем как было. */

  var clipOK = (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('overflow', 'clip'));
  var patched = [];
  var flyingCount = 0;
  var settleTimer = null;

  function patchAround(el) {
    if (!clipOK) return;
    var node = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      var already = false;
      for (var i = 0; i < patched.length; i++) {
        if (patched[i].node === node) { already = true; break; }
      }
      if (!already) {
        var cs = window.getComputedStyle(node);
        /* трогаем только тех, кто прямо сейчас реально стал скроллером */
        if (cs.overflowY !== 'visible' && node.scrollHeight > node.clientHeight + 1) {
          patched.push({ node: node, ox: node.style.overflowX, oy: node.style.overflowY });
          node.style.overflowX = 'clip';
          node.style.overflowY = 'visible';
        }
      }
      node = node.parentElement;
    }
    if (patched.length) docEl.style.overflowAnchor = 'none';
  }

  function unpatch() {
    for (var i = 0; i < patched.length; i++) {
      patched[i].node.style.overflowX = patched[i].ox;
      patched[i].node.style.overflowY = patched[i].oy;
    }
    patched = [];
    docEl.style.overflowAnchor = '';
  }

  function finishFlight(el, anim) {
    cleanup(el, anim);
    flyingCount--;
    if (flyingCount <= 0) {
      flyingCount = 0;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () {
        if (flyingCount <= 0) settle();
      }, 400);
    }
  }

  /* «остывание»: снимаем will-change и возвращаем контейнерам их overflow,
     когда все полёты давно закончились и глазу не за что зацепиться */
  function settle() {
    unpatch();
    var els = document.querySelectorAll('.rip-fly-el');
    for (var i = 0; i < els.length; i++) {
      if (els[i].ripFlyBusy) continue;
      els[i].style.willChange = 'auto';
      els[i].classList.remove('rip-fly-z');
      els[i].style.removeProperty('--rip-fly-z');
    }
  }

  /* ---------- полёт ---------- */

  /* время полёта и отскок считаем от дистанции: короткий подъём от нижнего
     края экрана не должен длиться столько же, сколько полёт через весь экран */
  function timingFor(dist, g) {
    var dur = g.duration;
    if (g.speed) dur = Math.min(g.duration, Math.max(g.durationMin, dist / g.speed));
    var b = g.bounce;
    if (g.bounceShare) b = Math.min(g.bounce, Math.max(3, dist * g.bounceShare));
    return { dur: dur, bounce: b };
  }

  function fly(el, delay, g) {
    var dist = (el.ripFlyDist === undefined) ? distanceFor(el, g) : el.ripFlyDist;
    var t = timingFor(dist, g);
    var b = t.bounce;
    var wait = Math.max(0, Math.round(delay * 1000));   /* мс, целое */

    flyingCount++;
    el.style.willChange = 'transform, opacity';
    if (g.raiseZ) {          /* возвращаем «поднятие», если settle его уже снял */
      el.classList.add('rip-fly-z');
      el.style.setProperty('--rip-fly-z', g.zIndex);
    }

    if (typeof el.animate === 'function') {
      /* ВАЖНО: opacity указан в КАЖДОМ кадре, включая последний.
         Если свойство не задано в крайнем кадре, движок берёт его из
         базового стиля элемента — а у скролл-элементов базовый opacity
         это 0 (их так прячут до вылета). Тогда в конце полёта прозрачность
         уезжала обратно к нулю и сразу возвращалась: «мигнул после отскока». */
      var frames = [
        { transform: 'translateY(' + dist + 'px)', opacity: g.fade ? 0 : 1,
          easing: 'cubic-bezier(.20,.72,.26,1)' },
        { offset: 0.55, transform: 'translateY(-' + b + 'px)', opacity: 1, easing: 'ease-in-out' },
        { offset: 0.76, transform: 'translateY(0px)',          opacity: 1, easing: 'ease-in-out' },
        { offset: 0.90, transform: 'translateY(-' + (b * 0.3) + 'px)', opacity: 1, easing: 'ease-in-out' },
        { offset: 1,    transform: 'translateY(0px)',          opacity: 1 }
      ];
      var anim = el.animate(frames, { duration: t.dur * 1000, delay: wait, fill: 'both' });
      patchAround(el);                       /* сдвиг уже применён — проверяем предков */
      anim.onfinish = function () { finishFlight(el, anim); };
      return anim;
    }

    /* запасной путь — CSS-transition (для очень старых браузеров) */
    el.style.transition = 'none';
    hide(el, g);
    void el.offsetHeight;
    el.style.transition = 'transform ' + t.dur + 's cubic-bezier(.22,1.25,.36,1) ' + delay + 's, ' +
                          'opacity ' + (t.dur * 0.7) + 's linear ' + delay + 's';
    el.style.transform = 'translateY(0px)';
    el.style.opacity = '1';
    patchAround(el);
    clearTimeout(el.ripFlyTimer);
    el.ripFlyTimer = setTimeout(function () {
      el.style.transition = '';
      finishFlight(el, null);
    }, (t.dur + delay) * 1000 + 120);
    return null;
  }

  /* ---------- запуск групп ---------- */

  function startLoadGroup(g) {
    g.items.forEach(function (el, i) {
      fly(el, g.delay + i * g.stagger, g);
    });
  }

  function startScrollGroup(g) {
    /* ждут своей очереди невидимыми, но БЕЗ сдвига — чтобы не тянуть
       за собой прокручиваемую область страницы */
    g.items.forEach(function (el) { hide(el, g, true); });

    var io = new IntersectionObserver(function (entries) {
      var batch = 0;                       /* внутри одной порции — своя лесенка */
      entries.forEach(function (entry) {
        var el = entry.target;
        var grp = el.ripFlyGroup || g;
        if (entry.isIntersecting) {
          if (el.ripFlyBusy) return;
          el.ripFlyBusy = true;
          el.ripFlyDist = distanceFor(el, grp);   /* свежий замер от текущего места */
          if (!grp.repeat) io.unobserve(el);
          fly(el, grp.delay + batch++ * grp.stagger, grp);
        } else if (grp.repeat && !el.ripFlyBusy) {
          hide(el, grp, true);                    /* ждём снова — тоже без сдвига */
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

    g.items.forEach(function (el) { io.observe(el); });
    g.io = io;
  }

  /* ---------- сессия ---------- */

  function sessKey(g) { return 'rip-fly:' + g.name + ':' + g.index; }
  function playedBefore(g) {
    try { return sessionStorage.getItem(sessKey(g)) === '1'; } catch (e) { return false; }
  }
  function rememberPlayed(g) {
    try { sessionStorage.setItem(sessKey(g), '1'); } catch (e) {}
  }

  /* ---------- отчёт и показ страницы ---------- */

  function logGroups() {
    if (!CFG.log) return;
    console.info('%c[rip-fly] групп: ' + groups.length, 'font-weight:bold');
    groups.forEach(function (g) {
      if (g.skipped) {
        console.info('  «' + g.name + '» — пропущена (уже проиграна в этой сессии)');
        return;
      }
      var mode = (g.targets && g.targets.length) ? 'список' : 'авто';
      var list = g.items.map(describe).join(', ');
      console.info('  «' + g.name + '» [' + g.trigger + ', ' + mode + '] — ' + g.items.length + ' шт.' +
        (list ? ': ' + list : ' (ничего не найдено)'));
    });
    if (groups.some(function (g) { return !g.items.length && !g.skipped; })) {
      console.info('  подсказка: пустая группа — либо опечатка в targets, либо элементы уже заняты другой группой');
    }
  }

  function showEverything() {
    clearTimeout(docEl.ripFlyFallback);
    docEl.className = docEl.className.replace(/\brip-fly-init\b/, '');
  }

  /* ---------- главный сценарий ---------- */

  function run() {
    if (!CFG.noFlash) docEl.className = docEl.className.replace(/\brip-fly-init\b/, '');

    groups = makeGroups();

    /* 1. собрать цели по группам */
    var total = 0, i, j, g;

    for (i = 0; i < groups.length; i++) {
      g = groups[i];
      if (g.oncePerSession && playedBefore(g)) { g.skipped = true; continue; }
      g.items = collectGroup(g);
      total += g.items.length;
      for (j = 0; j < g.items.length; j++) {
        claimed.push(g.items[j]);
        g.items[j].ripFlyGroup = g;
      }
    }

    if (!total) { showEverything(); logGroups(); return; }

    /* 2. подготовить */
    for (i = 0; i < groups.length; i++) {
      for (j = 0; j < groups[i].items.length; j++) prepare(groups[i].items[j], groups[i]);
    }

    /* Tilda инициализирует свою анимацию тоже на DOMContentLoaded —
       может успеть после нас, поэтому гасим её повторно чуть позже */
    if (CFG.stripTildaAnimate) {
      setTimeout(function () {
        groups.forEach(function (grp) { grp.items.forEach(stripAnimate); });
      }, 900);
    }

    /* 3. запустить каждую группу своим способом */
    var hasIO = 'IntersectionObserver' in window;
    for (i = 0; i < groups.length; i++) {
      g = groups[i];
      if (!g.items.length || g.skipped) continue;
      if (g.trigger === 'scroll' && hasIO) startScrollGroup(g);
      else startLoadGroup(g);
      if (g.oncePerSession) rememberPlayed(g);
    }

    /* 4. показать всё, что не анимируем */
    logGroups();
    showEverything();

    if (CFG.debug) docEl.classList.add('rip-fly-debug');
  }

  /* доступ из консоли браузера: window.ripFly.cfg / .groups / .targets */
  window.ripFly = {
    cfg: CFG,
    get groups() { return groups; },
    get targets() {
      var all = [];
      groups.forEach(function (g) { all = all.concat(g.items || []); });
      return all;
    },
    /* Подхватить элементы, появившиеся ПОСЛЕ run(). Блоки, которые строят
       карточки из данных (поток), иначе остаются без полёта. */
    rescan: function () {
      var added = 0;
      groups.forEach(function (g) {
        if (!g || g.skipped || !g.targets || !g.targets.length) return;
        var found = [];
        g.targets.forEach(function (t) {
          var els;
          try { els = document.querySelectorAll(toSelector(t)); } catch (err) { els = []; }
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (claimed.indexOf(el) !== -1 || found.indexOf(el) !== -1) continue;
            var ex = false;
            if (g.exclude && el.matches) {
              g.exclude.forEach(function (sel) { if (el.matches(sel)) ex = true; });
            }
            if (!ex) found.push(el);
          }
        });
        found.forEach(function (el) {
          claimed.push(el);
          el.ripFlyGroup = g;
          el.style.transform = '';
          el.style.opacity = '';
          prepare(el, g);
          g.items.push(el);
          if (g.trigger === 'scroll' && g.io) {
            hide(el, g, true);
            g.io.observe(el);
          } else if (g.trigger === 'load') {
            fly(el, g.delay, g);
          }
          added++;
        });
      });
      if (added && CFG.log) console.info('[rip-fly] добавлено элементов: ' + added);
      return added;
    }
  };

  /* системная настройка «меньше движения» — ничего не анимируем */
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ready(showEverything);
    return;
  }

  ready(run);
})();
