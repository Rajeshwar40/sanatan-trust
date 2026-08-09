const bcrypt = require('bcryptjs');
const { db } = require('./db');

const DEFAULT_USER = process.env.ADMIN_USER || 'admin';
const DEFAULT_PASS = process.env.ADMIN_PASS || 'seva@2024';

const SEED_MEMBERS = [
  'Arjun Sambyal Bhaiya','Bhanu Jamwal','Chitranjan Smabyal',
  'Mohit Sharma','Navdeep Billoria','Rahul Singh',
  'Rajeshwar Singh','Rohit Sharma','Sanjay Singh',
  'Sahil Sharma','Shubham Gupta','Shivanshu Sharma',
  'Sohit Manhas','Tarun Sharma','Vishal Sharma',
  'Vikrant Andotra','Pankaj','Bhaskar','Varinder'
];
const SEED_MONTHS = [
  { name: 'Aug',  year: 2025 },
  { name: 'Sept', year: 2025 },
  { name: 'Oct',  year: 2025 },
  { name: 'Nov',  year: 2025 },
  { name: 'Dec',  year: 2025 },
  { name: 'Jan',  year: 2026 },
  { name: 'Feb',  year: 2026 },
  { name: 'Mar',  year: 2026 },
  { name: 'Apr',  year: 2026 },
  { name: 'May',  year: 2026 },
  { name: 'Jun',  year: 2026 },
  { name: 'Jul',  year: 2026 },
  { name: 'Aug',  year: 2026 },
];

// Blank cells in the trust's ledger mean "pending" (still owed), not "not applicable".
const SEED_CONTRIBS = {
  'Arjun Sambyal Bhaiya': [500,500,500,500,500,500,500,'pending','pending','pending','pending','pending','pending'],
  'Bhanu Jamwal':         [500,500,500,500,500,500,500,500,'pending','pending','pending','pending','pending'],
  'Chitranjan Smabyal':   [500,500,500,500,500,500,'pending','pending','pending','pending','pending','pending','pending'],
  'Mohit Sharma':         [500,500,550,500,500,500,500,500,500,500,500,500,'pending'],
  'Navdeep Billoria':     [500,500,500,500,500,500,500,500,500,500,'pending','pending','pending'],
  'Rahul Singh':          [500,500,500,500,500,500,500,500,500,'pending','pending','pending','pending'],
  'Rajeshwar Singh':      [500,1100,500,500,500,500,500,500,500,500,500,500,500],
  'Rohit Sharma':         [500,500,500,500,500,500,500,500,500,500,500,500,500],
  'Sanjay Singh':         [500,500,500,500,500,500,500,500,500,500,500,500,500],
  'Sahil Sharma':         [500,500,500,500,500,500,500,500,500,500,500,500,500],
  'Shubham Gupta':        [500,500,500,500,500,500,500,500,500,500,500,'pending','pending'],
  'Shivanshu Sharma':     [500,500,1000,500,500,500,1000,500,500,500,500,500,'pending'],
  'Sohit Manhas':         [500,500,500,500,500,500,500,500,500,'pending','pending','pending','pending'],
  'Tarun Sharma':         [500,500,500,500,500,500,500,500,500,500,500,500,500],
  'Vishal Sharma':        [500,500,500,500,500,500,500,500,500,500,'pending','pending','pending'],
  'Vikrant Andotra':      [500,500,550,500,500,500,500,500,500,500,500,500,500],
  'Pankaj':               [500,500,500,500,500,500,'pending','pending','pending','pending','pending','pending','pending'],
  'Bhaskar':              [500,500,500,500,500,500,500,500,500,500,500,500,'pending'],
  'Varinder':             [500,500,500,500,500,500,500,500,500,500,'pending','pending','pending'],
};

async function seed() {
  const memberCount = (await db.execute('SELECT COUNT(*) c FROM members')).rows[0].c;
  if (memberCount > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  const tx = await db.transaction('write');
  try {
    const memberIds = {};
    const monthIdsByIndex = [];

    for (let i = 0; i < SEED_MEMBERS.length; i++) {
      const name = SEED_MEMBERS[i];
      const info = await tx.execute({
        sql: 'INSERT INTO members (name, sort_order) VALUES (?, ?)',
        args: [name, i],
      });
      memberIds[name] = Number(info.lastInsertRowid);
    }

    for (let i = 0; i < SEED_MONTHS.length; i++) {
      const mo = SEED_MONTHS[i];
      const info = await tx.execute({
        sql: 'INSERT INTO months (name, year, sort_order) VALUES (?, ?, ?)',
        args: [mo.name, mo.year, i],
      });
      monthIdsByIndex[i] = Number(info.lastInsertRowid);
    }

    for (const name of SEED_MEMBERS) {
      const vals = SEED_CONTRIBS[name] || [];
      for (let i = 0; i < SEED_MONTHS.length; i++) {
        const v = vals[i] !== undefined ? vals[i] : 'na';
        const monthId = monthIdsByIndex[i];
        const args = (v === 'pending' || v === 'na')
          ? [memberIds[name], monthId, v, null]
          : [memberIds[name], monthId, 'paid', v];
        await tx.execute({
          sql: 'INSERT INTO contributions (member_id, month_id, status, amount) VALUES (?, ?, ?, ?)',
          args,
        });
      }
    }

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  const passHash = bcrypt.hashSync(DEFAULT_PASS, 10);
  await db.execute({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', args: ['admin_user', DEFAULT_USER] });
  await db.execute({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', args: ['admin_pass_hash', passHash] });
  await db.execute({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', args: ['last_updated', new Date().toISOString()] });

  console.log(`Seeded ${SEED_MEMBERS.length} members, ${SEED_MONTHS.length} months.`);
  console.log(`Admin user: ${DEFAULT_USER} (password set from ADMIN_PASS env or default — change it after first login).`);
}

module.exports = seed;
