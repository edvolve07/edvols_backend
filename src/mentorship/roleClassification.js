/**
 * EDVOLS Role Classification Layer
 * Categorizes student target roles into core functional pillars:
 * - Technical
 * - Finance
 * - HR
 * - Marketing
 * - Sales
 * - Operations
 * - Business
 * - Non-Technical
 */

export const ROLE_CATEGORIES = {
  TECHNICAL: 'Technical',
  FINANCE: 'Finance',
  HR: 'HR',
  MARKETING: 'Marketing',
  SALES: 'Sales',
  OPERATIONS: 'Operations',
  BUSINESS: 'Business',
  NON_TECHNICAL: 'Non-Technical',
};

const ROLE_MAPPINGS = [
  // Technical
  {
    keywords: [
      'software', 'developer', 'engineer', 'frontend', 'backend', 'full stack',
      'web developer', 'app developer', 'android', 'ios', 'data scientist',
      'devops', 'cloud', 'database', 'system architect', 'programmer',
      'java', 'python', 'c++', 'react', 'node', 'embedded', 'qa', 'test engineer',
      'network engineer', 'security engineer', 'machine learning', 'ai engineer',
    ],
    category: ROLE_CATEGORIES.TECHNICAL,
    description: 'Technical and engineering roles focused on software, systems, databases, code logic, and technical architecture.',
    keySkills: ['Programming', 'Data Structures & Algorithms', 'System Architecture', 'Debugging', 'APIs', 'Databases', 'Tooling'],
    scenarioTone: 'technical incident response, production debugging, code optimization, architectural trade-offs, and scalability',
  },
  // Finance
  {
    keywords: [
      'financial', 'accountant', 'auditor', 'tax', 'finance', 'banking',
      'trade analyst', 'investment', 'equity', 'wealth', 'treasury',
      'credit analyst', 'portfolio', 'accounts',
    ],
    category: ROLE_CATEGORIES.FINANCE,
    description: 'Financial analysis, accounting standards, budgeting, valuation, financial reporting, and fiscal governance.',
    keySkills: ['Financial Modeling', 'Financial Statements', 'Ratio Analysis', 'Excel & Modeling', 'Taxation & Audit', 'Valuation', 'Compliance'],
    scenarioTone: 'budget variance, cash flow crunch, audit discrepancies, capital allocation, forecasting risk, and financial reporting',
  },
  // HR
  {
    keywords: [
      'hr', 'human resources', 'recruiter', 'talent', 'people ops',
      'employee relations', 'training & development', 'hr executive', 'hr manager',
      'staffing', 'onboarding',
    ],
    category: ROLE_CATEGORIES.HR,
    description: 'Human resource management, talent acquisition, workplace culture, employee conflict resolution, and performance management.',
    keySkills: ['Recruitment Lifecycle', 'Employee Engagement', 'Conflict Resolution', 'Labor Laws', 'Performance Appraisals', 'HR Policies'],
    scenarioTone: 'interpersonal conflict, retention challenges, appraisal disputes, policy violations, and talent acquisition bottlenecks',
  },
  // Marketing
  {
    keywords: [
      'marketing', 'seo', 'social media', 'content writer', 'copywriter',
      'growth hacker', 'brand', 'digital marketing', 'pr executive',
      'public relations', 'campaign', 'advertising', 'communications specialist',
    ],
    category: ROLE_CATEGORIES.MARKETING,
    description: 'Marketing strategy, digital campaigns, customer acquisition, content creation, brand positioning, and performance metrics.',
    keySkills: ['Campaign Management', 'SEO / SEM', 'Content Strategy', 'Analytics (CAC, LTV, ROAS)', 'Brand Communication', 'Audience Segmentation'],
    scenarioTone: 'campaign ROI drop, negative PR, shifting audience demographics, budget reallocation, and customer acquisition bottlenecks',
  },
  // Sales
  {
    keywords: [
      'sales', 'business development', 'bdr', 'sdr', 'account executive',
      'inside sales', 'client relations', 'lead generation', 'relationship manager',
    ],
    category: ROLE_CATEGORIES.SALES,
    description: 'Sales cycle management, client relationship building, objection handling, negotiations, and revenue growth.',
    keySkills: ['Prospecting', 'Objection Handling', 'Negotiation', 'CRM Management', 'Closing Deals', 'Relationship Building'],
    scenarioTone: 'price resistance against competitors, stalled pipeline deals, demanding enterprise clients, and quarterly quota pressure',
  },
  // Operations
  {
    keywords: [
      'operations', 'supply chain', 'logistics', 'procurement',
      'inventory', 'plant manager', 'quality assurance', 'facility',
    ],
    category: ROLE_CATEGORIES.OPERATIONS,
    description: 'Operational efficiency, supply chain logistics, inventory management, vendor relationships, and workflow optimization.',
    keySkills: ['Process Optimization', 'Supply Chain Management', 'Vendor Management', 'SLA Tracking', 'Quality Control', 'Root Cause Analysis'],
    scenarioTone: 'supply chain disruptions, vendor SLA breaches, inventory shortages, workflow bottlenecks, and operational cost overruns',
  },
  // Business
  {
    keywords: [
      'business analyst', 'product manager', 'management trainee',
      'consultant', 'strategy', 'project manager', 'scrum master',
      'business operations', 'program manager',
    ],
    category: ROLE_CATEGORIES.BUSINESS,
    description: 'Business analysis, product strategy, requirement discovery, stakeholder communication, and commercial decision-making.',
    keySkills: ['Requirement Gathering', 'Stakeholder Management', 'Roadmap Planning', 'Process Flowcharts', 'KPI Definition', 'Business Case Analysis'],
    scenarioTone: 'scope creep, conflicting executive priorities, user adoption drop, product launch delays, and ROI justification',
  },
];

const DOMAIN_DEFAULT_CATEGORIES = {
  Engineering: ROLE_CATEGORIES.TECHNICAL,
  BCA: ROLE_CATEGORIES.TECHNICAL,
  MCA: ROLE_CATEGORIES.TECHNICAL,
  'MCA / M.Sc IT': ROLE_CATEGORIES.TECHNICAL,
  'B.Sc': ROLE_CATEGORIES.TECHNICAL,
  'B.Com': ROLE_CATEGORIES.FINANCE,
  Commerce: ROLE_CATEGORIES.FINANCE,
  BBA: ROLE_CATEGORIES.BUSINESS,
  MBA: ROLE_CATEGORIES.BUSINESS,
  BA: ROLE_CATEGORIES.NON_TECHNICAL,
  'Arts / Humanities': ROLE_CATEGORIES.NON_TECHNICAL,
  Other: ROLE_CATEGORIES.TECHNICAL,
};

/**
 * Classifies a given role and domain into one of the core role categories.
 */
export function classifyRole(role = '', domain = '') {
  const cleanRole = String(role || '').toLowerCase().trim();
  const cleanDomain = String(domain || '').trim();

  for (const mapping of ROLE_MAPPINGS) {
    for (const kw of mapping.keywords) {
      if (cleanRole === kw || cleanRole.includes(kw)) {
        return {
          category: mapping.category,
          description: mapping.description,
          keySkills: mapping.keySkills,
          scenarioTone: mapping.scenarioTone,
        };
      }
    }
  }

  // Fall back to domain defaults
  const domainCategory = DOMAIN_DEFAULT_CATEGORIES[cleanDomain] || ROLE_CATEGORIES.NON_TECHNICAL;
  const fallbackMapping = ROLE_MAPPINGS.find(m => m.category === domainCategory) || {
    category: ROLE_CATEGORIES.NON_TECHNICAL,
    description: 'General professional role evaluating structured communication, problem-solving, and role fundamentals.',
    keySkills: ['Communication', 'Critical Thinking', 'Professional Aptitude', 'Workplace Organization'],
    scenarioTone: 'workplace dilemmas, professional ethics, teamwork challenges, and communication barriers',
  };

  return {
    category: fallbackMapping.category,
    description: fallbackMapping.description,
    keySkills: fallbackMapping.keySkills,
    scenarioTone: fallbackMapping.scenarioTone,
  };
}

/**
 * Estimates experience level based on student profile and resume context.
 */
export function determineExperienceLevel(resumeText = '', userProfile = {}) {
  const text = String(resumeText || '').toLowerCase();

  // If user profile explicitly has years of experience
  if (userProfile?.experience_years != null) {
    const yrs = Number(userProfile.experience_years);
    if (yrs >= 4) return 'Mid-to-Senior Professional';
    if (yrs >= 2) return 'Junior Professional (2-3 years)';
    if (yrs >= 1) return 'Associate / Junior (1-2 years)';
    return 'Fresher / Entry-Level Graduate';
  }

  // Check resume text signals
  const expMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/i);
  if (expMatch && expMatch[1]) {
    const yrs = parseInt(expMatch[1]);
    if (yrs >= 4) return 'Mid-to-Senior Professional';
    if (yrs >= 2) return 'Junior Professional (2-3 years)';
    if (yrs >= 1) return 'Associate / Junior (1-2 years)';
  }

  if (text.includes('senior') || text.includes('lead engineer') || text.includes('manager')) {
    return 'Junior Professional (with leadership exposure)';
  }

  return 'Fresher / Entry-Level Candidate';
}

/**
 * Generates prompt instructions tailored specifically to the role category, domain, and experience level.
 */
export function buildRoleCategoryGuidance(category, domain, role, experienceLevel) {
  const cat = String(category || ROLE_CATEGORIES.TECHNICAL);
  const isFresher = String(experienceLevel || '').toLowerCase().includes('fresher');

  let guidance = `Target Role: "${role}"\nDomain: "${domain}"\nRole Classification: ${cat}\nExperience Level: ${experienceLevel}\n\n`;

  guidance += `ROLE-SPECIFIC MANDATES:\n`;
  if (cat === ROLE_CATEGORIES.TECHNICAL) {
    guidance += `- Ask questions grounded in real technical implementations: code logic, system architecture, database interactions, error handling, debugging, and deployment.\n`;
    guidance += `- DO NOT ask generic aptitude riddles. Frame problems around real software/system engineering situations.\n`;
  } else if (cat === ROLE_CATEGORIES.FINANCE) {
    guidance += `- Ask questions grounded in financial statements, balance sheets, P&L analysis, ratios, budgeting, cash flows, tax implications, or financial modeling.\n`;
    guidance += `- DO NOT ask coding or software engineering questions.\n`;
  } else if (cat === ROLE_CATEGORIES.HR) {
    guidance += `- Ask questions grounded in HR processes: talent acquisition, employee relations, grievance handling, performance management, appraisal systems, and labor compliance.\n`;
    guidance += `- DO NOT ask coding or software engineering questions.\n`;
  } else if (cat === ROLE_CATEGORIES.MARKETING) {
    guidance += `- Ask questions grounded in marketing strategy: digital channels, SEO/SEM, customer acquisition cost (CAC), lifetime value (LTV), content strategy, and campaign analytics.\n`;
    guidance += `- DO NOT ask coding or software engineering questions.\n`;
  } else if (cat === ROLE_CATEGORIES.SALES) {
    guidance += `- Ask questions grounded in the sales pipeline: prospecting, handling price objections, closing techniques, negotiation with decision makers, and quota management.\n`;
    guidance += `- DO NOT ask coding or software engineering questions.\n`;
  } else if (cat === ROLE_CATEGORIES.OPERATIONS) {
    guidance += `- Ask questions grounded in operational workflows: supply chain continuity, inventory management, process bottlenecks, vendor SLAs, and efficiency metrics.\n`;
    guidance += `- DO NOT ask coding or software engineering questions.\n`;
  } else if (cat === ROLE_CATEGORIES.BUSINESS) {
    guidance += `- Ask questions grounded in business analysis: user stories, stakeholder management, requirement elicitation, feature prioritization, ROI, and KPIs.\n`;
    guidance += `- DO NOT ask coding or software engineering questions.\n`;
  } else {
    guidance += `- Ask questions grounded in the specific requirements, tools, and professional practices of "${role}".\n`;
    guidance += `- DO NOT default to software engineering questions.\n`;
  }

  if (isFresher) {
    guidance += `- Since the candidate is a fresher/entry-level graduate, calibrate expectations accordingly. Ground questions in their academic projects, coursework, internships, certifications, or hypothetical practical scenarios rather than demanding 5+ years of enterprise production experience.\n`;
  }

  return guidance;
}
