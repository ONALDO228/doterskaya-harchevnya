/* ==========================================================================
   recipes-user.js — РЕЦЕПТЫ, КОТОРЫЕ ДОБАВИЛИ ЛЮДИ

   Чем этот файл отличается от script.js:
     script.js       — пять рецептов, вписанных автором сайта в код;
     recipes-user.js — рецепты, которые добавили посетители через форму.
   Первые лежат в файле и меняются только рукой программиста, вторые
   живут в localStorage и меняются кликом по кнопке.

   КЛЮЧ dh:recipes — массив объектов:
     id            — уникальный номер, попадает в адрес страницы;
     title         — название;
     emoji         — «фото» карточки (файлов-картинок у посетителей нет);
     time          — сколько готовить (текст: «20 мин», «1 ч 30 мин»);
     portions      — на сколько порций;
     difficulty      — легко / средне / сложно;
     intro         — короткое описание для карточки;
     ingredients   — МАССИВ строк, по одной на ингредиент;
     steps         — МАССИВ строк, шаги по порядку;
     tip           — совет, может быть пустым;
     authorId      — КТО оставил (по нему удаляем и защищаем от правки);
     authorNick    — как подписать (копия ника на момент публикации);
     createdAt     — время создания для сортировки.

   ПОЧЕМУ authorNick — копия, а не ссылка на пользователя.
   Читаем мы всё из одного браузера, но принцип настоящий: в базе
   хранят id, а имя либо подтягивают по нему, либо фиксируют копию.
   Здесь выбрал копию — подпись под рецептом не должна исчезать, если
   аккаунт удалили.

   ЗАВИСИМОСТИ: store.js, ui.js, auth.js.
   ========================================================================== */

var UserRecipes = {

  KEY: 'recipes',

  MAX_TITLE: 60,
  MAX_INTRO: 180,
  MAX_LINES: 20,   /* максимум ингредиентов и шагов в списке */
  MAX_LINE: 120,   /* длина одной строки */

  /* ==========================================================================
     1. ХРАНЕНИЕ
     ========================================================================== */

  all: function () {
    return Store.read(UserRecipes.KEY, []) || [];
  },

  save: function (list) {
    return Store.write(UserRecipes.KEY, list);
  },

  byId: function (id) {
    var list = UserRecipes.all();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        return list[i];
      }
    }
    return null;
  },

  byAuthor: function (userId) {
    return UserRecipes.all().filter(function (r) {
      return r.authorId === userId;
    });
  },

  dropAuthor: function (userId) {
    UserRecipes.save(UserRecipes.all().filter(function (r) {
      return r.authorId !== userId;
    }));
  },

  /* ==========================================================================
     2. ПРОВЕРКА ФОРМЫ
     ========================================================================== */

  /* Из текста в textarea получаем массив строк.
     split('\n') — разбить по переносам; trim у каждой — убрать
     пробелы; filter — выбросить пустые строки, иначе между
     «Мука — 200 г» и «Молоко» висела бы пустая точка списка. */
  toLines: function (text) {
    return String(text)
      .split('\n')
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; });
  },

  checkLines: function (lines, label) {
    if (lines.length < 2) {
      return label + ': нужно минимум 2 строки, сейчас ' + lines.length + '.';
    }
    if (lines.length > UserRecipes.MAX_LINES) {
      return label + ': максимум ' + UserRecipes.MAX_LINES + ' строк, сейчас ' + lines.length + '.';
    }
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].length > UserRecipes.MAX_LINE) {
        return label + ', строка ' + (i + 1) + ': длиннее ' +
               UserRecipes.MAX_LINE + ' символов.';
      }
    }
    return '';
  },

  validate: function (data) {
    if (data.title.length < 3) {
      return 'Название короче 3 символов.';
    }
    if (data.title.length > UserRecipes.MAX_TITLE) {
      return 'Название длиннее ' + UserRecipes.MAX_TITLE + ' символов — не влезет в карточку.';
    }
    if (data.intro.length > UserRecipes.MAX_INTRO) {
      return 'Описание длиннее ' + UserRecipes.MAX_INTRO + ' символов.';
    }
    if (!data.time) {
      return 'Напиши, сколько готовить.';
    }
    if (!data.portions) {
      return 'Напиши, на сколько порций.';
    }
    return UserRecipes.checkLines(data.ingredients, 'Ингредиенты') ||
           UserRecipes.checkLines(data.steps, 'Шаги');
  },

  /* ==========================================================================
     3. ДОБАВИТЬ / УДАЛИТЬ
     ========================================================================== */

  add: function (data) {
    var current = Auth.user();
    if (!current) {
      return { ok: false, error: 'Рецепты добавляют только вошедшие.' };
    }

    var error = UserRecipes.validate(data);
    if (error) {
      return { ok: false, error: error };
    }

    var list = UserRecipes.all();
    var recipe = {
      id: Store.uid('r'),
      title: data.title,
      emoji: data.emoji,
      time: data.time,
      portions: data.portions,
      difficulty: data.difficulty,
      intro: data.intro,
      ingredients: data.ingredients,
      steps: data.steps,
      tip: data.tip,
      authorId: current.id,
      authorNick: current.nick,
      createdAt: Date.now()
    };

    /* Добавляем В НАЧАЛО: свежее должно быть на виду, а не под
       сотней старых. push кладёт в конец, unshift — в начало. */
    list.unshift(recipe);

    if (!UserRecipes.save(list)) {
      return { ok: false, error: 'Браузер не дал сохранить (хранилище запрещено или переполнено).' };
    }
    return { ok: true, recipe: recipe };
  },

  remove: function (id) {
    var current = Auth.user();
    if (!current) {
      return false;
    }
    /* Удалить можно только свой: условие authorId === current.id
       стоит ВНУТРИ, а не только на кнопке. */
    UserRecipes.save(UserRecipes.all().filter(function (r) {
      return !(r.id === id && r.authorId === current.id);
    }));
    /* Отзывов на удалённый рецепт не было бы, но чистим и их:
       иначе в кабинете осталась бы ссылка в никуда. */
    if (window.Reviews) {
      Reviews.dropRecipe('user:' + id);
    }
    return true;
  },

  /* ==========================================================================
     4. ФОРМА «ДОБАВИТЬ РЕЦЕПТ» (add-recipe.html)
     ==========================================================================
     Поля размечены тегами в HTML, здесь только читаем, проверяем и
     сохраняем. Разметка формы в HTML, а не в JS, потому что её надо
     видеть глазами и править без знания JS. */

  renderForm: function () {
    var form = document.querySelector('#add-form');
    if (!form) {
      return;
    }

    var current = Auth.user();
    var gate = document.querySelector('#add-gate');
    var msg = document.querySelector('#add-msg');

    /* Гостю форму показывать бессмысленно: add() всё равно откажет.
       Показываем объяснение и ссылку на вход. */
    if (gate) {
      gate.hidden = !!current;
    }
    form.hidden = !current;

    if (!current || form.dataset.bound) {
      return;
    }
    form.dataset.bound = '1';

    var IDS = ['ar-title', 'ar-emoji', 'ar-time', 'ar-portions',
               'ar-difficulty', 'ar-intro', 'ar-ingredients',
               'ar-steps', 'ar-tip'];

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var v = Ui.values(IDS);
      var data = {
        title: v['ar-title'],
        emoji: v['ar-emoji'] || '🍽',
        time: v['ar-time'],
        portions: v['ar-portions'],
        difficulty: v['ar-difficulty'],
        intro: v['ar-intro'],
        ingredients: UserRecipes.toLines(v['ar-ingredients']),
        steps: UserRecipes.toLines(v['ar-steps']),
        tip: v['ar-tip']
      };

      var result = UserRecipes.add(data);
      if (!result.ok) {
        Ui.say(msg, result.error, 'error');
        return;
      }

      Ui.reset(IDS);
      Ui.say(msg, 'Готово. Рецепт «' + data.title + '» лежит в народной базе.', 'ok');

      /* Не заставляем искать ссылку руками: даём её сразу в ответе. */
      var link = Ui.el('a', 'btn', 'Открыть мой рецепт →');
      link.href = 'recipe-user.html?id=' + encodeURIComponent(result.recipe.id);
      var old = document.querySelector('#add-done-link');
      if (old) {
        old.parentNode.removeChild(old);
      }
      link.id = 'add-done-link';
      form.appendChild(link);
    });
  },

  /* ==========================================================================
     5. НАРОДНАЯ БАЗА (community.html)
     ========================================================================== */

  /* Состояние страницы: что показано сейчас. Хранится ОДНИМ объектом,
     а не «состоянием кнопок», — HTML всегда отражение state. */
  state: { query: '', onlyMine: false },

  renderCommunity: function () {
    var slot = document.querySelector('#community-list');
    if (!slot) {
      return;
    }
    Ui.clear(slot);

    var current = Auth.user();
    var all = UserRecipes.all();

    /* --- СЧЁТЧИК И ПОИСК --- */
    var tools = Ui.el('div', 'community-tools');

    var counter = Ui.el('p', 'community-count');
    counter.textContent = all.length === 0
      ? 'В народной базе пока пусто. Твой рецепт может стать первым.'
      : 'Рецептов в базе: ' + all.length +
        (current ? ' (моих: ' + UserRecipes.byAuthor(current.id).length + ')' : '');
    tools.appendChild(counter);

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'field-input community-search';
    search.id = 'community-search';
    search.placeholder = 'Поиск по названию и ингредиентам';
    search.value = UserRecipes.state.query;
    /* 'input' — событие «в поле поменялся текст», срабатывает на
       каждый символ. 'change' ждал бы потери фокуса — поиск был бы
       «сначала нажми Enter». */
    search.addEventListener('input', function () {
      UserRecipes.state.query = search.value.trim().toLowerCase();
      UserRecipes.renderGrid();
    });
    tools.appendChild(search);

    if (current) {
      var toggle = Ui.el('button', 'chip', 'только мои');
      toggle.type = 'button';
      Ui.setActive(toggle, 'chip-on', UserRecipes.state.onlyMine);
      toggle.setAttribute('aria-pressed', UserRecipes.state.onlyMine ? 'true' : 'false');
      toggle.addEventListener('click', function () {
        UserRecipes.state.onlyMine = !UserRecipes.state.onlyMine;
        UserRecipes.renderCommunity();
      });
      tools.appendChild(toggle);
    }

    slot.appendChild(tools);

    var gridSlot = Ui.el('div', 'community-grid-slot');
    slot.appendChild(gridSlot);
    UserRecipes.renderGrid(gridSlot);
  },

  /* Отрисовка только сетки — чтобы ввод в поиске не перерисовывал
     поле поиска (иначе оно теряло бы фокус после каждой буквы). */
  renderGrid: function (slot) {
    var gridSlot = slot || document.querySelector('.community-grid-slot');
    if (!gridSlot) {
      return;
    }
    Ui.clear(gridSlot);

    var current = Auth.user();
    var list = UserRecipes.all();

    if (UserRecipes.state.onlyMine && current) {
      list = list.filter(function (r) {
        return r.authorId === current.id;
      });
    }

    var q = UserRecipes.state.query;
    if (q) {
      /* Ищем по названию, описанию и ингредиентам.
         join(' ') превращает массив строк в одну для поиска. */
      list = list.filter(function (r) {
        var haystack = (r.title + ' ' + r.intro + ' ' +
                        r.ingredients.join(' ')).toLowerCase();
        return haystack.indexOf(q) !== -1;
      });
    }

    if (list.length === 0) {
      gridSlot.appendChild(Ui.el('p', 'empty-note',
        q ? 'По запросу «' + q + '» ничего нет.' : 'Пока нет ни одного рецепта.'));
      return;
    }

    var grid = Ui.el('div', 'cards');
    for (var i = 0; i < list.length; i++) {
      /* Индекс нужен, чтобы чередовать цвет «фото» карточки. */
      grid.appendChild(UserRecipes.renderCard(list[i], i));
    }
    gridSlot.appendChild(grid);
  },

  /* Карточка народного рецепта. Те же классы .card/.card-body, что у
     карточек на index.html: выглядит одинаково, и адаптив (flex-wrap
     + media-запрос) достаётся бесплатно.
     tone — порядковый номер карточки: по остатку от деления на число
     оттенков ряд не получается одноцветным. % — это «остаток от
     деления»: 0,1,2,3,0,1,2,3... */
  renderCard: function (recipe, tone) {
    var card = Ui.el('article', 'card');

    var tones = ['photo-dire', 'photo-yellow', 'photo-radiant', 'photo-orange'];
    var index = (tone || 0) % tones.length;
    card.appendChild(Ui.el('div', 'card-photo ' + tones[index], recipe.emoji));

    var body = Ui.el('div', 'card-body');
    body.appendChild(Ui.el('h3', 'card-title', recipe.title));

    var meta = Ui.el('p', 'card-meta');
    meta.textContent = '⏱ ' + recipe.time + ' • 👥 ' + recipe.portions +
                       ' • ' + UserRecipes.difficultyIcon(recipe.difficulty) + ' ' + recipe.difficulty;
    body.appendChild(meta);

    body.appendChild(Ui.el('p', 'card-text', recipe.intro || 'Описания нет.'));
    body.appendChild(Ui.el('p', 'card-author',
      'от ' + recipe.authorNick + ' · ' + Store.timeAgo(recipe.createdAt)));

    var link = Ui.el('a', 'btn', 'Читать рецепт →');
    link.href = 'recipe-user.html?id=' + encodeURIComponent(recipe.id);
    body.appendChild(link);

    card.appendChild(body);
    return card;
  },

  difficultyIcon: function (difficulty) {
    if (difficulty === 'сложно') {
      return '🍳';
    }
    if (difficulty === 'средне') {
      return '🥘';
    }
    return '🥗';
  },

  /* ==========================================================================
     6. СТРАНИЦА ОДНОГО НАРОДНОГО РЕЦЕПТА (recipe-user.html)
     ==========================================================================
     Адрес вида recipe-user.html?id=r-abc123.
     location.search — всё, что стоит в адресе после «?».
     Идём руками, без новых библиотек: отрезать «?», разбить по «&»,
     каждую пару по «=», раскодировать decodeURIComponent (в адресе
     пробел приехал как %20, его надо вернуть). */

  paramFromUrl: function (name) {
    var pairs = window.location.search.replace(/^\?/, '').split('&');
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split('=');
      if (kv[0] === name) {
        return decodeURIComponent(kv[1] || '');
      }
    }
    return '';
  },

  renderOne: function () {
    var slot = document.querySelector('#user-recipe');
    if (!slot) {
      return;
    }
    Ui.clear(slot);

    var id = UserRecipes.paramFromUrl('id');
    var recipe = id ? UserRecipes.byId(id) : null;

    if (!recipe) {
      /* Такого id нет: рецепт удалили или в адрес опечатались.
         Пустая страница без объяснения выглядит как сломанный сайт,
         поэтому говорим прямым текстом и даём выход. */
      var missing = Ui.el('div', 'empty-state');
      missing.appendChild(Ui.el('h1', 'recipe-title', 'Рецепт не найден'));
      missing.appendChild(Ui.el('p', 'empty-note',
        'Записи с адресом «' + id + '» в этом браузере нет: её удалили, ' +
        'или рецепт добавляли в другом браузере.'));
      var home = Ui.el('a', 'btn', '← В народную базу');
      home.href = 'community.html';
      missing.appendChild(home);
      slot.appendChild(missing);
      return;
    }

    /* Сообщаем странице, кто она, ДО отрисовки отзывов: reviews.js
       читает эти атрибуты, чтобы понять, к какому рецепту писать
       отзывы. Префикс user: отделяет народные записи от системных. */
    document.body.dataset.recipeId = 'user:' + recipe.id;
    document.body.dataset.recipeTitle = recipe.title;

    /* Название вкладки. Без него десять открытых народных рецептов
       подписаны одинаково, и переключаться между ними можно только
       открыв каждый. document.title — единственное место, где
       заголовок вкладки меняется из кода. */
    document.title = recipe.title + ' — Дотерская харчевня';

    var head = Ui.el('header', 'recipe-header');
    head.appendChild(Ui.el('h1', 'recipe-title', recipe.title));
    head.appendChild(Ui.el('p', 'recipe-meta',
      '⏱ ' + recipe.time + ' • 👥 ' + recipe.portions + ' • ' +
      UserRecipes.difficultyIcon(recipe.difficulty) + ' ' + recipe.difficulty));
    head.appendChild(Ui.el('p', 'recipe-author',
      'Народный рецепт от ' + recipe.authorNick + ' · ' + Store.formatDate(recipe.createdAt)));
    if (recipe.intro) {
      head.appendChild(Ui.el('p', 'recipe-intro', recipe.intro));
    }
    slot.appendChild(head);

    /* «Фото» — эмодзи на градиенте. Картинки пользователи загрузить
       не могут: статический сайт никуда файлы не принимает. */
    slot.appendChild(Ui.el('div', 'recipe-photo photo-dire', recipe.emoji));

    var grid = Ui.el('div', 'recipe-grid');

    var ing = Ui.el('section', 'ingredients');
    ing.appendChild(Ui.el('h2', null, 'Ингредиенты'));
    var ingList = document.createElement('ul');
    for (var i = 0; i < recipe.ingredients.length; i++) {
      ingList.appendChild(Ui.el('li', null, recipe.ingredients[i]));
    }
    ing.appendChild(ingList);

    if (recipe.tip) {
      var tip = Ui.el('div', 'tip');
      tip.appendChild(Ui.el('strong', null, '💡 Совет'));
      tip.appendChild(Ui.el('p', null, recipe.tip));
      ing.appendChild(tip);
    }
    grid.appendChild(ing);

    var steps = Ui.el('section', 'steps');
    steps.appendChild(Ui.el('h2', null, 'Приготовление'));
    var stepsList = document.createElement('ol');
    for (var s = 0; s < recipe.steps.length; s++) {
      stepsList.appendChild(Ui.el('li', null, recipe.steps[s]));
    }
    steps.appendChild(stepsList);
    grid.appendChild(steps);

    slot.appendChild(grid);

    /* Кнопка удаления для автора. Чужим её не показываем, а remove()
       откажет и без кнопки. */
    if (Auth.owns(recipe)) {
      var actions = Ui.el('div', 'recipe-actions');
      var del = Ui.el('button', 'btn btn-danger', 'Удалить мой рецепт');
      del.type = 'button';
      del.addEventListener('click', function () {
        if (!window.confirm('Удалить рецепт «' + recipe.title + '»? Отменить нельзя.')) {
          return;
        }
        UserRecipes.remove(recipe.id);
        window.location.href = 'community.html';
      });
      actions.appendChild(del);
      slot.appendChild(actions);
    }

    /* Отзывы подключаем здесь, а не только в start(): страница
     узнала свой id только что, до этого reviews.js её не видел. */
    if (window.Reviews) {
      window.Reviews.renderWidget();
    }
  },

  /* ==========================================================================
     7. «МОИ РЕЦЕПТЫ» В КАБИНЕТЕ
     ========================================================================== */

  renderMine: function (slot) {
    if (!slot) {
      return;
    }
    Ui.clear(slot);

    var current = Auth.user();
    if (!current) {
      return;
    }

    var list = UserRecipes.byAuthor(current.id);
    if (list.length === 0) {
      slot.appendChild(Ui.el('p', 'empty-note', 'У тебя пока нет своих рецептов.'));
      var link = Ui.el('a', 'btn', 'Добавить первый рецепт');
      link.href = 'add-recipe.html';
      slot.appendChild(link);
      return;
    }

    for (var i = 0; i < list.length; i++) {
      var row = Ui.el('div', 'mine-row');
      var a = Ui.el('a', 'mine-link', list[i].title);
      a.href = 'recipe-user.html?id=' + encodeURIComponent(list[i].id);
      row.appendChild(a);
      row.appendChild(Ui.el('span', 'mine-date', Store.timeAgo(list[i].createdAt)));
      slot.appendChild(row);
    }
  },

  /* ==========================================================================
     8. ДЛЯ КНОПКИ «НАУГАД» (script.js)
     ==========================================================================
     script.js не знает про localStorage — он спрашивает готовый
     список. Так два файла не зависят друг от друга: если этот скрипт
     на странице не подключён, script.js работает со своими пятью. */

  forRandom: function () {
    return UserRecipes.all().map(function (r) {
      return {
        file: 'recipe-user.html?id=' + encodeURIComponent(r.id),
        name: r.title
      };
    });
  },

  /* ==========================================================================
     9. ЗАПУСК
     ========================================================================== */
  start: function () {
    UserRecipes.renderForm();
    UserRecipes.renderCommunity();
    UserRecipes.renderOne();

    if (window.Auth) {
      Auth.subscribe(function () {
        UserRecipes.renderForm();
        UserRecipes.renderCommunity();
      });
    }
  }
};

Ui.onReady(UserRecipes.start);
