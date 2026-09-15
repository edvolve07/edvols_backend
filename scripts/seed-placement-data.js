/**
 * Placement Intelligence seed script.
 *
 * Adds interview sessions, reports, communication reports, and resume versions
 * to the existing test data. This data feeds the scoring engine.
 *
 * Usage:  node scripts/seed-placement-data.js
 *
 * Prerequisites: Run `node scripts/seed-test-data.js` first.
 *
 * Creates for each student:
 *   - 2-6 completed interview sessions with question evaluations
 *   - Interview reports with scores
 *   - Communication reports (for some students)
 *   - Resume versions with ATS analysis (for some students)
 */

import 'dotenv/config';
import { v4 as uuid } from 'uuid';
import { getSequelize, connectDatabase, closeDatabase } from '../src/database/connection.js';
import { PlacementConfig, ScoringVersion } from '../src/database/index.js';

const sequelize = getSequelize();

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uid() { return uuid(); }

function ts(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function clampScore(v) { return Math.max(0, Math.min(10, Math.round(v))); }

function generateEvaluation(skills, variance = 1.5) {
  const base = skills;
  const jitter = () => clampScore(base + (Math.random() - 0.5) * variance * 2);
  return {
    confidence: clampScore(base + (Math.random() - 0.5) * 2),
    body_language: clampScore(base + (Math.random() - 0.5) * 2.5),
    knowledge: clampScore(base + (Math.random() - 0.5) * 2),
    fluency: clampScore(base + (Math.random() - 0.5) * 2),
    skill_relevance: clampScore(base + (Math.random() - 0.5) * 2),
    strengths: ['Strong fundamentals', 'Good articulation'],
    improvements: ['Could provide more examples', 'Work on depth'],
    feedback: 'Student demonstrated solid understanding with room for growth.',
  };
}

function generateBlueprintEvaluation(skills) {
  const base = generateEvaluation(skills);
  base.blueprint_score = clampScore(skills + (Math.random() - 0.5) * 2);
  return base;
}

// Student profiles: each student has a skill level and number of interviews
const studentProfiles = {
  // GTU students
  'aarav@student.com':  { skill: 8, interviews: [1, 3, 6, 14], dept: 'CSE', year: '4th' },
  'diya@student.com':   { skill: 7, interviews: [1, 2, 4], dept: 'CSE', year: '3rd' },
  'rohan@student.com':  { skill: 6, interviews: [1, 5, 8], dept: 'ECE', year: '4th' },
  'sneha@student.com':  { skill: 4, interviews: [1], dept: 'ECE', year: '2nd' },
  // NIB students
  'arjun@student.com':  { skill: 9, interviews: [1, 3, 6, 9, 14, 22], dept: 'CSE', year: '4th' },
  'kavya@student.com':  { skill: 7, interviews: [1, 2, 6], dept: 'CSE', year: '3rd' },
  'aditya@student.com': { skill: 5, interviews: [1, 8], dept: 'MBA', year: '2nd' },
  'meera@student.com':  { skill: 3, interviews: [1], dept: 'MBA', year: '1st' },
  // Individual students
  'individual@test.com': { skill: 8, interviews: [1, 3, 6, 14], dept: null, year: null },
  'suresh@test.com':    { skill: 6, interviews: [1, 2, 5], dept: null, year: null },
  'lakshmi@test.com':   { skill: 5, interviews: [1, 4], dept: null, year: null },
};

const blueprintQuestions = {
  1: { title: 'Resume Discovery', category: 'Foundation', focusAreas: ['resume accuracy', 'depth of knowledge', 'communication', 'self awareness', 'career clarity'], questions: 4 },
  2: { title: 'Education Deep Dive', category: 'Foundation', focusAreas: ['academic foundation', 'technical concepts', 'learning aptitude', 'communication', 'self reflection'], questions: 3 },
  3: { title: 'Technical Foundations', category: 'Foundation', focusAreas: ['technical concepts', 'coding fundamentals', 'problem understanding', 'communication', 'depth'], questions: 4 },
  4: { title: 'Project Portfolio', category: 'Foundation', focusAreas: ['project portfolio', 'technical contribution', 'architecture understanding', 'communication', 'ownership'], questions: 4 },
  5: { title: 'Internship Experience', category: 'Professional', focusAreas: ['internship experience', 'professional skills', 'communication', 'problem solving', 'teamwork'], questions: 3 },
  6: { title: 'Technical Problem Solving', category: 'Professional', focusAreas: ['problem solving', 'technical approach', 'logical reasoning', 'communication', 'solution quality'], questions: 4 },
  7: { title: 'System Design Basics', category: 'Professional', focusAreas: ['system design', 'technical depth', 'problem decomposition', 'communication', 'trade-offs'], questions: 3 },
  8: { title: 'Behavioral Core', category: 'Professional', focusAreas: ['behavioral questions', 'cultural fit', 'stress handling', 'communication', 'self awareness'], questions: 4 },
  9: { title: 'Domain Deep Dive', category: 'Advanced', focusAreas: ['domain expertise', 'technical depth', 'industry knowledge', 'communication', 'problem solving'], questions: 3 },
  14: { title: 'Communication Skills', category: 'Expert', focusAreas: ['communication skills', 'presentation', 'negotiation', 'clarity', 'confidence'], questions: 4 },
  22: { title: 'Final Mock Interview', category: 'Mentor', focusAreas: ['holistic performance', 'technical depth', 'communication', 'behavioral', 'professionalism'], questions: 5 },
};

const feedbackOptions = [
  'Strong technical foundation with clear articulation.',
  'Good problem-solving approach but needs more depth.',
  'Excellent communication skills and confidence.',
  'Needs improvement in explaining technical concepts.',
  'Solid project understanding with good ownership.',
  'Could benefit from more structured responses.',
  'Demonstrated strong analytical thinking.',
  'Good awareness of industry trends and practices.',
];

async function run() {
  console.log('🔗 Connecting to database...');
  await connectDatabase();

  // Fetch existing users
  const [users] = await sequelize.query(`
    SELECT _id, name, email, role FROM users WHERE role = 'student' AND is_active = true
  `);

  if (users.length === 0) {
    console.error('❌ No students found. Run seed-test-data.js first.');
    process.exit(1);
  }

  console.log(`📚 Found ${users.length} students`);

  // Truncate placement-related tables
  console.log('🧹 Clearing existing placement data...');
  await sequelize.query('SET session_replication_role = replica;');
  const tables = ['human_validations', 'scoring_versions', 'placement_configs', 'interview_reports', 'interview_sessions', 'communication_reports', 'communication_sessions', 'resume_versions'];
  for (const table of tables) {
    try {
      await sequelize.query(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch { /* ignore */ }
  }
  await sequelize.query('SET session_replication_role = origin;');

  let totalSessions = 0;
  let totalReports = 0;
  let totalComm = 0;
  let totalResume = 0;

  for (const user of users) {
    const profile = studentProfiles[user.email];
    if (!profile) {
      console.log(`  ⏭️  Skipping ${user.email} (no placement profile defined)`);
      continue;
    }

    console.log(`  🎯 Seeding data for ${user.name} (${user.email}) — skill level ${profile.skill}`);

    const sessionId = uid();
    const interviewNumbers = profile.interviews;
    const baseDaysAgo = Math.floor(Math.random() * 30) + 10;

    // Create interview sessions with history
    for (let idx = 0; idx < interviewNumbers.length; idx++) {
      const intNum = interviewNumbers[idx];
      const bp = blueprintQuestions[intNum] || blueprintQuestions[1];
      const sessionId = uid();
      const daysAgo = baseDaysAgo - idx * 7;
      const createdAt = ts(daysAgo);

      // Generate question history
      const history = [];
      for (let q = 0; q < bp.questions; q++) {
        const eval_ = intNum >= 3
          ? generateBlueprintEvaluation(profile.skill)
          : generateEvaluation(profile.skill);

        history.push({
          question_number: q + 1,
          question: `Sample question ${q + 1} for ${bp.title}`,
          answer: `Student answer for question ${q + 1}.`,
          evaluation: eval_,
          video_metrics: {
            quality_flag: 'good',
            eye_contact: 0.7 + Math.random() * 0.25,
            attention: 0.7 + Math.random() * 0.2,
            stability: 0.8 + Math.random() * 0.15,
            face_presence: 0.85 + Math.random() * 0.15,
            visibility: 'high',
          },
          timestamp: createdAt,
        });
      }

      // Insert interview session
      await sequelize.query(`
        INSERT INTO interview_sessions (_id, session_id, student_id, student_name, student_email, student_role, domain, role, resume_text, ats_analysis, history, current_question, question_count, max_questions, status, interview_number, blueprint_title, blueprint_level, created_at, updated_at)
        VALUES (:id, :sessionId, :studentId, :name, :email, 'student', 'General', 'Software Engineer', '', '{}', :history::jsonb, '', :qcount, :qcount, 'completed', :intNum, :title, :level, :createdAt, :createdAt)
      `, {
        replacements: {
          id: uid(),
          sessionId,
          studentId: user._id,
          name: user.name,
          email: user.email,
          history: JSON.stringify(history),
          qcount: bp.questions,
          intNum,
          title: bp.title,
          level: intNum <= 4 ? 1 : intNum <= 8 ? 2 : intNum <= 12 ? 3 : intNum <= 18 ? 4 : intNum <= 22 ? 5 : 6,
          createdAt,
        },
      });
      totalSessions++;

      // Generate interview report
      const avgScore = profile.skill + (Math.random() - 0.5) * 2;
      const percentage = Math.round(avgScore * 10);
      const grade = percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : 'D';
      const gradeLabel = percentage >= 80 ? 'Excellent' : percentage >= 70 ? 'Good' : percentage >= 60 ? 'Average' : 'Needs Improvement';

      const metrics = {
        confidence: +(profile.skill + (Math.random() - 0.5) * 2).toFixed(1),
        body_language: +(profile.skill + (Math.random() - 0.5) * 3).toFixed(1),
        knowledge: +(profile.skill + (Math.random() - 0.5) * 2).toFixed(1),
        fluency: +(profile.skill + (Math.random() - 0.5) * 2).toFixed(1),
        skill_relevance: +(profile.skill + (Math.random() - 0.5) * 2).toFixed(1),
      };

      const blueprintAvg = history.filter(h => h.evaluation?.blueprint_score != null)
        .reduce((sum, h) => sum + h.evaluation.blueprint_score, 0) /
        Math.max(1, history.filter(h => h.evaluation?.blueprint_score != null).length);

      await sequelize.query(`
        INSERT INTO interview_reports (_id, session_id, student_id, student_name, student_email, interview_domain, interview_role, report_id, generated_date, overall, ats_analysis, question_breakdown, strengths, areas_to_improve, interview_tips, created_at, updated_at)
        VALUES (:id, :sessionId, :studentId, :name, :email, 'General', 'Software Engineer', :reportId, :genDate, :overall::jsonb, '{}', :breakdown::jsonb, :strengths::jsonb, :improvements::jsonb, :tips::jsonb, :createdAt, :createdAt)
      `, {
        replacements: {
          id: uid(),
          sessionId,
          studentId: user._id,
          name: user.name,
          email: user.email,
          reportId: `RPT-${intNum}-${Date.now()}`,
          genDate: createdAt,
          overall: JSON.stringify({
            percentage,
            grade,
            grade_label: gradeLabel,
            average_score: +((metrics.confidence + metrics.body_language + metrics.knowledge + metrics.fluency + metrics.skill_relevance) / 5).toFixed(1),
            blueprint_avg: +blueprintAvg.toFixed(1),
            metrics,
          }),
          breakdown: JSON.stringify(history.map(h => ({
            question: h.question,
            answer: h.answer,
            question_number: h.question_number,
            scores: {
              confidence: h.evaluation.confidence,
              body_language: h.evaluation.body_language,
              knowledge: h.evaluation.knowledge,
              fluency: h.evaluation.fluency,
              skill_relevance: h.evaluation.skill_relevance,
            },
            feedback: h.evaluation.feedback,
            strengths: h.evaluation.strengths,
            improvements: h.evaluation.improvements,
            blueprint_score: h.evaluation.blueprint_score,
          }))),
          strengths: JSON.stringify(['Strong technical foundation', 'Good communication']),
          improvements: JSON.stringify(['Could improve depth', 'More examples needed']),
          tips: JSON.stringify(['Practice mock interviews', 'Review core concepts']),
          createdAt,
        },
      });
      totalReports++;
    }

    // Add communication report for some students
    if (profile.skill >= 5 && Math.random() > 0.3) {
      const commScore = profile.skill + (Math.random() - 0.5) * 3;
      await sequelize.query(`
        INSERT INTO communication_reports (_id, session_id, student_id, student_name, student_email, category, report_id, generated_date, overall, strengths, areas_to_improve, tips, created_at, updated_at)
        VALUES (:id, :sid, :studentId, :name, :email, 'General', :reportId, :genDate, :overall::jsonb, '[]', '[]', '[]', NOW(), NOW())
      `, {
        replacements: {
          id: uid(),
          sid: uid(),
          studentId: user._id,
          name: user.name,
          email: user.email,
          reportId: `COMM-${Date.now()}`,
          genDate: new Date().toISOString(),
          overall: JSON.stringify({
            clarity: +(commScore + (Math.random() - 0.5) * 2).toFixed(1),
            structure: +(commScore + (Math.random() - 0.5) * 2).toFixed(1),
            conciseness: +(commScore + (Math.random() - 0.5) * 2).toFixed(1),
            relevance: +(commScore + (Math.random() - 0.5) * 2).toFixed(1),
            confidence_tone: +(commScore + (Math.random() - 0.5) * 2).toFixed(1),
          }),
        },
      });
      totalComm++;
    }

    // Add resume version for some students
    if (profile.skill >= 4 && Math.random() > 0.4) {
      const atsScore = Math.round(profile.skill * 10 + (Math.random() - 0.5) * 10);
      await sequelize.query(`
        INSERT INTO resume_versions (_id, student_id, version, title, target_role, ats_analysis, created_at, updated_at)
        VALUES (:id, :studentId, 1, 'Main Resume', 'Software Engineer', :ats::jsonb, NOW(), NOW())
      `, {
        replacements: {
          id: uid(),
          studentId: user._id,
          ats: JSON.stringify({
            ats_score: Math.max(0, Math.min(100, atsScore)),
            contact_info: { score: 8, feedback: 'Good' },
            skills: { score: 7, feedback: 'Relevant skills listed' },
            experience: { score: 6, feedback: 'Could add more detail' },
            education: { score: 8, feedback: 'Well formatted' },
            formatting: { score: 7, feedback: 'Clean layout' },
            keywords: { score: 6, feedback: 'Could add more keywords' },
          }),
        },
      });
      totalResume++;
    }
  }

  // Ensure new tables exist
  console.log('🔧 Ensuring placement tables exist...');
  await PlacementConfig.sync({ force: false });
  await ScoringVersion.sync({ force: false });

  // Seed a default placement config
  console.log('⚙️  Seeding default placement config...');
  await PlacementConfig.create({
    config_name: 'default',
    version: '1.0',
    competency_weights: { technical_knowledge: 0.25, problem_solving: 0.20, communication: 0.15, project_knowledge: 0.15, behavioral_skills: 0.10, resume_profile: 0.10, interview_performance: 0.05 },
    readiness_bands: { PLACEMENT_READY: { min: 85, max: 100 }, INTERVIEW_READY: { min: 75, max: 84.99 }, DEVELOPMENT_REQUIRED: { min: 60, max: 74.99 }, HIGH_INTERVENTION: { min: 0, max: 59.99 } },
    talent_criteria: { overall_readiness: 80, technical_knowledge: 75, communication: 70, problem_solving: 70, project_knowledge: 75 },
    segmentation_thresholds: { STRONG: 75, MODERATE: 60, NEEDS_IMPROVEMENT: 0 },
    confidence_thresholds: { HIGH: { minInterviews: 4, minQuestions: 8 }, MEDIUM: { minInterviews: 2, minQuestions: 4 }, LOW: { minInterviews: 1, minQuestions: 1 } },
    active: true,
    notes: 'Initial default configuration',
  });

  // Seed scoring version
  await ScoringVersion.create({
    version: '1.0',
    name: 'Scoring Engine v1.0',
    competency_weights: { technical_knowledge: 0.25, problem_solving: 0.20, communication: 0.15, project_knowledge: 0.15, behavioral_skills: 0.10, resume_profile: 0.10, interview_performance: 0.05 },
    readiness_bands: { PLACEMENT_READY: { min: 85, max: 100 }, INTERVIEW_READY: { min: 75, max: 84.99 }, DEVELOPMENT_REQUIRED: { min: 60, max: 74.99 }, HIGH_INTERVENTION: { min: 0, max: 59.99 } },
    talent_criteria: { overall_readiness: 80, technical_knowledge: 75, communication: 70, problem_solving: 70, project_knowledge: 75 },
    segmentation_thresholds: { STRONG: 75, MODERATE: 60, NEEDS_IMPROVEMENT: 0 },
    confidence_thresholds: { HIGH: { minInterviews: 4, minQuestions: 8 }, MEDIUM: { minInterviews: 2, minQuestions: 4 }, LOW: { minInterviews: 1, minQuestions: 1 } },
    rubric_config: {},
    notes: 'Initial release',
  });

  console.log('\n✅ Placement data seeded successfully!\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                PLACEMENT DATA SUMMARY                       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Interview Sessions:  ${String(totalSessions).padStart(4)}                                ║`);
  console.log(`║  Interview Reports:   ${String(totalReports).padStart(4)}                                ║`);
  console.log(`║  Communication Rpts:  ${String(totalComm).padStart(4)}                                ║`);
  console.log(`║  Resume Versions:     ${String(totalResume).padStart(4)}                                ║`);
  console.log('║  Placement Config:    1 (active)                             ║');
  console.log('║  Scoring Version:     1.0                                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Student Skill Distribution:                                ║');
  console.log('║    High (8-9):  aarav, arjun, individual@test               ║');
  console.log('║    Med  (6-7):  diya, rohan, kavya, suresh                 ║');
  console.log('║    Low  (3-5):  sneha, aditya, meera, lakshmi              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n📊 You can now test the placement APIs:');
  console.log('   GET  /api/placement/admin/dashboard');
  console.log('   GET  /api/placement/admin/students');
  console.log('   GET  /api/placement/admin/skill-heatmap');
  console.log('   GET  /api/placement/admin/talent');
  console.log('   GET  /api/placement/config');
  console.log('   GET  /api/placement/config/versions');
  console.log('   GET  /api/placement/cache-stats');
}

run()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabase();
    process.exit(0);
  });
