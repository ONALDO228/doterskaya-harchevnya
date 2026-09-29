/* ==========================================================================
   reviews.js — ОТЗЫВЫ И РЕЙТИНГ РЕЦЕПТОВ

   ПРАВИЛА, КОТОРЫЕ ЗАЛОЖЕНЫ В ЭТОМ ФАЙЛЕ:
     · читать отзывы может любой;
     · написать — только вошедший в аккаунт (Auth.isLogged());
     · один человек = один отзыв на рецепт. Повторная отправка НЕ
       создаёт дубль, а ОБНОВЛЯЕТ прежний: так рейтинг честнее, чем
       «у саппорта двадцать отзывов про один борщ»;
     · удалить можно только СВОЙ отзыв (сверяем authorId).

   ГДЕ ЛЕЖАТ ДАННЫЕ.
   Все отзывы сайта — ОДИН массив в ключе dh:reviews. У каждого
   отзыва поле recipeId говорит, к какому рецепту он относится.
   Почему не «своя запись на каждый рецепт» (dh:reviews:borshch,
   dh:reviews:bliny...):
     1) в кабинете нужен список «мои отзывы» по всем рецептам —
        с одним массивом это одна фильтрация, с кучей ключей —
        перебор всех ключей localStorage;
     2) средний рейтинг по всему сайту считается так же в один проход.
   Массив читаем целиком и выбираем нужное на лету: при десятках-сотнях
   отзывов это доли миллисекунды.

   ЗАВИСИМОСТИ: store.js, ui.js, auth.js.
   ========================================================================== */

var Reviews = {

  KEY: 'reviews',

  MIN_TEXT: 5,   /* короче — это не отзыв, а «ок» */
  MAX_TEXT: 600, /* длиннее не поместится в карточку без прокрутки */

  /* ==========================================================================
     1. ХРАНЕНИЕ
     ========================================================================== */

  all: function () {
    return Store.read(Reviews.KEY, []) || [];
  },

  save: function (list) {
    return Store.write(Reviews.KEY, list);
  },

  /* Отзывы одного рецепта.
     filter принимает функцию и оставляет элементы, где она вернула
     true. Сравниваем строки, а не числа: recipeId — это текст вида
     'borshch', а не индекс в массиве. */
  forRecipe: function (recipeId) {
    return Reviews.all().filter(function (r) {
      return r.recipeId === recipeId;
    });
  },

  /* Все отзывы конкретного человека (для кабинета и для удаления
     аккаунта вместе с его добром). */
  byAuthor: function (userId) {
    return Reviews.all().filter(function (r) {
      return r.authorId === userId;
    });
  },

  /* Отзыв этого человека на этот рецепт, если он уже был. */
  byAuthorForRecipe: function (userId, recipeId) {
    var list = Reviews.all();
    for (var i = 0; i < list.length; i++) {
      if (list[i].authorId === userId && list[i].recipeId === recipeId) {
        return list[i];
      }
    }
    return null;
  },

  /* СРЕДНЯЯ ОЦЕНКА.
     sum += r.rating — складываем все оценки;
     делим на количество;
     если отзывов нет, 0/0 дало бы NaN («not a number»), и в заголовке
     появилось бы «рейтинг NaN». Поэтому пустой случай возвращаем 0
     ЯВНО.
     round(...*10)/10 — округление до десятых: 4.3333 → 4.3. */
  avg: function (recipeId) {
    var list = Reviews.forRecipe(recipeId);
    if (list.length === 0) {
      return 0;
    }
    var sum = 0;
    for (var i = 0; i < list.length; i++) {
      sum += list[i].rating;
    }
    return Math.round(sum / list.length * 10) / 10;
  },

  /* Удалить отзывы человека (вызывается из auth.js при удалении
     аккаунта). */
  dropAuthor: function (userId) {
    Reviews.save(Reviews.all().filter(function (r) {
      return r.authorId !== userId;
    }));
  },

  /* Удалить ВСЕ отзывы одного рецепта (вызывается из recipes-user.js,
     когда автор сносит свой рецепт). Иначе в кабинете висели бы
     ссылки на несуществующую страницу. */
  dropRecipe: function (recipeId) {
    Reviews.save(Reviews.all().filter(function (r) {
      return r.recipeId !== recipeId;
    }));
  },

  /* ==========================================================================
     2. ДОБАВИТЬ / УДАЛИТЬ
     ========================================================================== */

  validate: function (rating, text) {
    var num = Number(rating);
    if (!(num >= 1 && num <= 5)) {
      return 'Сначала поставь звёзды от 1 до 5.';
    }
    if (text.length < Reviews.MIN_TEXT) {
      return 'Отзыв короче ' + Reviews.MIN_TEXT + ' символов — непонятно, вкусно или нет.';
    }
    if (text.length > Reviews.MAX_TEXT) {
      return 'Слишком длинно: ' + text.length + ' символов, а максимум ' + Reviews.MAX_TEXT + '.';
    }
    return '';
  },

  /* Добавить отзыв. Возвращает { ok, error } — текст для пользователя,
     а не throw: ошибку надо показать в форме, а не ронять страницу. */
  add: function (recipeId, recipeTitle, rating, text) {
    var current = Auth.user();

    /* Это дублирует проверку, что делает и интерфейс (форма просто не
       рисуется гостю). Так и должно быть: интерфейс можно обойти через
       консоль, а функция — нет. Любую «нельзя» надо держать в коде,
       а не только на кнопке. */
    if (!current) {
      return { ok: false, error: 'Сначала войди в аккаунт.' };
    }

    var error = Reviews.validate(rating, text);
    if (error) {
      return { ok: false, error: error };
    }

    var list = Reviews.all();
    var existing = Reviews.byAuthorForRecipe(current.id, recipeId);

    if (existing) {
      /* Обновляем прежний отзыв по месту. id и дата создания
         остаются, добавляем editedAt — чтобы честным образом подписать
         «изменено». */
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === existing.id) {
          list[i].rating = Number(rating);
          list[i].text = text;
          list[i].authorNick = current.nick; /* ник могли сменить */
          list[i].editedAt = Date.now();
          break;
        }
      }
    } else {
      list.push({
        id: Store.uid('rev'),
        recipeId: recipeId,
        recipeTitle: recipeTitle,
        authorId: current.id,
        authorNick: current.nick,
        rating: Number(rating),
        text: text,
        createdAt: Date.now()
      });
    }

    if (!Reviews.save(list)) {
      return { ok: false, error: 'Браузер не дал сохранить (хранилище запрещено или переполнено).' };
    }

    return { ok: true, updated: !!existing };
  },

  remove: function (reviewId) {
    var current = Auth.user();
    if (!current) {
      return false;
    }
    /* Сохраняем только те отзывы, которые НЕ этот и НЕ чужие:
       проверка авторства внутри remove, а не только на кнопке. */
    var kept = Reviews.all().filter(function (r) {
      return !(r.id === reviewId && r.authorId === current.id);
    });
    Reviews.save(kept);
    return true;
  },

  /* ==========================================================================
     3. ВИДЖЕТ НА СТРАНИЦЕ РЕЦЕПТА
     ==========================================================================
     Что ищет на странице:
       <section id="reviews">                  — куда всё положить
       <body data-recipe-id="borshch"
             data-recipe-title="Борщ ...">     — о каком рецепте речь

     Идентификатор лежит в data-атрибуте, а не вписан в JS: один и тот
     же файл работает на пяти страницах, потому что у каждой страницы
     свой data-recipe-id. data-атрибуты читаются через element.dataset
     (camelCase: data-recipe-id → dataset.recipeId). */

  recipeFromPage: function () {
    var body = document.body;
    if (!body || !body.dataset.recipeId) {
      return null;
    }
    return {
      id: body.dataset.recipeId,
      title: body.dataset.recipeTitle || body.dataset.recipeId
    };
  },

  renderWidget: function () {
    var slot = document.querySelector('#reviews');
    var recipe = Reviews.recipeFromPage();
    if (!slot || !recipe) {
      return;
    }

    Ui.clear(slot);

    var wrap = Ui.el('section', 'reviews');
    wrap.appendChild(Ui.el('h2', 'reviews-title', '💬 Отзывы и оценки'));

    var list = Reviews.forRecipe(recipe.id).sort(Reviews.newestFirst);
    wrap.appendChild(Reviews.renderSummary(recipe.id, list.length));
    wrap.appendChild(Reviews.renderForm(recipe));
    wrap.appendChild(Reviews.renderList(recipe.id, list));

    slot.appendChild(wrap);
  },

  /* Компаратор для sort: что раньше по дате — выше.
     sort ждёт функцию: отрицательное число — a раньше b,
     положительное — b раньше a. b.createdAt - a.createdAt даёт
     порядок «сначала свежие». */
  newestFirst: function (a, b) {
    return b.createdAt - a.createdAt;
  },

  /* Строка «4.3 ★ · 12 отзывов». */
  renderSummary: function (recipeId, count) {
    var box = Ui.el('div', 'reviews-summary');
    var avg = Reviews.avg(recipeId);

    if (count === 0) {
      box.appendChild(Ui.el('span', 'reviews-avg', 'Оценок ещё нет — будь первым.'));
    } else {
      box.appendChild(Ui.stars(avg));
      box.appendChild(Ui.el('span', 'reviews-avg', avg.toFixed(1) + ' из 5'));
      box.appendChild(Ui.el('span', 'reviews-count',
        Store.plural(count, ['отзыв', 'отзыва', 'отзывов']) + ': ' + count));
    }
    return box;
  },

  /* --------------------------------------------------------------------------
     ФОРМА ОТЗЫВА
     --------------------------------------------------------------------------
     Три состояния:
       гость            → текст + ссылка на вход, полей нет;
       не оставлял      → форма «оставить отзыв»;
       уже оставлял     → та же форма, но с текущими значением и
                          подписью «обновим прежний». */
  renderForm: function (recipe) {
    var box = Ui.el('div', 'review-form-box');
    var current = Auth.user();

    if (!current) {
      box.appendChild(Ui.el('p', 'review-guest',
        'Читать отзывы можно и без аккаунта. Оставить свой — только после входа.'));
      var login = Ui.el('a', 'btn', 'Войти или зарегистрироваться');
      login.href = 'account.html#login';
      box.appendChild(login);
      return box;
    }

    var existing = Reviews.byAuthorForRecipe(current.id, recipe.id);

    var form = Ui.el('form', 'form');
    form.setAttribute('novalidate', '');
    /* novalidate отключает браузерные подсказки «заполните поле»:
       у нас своя валидация с внятными сообщениями, а браузерный
       тултип показывает текст на системном языке и перебивает наш. */

    var head = Ui.el('p', 'form-who',
      existing ? 'Ты уже отзывался — новый текст заменит прежний.'
               : 'Оцени и расскажи, что получилось. Ник: ' + current.nick);
    form.appendChild(head);

    /* --- ЗВЁЗДЫ-РАДИОВЫБОРЫ, СОБРАННЫЕ КНОПКАМИ --- */
    var starsBox = Ui.el('div', 'star-input');
    var rating = existing ? existing.rating : 0;

    var starsLabel = Ui.el('span', 'star-caption',
      rating ? 'Твоя оценка: ' + rating : 'Поставь оценку от 1 до 5');

    var starButtons = [];
    for (var i = 1; i <= 5; i++) {
      (function (value) {
        var btn = Ui.el('button', 'star-btn', value <= rating ? '★' : '☆');
        btn.type = 'button'; /* вне формы кнопка по умолчанию submit
                                и отправила бы форму на каждое нажатие */
        btn.setAttribute('aria-label', 'Оценка ' + value + ' из 5');
        if (value <= rating) {
          btn.classList.add('star-on');
        }
        btn.addEventListener('click', function () {
          rating = value;
          /* Перерисовываем состояние всех пяти: звёзды — это
             «заполнено или нет», а не текст на кнопке. */
          for (var k = 0; k < starButtons.length; k++) {
            var on = (k + 1) <= rating;
            starButtons[k].textContent = on ? '★' : '☆';
            Ui.setActive(starButtons[k], 'star-on', on);
          }
          starsLabel.textContent = 'Твоя оценка: ' + rating;
        });
        starButtons.push(btn);
        starsBox.appendChild(btn);
      })(i);
      /* Замыкание (function (value) {...})(i) нужно, потому что var i
         внутри цикла ОДИН на всех: без обёртки все пять обработчиков
         увидели бы финальное i = 6. У каждой итерации своя копия
         значения — классика JS на var. */
    }

    starsBox.appendChild(starsLabel);
    form.appendChild(starsBox);

    /* --- ТЕКСТ --- */
    var label = Ui.el('label', 'field');
    label.appendChild(Ui.el('span', 'field-name', 'Что скажешь'));
    var area = document.createElement('textarea');
    area.className = 'field-input';
    area.id = 'review-text';
    area.rows = 4;
    area.maxLength = Reviews.MAX_TEXT;
    area.placeholder = 'Например: солил по рецепту, вышло солоно — в следующий раз кладу половину.';
    if (existing) {
      area.value = existing.text;
    }
    label.appendChild(area);
    form.appendChild(label);

    var msg = Ui.el('p', 'form-msg');
    msg.id = 'review-msg';
    form.appendChild(msg);

    var submit = Ui.el('button', 'btn btn-submit',
      existing ? 'Обновить отзыв' : 'Опубликовать отзыв');
    submit.type = 'submit';
    form.appendChild(submit);

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var text = area.value.trim();
      var result = Reviews.add(recipe.id, recipe.title, rating, text);

      if (!result.ok) {
        Ui.say(msg, result.error, 'error');
        return;
      }
      Reviews.renderWidget();
    });

    box.appendChild(form);
    return box;
  },

  /* --------------------------------------------------------------------------
     СПИСОК ОТЗЫВОВ
     -------------------------------------------------------------------------- */
  renderList: function (recipeId, list) {
    var box = Ui.el('div', 'review-list');

    if (list.length === 0) {
      box.appendChild(Ui.el('p', 'review-empty',
        'Отзывов нет. Бабушкин борщ пока без оценок.'));
      return box;
    }

    for (var i = 0; i < list.length; i++) {
      box.appendChild(Reviews.renderItem(list[i]));
    }
    return box;
  },

  renderItem: function (review) {
    var item = Ui.el('article', 'review');

    var head = Ui.el('div', 'review-head');
    head.appendChild(Ui.el('span', 'review-author', review.authorNick));
    head.appendChild(Ui.stars(review.rating));

    var when = Store.timeAgo(review.createdAt);
    if (review.editedAt) {
      when += ' · изменено ' + Store.timeAgo(review.editedAt);
    }
    head.appendChild(Ui.el('span', 'review-date', when));
    item.appendChild(head);

    /* Тело отзыва — строго textContent. Человек мог вставить в поле
       '<script>' или '<img onerror=...>'; в виде текста это безобидно. */
    item.appendChild(Ui.el('p', 'review-text', review.text));

    if (Auth.owns(review)) {
      var del = Ui.el('button', 'review-del', 'Удалить');
      del.type = 'button';
      del.addEventListener('click', function () {
        if (!window.confirm('Удалить свой отзыв?')) {
          return;
        }
        Reviews.remove(review.id);
        Reviews.renderWidget();
      });
      item.appendChild(del);
    }

    return item;
  },

  /* ==========================================================================
     4. «МОИ ОТЗЫВЫ» В КАБИНЕТЕ
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

    var list = Reviews.byAuthor(current.id).sort(Reviews.newestFirst);
    if (list.length === 0) {
      slot.appendChild(Ui.el('p', 'empty-note', 'Ты ещё не оставлял отзывов.'));
      return;
    }

    for (var i = 0; i < list.length; i++) {
      var row = Ui.el('div', 'mine-row');
      var link = Ui.el('a', 'mine-link', list[i].recipeTitle);
      link.href = Reviews.pageOf(list[i].recipeId);
      row.appendChild(link);
      row.appendChild(Ui.stars(list[i].rating));
      row.appendChild(Ui.el('span', 'mine-date', Store.timeAgo(list[i].createdAt)));
      slot.appendChild(row);
    }
  },

  /* Куда ведёт ссылка на рецепт.
     Системные рецепты — свои файлы, пользовательские — одна страница
     recipe-user.html с id в адресе. Так «мои отзывы» работают для
     любых рецептов, и список соответствий не разрастается: одно поле
     в данных говорит, куда идти. */
  pageOf: function (recipeId) {
    if (recipeId.indexOf('user:') === 0) {
      return 'recipe-user.html?id=' + encodeURIComponent(recipeId.slice(5));
    }
    var pages = {
      borshch: 'recipe.html',
      bliny: 'bliny.html',
      salat: 'salat.html',
      carbonara: 'carbonara.html'
    };
    return pages[recipeId] || 'index.html';
  },

  /* ==========================================================================
     5. ЗАПУСК
     ========================================================================== */
  start: function () {
    Reviews.renderWidget();
    /* Перерисоваться при входе/выходе: форма появляется и исчезает.
       Подписка вместо того, чтобы reviews.js лез внутрь auth.js. */
    if (window.Auth) {
      Auth.subscribe(function () {
        Reviews.renderWidget();
      });
    }
  }
};

Ui.onReady(Reviews.start);
