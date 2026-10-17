/* =====================================================================
   rip-head.js — скрипты поля «HTML-код для <head>» одним файлом.
   Версия: 1.0.8af73c35
   Источник: head/modules/*.js (порядок — head/modules.json).
   Подключать БЕЗ defer/async: первому скрипту (антимерцание) нужно
   выполниться до первой отрисовки страницы.
   Состав:
   07-fly-up-blocks          485 симв.  Взлёт блоков: антимерцание
   11-scroll-restore          60 симв.  Сброс прокрутки при перезагрузке
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
