/**
 * Database Migration: Migrate from 24 interviews to 30 dynamic interview patterns.
 * Preserves all existing completed records 1–24 and maps them to the new structure.
 */

import { getSequelize } from '../connection.js';
import { JourneyBlueprint, JourneyInterview, StudentJourney } from '../index.js';
import { BLUEPRINTS } from '../../mentorship/blueprints.js';

export async function runMigration() {
  console.log('[Migration] Starting migration to 30 dynamic interview patterns...');
  const seq = getSequelize();

  // 1. Upsert all 30 blueprints into JourneyBlueprints
  let upsertedCount = 0;
  for (const bp of BLUEPRINTS) {
    await JourneyBlueprint.upsert({
      interview_number: bp.interview_number,
      title: bp.title,
      level: bp.level,
      objective: bp.objective,
      focus_areas: bp.focus_areas,
      difficulty: bp.difficulty,
      ai_prompt: bp.ai_prompt,
      follow_up_guidelines: bp.follow_up_guidelines,
      evaluation_criteria: bp.evaluation_criteria,
      domain: bp.domain,
      role: bp.role,
      category: bp.category,
    });
    upsertedCount++;
  }
  console.log(`[Migration] Upserted ${upsertedCount} blueprints into JourneyBlueprints.`);

  // 2. Safely map existing JourneyInterview records (1–24) to the new blueprint titles and IDs
  // without deleting or altering any scores, grades, session_ids, or reports
  const allDbBlueprints = await JourneyBlueprint.findAll();
  const bpMap = new Map(allDbBlueprints.map(b => [b.interview_number, b]));

  for (const [num, bp] of bpMap.entries()) {
    const [affected] = await JourneyInterview.update(
      {
        blueprint_id: bp._id,
        blueprint_title: bp.title,
        level: bp.level,
      },
      {
        where: { interview_number: num },
      }
    );
    if (affected > 0) {
      console.log(`[Migration] Updated ${affected} historical JourneyInterview records for Interview #${num} -> "${bp.title}"`);
    }
  }

  // 3. Ensure StudentJourneys have total_interviews set to 30
  const [journeyAffected] = await StudentJourney.update(
    { total_interviews: 30 },
    { where: { total_interviews: { [seq.Sequelize.Op.ne]: 30 } } }
  );
  if (journeyAffected > 0) {
    console.log(`[Migration] Updated ${journeyAffected} StudentJourney records to total_interviews = 30.`);
  }

  console.log('[Migration] Migration to 30 dynamic interview patterns completed successfully!');
}

// Allow direct execution via CLI
if (process.argv[1]?.endsWith('migrateTo30DynamicPatterns.js')) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration Error]', err);
      process.exit(1);
    });
}
