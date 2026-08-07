#!/usr/bin/env node
/**
 * scripts/fixBrokenTestCases.js
 *
 * Repairs programming problems whose test cases are auto-generated garbage
 * (the fallback {7,7}/{99,99} pattern, or placeholder OOP/design cases).
 *
 * For problems with verifiable I/O (samples match known-correct patterns):
 *   - Regenerates sample_test_cases and hidden_test_cases from verified curated data.
 * For all other problems with broken test data:
 *   - Marks is_auto_gradable = false so they are excluded from auto-graded
 *     practice (the student route already filters { [Op.ne]: false }).
 *
 * Usage:
 *   node scripts/fixBrokenTestCases.js            # dry run (no writes)
 *   node scripts/fixBrokenTestCases.js --apply    # write changes (with JSON backup)
 *
 * Backups are written to scripts/backups/<timestamp>-backup.json for revertibility.
 */
import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY_FLAG = process.argv.includes('--apply');

// ── DB connection ────────────────────────────────────────────────────
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
  _id: { type: DataTypes.UUID, primaryKey: true },
  title: DataTypes.STRING(255),
  description: DataTypes.TEXT,
  concept: DataTypes.STRING(100),
  sample_test_cases: DataTypes.JSONB,
  hidden_test_cases: DataTypes.JSONB,
  is_auto_gradable: DataTypes.BOOLEAN,
  is_deleted: DataTypes.BOOLEAN,
  status: DataTypes.STRING(20),
  difficulty: DataTypes.STRING(10),
  input_format: DataTypes.TEXT,
  output_format: DataTypes.TEXT,
}, { tableName: 'programming_problems', timestamps: false });

// ── Garbage detection ────────────────────────────────────────────────
const FALLBACK_INPUTS = new Set(['7', '99']);
const FALLBACK_OUTPUTS = new Set(['7', '99']);
const PLACEHOLDER_OUTPUTS = new Set([
  'Method executed successfully',
  'Polymorphic behavior demonstrated',
  'Pattern implemented correctly',
  'Tree built successfully',
  'List modified',
  'Converted',
  'Instantiate and call',
  'Implement pattern',
  'Design pattern context',
  'Functional requirements, expected load: 1M DAU',
  'Base and derived',
]);

/** Check if hidden_test_cases consist of fallback garbage or placeholder outputs */
function isGarbageHidden(hidden) {
  if (!Array.isArray(hidden) || hidden.length === 0) return false;
  return hidden.every(tc => {
    const inp = String(tc.input || '');
    const out = String(tc.output || '');
    return (FALLBACK_INPUTS.has(inp) && FALLBACK_OUTPUTS.has(out))
      || PLACEHOLDER_OUTPUTS.has(out)
      || PLACEHOLDER_OUTPUTS.has(inp);
  });
}

/** Check if a sample is a placeholder (input=output=1 with "Default test case.") */
function isPlaceholderSample(sample) {
  const expl = String(sample.explanation || '');
  return expl.includes('Default test case.')
    || (String(sample.input || '') === '1' && String(sample.output || '') === '1' && expl.toLowerCase().includes('default'));
}

/** Check if ALL samples are placeholders (or empty) */
function allSamplesPlaceholder(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return true;
  return samples.every(s => isPlaceholderSample(s));
}

// ── Verified curated test-case sets ──────────────────────────────────
// Exact-title → verified [input, output] pairs (from curateProblems.js).
// Only problems whose samples confirm the pattern are regenerated.
const VERIFIED_REGISTRY = new Map();

// Helper: add entry keyed by exact title (lowercase)
function register(title, concept, cases) {
  const key = `${title.toLowerCase()}|${(concept || '').toLowerCase()}`;
  VERIFIED_REGISTRY.set(key, cases);
}

// Print Your Name / Name greeting
register('Print Your Name', 'Basics', [
  { input: 'Alice',   output: 'Hello, Alice!',   explanation: 'The program reads "Alice" and prints the greeting.' },
  { input: 'Bob',     output: 'Hello, Bob!',     explanation: 'Another name produces a different greeting.' },
  { input: 'Charlie', output: 'Hello, Charlie!', explanation: 'A third name produces a different greeting.' },
  { input: 'Diana',   output: 'Hello, Diana!',   explanation: 'A fourth name produces a different greeting.' },
]);

// Product of Two Numbers (exact title, not "Multiply Two Numbers")
register('Product of Two Numbers', 'Basics', [
  { input: '4 5',    output: '20',   explanation: '4 × 5 = 20' },
  { input: '-3 6',   output: '-18',  explanation: '-3 × 6 = -18' },
  { input: '6 7',    output: '42',   explanation: '6 × 7 = 42' },
  { input: '-4 9',   output: '-36',  explanation: '-4 × 9 = -36' },
  { input: '0 99',   output: '0',    explanation: '0 × any number = 0' },
  { input: '12 12',  output: '144',  explanation: '12 × 12 = 144' },
]);

/** Find verified curated cases for a problem, checking title+concept match + sample verification */
function findVerifiedCases(problem) {
  const title = (problem.title || '').trim();
  const concept = (problem.concept || '').trim();
  const key = `${title.toLowerCase()}|${concept.toLowerCase()}`;

  const curated = VERIFIED_REGISTRY.get(key);
  if (!curated) return null;

  const samples = problem.sample_test_cases || [];

  // If the problem has real (non-placeholder) samples, verify they match the curated first cases
  const nonPlaceholderSamples = samples.filter(s => !isPlaceholderSample(s));
  if (nonPlaceholderSamples.length > 0) {
    const curatedPairs = new Set(curated.slice(0, 2).map(c => `${c.input}||${c.output}`));
    const match = nonPlaceholderSamples.some(s => curatedPairs.has(`${s.input||''}||${s.output||''}`));
    if (!match) {
      // Samples don't match curated pattern — wrong problem, don't regenerate
      return null;
    }
  } else if (samples.length === 0) {
    // No samples at all — also can't verify
    return null;
  }
  // else: all samples are placeholders but at least one exists — trust the
  // exact title+concept match (the problem was never properly seeded)

  return curated;
}

// ── Concepts that are fundamentally non-auto-gradable ────────────────
const NON_AUTOGRADABLE_CONCEPTS = new Set([
  'OOP Basics',
  'Inheritance & Polymorphism',
  'Design Patterns',
  'System Design',
]);

// ── Main ─────────────────────────────────────────────────────────────
async function fixBrokenTestCases() {
  await sequelize.authenticate();
  console.log('Connected to database.\n');

  const problems = await ProgrammingProblem.findAll({
    where: { is_deleted: { [Sequelize.Op.ne]: true } },
    order: [['title', 'ASC']],
  });
  console.log(`Fetched ${problems.length} problems.\n`);

  const toDisable = [];    // set is_auto_gradable = false
  const toRegenerate = []; // replace sample + hidden from verified data
  const skipped = [];

  for (const prob of problems) {
    const hidden = prob.hidden_test_cases || [];
    const samples = prob.sample_test_cases || [];
    const hiddenBad = isGarbageHidden(hidden);
    const samplesAllBad = allSamplesPlaceholder(samples);
    const isConceptualNonGradable = NON_AUTOGRADABLE_CONCEPTS.has(prob.concept);

    if (!hiddenBad && !samplesAllBad && !isConceptualNonGradable) {
      skipped.push(prob.title);
      continue;
    }

    // Try verified regeneration
    const curated = findVerifiedCases(prob);

    if (curated) {
      toRegenerate.push({
        id: prob._id,
        title: prob.title,
        concept: prob.concept,
        newSamples: curated.slice(0, 2),
        newHidden: curated.slice(2),
      });
    } else {
      // Cannot verify — disable auto-grading
      toDisable.push({
        id: prob._id,
        title: prob.title,
        concept: prob.concept,
        reason: hiddenBad ? 'garbage hidden cases' :
                samplesAllBad ? 'placeholder samples' :
                'conceptual (non-auto-gradable)',
      });
    }
  }

  // ── Report ─────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════════');
  console.log('             FIX SUMMARY');
  console.log('════════════════════════════════════════════════');
  console.log(`Total problems scanned:          ${problems.length}`);
  console.log(`Regenerated (verified cases):    ${toRegenerate.length}`);
  console.log(`Disabled (is_auto_gradable=false): ${toDisable.length}`);
  console.log(`Skipped (already fine):          ${skipped.length}\n`);

  if (toRegenerate.length > 0) {
    console.log('── Regenerated ──');
    for (const r of toRegenerate) {
      console.log(`  ✓ ${r.title} (${r.concept}) — ${r.newSamples.length} samples, ${r.newHidden.length} hidden`);
    }
  }

  if (toDisable.length > 0) {
    console.log('── Disabled (examples) ──');
    for (const r of toDisable.slice(0, 20)) {
      console.log(`  ⊘ ${r.title} (${r.concept}) — ${r.reason}`);
    }
    if (toDisable.length > 20) {
      console.log(`  ... and ${toDisable.length - 20} more`);
    }
  }

  if (APPLY_FLAG) {
    // ── Backup ───────────────────────────────────────────────────
    const backupDir = path.join(__dirname, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${timestamp}-test-case-fix-backup.json`);

    // Collect original values
    const allIds = new Set([
      ...toRegenerate.map(r => r.id.toString()),
      ...toDisable.map(r => r.id.toString()),
    ]);
    const backup = problems
      .filter(p => allIds.has(p._id.toString()))
      .map(p => ({
        _id: p._id,
        title: p.title,
        concept: p.concept,
        sample_test_cases: p.sample_test_cases,
        hidden_test_cases: p.hidden_test_cases,
        is_auto_gradable: p.is_auto_gradable,
      }));

    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`\nBackup written to: ${backupPath}`);

    // ── Apply ────────────────────────────────────────────────────
    const BATCH = 50;

    // 1. Disable auto-grading for broken problems
    if (toDisable.length > 0) {
      const ids = toDisable.map(r => r.id);
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        await ProgrammingProblem.update(
          { is_auto_gradable: false },
          { where: { _id: { [Sequelize.Op.in]: batch } } },
        );
        console.log(`  Disabled ${Math.min(i + BATCH, ids.length)}/${ids.length}`);
      }
    }

    // 2. Regenerate verified problems
    for (let i = 0; i < toRegenerate.length; i += BATCH) {
      const batch = toRegenerate.slice(i, i + BATCH);
      await Promise.all(batch.map(r =>
        ProgrammingProblem.update(
          {
            sample_test_cases: r.newSamples,
            hidden_test_cases: r.newHidden,
          },
          { where: { _id: r.id } },
        )
      ));
      console.log(`  Regenerated ${Math.min(i + BATCH, toRegenerate.length)}/${toRegenerate.length}`);
    }

    console.log('\nDone — all changes applied.');
  } else {
    console.log('\n─── Dry-run mode. Pass --apply to write changes. ───');
  }

  await sequelize.close();
}

fixBrokenTestCases().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});