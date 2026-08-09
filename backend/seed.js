const bcrypt = require('bcryptjs');
const db = require('./db');

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
];

const SEED_CONTRIBS = {
  'Arjun Sambyal Bhaiya': [500,500,500,500,500,500,500,'na','na'],
  'Bhanu Jamwal':         [500,500,500,500,500,500,500,500,'na'],
  'Chitranjan Smabyal':   [500,500,500,500,500,500,'pending','na','na'],
  'Mohit Sharma':         [500,500,550,500,500,500,500,500,'na'],
  'Navdeep Billoria':     [500,500,500,500,500,500,500,500,500],
  'Rahul Singh':          [500,500,500,500,500,500,500,'na','na'],
  'Rajeshwar Singh':      [500,1100,500,500,500,500,500,500,500],
  'Rohit Sharma':         [500,500,500,500,500,500,500,500,500],
  'Sanjay Singh':         [500,500,500,500,500,500,500,'na','na'],
  'Sahil Sharma':         [500,500,500,500,500,500,500,'na','na'],
  'Shubham Gupta':        [500,500,500,500,500,500,500,500,500],
  'Shivanshu Sharma':     [500,500,1000,500,500,500,1000,500,500],
  'Sohit Manhas':         [500,500,500,500,500,500,500,500,500],
  'Tarun Sharma':         [500,500,500,500,500,500,500,'na','na'],
  'Vishal Sharma':        [500,500,500,500,500,500,500,'na','na'],
  'Vikrant Andotra':      [500,500,550,500,500,500,500,500,500],
  'Pankaj':               [500,500,500,500,500,500,'pending','na','na'],
  'Bhaskar':              [500,500,500,500,500,500,500,500,500],
  'Varinder':             [500,500,500,500,500,500,500,'na','na'],
};

function seed() {
  const memberCount = db.prepare('SELECT COUNT(*) c FROM members').get().c;
  if (memberCount > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  const insertMember = db.prepare('INSERT INTO members (name, sort_order) VALUES (?, ?)');
  const insertMonth = db.prepare('INSERT INTO months (name, year, sort_order) VALUES (?, ?, ?)');
  const insertContrib = db.prepare(
    'INSERT INTO contributions (member_id, month_id, status, amount) VALUES (?, ?, ?, ?)'
  );

  const memberIds = {};
  const monthIdsByIndex = [];

  const tx = db.transaction(() => {
    SEED_MEMBERS.forEach((name, i) => {
      const info = insertMember.run(name, i);
      memberIds[name] = info.lastInsertRowid;
    });
    SEED_MONTHS.forEach((mo, i) => {
      const info = insertMonth.run(mo.name, mo.year, i);
      monthIdsByIndex[i] = info.lastInsertRowid;
    });
    SEED_MEMBERS.forEach(name => {
      const vals = SEED_CONTRIBS[name] || [];
      SEED_MONTHS.forEach((mo, i) => {
        const v = vals[i] !== undefined ? vals[i] : 'na';
        const monthId = monthIdsByIndex[i];
        if (v === 'pending' || v === 'na') {
          insertContrib.run(memberIds[name], monthId, v, null);
        } else {
          insertContrib.run(memberIds[name], monthId, 'paid', v);
        }
      });
    });
  });
  tx();

  const passHash = bcrypt.hashSync(DEFAULT_PASS, 10);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_user', DEFAULT_USER);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_pass_hash', passHash);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('last_updated', new Date().toISOString());

  console.log(`Seeded ${SEED_MEMBERS.length} members, ${SEED_MONTHS.length} months.`);
  console.log(`Admin user: ${DEFAULT_USER} (password set from ADMIN_PASS env or default — change it after first login).`);
}

seed();
