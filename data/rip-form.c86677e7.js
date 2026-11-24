/* =====================================================================
   ФОРМА ЗАЯВКИ НА ОБУЧЕНИЕ · один файл на весь сайт
   v2.1.0

   ЧТО ДЕЛАЕТ
     • Две вкладки сверху формы: «Физическое лицо» (по умолчанию — та же
       форма, что была) и «Юридическое лицо»: текст с адресом почты и
       кнопка «Скачать форму заявки». Ссылку на форму задаёт CFG.legalFormUrl.
       На каждой странице выбранная вкладка запоминается на сессию.
     • Крестик в правом верхнем углу формы закрывает её; Esc — тоже.
       Работает и в Pop-up Tilda (T1093), и у формы, стоящей на странице
       прямо в блоке. В Pop-up закрытие уходит в штатный крестик Tilda,
       поэтому после него форма открывается снова; где прямого крестика
       нет — форма сворачивается сама (кнопка «Открыть форму»).
     • «Программа обучения» — поле с выпадающим списком и поиском:
       начинаешь печатать — лишние варианты отсеиваются, совпавшие буквы
       подсвечиваются, работают стрелки/Enter/Esc. Ищет по названию, по
       часам («бухгалтерский 256») и по «корню» слова.
     • СПИСОК ПРОГРАММ БЕРЁТСЯ ИЗ ПОТОКА «Программы» (служебная страница
       /price-data): в форме ровно те программы, что есть на сайте, с их
       названиями и часами. Новая программа в потоке = новая строка в форме,
       без правки кода. Встроенный список PROGRAMS ниже — только аварийный:
       он включается, если поток не удалось прочитать.
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

  var VERSION = '2.1.0';

  /* ========================= 1. НАСТРОЙКИ ========================= */
  var CFG = {
    form: '.ripf-form, .uc-rip-form, .rip-study-form',
                                        /* CSS-класс, который вы задали БЛОКУ формы
                                           (rip-study-form — класс блока «заявка на обучение»)
                                           (настройки блока → «Класс» → ripf-form
                                           или uc-rip-form — на сайте сейчас второй).
                                           Скрипт сам найдёт <form> внутри блока;
                                           можно и по номеру: '#rec1234567890' */
    programField: 'program',            /* «Имя переменной» поля «Программа обучения» */
    hoursField: 'hours',                /* «Имя переменной» поля «Количество часов» */
    typeField: 'type',                  /* скрытое поле: тип выбранного варианта (ПК/ПП) */

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
    usePageTitleFallback: true,         /* uid не в списке → подставить название со страницы */

    /* ── откуда берётся список программ ───────────────────────────
       'feed'    — из потока «Программы» (страница feedUrl). В форме ровно
                   те программы, что есть в потоке: названия и часы оттуда.
       'builtin' — из массива PROGRAMS ниже (аварийный режим).            */
    source: (typeof window !== 'undefined' && window.RIPF_SOURCE) || 'feed',
    feedUrl: '/price-data',
    feedRoot: '.rip-feed-source, #rip-feed-source, [data-fe-role="feed"]',
    feedPost: '[data-fe-role="post"]',
    feedTitle: '[data-fe-post-field="title"], .rip-feed__title',
    feedGroup: '[data-fe-post-field="rip-programm-group"]',
    feedType: '[data-fe-post-field="rip-programm-type"]',
    feedHours: '[data-fe-post-field="rip-programm-hours"], .rip-feed__hours',
    feedHours2: '[data-fe-post-field="rip-programm-hours2"]',
    feedHours3: '[data-fe-post-field="rip-programm-hours3"]',
    feedAddon: '[data-fe-post-field="rip-programm-addon"], .rip-feed__addon',
    feedAddon2: '[data-fe-post-field="rip-programm-addon2"]',
    feedAddon3: '[data-fe-post-field="rip-programm-addon3"]',
    feedTimeout: 8000,
    loadingText: 'Загружаем список программ…',

    /* ── вкладки «Физ. / юр. лицо», закрытие формы ───────────────── */
    tabs: true,                         /* false — оставить только физ. лицо */
    tabPerson: 'Физическое лицо',
    tabLegal: 'Юридическое лицо',
    email: 'info@slav-institut.ru',     /* адрес в тексте ветки «юр. лицо» */
    legalText: 'Скачайте, пожалуйста, форму заявки, заполните ее и направьте нам на электронную почту {email}',
    legalFileText: 'Ссылка для скачивания формы заявки',
    /* Подпись кнопки. Пусто — берётся слово из legalFileText
       (перед ним — картинка значка скачивания). */
    legalButton: 'Скачать форму заявки',
    /* Ссылка на файл формы. Пусто — на странице выводится заметная
       надпись «задайте ссылку в CFG.legalFormUrl», чтобы это не ушло в работу. */
    legalFormUrl: '',
    sessionKey: 'rip-form-tab',         /* запоминание вкладки на время сессии */

    close: true,                        /* false — без крестика и Esc */
    closeTitle: 'Закрыть форму',
    reopenText: 'Открыть форму'
  };

  /* ============== 2. АВАРИЙНЫЙ СПИСОК ПРОГРАММ ==============
     Основной источник — поток «Программы» (CFG.source = 'feed').
     Этот массив включается ТОЛЬКО если поток не удалось прочитать, чтобы
     форма не осталась с пустым списком. Формат:

       { name: 'Название', hours: ['16', '24', '40'] }

     Если подпись должна отличаться от значения, пишите объектом:

       hours: [{ value: '256', label: '256 часов' }]

     Необязательные поля (нужны только в аварийном режиме):
       uid  — id поста ленты; path — адрес страницы программы.            */
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
    var list = items || currentItems();
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
      /* похоже на uid, которого нет в списке: параметр не разобрался —
         не подставляем его как название, идём дальше по странице */
      if (/^[a-z0-9]{6,14}$/i.test(param)) {
        if (!onPage) return null;
      } else {
        return {
          name: param, display: '', hours: onPage ? pageHours() : [],
          uid: '', path: '', source: 'url', matched: false
        };
      }
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

    /* ключи не проставлены (например, список пришёл из потока) — сверяем
       название страницы с названием программы в списке */
    var title = pageTitle();
    var byTitle = title ? itemByName(list, title) : null;
    if (byTitle) {
      return {
        name: byTitle.value, display: '', hours: pageHoursFor(byTitle),
        uid: uid, path: path, source: 'page-title', matched: true
      };
    }

    if (!CFG.usePageTitleFallback || !title) return null;
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

  /* ==================== 2a. СПИСОК ИЗ ПОТОКА ====================
     Поток «Программы» отдаётся служебной страницей /price-data: посты с
     полями title, rip-programm-hours, rip-programm-hours2. Берём оттуда
     названия и часы — в форме ровно то, что есть на сайте.
     Если поток недоступен, остаётся встроенный PROGRAMS (аварийный режим). */

  function textIn(root, sel) {
    var el = root && root.querySelector ? root.querySelector(sel) : null;
    if (!el) return '';
    return norm(String(el.textContent || '').replace(/feeds:\S*/gi, ' '));
  }

  function hoursIn(post) {
    var out = [];
    [CFG.feedHours, CFG.feedHours2, CFG.feedHours3].forEach(function (sel) {
      var m = textIn(post, sel).match(/\d+/);
      if (!m) return;
      var v = String(parseInt(m[0], 10));
      if (v !== 'NaN' && out.indexOf(v) === -1) out.push(v);
    });
    return out;
  }

  /* уточнения к вариантам: «Базовый курс», «Цистерны» и т. п. */
  function addonsIn(post) {
    return [CFG.feedAddon, CFG.feedAddon2, CFG.feedAddon3].map(function (sel) {
      return textIn(post, sel);
    });
  }

  function typeIn(post) {
    var t = textIn(post, CFG.feedType);
    if (!t) return '';
    return t.charAt(0).toLowerCase() + t.slice(1);
  }

  /* Пара записей (повышение квалификации + переподготовка) — одна программа:
     склеиваем по полю rip-programm-group, а если оно не заполнено — по названию.
     Часы собираем из обеих записей, к каждым подписываем тип. */
  function parseFeed(html) {
    if (!window.DOMParser) return null;
    var doc;
    try { doc = new DOMParser().parseFromString(String(html || ''), 'text/html'); }
    catch (e) { return null; }

    var root = doc.querySelector(CFG.feedRoot) || doc;
    var posts = root.querySelectorAll(CFG.feedPost);
    if (!posts.length) posts = doc.querySelectorAll(CFG.feedPost);

    var out = [], byKey = {};
    for (var i = 0; i < posts.length; i++) {
      var name = textIn(posts[i], CFG.feedTitle);
      if (!name) continue;
      var group = textIn(posts[i], CFG.feedGroup);
      var key = group ? 'g:' + fold(group) : 'n:' + fold(name);
      var type = typeIn(posts[i]);
      /* три варианта записи: часы + уточнение к каждому */
      var hv = [CFG.feedHours, CFG.feedHours2, CFG.feedHours3].map(function (sel) {
        var m = textIn(posts[i], sel).match(/\d+/);
        return m ? String(parseInt(m[0], 10)) : '';
      });
      var addons = addonsIn(posts[i]);

      var item = byKey[key];
      if (!item) {
        item = { value: name, label: name, hint: '', hours: [], types: {}, uid: '', path: '' };
        byKey[key] = item;
        out.push(item);
      }
      for (var h = 0; h < hv.length; h++) {
        var v = hv[h];
        if (!v) continue;
        if (item.types[v] !== undefined) continue;   /* такие часы уже собраны */
        var addon = addons[h] || '';
        item.types[v] = type;
        item.hours.push({
          value: v,
          label: v + CFG.hoursSuffix + (type ? ' — ' + type : '') + (addon ? ' · ' + addon : ''),
          addon: addon
        });
      }
    }

    for (var k = 0; k < out.length; k++) {
      var nums = [];
      for (var j = 0; j < out[k].hours.length; j++) nums.push(out[k].hours[j].value);
      out[k].hint = nums.length ? nums.join(', ') + CFG.hoursSuffix : '';
    }
    return out;
  }

  /* привести любой список к виду, который понимает Control */
  function normalizeItems(list) {
    var out = [];
    for (var i = 0; i < (list || []).length; i++) {
      var it = list[i] || {};
      var name = it.value || it.label || it.name || '';
      if (!name) continue;
      var hs = normHours(it.hours || []);
      out.push({
        value: String(name), label: String(it.label || name),
        hint: it.hint || (hs.length ? hs.map(function (h) { return h.label; }).join(', ') + CFG.hoursSuffix : ''),
        hours: hs, types: it.types || {}, uid: it.uid || '', path: it.path || ''
      });
    }
    return out;
  }

  var feedCache = null;                   /* null — не читали, false — не вышло, массив — готово */

  /* список, который реально видит человек (для RIPF.programs и context) */
  var activePrograms = [];

  function setActive(list) {
    activePrograms.length = 0;
    for (var i = 0; i < (list || []).length; i++) activePrograms.push(list[i]);
  }

  function currentItems() {
    return activePrograms.length ? activePrograms : buildItems();
  }

  function loadFeed(done) {
    /* демо и тесты подкладывают список без сети */
    if (Array.isArray(window.RIPF_FEED_ITEMS)) {
      var given = normalizeItems(window.RIPF_FEED_ITEMS);
      feedCache = given.length ? given : false;
      done(feedCache || null);
      return;
    }
    if (feedCache !== null) { done(feedCache || null); return; }

    var req = new XMLHttpRequest();
    var url = CFG.feedUrl + (CFG.feedUrl.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
    req.open('GET', url, true);
    req.timeout = CFG.feedTimeout;
    req.onload = function () {
      var list = null;
      if (req.status >= 200 && req.status < 300) {
        try { list = parseFeed(req.responseText); } catch (e) { list = null; }
      }
      feedCache = list && list.length ? list : false;
      if (!feedCache) log('поток не дал программ — остаётся встроенный список');
      done(feedCache || null);
    };
    req.onerror = req.ontimeout = function () {
      feedCache = false;
      log('поток недоступен — остаётся встроенный список');
      done(null);
    };
    try { req.send(); } catch (e) { feedCache = false; done(null); }
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

  /* ============ 4a. ВКЛАДКИ «ФИЗИЧЕСКОЕ / ЮРИДИЧЕСКОЕ ЛИЦО» ============

     Вкладки и экран «юр. лицо» собираются здесь, а не в Zero Block: блоки
     формы на страницах — Pop-up, у Pop-up нет анимации появления, а блочная
     форма держит высоту полем «Фиксированная высота» редактора. Вид задан в
     head-модуле 08 (переменные --riptab-*), тексты и ссылка — в CFG выше.

     Физ. лицо — это сама форма Tilda (поля + кнопка): ветка по умолчанию.
     Юр. лицо — экран с текстом и кнопкой скачивания формы. Чтобы в заявку
     не ушли данные другой вкладки, перекрывающаяся часть получает класс
     rip-form_hidden: в ветке «юр. лицо» — поля и кнопка формы, в ветке
     «физ. лицо» — экран юр. лица.

     Видимость меняем через inline display, а не атрибутом hidden: у Tilda
     есть правило display:flex с !important для .t-form__inputsbox, которое
     атрибут hidden не перебивает, а рисует его ещё и артборд Zero Block
     (класс rip-tabs-on у артборда — см. head-модуль 08). */

  /* части формы, которые прячутся по вкладкам (ищем живьём: Pop-up Tilda
     собирает форму позже, и классы кнопки появляются не сразу) */
  function partsOf(form) {
    var all = form.querySelectorAll('.t-input-group');
    var fields = form.querySelector('.t-form__inputsbox');
    if (!fields && all.length) {
      /* без общей обёртки (фикстура, нестандартная форма) — группа полей от
         первой до последней; кнопка отправки в неё не входит */
      fields = [];
      for (var i = 0; i < all.length; i++) fields.push(all[i]);
    }
    return {
      submit: form.querySelector('.t-form__submit, button[type="submit"], .t-submit'),
      fields: fields
    };
  }

  /* спрятать/показать часть формы; fields может быть списком групп полей */
  function hidePart(el, hide) {
    if (!el) return;
    if (el.length && el.length > 0 && !el.nodeType) {
      for (var i = 0; i < el.length; i++) setHidden(el[i], hide);
    } else {
      setHidden(el, hide);
    }
  }

  function show(el, on) {
    if (!el) return;
    if (!on) el.style.display = 'none';
    else if (el.style.display === 'none') el.style.display = '';
  }

  function setHidden(el, hide) {
    if (!el) return;
    if (hide) addCls(el, 'rip-form_hidden');
    else if (el.classList) el.classList.remove('rip-form_hidden');
    else el.className = (' ' + el.className + ' ').replace(' rip-form_hidden ', ' ');
  }

  function legalUrl() { return String(CFG.legalFormUrl || '').replace(/^\s+|\s+$/g, ''); }

  /* экран «юр. лицо»: текст с адресом почты и кнопка скачивания формы.
     Пока CFG.legalFormUrl пуста, у кнопки стоит класс rip-ent__btn_empty —
     в head-модуле 08 он показывает, что ссылку ещё надо задать. */
  function legalScreen() {
    var box = document.createElement('div');
    box.className = 'rip-ent';
    box.style.display = 'none';

    var p = document.createElement('p');
    p.className = 'rip-ent__text';
    var t = String(CFG.legalText || '');
    var at = t.indexOf('{email}');
    var mail = '<a href="mailto:' + esc(CFG.email) + '">' + esc(CFG.email) + '</a>';
    p.innerHTML = at === -1 ? esc(t) + ' ' + mail
      : esc(t.slice(0, at)) + mail + esc(t.slice(at + 7));
    box.appendChild(p);

    var url = legalUrl();
    var a = document.createElement('a');
    a.className = 'rip-ent__btn' + (url ? '' : ' rip-ent__btn_empty');
    a.innerHTML = '<span class="rip-ent__icon" aria-hidden="true"></span>' +
                  '<span class="rip-ent__label">' + esc(CFG.legalButton) + '</span>';
    if (url) {
      a.setAttribute('href', url);
      a.setAttribute('download', '');
      if (/^https?:/i.test(url)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    } else {
      a.setAttribute('href', '#');
    }
    box.appendChild(a);
    return box;
  }

  /* что видно на каждой вкладке */
  function applyBranch(form) {
    var legal = form.getAttribute('data-ripf-tab') === 'legal';
    var p = partsOf(form);
    hidePart(p.fields, legal);
    setHidden(p.submit, legal);
    setHidden(form.querySelector('.rip-ent'), !legal);
    form.setAttribute('data-ripf-branch', legal ? 'legal' : 'person');
  }

  /* Выбор вкладки помним до конца сессии: sessionStorage, а где браузер его
     не даёт (приватный режим, запрет хранилища) — cookie на время сессии.
     Вкладка не должна сбрасываться при переходе на другую страницу: человек
     уже выбрал, что он — юридическое лицо. */
  function tabFromCookie() {
    var v = '';
    if (!document.cookie) return v;
    var m = String(document.cookie).match(new RegExp('(?:^|;\\s*)' + escRe(CFG.sessionKey) + '=([^;]*)'));
    if (m) { try { v = decodeURIComponent(m[1]); } catch (e) { v = m[1]; } }
    return v;
  }

  function savedTab() {
    var v = '';
    try { v = window.sessionStorage.getItem(CFG.sessionKey) || ''; } catch (e) { v = ''; }
    if (!v) v = tabFromCookie();
    return v;
  }

  function saveTab(tab) {
    var ok = false;
    try { window.sessionStorage.setItem(CFG.sessionKey, tab); ok = true; } catch (e) { /* нет хранилища */ }
    if (!ok && document.cookie != null) {
      document.cookie = CFG.sessionKey + '=' + encodeURIComponent(tab) +
        '; path=/; SameSite=Lax';
    }
  }

  function setupTabs(form) {
    /* экран юр. лица ставим, даже когда вкладки выключены (CFG.tabs = false):
       вкладок нет — ветки нет, и экран остаётся скрытым. insertBefore выполняем
       ДО флага сборки: иначе флаг ставился бы, даже если вставка не удалась, и
       второй проход не довёл бы сборку до конца */
    if (form.getAttribute('data-ripf-tabs-owned') !== '1' && !form.querySelector('.rip-ent')) {
      form.insertBefore(legalScreen(), form.firstChild);
    }
    form.setAttribute('data-ripf-tabs-owned', '1');
    if (form.getAttribute('data-ripf-tabs') === '1') { applyBranch(form); return; }
    form.setAttribute('data-ripf-tabs', '1');
    form.setAttribute('data-ripf-tab', savedTab() === 'legal' ? 'legal' : 'person');

    if (!CFG.tabs) { setTab(form, 'person', true); return; }

    var tabs = document.createElement('div');
    tabs.className = 'rip-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Тип заявителя');

    var buttons = [
      { tab: 'person', text: CFG.tabPerson },
      { tab: 'legal', text: CFG.tabLegal }
    ];
    for (var i = 0; i < buttons.length; i++) {
      (function (cfg) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'rip-tabs__tab';
        b.setAttribute('role', 'tab');
        b.setAttribute('data-tab', cfg.tab);
        b.innerHTML = '<span class="rip-tabs__label">' + esc(cfg.text) + '</span>';
        b.addEventListener('click', function () { setTab(form, cfg.tab); });
        b.addEventListener('keydown', function (e) {
          var k = e.key;
          if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
          e.preventDefault();
          setTab(form, cfg.tab === 'person' ? 'legal' : 'person');
          var next = tabs.querySelector('.rip-tabs__tab[data-tab="' +
            form.getAttribute('data-ripf-tab') + '"]');
          if (next && next.focus) next.focus();
        });
        tabs.appendChild(b);
      })(buttons[i]);
    }

    /* над формой, но внутри её блока: у блока формы в Zero Block поток
       колонкой, поэтому вкладки поднимут низ артборда (его догоняет fitBoard) */
    var anchor = form.closest('.tn-atom__form') || form;
    if (anchor.parentNode) anchor.parentNode.insertBefore(tabs, anchor);

    setTab(form, form.getAttribute('data-ripf-tab'), true);
  }

  function setTab(form, tab, quiet) {
    form.setAttribute('data-ripf-tab', tab);
    if (!quiet) saveTab(tab);
    applyBranch(form);
    syncTabs(form);
  }

  /* подсветка активной вкладки и aria */
  function syncTabs(form) {
    /* вкладки стоят НАД формой (в блоке), поэтому ищем от родителя формы */
    var host = form.parentNode || form;
    var tabs = host.querySelector('.rip-tabs') || form.querySelector('.rip-tabs');
    if (!tabs) return;
    var cur = form.getAttribute('data-ripf-tab') || 'person';
    var list = tabs.querySelectorAll('.rip-tabs__tab');
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var on = b.getAttribute('data-tab') === cur;
      if (on) addCls(b, 'is-active');
      else if (b.classList) b.classList.remove('is-active');
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.setAttribute('tabindex', on ? '-1' : '0');
    }
  }

  /* ==================== 4b. ЗАКРЫТИЕ ФОРМЫ ====================
     Крестик в правом верхнем углу формы и Esc. Три случая:

       1) форма в Pop-up Tilda (T1093) — у Pop-up уже есть свой крестик
          «Закрыть диалоговое окно» в том же углу, наш не ставим (два крестика
          рядом — это то же самое действие, лишний дубль), а Esc передаём
          штатному. Закрыватель Tilda сам<
          убирает попап, снимает блокировку прокрутки страницы и возвращает
          ссылке-открывателю вид «не нажата», поэтому форма открывается снова
          по той же ссылке. Обход Tilda, который переносит вставленный нами
          элемент или перерисовывает его, на клик по чужому элементу не влияет;
       2) форма стоит прямо в блоке Zero Block (Pop-up не задействован):
          крестик настоящий — сворачивает форму и оставляет кнопку
          «Открыть форму». Esc работает и здесь.

     Пока форма свёрнута, у .t-rec стоит класс rip-form-off: в head-модуле 08
     он убирает отступы секции, иначе после формы висела бы пустая полоса. */

  /* Esc из открытого списка программы: Control закрывает список сам и
     гасит событие (stopPropagation), до этого обработчика оно не доходит.
     А если по какой-то причине дошло, список ещё открыт — форма и попап
     не закрываются. */
  function escBusy() {
    if (document.querySelector('.ripf.ripf_open')) return true;
    return !!up(document.activeElement, '.ripf');    /* Esc в поле списка — его дело */
  }

  function setupClose(form) {
    if (!CFG.close || form.getAttribute('data-ripf-close') === '1') return;
    form.setAttribute('data-ripf-close', '1');

    var rec = up(form, '.t-rec') || form;
    var popup = up(form, '.t-popup');

    /* Esc: в Pop-up — штатному крестику Tilda, иначе — сворачиваем форму */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc' && e.keyCode !== 27) return;
      if (popup && !popup.classList.contains('t-popup_show')) return;
      if (escBusy()) return;                             /* Esc в открытом списке — его дело */
      if (popup) {
        var btn = popup.querySelector('.t-popup__close-wrapper') || popup.querySelector('.t-popup__close');
        if (!btn) return;
        e.preventDefault();
        btn.click();
        return;
      }
      if (!form.classList.contains('rip-form-closed')) {
        e.preventDefault();
        collapse(form, rec);
      }
    }, false);

    /* в Pop-up свой крестик уже есть — второй не нужен */
    if (popup) return;

    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'rip-form-x';
    x.setAttribute('aria-label', CFG.closeTitle);
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    x.addEventListener('click', function () { collapse(form, rec); });

    /* в правый верхний угол блока формы: у блока в Zero Block position:relative */
    var host = form.closest('.t396__elem') || rec;
    if (window.getComputedStyle && getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(x);

    /* кнопка «Открыть форму» с той же стороны, где крестик */
    var reopen = document.createElement('a');
    reopen.className = 'rip-form-reopen';
    reopen.setAttribute('href', '#open-form');
    reopen.setAttribute('role', 'button');
    reopen.textContent = CFG.reopenText;
    reopen.addEventListener('click', function (e) { e.preventDefault(); expand(form, rec); });
    form.appendChild(reopen);
  }

  function collapse(form, rec) {
    addCls(rec, 'rip-form-off');
    addCls(form, 'rip-form-closed');
    var f = document.activeElement;
    if (f && f.blur) f.blur();                 /* фокус уйдёт из скрытой формы */
    var link = form.querySelector('.rip-form-reopen');
    if (link && link.focus) link.focus();
  }

  function expand(form, rec) {
    if (rec.classList) rec.classList.remove('rip-form-off');
    form.classList.remove('rip-form-closed');
    var first = form.querySelector('.rip-tabs__tab[data-tab="' +
      (form.getAttribute('data-ripf-tab') || 'person') + '"]') || form.querySelector('input, select, button');
    if (first && first.focus) first.focus();
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

    /* вкладки «Физ. / юр. лицо» и закрытие — до сборки полей */
    setupTabs(form);
    setupClose(form);

    /* скрытое поле с типом выбранного варианта: ПК или переподготовка.
       Создаём сами — в форме Tilda отдельного поля для него нет. */
    var nType = form.querySelector('[name="' + CFG.typeField + '"]');
    if (!nType) {
      nType = document.createElement('input');
      nType.type = 'hidden';
      nType.name = CFG.typeField;
      form.appendChild(nType);
    }

    var builtin = buildItems();
    var feedMode = CFG.source !== 'builtin';
    var items = feedMode ? [] : builtin;

    var prog = new Control({ searchable: true, placeholder: CFG.programPlaceholder });
    var hours = new Control({ searchable: false, placeholder: CFG.hoursWaiting });
    prog.setItems(items);
    /* метка версии: по ней видно, чей это контрол (см. resetForeign) */
    prog.el.setAttribute('data-ripf-version', VERSION);
    hours.el.setAttribute('data-ripf-version', VERSION);
    /* артборд: показать (не флэшить старой формой) и дотянуть высоту под
       вкладки и экран юр. лица — до того, как Pop-up успел открыться */
    watchBoard(form);
    if (feedMode) {
      prog.setPlaceholder(CFG.loadingText);      /* не показываем чужой список даже на миг */
      hours.setPlaceholder(CFG.loadingText);
    }

    /* пересобрать список часов под выбранную программу.
       override — часы со страницы программы: они важнее списка, потому
       что показывают, что продаётся именно на этой странице. */
    var pickedItem = null;

    function setType(item, hourValue) {
      var t = '';
      if (item && item.types && hourValue) t = item.types[String(hourValue)] || '';
      setNative(nType, t);
    }

    function applyHours(item, keep, override) {
      var list = (override && override.length)
        ? override.map(function (h) {
            return (h && typeof h === 'object')
              ? { value: String(h.value), label: String(h.label || h.value) }
              : { value: String(h), label: String(h) };
          })
        : (item ? item.hours : []);
      hours.setDisabled(!list.length);
      hours.setItems(list.map(function (h) { return { value: h.value, label: h.label }; }));
      hours.setPlaceholder(list.length ? CFG.hoursPlaceholder : CFG.hoursWaiting);

      if (keep && hours.setValue(keep, false)) { setNative(nHours, hours.value); setType(item, hours.value); return; }
      hours.setValue('');                        /* сбросить и видимую подпись поля */
      setNative(nHours, '');
      setType(item, '');
      if (CFG.autoSelectSingle && list.length === 1) hours.pickByValue(list[0].value);
    }

    prog.onPick = function (item) {
      pickedItem = item;
      setNative(nProg, item.value);
      clearError(nProg);
      applyHours(item, '');
      prog.el.removeAttribute('data-ripf-prefilled');
      prog.input.title = '';
    };

    hours.onPick = function (item) {
      setNative(nHours, item.value);
      setType(pickedItem, item.value);
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
        /* На странице программы часы могут быть богаче строки потока (у записи
           два варианта в полях hours и hours2). Показываем ОБА источника:
           часы программы с подписями типа + часы со страницы, которых в них нет.
           Сами ничего не выбираем — человек выберет вариант. */
        var list = (item.hours || []).slice();
        if (ctx.hours && ctx.hours.length) {
          for (var pi = 0; pi < ctx.hours.length; pi++) {
            var pv = String(ctx.hours[pi]);
            var known = false;
            for (var li = 0; li < list.length; li++) if (list[li].value === pv) known = true;
            if (!known) list.push({ value: pv, label: pv });
          }
        }
        applyHours(item, '', list);
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

    /* что делать, когда список уже есть (сразу или после потока) */
    function runPrefill() {
      var pre = nProg.value;
      if (pre) {
        var cur = itemByName(items, pre);
        if (cur) { pickedItem = cur; prog.setValue(pre, false); applyHours(cur, nHours.value); }
        else { prog.setValue(pre, true); applyHours(null, ''); }
        return;
      }
      applyHours(null, '');
      var ctx = CFG.prefill ? resolveContext(items) : null;
      if (ctx) applyPrefill(ctx);
    }

    if (feedMode) {
      loadFeed(function (list) {
        if (list && list.length) {
          items = list;
          prog.setItems(items);
        } else {
          items = builtin;                       /* аварийный режим */
        }
        setActive(items);
        prog.setPlaceholder(CFG.programPlaceholder);
        log('программ в списке:', items.length, list && list.length ? '(из потока)' : '(встроенный)');
        runPrefill();
      });
    } else {
      setActive(items);
      runPrefill();
    }

    return true;
  }

  /* Переходный период: на страницах могут остаться копии СТАРОГО скрипта.
     Он ставит свои контролы и data-ripf, из-за чего наш scan() решил бы, что
     форма уже собрана, и предзаполнение не сработало бы. Поэтому чужую
     сборку снимаем один раз и собираем заново своей версией. */
  /* элементы, которые ставит наша сборка */
  var OUR_NODES = '.rip-tabs, .rip-ent, .rip-form-x, .rip-form-reopen';

  function resetForeign() {
    var nodes = document.querySelectorAll(CFG.form);
    for (var i = 0; i < nodes.length; i++) {
      var form = nodes[i].tagName === 'FORM' ? nodes[i] : (nodes[i].querySelector('form') || nodes[i]);
      var stale = [];
      var roots = form.querySelectorAll('.ripf');
      var ours = false;
      for (var r = 0; r < roots.length; r++) {
        if (roots[r].getAttribute('data-ripf-version') === VERSION) ours = true;
      }
      if (ours) continue;

      /* наша сборка живёт и ВНЕ формы (вкладки — над ней), поэтому ищем по блоку */
      var rec = up(form, '.t-rec') || form;
      var found = rec.querySelectorAll(OUR_NODES);
      for (var q = 0; q < found.length; q++) stale.push(found[q]);

      for (var k = 0; k < roots.length; k++) {
        if (roots[k].parentNode) roots[k].parentNode.removeChild(roots[k]);
      }
      var natives = form.querySelectorAll('.ripf-native');
      for (var n = 0; n < natives.length; n++) natives[n].classList.remove('ripf-native');
      var marked = form.querySelectorAll('[data-ripf]');
      for (var m = 0; m < marked.length; m++) marked[m].removeAttribute('data-ripf');
      /* и наша сборка вкладок/закрытия — иначе останутся два набора вкладок */
      for (var t = 0; t < stale.length; t++) if (stale[t].parentNode) stale[t].parentNode.removeChild(stale[t]);
      form.removeAttribute('data-ripf-tabs');
      form.removeAttribute('data-ripf-close');
      form.removeAttribute('data-ripf-tab');
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

  /* ── высота артборда Zero Block, когда низ формы меняет вкладки ──
     Вкладки и экран юр. лица стоят в потоке формы, поэтому низ артборда
     зависит от них. Артборд трогаем ТОЛЬКО если он правда виден (Pop-up
     открыт): у закрытого Pop-up артборд скрыт, а замер там даёт 0 и
     испортил бы сохранённую высоту (грабля из ZERO-BLOCK-ГРАБЛИ.md).
     Новую высоту не придумываем, а достраиваем ту, что выставила Тильда,
     на разницу содержимого — как только содержимое сравнится, мы молчим. */

  function boardOf(form) {
    var rec = up(form, '.t-rec');
    return rec ? rec.querySelector('.t396__artboard') : null;
  }

  function contentH(el) {
    var kids = el.children;
    var max = 0;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (window.getComputedStyle) {
        var pos = getComputedStyle(k).position;
        if (pos === 'absolute' || pos === 'fixed') continue;
      }
      max = Math.max(max, k.offsetTop + k.offsetHeight);
    }
    return max;
  }

  function fits(ab) {
    if (ab.getAttribute('data-artboard-heightmode') === 'hug') return true;
    var cs = window.getComputedStyle ? getComputedStyle(ab) : null;
    if (cs && cs.overflowY === 'visible') return true;
    if (cs && cs.display === 'none') return true;            /* Pop-up закрыт */
    return contentH(ab) <= ab.clientHeight + 2;
  }

  function fitBoard(ab) {
    if (!ab || ab.getAttribute('data-ripf-h') === '1') return;
    ab.setAttribute('data-ripf-h', '1');
    var doFit = function () {
      /* достраиваем по одному до полного показа: содержимое может расти
         несколько раз (вкладки → поля → кнопка), а больше нужного не растём */
      for (var i = 0; i < 6 && !fits(ab); i++) {
        ab.style.height = (ab.clientHeight + Math.ceil(contentH(ab) - ab.clientHeight)) + 'px';
      }
    };
    doFit();
    if (!window.MutationObserver) return;
    var opts = { attributes: true, attributeFilter: ['style', 'class'] };
    var mo = new MutationObserver(doFit);
    mo.observe(ab, opts);
    if (ab.parentNode) mo.observe(ab.parentNode, opts);   /* T396 держит height и у карриера */
  }

  function watchBoard(form) {
    var ab = boardOf(form);
    if (!ab) return;
    ab.classList.add('rip-tabs-on');        /* снять visibility:hidden head-модуля 08 */
    if (ab.getAttribute('data-ripf-watched') === '1') return;
    ab.setAttribute('data-ripf-watched', '1');
    fitBoard(ab);
  }

  function boot() {
    resetForeign();
    scan();
    showBoards();
  }

  /* артборды форм показываем сразу после первой сборки: до неё у них стоит
     visibility:hidden из head-модуля 08 (иначе Pop-up флэшит формой без
     вкладок). Форма, которую не собрали, показать тоже надо — лучше без
     вкладок, чем невидимая. */
  function showBoards() {
    var nodes = document.querySelectorAll('.t-rec .t396__artboard:not(.rip-tabs-on)');
    for (var i = 0; i < nodes.length; i++) {
      var rec = up(nodes[i], '.t-rec');
      if (!rec || !rec.querySelector('form')) continue;
      nodes[i].classList.add('rip-tabs-on');
    }
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
    if (!ctx) return base;
    var list = currentItems();
    var key = (ctx.uid && itemByUid(list, ctx.uid)) ? ctx.uid
      : (ctx.path && itemByPath(list, ctx.path)) ? ctx.path
      : ctx.name;
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
    programs: activePrograms,
    scan: function () { resetForeign(); return scan(); },
    context: function () { return resolveContext(); },
    uid: pageUid,
    link: programLink,
    /* вкладка «физ./юр. лицо» — для тестов и отладки из консоли */
    tab: function (form) { var f = form || document.querySelector(CFG.form); return f ? f.getAttribute('data-ripf-tab') : null; },
    setTab: function (tab, form) { var f = form || document.querySelector(CFG.form); if (f) setTab(f, tab); },
    saveTab: saveTab,
    savedTab: savedTab,
    savedTabFromCookie: tabFromCookie
  };
  window.RIPF = api;

  /* если ниже по странице осталась старая копия скрипта, она перезапишет
     window.RIPF своим API — возвращаем свой, чтобы диагностика и ссылки
     работали от актуальной версии */
  function expose() { if (window.RIPF !== api) window.RIPF = api; }
  window.addEventListener('load', expose);
  setTimeout(expose, 1500);
})();

