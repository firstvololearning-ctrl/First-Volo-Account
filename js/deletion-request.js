(async function () {
  'use strict';
  const client = window.FirstVoloAccountSupabase?.client;
  const el = id => document.getElementById(id);
  let userId = null, invalid = false, busy = false;
  const message = text => { if (!invalid) el('message').textContent = text; };
  function clear() {
    invalid = true; userId = null;
    el('signedIn').hidden = true; el('historySection').hidden = true;
    el('learner').replaceChildren(); el('history').replaceChildren();
    el('confirmation').value = '';
    el('identity').textContent = 'Sign-in changed. Return to My First Volo and sign in again.';
    el('message').textContent = '';
  }
  async function rows(table, fields, order) {
    const all = [];
    for (let start = 0; ; start += 100) {
      const result = await client.from(table).select(fields).eq('owner_user_id', userId).order(order).order('id').range(start, start + 99);
      if (invalid) return [];
      if (result.error) throw result.error;
      all.push(...result.data);
      if (result.data.length < 100) return all;
    }
  }
  async function refresh() {
    const [students, requests] = await Promise.all([
      rows('students','id,display_name,archived_at','display_name'),
      rows('student_deletion_requests','id,student_id,requested_at,delete_after,status,resolved_at','requested_at')
    ]);
    if (invalid) return;
    const labels = new Map(students.map(s => [s.id, s.display_name]));
    const pending = new Set(requests.filter(r => r.status === 'pending').map(r => r.student_id));
    el('learner').replaceChildren();
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Select a learner'; el('learner').append(placeholder);
    for (const s of students.filter(s => !pending.has(s.id))) {
      const option = document.createElement('option'); option.value = s.id;
      option.textContent = s.display_name + (s.archived_at ? ' (archived)' : ''); el('learner').append(option);
    }
    el('submitDeletion').disabled = busy || !students.some(s => !pending.has(s.id));
    el('history').replaceChildren();
    for (const request of requests.slice().reverse()) {
      const item = document.createElement('li');
      const deadline = new Date(request.delete_after);
      const pendingStatus = Date.now() < deadline.getTime() ? 'Recovery period' : 'Awaiting permanent deletion';
      item.textContent = `${labels.get(request.student_id) || 'Learner record'} — ${request.status === 'pending' ? pendingStatus : request.status === 'completed' ? 'Completed' : 'Cancelled'}. Requested ${new Date(request.requested_at).toLocaleString()}. Cancellation deadline: ${deadline.toLocaleString()}. `;
      if (request.status === 'pending' && Date.now() < deadline.getTime()) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Cancel deletion'; button.className = 'button button-secondary';
        button.addEventListener('click', async () => {
          if (invalid || busy) return;
          busy = true; button.disabled = true;
          try {
            const result = await client.rpc('cancel_student_deletion',{p_request_id:request.id});
            if (invalid) return;
            if (result.error) throw result.error;
            message('Deletion cancelled.');
            await refresh();
          } catch (_) { message('Cancellation could not be confirmed. Refresh to check the status; the recovery deadline may have passed.'); }
          finally { busy = false; if (!invalid) { button.disabled = false; el('submitDeletion').disabled = el('learner').options.length <= 1; } }
        });
        item.append(button);
      }
      el('history').append(item);
    }
    if (!requests.length) el('history').textContent = 'No deletion requests.';
    el('signedIn').hidden = false; el('historySection').hidden = false;
  }
  el('deletionForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (invalid || busy || !userId || !el('learner').value || el('confirmation').value !== 'DELETE') return;
    busy = true; el('submitDeletion').disabled = true;
    message('Submitting deletion request…');
    let saved = false;
    try {
      const result = await client.rpc('request_student_deletion',{p_student_id:el('learner').value,p_confirmation:'DELETE'});
      if (invalid) return;
      if (result.error) throw result.error;
      saved = true; el('confirmation').value = '';
      await refresh();
      message('Deletion requested. The 30-day cancellation deadline is shown below.');
    } catch (_) { message(saved ? 'Your request was saved, but the list could not refresh. Reload to see the deadline.' : 'The request could not be confirmed. Reload to check before trying again.'); }
    finally { busy = false; if (!invalid) el('submitDeletion').disabled = el('learner').options.length <= 1; }
  });
  try {
    if (!client) throw new Error('Unavailable');
    const result = await client.auth.getUser();
    if (result.error || !result.data.user || result.data.user.is_anonymous) {
      el('identity').textContent = 'Sign in to your educator account through My First Volo to manage deletion requests.'; return;
    }
    userId = result.data.user.id;
    client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || session?.user?.id !== userId) clear(); });
    if (invalid) return;
    el('identity').textContent = 'Signed in as ' + result.data.user.email;
    await refresh();
  } catch (_) { message('Could not load your learner records. Reload or return to My First Volo to sign in.'); }
}());
