/* =====================================================================
   rip-head.js — скрипты поля «HTML-код для <head>» одним файлом.
   Версия: 1.0.03a26716
   Источник: head/modules/*.js (порядок — head/modules.json).
   Подключать БЕЗ defer/async: первому скрипту (антимерцание) нужно
   выполниться до первой отрисовки страницы.
   Состав:
   07-fly-up-blocks          485 симв.  Взлёт блоков: антимерцание
   11-scroll-restore          60 симв.  Сброс прокрутки при перезагрузке
   16-zero-block-fit        5356 симв.  Высота артборда Zero Block с потоком (наезд нижних блоков)
   ===================================================================== */

/* ===== 07-fly-up-blocks · Взлёт блоков: антимерцание ===== */
(function () {
  var d = document.documentElement;
  d.className += ' rip-fly-init';
  d.ripFlyFallback = setTimeout(function () {
    /* аварийный показ: снимаем «шторку» и раскрываем всё, что успело спрятаться */
    d.className = d.className.replace(/\brip-fly-init\b/, '') + ' rip-fly-off';
    var els = document.querySelectorAll('.rip-fly-el');
    for (var i = 0; i < els.length; i++) {
      els[i].style.opacity = '';
      els[i].style.transform = '';
    }
  }, 3000);
})();

/* ===== 11-scroll-restore · Сброс прокрутки при перезагрузке ===== */
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ===== 16-zero-block-fit · Высота артборда Zero Block с потоком (наезд нижних блоков) ===== */
/* =====================================================================
   ВЫСОТА АРТБОРДА ZERO BLOCK С ПОТОКОМ · общий модуль (v1.0.0)

   Зачем. Тильда считает высоту артборда один раз — до того, как поток
   дорисует карточки. Нижние блоки встают по этой старой высоте и наезжают
   на карточки (симптом: «Частые вопросы» поверх списка программ).

   Что делает. Ведёт высоту артборда замером по содержимому и один раз
   сообщает Тильде событием resize, чтобы она пересчитала сетку. Правило
   из ZERO-BLOCK-ГРАБЛИ.md: высоту артборда в CSS не задавать никогда,
   её ведёт скрипт замером — по детям, а не по scrollHeight артборда
   (у него overflow, поэтому scrollHeight залипает на росте).

   Чего не трогает:
     • артборды с фиксированной высотой (data-artboard-heightmode ≠ hug);
     • артборды без потока внутри (data-fe-role="feed");
     • декоративные absolute-слои (carrier/filter) — они всегда равны
       высоте артборда и замер бы залип.

   Повторные замеры: после загрузки (поток рисуется позже), на resize, на
   изменения внутри потока (дорисовались карточки, сработал поиск) и после
   собственного resize — Тильда может вернуть свою высоту, тогда повторяем.
   ===================================================================== */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var SEL_FEED = '[data-fe-role="feed"]';
  var SEL_ARTBOARD = '.t396__artboard';
  var WATCHED = 'data-rip-fit-watched';

  var pending = 0;
  var repeats = 0;
  var settle = 0;

  /* Низ содержимого артборда: только дети в потоке, плюс их margin-bottom. */
  function contentBottom(artboard) {
    var box = artboard.getBoundingClientRect();
    if (!box.height) return 0;
    var bottom = 0;
    var kids = artboard.children;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      var style = window.getComputedStyle(kid);
      if (style.display === 'none') continue;
      if (style.position === 'absolute' || style.position === 'fixed') continue;
      var r = kid.getBoundingClientRect();
      if (!r.height) continue;
      var b = r.bottom - box.top + (parseFloat(style.marginBottom) || 0);
      if (b > bottom) bottom = b;
    }
    return Math.ceil(bottom);
  }

  function fit() {
    var feeds = document.querySelectorAll(SEL_FEED);
    var changed = false;
    for (var i = 0; i < feeds.length; i++) {
      var artboard = feeds[i].closest(SEL_ARTBOARD);
      if (!artboard) continue;
      if (artboard.getAttribute('data-artboard-heightmode') !== 'hug') continue;
      var need = contentBottom(artboard);
      if (!need) continue;
      var current = Math.round(artboard.getBoundingClientRect().height);
      if (Math.abs(need - current) < 2) continue;
      artboard.style.height = need + 'px';
      changed = true;
    }
    if (changed) announce();
  }

  /* Один resize на пачку изменений + контрольный замер после него. */
  function announce() {
    if (pending) return;
    pending = window.setTimeout(function () {
      pending = 0;
      try { window.dispatchEvent(new Event('resize')); } catch (e) { /* старые браузеры */ }
      window.setTimeout(function () {
        if (repeats++ < 4) fit();
      }, 200);
    }, 60);
  }

  function scheduleFit() {
    if (settle) return;
    settle = window.setTimeout(function () {
      settle = 0;
      fit();
    }, 50);
  }

  function observeFeeds() {
    if (!window.MutationObserver) return;
    var feeds = document.querySelectorAll(SEL_FEED);
    for (var i = 0; i < feeds.length; i++) {
      var feed = feeds[i];
      if (feed.getAttribute(WATCHED) === 'y') continue;
      feed.setAttribute(WATCHED, 'y');
      var observer = new MutationObserver(scheduleFit);
      observer.observe(feed, { childList: true, subtree: true });
    }
  }

  function boot() {
    repeats = 0;
    observeFeeds();
    fit();
    /* Поток рисует карточки асинхронно: добираем замер по вехам загрузки. */
    var delays = [0, 200, 600, 1200, 2400, 4000];
    for (var i = 0; i < delays.length; i++) {
      window.setTimeout(function () {
        repeats = 0;
        observeFeeds();
        fit();
      }, delays[i]);
    }
  }

  window.addEventListener('resize', function () {
    repeats = 0;
    scheduleFit();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', boot);

  document.documentElement.setAttribute('data-rip-fit-js', VERSION);
})();
