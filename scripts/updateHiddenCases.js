import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
import net from 'node:net';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: dbUrl.includes('neon.tech') ? {
    ssl: { require: true, rejectUnauthorized: false },
    stream: () => {
      const s = new net.Socket();
      const orig = s.connect.bind(s);
      s.connect = (port, host, cb) => orig({ port, host, family: 4 }, cb);
      return s;
    },
  } : undefined,
});

const ProgrammingProblem = sequelize.define('ProgrammingProblem', {
  _id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  sample_test_cases: { type: DataTypes.JSONB, defaultValue: [] },
  hidden_test_cases: { type: DataTypes.JSONB, defaultValue: [] },
  is_auto_gradable: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'programming_problems', timestamps: false });

function genHiddenCases(problemText, title) {
  const p = problemText.toLowerCase();
  const t = title.toLowerCase();
  const h = [];

  if (p.includes('hello world') || t.includes('hello')) {
    h.push({ input: '', output: 'Hello, World!' });
    return h;
  }
  if (p.includes('your name') || p.includes('print name')) {
    h.push({ input: 'Charlie', output: 'Hello, Charlie!' });
    h.push({ input: 'Diana', output: 'Hello, Diana!' });
    return h;
  }
  if (p.includes('sum of two') || (t.includes('sum') && (t.includes('two') || t.includes('add')))) {
    h.push({ input: '10 20', output: '30' });
    h.push({ input: '-15 8', output: '-7' });
    return h;
  }
  if (p.includes('difference')) {
    h.push({ input: '20 8', output: '12' });
    h.push({ input: '3 10', output: '-7' });
    return h;
  }
  if (p.includes('product')) {
    h.push({ input: '6 7', output: '42' });
    h.push({ input: '-4 9', output: '-36' });
    return h;
  }
  if (p.includes('quotient')) {
    h.push({ input: '15 4', output: '3' });
    h.push({ input: '8 3', output: '2' });
    return h;
  }
  if (p.includes('remainder') || p.includes('modulo')) {
    h.push({ input: '15 4', output: '3' });
    h.push({ input: '8 3', output: '2' });
    return h;
  }
  if ((t + ' ' + p).includes('armstrong')) {
    h.push({ input: '371', output: 'true' });
    h.push({ input: '1234', output: 'false' });
    return h;
  }
  if (p.includes('power') || p.includes('exponent') || t.includes('power') || t.includes('exponent')) {
    h.push({ input: '3 4', output: '81' });
    h.push({ input: '10 1', output: '10' });
    return h;
  }
  if (p.includes('absolute') || t.includes('abs')) {
    h.push({ input: '-12', output: '12' });
    h.push({ input: '0', output: '0' });
    return h;
  }
  if ((t + ' ' + p).includes('collatz')) {
    h.push({ input: '7', output: '16 8 4 2 1' });
    return h;
  }
  if ((t + ' ' + p).includes('even') || (t + ' ' + p).includes('odd')) {
    h.push({ input: '0', output: 'Even' });
    h.push({ input: '13', output: 'Odd' });
    return h;
  }
  if ((t + ' ' + p).includes('positive') || (t + ' ' + p).includes('negative') || (t + ' ' + p).includes('check zero')) {
    h.push({ input: '-1', output: 'Negative' });
    h.push({ input: '100', output: 'Positive' });
    return h;
  }
  if ((t + ' ' + p).includes('leap')) {
    h.push({ input: '2023', output: 'Not a Leap Year' });
    h.push({ input: '2400', output: 'Leap Year' });
    return h;
  }
  if (t.includes('second') && (t.includes('largest') || t.includes('maximum'))) {
    h.push({ input: '1 5 2 8 3', output: '5' });
    h.push({ input: '100 90 80', output: '90' });
    return h;
  }
  if (t.includes('second') && (t.includes('smallest') || t.includes('minimum'))) {
    h.push({ input: '9 2 7 1 5', output: '2' });
    h.push({ input: '20 30 10', output: '20' });
    return h;
  }
  if ((t + ' ' + p).includes('duplicate')) {
    h.push({ input: '1 2 3 4 4', output: '4' });
    h.push({ input: '5 5 5 1', output: '5' });
    return h;
  }
  if ((t + ' ' + p).includes('leaders')) {
    h.push({ input: '1 2 3 4 0', output: '4 0' });
    return h;
  }
  if ((t + ' ' + p).includes('subarray') && (t + ' ' + p).includes('sum') && !t.includes('maximum') && !t.includes('kadane')) {
    h.push({ input: '1 4 20 3 10 5 33', output: '3 5' });
    return h;
  }
  if (t.includes('kadane') || (t + ' ' + p).includes('maximum subarray')) {
    h.push({ input: '5 4 -1 7 8', output: '23' });
    return h;
  }
  if ((t.includes('longest common') || t.includes('lcp')) && (t.includes('string') || p.includes('string') || p.includes('prefix'))) {
    h.push({ input: 'apple app apt', output: 'ap' });
    h.push({ input: 'dog cat', output: '' });
    return h;
  }
  if (t.includes('kth largest') || t.includes('kth maximum')) {
    h.push({ input: '12 3 5 7 19', output: '12' });
    return h;
  }
  if (t.includes('kth smallest')) {
    h.push({ input: '12 3 5 7 19', output: '5' });
    return h;
  }
  if ((p.includes('largest') || p.includes('greatest') || t.includes('maximum')) && (p.includes('three') || t.includes('three'))) {
    h.push({ input: '1 5 3', output: '5' });
    h.push({ input: '-10 -2 -7', output: '-2' });
    return h;
  }
  if (p.includes('smallest') || t.includes('minimum')) {
    if (p.includes('three') || t.includes('three')) {
      h.push({ input: '8 3 6', output: '3' });
      h.push({ input: '-1 -5 -3', output: '-5' });
      return h;
    }
    h.push({ input: '9 4 7 2 8', output: '2' });
    h.push({ input: '-1 -5 0', output: '-5' });
    return h;
  }
  if ((p.includes('find') || p.includes('maximum') || t.includes('maximum')) && (p.includes('array') || t.includes('array'))) {
    h.push({ input: '10 25 7 30 15', output: '30' });
    h.push({ input: '-8 -2 -5', output: '-2' });
    return h;
  }
  if ((t.includes('sum') || p.includes('sum')) && (p.includes('array') || t.includes('array') || p.includes('element'))) {
    h.push({ input: '1 3 5 7 9', output: '25' });
    h.push({ input: '-2 4 -6 8', output: '4' });
    return h;
  }
  if (p.includes('average') || t.includes('average') || p.includes('mean')) {
    h.push({ input: '5 10 15', output: '10.0' });
    h.push({ input: '2 4 6 8', output: '5.0' });
    return h;
  }
  if ((t.includes('reverse') || p.includes('reverse')) && (t.includes('array') || p.includes('array') || t.includes('element'))) {
    h.push({ input: '9 8 7 6', output: '6 7 8 9' });
    h.push({ input: 'x y z', output: 'z y x' });
    return h;
  }
  if ((t.includes('reverse') || p.includes('reverse')) && (t.includes('string') || p.includes('string'))) {
    h.push({ input: 'abc', output: 'cba' });
    h.push({ input: '12345', output: '54321' });
    return h;
  }
  if ((t + ' ' + p).includes('palindrome')) {
    h.push({ input: 'madam', output: 'true' });
    h.push({ input: 'abc', output: 'false' });
    return h;
  }
  if ((t + ' ' + p).includes('anagram')) {
    h.push({ input: 'restful fluster', output: 'true' });
    h.push({ input: 'hello bye', output: 'false' });
    return h;
  }
  if (t.includes('fibonacci') || t.includes('fib seq') || t.includes('fib number') || t.includes('fib term')) {
    h.push({ input: '0', output: '0' });
    h.push({ input: '7', output: '13' });
    return h;
  }
  if (t.includes('factorial') || t.includes('fact of')) {
    h.push({ input: '3', output: '6' });
    h.push({ input: '7', output: '5040' });
    return h;
  }
  if ((t + ' ' + p).includes('prime') && !t.includes('prime factor')) {
    h.push({ input: '2', output: 'true' });
    h.push({ input: '1', output: 'false' });
    return h;
  }
  if (t.includes('gcd') || t.includes('hcf') || (t + ' ' + p).includes('greatest common')) {
    h.push({ input: '48 18', output: '6' });
    h.push({ input: '100 25', output: '25' });
    return h;
  }
  if (t.includes('lcm') || (t + ' ' + p).includes('least common')) {
    h.push({ input: '12 18', output: '36' });
    h.push({ input: '6 8', output: '24' });
    return h;
  }
  if (t.includes('bubble') && t.includes('sort')) {
    h.push({ input: '9 2 7 1 5', output: '1 2 5 7 9' });
    return h;
  }
  if (t.includes('selection') && t.includes('sort')) {
    h.push({ input: '29 10 14 37 13', output: '10 13 14 29 37' });
    return h;
  }
  if (t.includes('insertion') && t.includes('sort')) {
    h.push({ input: '22 11 14 6 8', output: '6 8 11 14 22' });
    return h;
  }
  if (t.includes('merge') && t.includes('sort')) {
    h.push({ input: '12 11 13 5 6 7', output: '5 6 7 11 12 13' });
    return h;
  }
  if (t.includes('quick') && t.includes('sort')) {
    h.push({ input: '3 7 8 5 2 1 9 5 4', output: '1 2 3 4 5 5 7 8 9' });
    return h;
  }
  if ((p.includes('sort') || t.includes('sort')) && !t.includes('dictionary')) {
    h.push({ input: '9 4 6 2 8', output: '2 4 6 8 9' });
    h.push({ input: '3 1 2', output: '1 2 3' });
    return h;
  }
  if (p.includes('binary search') || t.includes('binary search')) {
    h.push({ input: '1 4 6 8 10 6', output: '1' });
    h.push({ input: '3 6 9 12 7', output: '-1' });
    return h;
  }
  if (t.includes('linear search')) {
    h.push({ input: '5 8 2 9 1 9', output: '3' });
    h.push({ input: '1 2 3 4', output: '-1' });
    return h;
  }
  if (t.includes('inorder') || t.includes('in-order')) {
    h.push({ input: '2 1 3', output: '1 2 3' });
    return h;
  }
  if (t.includes('preorder') || t.includes('pre-order')) {
    h.push({ input: '2 1 3', output: '2 1 3' });
    return h;
  }
  if (t.includes('postorder') || t.includes('post-order')) {
    h.push({ input: '2 1 3', output: '1 3 2' });
    return h;
  }
  if (t.includes('level order') || t.includes('level-order') || (t.includes('bfs') && t.includes('tree'))) {
    h.push({ input: '1 2 3 4 5', output: '1 2 3 4 5' });
    return h;
  }
  if (t.includes('height') || t.includes('max depth')) {
    h.push({ input: '1 2 null 3', output: '3' });
    return h;
  }
  if (t.includes('reverse') && (t.includes('linked') || p.includes('linked'))) {
    h.push({ input: '10 20 30', output: '30 20 10' });
    return h;
  }
  if ((t.includes('cycle') || t.includes('loop')) && (t.includes('linked') || p.includes('linked'))) {
    h.push({ input: '1 2 3 4 5 1', output: 'true' });
    h.push({ input: '1 2 3 4', output: 'false' });
    return h;
  }
  if (t.includes('stack') && (t.includes('implement') || t.includes('push') || t.includes('pop') || p.includes('stack'))) {
    h.push({ input: 'push 1 push 2 pop top', output: '2' });
    return h;
  }
  if (t.includes('queue') && (t.includes('implement') || t.includes('enqueue') || t.includes('dequeue') || p.includes('queue'))) {
    h.push({ input: 'enqueue 1 enqueue 2 dequeue front', output: '1' });
    return h;
  }
  if (t.includes('coin') || (t + ' ' + p).includes('coin change')) {
    h.push({ input: '7 2 3 5', output: '2' });
    return h;
  }
  if (t.includes('knapsack')) {
    h.push({ input: '4 2 3 4 5 3 4 5 6 10', output: '14' });
    return h;
  }
  if (t.includes('lcs') || (t + ' ' + p).includes('longest common subsequence')) {
    h.push({ input: 'abcdef acdf', output: '4' });
    return h;
  }
  if ((t + ' ' + p).includes('longest increasing')) {
    h.push({ input: '3 10 2 1 20', output: '3' });
    return h;
  }
  if (t.includes('linked') && (t.includes('insert') || t.includes('delete'))) {
    h.push({ input: '10 20 30', output: 'List modified' });
    return h;
  }
  if ((t + ' ' + p).includes('find middle') || (t + ' ' + p).includes('middle of')) {
    h.push({ input: '1 2 3 4 5 6', output: '4' });
    h.push({ input: '10 20', output: '20' });
    return h;
  }
  if ((t + ' ' + p).includes('nth') || (t + ' ' + p).includes('get node')) {
    h.push({ input: '10 20 30 40', output: '20' });
    return h;
  }
  if (t.includes('tree') && (t.includes('insert') || t.includes('bst'))) {
    h.push({ input: '10 5 15 2 8', output: 'Tree built successfully' });
    return h;
  }
  if ((t + ' ' + p).includes('search') && (t.includes('tree') || t.includes('bst'))) {
    h.push({ input: '3 9 20 15 7', output: 'true' });
    h.push({ input: '3 9 20 15 7', output: 'false' });
    return h;
  }
  if (t.includes('graph') && (t.includes('bfs') || t.includes('dfs'))) {
    h.push({ input: '5 4 0 1 1 2 2 3 3 4', output: '0 1 2 3 4' });
    return h;
  }
  if (t.includes('graph') && (t + ' ' + p).includes('cycle')) {
    h.push({ input: '3 2 0 1 1 2', output: 'false' });
    return h;
  }
  if ((t + ' ' + p).includes('area of') || (t + ' ' + p).includes('find area')) {
    if (t.includes('circle')) h.push({ input: '10', output: '314.16' });
    else if (t.includes('rectangle')) h.push({ input: '7 3', output: '21' });
    else h.push({ input: '5 6', output: '15' });
    return h;
  }
  if (t.includes('perimeter') || (t + ' ' + p).includes('perimeter')) {
    h.push({ input: '6 4', output: '20' });
    return h;
  }
  if (t.includes('simple interest')) {
    h.push({ input: '2000 10 3', output: '600' });
    return h;
  }
  if ((t + ' ' + p).includes('compound interest')) {
    h.push({ input: '5000 8 3', output: '1298.56' });
    return h;
  }
  if (p.includes('convert') || p.includes('conversion') || t.includes('conversion') || t.includes('convert')) {
    if (t.includes('fahrenheit') || (t + ' ' + p).includes('f to c')) {
      h.push({ input: '98.6', output: '37' });
    } else if (t.includes('celsius') || (t + ' ' + p).includes('c to f')) {
      h.push({ input: '37', output: '98.6' });
    } else {
      h.push({ input: '255', output: 'Converted' });
    }
    return h;
  }
  if (t.includes('sum of digits') || (t + ' ' + p).includes('sum of digits')) {
    h.push({ input: '456', output: '15' });
    h.push({ input: '1000', output: '1' });
    return h;
  }
  if (t.includes('reverse number') || t.includes('reverse a number') || (t + ' ' + p).includes('reverse of a number')) {
    h.push({ input: '5678', output: '8765' });
    h.push({ input: '900', output: '9' });
    return h;
  }
  if (t.includes('number of digits') || t.includes('count digits') || (t + ' ' + p).includes('count digits')) {
    h.push({ input: '9999', output: '4' });
    h.push({ input: '1', output: '1' });
    return h;
  }
  if (t.includes('perfect number') || (t + ' ' + p).includes('perfect number')) {
    h.push({ input: '6', output: 'true' });
    h.push({ input: '10', output: 'false' });
    return h;
  }
  if (t.includes('strong number') || (t + ' ' + p).includes('strong number')) {
    h.push({ input: '40585', output: 'true' });
    return h;
  }
  if (t.includes('square') && (t.includes('number') || p.includes('square'))) {
    h.push({ input: '15', output: '225' });
    h.push({ input: '20', output: '400' });
    return h;
  }
  if (t.includes('cube') && (t.includes('number') || p.includes('cube'))) {
    h.push({ input: '4', output: '64' });
    h.push({ input: '6', output: '216' });
    return h;
  }
  if (t.includes('circumference')) {
    h.push({ input: '14', output: '87.96' });
    return h;
  }
  if (t.includes('distance')) {
    h.push({ input: '1 1 4 5', output: '5.0' });
    return h;
  }
  if (t.includes('quadratic') || t.includes('roots of')) {
    h.push({ input: '1 -3 2', output: '1 2' });
    return h;
  }
  if (t.includes('maximum of') || t.includes('max of')) {
    if (t.includes('three')) {
      h.push({ input: '10 7 9', output: '10' });
      h.push({ input: '-3 -6 -1', output: '-1' });
    } else {
      h.push({ input: '15 25', output: '25' });
      h.push({ input: '-10 -5', output: '-5' });
    }
    return h;
  }
  if (t.includes('minimum of') || t.includes('min of')) {
    if (t.includes('three')) {
      h.push({ input: '10 7 9', output: '7' });
      h.push({ input: '-3 -6 -1', output: '-6' });
    } else {
      h.push({ input: '15 25', output: '15' });
      h.push({ input: '-10 -5', output: '-10' });
    }
    return h;
  }
  if (t.includes('swap') || (t + ' ' + p).includes('swap')) {
    h.push({ input: '20 30', output: '30 20' });
    return h;
  }
  if (t.includes('multiplication table') || (t + ' ' + p).includes('multiplication table')) {
    h.push({ input: '7', output: '7 14 21 28 35 42 49 56 63 70' });
    return h;
  }
  if ((t + ' ' + p).includes('print 1') || (t + ' ' + p).includes('print numbers')) {
    h.push({ input: '3', output: '1 2 3' });
    return h;
  }
  if ((t + ' ' + p).includes('print n to 1') || (t + ' ' + p).includes('print reverse')) {
    h.push({ input: '4', output: '4 3 2 1' });
    return h;
  }
  if (t.includes('factor') && !t.includes('prime factor')) {
    h.push({ input: '16', output: '1 2 4 8 16' });
    return h;
  }
  if (t.includes('prime factor')) {
    h.push({ input: '18', output: '2 3 3' });
    return h;
  }
  if (t.includes('pattern') || (t + ' ' + p).includes('pattern')) {
    h.push({ input: '4', output: '*\n**\n***\n****' });
    return h;
  }
  if ((t + ' ' + p).includes('even count') || (t + ' ' + p).includes('odd count') || (t + ' ' + p).includes('count even') || (t + ' ' + p).includes('count odd')) {
    h.push({ input: '2 4 6 7 9', output: '3 evens, 2 odds' });
    return h;
  }
  if (t.includes('class') || t.includes('object') || t.includes('oop') || (t + ' ' + p).includes('encapsulation') || (t + ' ' + p).includes('abstraction')) {
    h.push({ input: 'Instantiate and call', output: 'Method executed successfully' });
    return h;
  }
  if (t.includes('inheritance') || t.includes('polymorphism') || t.includes('override') || t.includes('overload')) {
    h.push({ input: 'Base and derived', output: 'Polymorphic behavior demonstrated' });
    return h;
  }
  if (t.includes('singleton') || t.includes('factory') || t.includes('observer') || t.includes('strategy') || t.includes('decorator') || t.includes('adapter')) {
    h.push({ input: 'Implement pattern', output: 'Pattern implemented correctly' });
    return h;
  }

  return [];
}

async function updateHiddenCases() {
  console.log('Connecting to database...');
  await sequelize.authenticate();
  console.log('Connected.\n');

  console.log('Fetching problems...');
  const problems = await ProgrammingProblem.findAll({
    where: { is_deleted: { [Op.ne]: true } },
    attributes: ['_id', 'title', 'description'],
  });
  console.log(`Fetched ${problems.length} problems.\n`);

  const updates = [];
  let skipped = 0;

  for (const problem of problems) {
    const hidden = genHiddenCases(problem.description, problem.title);
    if (hidden.length === 0) {
      // No verified cases can be generated — mark as non-auto-gradable and clear garbage
      updates.push({ _id: problem._id, hidden_test_cases: [], is_auto_gradable: false });
      continue;
    }
    updates.push({ _id: problem._id, hidden_test_cases: hidden });
  }

  console.log(`Updating ${updates.length} problems (${skipped} skipped)...`);

  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await Promise.all(batch.map((u) =>
      ProgrammingProblem.update(
        u.is_auto_gradable !== undefined
          ? { hidden_test_cases: u.hidden_test_cases, is_auto_gradable: u.is_auto_gradable }
          : { hidden_test_cases: u.hidden_test_cases },
        { where: { _id: u._id } },
      )
    ));
    console.log(`  ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
  }

  console.log(`\nDone: ${updates.length} problems updated, ${skipped} skipped.`);
  await sequelize.close();
}

const { Op } = await import('sequelize');
updateHiddenCases().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
