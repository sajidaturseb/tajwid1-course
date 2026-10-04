(() => {
  'use strict';
  const endpoint = 'https://kxwhwmxzmtvueksyayvz.supabase.co/functions/v1/submit-tajwid1-quiz';
  const $ = id => document.getElementById(id);
  let pin = '';
  let all = [];

  async function load() {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-teacher-pin': pin },
      body: JSON.stringify({ action: 'list' })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'request_failed');
    all = Array.isArray(payload.results) ? payload.results : [];
    fillFilters();
    render();
  }

  function fillFilters() {
    const previousGroup = $('groupFilter').value;
    const previousLesson = $('lessonFilter').value;
    $('groupFilter').replaceChildren(new Option('Барлык төркемнәр', ''));
    $('lessonFilter').replaceChildren(new Option('Барлык дәресләр', ''));
    [...new Set(all.map(row => row.student_group))].sort().forEach(group => $('groupFilter').add(new Option(group, group)));
    [...new Set(all.map(row => Number(row.lesson_id)))].sort((a, b) => a - b).forEach(id => $('lessonFilter').add(new Option(`${id} нче дәрес`, String(id))));
    $('groupFilter').value = previousGroup;
    $('lessonFilter').value = previousLesson;
  }

  function filtered() {
    return all.filter(row => (!$('groupFilter').value || row.student_group === $('groupFilter').value)
      && (!$('lessonFilter').value || String(row.lesson_id) === $('lessonFilter').value));
  }

  function render() {
    const rows = filtered();
    $('count').textContent = `${rows.length} нәтиҗә`;
    $('rows').replaceChildren();
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.textContent = 'Нәтиҗәләр юк.';
      tr.append(td);
      $('rows').append(tr);
    }
    rows.forEach(row => {
      const tr = document.createElement('tr');
      for (const value of [new Date(row.submitted_at).toLocaleString('ru-RU'), row.student_name,
        row.student_group, `${row.lesson_id}. ${row.lesson_title}`, `${row.score} / ${row.total}`]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      const td = document.createElement('td');
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Карарга';
      (row.answers || []).forEach(item => {
        const answer = document.createElement('p');
        answer.className = 'answer';
        answer.textContent = `${item.number}. ${item.isCorrect ? 'Дөрес' : 'Хата'} · сайланган: ${['А', 'Б', 'В'][item.selected]} · дөрес: ${['А', 'Б', 'В'][item.correct]}`;
        details.append(answer);
      });
      details.prepend(summary);
      td.append(details);
      tr.append(td);
      $('rows').append(tr);
    });
  }

  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    pin = $('teacherPin').value.trim();
    $('loginError').textContent = '';
    try {
      await load();
      $('teacherPin').value = '';
      $('loginPanel').hidden = true;
      $('dashboard').hidden = false;
    } catch (error) {
      $('loginError').textContent = error.message === 'invalid_pin' ? 'PIN-код дөрес түгел.' : 'Журналны ачып булмады.';
    }
  });
  $('refreshBtn').addEventListener('click', async () => {
    $('refreshBtn').disabled = true;
    $('loadError').textContent = '';
    try { await load(); }
    catch { $('loadError').textContent = 'Нәтиҗәләрне яңартып булмады.'; }
    finally { $('refreshBtn').disabled = false; }
  });
  $('groupFilter').addEventListener('change', render);
  $('lessonFilter').addEventListener('change', render);
  $('csvBtn').addEventListener('click', () => {
    const data = [['Вакыт', 'Укучы', 'Төркем', 'Дәрес', 'Тема', 'Балл', 'Барлыгы', 'Җаваплар'],
      ...filtered().map(row => [row.submitted_at, row.student_name, row.student_group, row.lesson_id,
        row.lesson_title, row.score, row.total, (row.answers || []).map(item => `${item.number}: ${['А', 'Б', 'В'][item.selected]}`).join('; ')])];
    const csv = data.map(line => line.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tajwid1-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
