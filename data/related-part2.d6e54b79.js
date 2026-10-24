/* =====================================================================
   СОПУТСТВУЮЩИЕ ПРОГРАММЫ · один шаблон карточки + данные из /price-data
   v1.0.0

   Что делает:
     1. Берёт из Zero Block единственную карточку-шаблон
        .rip-related-card--template (она скрыта CSS).
     2. Скачивает служебную страницу /price-data, где поток 378708036811
        отрендерен одним шаблоном поста.
     3. Оставляет только программы текущего раздела и убирает текущую.
     4. Клонирует шаблон под каждую программу, заполняет название, тип,
        иконку и ссылку.

   Почему так: Tilda больше не рендерит весь поток в шаблоне программы.
   В редакторе остаётся одна карточка, на странице — только карточки
   текущего раздела.

   Зависимости:
     • head/modules/17-related-programs.css — скрывает шаблон;
     • head/modules/16-zero-block-fit.js — ведёт высоту артборда
       (селектор дополнен .rip-related__list).
   ===================================================================== */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var DATA_URL = (typeof window !== 'undefined' && window.RIP_RELATED_DATA_URL) || '/price-data';
  var LIST_SEL = '.rip-related__list';
  var CARDS_SEL = '.rip-related__cards';
  var TEMPLATE_SEL = '.rip-related-card--template';
  var INIT_ATTR = 'data-rip-related-init';

  function one(sel, root) {
    return (root || document).querySelector(sel);
  }

  function all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function text(el) {
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  /* В пустом поле Tilda оставляет заглушку «feeds:имя_поля» — вырезаем. */
  function clean(value) {
    return String(value || '')
      .replace(/feeds:\S*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pathOf(href) {
    try {
      return new URL(href, location.origin).pathname.replace(/\/+$/, '');
    } catch (e) {
      return '';
    }
  }

  /* /uslugi/c/9/<раздел>/<программа> → раздел /uslugi/c/9/<раздел>. */
  function context() {
    var path = String(
      (typeof window !== 'undefined' && window.RIP_RELATED_PATH) || location.pathname
    ).replace(/\/+$/, '');
    var seg = path.split('/').filter(Boolean);
    if (seg.length < 3) return null;
    return {
      self: path,
      section: '/' + seg.slice(0, -1).join('/')
    };
  }

  function parse(html) {
    if (!html || typeof DOMParser === 'undefined') return null;
    var doc;
    try {
      doc = new DOMParser().parseFromString(String(html), 'text/html');
    } catch (e) {
      return null;
    }
    var source = one('.rip-feed-source', doc) || one('[data-fe-role="feed"]', doc);
    if (!source) return null;

    var out = [];
    all('[data-fe-role="post"]', source).forEach(function (card) {
      var title = clean(text(one('.rip-feed__title', card)));
      if (!title) return;

      var link = one('.rip-feed__link a[href]', card) || one('a[href]', card);
      var href = link ? String(link.getAttribute('href') || '') : '';
      if (!href) {
        var linkEl = one('.rip-feed__link[href]', card);
        if (linkEl) href = String(linkEl.getAttribute('href') || '');
      }
      var path = pathOf(href);
      if (!path) return;

      var iconEl = one('.rip-feed__ico img', card);
      var icon = iconEl ? String(iconEl.getAttribute('src') || '').trim() : '';

      out.push({
        title: title,
        type: clean(text(one('.rip-feed__kind', card))),
        icon: icon,
        url: href,
        path: path
      });
    });
    return out;
  }

  function setText(el, value) {
    if (!el) return;
    var atom = one('.tn-atom', el) || el;
    atom.textContent = value;
    var wrap = el.closest('.t396__elem') || el;
    wrap.style.display = value ? '' : 'none';
    wrap.style.height = 'auto';
    atom.style.height = 'auto';
  }

  function setIcon(card, src) {
    var img = one('.rip-related-card__ico img', card);
    var group = one('.rip-related-card__ico-group', card);
    if (!img || !src) {
      if (group) group.style.display = 'none';
      return;
    }
    img.setAttribute('src', src);
    img.style.display = '';
    var wrap = img.closest('.t396__elem');
    if (wrap) {
      wrap.style.display = '';
      wrap.style.height = 'auto';
    }
    if (group) group.style.display = '';
  }

  function build(list, items) {
    var tpl = one(TEMPLATE_SEL, list);
    var cards = one(CARDS_SEL, list) || list;
    if (!tpl) return 0;

    var built = 0;
    items.forEach(function (p) {
      var card = tpl.cloneNode(true);
      card.classList.remove('rip-related-card--template');
      card.setAttribute('href', p.url);
      /* У клона не должно быть своих счётчиков и Tilda-событий. */
      card.removeAttribute('data-tilda-event-name');
      card.removeAttribute('data-animate-sbs-event');
      card.removeAttribute('data-animate-sbs-opts');
      card.removeAttribute('data-fe-role');
      card.removeAttribute('data-fe-post-link');
      card.removeAttribute('data-fe-post-field');

      setText(one('.rip-related-card__title', card), p.title);
      setText(one('.rip-related-card__type', card), p.type);
      setIcon(card, p.icon);

      cards.appendChild(card);
      built++;
    });
    return built;
  }

  function hideBlock(list) {
    var rec = list.closest('.t-rec') || list;
    rec.style.display = 'none';
  }

  function load(list, ctx) {
    if (typeof window !== 'undefined' && window.RIP_RELATED_HTML) {
      finish(list, ctx, window.RIP_RELATED_HTML);
      return;
    }
    if (typeof window !== 'undefined' && window.RIP_RELATED_FEED) {
      finish(list, ctx, null, window.RIP_RELATED_FEED);
      return;
    }

    var url = DATA_URL + (DATA_URL.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 8000;
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) {
        hideBlock(list);
        return;
      }
      finish(list, ctx, xhr.responseText);
    };
    xhr.onerror = xhr.ontimeout = function () {
      hideBlock(list);
    };
    try {
      xhr.send();
    } catch (e) {
      hideBlock(list);
    }
  }

  function finish(list, ctx, html, readyItems) {
    var items = readyItems || null;
    if (!items) {
      try {
        items = parse(html);
      } catch (e) {
        items = null;
      }
    }
    if (!items) {
      hideBlock(list);
      return;
    }

    var keep = items.filter(function (p) {
      return p.path.indexOf(ctx.section + '/') === 0 && p.path !== ctx.self;
    });
    if (!keep.length) {
      hideBlock(list);
      return;
    }

    var built = build(list, keep);
    if (!built) {
      hideBlock(list);
      return;
    }

    list.setAttribute('data-rip-related-ready', 'y');
    list.setAttribute('data-rip-related-count', String(built));
    try {
      window.dispatchEvent(new Event('resize'));
    } catch (e) { /* старые браузеры */ }
  }

  function init() {
    var ctx = context();
    all(LIST_SEL).forEach(function (list) {
      if (list.getAttribute(INIT_ATTR) === 'y') return;
      list.setAttribute(INIT_ATTR, 'y');
      if (!ctx) {
        hideBlock(list);
        return;
      }
      load(list, ctx);
    });
  }

  window.ripRelated = {
    version: VERSION,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', init);
})();
