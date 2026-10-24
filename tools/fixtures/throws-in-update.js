// test fixture: loads fine, then throws every frame -> host must fall back after a few errors
export default { id: 'thrower', name: 'Thrower', apiVersion: 1, create() { return { update() { throw new Error('boom'); }, dispose() { } }; } };
