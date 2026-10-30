(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const lang = params.get('lang') === 'ru' ? 'ru' : 'tt';
  const ttLessons = Array.isArray(window.COURSE_DATA) ? window.COURSE_DATA : [];
  const ruLessons = Array.isArray(window.COURSE_DATA_RU) ? window.COURSE_DATA_RU : [];
  const lessons = lang === 'ru' ? ruLessons : ttLessons;
  const byNumber = new Map(lessons.map(lesson => [lesson.n, lesson]));
  const ttByNumber = new Map(ttLessons.map(lesson => [lesson.n, lesson]));
  const requested = Number(params.get('lesson'));
  let current = byNumber.get(requested) || lessons[0];
  let reviewIndex = 0;
  let quizIndex = 0;
  let quizAnswers = [];
  let checked = false;
  let startedAt = 0;
  let attemptId = '';
  let sent = false;
  const resultsEndpoint = 'https://kxwhwmxzmtvueksyayvz.supabase.co/functions/v1/submit-tajwid1-quiz';
  const localPreview = location.protocol === 'file:' || ['127.0.0.1', 'localhost'].includes(location.hostname);
  const $ = id => document.getElementById(id);
  const tr = (tt, ru) => lang === 'ru' ? ru : tt;

  function setupLanguage() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-ru]').forEach(element => {
      if (lang === 'ru') element.textContent = element.dataset.ru;
    });
    for (const [id, choice] of [['langTt', 'tt'], ['langRu', 'ru']]) {
      const url = new URL(location.href);
      if (choice === 'ru') url.searchParams.set('lang', 'ru');
      else url.searchParams.delete('lang');
      $(id).href = url.toString();
      if (choice === lang) $(id).setAttribute('aria-current', 'page');
    }
    if (lang !== 'ru') return;
    const staticText = [
      ['#home > .grid > div > .eyebrow', 'Таджвид 1'],
      ['#home > .grid > div > h1', 'Уроки и проверка знаний'],
      ['#home > .grid > div > .lead', 'В каждом из 25 уроков прочитайте теорию, повторите материал по пяти вопросам и пройдите тест из семи вопросов. Произношение учитель проверяет отдельно на занятии.'],
      ['#home .teacher > .eyebrow', 'Для учителя'],
      ['#home .teacher > h2', 'Ссылка на урок'],
      ['#home .teacher > p:nth-of-type(2)', 'Выберите урок и группу, затем отправьте ученику готовую ссылку.'],
      ['#copyLinkBtn', 'Скопировать ссылку'],
      ['#home .teacher > p:last-of-type a', 'Журнал результатов →'],
      ['#intro > .eyebrow', 'Текст урока'],
      ['#intro > .summary', 'Прочитав текст, попробуйте самостоятельно ответить на пять вопросов и сравните ответы с готовыми. Затем начнётся тест из семи вопросов.'],
      ['#startReviewBtn', 'Перейти к вопросам'],
      ['#review > .eyebrow', 'Повторение по вопросам'],
      ['#review > .lead', 'Сначала подумайте над ответом сами, затем сравните с готовым ответом.'],
      ['#reviewAnswer > strong', 'Ответ'],
      ['#showAnswerBtn', 'Посмотреть ответ'],
      ['#identity > .eyebrow', 'Сведения об ученике'],
      ['#identity > h2', 'Кто проходит тест?'],
      ['#identity > .lead', 'Напишите имя и фамилию и выберите группу, чтобы результат был виден в журнале.'],
      ['#startTestBtn', 'Начать тест'],
      ['#result > .eyebrow', 'Урок завершён'],
      ['#result > h1', 'Машааллах, вы прошли урок!'],
      ['#result .score span', 'Верных ответов'],
      ['#retryBtn', 'Пройти ещё раз']
    ];
    for (const [selector, value] of staticText) document.querySelector(selector).textContent = value;
    const teacherLabels = document.querySelectorAll('#home .teacher label.field');
    teacherLabels[0].firstChild.textContent = 'Урок';
    teacherLabels[1].firstChild.textContent = 'Группа';
    const identityLabels = document.querySelectorAll('#identity label.field');
    identityLabels[0].firstChild.textContent = 'Имя и фамилия';
    identityLabels[1].firstChild.textContent = 'Группа';
    document.title = 'Таджвид 1';
  }
  function fillGroupSelect(id, placeholder) {
    const select = $(id);
    select.add(new Option(placeholder, ''));
    const addBlock = (label, count, prefix = label) => {
      const block = document.createElement('optgroup');
      block.label = label;
      for (let number = 1; number <= count; number++) {
        const value = `${prefix} — ${number} группа`;
        block.append(new Option(value, value));
      }
      select.add(block);
    };
    for (let course = 1; course <= 4; course++) {
      addBlock(`${course} курс`, 8);
      addBlock(`Онлайн ${course} курс`, 10);
    }
    for (const direction of ['Дагват', 'Мәгърифәт', 'Остазлар']) {
      addBlock(`${direction}, 1 курс`, 3);
    }
    addBlock('Коръән уку мәктәбе', 10);
  }
  const screens = ['home', 'intro', 'review', 'identity', 'quiz', 'result'];
  const stageNames = {
    intro: tr('Дәрес белән танышу', 'Знакомство с уроком'),
    review: tr('Сораулар аша кабатлау', 'Повторение по вопросам'),
    identity: tr('Укучы турында мәгълүмат', 'Сведения об ученике'),
    quiz: tr('Белемне тикшерү', 'Проверка знаний'),
    result: tr('Дәрес тәмам', 'Урок завершён')
  };

  function show(screen) {
    screens.forEach(name => $(name).classList.toggle('hidden', name !== screen));
    $('progress').classList.toggle('hidden', screen === 'home');
    if (screen !== 'home') {
      const step = screens.indexOf(screen);
      $('stageName').textContent = stageNames[screen];
      $('stageCount').textContent = `${step} / 5`;
      $('stageFill').style.width = `${step * 20}%`;
    }
    window.scrollTo(0, 0);
  }

  function setupHome() {
    const cards = $('lessonCards');
    lessons.forEach(lesson => {
      const link = document.createElement('a');
      link.className = 'card';
      link.href = `?lesson=${lesson.n}${lang === 'ru' ? '&lang=ru' : ''}`;
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = lesson.n;
      const title = document.createElement('strong');
      title.textContent = lesson.title;
      link.append(number, title);
      cards.append(link);
      const option = document.createElement('option');
      option.value = lesson.n;
      option.textContent = `${lesson.n}. ${lesson.title}`;
      $('teacherLesson').append(option);
    });
    if (current) $('teacherLesson').value = current.n;
  }

  function setupLesson() {
    if (!current) return;
    $('introTitle').textContent = current.title;
    $('introGoal').textContent = current.goal;
    const reading = $('lessonReading');
    reading.replaceChildren();
    if (current.intro) {
      const intro = document.createElement('p');
      intro.textContent = current.intro;
      reading.append(intro);
    }
    current.sections.forEach(section => {
      const wrap = document.createElement('section');
      const heading = document.createElement('h3');
      heading.textContent = section.title;
      wrap.append(heading);
      if (section.note) {
        const note = document.createElement('p');
        note.className = 'note-text';
        note.textContent = section.note;
        wrap.append(note);
      }
      let readingBlock;
      section.paragraphs.forEach((value, index) => {
        if (index % 2 === 0) {
          readingBlock = document.createElement('div');
          readingBlock.className = `reading-block reading-block-${Math.floor(index / 2) % 3 + 1}`;
          wrap.append(readingBlock);
        }
        const paragraph = document.createElement('p');
        paragraph.textContent = value;
        readingBlock.append(paragraph);
      });
      reading.append(wrap);
    });
    if (current.sources) {
      const sources = document.createElement('p');
      sources.className = 'source';
      sources.textContent = `${tr('Таяныч чыганаклар', 'Источники')}: ${current.sources}`;
      reading.append(sources);
    }
    if (byNumber.has(requested)) {
      document.title = tr(`${current.n} нче дәрес — Тәҗвид 1`, `Урок ${current.n} — Таджвид 1`);
      $('coursePill').textContent = tr(`${current.n} нче дәрес`, `Урок ${current.n}`);
    } else {
      $('coursePill').textContent = tr('25 дәрес', '25 уроков');
    }
  }

  function lessonUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('lesson', $('teacherLesson').value);
    if (lang === 'ru') url.searchParams.set('lang', 'ru');
    const group = $('teacherGroup').value.trim();
    if (group) url.searchParams.set('group', group);
    return url.toString();
  }

  async function copyText(text, fallbackInput) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      if (fallbackInput) {
        fallbackInput.value = text;
        fallbackInput.classList.remove('hidden');
        fallbackInput.focus();
        fallbackInput.select();
      }
      return false;
    }
  }

  function renderReview() {
    const item = current.study[reviewIndex];
    $('reviewCounter').textContent = `${reviewIndex + 1} / ${current.study.length}`;
    $('reviewQuestion').textContent = `${reviewIndex + 1}. ${item.q}`;
    $('reviewAnswerText').textContent = item.a;
    $('reviewAnswer').classList.add('hidden');
    $('showAnswerBtn').classList.remove('hidden');
    $('nextReviewBtn').classList.add('hidden');
    $('nextReviewBtn').textContent = reviewIndex === current.study.length - 1
      ? tr('Тестка әзерләнергә', 'Перейти к тесту')
      : tr('Киләсе сорау', 'Следующий вопрос');
  }

  function renderQuiz() {
    checked = false;
    $('quizError').classList.add('hidden');
    $('quizFeedback').classList.add('hidden');
    $('quizOptions').replaceChildren();
    $('quizEyebrow').textContent = `${tr('Тест', 'Тест')} · ${quizIndex + 1} / ${current.questions.length}`;
    $('nextQuizBtn').textContent = tr('Тикшерергә', 'Проверить');
    const item = current.questions[quizIndex];
    $('quizQuestion').textContent = item.q;
    item.o.forEach((answer, index) => {
      const label = document.createElement('label');
      label.className = 'option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'choice';
      input.value = String(index);
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = ['А', 'Б', 'В'][index];
      const text = document.createElement('span');
      text.textContent = answer;
      label.append(input, letter, text);
      $('quizOptions').append(label);
    });
  }

  function finish() {
    const right = current.questions.map((question, index) => Number(quizAnswers[index] === question.a));
    $('scoreText').textContent = `${right.reduce((a, b) => a + b, 0)} / ${current.questions.length}`;
    $('resultText').textContent = `${$('studentName').value.trim()} · ${$('studentGroup').value.trim()}. ${tr('Җавапларны карап, дәресне кабат үтәргә мөмкин.', 'Вы можете просмотреть ответы и пройти урок ещё раз.')}`;
    $('sendResultBtn').classList.add('hidden');
    $('sendInstruction').innerHTML = tr('<strong>Сез тестны үттегез.</strong> Нәтиҗә укытучы журналына җибәрелә…', '<strong>Вы прошли тест.</strong> Результат передаётся в журнал учителя…');
    $('resultSendNote').textContent = '';
    show('result');
    if (localPreview) {
      $('sendInstruction').innerHTML = tr('<strong>Бу — карау өчен үрнәк.</strong> Әлегә нәтиҗә укытучы журналына җибәрелми.', '<strong>Это местный просмотр.</strong> Результат не отправляется в журнал учителя.');
    } else {
      void sendResult();
    }
  }

  if (!current || lessons.length !== 25) {
    document.querySelector('main').textContent = tr('Дәрес мәгълүматларын йөкләп булмады.', 'Не удалось загрузить уроки.');
    return;
  }
  setupLanguage();
  setupHome();
  setupLesson();
  fillGroupSelect('teacherGroup', tr('Группу выберет ученик', 'Группу выберет ученик'));
  fillGroupSelect('studentGroup', tr('Выберите группу', 'Выберите группу'));
  const presetGroup = params.get('group') || '';
  if ([...$('studentGroup').options].some(option => option.value === presetGroup && presetGroup)) {
    $('studentGroup').value = presetGroup;
  }

  $('copyLinkBtn').addEventListener('click', async () => {
    const copied = await copyText(lessonUrl(), $('teacherLink'));
    $('copyNote').textContent = copied
      ? tr('Сылтама күчереп алынды.', 'Ссылка скопирована.')
      : tr('Сылтаманы астагы юлдан күчереп алыгыз.', 'Скопируйте ссылку из поля ниже.');
  });
  for (const id of ['teacherLesson', 'teacherGroup']) {
    $(id).addEventListener('change', () => {
      $('teacherLink').classList.add('hidden');
      $('copyNote').textContent = '';
    });
  }
  $('startReviewBtn').addEventListener('click', () => { reviewIndex = 0; renderReview(); show('review'); });
  $('showAnswerBtn').addEventListener('click', () => {
    $('reviewAnswer').classList.remove('hidden');
    $('showAnswerBtn').classList.add('hidden');
    $('nextReviewBtn').classList.remove('hidden');
  });
  $('nextReviewBtn').addEventListener('click', () => {
    if (++reviewIndex < current.study.length) { renderReview(); window.scrollTo(0, 0); }
    else show('identity');
  });
  $('startTestBtn').addEventListener('click', () => {
    if (!$('studentName').value.trim() || !$('studentGroup').value.trim()) {
      $('identityError').textContent = tr('Исем-фамилияне языгыз һәм группаны сайлагыз.', 'Напишите имя и фамилию и выберите группу.');
      $('identityError').classList.remove('hidden');
      return;
    }
    $('identityError').classList.add('hidden');
    quizIndex = 0;
    quizAnswers = Array(current.questions.length).fill(null);
    startedAt = Date.now();
    attemptId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sent = false;
    renderQuiz();
    show('quiz');
  });
  $('nextQuizBtn').addEventListener('click', () => {
    if (quizIndex < current.questions.length) {
      if (checked) {
        quizIndex++;
        if (quizIndex === current.questions.length) finish();
        else { renderQuiz(); window.scrollTo(0, 0); }
        return;
      }
      const chosen = document.querySelector('input[name="choice"]:checked');
      if (!chosen) {
        $('quizError').textContent = tr('Бер җавапны сайлагыз.', 'Выберите один ответ.');
        $('quizError').classList.remove('hidden');
        return;
      }
      const selected = Number(chosen.value);
      const item = current.questions[quizIndex];
      const correct = selected === item.a;
      quizAnswers[quizIndex] = selected;
      checked = true;
      document.querySelectorAll('.option').forEach((option, index) => {
        option.classList.add('locked');
        option.querySelector('input').disabled = true;
        if (index === item.a) option.classList.add('correct');
        if (index === selected && !correct) option.classList.add('wrong');
      });
      $('quizFeedback').className = `feedback ${correct ? 'right' : 'wrong'}`;
      $('feedbackTitle').textContent = correct
        ? tr('Дөрес җавап!', 'Верный ответ!')
        : tr('Бу җавап дөрес түгел.', 'Этот ответ неверный.');
      $('feedbackText').textContent = `${tr('Дөрес җавап', 'Правильный ответ')}: ${item.o[item.a]}`;
      $('quizError').classList.add('hidden');
      $('nextQuizBtn').textContent = tr('Алга', 'Далее');
      return;
    }
  });
  async function sendResult() {
    if (sent) return;
    const button = $('sendResultBtn');
    button.disabled = true;
    button.textContent = tr('Җибәрелә…', 'Отправляется…');
    $('resultSendNote').textContent = tr('Нәтиҗә җибәрелә, бераз көтегез.', 'Подождите, результат отправляется.');
    const score = current.questions.reduce((sum, question, index) => sum + Number(quizAnswers[index] === question.a), 0);
    const payload = {
      attemptId,
      studentName: $('studentName').value.trim(),
      group: $('studentGroup').value.trim(),
      lessonId: current.n,
      lessonTitle: ttByNumber.get(current.n)?.title || current.title,
      score,
      total: current.questions.length,
      durationSeconds: Math.min(86400, Math.max(1, Math.round((Date.now() - startedAt) / 1000))),
      answers: current.questions.map((question, index) => ({
        number: index + 1,
        selected: quizAnswers[index],
        correct: question.a,
        isCorrect: quizAnswers[index] === question.a
      }))
    };
    try {
      const response = await fetch(resultsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'send_failed');
      sent = true;
      button.textContent = tr('Җибәрелде', 'Отправлено');
      $('sendInstruction').innerHTML = tr('<strong>Нәтиҗә җибәрелде.</strong> Ул укытучы журналында сакланды.', '<strong>Результат записан.</strong> Он сохранён в журнале учителя.');
      $('resultSendNote').textContent = tr('Нәтиҗә укытучы журналына җибәрелде. Башка бернәрсә эшләргә кирәкми.', 'Результат сохранён в журнале учителя. Больше ничего делать не нужно.');
      button.classList.add('hidden');
    } catch {
      button.disabled = false;
      button.textContent = tr('Кабат җибәрергә', 'Отправить ещё раз');
      button.classList.remove('hidden');
      $('sendInstruction').innerHTML = tr('<strong>Нәтиҗә әлегә җибәрелмәде.</strong> Кабат җибәрү төймәсенә басыгыз.', '<strong>Результат пока не записан.</strong> Нажмите «Отправить ещё раз».');
      $('resultSendNote').textContent = tr('Нәтиҗә җибәрелмәде. Интернетны тикшереп, кабат басыгыз.', 'Проверьте соединение и повторите отправку.');
    }
  }
  $('sendResultBtn').addEventListener('click', sendResult);
  $('retryBtn').addEventListener('click', () => {
    if (!sent && !confirm(tr('Нәтиҗә әле укытучыга җибәрелмәде. Чыннан да кабат үтәргәме?', 'Результат ещё не записан в журнале учителя. Начать урок заново?'))) return;
    reviewIndex = quizIndex = 0;
    quizAnswers = [];
    show('intro');
  });
  show(byNumber.has(requested) ? 'intro' : 'home');
})();
