/* ==========================================================================
   decor.js — АТМОСФЕРА: ДЕКОР, ИКОНКИ, ПОЯВЛЕНИЕ ПРИ ПРОКРУТКЕ

   ЭТОТ ФАЙЛ НЕ ТРОГАЕТ ДАННЫЕ.
   Ни Store, ни Auth, ни маршрутизация его не знают и знать о нём не
   обязаны. Здесь ровно три занятия, и все три — про внешний вид:

     1. Вставить в шапку декоративные слои (герб, угли, дым).
     2. Заменить emoji-«иконки» на единый набор SVG-иконок.
     3. Проявлять карточки и панели при прокрутке.

   ЕСЛИ СКРИПТ НЕ ЗАРАБОТАЛ — сайт не ломается.
   Класс html.tavern-js навешивается первым делом, и именно он включает
   скрытые до времени состояния в tavern.css. Нет скрипта — нет класса,
   значит весь контент виден сразу, просто без анимаций и с emoji
   вместо иконок. Так же ведёт себя сайт у тех, кто отключил JS.

   ПОРЯДОК ПОДКЛЮЧЕНИЯ: после всех рабочих скриптов страницы, рядом
   с notice.js. Декор обязан запускаться ПОСЛЕ того, как отзывы и
   народные рецепты уже нарисованы, — иначе он бы их не увидел.
   ========================================================================== */

var Decor = (function () {
  'use strict';

  /* Флаг «можно прятать и проявлять». Ставится СРАЗУ, не дожидаясь
     DOMContentLoaded: иначе страница успела бы отрисоваться целиком,
     а потом карточки мигнули бы, прячась перед появлением. */
  document.documentElement.classList.add('tavern-js');

  /* Системная настройка «убрать анимации». Люди, которым от движения
     мутит, получают тот же сайт, но неподвижный: ни проявления, ни
     пляшущих углей. */
  var REDUCED = !!(window.matchMedia &&
                   window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ==========================================================================
     1. НАБОР ИКОНОК
     ==========================================================================
     Все иконки рисуются ОДНИМ пером, поэтому и выглядят родственно:
       · сетка 24×24;
       · толщина линии 1.6 (берётся из CSS, а не из разметки);
       · скруглённые окончания;
       · цвет currentColor — иконка красится тем же цветом, что и текст
         рядом, поэтому в светлой теме она золотая, в тёмной тоже.

     Здесь только ВНУТРЕННЯЯ часть svg. Внешний тег создаёт icon(),
     а стили (fill/stroke/размер) живёт в tavern.css — перекрасить весь
     набор = поправить одно правило, а не двадцать файлов-картинок. */
  var ICONS = {
    /* Герб — щит со звездой. Вывеска, знак раздела. */
    crest: '<path d="M12 2.6 19 5v6.2c0 4.3-2.9 7.6-7 9.2-4.1-1.6-7-4.9-7-9.2V5Z"/>' +
           '<path d="m12 7.3 1.3 2.7 2.9.4-2.1 2.1.5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2.1 2.9-.4Z"/>',

    /* Меч — сложность «средне»: готовить можно, но нож нужен. */
    sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/>' +
           '<path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',

    /* Щит — «легко»: справится даже саппорт. */
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',

    /* Огонь — «сложно» и врезка «Совет». */
    flame: '<path d="M12 2.6c.4 2.6-.8 3.9-2.2 5.3C8 9.6 6.4 11.2 6.4 14a5.6 5.6 0 0 0 11.2 0' +
           'c0-2-.9-3.6-2.2-5-.2 1-.7 1.8-1.5 2.3.6-3.2-.3-6.4-1.9-8.7Z"/>',

    /* Кружка — напитки из «Мемасиков». */
    mug: '<path d="M6 8.5h10V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/>' +
         '<path d="M16 10.5h2.2A1.8 1.8 0 0 1 20 12.3v3.4a1.8 1.8 0 0 1-1.8 1.8H16"/>' +
         '<path d="M6 12.6h10"/>' +
         '<path d="M7.8 8.5c-.5-1.6.7-3 2.3-2.9.5-1.5 2.5-2 3.5-.8 1.4-.5 2.9.6 2.6 2.3"/>',

    /* Корона — кабинет, «моё». */
    crown: '<path d="M3.5 7.5 8 11.2 12 4.4l4 6.8 4.5-3.7-1.8 10.3H5.3Z"/>' +
           '<path d="M5.8 21h12.4"/>',

    /* Монета — народная база, «копилка сообщества». */
    coin: '<circle cx="12" cy="12" r="8.6"/>' +
          '<path d="m12 7.6 1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4Z"/>',

    /* Пергамент — добавить рецепт. */
    parchment: '<path d="M14 3.5H7.4A1.9 1.9 0 0 0 5.5 5.4v13.2a1.9 1.9 0 0 0 1.9 1.9h9.2' +
               'a1.9 1.9 0 0 0 1.9-1.9V8Z"/><path d="M14 3.5V8h4.9"/>' +
               '<path d="M8.6 12.6h6.8M8.6 16h4.6"/>',

    /* Перо — отзывы: текст, написанный рукой. */
    quill: '<path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.5V19h8.5Z"/>' +
           '<path d="M16 8 3.5 20.5"/><path d="M17.5 15H9"/>',

    /* Песочные часы — время готовки. */
    hourglass: '<path d="M5 22h14M5 2h14"/>' +
               '<path d="M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22"/>' +
               '<path d="M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/>',

    /* Блюдо под куполом — порции. */
    cloche: '<path d="M3.6 16.6h16.8"/><path d="M5 16.6a7 7 0 0 1 14 0"/>' +
            '<path d="M12 6.6V4.8"/><circle cx="12" cy="3.4" r="1.1"/>',

    /* Кубик — «что готовим наугад». */
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.6"/>' +
          '<circle cx="9" cy="9" r="1.2" fill="currentColor"/>' +
          '<circle cx="12" cy="12" r="1.2" fill="currentColor"/>' +
          '<circle cx="15" cy="15" r="1.2" fill="currentColor"/>',

    /* Плюс — «добавить». */
    plus: '<path d="M12 5.5v13M5.5 12h13"/>'
  };

  /* WHAT → WHICH.
     Emoji в разметке — это НЕ иконки, а текст: их вписывали в HTML и
     генерирует recipes-user.js. Здесь каждый такой символ меняется на
     ИКОНКУ ИЗ ОДНОГО НАБОРА, и строка «⏱ 40 мин» перестаёт выглядеть
     как бутерброд из трёх операционных систем.

     Сложность читается как лестница: щит («легко») → меч («средне») →
     огонь («сложно»). */
  var EMOJI_ICON = {
    '⏱': 'hourglass',
    '⏲': 'hourglass',
    '⌛': 'hourglass',
    '⏳': 'hourglass',
    '👥': 'cloche',
    '🍽': 'cloche',
    '🍲': 'cloche',
    '🥗': 'shield',
    '🥘': 'sword',
    '🍳': 'flame',
    '💡': 'flame',
    '🥤': 'mug',
    '🍸': 'mug',
    '🍺': 'mug',
    '🎲': 'dice',
    '➕': 'plus',
    '🌐': 'crest',
    '🎮': 'crest',
    '🥐': 'crest',
    '👤': 'crown'
  };

  /* Регулярка собирается из ключей таблицы, а не пишется руками:
     добавил emoji в таблицу — он заработал, искать его по файлу не нужно.
     \uFE0F — «вариационный выборщик», который браузеры подмешивают к
     некоторым символам; его тоже съедаем. */
  var EMOJI_KEYS = [];
  for (var key in EMOJI_ICON) {
    if (EMOJI_ICON.hasOwnProperty(key)) {
      EMOJI_KEYS.push(key);
    }
  }
  var EMOJI_RE = new RegExp('(' + EMOJI_KEYS.join('|') + ')\\uFE0F?', 'g');
  var EMOJI_TEST = new RegExp('(' + EMOJI_KEYS.join('|') + ')');

  /* ==========================================================================
     2. ГДЕ ЧТО ИЩЕМ
     ========================================================================== */

  /* Элементы, внутри которых emoji — это ИКОНКИ, а не часть шутки.
     Списки, карточки отзывов и текст посетителей в список НЕ входят:
     там emoji остаются как их написал человек. */
  var ICON_HOSTS = [
    '.section-title',
    '.page-title',
    '.recipe-title',
    '.reviews-title',
    '.form-title',
    '.btn',
    '.acct-btn',
    '.card-meta',
    '.recipe-meta',
    '.tip strong',
    '.tip-label'
  ];

  /* Отдельные строки «⏱ 40 мин • 👥 12 штук • 🥘 средне»: их разбираем
     на куски, чтобы каждый показатель встал в свой знак. */
  var META_HOSTS = ['.card-meta', '.recipe-meta'];

  /* Что проявляется при прокрутке. Крупная шапка и заголовок страницы
     не в списке: они и так на первом экране, прятать их бессмысленно. */
  var REVEAL = [
    '.lucky',
    '.community-links',
    '.community-tools',
    '.card',
    '.recipes .recipe',
    '.recipe-header',
    '.recipe-photo',
    '.ingredients',
    '.steps',
    '.tip',
    '.reviews',
    '.form',
    '.gate',
    '.toc',
    '.profile-info',
    '.mine-list',
    '.legend-stats',
    '.legend-ing',
    '.legend-step',
    '.empty-state'
  ];

  /* ==========================================================================
     3. МЕЛКИЕ ПОМОЩНИКИ
     ========================================================================== */

  /* Пройтись по узлам, удовлетворяющим селектору, внутри области. */
  function each(selector, fn, scope) {
    var root = scope || document;
    var list = root.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) {
      fn(list[i]);
    }
  }

  /* Создать svg-иконку по имени.
     Разметка берётся из константы ICONS, а НЕ из пользовательского
     текста, поэтому innerHTML здесь безопасен: ни ник, ни отзыв внутрь
     не попадает. */
  function icon(name) {
    var svg = ICONS[name];
    if (!svg) {
      return null;
    }
    var box = document.createElement('span');
    box.innerHTML = '<svg class="ico ico-' + name + '" viewBox="0 0 24 24" ' +
                    'aria-hidden="true" focusable="false">' + svg + '</svg>';
    return box.firstChild;
  }

  /* Фрагмент: текст, в котором известные emoji заменены иконками. */
  function withIcons(text) {
    var frag = document.createDocumentFragment();
    var last = 0;
    var match;

    EMOJI_RE.lastIndex = 0;
    while ((match = EMOJI_RE.exec(text)) !== null) {
      if (match.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      var svg = icon(EMOJI_ICON[match[1]]);
      if (svg) {
        frag.appendChild(svg);
      }
      last = match.index + match[0].length;
    }

    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    return frag;
  }

  /* ==========================================================================
     4. ЗАМЕНА EMOJI НА ИКОНКИ
     ========================================================================== */

  /* Замена идёт ПОСРЕДСТВОМ обхода текстовых узлов, а не перезаписью
     innerHTML: так разметка внутри элемента (сильные слова, ссылки)
     остаётся на месте, а не превращается в кашу. */
  function swapIcons(host) {
    if (host.dataset.tavernIco === '1') {
      return;
    }
    host.dataset.tavernIco = '1';

    if (!document.createTreeWalker) {
      return; /* древний браузер: оставляем emoji, это не поломка */
    }

    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (EMOJI_TEST.test(node.nodeValue)) {
        nodes.push(node);
      }
    }

    for (var i = 0; i < nodes.length; i++) {
      var parent = nodes[i].parentNode;
      if (parent) {
        parent.replaceChild(withIcons(nodes[i].nodeValue), nodes[i]);
      }
    }
  }

  /* Разобрать «⏱ 40 мин • 👥 12 штук • 🥘 средне» на отдельные знаки.
     Условие children.length === 0 — страховка: в «Мемасиках» у строки
     meta уже есть свои span-ы с классами рангов, и их ломать нельзя. */
  function rebuildMeta(host) {
    if (host.dataset.tavernMeta === '1' || host.children.length > 0) {
      return;
    }

    var text = (host.textContent || '').trim();
    if (text.indexOf('\u2022') === -1 || !EMOJI_TEST.test(text)) {
      return;
    }

    host.dataset.tavernMeta = '1';
    host.textContent = '';
    host.classList.add('meta-row');

    var parts = text.split('\u2022');
    for (var i = 0; i < parts.length; i++) {
      var piece = parts[i].trim();
      if (!piece) {
        continue;
      }
      var item = document.createElement('span');
      item.className = 'meta-item';
      item.appendChild(withIcons(piece));
      host.appendChild(item);
    }
  }

  /* Герб вместо emoji в логотипе.
     Отдельная функция, потому что в логотипе emoji ВСЕГДА один и он
     всегда в начале: «🍳 Дотерская харчевня». Если первая «сущность»
     оказалась словом (кириллица/латиница) — значит emoji нет, и мы
     ничего не трогаем. */
  function logoToCrest(host) {
    if (host.dataset.tavernIco === '1') {
      return;
    }
    host.dataset.tavernIco = '1';

    var first = host.firstChild;
    if (!first || first.nodeType !== 3) {
      return;
    }

    var match = /^\s*(\S+)\s*/.exec(first.nodeValue);
    if (!match || /[\u0400-\u04FFA-Za-z0-9]/.test(match[1])) {
      return;
    }

    var frag = document.createDocumentFragment();
    var svg = icon('crest');
    if (svg) {
      frag.appendChild(svg);
    }
    var rest = first.nodeValue.slice(match[0].length);
    if (rest) {
      frag.appendChild(document.createTextNode(rest));
    }
    host.replaceChild(frag, first);
  }

  /* ==========================================================================
      5. ДЕКОРАТИВНЫЕ СЛОИ: ШАПКА И СТЕНЫ
      ========================================================================== */

  /* Вставляем один блок-вуаль: герб качается, угли поднимаются, дым
     бродит, по углам тянется паутина. aria-hidden — для программы чтения
     с экрана этого блока не существует: decorative, не контент. */
  function addVeil(host) {
    if (host.querySelector('.tavern-veil')) {
      return;
    }
    var veil = document.createElement('span');
    veil.className = 'tavern-veil';
    veil.setAttribute('aria-hidden', 'true');
    veil.innerHTML = '<i class="tavern-crest"></i>' +
                     '<i class="tavern-embers"></i>' +
                     '<i class="tavern-smoke"></i>' +
                     '<i class="tavern-web tavern-web-left"></i>' +
                     '<i class="tavern-web tavern-web-right"></i>';
    host.insertBefore(veil, host.firstChild);
  }

  /* Стены зала: два факела, две цепи и паутина в нижних углах окна.
     Один блок на всю страницу, неподвижный (position: fixed в CSS), —
     поэтому при прокрутке свет остаётся на месте, а карточки едут
     сквозь него: эффект «зашёл в комнату», а не «фон уехал».

     Слой вставляется ОДИН раз и ДО того, как заработал MutationObserver
     (см. start): иначе наблюдатель увидел бы нашу собственную вставку,
     вызвал бы enhance, а тот вставил бы слой ещё раз. */
  function addHall() {
    if (document.querySelector('.tavern-hall')) {
      return;
    }
    var hall = document.createElement('div');
    hall.className = 'tavern-hall';
    hall.setAttribute('aria-hidden', 'true');
    hall.innerHTML =
      '<i class="hall-torch hall-torch-left"></i>' +
      '<i class="hall-torch hall-torch-right"></i>' +
      '<i class="hall-chain hall-chain-left"></i>' +
      '<i class="hall-chain hall-chain-right"></i>' +
      '<i class="hall-web hall-web-left"></i>' +
      '<i class="hall-web hall-web-right"></i>';
    document.body.insertBefore(hall, document.body.firstChild);
  }

  /* ==========================================================================
     6. ПОЯВЛЕНИЕ ПРИ ПРОКРУТКЕ
     ========================================================================== */

  var observer = null;

  /* Задержка «по одному, а не все разом»: элемент считает себя по
     соседям слева, которые тоже проявляются. Разброс в 70 мс на
     соседа — карточки идут волной, а не мигают табло. */
  function markReveal(el) {
    if (el.classList.contains('tavern-reveal')) {
      return;
    }

    var index = 0;
    var sibling = el.previousElementSibling;
    while (sibling) {
      if (sibling.classList.contains('tavern-reveal')) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    var delay = (index % 6) * 70;
    el.style.setProperty('--tavern-delay', delay + 'ms');
    el.classList.add('tavern-reveal');
    observer.observe(el);
  }

  /* После появления классы снимаем.
     Зачем: у карточки свои transition в файле темы, а «проявочное»
     правило переписывает их целиком. Снял класс — карточка вернулась
     к обычным правилам, и наведение снова работает как задумано. */
  function reveal(el, delay) {
    observer.unobserve(el);
    el.classList.add('tavern-in');
    window.setTimeout(function () {
      el.classList.remove('tavern-reveal', 'tavern-in');
      el.style.removeProperty('--tavern-delay');
    }, 900 + delay);
  }

  function initObserver() {
    if (!('IntersectionObserver' in window)) {
      return; /* нет наблюдателя — не вешаем и скрытие: всё видно */
    }

    observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) {
          continue;
        }
        var el = entries[i].target;
        var raw = el.style.getPropertyValue('--tavern-delay');
        var delay = parseInt(raw, 10) || 0;
        reveal(el, delay);
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  }

  /* Страховка: что-то не дождалось наблюдателя (блок ниже подвала,
     странная высота, ошибка в другом скрипте) — через 4 секунды
     показываем всё. Плохо, когда красивость съедает контент. */
  function revealAll() {
    each('.tavern-reveal', function (el) {
      if (!el.classList.contains('tavern-in')) {
        reveal(el, 0);
      }
    });
  }

  /* ==========================================================================
     7. ОБХОД: ОДИН ВХОД ДЛЯ ПЕРВОЙ СТРАНИЦЫ И ДЛЯ ДОРОИСОВАННОГО
     ==========================================================================
     Отзывы, народная база и «Мемасики» дорисовываются ПОСЛЕ загрузки.
     Чтобы их карточки тоже получали иконки и проявление, за изменениями
     DOM следит MutationObserver. Он же обязан «закрывать уши» на время
     наших собственных вставок — иначе наблюдатель вызывал бы сам себя
     по кругу. */

  var mutator = null;
  var WATCH = { childList: true, subtree: true };

  function enhance(root) {
    var scope = (root && root.querySelectorAll) ? root : document;

    each('.logo', logoToCrest, scope);
    each('.header, .section-head', addVeil, scope);
    each('.card-meta, .recipe-meta', rebuildMeta, scope);

    for (var i = 0; i < ICON_HOSTS.length; i++) {
      each(ICON_HOSTS[i], swapIcons, scope);
    }

    if (!REDUCED && observer) {
      for (var k = 0; k < REVEAL.length; k++) {
        each(REVEAL[k], markReveal, scope);
      }
    }

    /* Если корнем обхода оказался сам блок-шапка — проверить и его. */
    if (root && root.nodeType === 1 && root.matches) {
      if (root.matches('.logo')) {
        logoToCrest(root);
      }
      if (root.matches('.header, .section-head')) {
        addVeil(root);
      }
      if (root.matches('.card-meta, .recipe-meta')) {
        rebuildMeta(root);
      }
    }
  }



  function pausedEnhance(root) {
    if (mutator) {
      mutator.disconnect();
    }
    try {
      enhance(root);
    } finally {
      if (mutator && document.body) {
        mutator.observe(document.body, WATCH);
      }
    }
  }

  function start() {
    if (!document.body) {
      return;
    }

    /* Стены вставляются ПЕРВЫМИ, до наблюдателя: блок добавляется один
       раз на страницу, и нам важно, чтобы наша собственная вставка не
       попала в отчёт MutationObserver. */
    addHall();

    if ('MutationObserver' in window) {
      mutator = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var added = records[i].addedNodes;
          for (var k = 0; k < added.length; k++) {
            if (added[k].nodeType === 1) {
              pausedEnhance(added[k]);
            }
          }
        }
      });
    }

    if (!REDUCED) {
      initObserver();
    }

    enhance(document);

    if (mutator) {
      mutator.observe(document.body, WATCH);
    }

    window.setTimeout(revealAll, 4000);
  }

  /* defer-скрипты выполняются до DOMContentLoaded, но отзывы и рецепты
     рисуются именно на этом событии. Значит свой обход декор запускает
     ПОСЛЕ них: порядок подписок = порядок выполнения. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  /* Наружу ничего не отдаём: у декора нет публичного API, и правильно
     делает — трогать его из бизнес-логики некому и незачем. */
  return { name: 'Decor' };
})();
