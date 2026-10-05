const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function fixture(hosted = false) {
  let role = 'administrator';
  let state = { conversations: [], announcements: [] };
  const calls = [];
  const context = vm.createContext({
    structuredClone, console,
    authService: { getCurrentUser: () => ({ id: role === 'administrator' ? 'admin' : '2' }), currentUserName: () => 'Actor' },
    authorizationService: { currentRole: () => role },
    crewService: { getAll: () => [1, 2, 3].map(id => ({ id, name: `Umpire ${id}`, active: true })) },
    repositoryProvider: { get: () => ({ read: () => state, write: value => { state = value; } }) },
    updateMessageBadge: () => {},
    supabaseClientService: { isConfigured: () => hosted, getClient: async () => ({ rpc: async (name, input) => { calls.push({ name, input }); return { data: name === 'get_message_center' ? { conversations: [], announcements: [], recipients: [] } : [], error: null }; } }) }
  });
  vm.runInContext(fs.readFileSync('js/repositories/supabaseMessagingRepository.js', 'utf8') + '\n' + fs.readFileSync('js/services/messagingService.js', 'utf8') + '\nglobalThis.service = messagingService;', context);
  return { service: context.service, calls, state: () => state, setRole: value => { role = value; } };
}
test('three selected umpires have separate threads; another umpire sees only their thread', async () => {
  const f = fixture();
  assert.equal((await f.service.sendDirectToRecipients({ umpireProfileIds: ['1', '2', '3'], body: 'Confirm', subject: 'Weekend' })).success, true);
  assert.equal(f.state().conversations.length, 3);
  f.setRole('umpire'); await f.service.hydrate();
  assert.equal(f.service.getCenter().conversations.length, 1);
  assert.equal(String(f.service.getCenter().conversations[0].umpireProfileId), '2');
});
test('invalid recipient writes nothing; duplicates produce one message; umpire batch calls are rejected', async () => {
  const f = fixture();
  assert.equal((await f.service.sendDirectToRecipients({ umpireProfileIds: ['1', 'missing'], body: 'Confirm' })).success, false);
  assert.equal(f.state().conversations.length, 0);
  await f.service.sendDirectToRecipients({ umpireProfileIds: ['1', '1'], body: 'Confirm' });
  assert.equal(f.state().conversations[0].messages.length, 1);
  f.setRole('umpire');
  assert.equal((await f.service.sendDirectToRecipients({ umpireProfileIds: ['1'], body: 'Confirm' })).success, false);
});
test('hosted send uses one batch RPC with deduplicated IDs and refreshes only after success', async () => {
  const f = fixture(true);
  const result = await f.service.sendDirectToRecipients({ umpireProfileIds: ['1', '2', '2', '3'], body: 'Confirm', subject: 'Weekend' });
  assert.equal(result.success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), [
    { name: 'send_direct_messages', input: { p_body: 'Confirm', p_umpire_profile_ids: ['1', '2', '3'], p_subject: 'Weekend' } },
    { name: 'get_message_center' }
  ]);
});

test('deleting a message hides it only for the caller and keeps later messages visible', async () => {
  const f = fixture();
  await f.service.sendDirectToRecipients({ umpireProfileIds: ['2'], body: 'Original' });
  const messageId = f.service.getCenter().conversations[0].messages[0].id;
  assert.equal((await f.service.deleteMessage({messageId})).success, true);
  assert.equal(f.service.getCenter().conversations.length, 0);
  f.setRole('umpire'); await f.service.hydrate();
  assert.equal(f.service.getCenter().conversations[0].messages[0].body, 'Original');
  await f.service.sendDirect({body:'Reply'});
  f.setRole('administrator'); await f.service.hydrate();
  assert.deepEqual(f.service.getCenter().conversations[0].messages.map(m=>m.body), ['Reply']);
});
