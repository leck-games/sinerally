// test fixture: wrong apiVersion -> host must reject it and fall back to the default plugin
export default { id: 'bad-version', name: 'Bad version', apiVersion: 99, create() { return { update() { }, dispose() { } }; } };
