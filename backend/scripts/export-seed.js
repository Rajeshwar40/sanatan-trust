// Snapshots the current database into seed.js format.
// Run this before pushing to GitHub if any admin edits happened since the last
// push — the free Render tier has no persistent disk, so every redeploy
// reseeds from seed.js. Baking current data in here means a redeploy keeps
// whatever's real right now instead of rolling back to old placeholder data.
//
// Usage: node scripts/export-seed.js
// Then paste the printed SEED_MEMBERS / SEED_MONTHS / SEED_CONTRIBS blocks
// into seed.js, replacing the existing ones.

const db = require('../db');

const members = db.prepare('SELECT id, name FROM members ORDER BY sort_order').all();
const months = db.prepare('SELECT id, name, year FROM months ORDER BY year, sort_order').all();
const rows = db.prepare('SELECT member_id, month_id, status, amount FROM contributions').all();

const valueByKey = {};
rows.forEach(r => {
  const value = (r.status === 'paid' || r.status === 'extra') ? r.amount : r.status;
  valueByKey[`${r.member_id}|${r.month_id}`] = value;
});

let out = '';
out += 'const SEED_MEMBERS = [\n  ';
out += members.map(m => JSON.stringify(m.name)).join(',');
out += '\n];\n\n';

out += 'const SEED_MONTHS = [\n';
months.forEach(mo => {
  out += `  { name: ${JSON.stringify(mo.name)}, year: ${mo.year} },\n`;
});
out += '];\n\n';

out += 'const SEED_CONTRIBS = {\n';
members.forEach(m => {
  const vals = months.map(mo => JSON.stringify(valueByKey[`${m.id}|${mo.id}`] ?? 'na'));
  out += `  ${JSON.stringify(m.name)}: [${vals.join(',')}],\n`;
});
out += '};\n';

console.log(out);
