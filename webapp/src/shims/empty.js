// Minimal empty shim for Node built-ins that should not be used in browser
// contexts. Exports an empty object to satisfy imports during bundling.
const empty = {};
export default empty;
module.exports = empty;
