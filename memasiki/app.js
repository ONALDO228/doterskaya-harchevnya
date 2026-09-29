/* ==========================================================================
   app.js — КАК РИСУЕТСЯ РАЗДЕЛ «МЕМАСИКИ»

   Здесь нет ни одного цвета и ни одной строчки из data.js.
   Две функции-компонента:
     RecipeCard(recipe)  — собирает ОДНУ карточку, возвращает готовый
                           тег <article>. Компонент — это функция,
                           которой дал данные, а она вернула кусок
                           страницы. Та же функция, другие данные —
                           другая карточка.
     MemasikiPage()      — собирает СТРАНИЦУ: шапку, фильтры, сетку
                           карточек. Карточки она получает, вызывая
                           RecipeCard для каждой записи из массива.

   Плюс возрастная проверка (age gate) — см. конец файла.

   ВАЖНО ПРО ПУТИ. Роут /memasiki в статическом сайте без серверной
   части — это папка с index.html, то есть файл memasiki/index.html.
   Адрес /memasiki/koch-bratan-kirill — папка memasiki/koch-bratan-kirill
   с index.html внутри. Браузер сам подставляет index.html, когда в
   адресе указана папка.
   ========================================================================== */


/* --------------------------------------------------------------------------
   1. МЕЛКИЕ ПОМОЩНИКИ
   -------------------------------------------------------------------------- */

/* СОЗДАТЬ ТЕГ.
   document.createElement('div') — создать тег, но он ещё НЕ на
   странице: он висит в воздухе, пока его куда-нибудь не прицепят.
   textContent вместо innerHTML: текст попадёт внутрь как текст, и
   никакие теги из данных не распарсятся. Данные пришли из файла,
   но принцип тот же — содержимое вставлять текстом безопаснее. */
function make(tag, className, text) {
  var node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined && text !== null) {
    node.textContent = text;
  }
  return node;
}


/* ДОБАВИТЬ КЛАСС, ЕСЛИ УСЛОВИЕ ИСТИННО.
    Классы в CSS складываются: .card и .card-legend дают и общие
    правила карточки, и свои для легенды. */
function addClassIf(node, className, condition) {
  if (condition) {
    node.classList.add(className);
  }
  return node;
}


/* ПОРЯДКОВЫЙ НОМЕР РАНГА.
   Строку «Immortal» нельзя сравнить с «Herald» знаком больше-меньше.
   А индекс в списке MMR_LADDER — можно: чем выше, тем сложнее.
   indexOf вернёт -1, если ранга в списке нет, поэтому -1 означает
   «в самый конец». */
function mmrWeight(recipe) {
  var index = MMR_LADDER.indexOf(recipe.mmr);
  return index === -1 ? -1 : index;
}


/* --------------------------------------------------------------------------
  2. КОМПОНЕНТ RecipeCard(recipe)
   -------------------------------------------------------------------------- */

function RecipeCard(recipe) {
  var card = make('article', 'card');
  card.id = recipe.slug;

  addClassIf(card, 'card-featured', recipe.isFeatured);
  addClassIf(card, 'card-legend', recipe.badge === '🎮 ЛЕГЕНДА');
  addClassIf(card, 'card-adult', recipe.ageRestriction === '18+');

  /* --- ПЛАШКА СВЕРХУ. Бейдж легенды получает класс card-badge-legend,
         именно на нём висит оранжевое свечение @keyframes aegis-pulse --- */
  if (recipe.badge) {
    var isLegendBadge = recipe.badge === '🎮 ЛЕГЕНДА';
    var badge = make('span',
                     isLegendBadge ? 'card-badge card-badge-legend' : 'card-badge',
                     recipe.badge);
    card.appendChild(badge);
  }

  /* --- КАРТИНКА ---
         Эмодзи рисуется ВСЕГДА и лежит под картинкой. Если файла по
         адресу recipe.img нет, браузер не найдёт его, сработает
         событие error, и картинка просто исчезнет — под ней уже
         лежит эмодзи. Никаких серых квадратов с надписью «не
         загрузилось». */
  var art = make('div', 'card-art', recipe.art || '🍹');
  var pic = make('img', 'card-photo');
  pic.src = recipe.img;
  pic.alt = recipe.title;
  pic.addEventListener('error', function () {
    art.removeChild(pic);
  });
  art.appendChild(pic);
  card.appendChild(art);

  /* --- ЗАГОЛОВОК --- */
  card.appendChild(make('h2', 'card-title', recipe.title));

  /* --- СТРОКА ХАРАКТЕРИСТИК: ранг, время, стек --- */
  var meta = make('p', 'card-meta');
  meta.appendChild(make('span', 'mmr mmr-' + recipe.mmr.toLowerCase(),
                        '⭐ ' + recipe.mmr));
  meta.appendChild(make('span', 'card-time', '⏱ ' + recipe.timing));
  meta.appendChild(make('span', 'card-stack', '🎒 stack: ' + recipe.stack));
  if (recipe.ageRestriction) {
    /* 🔞 — это «до 18 нельзя», у 12+ такого запрета нет: берём
       нейтральный значок, иначе метка врёт. */
    var ageSign = recipe.ageRestriction === '18+' ? '🔞 ' : '🧒 ';
    meta.appendChild(make('span', 'card-age', ageSign + recipe.ageRestriction));
  }
  card.appendChild(meta);

  /* --- ЦИТАТА --- */
  if (recipe.memeQuotes && recipe.memeQuotes.length) {
    card.appendChild(make('p', 'card-quote', '«' + recipe.memeQuotes[0] + '»'));
  }

  /* --- ИНГРЕДИЕНТЫ И РОЛИ --- */
  var ingTitle = make('h3', 'block-title', 'Что лить');
  var ingList = make('ul', 'ing-list');
  for (var i = 0; i < recipe.ingredients.length; i++) {
    var product = recipe.ingredients[i];
    var item = make('li', 'ing-item');
    item.appendChild(make('span', 'ing-name', product.name));
    item.appendChild(make('span', 'ing-amount', product.amount));
    item.appendChild(make('span', 'ing-role', product.role));
    ingList.appendChild(item);
  }
  card.appendChild(ingTitle);
  card.appendChild(ingList);

  /* --- ШАГИ. <details> — раскрывающийся блок: по умолчанию свёрнут,
         по клику на <summary> раскрывается. Работает без единой
         строчки JS. --- */
  var stepsBox = make('details', 'steps-box');
  stepsBox.appendChild(make('summary', 'block-title', 'Как мешать (' +
                                         recipe.steps.length + ' шагов)'));
  var stepsList = make('ol', 'steps-list');
  for (var s = 0; s < recipe.steps.length; s++) {
    stepsList.appendChild(make('li', 'step-item', recipe.steps[s]));
  }
  stepsBox.appendChild(stepsList);
  card.appendChild(stepsBox);

  /* --- ЦИТАТЫ ОСТАЛЬНЫЕ, кавычки уже вписаны в данные ---
     Проверка та же, что и выше: без неё рецепт без поля memeQuotes
     уронил бы всю страницу на обращении к length у undefined. */
  if (recipe.memeQuotes && recipe.memeQuotes.length > 1) {
    var quotes = make('ul', 'quote-list');
    for (var q = 1; q < recipe.memeQuotes.length; q++) {
      quotes.appendChild(make('li', 'quote-item', recipe.memeQuotes[q]));
    }
    card.appendChild(quotes);
  }

  /* --- ХЭШТЕГИ --- */
  var tags = make('ul', 'tag-list');
  for (var t = 0; t < recipe.tags.length; t++) {
    tags.appendChild(make('li', 'tag', recipe.tags[t]));
  }
  card.appendChild(tags);

  /* --- КНОПКА «ЧИТАТЬ». Если поля link нет, карточка самодостаточна:
         рецепт целиком помещается на ней. --- */
  if (recipe.link) {
    var link = make('a', 'btn', 'Читать →');
    link.href = recipe.link;
    card.appendChild(link);
  }

  return card;
}


/* --------------------------------------------------------------------------
   3. ФИЛЬТРЫ
   -------------------------------------------------------------------------- */

/* СОСТОЯНИЕ СТРАНИЦЫ.
   Два поля — что выбрано в каждом ряду кнопок. Кнопки только меняют
   эти значения и перерисовывают сетку: сама сетка ничего не «помнит».
   Один источник правды — state; HTML всегда его отражение. */
var state = { category: 'Все', mmr: 'Все' };


/* СОБРАТЬ РЯД КНОПОК.
   first — первая кнопка ряда («Все»), к ней добавляются значения из
   данных. selected — какая кнопка сейчас активна, ей ставится
   aria-pressed: программа чтения с экрана озвучит «нажата». */
function FilterRow(labelText, values, selected, onPick) {
  var row = make('div', 'filter-row');
  row.appendChild(make('span', 'filter-label', labelText));

  var options = ['Все'].concat(values);
  for (var i = 0; i < options.length; i++) {
    (function (value) {
      var btn = make('button', 'chip', value);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', value === selected ? 'true' : 'false');
      if (value === selected) {
        btn.classList.add('chip-on');
      }
      btn.addEventListener('click', function () {
        onPick(value);
      });
      row.appendChild(btn);
    })(options[i]);
  }
  return row;
}


/* ОТФИЛЬТРОВАТЬ СПИСОК ПО ДВУМ ПРИЗНАКАМ.
   filter принимает ФУНКЦИЮ и оставляет элементы, для которых она
   вернула true. Здесь оставляем запись, если категория совпала ИЛИ
   выбрано «Все» — то же самое с рангом. */
function applyFilters(list) {
  return list.filter(function (recipe) {
    var okCategory = state.category === 'Все' || recipe.category === state.category;
    var okMmr = state.mmr === 'Все' || recipe.mmr === state.mmr;
    return okCategory && okMmr;
  });
}


/* ОТБРОСИТЬ ВСЁ, ЧТО ЗАПРЕЩЕНО ПО ВОЗРАСТУ.
   Работает ДО фильтров: несовершеннолетний не увидит рецепт ни в
   одном ряду кнопок, и число в строке «найдено N» будет честным. */
function byAge(list) {
  if (ageStatus() === 'adult') {
    return list;
  }
  return list.filter(function (recipe) {
    return recipe.ageRestriction !== '18+';
  });
}


/* --------------------------------------------------------------------------
   4. КОМПОНЕНТ MemasikiPage()
   -------------------------------------------------------------------------- */

function MemasikiPage() {
  var root = document.querySelector('#memasiki');
  if (!root) {
    return;
  }
  root.innerHTML = '';

  /* ----- ШАПКА ----- */
  var head = make('header', 'section-head');
  var back = make('a', 'back-link', '← На главную');
  back.href = '../index.html';
  head.appendChild(back);
  head.appendChild(make('h1', 'section-title', '🎮 Мемасики'));
  head.appendChild(make('p', 'section-tagline',
                        'Рецепты, которые пикают на пати. Сложность — в рангах, ' +
                        'фильтры — по категории и MMR.'));
  root.appendChild(head);

  /* ----- ФИЛЬТРЫ -----
     Категории и ранги собираются из самих данных, а не вписаны руками:
     добавил рецепт с новой категорией — кнопка появилась сама.
     Список берётся из byAge(memeRecipes), а не из memeRecipes целиком:
     несовершеннолетнему незачем видеть кнопку «Immortal», если под ней
     не осталось ни одного разрешённого рецепта. */
  var visible = byAge(memeRecipes);
  var categories = [];
  var ranks = [];
  var i, recipe;
  for (i = 0; i < visible.length; i++) {
    recipe = visible[i];
    if (categories.indexOf(recipe.category) === -1) {
      categories.push(recipe.category);
    }
    if (ranks.indexOf(recipe.mmr) === -1) {
      ranks.push(recipe.mmr);
    }
  }
  /* Ранги сортируем по лестнице MMR, а не по алфавиту: Immortal после
     Herald, а не после Legend. */
  ranks.sort(function (a, b) {
    return MMR_LADDER.indexOf(a) - MMR_LADDER.indexOf(b);
  });

  var filters = make('div', 'filters');
  filters.appendChild(FilterRow('Категория', categories, state.category,
    function (value) {
      state.category = value;
      MemasikiPage();
    }));
  filters.appendChild(FilterRow('Сложность (MMR)', ranks, state.mmr,
    function (value) {
      state.mmr = value;
      MemasikiPage();
    }));
  root.appendChild(filters);

  /* ----- СЕТКА КАРТОЧЕК ----- */
  var shown = applyFilters(visible);

  /* Легенда и избранные — первыми, остальные по убыванию ранга. */
  shown.sort(function (a, b) {
    if (a.isFeatured !== b.isFeatured) {
      return a.isFeatured ? -1 : 1;
    }
    return mmrWeight(b) - mmrWeight(a);
  });

  var grid = make('div', 'grid');
  for (i = 0; i < shown.length; i++) {
    grid.appendChild(RecipeCard(shown[i]));
  }
  root.appendChild(grid);

  /* ----- СТРОКА-ИТОГ -----
     Число считается из shown, поэтому не может соврать: оно берётся
     из того же списка, по которому только что нарисованы карточки. */
  var hidden = memeRecipes.length - visible.length;
  var resultText = 'Показано ' + shown.length + ' из ' + memeRecipes.length;
  if (hidden > 0) {
    resultText += ' (скрыто по возрасту: ' + hidden + ')';
  }
  root.appendChild(make('p', 'result', resultText));

  renderAgeGate();
}


/* --------------------------------------------------------------------------
   5. ВОЗРАСТНАЯ ПРОВЕРКА (age gate)
   --------------------------------------------------------------------------

   Спрашиваем один раз, ответ храним в localStorage — маленькое
   хранилище браузера: записал ключ и значение, закрыл вкладку,
   вернулся — значение на месте.

   Три состояния:
     'adult' — ответил «да», видно всё;
     'minor' — ответил «нет», рецепты с ageRestriction '18+' не
               попадают в список вообще, их нет ни в HTML, ни в DOM;
     null    — ещё не отвечал, показываем окно.

   localStorage может быть недоступен (приватный режим Safari,
   некоторые политики браузеров), поэтому всё обёрнуто в try/catch:
   без хранилища страница просто будет спрашивать каждый раз, но
   не упадёт. */

var AGE_KEY = 'memasiki:age';

function ageStatus() {
  try {
    return window.localStorage.getItem(AGE_KEY);
  } catch (e) {
    return null;
  }
}

function saveAgeStatus(value) {
  try {
    window.localStorage.setItem(AGE_KEY, value);
  } catch (e) {
    /* хранилища нет — не страшно, переспросим при следующем заходе */
  }
}

/* ОКНО ВОЗРАСТА.
   Рисуются три разных состояния:
     не ответил → окно с двумя кнопками;
     'minor'    → вместо рецепта замок, список на странице раздела
                  уже отфильтрован функцией byAge;
     'adult'    → ничего лишнего, скрытое возвращается обратно.

   Окно вставляется в контейнер #agegate-slot, а не в #memasiki:
   MemasikiPage перерисовывает #memasiki при каждом клике по фильтру,
   и окно приходилось бы перерисовывать вместе с ним.

   locked — элемент, который надо спрятать несовершеннолетнему.
   На странице раздела его нет, на странице-легенде в нём весь рецепт. */
function renderAgeGate(locked) {
  var slot = document.querySelector('#agegate-slot');
  if (!slot) {
    slot = document.body;
  }
  slot.innerHTML = '';

  var status = ageStatus();

  if (status === 'adult') {
    if (locked) {
      locked.hidden = false;
    }
    return true;
  }

  if (status === 'minor') {
    if (locked) {
      locked.hidden = true;
    }
    var lock = make('div', 'agegate');
    var lockBox = make('div', 'agegate-box');
    lockBox.appendChild(make('h2', 'agegate-title', '🔞 Сюда нельзя без 18'));
    lockBox.appendChild(make('p', 'agegate-text',
                             'Рецепт с алкоголем скрыт. Если возраст всё-таки есть, ' +
                             'нажми «сменить возраст» в подвале страницы.'));
    lock.appendChild(lockBox);
    slot.appendChild(lock);
    return false;
  }

  var gate = make('div', 'agegate');
  var box = make('div', 'agegate-box');
  box.appendChild(make('h2', 'agegate-title', '🔞 Тебе есть 18 лет?'));
  box.appendChild(make('p', 'agegate-text',
                       'В разделе есть рецепты с алкоголем. Пока ответа нет, ' +
                       'они скрыты. Ответ хранится в браузере и меняется ' +
                       'в любой момент.'));

  var yes = make('button', 'btn btn-yes', 'Да, есть');
  yes.type = 'button';
  var no = make('button', 'btn btn-no', 'Нет, мне меньше');
  no.type = 'button';

  /* КЛИК ПО «ДА».
     Сохранили статус → перерисовали окно → перерисовали список.
     Порядок важен: MemasikiPage читает status из localStorage, поэтому
     сначала запись, потом отрисовка. */
  yes.addEventListener('click', function () {
    saveAgeStatus('adult');
    renderAgeGate(locked);
    refreshSection();
  });

  no.addEventListener('click', function () {
    saveAgeStatus('minor');
    renderAgeGate(locked);
    refreshSection();
  });

  box.appendChild(yes);
  box.appendChild(no);
  gate.appendChild(box);
  slot.appendChild(gate);
  return false;
}


/* ПЕРЕРИСОВАТЬ СПИСОК, ЕСЛИ МЫ НА СТРАНИЦЕ РАЗДЕЛА.
   На странице-легенде контейнера #memasiki нет, и там перерисовка
   не нужна — там просто прячется или показывается текст рецепта. */
function refreshSection() {
  if (document.querySelector('#memasiki')) {
    MemasikiPage();
  }
}


/* --------------------------------------------------------------------------
   6. КОМПОНЕНТ MemasikiLegend(contentId)
   --------------------------------------------------------------------------

   Страница-легенда свёрстана в HTML руками: текст один, фильтров нет,
   перерисовывать нечего. От JS здесь нужно ровно одно — проверить
   возраст и, если ответа нет, показать окно. Окно вставляется в
   контейнер #agegate-slot, а контент легенды лежит в #legend-body:
   несовершеннолетнему он получает hidden = true. */

function MemasikiLegend(contentId) {
  var content = document.querySelector('#' + contentId);
  if (!content) {
    return;
  }
  renderAgeGate(content);
}


/* --------------------------------------------------------------------------
   7.5. КАРТИНКИ, КОТОРЫХ ЕЩЁ НЕТ В ПАПКЕ img/

   Картинки карточек создаёт сам app.js, и у них обработчик error висит
   прямо при создании (см. buildCard). А постер на странице-легенде
   вписан в HTML руками — обработать ошибку ему некому, и до появления
   файла браузер показал бы серый значок «не загрузилось».

   Эта функция пробегает по статическим картинкам и убирает те, что не
   загрузились. Под каждой лежит эмодзи, поэтому вместо дырки виден он.

   Как понять, что картинки нет:
     img.complete        — загрузка закончилась (успешно или нет);
     img.naturalWidth    — НАСТОЯЩАЯ ширина файла в пикселях, у
                           несуществующего файла её нет → 0.
   Проверку нельзя написать прямо в цикле на var: переменная в таком
   цикле одна на всех, и обработчик увидел бы последнюю картинку.
   -------------------------------------------------------------------------- */
function hideBrokenLegendPhotos() {
  var imgs = document.querySelectorAll('.legend-photo > img');

  for (var i = 0; i < imgs.length; i++) {
    hideIfBroken(imgs[i]);
  }
}

function hideIfBroken(img) {
  var hide = function () {
    if (img.parentNode) {
      img.parentNode.removeChild(img);
    }
  };

  if (img.complete && img.naturalWidth === 0) {
    hide();
  } else {
    /* Событие error от img вверх не всплывает, поэтому слушаем его на
       самом элементе. */
    img.addEventListener('error', hide);
  }
}


/* --------------------------------------------------------------------------
   7. ЗАПУСК
   --------------------------------------------------------------------------

   defer в <script> гарантирует, что страница уже построена, но
   DOMContentLoaded оставляем как страховку на случай, если файл
   подключат без defer. */
function startMemasiki() {
  hideBrokenLegendPhotos();

  if (document.querySelector('#memasiki')) {
    MemasikiPage();
  }
  if (document.querySelector('#legend-body')) {
    MemasikiLegend('legend-body');
  }

  /* Кнопка «сменить возраст» в подвале: очищает ответ и переспрашивает. */
  var reset = document.querySelector('#age-reset');
  if (reset) {
    reset.addEventListener('click', function () {
      try {
        window.localStorage.removeItem(AGE_KEY);
      } catch (e) {
        /* нет хранилища — перерисуем как есть */
      }
      if (document.querySelector('#memasiki')) {
        MemasikiPage();
      } else {
        MemasikiLegend('legend-body');
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startMemasiki);
} else {
  startMemasiki();
}
