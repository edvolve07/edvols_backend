import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { User, Op, Institution, Department, Assessment, AssessmentAttempt, InstitutionModule, getSequelize } from '../../database/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound, forbidden } from '../utils/httpError.js';
import { ROLES } from '../utils/roles.js';

const router = express.Router();
const sequelize = getSequelize();

router.use(requireAuth, requireRole(ROLES.MASTER_ADMIN));

function parseModules(body) {
  const modules = {};
  for (const key of ['aptitude', 'coding', 'interviews', 'resumeBuilder', 'certificates']) {
    if (body[`modules.${key}`] !== undefined) {
      modules[key] = Boolean(body[`modules.${key}`]);
    } else if (body.modules && body.modules[key] !== undefined) {
      modules[key] = Boolean(body.modules[key]);
    }
  }
  return Object.keys(modules).length ? modules : undefined;
}

async function syncInstitutionModules(institutionId, modules) {
  if (!modules || typeof modules !== 'object') return;
  for (const [name, enabled] of Object.entries(modules)) {
    await InstitutionModule.upsert({
      institution_id: institutionId,
      module_name: name,
      enabled: Boolean(enabled),
    });
  }
}

function serializeInstitution(inst) {
  return {
    id: inst._id,
    name: inst.name,
    code: inst.code,
    email: inst.email,
    phone: inst.phone || '',
    address: inst.address || '',
    modules: inst.modules || { aptitude: true, coding: true, interviews: true, resumeBuilder: false, certificates: true },
    status: inst.status,
    interview_gap_days: inst.interview_gap_days || 0,
    pricing: {
      basic_price: inst.basic_price ?? null,
      advanced_price: inst.advanced_price ?? null,
      professional_price: inst.professional_price ?? null,
    },
    created_by: inst.created_by || null,
    created_at: inst.created_at,
    updated_at: inst.updated_at,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const institutions = await Institution.findAll({
      where: filter,
      order: [['created_at', 'DESC']],
    });

    const institutionIds = institutions.map((i) => i._id);

    const [adminCounts, studentCounts] = await Promise.all([
      institutionIds.length
        ? User.findAll({
            attributes: ['institutionId', [sequelize.fn('COUNT', sequelize.col('_id')), 'count']],
            where: { institutionId: { [Op.in]: institutionIds }, role: 'admin' },
            group: ['institutionId'],
            raw: true,
          })
        : [],
      institutionIds.length
        ? User.findAll({
            attributes: ['institutionId', [sequelize.fn('COUNT', sequelize.col('_id')), 'count']],
            where: { institutionId: { [Op.in]: institutionIds }, role: 'student' },
            group: ['institutionId'],
            raw: true,
          })
        : [],
    ]);

    const adminCountMap = new Map(adminCounts.map((c) => [c.institutionId, Number(c.count)]));
    const studentCountMap = new Map(studentCounts.map((c) => [c.institutionId, Number(c.count)]));

    const enriched = institutions.map((inst) => ({
      ...serializeInstitution(inst),
      total_admins: adminCountMap.get(inst._id) || 0,
      total_students: studentCountMap.get(inst._id) || 0,
    }));

    res.json({ institutions: enriched });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const institution = await Institution.findByPk(req.params.id);
    if (!institution) throw notFound('Institution not found');

    const [totalAdmins, totalStudents, admins, departments] = await Promise.all([
      User.count({ where: { institutionId: institution._id, role: 'admin' } }),
      User.count({ where: { institutionId: institution._id, role: 'student' } }),
      User.findAll({
        where: { institutionId: institution._id, role: 'admin' },
        attributes: ['_id', 'name', 'email', 'phone'],
        order: [['name', 'ASC']],
      }),
      Department.findAll({
        where: { institution_id: institution._id },
        order: [['name', 'ASC']],
      }),
    ]);

    res.json({
      institution: {
        ...serializeInstitution(institution),
        total_admins: totalAdmins,
        total_students: totalStudents,
        admins: admins.map((a) => ({ id: a._id, name: a.name, email: a.email, phone: a.phone || '' })),
        departments: departments.map((d) => ({ id: d._id, name: d.name })),
      },
    });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const address = String(req.body.address || '').trim();
    const status = String(req.body.status || 'active').toLowerCase();

    const errors = [];
    if (!name) errors.push('Institution name is required');
    if (!code) errors.push('Institution code is required');
    if (!email) errors.push('Email is required');

    if (code) {
      const existingCode = await Institution.findOne({ where: { code } });
      if (existingCode) errors.push('Institution code is already in use');
    }
    if (email) {
      const existingEmail = await Institution.findOne({ where: { email } });
      if (existingEmail) errors.push('Email is already in use');
    }

    if (errors.length) throw badRequest('Validation failed', errors);

    const modules = {
      aptitude: req.body.modules?.aptitude !== false,
      coding: req.body.modules?.coding !== false,
      interviews: req.body.modules?.interviews !== false,
      resumeBuilder: req.body.modules?.resumeBuilder === true,
      certificates: req.body.modules?.certificates !== false,
    };

    const institution = await Institution.create({
      name, code, email, phone, address, modules,
      status: status === 'inactive' ? 'inactive' : 'active',
      created_by: req.user._id,
    });
    await syncInstitutionModules(institution._id, modules);

    res.status(201).json({ institution: serializeInstitution(institution) });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const institution = await Institution.findByPk(req.params.id);
    if (!institution) throw notFound('Institution not found');

    const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
    const code = req.body.code !== undefined ? String(req.body.code).trim().toUpperCase() : undefined;
    const email = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : undefined;
    const phone = req.body.phone !== undefined ? String(req.body.phone).trim() : undefined;
    const address = req.body.address !== undefined ? String(req.body.address).trim() : undefined;
    const status = req.body.status !== undefined ? String(req.body.status).toLowerCase() : undefined;
    const interview_gap_days = req.body.interview_gap_days !== undefined ? parseInt(req.body.interview_gap_days) || 0 : undefined;

    if (code && code !== institution.code) {
      const existingCode = await Institution.findOne({ where: { code, _id: { [Op.ne]: institution._id } } });
      if (existingCode) throw badRequest('Institution code is already in use');
      institution.code = code;
    }

    if (email && email !== institution.email) {
      const existingEmail = await Institution.findOne({ where: { email, _id: { [Op.ne]: institution._id } } });
      if (existingEmail) throw badRequest('Email is already in use');
      institution.email = email;
    }

    if (name) institution.name = name;
    if (phone !== undefined) institution.phone = phone;
    if (address !== undefined) institution.address = address;
    if (status && ['active', 'inactive'].includes(status)) institution.status = status;
    if (interview_gap_days !== undefined) institution.interview_gap_days = interview_gap_days;

    for (const key of ['basic_price', 'advanced_price', 'professional_price']) {
      if (req.body[key] === undefined) continue;
      const raw = req.body[key];
      const parsed = raw === null || raw === '' ? null : parseInt(raw, 10);
      if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
        throw badRequest(`${key} must be a positive number or blank to use the default`);
      }
      institution[key] = parsed;
    }

    const modulesUpdate = parseModules(req.body);
    if (modulesUpdate) {
      institution.modules = { ...institution.modules, ...modulesUpdate };
    }

    await institution.save();
    if (modulesUpdate) {
      await syncInstitutionModules(institution._id, institution.modules);
    }

    const [totalAdmins, totalStudents] = await Promise.all([
      User.count({ where: { institutionId: institution._id, role: 'admin' } }),
      User.count({ where: { institutionId: institution._id, role: 'student' } }),
    ]);

    res.json({
      institution: { ...serializeInstitution(institution), total_admins: totalAdmins, total_students: totalStudents },
    });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const institution = await Institution.findByPk(req.params.id);
    if (!institution) throw notFound('Institution not found');

    const [adminCount, studentCount] = await Promise.all([
      User.count({ where: { institutionId: institution._id, role: 'admin' } }),
      User.count({ where: { institutionId: institution._id, role: 'student' } }),
    ]);

    if (adminCount > 0 || studentCount > 0) {
      throw badRequest(
        'Cannot delete institution with active users',
        [`${adminCount} admin(s) and ${studentCount} student(s) are associated with this institution. Remove or reassign them first.`],
      );
    }

    await Institution.destroy({ where: { _id: institution._id } });
    res.status(204).end();
  }),
);

router.get(
  '/:id/analytics',
  asyncHandler(async (req, res) => {
    const institution = await Institution.findByPk(req.params.id);
    if (!institution) throw notFound('Institution not found');

    const [
      totalAdmins,
      totalStudents,
      aptAssessments,
      recentAdmins,
      recentStudents,
    ] = await Promise.all([
      User.count({ where: { institutionId: institution._id, role: 'admin' } }),
      User.count({ where: { institutionId: institution._id, role: 'student' } }),
      Assessment.findAll({ where: { institutionId: institution._id }, attributes: ['_id'] }),
      User.findAll({
        where: { institutionId: institution._id, role: 'admin' },
        attributes: ['_id', 'name', 'email', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
      User.findAll({
        where: { institutionId: institution._id, role: 'student' },
        attributes: ['_id', 'name', 'email', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
    ]);

    const aptAssessmentIds = aptAssessments.map((a) => a._id);

    const [totalAttempts, avgScoreResult] = await Promise.all([
      aptAssessmentIds.length
        ? AssessmentAttempt.count({ where: { assessment_id: { [Op.in]: aptAssessmentIds }, status: 'submitted' } })
        : 0,
      aptAssessmentIds.length
        ? AssessmentAttempt.findAll({
            attributes: [
              [sequelize.fn('AVG', sequelize.col('percentage')), 'avg'],
            ],
            where: { assessment_id: { [Op.in]: aptAssessmentIds }, status: 'submitted' },
            raw: true,
          })
        : [],
    ]);

    const avgScore = avgScoreResult.length ? Math.round(Number(avgScoreResult[0].avg) || 0) : 0;

    res.json({
      analytics: {
        total_admins: totalAdmins,
        total_students: totalStudents,
        total_assessments: aptAssessmentIds.length,
        total_attempts: totalAttempts,
        average_score: avgScore,
        recent_admins: recentAdmins.map((a) => ({ id: a._id, name: a.name, email: a.email, created_at: a.created_at })),
        recent_students: recentStudents.map((s) => ({ id: s._id, name: s.name, email: s.email, created_at: s.created_at })),
      },
    });
  }),
);

router.get(
  '/:id/admins',
  asyncHandler(async (req, res) => {
    const institution = await Institution.findByPk(req.params.id);
    if (!institution) throw notFound('Institution not found');

    const admins = await User.findAll({
      where: {
        institutionId: institution._id,
        role: 'admin',
      },
      attributes: ['_id', 'name', 'email', 'phone', 'modules_access', 'is_active'],
      order: [['name', 'ASC']],
    });

    res.json({
      admins: admins.map((a) => ({
        id: a._id,
        name: a.name,
        email: a.email,
        phone: a.phone || '',
        modules_access: a.modules_access || ['both'],
        is_active: a.is_active !== false,
      })),
    });
  }),
);

router.get(
  '/:id/departments',
  asyncHandler(async (req, res) => {
    const institution = await Institution.findByPk(req.params.id);
    if (!institution) throw notFound('Institution not found');

    const departments = await Department.findAll({
      where: { institution_id: institution._id },
      order: [['name', 'ASC']],
    });

    const deptIds = departments.map((d) => d._id);

    const [adminDeptCounts, studentDeptCounts] = await Promise.all([
      deptIds.length
        ? User.findAll({
            attributes: ['department_id', [sequelize.fn('COUNT', sequelize.col('_id')), 'count']],
            where: { department_id: { [Op.in]: deptIds }, role: 'admin' },
            group: ['department_id'],
            raw: true,
          })
        : [],
      deptIds.length
        ? User.findAll({
            attributes: ['department_id', [sequelize.fn('COUNT', sequelize.col('_id')), 'count']],
            where: { department_id: { [Op.in]: deptIds }, role: 'student' },
            group: ['department_id'],
            raw: true,
          })
        : [],
    ]);
    const countMap = new Map();
    for (const c of [...adminDeptCounts, ...studentDeptCounts]) {
      const key = c.department_id;
      countMap.set(key, (countMap.get(key) || 0) + Number(c.count));
    }

    res.json({
      departments: departments.map((d) => ({
        id: d._id,
        name: d.name,
        user_count: countMap.get(d._id) || 0,
      })),
    });
  }),
);

router.post(
  '/:id/departments',
  asyncHandler(async (req, res) => {
    const institution = await Institution.findByPk(req.params.id);
    if (!institution) throw notFound('Institution not found');

    const name = String(req.body.name || '').trim();
    if (!name) throw badRequest('Department name is required');

    const existing = await Department.findOne({
      where: { institution_id: institution._id, name },
    });
    if (existing) throw badRequest('Department already exists');

    const department = await Department.create({
      institution_id: institution._id,
      name,
    });

    res.status(201).json({ department: { id: department._id, name: department.name } });
  }),
);

router.delete(
  '/:id/departments/:deptId',
  asyncHandler(async (req, res) => {
    const department = await Department.findByPk(req.params.deptId);
    if (!department) throw notFound('Department not found');

    if (String(department.institution_id) !== String(req.params.id)) {
      throw forbidden('Department does not belong to this institution');
    }

    const [adminCount, studentCount] = await Promise.all([
      User.count({ where: { department_id: department._id, role: 'admin' } }),
      User.count({ where: { department_id: department._id, role: 'student' } }),
    ]);
    const userCount = adminCount + studentCount;
    if (userCount > 0) {
      throw badRequest(
        'Cannot delete department with active users',
        [`${userCount} user(s) are associated with this department. Reassign them first.`],
      );
    }

    await department.destroy();
    res.status(204).end();
  }),
);

function roundAvg(v) {
  if (v == null) return null;
  return Math.round(Number(v) * 10) / 10;
}

function avgOf(arr) {
  const nums = (arr || []).filter((v) => v != null);
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, v) => s + Number(v), 0) / nums.length) * 10) / 10;
}

router.get(
  '/analytics/revenue',
  asyncHandler(async (req, res) => {
    const INST_PRICE_KEYS = { basic: 'basic_price', advanced: 'advanced_price', professional: 'professional_price' };
    const DEFAULT_INST_PRICES = { basic: 499, advanced: 1199, professional: 1999 };

    const latestSub = `(
      SELECT DISTINCT ON (s.student_id::text) s.student_id::text AS student_id, s.plan_key, s.plan_name, s.amount_paid
      FROM subscriptions s
      WHERE s.status <> 'cancelled'
      ORDER BY s.student_id::text, s.created_at DESC
    ) sub`;

    const [instAgg] = await sequelize.query(
      `SELECT u."institutionId" AS inst_id,
              COUNT(DISTINCT u._id) AS students,
              COUNT(sub.student_id) AS paid_students
       FROM users u
       LEFT JOIN ${latestSub} ON sub.student_id = u._id::text
       WHERE u."institutionId" IS NOT NULL AND u.role = 'student'
       GROUP BY u."institutionId"`
    );

    const [instPlans] = await sequelize.query(
      `SELECT u."institutionId"::text AS inst_id, sub.plan_key, sub.plan_name,
              COUNT(*) AS n, COALESCE(SUM(sub.amount_paid), 0) AS paid_sum
       FROM users u
       JOIN ${latestSub} ON sub.student_id = u._id::text
       WHERE u."institutionId" IS NOT NULL AND u.role = 'student'
       GROUP BY u."institutionId", sub.plan_key, sub.plan_name`
    );

    const [indAgg] = await sequelize.query(
      `SELECT COALESCE(NULLIF(u.college_name, ''), 'Unspecified') AS name,
              COUNT(*) AS students,
              COUNT(sub.student_id) AS paid_students,
              COALESCE(SUM(sub.amount_paid), 0) AS revenue
       FROM users u
       LEFT JOIN ${latestSub} ON sub.student_id = u._id::text
       WHERE u.role = 'individual_student'
       GROUP BY 1`
    );

    const [indPlan] = await sequelize.query(
      `SELECT COALESCE(sub.plan_name, 'No plan') AS plan_name,
              COUNT(sub.student_id) AS paid_students,
              COALESCE(SUM(sub.amount_paid), 0) AS revenue
       FROM users u
       LEFT JOIN ${latestSub} ON sub.student_id = u._id::text
       WHERE u.role = 'individual_student'
       GROUP BY sub.plan_name
       ORDER BY revenue DESC`
    );

    const institutions = await Institution.findAll({ order: [['name', 'ASC']], raw: true });

    const institutionsList = institutions
      .map((inst) => {
        const id = String(inst._id);
        const agg = instAgg.find((r) => String(r.inst_id) === id) || {};
        const plans = instPlans
          .filter((r) => String(r.inst_id) === id)
          .map((r) => {
            let price = null;
            let revenue;
            if (INST_PRICE_KEYS[r.plan_key]) {
              price = inst[INST_PRICE_KEYS[r.plan_key]] ?? DEFAULT_INST_PRICES[r.plan_key];
              revenue = Number(r.n) * price;
            } else {
              revenue = Number(r.paid_sum);
            }
            return {
              plan_key: r.plan_key,
              plan_name: r.plan_name,
              price,
              students: Number(r.n),
              revenue,
            };
          })
          .sort((a, b) => b.revenue - a.revenue);
        return {
          id,
          name: inst.name,
          code: inst.code || '',
          students: Number(agg.students || 0),
          paid_students: Number(agg.paid_students || 0),
          pricing: {
            basic: inst.basic_price ?? DEFAULT_INST_PRICES.basic,
            advanced: inst.advanced_price ?? DEFAULT_INST_PRICES.advanced,
            professional: inst.professional_price ?? DEFAULT_INST_PRICES.professional,
          },
          plans,
          revenue: plans.reduce((s, p) => s + p.revenue, 0),
        };
      })
      .filter((i) => i.students > 0);

    const institutionPlans = institutionsList.flatMap((i) =>
      i.plans.map((p) => ({
        institution_id: i.id,
        institution_name: i.name,
        plan_key: p.plan_key,
        plan_name: p.plan_name,
        price: p.price,
        students: p.students,
        revenue: p.revenue,
      })),
    );

    const individualsList = indAgg.map((r) => ({
      name: r.name,
      students: Number(r.students),
      paid_students: Number(r.paid_students || 0),
      revenue: Number(r.revenue || 0),
    }));

    res.json({
      institutions: institutionsList,
      institution_plans: institutionPlans,
      individuals: individualsList,
      totals: {
        institutions: {
          groups: institutionsList.length,
          students: institutionsList.reduce((s, i) => s + i.students, 0),
          paid_students: institutionsList.reduce((s, i) => s + i.paid_students, 0),
          revenue: institutionsList.reduce((s, i) => s + i.revenue, 0),
        },
        individuals: {
          groups: individualsList.length,
          students: individualsList.reduce((s, i) => s + i.students, 0),
          paid_students: individualsList.reduce((s, i) => s + i.paid_students, 0),
          revenue: individualsList.reduce((s, i) => s + i.revenue, 0),
        },
      },
      plan_breakdown: {
        institutions: institutionPlans,
        individuals: indPlan,
      },
    });
  }),
);

router.get(
  '/analytics/overview',
  asyncHandler(async (req, res) => {
    const institutions = await Institution.findAll({ order: [['name', 'ASC']], raw: true });

    const [userAgg] = await sequelize.query(
      `SELECT u."institutionId" AS inst_id, u.role, COUNT(*) AS cnt
       FROM users u
       WHERE u."institutionId" IS NOT NULL AND u.role IN ('student', 'admin')
       GROUP BY u."institutionId", u.role`
    );

    const [deptAgg] = await sequelize.query(
      `SELECT institution_id, COUNT(*) AS cnt FROM departments GROUP BY institution_id`
    );

    const [revenueAgg] = await sequelize.query(
      `SELECT u."institutionId" AS inst_id,
              COUNT(sub.student_id) AS paid_students,
              COALESCE(SUM(sub.amount_paid), 0) AS revenue
       FROM users u
       LEFT JOIN (
         SELECT DISTINCT ON (s.student_id::text) s.student_id::text AS student_id, s.amount_paid
         FROM subscriptions s
         WHERE s.status <> 'cancelled'
         ORDER BY s.student_id::text, s.created_at DESC
       ) sub ON sub.student_id = u._id::text
       WHERE u."institutionId" IS NOT NULL AND u.role = 'student'
       GROUP BY u."institutionId"`
    );

    const [aptAgg] = await sequelize.query(
      `SELECT u."institutionId" AS inst_id, AVG(a.percentage) AS avg_score
       FROM assessment_attempts a
       JOIN users u ON u._id::text = a.student_id::text
       WHERE a.status = 'submitted' AND u."institutionId" IS NOT NULL
       GROUP BY u."institutionId"`
    );

    const [intAgg] = await sequelize.query(
      `SELECT u."institutionId" AS inst_id, COUNT(*) AS cnt, AVG(ji.overall_score) AS avg_score
       FROM journey_interviews ji
       JOIN users u ON u._id::text = ji.student_id
       WHERE ji.status = 'completed' AND u."institutionId" IS NOT NULL
       GROUP BY u."institutionId"`
    );

    const [readAgg] = await sequelize.query(
      `SELECT u."institutionId" AS inst_id, AVG(sj.readiness_score) AS avg_score
       FROM student_journeys sj
       JOIN users u ON u._id::text = sj.student_id
       WHERE sj.readiness_score IS NOT NULL AND u."institutionId" IS NOT NULL
       GROUP BY u."institutionId"`
    );

    const institutionsList = institutions.map((inst) => {
      const id = String(inst._id);
      const users = userAgg.filter((r) => String(r.inst_id) === id);
      const revRow = revenueAgg.find((r) => String(r.inst_id) === id);
      return {
        key: `institution:${id}`,
        type: 'institution',
        id,
        name: inst.name,
        code: inst.code || '',
        status: inst.status,
        admins: Number(users.find((r) => r.role === 'admin')?.cnt || 0),
        student_count: Number(users.find((r) => r.role === 'student')?.cnt || 0),
        branch_count: Number(deptAgg.find((r) => String(r.institution_id) === id)?.cnt || 0),
        paid_students: Number(revRow?.paid_students || 0),
        revenue: Number(revRow?.revenue || 0),
        avg_aptitude: roundAvg(aptAgg.find((r) => String(r.inst_id) === id)?.avg_score),
        avg_interview: roundAvg(intAgg.find((r) => String(r.inst_id) === id)?.avg_score),
        avg_readiness: roundAvg(readAgg.find((r) => String(r.inst_id) === id)?.avg_score),
        completed_interviews: Number(intAgg.find((r) => String(r.inst_id) === id)?.cnt || 0),
      };
    });

    const [selfAgg] = await sequelize.query(
      `SELECT u.college_name AS name,
              COUNT(*) AS students,
              COUNT(sub.student_id) AS paid_students,
              COALESCE(SUM(sub.amount_paid), 0) AS revenue
       FROM users u
       LEFT JOIN (
         SELECT DISTINCT ON (s.student_id::text) s.student_id::text AS student_id, s.amount_paid
         FROM subscriptions s
         WHERE s.status <> 'cancelled'
         ORDER BY s.student_id::text, s.created_at DESC
       ) sub ON sub.student_id = u._id::text
       WHERE u.role = 'individual_student' AND u.college_name IS NOT NULL AND u.college_name <> ''
       GROUP BY u.college_name`
    );
    const [selfApt] = await sequelize.query(
      `SELECT u.college_name AS name, AVG(a.percentage) AS avg_score
       FROM assessment_attempts a
       JOIN users u ON u._id::text = a.student_id::text
       WHERE a.status = 'submitted' AND u.role = 'individual_student'
         AND u.college_name IS NOT NULL AND u.college_name <> ''
       GROUP BY u.college_name`
    );
    const [selfInt] = await sequelize.query(
      `SELECT u.college_name AS name, COUNT(*) AS cnt, AVG(ji.overall_score) AS avg_score
       FROM journey_interviews ji
       JOIN users u ON u._id::text = ji.student_id
       WHERE ji.status = 'completed' AND u.role = 'individual_student'
         AND u.college_name IS NOT NULL AND u.college_name <> ''
       GROUP BY u.college_name`
    );
    const [selfRead] = await sequelize.query(
      `SELECT u.college_name AS name, AVG(sj.readiness_score) AS avg_score
       FROM student_journeys sj
       JOIN users u ON u._id::text = sj.student_id
       WHERE sj.readiness_score IS NOT NULL AND u.role = 'individual_student'
         AND u.college_name IS NOT NULL AND u.college_name <> ''
       GROUP BY u.college_name`
    );

    const selfPayList = selfAgg
      .filter((r) => Number(r.students) > 0)
      .map((r) => ({
        key: `self:${r.name}`,
        type: 'self_pay',
        name: r.name,
        student_count: Number(r.students),
        paid_students: Number(r.paid_students || 0),
        revenue: Number(r.revenue || 0),
        avg_aptitude: roundAvg(selfApt.find((x) => x.name === r.name)?.avg_score),
        avg_interview: roundAvg(selfInt.find((x) => x.name === r.name)?.avg_score),
        avg_readiness: roundAvg(selfRead.find((x) => x.name === r.name)?.avg_score),
        completed_interviews: Number(selfInt.find((x) => x.name === r.name)?.cnt || 0),
      }));

    const colleges = [...institutionsList, ...selfPayList];

    res.json({
      colleges,
      totals: {
        colleges: colleges.length,
        students: colleges.reduce((sum, c) => sum + c.student_count, 0),
        paid_students: colleges.reduce((sum, c) => sum + c.paid_students, 0),
        revenue: colleges.reduce((sum, c) => sum + c.revenue, 0),
      },
    });
  }),
);

router.get(
  '/analytics/detail',
  asyncHandler(async (req, res) => {
    const { type = 'institution', id, name } = req.query;

    let college = {};
    let userFilterSql;
    let params = {};

    if (type === 'self_pay') {
      const collegeName = String(name || '').trim();
      if (!collegeName) throw badRequest('College name is required');
      userFilterSql = `u.role = 'individual_student' AND u.college_name = :collegeName`;
      params = { collegeName };
      college = { type: 'self_pay', name: collegeName };
    } else {
      let institution;
      try {
        institution = await Institution.findByPk(id);
      } catch (_e) {
        institution = null;
      }
      if (!institution) throw notFound('Institution not found');
      userFilterSql = `u."institutionId" = :collegeId AND u.role = 'student'`;
      params = { collegeId: id };
      college = { type: 'institution', id, name: institution.name, code: institution.code || '' };
    }

    const [users] = await sequelize.query(
      `SELECT u._id, u.name, u.email, u.usn, u.year, u.stream, u.course_details,
              u.department_id, d.name AS branch, u.status, u.is_active
       FROM users u
       LEFT JOIN departments d ON d._id = u.department_id
       WHERE ${userFilterSql}
       ORDER BY u.name ASC`,
      { replacements: params }
    );

    const empty = {
      college,
      stats: {
        total_students: 0,
        paid_students: 0,
        revenue: 0,
        completed_interviews: 0,
        active_journeys: 0,
        completed_journeys: 0,
        avg_aptitude: null,
        avg_interview: null,
        avg_communication: null,
        avg_programming: null,
        avg_readiness: null,
      },
      branches: [],
      students: [],
      strengths: [],
      weaknesses: [],
      revenue_by_plan: [],
    };

    const userIds = users.map((u) => u._id);
    if (!userIds.length) return res.json(empty);

    const [
      [subs],
      [journeys],
      [apt],
      [interviews],
      [comm],
      [prog],
      [reportAvgs],
      [reports],
    ] = await Promise.all([
      sequelize.query(
        `SELECT s.student_id::text AS student_id, s.plan_name, s.plan_key, s.amount_paid, s.status AS sub_status, s.access_level
         FROM subscriptions s
         WHERE s.student_id::text IN (:uids) AND s.status <> 'cancelled'
         ORDER BY s.created_at DESC`,
        { replacements: { uids: userIds } }
      ),
      sequelize.query(
        `SELECT sj.student_id, sj.journey_access_level, sj.current_level, sj.completed_interviews,
                sj.readiness_score, sj.status AS journey_status
         FROM student_journeys sj
         WHERE sj.student_id IN (:uids)`,
        { replacements: { uids: userIds } }
      ),
      sequelize.query(
        `SELECT a.student_id::text AS student_id, COUNT(*) AS attempts, AVG(a.percentage) AS avg_score
         FROM assessment_attempts a
         WHERE a.status = 'submitted' AND a.student_id::text IN (:uids)
         GROUP BY a.student_id`,
        { replacements: { uids: userIds } }
      ),
      sequelize.query(
        `SELECT ji.student_id, COUNT(*) AS cnt, AVG(ji.overall_score) AS avg_score
         FROM journey_interviews ji
         WHERE ji.status = 'completed' AND ji.student_id IN (:uids)
         GROUP BY ji.student_id`,
        { replacements: { uids: userIds } }
      ),
      sequelize.query(
        `SELECT cr.student_id, COUNT(*) AS cnt, AVG((cr.overall->>'percentage')::numeric) AS avg_score
         FROM communication_reports cr
         WHERE cr.student_id IN (:uids)
         GROUP BY cr.student_id`,
        { replacements: { uids: userIds } }
      ),
      sequelize.query(
        `SELECT pa.student_id::text AS student_id, COUNT(*) AS cnt,
                AVG(CASE WHEN pa.total_marks > 0 THEN (pa.obtained_marks / pa.total_marks) * 100 ELSE NULL END) AS avg_score
         FROM programming_assessment_attempts pa
         WHERE pa.student_id::text IN (:uids)
         GROUP BY pa.student_id`,
        { replacements: { uids: userIds } }
      ),
      sequelize.query(
        `SELECT r.student_id, COUNT(*) AS cnt, AVG((r.overall->>'percentage')::numeric) AS avg_score
         FROM interview_reports r
         WHERE r.student_id IN (:uids)
         GROUP BY r.student_id`,
        { replacements: { uids: userIds } }
      ),
      sequelize.query(
        `SELECT DISTINCT ON (r.student_id) r.student_id, r.strengths, r.areas_to_improve
         FROM interview_reports r
         WHERE r.student_id IN (:uids)
         ORDER BY r.student_id, r.created_at DESC`,
        { replacements: { uids: userIds } }
      ),
    ]);

    function toArr(v) {
      if (Array.isArray(v)) return v.map(String).filter(Boolean);
      if (typeof v === 'string') {
        try {
          const parsed = JSON.parse(v);
          return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
        } catch (_e) {
          return [];
        }
      }
      return [];
    }

    const strengthFreq = new Map();
    const weakFreq = new Map();

    const students = users.map((u) => {
      const uid = String(u._id);
      const sub = subs.find((s) => String(s.student_id) === uid);
      const journey = journeys.find((j) => String(j.student_id) === uid);
      const a = apt.find((x) => String(x.student_id) === uid);
      const iv = interviews.find((x) => String(x.student_id) === uid);
      const ra = reportAvgs.find((x) => String(x.student_id) === uid);
      const c = comm.find((x) => String(x.student_id) === uid);
      const p = prog.find((x) => String(x.student_id) === uid);
      const r = reports.find((x) => String(x.student_id) === uid);
      const strengths = toArr(r?.strengths);
      const weaknesses = toArr(r?.areas_to_improve);
      for (const s of strengths) strengthFreq.set(s, (strengthFreq.get(s) || 0) + 1);
      for (const w of weaknesses) weakFreq.set(w, (weakFreq.get(w) || 0) + 1);
      return {
        id: uid,
        name: u.name,
        email: u.email,
        usn: u.usn || '',
        year: u.year || '',
        stream: u.stream || '',
        course_details: u.course_details || '',
        branch: u.branch || '',
        status: u.status || 'active',
        is_active: u.is_active !== false,
        plan_name: sub?.plan_name || null,
        plan_key: sub?.plan_key || null,
        amount_paid: Number(sub?.amount_paid || 0),
        sub_status: sub?.sub_status || null,
        access_level: sub?.access_level || 0,
        current_level: journey?.current_level || 0,
        completed_interviews: Number(journey?.completed_interviews || 0),
        readiness_score: journey?.readiness_score ?? null,
        journey_status: journey?.journey_status || 'not_started',
        avg_aptitude: roundAvg(a?.avg_score),
        attempts: Number(a?.attempts || 0),
        avg_interview: roundAvg(iv?.avg_score ?? ra?.avg_score),
        interview_count: Math.max(Number(iv?.cnt || 0), Number(ra?.cnt || 0)),
        avg_communication: roundAvg(c?.avg_score),
        avg_programming: roundAvg(p?.avg_score),
        strengths,
        weaknesses,
      };
    });

    const strengths = [...strengthFreq.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 12);
    const weaknesses = [...weakFreq.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 12);

    const [branchRevenue] = await sequelize.query(
      `SELECT d.name AS branch, COUNT(DISTINCT u._id) AS students,
              COUNT(sub.student_id) AS paid_students, COALESCE(SUM(sub.amount_paid), 0) AS revenue
       FROM users u
       JOIN departments d ON d._id = u.department_id
       LEFT JOIN (
         SELECT DISTINCT ON (s.student_id::text) s.student_id::text AS student_id, s.amount_paid
         FROM subscriptions s
         WHERE s.status <> 'cancelled'
         ORDER BY s.student_id::text, s.created_at DESC
       ) sub ON sub.student_id = u._id::text
       WHERE ${userFilterSql} AND u.department_id IS NOT NULL
       GROUP BY d.name
       ORDER BY revenue DESC`,
      { replacements: params }
    );

    const [planRevenue] = await sequelize.query(
      `SELECT COALESCE(sub.plan_name, 'No plan') AS plan_name,
              COUNT(DISTINCT u._id) AS students,
              COUNT(sub.student_id) AS paid_students,
              COALESCE(SUM(sub.amount_paid), 0) AS revenue
       FROM users u
       LEFT JOIN (
         SELECT DISTINCT ON (s.student_id::text) s.student_id::text AS student_id,
                s.plan_name, s.amount_paid
         FROM subscriptions s
         WHERE s.status <> 'cancelled'
         ORDER BY s.student_id::text, s.created_at DESC
       ) sub ON sub.student_id = u._id::text
       WHERE ${userFilterSql}
       GROUP BY sub.plan_name
       ORDER BY revenue DESC`,
      { replacements: params }
    );

    const paidCount = new Set(subs.map((s) => String(s.student_id))).size;
    const revenue = students.reduce((sum, s) => sum + s.amount_paid, 0);
    const completedInterviews = students.reduce((sum, s) => sum + s.completed_interviews, 0);
    const activeJourneys = journeys.filter((j) => j.journey_status === 'in_progress').length;
    const completedJourneys = journeys.filter((j) => j.journey_status === 'completed').length;

    res.json({
      college,
      stats: {
        total_students: students.length,
        paid_students: paidCount,
        revenue,
        completed_interviews: completedInterviews,
        active_journeys: activeJourneys,
        completed_journeys: completedJourneys,
        avg_aptitude: avgOf(students.map((s) => s.avg_aptitude)),
        avg_interview: avgOf(students.map((s) => s.avg_interview)),
        avg_communication: avgOf(students.map((s) => s.avg_communication)),
        avg_programming: avgOf(students.map((s) => s.avg_programming)),
        avg_readiness: avgOf(students.map((s) => s.readiness_score)),
      },
      branches: branchRevenue,
      students,
      strengths,
      weaknesses,
      revenue_by_plan: planRevenue,
    });
  }),
);

export default router;
