/* ==========================================================================
   auth.js — АККАУНТЫ ПОЛЬЗОВАТЕЛЕЙ

   Что здесь есть:
     регистрация         — создать пользователя (логин + ник + пароль)
     вход / выход        — «сейчас на сайте вот этот человек»
     проверка прав       — «этот отзыв/рецепт оставил текущий пользователь?»
     панелька вверху     — видна на всех страницах: кто я и что мне доступно
     страница «Кабинет»  — формы входа/регистрации и список своего добра

   ГЛАВНОЕ, ЧТО НАДО ПОНЯТЬ ПРО СТАТИЧЕСКИЙ САЙТ.
   Сервера нет, значит:
     · «пользователь» — запись в localStorage ЕГО браузера;
     · пароль проверяется тоже в браузере, а не «где-то на сервере»;
     · другой человек на другом компьютере этого аккаунта не увидит.
   Это версия без сервера. Полноценная регистрация устроена так: форма
   уходит на сервер fetch'ом, сервер сравнивает хэш в СВОЕЙ базе и отвечает
   браузеру кукой-сессией. Структура кода ниже к этому готова: весь
   ввод собирается в одном месте (register/login), так что потом
   достаточно заменить тело этих двух функций на запрос к серверу.

   ЗАВИСИМОСТИ: store.js (хранение) и ui.js (кирпичи для DOM).
   ========================================================================== */

/* Ссылка-кнопочка для панельки и профиля. Одинаковых ссылок больше
   двух штук, поэтому одна функция, а не копия в каждом месте.
   Объявлена как function, а не как var: такие функции «всплывают»
   (hoisting) и доступны из кода, который написан выше. */
function barLink(text, href) {
  var link = Ui.el('a', 'acct-btn', text);
  link.href = href;
  return link;
}

var Auth = {

  USERS_KEY: 'users',   /* массив всех пользователей */
  SESSION_KEY: 'session', /* id того, кто сейчас «в окне» */

  /* Правила-константы. Держать их в одном месте значит не спорить
     потом «а где я писал, что пароль от шести символов». */
  MIN_LOGIN: 3,
  MAX_LOGIN: 20,
  MIN_NICK: 2,
  MAX_NICK: 24,
  MIN_PASS: 6,

  /* Подписчики на «что-то изменилось». Нужны, потому что после входа
     должна перерисоваться НЕ только панелька, но и форма отзыва ниже
     по странице. Вместо того чтобы тащить ссылки друг на друга,
      страницы сами говорят: «Auth, подпишись на меня и перерисуй». */
  _subscribers: [],

  subscribe: function (callback) {
    if (typeof callback === 'function') {
      Auth._subscribers.push(callback);
    }
  },

  notify: function () {
    for (var i = 0; i < Auth._subscribers.length; i++) {
      /* try/catch: если один из подписчиков упадёт, остальные
         всё равно отработают. Иначе одна ошибка в отзывах сломала бы
         и панельку, и кабинет. */
      try {
        Auth._subscribers[i]();
      } catch (e) {
        /* тихо: консоль всё покажет */
      }
    }
  },

  /* ==========================================================================
     1. ЧТЕНИЕ БАЗЫ
     ========================================================================== */

  /* Все пользователи. Первый заход — пустой массив вместо undefined,
     иначе .length на undefined уронил бы страницу. */
  all: function () {
    return Store.read(Auth.USERS_KEY, []) || [];
  },

  save: function (users) {
    return Store.write(Auth.USERS_KEY, users);
  },

  findByLogin: function (login) {
    var lower = String(login || '').toLowerCase();
    var users = Auth.all();
    for (var i = 0; i < users.length; i++) {
      if (users[i].login === lower) {
        return users[i];
      }
    }
    return null;
  },

  findById: function (id) {
    var users = Auth.all();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) {
        return users[i];
      }
    }
    return null;
  },

  /* Текущий пользователь или null.
     Сессия хранит только id, НЕ сам объект: пользователь мог быть
     удалён или переименован, и каждый раз берём свежие данные. */
  user: function () {
    var id = Store.read(Auth.SESSION_KEY, null);
    if (!id) {
      return null;
    }
    return Auth.findById(id);
  },

  isLogged: function () {
    return Auth.user() !== null;
  },

  /* ==========================================================================
     2. ПРОВЕРКА ВВОДА
     ========================================================================== */

  /* Логин — техническое имя: только латиница, цифры, _ и -.
     Регулярное выражение читается так: с начала (^) до конца ($)
     идут одни разрешённые символы (+ = один или больше).
     i в конце — регистр не важен.
     Кириллица в логине запрещена не из вредности: 'с' латинская и
     'с' кириллическая выглядят одинаково, и появляется возможность
     подделать чужое имя. */
  LOGIN_RE: /^[a-z0-9_-]+$/i,

  validateRegister: function (login, nick, pass, pass2) {
    if (login.length < Auth.MIN_LOGIN) {
      return 'Логин короче ' + Auth.MIN_LOGIN + ' символов — займут до тебя.';
    }
    if (login.length > Auth.MAX_LOGIN) {
      return 'Логин длиннее ' + Auth.MAX_LOGIN + ' символов — не запомнят.';
    }
    if (!Auth.LOGIN_RE.test(login)) {
      return 'В логине только латиница, цифры, дефис и подчёркивание.';
    }
    if (nick.length < Auth.MIN_NICK) {
      return 'Ник должен быть виден: минимум ' + Auth.MIN_NICK + ' символа.';
    }
    if (nick.length > Auth.MAX_NICK) {
      return 'Ник длиннее ' + Auth.MAX_NICK + ' символов — сломает вёрстку карточек.';
    }
    if (pass.length < Auth.MIN_PASS) {
      return 'Пароль короче ' + Auth.MIN_PASS + ' символов — не пароль, а приглашение.';
    }
    if (pass !== pass2) {
      return 'Пароли в двух полях не совпали.';
    }
    if (Auth.findByLogin(login)) {
      return 'Логин «' + login + '» уже занят.';
    }
    return '';
  },

  /* ==========================================================================
     3. РЕГИСТРАЦИЯ И ВХОД
     ========================================================================== */

  register: function (login, nick, pass, pass2) {
    var error = Auth.validateRegister(login, nick, pass, pass2);
    if (error) {
      return { ok: false, error: error };
    }

    var salt = Store.salt();
    var user = {
      id: Store.uid('user'),
      login: login.toLowerCase(),
      nick: nick,
      /* Храним ТОЛЬКО хэш с солью. Самого пароля в базе нет и быть
         не может — см. большое пояснение в store.js. */
      salt: salt,
      passHash: Store.hash(salt + ':' + login.toLowerCase() + ':' + pass),
      createdAt: Date.now()
    };

    var users = Auth.all();
    users.push(user);

    if (!Auth.save(users)) {
      return { ok: false, error: 'Браузер отказался сохранять данные (переполнен или запрещён).' };
    }

    /* Зарегистрировались — сразу заходим, второй раз вводить пароль
       незачем. */
    Store.write(Auth.SESSION_KEY, user.id);
    Auth.notify();

    return { ok: true, user: user };
  },

  login: function (login, pass) {
    var user = Auth.findByLogin(login);

    /* Сообщение «нет такого логина» или «неверный пароль» — это дыра:
       по нему подбирают существующие аккаунты. Правильный ответ
       всегда одинаковый. Здесь то же правило. */
    if (!user) {
      return { ok: false, error: 'Логин или пароль не подходят.' };
    }

    var hash = Store.hash(user.salt + ':' + user.login + ':' + pass);
    if (hash !== user.passHash) {
      return { ok: false, error: 'Логин или пароль не подходят.' };
    }

    Store.write(Auth.SESSION_KEY, user.id);
    Auth.notify();
    return { ok: true, user: user };
  },

  logout: function () {
    Store.remove(Auth.SESSION_KEY);
    Auth.notify();
  },

   /* Удалить аккаунт вместе с его отзывами и рецептами.
      window.Reviews / window.UserRecipes проверяются на существование:
      на странице «Кабинет» эти файлы могут быть не подключены, а
      обращение к undefined — красная ошибка в консоли. */
  dropAccount: function () {
    var current = Auth.user();
    if (!current) {
      return false;
    }
    if (window.Reviews) {
      window.Reviews.dropAuthor(current.id);
    }
    if (window.UserRecipes) {
      window.UserRecipes.dropAuthor(current.id);
    }
    var users = Auth.all().filter(function (u) {
      return u.id !== current.id;
    });
    Auth.save(users);
    Auth.logout();
    return true;
  },

  /* ПРОВЕРКА ПРАВА НА ЗАПИСЬ.
     Единая точка: «можно ли этому человеку править запись».
     Авторство определяется по id, а НЕ по нику — ник человек
     может сменить, а id нет. */
  owns: function (record) {
    var current = Auth.user();
    return !!(current && record && record.authorId === current.id);
  },

  /* ==========================================================================
     4. ПАНЕЛЬКА ВВЕРХУ СТРАНИЦЫ
     ==========================================================================
     Есть на всех страницах, где подключён auth.js и в HTML стоит
     <div id="account-bar"></div>. Панелька рисуется кодом, а не
     вписывается руками: состояние «вошёл/не вошёл» известно только
     в рантайме, а дублировать два варианта HTML на шести страницах —
     способ однажды забыть обновить две из них. */

  renderBar: function () {
    var slot = document.querySelector('#account-bar');
    if (!slot) {
      return;
    }
    Ui.clear(slot);

    var bar = Ui.el('div', 'acct');
    var current = Auth.user();

    if (current) {
      /* Счётчик своих рецептов считаем ОДИН раз в переменную.
         Вызвать byAuthor() дважды — значит дважды прочитать и
         отфильтровать весь массив; а если модуль рецептов на этой
         странице не подключён, второй вызов ещё и упал бы. */
      var mine = window.UserRecipes ? window.UserRecipes.byAuthor(current.id).length : 0;

      var hi = Ui.el('span', 'acct-hi');
      hi.appendChild(Ui.el('span', 'acct-nick', current.nick));
      hi.appendChild(Ui.el('span', 'acct-note',
        mine === 0 ? 'своих рецептов пока нет' : 'своих рецептов: ' + mine));
      bar.appendChild(hi);

      bar.appendChild(barLink('👤 Кабинет', 'account.html'));
      bar.appendChild(barLink('➕ Добавить рецепт', 'add-recipe.html'));
      bar.appendChild(barLink('🌐 Народная база', 'community.html'));

      var out = Ui.el('button', 'acct-btn acct-btn-out', 'Выйти');
      out.type = 'button';
      out.addEventListener('click', function () {
        Auth.logout();
      });
      bar.appendChild(out);
    } else {
      var hint = Ui.el('span', 'acct-note',
        'Без аккаунта можно читать. Писать отзывы и добавлять рецепты — нет.');
      bar.appendChild(hint);
      bar.appendChild(barLink('Войти', 'account.html#login'));
      bar.appendChild(barLink('Регистрация', 'account.html#register'));
    }

    slot.appendChild(bar);
  },

  /* ==========================================================================
     5. СТРАНИЦА «КАБИНЕТ»
     ==========================================================================
     Работает на account.html. Два блока в HTML переключаются по факту
     входа: #guest (формы) и #profile (что у человека есть).
     Формы размечены тегами в HTML, JS только читает поля и отвечает
     текстом в #login-msg, #reg-msg и #page-msg. */

  renderPage: function () {
    var page = document.querySelector('#account-page');
    if (!page) {
      return;
    }

    var guest = document.querySelector('#guest');
    var profile = document.querySelector('#profile');
    var current = Auth.user();

    /* hidden — атрибут, а не стиль: элемент не просто прозрачный,
       его нет для браузера, программ чтения и таб-навигации. */
    if (guest) {
      guest.hidden = !!current;
    }
    if (profile) {
      profile.hidden = !current;
    }

    if (current) {
      Auth.renderProfile(current);
    } else {
      Auth.bindGuestForms();
    }
  },

  /* Формы входа и регистрации.
     bind привязывается ОДИН раз (флаг на самой форме), иначе после
     каждой перерисовки на кнопку вешался бы второй обработчик, и один
     клик отправлял форму дважды. */
  bindGuestForms: function () {
    var loginForm = document.querySelector('#login-form');
    var regForm = document.querySelector('#register-form');

    if (loginForm && !loginForm.dataset.bound) {
      loginForm.dataset.bound = '1';
      loginForm.addEventListener('submit', function (event) {
        /* preventDefault отменяет «родное» поведение формы: браузер
           по умолчанию ПЕРЕЗАГРУЖАЕТ страницу и отправляет данные
           по method/action. Без этой строки страница мигнула бы,
           JS отработал, а результат перезагрузка стёрла. */
        event.preventDefault();

        var v = Ui.values(['login-name', 'login-pass']);
        var result = Auth.login(v['login-name'], v['login-pass']);
        var msg = document.querySelector('#login-msg');

        if (!result.ok) {
          Ui.say(msg, result.error, 'error');
          return;
        }
        Ui.say(msg, '', 'ok');
        loginForm.reset();
        /* Перерисовка приходит сама: login() вызывает notify(), а
           подписка на него заведена в Auth.start. Вызывать renderPage()
           ещё раз — значит собрать страницу дважды. */
      });
    }

    if (regForm && !regForm.dataset.bound) {
      regForm.dataset.bound = '1';
      regForm.addEventListener('submit', function (event) {
        event.preventDefault();

        var v = Ui.values(['reg-login', 'reg-nick', 'reg-pass', 'reg-pass2']);
        var result = Auth.register(v['reg-login'], v['reg-nick'],
                                   v['reg-pass'], v['reg-pass2']);
        var msg = document.querySelector('#reg-msg');

        if (!result.ok) {
          Ui.say(msg, result.error, 'error');
          return;
        }
        Ui.say(msg, '', 'ok');
        regForm.reset();
        /* То же, что при входе: register() сам зовёт notify(),
           страница перерисуется по подписке. */
      });
    }
  },

  /* Собранная карточка профиля: кто я, что моё, что удалить. */
  renderProfile: function (current) {
    var box = document.querySelector('#profile-body');
    if (!box) {
      return;
    }
    Ui.clear(box);

    var info = Ui.el('div', 'profile-info');

    var rows = [
      ['Ник', current.nick],
      ['Логин', current.login],
      ['Аккаунт создан', Store.formatDate(current.createdAt)],
      ['Отзывов', window.Reviews ? String(window.Reviews.byAuthor(current.id).length) : '—'],
      ['Своих рецептов', window.UserRecipes ? String(window.UserRecipes.byAuthor(current.id).length) : '—']
    ];

    for (var i = 0; i < rows.length; i++) {
      var row = Ui.el('div', 'profile-row');
      row.appendChild(Ui.el('span', 'profile-key', rows[i][0]));
      row.appendChild(Ui.el('span', 'profile-val', rows[i][1]));
      info.appendChild(row);
    }
    box.appendChild(info);

    /* Чужие данные всегда через textContent — ник может быть любым. */
    var links = Ui.el('div', 'profile-links');
    links.appendChild(barLink('➕ Добавить свой рецепт', 'add-recipe.html'));
    links.appendChild(barLink('🌐 Народная база', 'community.html'));
    box.appendChild(links);

    var out = Ui.el('button', 'btn btn-ghost', 'Выйти из аккаунта');
    out.type = 'button';
    out.addEventListener('click', function () {
      Auth.logout();
    });
    box.appendChild(out);

    /* Удаление аккаунта просит подтверждение: действие необратимо,
       а случайный клик по кнопке дороже любой экономии на клике. */
    var drop = Ui.el('button', 'btn btn-danger', 'Удалить аккаунт');
    drop.type = 'button';
    drop.addEventListener('click', function () {
      var ok = window.confirm('Удалить аккаунт «' + current.nick + '» вместе со всеми отзывами и рецептами? Отменить нельзя.');
      if (!ok) {
        return;
      }
      Auth.dropAccount();
      /* dropAccount → logout → notify → панелька и профиль уже
         перерисованы. Остаётся только сказать результат. */
      Ui.say(document.querySelector('#page-msg'),
             'Аккаунт удалён вместе с его отзывами и рецептами.', 'ok');
    });

    var danger = Ui.el('div', 'profile-danger');
    danger.appendChild(Ui.el('p', 'profile-danger-note',
      'Аккаунт живёт в localStorage этого браузера. Почистишь данные сайта — его не станет.'));
    danger.appendChild(drop);
    box.appendChild(danger);

    /* Свои рецепты списком, если модуль рецептов подключён. */
    if (window.UserRecipes) {
      window.UserRecipes.renderMine(document.querySelector('#profile-recipes'));
    }
    if (window.Reviews) {
      window.Reviews.renderMine(document.querySelector('#profile-reviews'));
    }
  },

  /* ==========================================================================
     6. ЗАПУСК
     ==========================================================================
     defer гарантирует построенную страницу, но одного вызова мало:
     login/logout меняют и панельку, и содержимое кабинета, а знают об
     этом только здесь. Поэтому Auth сам подписывается на own notify —
     так панелька обновляется на любой странице, где есть #account-bar,
     а на «Кабинете» вместе с ней переключаются гостевые формы и
     профиль.

     Рекурсии нет: renderBar/renderPage только читают хранилище, notify
     они не вызывают. */
  start: function () {
    Auth.renderBar();
    Auth.renderPage();

    Auth.subscribe(function () {
      Auth.renderBar();
      Auth.renderPage();
    });
  }
};

/* Запуск после того, как выполнены ВСЕ скрипты страницы (см. пояснение
   у Ui.onReady в ui.js): auth.js вызывается первым, а отзывы и рецепты
   нужны уже в профиле. */
Ui.onReady(Auth.start);
