/* =====================================================================
   rip-head.js — скрипты поля «HTML-код для <head>» одним файлом.
   Версия: 1.0.09abf294
   Источник: head/modules/*.js (порядок — head/modules.json).
   Подключать БЕЗ defer/async: первому скрипту (антимерцание) нужно
   выполниться до первой отрисовки страницы.
   Состав:
   07-fly-up-blocks          485 симв.  Взлёт блоков: антимерцание
   11-scroll-restore          60 симв.  Сброс прокрутки при перезагрузке
   16-zero-block-fit        4560 симв.  Высота артборда Zero Block с потоком (наезд нижних блоков)
   19-breadcrumbs           9146 симв.  Хлебные крошки: цепочка по адресу, вставка над H1
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
   ВЫСОТА АРТБОРДА ZERO BLOCK С ПОТОКОМ · общий модуль (v1.1.0)

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
     • артборды без потока/списка внутри (data-fe-role="feed" или
       .rip-related__list — сопутствующие программы);
     • декоративные absolute-слои (carrier/filter) — они всегда равны
       высоте артборда и замер бы залип.

   Повторные замеры: после загрузки (поток рисуется позже), на resize, на
   изменения внутри потока (дорисовались карточки, сработал поиск) и после
   собственного resize — Тильда может вернуть свою высоту, тогда повторяем.
   ===================================================================== */
(function () {
  'use strict';

  var VERSION = '1.1.0';
  var SEL_FEED = '[data-fe-role="feed"], .rip-related__list';
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

/* ===== 19-breadcrumbs · Хлебные крошки: цепочка по адресу, вставка над H1 ===== */
/* =====================================================================
   ХЛЕБНЫЕ КРОШКИ · механика (v1.0.0)

   Что делает. На каждой внутренней странице строит цепочку
   «Главная / Раздел / Страница» и вставляет её в тот же блок, где стоит
   H1 — прямо над заголовком. На главной, на служебных страницах и на
   шаблонах крошек нет.

   Откуда берётся цепочка:
     • раздел — из адреса (/uslugi, /poslednie-novosti, /stoimost-obuchenija,
       /kontakty), названия разделов совпадают с названиями страниц Тильды;
     • категория программы — из адреса /uslugi/c/<id>/<слаг>/<программа>:
       слаг в адресе, поэтому id → название лежит в CATEGORIES ниже;
     • последний пункт — текст H1 страницы. Он же и есть «текущая страница»,
       поэтому ссылки у него нет (aria-current="page").

   Чего не делает: не двигает заголовок. Крошки встают в поток самого блока
   и забирают свою высоту из его padding-top: 60px → 60 − h. Если отступа
   меньше высоты крошек (узкий экран, длинное название), блок просто
   опускается на разницу — наложения на H1 не будет никогда.

   Почему не отдельным блоком в Тильде: крошек не должно быть ни на главной,
   ни на служебных страницах, а страниц с H1 больше двадцати — держать их
   синхронно руками нечем. Один скрипт = один вид на всём сайте.

   Никаких зависимостей: ни jQuery, ни Tilda API.
   ===================================================================== */
(function () {
  'use strict';

  var VERSION = '1.0.0';

  var HOME = { label: 'Главная', href: '/' };
  var PROGRAMS = { label: 'Образовательные программы', href: '/uslugi' };
  var NEWS = { label: 'Новости', href: '/poslednie-novosti' };

  /* id категории из адреса /uslugi/c/<id>/… → название её страницы.
     В адресе только слаг, а название живёт на странице категории; чтобы не
     тянуть её отдельным запросом, список лежит здесь. Новая категория без
     записи крошки не ломает: в цепочке просто не будет этого звена. */
  var CATEGORIES = {
    '9': 'Автодорожное направление, перевозка опасных грузов',
    '10': 'Подготовка и повышение квалификации преподавателей, мастеров производственного обучения и методистов',
    '11': 'Безопасный город, охрана труда, пожарная безопасность, антитеррор, борьба с коррупцией',
    '12': 'Газовое хозяйство, лифтовое хозяйство',
    '13': 'Кадры, подбор персонала и социальная работа',
    '14': 'Спорт, психология, библиотечное дело и культура',
    '16': 'Экологическая безопасность',
    '17': 'Право',
    '20': 'Логистика',
    '21': 'Туризм, гостиничное и ресторанное дело',
    '22': 'Менеджмент и управление',
    '24': 'Кинология',
    '25': 'Агрономия',
    '28': 'Товароведение'
  };

  /* Страницы без крошек: главная, 404, служебные и шаблоны лент.
     Шаблоны лент (novost, programm-tempalte) открываются и напрямую — там
     нет осмысленного пути, а на страницах постов крошки строятся по адресу
     поста, а не шаблона. */
  var SKIP = {
    '/': 1,
    '/page404': 1,
    '/price-data': 1,
    '/doc-upload': 1,
    '/novost': 1,
    '/programm-tempalte': 1,
    '/headheader': 1,
    '/ripfooter': 1
  };

  var mounted = null;   /* { rec, nav } — чтобы пересчитывать отступ */
  var resizeTimer = 0;

  function normalizePath() {
    var path = location.pathname.replace(/\/+$/, '');
    return path || '/';
  }

  /* Первый видимый H1 страницы. Скрытые копии (мобильная/десктопная вёрстка
     блока) пропускаем: крошки должны стоять у того заголовка, который видно. */
  function firstHeading() {
    var list = document.querySelectorAll('h1');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!el.getClientRects().length) continue;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) return { el: el, text: text };
    }
    return null;
  }

  function isNotFound(title) {
    if (/^страница не найдена/i.test(title)) return true;
    return !!document.querySelector('.t404, #t404, .t-404');
  }

  /* Цепочка для текущего адреса. Последний пункт без href — это «мы здесь». */
  function buildTrail(path, title) {
    var m;

    if (path === '/uslugi') {
      return [HOME, { label: PROGRAMS.label }];
    }

    if ((m = path.match(/^\/uslugi\/c\/(\d+)\/([^/]+)$/))) {
      return [HOME, PROGRAMS, { label: title }];
    }

    if ((m = path.match(/^\/uslugi\/c\/(\d+)\/([^/]+)\/([^/]+)$/))) {
      var trail = [HOME, PROGRAMS];
      var category = CATEGORIES[m[1]];
      if (category) trail.push({ label: category, href: '/uslugi/c/' + m[1] + '/' + m[2] });
      trail.push({ label: title });
      return trail;
    }

    if (path === '/poslednie-novosti') {
      return [HOME, { label: NEWS.label }];
    }

    if (/^\/poslednie-novosti\/[^/]+$/.test(path)) {
      return [HOME, NEWS, { label: title }];
    }

    if (path === '/stoimost-obuchenija') {
      return [HOME, { label: 'Стоимость обучения' }];
    }

    if (path === '/kontakty') {
      return [HOME, { label: 'Контакты' }];
    }

    /* Всё остальное с заголовком — «Главная / <H1>». Так новая страница
       получает крошки сразу, без правки скрипта. */
    return [HOME, { label: title }];
  }

  function buildNav(trail) {
    var nav = document.createElement('nav');
    nav.className = 'rip-crumbs';
    nav.setAttribute('aria-label', 'Хлебные крошки');

    var list = document.createElement('ol');
    list.className = 'rip-crumbs__list';

    for (var i = 0; i < trail.length; i++) {
      var item = trail[i];
      var li = document.createElement('li');
      li.className = 'rip-crumbs__item';

      if (item.href && i < trail.length - 1) {
        var a = document.createElement('a');
        a.className = 'rip-crumbs__link';
        a.href = item.href;
        a.textContent = item.label;
        li.appendChild(a);
      } else {
        var span = document.createElement('span');
        span.className = 'rip-crumbs__current';
        span.setAttribute('aria-current', 'page');
        span.textContent = item.label;
        li.appendChild(span);
      }

      list.appendChild(li);
    }

    nav.appendChild(list);
    return nav;
  }

  /* Разметка BreadcrumbList для поисковиков: та же цепочка, абсолютные адреса. */
  function addSchema(trail) {
    if (document.getElementById('rip-crumbs-schema')) return;

    var items = [];
    for (var i = 0; i < trail.length; i++) {
      var item = {
        '@type': 'ListItem',
        position: i + 1,
        name: trail[i].label
      };
      var href = trail[i].href || (location.pathname + location.search);
      item.item = location.origin + href;
      items.push(item);
    }

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'rip-crumbs-schema';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items
    });
    document.head.appendChild(script);
  }

  /* Крошки встают в поток блока перед артбордом, а их высоту забираем из
     padding-top блока: заголовок остаётся на прежнем месте. Если отступа
     меньше высоты крошек — отступ 0, блок опускается на разницу. */
  function fitPad(rec, nav) {
    rec.style.removeProperty('padding-top');
    var pad = parseFloat(window.getComputedStyle(rec).paddingTop) || 0;
    var h = nav.offsetHeight;
    if (pad > 0 && h > 0) {
      var next = Math.max(0, pad - h);
      /* !important обязателен: у Тильды отступы вида t-rec_pt-res-480_30
         объявлены с !important, и обычный инлайн их не перебивает. */
      rec.style.setProperty('padding-top', (Math.round(next * 10) / 10) + 'px', 'important');
    }
  }

  function mount() {
    var path = normalizePath();
    if (SKIP[path]) return;

    var heading = firstHeading();
    if (!heading) return;
    if (isNotFound(heading.text)) return;

    var rec = heading.el.closest ? heading.el.closest('.t-rec') : null;
    if (!rec) return;
    if (rec.classList.contains('uc-rip-header')) return;

    var trail = buildTrail(path, heading.text);
    if (trail.length < 2) return;

    var nav = buildNav(trail);
    var artboard = rec.querySelector('.t396');
    rec.insertBefore(nav, artboard || rec.firstElementChild);

    mounted = { rec: rec, nav: nav };
    fitPad(rec, nav);
    addSchema(trail);
  }

  /* Отступ пересчитываем на resize (другая высота крошек, другой padding
     блока по медиа) и после загрузки шрифта: AA Stetica меняет метрики, а
     вместе с ними — высоту строки крошек. */
  function refit() {
    if (!mounted) return;
    if (!document.documentElement.contains(mounted.rec)) return;
    fitPad(mounted.rec, mounted.nav);
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refit, 150);
  }

  function start() {
    mount();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(refit);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
