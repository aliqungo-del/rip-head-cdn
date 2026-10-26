/* =====================================================================
   ФОРМА ЗАЯВКИ НА ОБУЧЕНИЕ · один файл на весь сайт
   v2.0.0

   ЧТО ДЕЛАЕТ
     • «Программа обучения» — поле с выпадающим списком и поиском:
       начинаешь печатать — лишние варианты отсеиваются, совпавшие буквы
       подсвечиваются, работают стрелки/Enter/Esc. Ищет по названию, по
       часам («бухгалтерский 256») и по «корню» слова.
     • «Количество часов» — список без ввода текста. Пока программа не
       выбрана, поле неактивно. После выбора программы список часов
       перестраивается под неё (и сбрасывается, если программу сменили).
     • ЗНАЧЕНИЯ пишутся в РОДНЫЕ поля формы Tilda (name="program" и
       name="hours") — заявка уходит в Tilda CRM тем же путём, что и
       обычная форма. Никаких «своих» отправок нет.
     • ПРЕДЗАПОЛНЕНИЕ: если форма открыта со страницы программы, программа
       (и часы, когда вариант один) подставляются сами. Человеку остаётся
       имя, телефон и почта. Поле при этом остаётся рабочим: нажал —
       список открылся, можно выбрать другую программу.
       В поле показываем название со страницы (его человек только что читал
       в заголовке), а в CRM уходит название из списка — оно в подсказке
       (title) поля.
     • ССЫЛКИ: программу можно передать явно — ?program=<uid>#rip-form
       или ?program=<название>#rip-form. Параметр сильнее страницы, а
       кнопка на странице программы и так открывает нужную программу.

   КАК ПОДКЛЮЧАЕТСЯ
     Одна строка на весь сайт — в «HTML-код перед </body>» или в T123
     (см. crm-form-programs.html). Стили формы (часть 1) живут в head и
     едут отдельно: head/modules/08-crm-form-programs.css.

   ЧТО НАСТРОИТЬ В TILDA (один раз)
     1) На странице формы должны быть поля с «Имя переменной»:
        program (однострочное) и hours (выпадающий список).
     2) Настройки блока формы → «Класс» → ripf-form.
     3) Поля program и hours лучше сделать НЕобязательными: проверку
        заполнения делает скрипт, родные поля он прячет и заполняет сам.
     4) В поле hours оставить один вариант-заглушку («—»).
     5) Tilda CRM: лист подключить к сайту; в карточке заявки будут
        поля program и hours.

   ОТКУДА БЕРЁТСЯ ПРОГРАММА СТРАНИЦЫ
     Страницы программ — это посты ленты, они рендерятся одним шаблоном,
     поэтому в разметке уже есть:
       • <body data-tilda-post-uid="…"> — постоянный id поста (главный ключ);
       • [data-fe-post-field="title"] — название;
       • [data-fe-post-field="rip-programm-hours"] (и …hours2) — часы.
     Сопоставление uid → название живёт в PROGRAMS (поля uid/path). Если
     uid в списке нет — подставляется название со страницы, а часы берутся
     с неё же (часов может быть два: тогда человек выбирает сам).

   ПРОВЕРКА БЕЗ ПУБЛИКАЦИИ
     crm-form-programs-demo.html — та же форма, живая панель оформления,
     панель «что уйдёт в CRM» и режим страницы программы (?uid=…).
     crm-form-programs-check.js — диагностика на живой странице (консоль).
   ===================================================================== */

(function () {
  'use strict';

  var VERSION = '2.0.0';

  /* ========================= 1. НАСТРОЙКИ ========================= */
  var CFG = {
    form: '.ripf-form, .uc-rip-form',   /* CSS-класс, который вы задали БЛОКУ формы
                                           (настройки блока → «Класс» → ripf-form
                                           или uc-rip-form — на сайте сейчас второй).
                                           Скрипт сам найдёт <form> внутри блока;
                                           можно и по номеру: '#rec1234567890' */
    programField: 'program',            /* «Имя переменной» поля «Программа обучения» */
    hoursField: 'hours',                /* «Имя переменной» поля «Количество часов» */

    programPlaceholder: 'Начните вводить название программы',
    hoursPlaceholder: 'Выберите количество часов',
    hoursWaiting: 'Сначала выберите программу обучения',
    emptyText: 'Ничего не найдено',
    hoursSuffix: ' ч',                  /* приписка в подсказке: «16, 24, 40 ч» */

    showHoursInList: true,              /* показывать часы прямо в списке программ */
    autoSelectSingle: true,             /* если у программы всего одни часы — подставить сразу */
    openOnFocus: true,                  /* открывать список при входе в пустое поле */
    hideNative: true,                   /* прятать родные поля Tilda (значения уходят всё равно) */
    matchFont: true,                    /* шрифт и размер — как у полей самой формы Tilda */
    fontFamily: '',                     /* принудительный шрифт, напр. 'Tilda Sans'; пусто = как в форме */
    log: true,                          /* диагностика в консоль браузера */

    /* ── предзаполнение со страницы программы ────────────────────── */
    prefill: true,                      /* false — выключить: поле всегда пустое */
    paramName: 'program',               /* ?program=<uid|путь|название> — сильнее страницы */
    pageUidAttr: 'data-tilda-post-uid', /* id поста ленты на странице программы */
    pageTitleSel: '[data-fe-post-field="title"]',
    pageHoursSel: '[data-fe-post-field="rip-programm-hours"]',
    pageHours2Sel: '[data-fe-post-field="rip-programm-hours2"]',
    pagePathStart: '/uslugi/c/',        /* только эти адреса считаем страницами программ */
    usePageTitleFallback: true          /* uid не в списке → подставить название со страницы */
  };

  /* ============== 2. ПРОГРАММЫ И КОЛИЧЕСТВО ЧАСОВ ==============
     Единственное место с данными. Формат:

       { name: 'Название как в CRM', hours: ['16', '24', '40'] }

     Если подпись должна отличаться от значения, пишите объектом:

       hours: [{ value: '256', label: '256 часов' }]

     Необязательные поля (только для предзаполнения со страницы):
       uid  — id поста ленты (body[data-tilda-post-uid]);
       path — адрес страницы программы (запас, если uid не проставили).

     Новая программа со страницей = строка с uid. Программу без страницы
     можно оставить без uid: она просто не будет подставляться сама.      */
  var PROGRAMS = [
    /* ── Безопасность дорожного движения ───────────────────────────────── */
    {
      name: 'Профессиональная переподготовка специалистов, ответственных за обеспечение безопасности дорожного движения (Приказ Минтранса № 282)',
      hours: ['256'],
      uid: 'udoin8x8u1',
      path: '/uslugi/c/9/avtodorozhnoe-napravlenie-perevozka-opasnyx-gruzov/specialist'
    },
    { name: 'Профессиональная переподготовка диспетчеров автомобильного и городского электрического транспорта', hours: ['256'] },
    {
      name: 'Профессиональная переподготовка контролеров технического состояния транспортных средств',
      hours: ['256'],
      uid: '6xbyzod2n1',
      path: '/uslugi/c/9/avtodorozhnoe-napravlenie-perevozka-opasnyx-gruzov/kontroler'
    },
    { name: 'Повышение квалификации «Контролер технического состояния транспортных средств»', hours: ['72'] },
    { name: 'Подготовка специалистов по безопасности движения', hours: ['48'] },
    { name: 'Профессиональная переподготовка «Эксперт по техническому контролю и диагностике автомототранспортных средств»', hours: ['256'] },
    { name: 'Повышение квалификации «Техническое диагностирование и контроль технического состояния автотранспортных средств при периодическом техническом осмотре»', hours: ['72'] },

    /* ── Водительский состав ───────────────────────────────────────────── */
    { name: 'Ежегодные занятия с водителями автотранспортных предприятий', hours: ['20'] },
    {
      name: 'Обучение водителей-наставников',
      hours: ['32'],
      uid: 'ijf598j3c1',
      path: '/uslugi/c/9/avtodorozhnoe-napravlenie-perevozka-opasnyx-gruzov/podgotovka-voditelei-nastavnikov'
    },

    /* ── Логистика ─────────────────────────────────────────────────────── */
    { name: 'Профессиональная переподготовка «Специалист по логистике»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Складская логистика»', hours: ['256'] },

    /* ── Перевозка опасных грузов (ДОПОГ) ──────────────────────────────── */
    {
      name: 'Подготовка водителей, осуществляющих перевозки опасных грузов (ДОПОГ)',
      hours: ['52'],
      uid: 'td0pe69dt1',
      path: '/uslugi/c/9/avtodorozhnoe-napravlenie-perevozka-opasnyx-gruzov/td0pe69dt1-professionalnoe-obuchenie-voditel-osusch'
    },
    { name: 'Подготовка сопровождающих перевозку опасных грузов', hours: ['24'] },
    { name: 'Повышение квалификации консультантов по безопасности перевозки опасных грузов (международные перевозки)', hours: ['78'] },
    { name: 'Профессиональная переподготовка консультантов по безопасности перевозки опасных грузов (международные перевозки)', hours: ['268'] },

    /* ── Охрана труда, пожарная безопасность, первая помощь ────────────── */
    { name: 'Профессиональная переподготовка «Техносферная безопасность» (специалист по охране труда)', hours: ['256'] },
    { name: 'Обучение по общим вопросам охраны труда и функционирования системы управления охраной труда', hours: ['16'] },
    { name: 'Профессиональная переподготовка «Специалист по пожарной профилактике»', hours: ['256', '512'] },
    { name: 'Повышение квалификации «Специалист по пожарной профилактике»', hours: ['72'] },
    { name: 'Повышение квалификации руководителей организаций, ответственных за обеспечение пожарной безопасности', hours: ['16'] },
    { name: 'Оказание первой помощи пострадавшим', hours: ['16'] },

    /* ── Управление персоналом и кадровое делопроизводство ─────────────── */
    { name: 'Профессиональная переподготовка «Управление персоналом»', hours: ['256'] },
    { name: 'Профессиональная переподготовка специалистов по кадровому делу и профориентации', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Делопроизводитель»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Специалист по подбору персонала (рекрутер)»', hours: ['256'] },

    /* ── Менеджмент ────────────────────────────────────────────────────── */
    { name: 'Профессиональная переподготовка «Менеджмент в образовании»', hours: ['256', '512'] },
    { name: 'Профессиональная переподготовка «Менеджмент в здравоохранении»', hours: ['256', '512'] },
    { name: 'Профессиональная переподготовка «HR-менеджмент»', hours: ['256'] },

    /* ── Гражданская оборона, ЧС, антитеррор ───────────────────────────── */
    { name: 'Обучение уполномоченных по ГО и ЧС (для некатегорированных предприятий)', hours: ['72'] },
    { name: 'Повышение квалификации «Профилактика и предупреждение терроризма и национального экстремизма»', hours: ['72'] },
    { name: 'Повышение квалификации «Антитеррористическая защищённость объектов (территорий) образовательной организации»', hours: ['72'] },
    { name: 'Профессиональная переподготовка «Антитеррористическая защищённость гостиниц и иных средств размещения»', hours: ['260'] },
    { name: 'Повышение квалификации «Антитеррористическая защищённость гостиниц и иных средств размещения»', hours: ['72'] },
    { name: 'Повышение квалификации «Основы профилактики коррупции»', hours: ['18'] },
    { name: 'Повышение квалификации «Безопасный город»', hours: ['76'] },

    /* ── Преподаватели и методисты ─────────────────────────────────────── */
    { name: 'Профессиональная переподготовка преподавателей по обучению специалистов, ответственных за обеспечение БДД', hours: ['256'] },
    { name: 'Повышение квалификации преподавателей по обучению специалистов, ответственных за обеспечение БДД', hours: ['72'] },
    { name: 'Профессиональная переподготовка преподавателей автошкол', hours: ['256'] },
    { name: 'Повышение квалификации преподавателей автошкол', hours: ['72'] },
    { name: 'Профессиональная переподготовка инструкторов по обучению вождению (МПОВ)', hours: ['256'] },
    { name: 'Повышение квалификации инструкторов по обучению вождению (МПОВ)', hours: ['72'] },
    { name: 'Профессиональная переподготовка преподавателей по охране труда', hours: ['256'] },
    { name: 'Повышение квалификации преподавателей по охране труда', hours: ['72'] },
    { name: 'Профессиональная переподготовка преподавателей по пожарной безопасности', hours: ['256'] },
    { name: 'Повышение квалификации преподавателей по пожарной безопасности', hours: ['72'] },
    { name: 'Профессиональная переподготовка «Педагог профессионального обучения, профессионального образования и ДПО»', hours: ['256'] },
    { name: 'Повышение квалификации «Педагог профессионального обучения, профессионального образования и ДПО»', hours: ['72'] },
    { name: 'Профессиональная переподготовка «Социальный педагог»', hours: ['256', '560'] },
    { name: 'Профессиональная переподготовка «Педагог-психолог»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Инструктор (преподаватель) по оказанию первой помощи»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Методист дополнительного профессионального образования»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Тьюторское сопровождение в образовательных организациях»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Педагог профессионального обучения»', hours: ['256'] },

    /* ── Экологическая безопасность и обращение с отходами ─────────────── */
    { name: 'Обеспечение экологической безопасности руководителями и специалистами общехозяйственных систем управления', hours: ['72'] },
    { name: 'Сбор, транспортирование, обработка, утилизация, обезвреживание, размещение отходов I–IV классов опасности', hours: ['112'] },
    { name: 'Профессиональная подготовка лиц на право работы с опасными отходами', hours: ['112'] },
    { name: 'Обеспечение экологической безопасности руководителями и специалистами экологических служб и систем экологического контроля', hours: ['200'] },
    { name: 'Профессиональная переподготовка «Экология и экономика природопользования»', hours: ['500'] },
    { name: 'Профессиональная переподготовка «Специалист в области обращения с отходами»', hours: ['516'] },
    { name: 'Повышение квалификации «Специалист в области обращения с отходами»', hours: ['78'] },
    { name: 'Повышение квалификации «Обращение с медицинскими отходами»', hours: ['76'] },
    { name: 'Профессиональная переподготовка «Обращение с твердыми коммунальными (бытовыми) отходами»', hours: ['256'] },
    { name: 'Повышение квалификации «Обращение с твердыми коммунальными (бытовыми) отходами»', hours: ['78'] },

    /* ── Управление ────────────────────────────────────────────────────── */
    { name: 'Профессиональная переподготовка «Государственное и муниципальное управление»', hours: ['512'] },
    { name: 'Профессиональная переподготовка «Государственное и муниципальное управление в сфере образования»', hours: ['260'] },
    { name: 'Профессиональная переподготовка «Управление качеством: теория и практика»', hours: ['256'] },

    /* ── Туризм, гостиничное и ресторанное дело ────────────────────────── */
    { name: 'Профессиональная переподготовка «Управление в сфере гостиничного дела»', hours: ['320'] },
    { name: 'Профессиональная переподготовка «Экскурсовод (гид)»', hours: ['260'] },
    { name: 'Повышение квалификации «Инновационные процессы в деятельности экскурсовода (гида)»', hours: ['76'] },
    { name: 'Профессиональная переподготовка «Администратор гостиничного сервиса»', hours: ['260'] },
    { name: 'Профессиональная переподготовка «Управление ресторанным бизнесом»', hours: ['400'] },

    /* ── Газоснабжение, лифтовое хозяйство ─────────────────────────────── */
    { name: 'Профессиональная переподготовка «Монтаж и эксплуатация оборудования и систем газоснабжения» (квалификация «Техник»)', hours: ['514'] },
    { name: 'Повышение квалификации «Монтаж и эксплуатация оборудования и систем газоснабжения»', hours: ['76'] },
    { name: 'Профессиональная переподготовка «Эксплуатация газового оборудования жилых и общественных зданий»', hours: ['520'] },
    { name: 'Повышение квалификации «Эксплуатация газового оборудования жилых и общественных зданий»', hours: ['77'] },
    { name: 'Профессиональная переподготовка «Специалист по эксплуатации лифтового оборудования»', hours: ['256'] },
    { name: 'Повышение квалификации «Специалист по эксплуатации лифтового оборудования»', hours: ['74'] },

    /* ── Социальная работа, ЖКХ ────────────────────────────────────────── */
    { name: 'Профессиональная переподготовка «Социальный работник»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Управление многоквартирными домами»', hours: ['518'] },
    { name: 'Повышение квалификации «Управление многоквартирными домами»', hours: ['76'] },

    /* ── Культура, библиотечное дело, спорт ────────────────────────────── */
    { name: 'Профессиональная переподготовка «Художественный руководитель»', hours: ['256', '512'] },
    { name: 'Профессиональная переподготовка «Художественный руководитель сельского дома культуры»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Менеджер по культурно-массовому досугу»', hours: ['260'] },
    { name: 'Профессиональная переподготовка «Специалист библиотечно-информационной деятельности»', hours: ['520'] },
    { name: 'Повышение квалификации «Специалист библиотечно-информационной деятельности»', hours: ['78'] },
    { name: 'Профессиональная переподготовка «Тренер по адаптивной физкультуре»', hours: ['256'] },

    /* ── Юриспруденция, психология, кинология, агрономия, товароведение ── */
    { name: 'Профессиональная переподготовка «Юриспруденция»', hours: ['520', '260'] },
    { name: 'Повышение квалификации «Юриспруденция»', hours: ['120'] },
    { name: 'Профессиональная переподготовка «Юрист по авторскому праву»', hours: ['260'] },
    { name: 'Профессиональная переподготовка «Специалист по операциям с недвижимостью (риелтор)»', hours: ['260'] },
    { name: 'Профессиональная переподготовка «Психология управления»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Служебная кинология»', hours: ['256'] },
    { name: 'Профессиональная переподготовка «Агрономия»', hours: ['320'] },
    { name: 'Профессиональная переподготовка «Агрохимия и агропочвоведение»', hours: ['260'] },
    { name: 'Профессиональная переподготовка «Экспертиза и оценка качества сельскохозяйственной продукции»', hours: ['280'] },
    { name: 'Профессиональная переподготовка «Товароведение»', hours: ['256'] }
  ];

  /* ========================== 3. УТИЛИТЫ ========================== */
  function log() {
    if (!CFG.log || !window.console || !console.log) return;
    console.log.apply(console, ['[ripf]'].concat(Array.prototype.slice.call(arguments)));
  }

  /* экранирование для вставки в HTML */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* «нормализация» строки для поиска: регистр, ё→е, любые разделители → пробел */
  function fold(s) {
    return String(s).toLowerCase().replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* совпало ли слово запроса с названием: точное вхождение или общий «корень»
     (первые 4 буквы) — чтобы «первая помощь» находила «первой помощи» */
  function tokenHit(hay, tok) {
    if (hay.indexOf(tok) !== -1) return true;
    if (tok.length < 4) return false;
    var stem = tok.slice(0, 4);
    var words = hay.split(' ');
    for (var i = 0; i < words.length; i++) {
      if (words[i].length >= 4 && words[i].slice(0, 4) === stem) return true;
    }
    return false;
  }

  /* поиск ближайшего родителя по селектору (без зависимости от Element.closest) */
  function up(el, sel) {
    while (el && el.nodeType === 1) {
      var m = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
      if (m && m.call(el, sel)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function addCls(el, cls) {
    if (!el) return;
    if (el.classList) el.classList.add(cls);
    else if ((' ' + el.className + ' ').indexOf(' ' + cls + ' ') < 0) el.className += ' ' + cls;
  }

  /* подсветка совпавших слов в названии программы */
  function markText(name, query) {
    var words = String(query || '').trim().split(/\s+/).filter(function (w) { return !!w; });
    if (!words.length) return esc(name);
    var rx = function (w) {
      return escRe(w).replace(/[еЕ]/g, function (c) { return c === 'е' ? '[её]' : '[ЕЁ]'; });
    };
    var pats = [];
    for (var w = 0; w < words.length; w++) {
      pats.push(rx(words[w]));
      if (words[w].length >= 4) pats.push(rx(words[w].slice(0, 4)));   /* тот же «корень» */
    }
    var pat = pats.join('|');
    var parts = String(name).split(new RegExp('(' + pat + ')', 'gi'));
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      out += (i % 2) ? '<mark>' + esc(parts[i]) + '</mark>' : esc(parts[i]);
    }
    return out;
  }

  /* часы: массив строк или объектов → [{value, label}] */
  function normHours(list) {
    var out = [];
    for (var i = 0; i < (list || []).length; i++) {
      var x = list[i];
      if (x && typeof x === 'object') out.push({ value: String(x.value), label: String(x.label || x.value) });
      else out.push({ value: String(x), label: String(x) });
    }
    return out;
  }

  function fire(el, type) {
    var e;
    try { e = new Event(type, { bubbles: true }); }
    catch (err) { e = document.createEvent('Event'); e.initEvent(type, true, true); }
    el.dispatchEvent(e);
  }

  /* запись значения в РОДНОЕ поле формы Tilda (+ уведомление для её скриптов) */
  function setNative(el, value) {
    if (el.value === value) return;
    if (el.tagName === 'SELECT') {
      var found = false;
      for (var i = 0; i < el.options.length; i++) {
        if (el.options[i].value === value) { found = true; break; }
      }
      if (!found) {
        var o = document.createElement('option');
        o.value = value;
        o.text = value;
        el.appendChild(o);
      }
    }
    el.value = value;
    fire(el, 'input');
    fire(el, 'change');
  }

  /* снять с поля «красное» состояние Tilda, если пользователь всё исправил */
  function clearError(native) {
    var nodes = [native, up(native, '.t-input-block'), up(native, '.t-input-group')];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n || !n.classList) continue;
      var cls = [];
      for (var j = 0; j < n.classList.length; j++) cls.push(n.classList[j]);
      for (var k = 0; k < cls.length; k++) if (/error/i.test(cls[k])) n.classList.remove(cls[k]);
    }
    var group = up(native, '.t-input-group');
    if (!group) return;
    var errs = group.querySelectorAll('[class*="error"]');
    for (var m = 0; m < errs.length; m++) {
      if (up(errs[m], '.ripf')) continue;         /* наши элементы не трогаем */
      errs[m].style.display = 'none';             /* Tilda покажет снова, если поле правда пустое */
    }
  }

  /* ================== 3a. КОНТЕКСТ СТРАНИЦЫ ==================
     Откуда берётся программа для предзаполнения:
       1) ?program=<uid | путь | название> — явная ссылка, сильнее всего;
       2) страница программы: body[data-tilda-post-uid] → строка в списке;
       3) та же страница, но uid не проставлен → совпадение по пути;
       4) ничего не совпало → название и часы прямо со страницы.
     Возвращает null, если это не страница программы и параметра нет.       */

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* Путь из адреса: принимает и «/uslugi/c/…», и полный URL.
     Абсолютный URL разбираем, а готовый путь оставляем как есть: при базе
     file:// new URL('/x') дал бы '/C:/x' и путь перестал бы совпадать. */
  function normPath(p) {
    var s = String(p == null ? '' : p);
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      try { s = new URL(s).pathname; } catch (e) { /* оставляем как есть */ }
    }
    var cut = s.search(/[?#]/);
    if (cut !== -1) s = s.slice(0, cut);
    return s.replace(/\/+$/, '');
  }

  /* текст служебного поля поста; заглушку «feeds:имя» вырезаем */
  function fieldText(sel) {
    var el = document.querySelector(sel);
    if (!el) return '';
    return norm(String(el.textContent || '').replace(/feeds:\S*/gi, ' '));
  }

  /* часы со страницы: основное поле и второе (у программ с двумя сроками) */
  function pageHours() {
    var out = [];
    [CFG.pageHoursSel, CFG.pageHours2Sel].forEach(function (sel) {
      var m = fieldText(sel).match(/\d+/);      /* «256 ч» → 256, «256 / 512» → 256 */
      if (!m) return;
      var v = String(parseInt(m[0], 10));
      if (v !== 'NaN' && out.indexOf(v) === -1) out.push(v);
    });
    return out;
  }

  function pagePath() {
    /* RIPF_PAGE_PATH — только для демо и тестов: подменить адрес страницы */
    var forced = typeof window.RIPF_PAGE_PATH === 'string' ? window.RIPF_PAGE_PATH : '';
    return normPath(forced || location.pathname);
  }

  function pageUid() {
    if (typeof window.RIPF_PAGE_UID === 'string' && window.RIPF_PAGE_UID) {
      return norm(window.RIPF_PAGE_UID);
    }
    /* Тильда вешает id поста на #allrecords, но на всякий случай смотрим
       и <body>, и любой элемент с этим атрибутом */
    var v = '';
    if (document.body) v = norm(document.body.getAttribute(CFG.pageUidAttr));
    if (!v) {
      var host = document.getElementById('allrecords');
      if (host) v = norm(host.getAttribute(CFG.pageUidAttr));
    }
    if (!v) {
      var any = document.querySelector('[' + CFG.pageUidAttr + ']');
      if (any) v = norm(any.getAttribute(CFG.pageUidAttr));
    }
    return v;
  }

  /* адрес страницы программы: /uslugi/c/<категория>/<раздел>/<программа>
     Категория (/uslugi/c/<категория>/<раздел>, 4 сегмента) страницей
     программы не считается — иначе в форму уехало бы название направления. */
  function isProgramPage(path) {
    var p = path || pagePath();
    if (p.indexOf(CFG.pagePathStart) !== 0) return false;
    return p.split('/').filter(Boolean).length >= 5;
  }

  function paramValue() {
    var name = CFG.paramName;
    if (!name || !window.location || !location.search) return '';
    var pairs = String(location.search).replace(/^\?/, '').split('&');
    for (var i = 0; i < pairs.length; i++) {
      var eq = pairs[i].indexOf('=');
      var rawKey = eq === -1 ? pairs[i] : pairs[i].slice(0, eq);
      var key = rawKey;
      try { key = decodeURIComponent(rawKey.replace(/\+/g, ' ')); } catch (e) { /* как есть */ }
      if (key !== name) continue;
      var val = eq === -1 ? '' : pairs[i].slice(eq + 1);
      try { val = decodeURIComponent(val.replace(/\+/g, ' ')); } catch (e) { /* как есть */ }
      return norm(val);
    }
    return '';
  }

  /* ── поиск строки списка ─────────────────────────────────────── */
  function itemByUid(items, uid) {
    if (!uid) return null;
    for (var i = 0; i < items.length; i++) if (items[i].uid && items[i].uid === uid) return items[i];
    return null;
  }

  function itemByPath(items, path) {
    var p = normPath(path);
    if (!p) return null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].path && normPath(items[i].path) === p) return items[i];
    }
    return null;
  }

  function itemByName(items, name) {
    var n = norm(name);
    if (!n) return null;
    var i;
    for (i = 0; i < items.length; i++) if (norm(items[i].value) === n) return items[i];
    var folded = fold(n);
    for (i = 0; i < items.length; i++) if (fold(items[i].value) === folded) return items[i];
    return null;
  }

  /* название программы так, как его видит человек на странице */
  function pageTitle() {
    var t = fieldText(CFG.pageTitleSel);
    if (t) return t;
    var h1 = document.querySelector('h1');
    return h1 ? norm(h1.textContent) : '';
  }

  /* Собирает задание на предзаполнение:
     { name, display, hours[], uid, path, source, matched }
     name    — что уходит в CRM;
     display — что показываем в поле (название со страницы: оно короче и
               человек только что видел его в заголовке). */
  function resolveContext(items) {
    var list = items || buildItems();
    var uid = pageUid();
    var path = pagePath();
    var onPage = isProgramPage(path);

    var param = paramValue();
    if (param) {
      var byParam = itemByUid(list, param) || itemByPath(list, param) || itemByName(list, param);
      if (byParam) {
        return {
          name: byParam.value, display: onPage ? pageTitle() : '',
          hours: pageHoursFor(byParam), uid: byParam.uid || '',
          path: byParam.path || '', source: 'url', matched: true
        };
      }
      return {
        name: param, display: '', hours: onPage ? pageHours() : [],
        uid: '', path: '', source: 'url', matched: false
      };
    }

    if (!onPage) return null;

    var entry = itemByUid(list, uid) || itemByPath(list, path);
    if (entry) {
      return {
        name: entry.value, display: pageTitle(), hours: pageHoursFor(entry),
        uid: entry.uid || uid, path: entry.path || path,
        source: uid && entry.uid === uid ? 'page-uid' : 'page-path', matched: true
      };
    }

    if (!CFG.usePageTitleFallback) return null;
    var title = pageTitle();
    if (!title) return null;
    return {
      name: title, display: '', hours: pageHours(), uid: uid, path: path,
      source: 'page-title', matched: false
    };
  }

  /* часы для найденной строки: страница важнее списка (на странице — что продаём) */
  function pageHoursFor(entry) {
    var fromPage = pageHours();
    if (fromPage.length) return fromPage;
    return entry && entry.hours ? entry.hours.map(function (h) { return String(h.value); }) : [];
  }

  /* ====================== 4. ВЫПАДАЮЩИЙ БЛОК ======================
     Один и тот же компонент для обоих полей.
     searchable: true  — с вводом текста и фильтрацией (программа);
     searchable: false — только выбор из списка (часы).              */
  function Control(opt) {
    var self = this;
    this.opt = opt || {};
    this.searchable = this.opt.searchable !== false;
    this.items = [];
    this.filtered = [];
    this.active = -1;
    this.value = '';
    this.label = '';
    this.disabled = false;
    this.onPick = null;

    var root = document.createElement('div');
    root.className = 'ripf';
    root.innerHTML =
      '<div class="ripf__box">' +
        '<input class="ripf__input" type="text" autocomplete="off" spellcheck="false" ' +
               'role="combobox" aria-expanded="false" aria-autocomplete="list">' +
        '<span class="ripf__arrow" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="ripf__list" role="listbox"></div>';

    this.el = root;
    this.box = root.querySelector('.ripf__box');
    this.input = root.querySelector('.ripf__input');
    this.list = root.querySelector('.ripf__list');
    this.input.placeholder = this.opt.placeholder || '';

    if (!this.searchable) {
      this.input.readOnly = true;
      this.input.setAttribute('inputmode', 'none');
      this.input.setAttribute('aria-readonly', 'true');
    }

    this.box.addEventListener('mousedown', function (e) { e.preventDefault(); });

    this.input.addEventListener('focus', function () {
      if (self.disabled) return;
      if (self.searchable && self.input.value) self.input.select();
      if (CFG.openOnFocus || !self.searchable) self.open();
    });

    this.input.addEventListener('input', function () {
      if (!self.searchable || self.disabled) return;
      self.active = -1;
      self.render(true);
      self.open();
    });

    this.input.addEventListener('keydown', function (e) { self.keydown(e); });

    this.box.addEventListener('click', function () {
      if (self.disabled) return;
      if (self.searchable) { self.input.focus(); self.open(); }
      else { if (self.isOpen()) self.close(); else { self.input.focus(); self.open(); } }
    });

    this.list.addEventListener('mousedown', function (e) {
      var node = up(e.target, '.ripf__opt');
      if (!node) return;
      e.preventDefault();
      self.pick(self.filtered[parseInt(node.getAttribute('data-i'), 10)]);
    });

    this._outside = function (e) { if (!root.contains(e.target)) self.close(); };
    document.addEventListener('click', this._outside, false);

    this.render(true);
  }

  Control.prototype.isOpen = function () { return this.el.classList.contains('ripf_open'); };

  Control.prototype.open = function () {
    if (this.disabled || this.isOpen()) return;
    if (this.value && this.input.value === this.label) this.input.value = '';  /* показать весь список */
    this.active = -1;
    this.render(true);
    addCls(this.el, 'ripf_open');
    this.input.setAttribute('aria-expanded', 'true');
  };

  Control.prototype.close = function () {
    if (!this.isOpen()) return;
    this.el.classList.remove('ripf_open');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.value = this.value ? this.label : '';   /* текст без выбора не сохраняем */
  };

  Control.prototype.setItems = function (items) {
    this.items = items || [];
    this.active = -1;
    this.render(true);
  };

  Control.prototype.setPlaceholder = function (t) { this.input.placeholder = t || ''; };

  Control.prototype.setDisabled = function (b) {
    this.disabled = !!b;
    if (this.disabled) {
      this.close();
      this.value = '';
      this.label = '';
      this.input.value = '';
      addCls(this.el, 'ripf_disabled');
    } else {
      this.el.classList.remove('ripf_disabled');
    }
  };

  Control.prototype.setError = function (b) {
    if (b) addCls(this.el, 'ripf_error');
    else this.el.classList.remove('ripf_error');
  };

  Control.prototype.setValue = function (value, keepRaw) {
    this.value = '';
    this.label = '';
    for (var i = 0; i < this.items.length; i++) {
      if (String(this.items[i].value) === String(value)) {
        this.value = String(value);
        this.label = this.items[i].label;
        break;
      }
    }
    if (!this.value && keepRaw) { this.value = String(value); this.label = String(value); }
    this.input.value = this.label;
    return !!this.value;
  };

  Control.prototype.pick = function (item) {
    if (!item) return;
    this.value = String(item.value);
    this.label = item.label;
    this.input.value = item.label;
    this.close();
    if (typeof this.onPick === 'function') this.onPick(item);
  };

  Control.prototype.pickByValue = function (value) {
    for (var i = 0; i < this.items.length; i++) {
      if (String(this.items[i].value) === String(value)) { this.pick(this.items[i]); return true; }
    }
    return false;
  };

  Control.prototype.move = function (step) {
    if (!this.filtered.length) return;
    var n = this.filtered.length;
    this.active = (this.active + step + n) % n;
    this.render(false);
    var node = this.list.querySelector('.ripf__opt_active');
    if (node && node.scrollIntoView) {
      try { node.scrollIntoView({ block: 'nearest' }); } catch (err) { node.scrollIntoView(false); }
    }
  };

  Control.prototype.keydown = function (e) {
    if (this.disabled) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'Down') {
      e.preventDefault();
      if (this.isOpen()) this.move(1); else this.open();
      return;
    }
    if (k === 'ArrowUp' || k === 'Up') {
      e.preventDefault();
      if (this.isOpen()) this.move(-1); else this.open();
      return;
    }
    if (k === 'Enter') {
      if (this.isOpen() && this.active >= 0) { e.preventDefault(); this.pick(this.filtered[this.active]); }
      else this.close();
      return;
    }
    if (k === 'Escape' || k === 'Esc') {
      if (this.isOpen()) { e.preventDefault(); this.close(); }
      return;
    }
    if (k === 'Tab') this.close();
  };

  Control.prototype.render = function (resetScroll) {
    var query = this.searchable ? this.input.value : '';
    var toks = fold(query).split(' ').filter(function (t) { return !!t; });
    var out = [];
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      if (toks.length) {
        var hay = fold(it.label + ' ' + (it.hint || ''));   /* ищем и по часам тоже */
        var ok = true;
        for (var t = 0; t < toks.length; t++) {
          if (!tokenHit(hay, toks[t])) { ok = false; break; }
        }
        if (!ok) continue;
      }
      out.push(it);
    }
    this.filtered = out;

    if (!out.length) {
      this.list.innerHTML = '<div class="ripf__empty">' + esc(CFG.emptyText) + '</div>';
      return;
    }
    var html = '';
    for (var j = 0; j < out.length; j++) {
      html += '<div class="ripf__opt' + (j === this.active ? ' ripf__opt_active' : '') +
              '" role="option" data-i="' + j + '">' +
                '<span class="ripf__name">' + markText(out[j].label, query) + '</span>' +
                (out[j].hint ? '<span class="ripf__hours">' + esc(out[j].hint) + '</span>' : '') +
              '</div>';
    }
    this.list.innerHTML = html;
    if (resetScroll) this.list.scrollTop = 0;
  };

  /* ==================== 5. МОНТАЖ В ФОРМУ TILDA ==================== */

  /* Шрифт кастомных полей берём у РОДНОГО поля Tilda — тогда «Программа» и «Часы»
     выглядят тем же шрифтом и размером, что и остальные поля формы (Tilda Sans,
     AA Stetica, любой другой). Принудительно — CFG.fontFamily. */
  function syncFont(native, ctl) {
    if (!CFG.matchFont || !window.getComputedStyle) return;
    var cs = window.getComputedStyle(native);
    if (!cs) return;
    ctl.el.style.fontFamily = CFG.fontFamily ? CFG.fontFamily : cs.fontFamily;
    ctl.el.style.fontWeight = cs.fontWeight;
    ctl.el.style.fontSize = cs.fontSize;
  }

  function mount(native, controlEl) {
    var block = up(native, '.t-input-block');
    var host = block || native.parentNode;
    if (!host) return;
    if (CFG.hideNative) {
      if (block) {
        for (var i = 0; i < block.children.length; i++) {
          var ch = block.children[i];
          if (ch === controlEl) continue;
          if (/error/i.test(ch.className || '')) continue;
          addCls(ch, 'ripf-native');
        }
      } else {
        addCls(native, 'ripf-native');
      }
    }
    host.appendChild(controlEl);
  }

  /* Tilda подсвечивает ошибку у родного поля — переносим подсветку на наше */
  function mirrorError(native, ctl) {
    if (!window.MutationObserver) return;
    var block = up(native, '.t-input-block');
    var group = up(native, '.t-input-group');
    var nodes = [native, block, group];
    var check = function () {
      var bad = false;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n && typeof n.className === 'string' && /error/i.test(n.className)) bad = true;
      }
      ctl.setError(bad);
    };
    var obs = new MutationObserver(check);
    obs.observe(native, { attributes: true, attributeFilter: ['class'] });
    if (block && block !== native) obs.observe(block, { attributes: true, attributeFilter: ['class'] });
    if (group && group !== native) obs.observe(group, { attributes: true, attributeFilter: ['class'] });
    check();
  }

  /* строки выпадающего списка: из PROGRAMS, с часами и ключами страницы */
  function buildItems() {
    var items = [];
    for (var i = 0; i < PROGRAMS.length; i++) {
      var p = PROGRAMS[i];
      var hs = normHours(p.hours);
      var hint = '';
      if (CFG.showHoursInList && hs.length) {
        hint = hs.map(function (h) { return h.label; }).join(', ') + CFG.hoursSuffix;
      }
      items.push({
        value: p.name, label: p.name, hint: hint, hours: hs,
        uid: p.uid || '', path: p.path || ''
      });
    }
    return items;
  }

  function initForm(form) {
    var nProg = form.querySelector('[name="' + CFG.programField + '"]');
    var nHours = form.querySelector('[name="' + CFG.hoursField + '"]');

    if (!nProg || !nHours) {
      if ((nProg || nHours) && !form.__ripfWarned) {
        form.__ripfWarned = 1;
        log('в форме найдено только одно из двух полей. Ожидаются name="' +
            CFG.programField + '" и name="' + CFG.hoursField + '"');
      }
      return false;
    }
    if (nProg.getAttribute('data-ripf') === '1') return true;
    nProg.setAttribute('data-ripf', '1');
    nHours.setAttribute('data-ripf', '1');

    var items = buildItems();

    var prog = new Control({ searchable: true, placeholder: CFG.programPlaceholder });
    var hours = new Control({ searchable: false, placeholder: CFG.hoursWaiting });
    prog.setItems(items);
    /* метка версии: по ней видно, чей это контрол (см. resetForeign) */
    prog.el.setAttribute('data-ripf-version', VERSION);
    hours.el.setAttribute('data-ripf-version', VERSION);

    /* пересобрать список часов под выбранную программу.
       override — часы со страницы программы: они важнее списка, потому
       что показывают, что продаётся именно на этой странице. */
    function applyHours(item, keep, override) {
      var list = (override && override.length)
        ? override.map(function (h) { return { value: String(h), label: String(h) }; })
        : (item ? item.hours : []);
      hours.setDisabled(!list.length);
      hours.setItems(list.map(function (h) { return { value: h.value, label: h.label }; }));
      hours.setPlaceholder(list.length ? CFG.hoursPlaceholder : CFG.hoursWaiting);

      if (keep && hours.setValue(keep, false)) { setNative(nHours, hours.value); return; }
      hours.setValue('');                        /* сбросить и видимую подпись поля */
      setNative(nHours, '');
      if (CFG.autoSelectSingle && list.length === 1) hours.pickByValue(list[0].value);
    }

    prog.onPick = function (item) {
      setNative(nProg, item.value);
      clearError(nProg);
      applyHours(item, '');
      prog.el.removeAttribute('data-ripf-prefilled');
      prog.input.title = '';
    };

    hours.onPick = function (item) {
      setNative(nHours, item.value);
      clearError(nHours);
    };

    mount(nProg, prog.el);
    mount(nHours, hours.el);
    syncFont(nProg, prog);
    syncFont(nHours, hours);
    mirrorError(nProg, prog);
    mirrorError(nHours, hours);

    /* подставить программу и часы со страницы программы (или из ?program=) */
    function applyPrefill(ctx) {
      var item = (ctx.uid && itemByUid(items, ctx.uid)) || itemByPath(items, ctx.path) ||
                 itemByName(items, ctx.name);
      var mark = function (el) { el.setAttribute('data-ripf-prefilled', ctx.source); };

      if (item) {
        prog.pickByValue(item.value);              /* onPick: родное поле + часы */
        if (ctx.hours && ctx.hours.length) applyHours(item, '', ctx.hours);
        /* в поле показываем название со страницы (его человек только что
           читал в заголовке), а в CRM уходит название из списка */
        if (ctx.display && ctx.display !== item.label) {
          prog.label = ctx.display;
          prog.input.value = prog.label;
        }
        prog.input.title = item.label;
        mark(prog.el);
        log('программа подставлена (' + ctx.source + '):', item.value,
            ctx.hours && ctx.hours.length ? 'часы: ' + ctx.hours.join(', ') : '');
        return;
      }

      /* строки в списке нет — подставляем название страницы как есть,
         иначе человек на этой странице вообще не сможет отправить заявку */
      prog.setValue(ctx.name, true);
      setNative(nProg, ctx.name);
      applyHours(null, '', ctx.hours);
      mark(prog.el);
      log('программы нет в списке (' + ctx.source + '), подставлено название со страницы:', ctx.name,
          ctx.uid ? 'uid: ' + ctx.uid : '');
    }

    /* поле уже заполнено (значение пришло из разметки формы) — подхватываем */
    var pre = nProg.value;
    if (pre) {
      var cur = itemByName(items, pre);
      if (cur) { prog.setValue(pre, false); applyHours(cur, nHours.value); }
      else { prog.setValue(pre, true); applyHours(null, ''); }
    } else {
      applyHours(null, '');
      var ctx = CFG.prefill ? resolveContext(items) : null;
      if (ctx) applyPrefill(ctx);
    }

    log('форма готова. Программ в списке:', items.length);
    return true;
  }

  /* Переходный период: на страницах могут остаться копии СТАРОГО скрипта.
     Он ставит свои контролы и data-ripf, из-за чего наш scan() решил бы, что
     форма уже собрана, и предзаполнение не сработало бы. Поэтому чужую
     сборку снимаем один раз и собираем заново своей версией. */
  function resetForeign() {
    var nodes = document.querySelectorAll(CFG.form);
    for (var i = 0; i < nodes.length; i++) {
      var form = nodes[i].tagName === 'FORM' ? nodes[i] : (nodes[i].querySelector('form') || nodes[i]);
      var roots = form.querySelectorAll('.ripf');
      var ours = false;
      for (var r = 0; r < roots.length; r++) {
        if (roots[r].getAttribute('data-ripf-version') === VERSION) ours = true;
      }
      if (ours) continue;

      for (var k = 0; k < roots.length; k++) {
        if (roots[k].parentNode) roots[k].parentNode.removeChild(roots[k]);
      }
      var natives = form.querySelectorAll('.ripf-native');
      for (var n = 0; n < natives.length; n++) natives[n].classList.remove('ripf-native');
      var marked = form.querySelectorAll('[data-ripf]');
      for (var m = 0; m < marked.length; m++) marked[m].removeAttribute('data-ripf');
      if (roots.length) log('снята сборка старой версии скрипта — собираем заново');
    }
  }

  function scan() {
    var nodes = document.querySelectorAll(CFG.form);
    var done = 0;
    for (var i = 0; i < nodes.length; i++) {
      /* селектор может указывать и на блок, и на саму форму — берём <form> внутри */
      var form = nodes[i].tagName === 'FORM' ? nodes[i] : (nodes[i].querySelector('form') || nodes[i]);
      if (initForm(form)) done++;
    }
    return done;
  }

  function boot() {
    resetForeign();
    scan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', function () { resetForeign(); scan(); });  /* попап-форма успевает отрисоваться */
  setTimeout(function () { resetForeign(); scan(); }, 1500);                 /* и ещё одна попытка на медленной загрузке */

  /* попап открывают ссылкой #rip-form: если форма почему-то отрисовалась
     позже (или её пересобрали), догоняем предзаполнение по клику */
  document.addEventListener('click', function (e) {
    var a = up(e.target, 'a[href*="#rip-form"]');
    if (!a) return;
    setTimeout(scan, 0);
  }, true);
  window.addEventListener('hashchange', function () {
    if (String(location.hash).indexOf('#rip-form') === 0) scan();
  });

  /* ссылка с явной программой: RIPF.link() → «/страница?program=<uid>#rip-form» */
  function programLink(href) {
    var base = String(href || '#rip-form');
    var ctx = resolveContext();
    var key = ctx && (ctx.uid || ctx.path || ctx.name);
    if (!key) return base;

    var hash = '';
    var at = base.indexOf('#');
    if (at !== -1) { hash = base.slice(at); base = base.slice(0, at); }
    if (!base) base = location.pathname;
    return base + (base.indexOf('?') === -1 ? '?' : '&') +
      CFG.paramName + '=' + encodeURIComponent(key) + hash;
  }

  /* отладка из консоли: RIPF.programs (копия списка для чтения), RIPF.context(),
     RIPF.link(), RIPF.scan() */
  var api = {
    version: VERSION,
    cfg: CFG,
    programs: PROGRAMS.slice(),
    scan: function () { resetForeign(); return scan(); },
    context: function () { return resolveContext(); },
    uid: pageUid,
    link: programLink
  };
  window.RIPF = api;

  /* если ниже по странице осталась старая копия скрипта, она перезапишет
     window.RIPF своим API — возвращаем свой, чтобы диагностика и ссылки
     работали от актуальной версии */
  function expose() { if (window.RIPF !== api) window.RIPF = api; }
  window.addEventListener('load', expose);
  setTimeout(expose, 1500);
})();

