/* ==========================================================================
   notice.js — ОКНО РЕГЛАМЕНТА ПРИ ВХОДЕ + ПЛАШКА ПРО ХРАНИЛИЩЕ

   ЗАДАЧА. Человек заходит на сайт впервые — сверху появляется окно с
   правилами. Ниже — плашка про хранилище («куки-бар»). Обе закрываются,
   и обе помнят, что человек их уже видел.

   ПОЧЕМУ ВЁРСТКА ЗДЕСЬ НА JS, А НЕ В HTML.
   Окно нужно на ВСЕХ тринадцати страницах сайта. Вписать его руками в
   каждый HTML — значит однажды поменять текст в восьми из тринадцати и
   получить три версии правил. Здесь в HTML только одна строка
   <script src="notice.js">, а окно собирает сам скрипт — один файл,
   один текст, одна точка правки.

   КЛЮЧИ В ХРАНИЛИЩЕ И ОДНА ВАЖНАЯ РАЗНИЦА.
     dh:rules   в localStorage — «согласен навсегда». Пережил закрытие
                браузера, окно больше не появляется.
     dh:cookies в localStorage — плашку закрыл, больше не показывать.
     dh:rules-later в sessionStorage — «посмотрю позже». Это ДРУГОЕ
                хранилище: живёт, пока открыта вкладка. Закрыл вкладку —
                ключ стёрся — при следующем заходе окно вылезет снова.
                Именно это и нужно для кнопки «Позже»: человек не
                согласился, врать про его согласие мы не будем.

   ПОЧЕМУ «УШЛА САМА» ≠ «СОГЛАСИЛСЯ».
   Плашка через 30 секунд убирается сама, если человек её проигнорировал.
   Но ключ при ЭТОМ не записывается: молчание — не согласие. Значит на
   следующем визите плашка появится снова. Честная формулировка, и на
   защите её легко объяснить.

   ЗАВИСИМОСТИ. Работает и с Store, и без него: в разделе «Пампасики»
   свой набор скриптов. Если Store подключён (все страницы корня и
   «Мемасики»), читаем через него — там уже есть try/catch на случай
   приватного режима. Если нет — своя страховка ниже, в read()/write().
   ========================================================================== */

var Notice = {

  /* Ключи. Приставка dh: общая для сайта — так записи этого проекта не
     сталкиваются с чужими на том же адресе. Учти: file:// и GitHub Pages
     считаются разными сайтами, хранилища там будут разные. */
  KEY_RULES: 'rules',
  KEY_COOKIES: 'cookies',
  KEY_LATER: 'rules-later',
  PREFIX: 'dh:',

  /* Через сколько секунд плашка убирается сама. */
  AUTO_HIDE_MS: 30000,

  /* ------------------------------------------------------------
     ЧТЕНИЕ/ЗАПИСЬ С СТРАХОВКОЙ.
     Если Store на странице есть — идём через него, не повторяя код.
     Если нет (раздел «Пампасики») — читаем localStorage сами, но
     обязательно под try/catch: в приватном режиме Firefox обращение к
     window.localStorage бросает исключение, и без обёртки упало бы
     всё окно.
     ------------------------------------------------------------ */
  read: function (key, fallback) {
    if (typeof Store !== 'undefined') {
      return Store.read(key, fallback);
    }
    try {
      var raw = window.localStorage.getItem(Notice.PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  write: function (key, value) {
    if (typeof Store !== 'undefined') {
      return Store.write(key, value);
    }
    try {
      window.localStorage.setItem(Notice.PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },

  /* sessionStorage — хранилище ОДНОЙ вкладки. Своего обёрточного
     модуля у него нет, поэтому короткий try/catch прямо здесь. */
  sessionGet: function (key) {
    try {
      return window.sessionStorage.getItem(Notice.PREFIX + key);
    } catch (e) {
      return null;
    }
  },

  sessionSet: function (key, value) {
    try {
      window.sessionStorage.setItem(Notice.PREFIX + key, value);
    } catch (e) {
      /* нет хранилища — просто покажем окно в следующий заход */
    }
  },

  sessionClear: function (key) {
    try {
      window.sessionStorage.removeItem(Notice.PREFIX + key);
    } catch (e) {
      /* нечего удалять */
    }
  },

  /* ------------------------------------------------------------
     ТЕКСТ ПРАВИЛ.
     Лежит в JS, а не в HTML, по той же причине, что и само окно:
     одна копия на все страницы.

     СОДЕРЖАНИЕ ЧЕСТНОЕ. Здесь написано ровно то, что сайт делает на
     самом деле: никакого сервера нет, пароль проверяется в браузере,
     модереации нет, всё живёт в браузере посетителя. Писать
     «мы не сохраняем ваши данные», когда сохраняем, — прямая ложь
     человеку, который пришёл на сайт.
     ------------------------------------------------------------ */
  RULES: [
    {
      title: '1. Что это за сайт',
      items: [
        'Сайт рецептов: еда, мемы и Dota 2. Не магазин, не СМИ, ' +
          'ничего не продаём, заказы не принимаем, рекламу не размещаем.',
        'Рецепты — авторские и пользовательские. Проверены «на себе», ' +
          'а не технологом: пропорции и время смело правь под свою плиту ' +
          'и свою духовку.'
      ]
    },
    {
      title: '2. Возраст',
      items: [
        'Раздел «Мемасики» содержит коктейли с алкоголем — они под ' +
          'меткой 18+ и скрыты возрастной проверкой. Ответ «мне ' +
          'меньше 18» убирает такой контент со страницы целиком.',
        'Метки 12+ — это подсказка про острое и кофеин, а не запрет.',
        'Ответ о возрасте хранится в браузере. Сменил устройство или ' +
          'почистил данные сайта — спросим заново, обмануть проверку ' +
          'технически можно, и мы об этом честно предупреждаем.'
      ]
    },
    {
      title: '3. Еда и безопасность',
      items: [
        'Ты готовишь сам и отвечаешь за это сам: сырая курица, ' +
          'просроченные продукты и «на глаз» — твои риски, не сайта.',
        'Аллергены в рецептах не размечены. Орехи, молоко, глютен, ' +
          'яйца, грибы ищешь в списке ингредиентов ты, а не мы.',
        'Алкоголь — не еда. Беременность, лекарства, вождение и ' +
          'несовершеннолетие означают «не пить», а не «попробовать ' +
          'мало».'
      ]
    },
    {
      title: '4. Аккаунт: как он устроен на самом деле',
      items: [
        'Сервера нет: аккаунт создаётся в твоём браузере. Пароль в открытом ' +
          'виде не хранится нигде, но и серьёзной защитой не закрыт — весь ' +
          'расчёт идёт локально.',
        'Не бери пароль, который вводишь на почте, в банке или в игре. ' +
          'Здесь его не украдут, но и под замком он не лежит.',
        'Полноценная защита пароля бывает только на сервере: bcrypt или ' +
          'argon2, https, сессия. Пока сервера нет, мы не делаем вид, что ' +
          'она есть.'
      ]
    },
    {
      title: '5. Твои данные и где они лежат',
      items: [
        'Логин, ник, отзывы и твои рецепты записываются в localStorage ' +
          'этого браузера. Это значит: их видишь только ты, никто ' +
          'другой на сайте их не прочитает и на сервер не улетит.',
        'Второй минус тот же: чистка данных сайта или другой браузер — ' +
          'аккаунт и рецепты исчезнут безвозвратно.',
        'Не пиши в отзывах и рецептах телефон, адрес, школу, фамилии и ' +
          'ссылки на соцсети. После сохранения это лежит в браузере и ' +
          'удаляется только вручную.'
      ]
    },
    {
      title: '6. Чужое и запрещённое',
      items: [
        'Не выкладывай чужие фото и чужие рецепты без разрешения ' +
          'автора. Фото человека без его согласия — самая частая ' +
          'претензия, и она не про мемы.',
        'Оскорбления, спам, политика и реклама в отзывах и рецептах не ' +
          'нужны. Модератора в реальном времени здесь нет: ' +
          'ответственность за текст целиком на авторе записи.'
      ]
    },
    {
      title: '7. Что делает сайт технически',
      items: [
        'Cookie-файлов сайт НЕ ставит: ни своих, ни сторонних, ни ' +
          'счётчиков посещений. Плашку внизу про это просят показать ' +
          'для порядка, а не потому, что мы что-то собираем.',
        'Всё, что сохраняется, лежит в localStorage браузера. Отключишь ' +
          'хранилище — сайт продолжит работать, просто ничего не ' +
          'запомнит: ни аккаунт, ни возраст, ни закрытые плашки.'
      ]
    }
  ],

  /* ------------------------------------------------------------
     КИРПИЧИК. el() есть в ui.js, но ui.js подключён не везде
     (в «Пампасиках» его нет), поэтому короткий свой вариант.
     textContent, а не innerHTML: весь текст окна набором не
     подмешивается в разметку.
     ------------------------------------------------------------ */
  el: function (tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  },

  /* ============================================================
     ОКНО РЕГЛАМЕНТА
     ============================================================ */

  /* Открыть окно вручную. Вызывается из ссылки в подвале и из
     консоли (Notice.open()) — удобно, когда нужно показать окно
     повторно, не чистя хранилище. */
  open: function () {
    /* Если окно уже на странице — не плодим второе. Без этой проверки
       двойной клик по ссылке поставил бы два затемнения друг на друга,
       и «Принять» убрало бы только верхнее. */
    if (document.querySelector('.notice-overlay')) {
      return;
    }

    var rules = this;
    /* Куда вернуть фокус после закрытия. Без этого фокус провалился бы
     в начало страницы, и человек с клавиатуры потерял бы, где он был. */
    var opener = document.activeElement;

    var overlay = this.el('div', 'notice-root notice-overlay');

    var modal = this.el('div', 'notice-modal');
    modal.setAttribute('role', 'dialog');
    /* dialog + aria-modal = программа чтения с экрана объявит окно и
       скажет, что оно модальное. Сам по себе aria-modal НИЧЕГО не
       блокирует: ловушку для фокуса делает JS ниже. */
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'notice-title');

    /* --- шапка --- */
    var head = this.el('div', 'notice-head');
    var titles = this.el('div');
    var h2 = this.el('h2', null, 'Регламент сайта');
    h2.id = 'notice-title';
    /* id нужен именно для aria-labelledby: связывает окно с заголовком. */
    titles.appendChild(h2);
    titles.appendChild(this.el('p', null,
                               'Дотерская харчевня · прочитать один раз, ' +
                               'согласие хранится в браузере'));
    head.appendChild(titles);

    var close = this.el('button', 'notice-close', '\u00D7');
    /* Символ умножения × — не буква: программа чтения с экрана
       прочитает его как «умножить», поэтому обязательна текстовая
       подпись aria-label. */
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть, прочитать позже');
    head.appendChild(close);
    modal.appendChild(head);

    /* --- середина: правила --- */
    var body = this.el('div', 'notice-body');
    body.tabIndex = 0;
    /* tabIndex = 0 делает блок прокручиваемым с клавиатуры: без него
       полоса прокрутки есть, а стрелками она не двигается. */

    for (var i = 0; i < this.RULES.length; i++) {
      var block = this.RULES[i];
      body.appendChild(this.el('h3', null, block.title));
      var list = this.el('ul');
      for (var j = 0; j < block.items.length; j++) {
        list.appendChild(this.el('li', null, block.items[j]));
      }
      body.appendChild(list);
    }

    body.appendChild(this.el('p', 'notice-note',
      'Кнопка «Принять» — это не юридическая подпись, а отметка в ' +
      'твоём браузере: ключ dh:rules. Удалишь данные сайта — окно ' +
      'появится снова.'));
    modal.appendChild(body);

    /* --- кнопки --- */
    var foot = this.el('div', 'notice-foot');

    var later = this.el('button', 'notice-btn notice-btn-ghost',
                        'Прочитаю позже');
    later.type = 'button';
    var accept = this.el('button', 'notice-btn notice-btn-primary',
                         'Понятно, принимаю');
    accept.type = 'button';
    foot.appendChild(later);
    foot.appendChild(accept);
    modal.appendChild(foot);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.classList.add('notice-open');
    accept.focus();

    /* --- что делает каждая кнопка --- */

    accept.addEventListener('click', function () {
      /* Записываем метку навсегда: localStorage переживает закрытие
         браузера. Дата нужна не для красоты — по ней видно, когда
         человек соглашался с THIS версией правил. Правила меняются,
         отметка пятилетней давности про них ничего не знает. */
      rules.write(rules.KEY_RULES, { accepted: true, at: Date.now() });
      rules.sessionClear(rules.KEY_LATER);
      rules.close(overlay, opener);
    });

    var postpone = function () {
      /* «Позже» = НЕ согласие. В localStorage ничего не пишем,
         только sessionStorage: до закрытия вкладки окно не мешается,
         на следующем заходе появится снова. */
      rules.sessionSet(rules.KEY_LATER, String(Date.now()));
      rules.close(overlay, opener);
    };

    later.addEventListener('click', postpone);

    close.addEventListener('click', postpone);

    /* Клик по затемнению — то же самое, что «Позже». Но проверять надо
       именно overlay, а не «любой клик»: modal лежит ВНУТРИ overlay,
       и без проверки клик по тексту правил тоже закрыл бы окно. */
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        postpone();
      }
    });

    /* Escape. Слушаем на overlay, а не на document: фокус стоит на
       кнопке ВНУТРИ окна, и keydown всплывает до затемнения. Плюс
       обработчик живёт вместе с окном — закрыли окно, и слушателя нет,
       а глобальный висел бы на странице вечно. */
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        postpone();
      }
      /* Ловушка фокуса: Tab по кругу внутри окна. Иначе фокус уйдёт на
       кнопки страницы ЗА затемнением, и человек с клавиатуры будет
       нажимать на то, чего не видит. */
      if (event.key === 'Tab') {
        rules.keepFocusInside(event, modal);
      }
    });
  },

  /* Tab по кругу: после последней кнопки фокус возвращается на первую. */
  keepFocusInside: function (event, modal) {
    var focusable = modal.querySelectorAll('button, [tabindex="0"]');
    if (!focusable.length) {
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  },

  /* Снять окно и вернуть странице нормальную прокрутку и фокус. */
  close: function (overlay, opener) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    document.body.classList.remove('notice-open');

    if (opener && typeof opener.focus === 'function') {
      opener.focus();
    }

    /* Регламент закрыли — теперь можно показать плашку. Порядок важен:
       две плашки поверх друг друга выглядят как баг. */
    Notice.showCookies();
  },

  /* ============================================================
     ПЛАШКА ПРО ХРАНИЛИЩЕ («cookie-бар»)
     ============================================================ */

  showCookies: function () {
    var saved = this.read(this.KEY_COOKIES, null);
    if (saved && saved.ok) {
      /* Уже закрывали — не мешаем второй раз. */
      return;
    }
    if (document.querySelector('.notice-cookie')) {
      return;
    }
    /* Пока открыт регламент, плашку не показываем: дождёмся close(). */
    if (document.querySelector('.notice-overlay')) {
      return;
    }

    var bar = this.el('div', 'notice-root notice-cookie');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'О хранении данных');

    bar.appendChild(this.el('p', null,
      '🍪 Cookie-файлов этот сайт не ставит. Логин, отзывы, твои ' +
      'рецепты и отметка о возрасте лежат в localStorage твоего ' +
      'браузера: их не видит никто, кроме тебя, и они исчезают при ' +
      'чистке данных сайта.'));

    var about = this.el('button', 'notice-cookie-link',
                        'Почитать правила');
    about.type = 'button';
    about.addEventListener('click', function () {
      Notice.open();
    });
    bar.appendChild(about);

    var ok = this.el('button', 'notice-btn notice-btn-primary', 'Понятно');
    ok.type = 'button';
    bar.appendChild(ok);

    document.body.appendChild(bar);

    var hide = function () {
      /* Класс is-out даёт анимацию, сам блок убираем по таймеру.
         400 мс совпадают с длительностью transition в notice.css:
         цифры живут в двух разных файлах и могут однажды разъехаться —
         тогда плашка исчезнет раньше, чем доедет. Правильное решение
         тут — читать длительность из computed style, но для одной
         плашки это перебор, поэтому держим цифры в голове и
         упоминаем в комментарии. */
      bar.classList.add('is-out');
      window.setTimeout(function () {
        if (bar.parentNode) {
          bar.parentNode.removeChild(bar);
        }
      }, 400);
    };

    ok.addEventListener('click', function () {
      /* Записываем метку навсегда — плашка больше не появится. */
      Notice.write(Notice.KEY_COOKIES, { ok: true, at: Date.now() });
      hide();
    });

    /* Автоскрытие. ЧЕЛОВЕК МОЛЧИТ — НЕ ЗНАЧИТ СОГЛАСЕН, поэтому ключ
       НЕ пишем: через полчаса в той же вкладке или на следующем заходе
       плашка появится снова. */
    window.setTimeout(function () {
      if (bar.parentNode) {
        hide();
      }
    }, Notice.AUTO_HIDE_MS);
  },

  /* ============================================================
     ССЫЛКА «РЕГЛАМЕНТ» В ПОДВАЛЕ
     Согласие дали один раз, окно больше не показывается — значит
     способ открыть правила должен быть всегда.
     ============================================================ */
  addFooterLink: function () {
    var footer = document.querySelector('.footer');
    if (!footer || footer.querySelector('.notice-footer-link')) {
      return;
    }
    var link = this.el('button', 'notice-footer-link',
                       '📜 Регламент сайта');
    link.type = 'button';
    link.addEventListener('click', function () {
      Notice.open();
    });
    footer.appendChild(link);
  },

  /* ------------------------------------------------------------
      СБРОС СОГЛАСИЙ.
      Нужен, чтобы показать окно повторно с чистого листа: открыть консоль
      (F12), написать Notice.reset(), обновить страницу. Иначе придётся
      вручную искать, где в браузере чистят данные сайта.
     ------------------------------------------------------------ */
  reset: function () {
    if (typeof Store !== 'undefined') {
      Store.remove(this.KEY_RULES);
      Store.remove(this.KEY_COOKIES);
    } else {
      this.removeLocal(this.KEY_RULES);
      this.removeLocal(this.KEY_COOKIES);
    }
    this.sessionClear(this.KEY_LATER);
    return 'согласия стёрты, обнови страницу';
  },

  removeLocal: function (key) {
    try {
      window.localStorage.removeItem(this.PREFIX + key);
    } catch (e) {
      /* нет хранилища */
    }
  },

  /* ============================================================
     ЗАПУСК
     ============================================================ */
  start: function () {
    this.addFooterLink();

    var accepted = this.read(this.KEY_RULES, null);
    var postponed = this.sessionGet(this.KEY_LATER);

    if (accepted && accepted.accepted) {
      /* Согласовался раньше — окна не показываем, но плашку про
         хранилище всё равно надо предложить, если не закрывал. */
      this.showCookies();
      return;
    }
    if (postponed) {
      /* Нажал «Позже» в этой вкладке — не пристаём до новой сессии. */
      this.showCookies();
      return;
    }
    this.open();
  }
};

/* Запуск после того, как страница построена. defer гарантирует, что
   DOM готов, но подписка на DOMContentLoaded оставлена как страховка
   на случай, если файл подключат без defer. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    Notice.start();
  });
} else {
  Notice.start();
}
