/**
 * EDVOLS 30 Dynamic Role-Based Interview Progression Framework
 * 
 * 3 Core Levels of 10 Interviews each:
 *   Level 1: Foundation (1–10) -> Understand baseline, education, resume claims & fundamentals
 *   Level 2: Role Development (11–20) -> Role-specific depth, problem-solving & practical scenarios
 *   Level 3: Placement Ready (21–30) -> Advanced cross-examination, case studies, defense & hiring simulation
 */

import { classifyRole } from './roleClassification.js';

export const LEVELS = [
  {
    level: 1,
    name: 'Foundation',
    interview_range: [1, 10],
    unlock_after_interviews: 0,
    features: [
      'Self Introduction & Confidence',
      'Resume Walkthrough',
      'Education & Academic Background',
      'Skills Verification',
      'Project / Experience Discussion',
      'Domain Fundamentals',
      'Role Fundamentals',
      'Resume-Based Questions',
      'Behavioral Fundamentals',
      'Foundation Mock Interview (#10)',
    ],
    color: 'bg-blue-600',
  },
  {
    level: 2,
    name: 'Role Development',
    interview_range: [11, 20],
    unlock_after_interviews: 10,
    features: [
      'Role-Specific Interview I',
      'Role-Specific Interview II',
      'Resume Deep-Dive',
      'Project Deep-Dive',
      'Practical Problem Solving',
      'Role-Based Scenarios',
      'Tools & Technology',
      'Decision Making',
      'Behavioral & Situational',
      'Intermediate Mock Interview (#20)',
    ],
    color: 'bg-emerald-600',
  },
  {
    level: 3,
    name: 'Placement Ready',
    interview_range: [21, 30],
    unlock_after_interviews: 20,
    features: [
      'Advanced Role Interview',
      'Advanced Problem Solving',
      'Project Defense',
      'Cross-Questioning Interview',
      'Case Study Interview',
      'Workplace Situational Interview',
      'Leadership & Behavioral Interview',
      'HR & Career Discussion',
      'Company-Style Recruitment Simulation',
      'Final Placement Interview (#30)',
    ],
    color: 'bg-purple-600',
  },
];

export const BLUEPRINTS = [
  // ─────────────────────────────────────────────────────────────
  // LEVEL 1 — FOUNDATION (1–10)
  // ─────────────────────────────────────────────────────────────
  {
    interview_number: 1,
    title: 'Self Introduction',
    level: 1,
    objective: 'Evaluate communication, confidence, career goals, clarity, and basic professional communication considering the student target role and background.',
    focus_areas: [
      'Self introduction',
      'Career goals & trajectory',
      'Communication clarity',
      'Basic professional presence',
      'Target role alignment',
    ],
    difficulty: 'Easy',
    category: 'Foundation',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an expert placement interviewer conducting Interview #1: Self Introduction.
Focus on evaluating the candidate's self-introduction, confidence, clarity of career goals, and basic professional articulation.
Ground questions in their selected target role, domain, and resume background.
Ask ONE clear, engaging question at a time.
Encourage a structured professional narrative.`,
    follow_up_guidelines: [
      'Ask the candidate to explain what inspired their career interest in this role',
      'Probe on how their background prepares them for this career trajectory',
      'Evaluate clarity of expression and confidence',
    ],
    evaluation_criteria: {
      communication: 'Speaks clearly, professionally, and at an appropriate pace',
      confidence: 'Demonstrates poise, self-assurance, and enthusiasm',
      clarity_of_intent: 'Has articulate, realistic short-term and long-term career goals',
      role_alignment: 'Connects personal narrative naturally to the target job role',
    },
  },
  {
    interview_number: 2,
    title: 'Resume Walkthrough',
    level: 1,
    objective: 'Ask the candidate to explain their education, skills, experience, projects, and achievements directly from their resume to verify genuine understanding of listed claims.',
    focus_areas: [
      'Education overview',
      'Skills timeline',
      'Experience & internship walkthrough',
      'Key projects summary',
      'Authentic ownership of resume claims',
    ],
    difficulty: 'Easy',
    category: 'Verification',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an expert placement interviewer conducting Interview #2: Resume Walkthrough.
Your objective is to verify whether the student genuinely understands and can explain the information listed on their resume.
Directly ask about specific items on the resume: degrees, courses, listed skills, projects, and achievements.
Do NOT ask generic questions unrelated to what is written on their resume.
Ask ONE focused question at a time.`,
    follow_up_guidelines: [
      'Pick a specific bullet point from their resume and ask them to explain their direct involvement',
      'Probe on the timeline of when and where they applied a listed skill',
      'Verify whether claims reflect actual hands-on work or merely observational exposure',
    ],
    evaluation_criteria: {
      resume_fidelity: 'Accurately explains the details and context of all resume claims',
      content_depth: 'Demonstrates genuine hands-on understanding of listed items',
      articulation: 'Walks through their professional and academic journey coherently',
    },
  },
  {
    interview_number: 3,
    title: 'Education & Academic Background',
    level: 1,
    objective: 'Evaluate academic knowledge, relevant coursework/subjects, the connection between education and target role, and ability to explain academic experience.',
    focus_areas: [
      'Core academic subjects',
      'Relevant degree coursework',
      'Academic-to-role connection',
      'Academic projects / capstones',
      'Conceptual grounding',
    ],
    difficulty: 'Easy',
    category: 'Foundation',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an academic and placement interviewer conducting Interview #3: Education & Academic Background.
Evaluate the candidate's academic foundation based on their specific degree/discipline (e.g. B.Tech, BCA, B.Com, BBA, MBA, B.Sc, BA) and target role.
Ask how their coursework and academic projects connect to what is required in their target role.
Ensure questions match their actual academic field and target job.`,
    follow_up_guidelines: [
      'Ask about a favorite subject or theoretical concept relevant to their target career',
      'Inquire how academic learning bridges the gap to industry requirements',
      'Test understanding of foundational concepts covered in their curriculum',
    ],
    evaluation_criteria: {
      academic_knowledge: 'Solid grasp of core subjects from their formal education',
      relevance_mapping: 'Effectively links academic curriculum to industry job expectations',
      intellectual_curiosity: 'Shows enthusiasm and deep understanding of their academic field',
    },
  },
  {
    interview_number: 4,
    title: 'Skills Verification',
    level: 1,
    objective: 'Identify specific technical or functional skills claimed in the resume and verify them with targeted questions. Do not ask generic questions unrelated to the resume.',
    focus_areas: [
      'Resume-claimed skill verification',
      'Practical usage of tools/skills',
      'Core syntax or principles',
      'Application context of skills',
      'Authenticity of claimed proficiencies',
    ],
    difficulty: 'Easy',
    category: 'Verification',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a technical/functional interviewer conducting Interview #4: Skills Verification.
Identify the exact skills, tools, and libraries claimed in the candidate's resume (e.g. if technical: Java, Spring Boot, SQL; if finance: Excel, Balance Sheets, Ratios; if marketing: SEO, Google Analytics; if HR: Recruitment, Labor Law).
Ask direct questions verifying their genuine understanding of those specific claimed skills.
DO NOT ask questions about skills they did not claim or generic questions unrelated to their resume.`,
    follow_up_guidelines: [
      'Ask for a concrete scenario where they utilized a specific claimed skill',
      'Probe on the core syntax, functions, or principles behind the skill',
      'Test their understanding of limitations or edge cases of the tool/skill',
    ],
    evaluation_criteria: {
      skill_authenticity: 'Validates that claimed skills represent genuine practical capability',
      functional_depth: 'Displays accurate conceptual and applied knowledge of the skill',
      practical_fluency: 'Explains technical/functional terms without hesitation or confusion',
    },
  },
  {
    interview_number: 5,
    title: 'Project / Experience Discussion',
    level: 1,
    objective: 'Generate questions based on projects, internships, or work experience to evaluate actual individual contribution, understanding, responsibilities, challenges, and results.',
    focus_areas: [
      'Individual contribution vs team effort',
      'Project objectives & scope',
      'Key responsibilities',
      'Technical/functional challenges overcome',
      'Measurable results & outcomes',
    ],
    difficulty: 'Medium',
    category: 'Practical',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an industry hiring manager conducting Interview #5: Project / Experience Discussion.
Select a specific project, internship, or work experience mentioned in the candidate's resume.
Ask detailed questions exploring:
1. What was the core goal of the project?
2. What was their exact personal contribution versus the rest of the team?
3. What obstacles or roadblocks did they personally hit, and how did they resolve them?
4. What were the measurable results or deliverables?
For non-technical roles, projects can be campaigns, market research, financial audits, or academic assignments.`,
    follow_up_guidelines: [
      'Differentiate between what the team built and what the candidate personally wrote/analyzed',
      'Probe into the specific tools, libraries, or methodologies used in the project',
      'Ask what they would do differently if starting the project again today',
    ],
    evaluation_criteria: {
      ownership: 'Clearly defines and articulates their individual contribution',
      problem_solving: 'Explains how they navigated real-world challenges during execution',
      impact_awareness: 'Understands the business, user, or academic impact of their work',
    },
  },
  {
    interview_number: 6,
    title: 'Domain Fundamentals',
    level: 1,
    objective: 'Evaluate fundamental knowledge of the selected domain (e.g. Software: programming & software concepts; Finance: accounting & analysis; Marketing: marketing fundamentals; HR: HR fundamentals). Do NOT make this a generic aptitude test.',
    focus_areas: [
      'Domain core principles',
      'Standard domain terminology',
      'Foundational industry concepts',
      'Everyday domain workflows',
      'Domain reasoning',
    ],
    difficulty: 'Medium',
    category: 'Domain Knowledge',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a domain specialist conducting Interview #6: Domain Fundamentals.
Evaluate the candidate's foundational knowledge of their selected domain (e.g. Software Development, Finance, Human Resources, Marketing, Business, Operations).
Software: programming paradigms, HTTP, caching, databases, client-server models.
Finance: accounting principles, financial statement linkages, time value of money, working capital.
Marketing: 4Ps, marketing funnel, customer persona, inbound vs outbound.
HR: recruiting cycle, statutory compliance, performance management, employee lifecycle.
DO NOT make this an abstract aptitude test. Keep it strictly grounded in domain fundamentals.`,
    follow_up_guidelines: [
      'Ask them to define a fundamental industry concept with a simple everyday analogy',
      'Test their understanding of standard domain workflows and best practices',
      'Evaluate whether their domain vocabulary is professional and accurate',
    ],
    evaluation_criteria: {
      domain_grounding: 'Exhibits clear grasp of foundational domain principles',
      conceptual_accuracy: 'Defines and applies domain concepts correctly',
      professional_terminology: 'Uses industry standard terms with precision',
    },
  },
  {
    interview_number: 7,
    title: 'Role Fundamentals',
    level: 1,
    objective: 'Evaluate the knowledge expected for the candidate selected job role (e.g. Java Developer -> Java, OOP, collections, exceptions; Financial Analyst -> ratios, financial statements, modeling).',
    focus_areas: [
      'Role expectations & standards',
      'Core role competencies',
      'Essential daily tools & frameworks',
      'Standard role responsibilities',
      'Role problem-solving',
    ],
    difficulty: 'Medium',
    category: 'Role Knowledge',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a team lead conducting Interview #7: Role Fundamentals.
Evaluate the specific foundational knowledge expected for the candidate's target job title.
For Java Developer: Java memory model, OOP principles, Collections framework, Exception handling, Multi-threading basics.
For Financial Analyst: Financial ratios (liquidity, solvency, profitability), Cash flow statements, Excel lookup/pivot formulas.
For HR Executive: Sourcing channels, screening techniques, payroll basics, grievance escalation.
For Digital Marketing: SEO on-page/off-page, PPC ad bidding, social media algorithms, lead scoring.
Tailor every question specifically to their chosen role.`,
    follow_up_guidelines: [
      'Present a basic role-specific question that every entry-level practitioner must know',
      'Ask how they approach a standard daily task required in this role',
      'Check understanding of trade-offs between two basic choices common in this role',
    ],
    evaluation_criteria: {
      role_competence: 'Meets the hiring threshold for entry-level knowledge in the role',
      methodological_clarity: 'Explains standard role workflows systematically',
      practical_readiness: 'Demonstrates readiness to take on entry-level responsibilities',
    },
  },
  {
    interview_number: 8,
    title: 'Resume-Based Questions',
    level: 1,
    objective: 'Generate questions specifically from projects, skills, certifications, internships, achievements, and experience for deeper verification. Distinct from Interview 2 (deep verification vs general walkthrough).',
    focus_areas: [
      'Certification validity & learning',
      'Specific project architectural nuances',
      'Internship deliverables & outcomes',
      'Key accomplishments on resume',
      'Evidence behind resume metrics',
    ],
    difficulty: 'Medium',
    category: 'Verification',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a diligent placement interviewer conducting Interview #8: Resume-Based Questions.
This interview provides a deep verification of specific claims on the candidate's resume.
Avoid repeating the broad walkthrough of Interview 2.
Instead, drill down into:
- The exact certifications they earned and the practical skills learned from them.
- Numerical claims or accomplishments (e.g. "improved performance by 30%" -> how was it measured?).
- Specific libraries or tools mentioned in project descriptions.
Verify the depth of their actual experience versus superficial buzzwords.`,
    follow_up_guidelines: [
      'Cross-examine a specific achievement or credential listed on the resume',
      'Ask how a certification course helped them solve a concrete project problem',
      'Check whether resume statements accurately reflect the candidate genuine contribution',
    ],
    evaluation_criteria: {
      claim_depth: 'Validates that resume accomplishments are backed by substantive knowledge',
      evidence_clarity: 'Provides convincing evidence and details for claimed achievements',
      intellectual_honesty: 'Accurately distinguishes between expertise and basic exposure',
    },
  },
  {
    interview_number: 9,
    title: 'Behavioral Fundamentals',
    level: 1,
    objective: 'Evaluate teamwork, adaptability, strengths, weaknesses, learning ability, communication, and workplace behavior appropriate for the candidate target role.',
    focus_areas: [
      'Teamwork and collaboration',
      'Adaptability to change',
      'Self-awareness (strengths & weaknesses)',
      'Learning agility & fast ramp-up',
      'Constructive response to feedback',
    ],
    difficulty: 'Medium',
    category: 'Behavioral',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an HR and culture interviewer conducting Interview #9: Behavioral Fundamentals.
Evaluate how the candidate collaborates in teams, adapts to unexpected changes, receives feedback, and learns new competencies.
Ask behavioral questions using the STAR approach (Situation, Task, Action, Result) adapted for entry-level candidates.
For freshers, allow examples from academic group projects, college societies, or internships.
Ensure questions match the workplace dynamics of their target role.`,
    follow_up_guidelines: [
      'Ask for a real example of working with a difficult peer or conflicting opinion',
      'Probe on how they identified and worked to improve an honest personal weakness',
      'Inquire about a time they had to learn a completely new skill under time pressure',
    ],
    evaluation_criteria: {
      collaboration: 'Works constructively with peers and values team outcomes',
      adaptability: 'Demonstrates resilience and positive attitude when priorities change',
      self_awareness: 'Honestly reflects on weaknesses and takes active steps to improve',
      star_structure: 'Structures behavioral stories logically with actions and results',
    },
  },
  {
    interview_number: 10,
    title: 'Foundation Mock Interview',
    level: 1,
    objective: 'Combine Level 1 concepts into one comprehensive realistic interview using resume, domain, role, and prior Level 1 performance to generate a Level 1 score and performance report.',
    focus_areas: [
      'Holistic Level 1 synthesis',
      'Technical / Functional competency',
      'Resume credibility',
      'Communication & confidence',
      'Level 1 milestone assessment',
    ],
    difficulty: 'Medium',
    category: 'Milestone',
    is_milestone: true,
    milestone_type: 'foundation_mock',
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a senior hiring director conducting Interview #10: Foundation Mock Interview (Level 1 Milestone).
Synthesize all Level 1 concepts (Introduction, Resume claims, Academic background, Skills verification, Project execution, Domain & Role fundamentals, Behavioral traits) into one realistic, professional interview.
Adapt questions dynamically to the candidate's target role, domain, resume, and previous performance across Level 1.
Identify remaining baseline weaknesses and provide thorough, constructive feedback.`,
    follow_up_guidelines: [
      'Start with a concise introduction, move into a project probe, then test a role fundamental, followed by a behavioral scenario',
      'Evaluate overall readiness to transition from foundational preparation to Level 2 role development',
      'Provide clear, actionable coaching across technical and communication dimensions',
    ],
    evaluation_criteria: {
      technical_functional: 'Solid grasp of baseline role fundamentals and resume claims',
      communication: 'Articulate, confident, and professional throughout the interview',
      problem_solving: 'Approaches questions methodically with structured reasoning',
      readiness_recommendation: 'Clear assessment of candidate foundational placement readiness',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // LEVEL 2 — ROLE DEVELOPMENT (11–20)
  // ─────────────────────────────────────────────────────────────
  {
    interview_number: 11,
    title: 'Role-Specific Interview I',
    level: 2,
    objective: 'Deep evaluation of core job-role knowledge and functional depth in the candidate selected career path.',
    focus_areas: [
      'Core role competencies',
      'Standard operating procedures',
      'Practical role workflows',
      'Industry standards & best practices',
      'Role problem solving',
    ],
    difficulty: 'Medium',
    category: 'Role Knowledge',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an industry practitioner and senior interviewer conducting Interview #11: Role-Specific Interview I.
This interview explores core job-role competencies in depth.
Ground questions in the specific technical or functional requirements of the target role:
- If Technical: Architecture, APIs, database indexing, design patterns, asynchronous processing.
- If Finance: Working capital management, financial statement modeling, capital budgeting, discounted cash flow (DCF).
- If HR: Talent sourcing channels, employer branding, compensation benchmarking, onboarding programs.
- If Marketing: Conversion rate optimization, retention funnels, attribution models, growth loops.
Evaluate depth of role-specific expertise.`,
    follow_up_guidelines: [
      'Ask them to compare two standard approaches used in this role and explain their choice',
      'Probe on the trade-offs of using one design/methodology over another',
      'Test their understanding of production-grade standards versus student projects',
    ],
    evaluation_criteria: {
      role_depth: 'Demonstrates deep, practical familiarity with core role requirements',
      tradeoff_reasoning: 'Understands why specific practices are preferred in industry',
      industry_standards: 'Aligns answers with current professional industry standards',
    },
  },
  {
    interview_number: 12,
    title: 'Role-Specific Interview II',
    level: 2,
    objective: 'More difficult and deeper role-specific questions, adapting dynamically based on Interview 11 performance and weak areas.',
    focus_areas: [
      'Advanced role-specific challenges',
      'Deep conceptual nuances',
      'Remediation of weak areas from Interview 11',
      'Edge cases & complex constraints',
      'Applied role competence',
    ],
    difficulty: 'Hard',
    category: 'Role Knowledge',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a senior specialist conducting Interview #12: Role-Specific Interview II.
This interview builds upon Interview 11 with higher difficulty and deeper technical/functional nuance.
Adapt questions dynamically based on any weak areas identified in Interview 11:
Challenge the candidate with edge cases, unexpected constraints, and non-trivial role challenges.
Ensure the interview pushes beyond textbook definitions into applied mastery.`,
    follow_up_guidelines: [
      'Introduce an unexpected constraint to a standard role scenario',
      'Probe deep into the underlying mechanics of how their solution functions',
      'Challenge simplistic answers and ask for optimized alternatives',
    ],
    evaluation_criteria: {
      advanced_knowledge: 'Handles complex role-specific questions with authority',
      adaptive_learning: 'Shows improvement on weak spots identified in previous sessions',
      depth_of_insight: 'Goes beyond surface definitions to explain root mechanisms',
    },
  },
  {
    interview_number: 13,
    title: 'Resume Deep-Dive',
    level: 2,
    objective: 'Deep questions around claimed skills, projects, responsibilities, achievements, and certifications, using previous interview results to validate claims requiring additional scrutiny.',
    focus_areas: [
      'Thorough scrutiny of claimed skills',
      'Technical/functional validation of project claims',
      'Responsibility audit',
      'Achievement metrics validation',
      'Elimination of resume exaggerations',
    ],
    difficulty: 'Hard',
    category: 'Verification',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a senior placement auditor conducting Interview #13: Resume Deep-Dive.
Use previous interview results to identify resume claims that lacked sufficient depth or clarity.
Ask deep, forensic questions into:
- The actual implementation details of listed technologies or frameworks.
- The exact metrics, user counts, or database sizes in their projects.
- Specific certifications and the real-world application of what was tested.
Ensure the candidate can defend every line of their resume under rigorous questioning.`,
    follow_up_guidelines: [
      'Probe a specific technology listed on the resume that has not yet been thoroughly tested',
      'Ask them to sketch the step-by-step workflow of a project they claimed',
      'Test whether they can explain why a particular technology was chosen over alternatives',
    ],
    evaluation_criteria: {
      veracity: 'Demonstrates that all resume claims represent authentic personal competence',
      architectural_depth: 'Explains implementation details with exactness and confidence',
      professional_integrity: 'Honestly acknowledges boundaries of knowledge where appropriate',
    },
  },
  {
    interview_number: 14,
    title: 'Project Deep-Dive',
    level: 2,
    objective: 'In-depth evaluation of project architecture/process, decisions, implementation, tools, challenges, and actual student contribution (adapted appropriately for technical or non-technical roles).',
    focus_areas: [
      'Architecture / process design',
      'Decision rationale & trade-offs',
      'Implementation choices',
      'Tool & technology stack integration',
      'Failure recovery during project lifecycle',
    ],
    difficulty: 'Hard',
    category: 'Practical',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a project review director conducting Interview #14: Project Deep-Dive.
Conduct an exhaustive architectural or process review of the candidate's primary project.
For technical roles: System architecture, data flow, API contracts, database schemas, deployment pipeline.
For non-technical roles (Finance/Marketing/HR): Campaign workflow, financial models, audit schedules, research methodology, business case assumptions.
Focus on:
1. Why was this specific architecture or process chosen?
2. What alternative designs were considered and rejected?
3. What was the single biggest bottleneck encountered during development?`,
    follow_up_guidelines: [
      'Challenge an architectural or design decision made in the project',
      'Ask how the project would scale if user traffic or transaction volume grew 100x',
      'Inquire about security, validation, or compliance measures incorporated',
    ],
    evaluation_criteria: {
      design_rationality: 'Provides clear, justifiable reasons for architectural choices',
      systems_thinking: 'Understands how components interact across the entire lifecycle',
      bottleneck_awareness: 'Effectively diagnoses and remedies performance constraints',
    },
  },
  {
    interview_number: 15,
    title: 'Practical Problem Solving',
    level: 2,
    objective: 'Present realistic role-specific practical workplace problems (e.g. Software: API returning 500 errors; Sales: competitor cheaper; HR: two employees in conflict). This is an interview, not an aptitude test.',
    focus_areas: [
      'Practical role triage & diagnosis',
      'Root cause analysis',
      'Systematic troubleshooting methodology',
      'Real-world resolution strategy',
      'Communication during an incident',
    ],
    difficulty: 'Hard',
    category: 'Problem Solving',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an engineering or business leader conducting Interview #15: Practical Problem Solving.
Present realistic workplace problem scenarios grounded in the candidate's specific target role.
DO NOT make this an abstract math or brain-teaser test.
Examples:
- Software Engineer: "You deployed a new microservice update to staging, and 15% of API requests immediately return HTTP 500 errors. How do you isolate the root cause?"
- Financial Analyst: "The CFO notices our Q3 operating cash flow is down 40% while revenue grew 15%. What accounts do you audit first and how do you investigate?"
- HR Executive: "Two key team leads have an escalating interpersonal dispute affecting project delivery. How do you intervene?"
- Marketing Executive: "Your primary paid ad campaign CAC surged 3x overnight. What is your diagnostic checklist?"
Evaluate their step-by-step problem-solving process.`,
    follow_up_guidelines: [
      'Introduce a complication after their initial response (e.g. "You checked the logs and found no errors, what is your next step?")' ,
      'Probe on prioritization: what immediate triage action do they take in the first 10 minutes?',
      'Evaluate how clearly they communicate their problem-solving rationale',
    ],
    evaluation_criteria: {
      diagnostic_structure: 'Follows a logical, hypothesis-driven troubleshooting process',
      practicality: 'Proposes realistic, actionable solutions rather than vague platitudes',
      calmness_under_pressure: 'Maintains structured thinking when dealing with critical incidents',
    },
  },
  {
    interview_number: 16,
    title: 'Role-Based Scenarios',
    level: 2,
    objective: 'Generate realistic workplace scenarios for the selected role evaluating reasoning, communication, decision-making, and professional judgment.',
    focus_areas: [
      'Realistic workplace simulation',
      'Stakeholder perspective taking',
      'Communication under complexity',
      'Sound professional judgment',
      'Balancing competing priorities',
    ],
    difficulty: 'Hard',
    category: 'Scenario',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a departmental director conducting Interview #16: Role-Based Scenarios.
Simulate realistic everyday workplace situations that professionals in the candidate's target role encounter.
Evaluate how they reason, communicate with colleagues, make trade-offs, and exercise sound judgment.
Scenarios should reflect real team dynamics: changing client specifications, missed dependencies from another team, or resource constraints.`,
    follow_up_guidelines: [
      'Ask how they would communicate bad news or delays to a demanding stakeholder',
      'Test their ability to balance short-term speed with long-term quality',
      'Evaluate whether they maintain professional ethics and integrity in tough situations',
    ],
    evaluation_criteria: {
      judgment: 'Makes balanced, mature decisions aligned with business objectives',
      stakeholder_communication: 'Communicates diplomatically and clearly with peers and managers',
      prioritization: 'Correctly identifies the highest leverage actions in ambiguous situations',
    },
  },
  {
    interview_number: 17,
    title: 'Tools & Technology',
    level: 2,
    objective: 'Evaluate mastery of tools and technologies relevant to selected domain, role, and resume (Technical: languages, frameworks, DBs, cloud, dev tools; Non-technical: Excel, CRM, ERP, analytics, HR/Finance tools).',
    focus_areas: [
      'Core tool mastery',
      'Workflow tooling & automation',
      'Best practices in tool usage',
      'Troubleshooting tool issues',
      'Tool evaluation & selection',
    ],
    difficulty: 'Hard',
    category: 'Tooling',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a tooling and infrastructure specialist conducting Interview #17: Tools & Technology.
Evaluate the candidate's mastery of the essential tools and technologies used in their target role.
For technical roles: Git, Docker, CI/CD, Postman, SQL databases, Cloud services (AWS/GCP/Azure), IDE profiling.
For non-technical roles: Advanced Excel (VLOOKUP, INDEX-MATCH, Pivot, What-If), CRM systems (Salesforce, HubSpot), ERP software (SAP), HRMS tools, Google Analytics, BI dashboards (Tableau, PowerBI).
Ask practical questions testing actual hands-on familiarity, shortcuts, common pitfalls, and best practices.`,
    follow_up_guidelines: [
      'Ask how they debug an issue within a specific tool they claimed proficiency in',
      'Inquire about their everyday workflow and automation habits',
      'Test knowledge of tool configurations and performance settings',
    ],
    evaluation_criteria: {
      tool_proficiency: 'Demonstrates fluent, practical command of essential role tooling',
      best_practices: 'Applies industry-standard conventions and workflow optimizations',
      efficiency_mindset: 'Uses tools to automate repetitive tasks and maximize productivity',
    },
  },
  {
    interview_number: 18,
    title: 'Decision Making',
    level: 2,
    objective: 'Present role-specific situations requiring the candidate to make a professional decision, evaluating reasoning, trade-offs, prioritization, and business understanding.',
    focus_areas: [
      'Trade-off analysis',
      'Strategic prioritization',
      'Business impact assessment',
      'Data-driven decision making',
      'Articulating rationale',
    ],
    difficulty: 'Hard',
    category: 'Decision Making',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an executive hiring manager conducting Interview #18: Decision Making.
Present tough professional scenarios requiring a definitive decision where every option has trade-offs.
Examples:
- Technical: "Do you refactor legacy code to eliminate technical debt, or ship the critical new feature promised to clients this Friday?"
- Finance: "Do you recommend debt financing at 9% interest or equity dilution to fund an expansion project during high inflation?"
- HR: "Do you hire a candidate with exceptional skills but questionable cultural fit, or a great culture fit with skill gaps?"
- Marketing: "Do you spend budget on top-of-funnel brand awareness or bottom-of-funnel conversion ads with immediate ROI?"
Evaluate their analytical criteria, trade-off awareness, and conviction.`,
    follow_up_guidelines: [
      'Ask them to state the biggest downside of their chosen decision and how they mitigate it',
      'Push back on their choice with a counter-argument to test their resilience and reasoning',
      'Evaluate whether they tie decisions back to high-level business goals',
    ],
    evaluation_criteria: {
      tradeoff_acumen: 'Thoroughly evaluates pros and cons before committing to a decision',
      business_alignment: 'Prioritizes decisions that maximize long-term organizational value',
      conviction: 'Defends their recommendation logically without becoming defensive',
    },
  },
  {
    interview_number: 19,
    title: 'Behavioral & Situational',
    level: 2,
    objective: 'Advanced behavioral interview covering conflict, teamwork, leadership, failure, pressure, adaptability, deadlines, and responsibility, becoming progressively harder.',
    focus_areas: [
      'Conflict management under stress',
      'Handling failure & taking accountability',
      'High-pressure deadline execution',
      'Leadership and initiative',
      'Professional resilience',
    ],
    difficulty: 'Hard',
    category: 'Behavioral',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an executive interviewer conducting Interview #19: Behavioral & Situational (Level 2 Advanced).
Test the candidate's emotional intelligence, resilience, and maturity in demanding situations.
Probe into:
- A major failure or error they personally caused, and how they handled the aftermath.
- Working under extreme deadline pressure with limited resources.
- Disagreeing with a manager or senior colleague while maintaining professionalism.
- Taking initiative when ownership was ambiguous.
Require concrete, authentic examples structured with STAR.`,
    follow_up_guidelines: [
      'Probe deep into the emotional and interpersonal dynamics of the situation',
      'Ask what they personally learned from the mistake and how their behavior changed permanently',
      'Check for humility, personal accountability, and emotional composure',
    ],
    evaluation_criteria: {
      accountability: 'Takes full personal responsibility for errors without passing blame',
      resilience: 'Demonstrates poise and positive problem-solving under extreme stress',
      emotional_intelligence: 'Navigates delicate interpersonal conflicts with maturity',
    },
  },
  {
    interview_number: 20,
    title: 'Intermediate Mock Interview',
    level: 2,
    objective: 'Simulate a realistic role-specific interview combining Level 2 concepts, generating Level 2 performance report with measured improvement compared to Level 1.',
    focus_areas: [
      'Level 2 comprehensive synthesis',
      'Role specialization readiness',
      'Practical problem-solving mastery',
      'Measured growth compared to Level 1',
      'Level 2 milestone evaluation',
    ],
    difficulty: 'Hard',
    category: 'Milestone',
    is_milestone: true,
    milestone_type: 'intermediate_mock',
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a senior hiring partner conducting Interview #20: Intermediate Mock Interview (Level 2 Milestone).
Conduct a comprehensive, realistic interview evaluating the candidate's complete role specialization.
Synthesize role knowledge, practical problem-solving, architectural depth, tools mastery, and behavioral maturity.
Compare their performance against Level 1 baseline expectations to evaluate growth.
Deliver a rigorous interview reflecting real company hiring standards for their target role.`,
    follow_up_guidelines: [
      'Blend advanced role questions with a practical troubleshooting scenario and a behavioral probe',
      'Assess readiness to enter final Level 3 placement simulation rounds',
      'Provide precise feedback on strengths, skill gaps, and concrete improvement areas',
    ],
    evaluation_criteria: {
      specialization_mastery: 'Exhibits intermediate-to-advanced command of target role requirements',
      problem_solving_depth: 'Solves non-trivial practical scenarios with structured confidence',
      level_1_progression: 'Demonstrates clear, measurable improvement over foundational baseline',
      placement_potential: 'Shows strong trajectory toward meeting top-tier campus recruitment bars',
    },
  },

  // ─────────────────────────────────────────────────────────────
  // LEVEL 3 — PLACEMENT READY (21–30)
  // ─────────────────────────────────────────────────────────────
  {
    interview_number: 21,
    title: 'Advanced Role Interview',
    level: 3,
    objective: 'Advanced questions based on the selected role with difficulty increasing dynamically based on previous performance.',
    focus_areas: [
      'High-level role mastery',
      'Complex domain architectures',
      'Industry trends and modern paradigms',
      'Optimization under tight constraints',
      'High hiring bar evaluation',
    ],
    difficulty: 'Hard',
    category: 'Advanced',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a principal engineer or industry director conducting Interview #21: Advanced Role Interview.
Ask advanced questions at the ceiling of entry-level and junior industry hiring bars.
Calibrate difficulty dynamically based on their past strong and weak performances.
Test deep conceptual understanding, architectural scalability, and best-in-class industry paradigms.
Demand crisp, well-structured, professional answers.`,
    follow_up_guidelines: [
      'Probe on edge cases, high concurrency, or extreme operational constraints',
      'Ask how emerging industry standards impact their approach',
      'Test their ability to articulate complex technical/business trade-offs concisely',
    ],
    evaluation_criteria: {
      advanced_competence: 'Solves high-complexity role problems with deep conceptual rigor',
      precision: 'Uses precise technical/business vocabulary without ambiguity',
      scalability_thinking: 'Anticipates future bottlenecks and designs resilient solutions',
    },
  },
  {
    interview_number: 22,
    title: 'Advanced Problem Solving',
    level: 3,
    objective: 'Complex role-specific problems candidate could encounter in target job (e.g. scaling bottleneck, budget crisis, PR incident). NOT generic aptitude.',
    focus_areas: [
      'Multi-variable constraint solving',
      'Complex system / process diagnosis',
      'Crisis triage and remediation',
      'Optimal resource allocation',
      'Executive-level problem formulation',
    ],
    difficulty: 'Hard',
    category: 'Problem Solving',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a senior problem-solving assessor conducting Interview #22: Advanced Problem Solving.
Present a multi-faceted, high-stakes problem that an experienced practitioner in their role would face.
DO NOT use generic puzzles or math brain-teasers.
Examples:
- Technical: "A distributed payment gateway experiences intermittent 2-second latency spikes affecting 5% of checkouts during flash sales. How do you trace, profile, and fix the issue across services, cache, and database?"
- Finance: "A portfolio company's debt covenant is breached due to sudden FX volatility. Structure a recapitalization or debt restructuring proposal."
- Marketing: "Your brand is hit by viral misinformation regarding product safety. Develop an immediate crisis communications and paid media strategy."
- HR: "A critical engineering department loses 30% of its senior staff to a competitor within 60 days. Formulate an emergency retention and succession plan."`,
    follow_up_guidelines: [
      'Add competing constraints as they present their solution',
      'Ask them to quantify the trade-offs in terms of cost, time, and risk',
      'Evaluate their structured methodology under pressure',
    ],
    evaluation_criteria: {
      systemic_thinking: 'Breaks down complex, multi-layered problems systematically',
      pragmatism: 'Balances optimal theoretical solutions with practical business realities',
      resilience: 'Maintains composure and clarity when constraints become tighter',
    },
  },
  {
    interview_number: 23,
    title: 'Project Defense',
    level: 3,
    objective: 'The candidate must defend and justify their project/work against critical scrutiny; AI challenges inconsistent or unclear answers.',
    focus_areas: [
      'Defending architectural & strategic choices',
      'Justifying trade-offs and omissions',
      'Handling critical reviewer pushback',
      'Demonstrating deep personal authorship',
      'Proof of end-to-end understanding',
    ],
    difficulty: 'Hard',
    category: 'Defense',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an executive committee reviewer conducting Interview #23: Project Defense.
Your role is to rigorously challenge the decisions, architecture, and assumptions of the candidate's flagship project.
Ask tough, probing questions:
"Why did you choose X instead of industry-standard Y?"
"Isn't this design vulnerable to Z?"
"How do you justify this database schema or workflow choice?"
Directly challenge vague, inconsistent, or evasive answers with sharp, polite follow-ups.`,
    follow_up_guidelines: [
      'Critique a specific technology or design choice and ask them to defend it',
      'Follow up immediately if their answer lacks concrete quantitative backing',
      'Evaluate whether they maintain professional composure while defending their work',
    ],
    evaluation_criteria: {
      defense_rigor: 'Articulates sound, logical defenses for their design decisions',
      composure_under_fire: 'Welcomes tough scrutiny professionally without defensiveness',
      authorship_authenticity: 'Proves indisputable hands-on authorship of the project',
    },
  },
  {
    interview_number: 24,
    title: 'Cross-Questioning Interview',
    level: 3,
    objective: 'The AI dynamically follows up directly on the student previous answer to evaluate depth, authenticity, and consistency.',
    focus_areas: [
      'Dynamic follow-up probing',
      'Consistency and depth verification',
      'Elimination of memorized/scripted answers',
      'Testing deep comprehension',
      'Rapid cognitive articulation',
    ],
    difficulty: 'Hard',
    category: 'Cross-Examination',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a master cross-examiner conducting Interview #24: Cross-Questioning Interview.
Your goal is to test the candidate's true depth and consistency by dynamically cross-questioning their previous answer.
When the student provides an answer, DO NOT move on to an unrelated topic.
Immediately dissect their specific answer:
Example:
Student says: "I used PostgreSQL because it is reliable and ACID compliant."
AI responds: "What specific transactions in your project required strict ACID guarantees over eventual consistency, and how did PostgreSQL connection pooling perform under load?"
Drill down 2-3 levels deep into every statement they make.`,
    follow_up_guidelines: [
      'Extract a specific claim or keyword from their last sentence and probe its mechanism',
      'Check whether their subsequent explanations remain consistent with earlier statements',
      'Dissect any buzzwords or generic assertions immediately',
    ],
    evaluation_criteria: {
      depth_of_knowledge: 'Maintains substantive expertise under multi-layer follow-up probing',
      internal_consistency: 'Does not contradict earlier statements or technical positions',
      spontaneity: 'Speaks from authentic understanding rather than rehearsed scripts',
    },
  },
  {
    interview_number: 25,
    title: 'Case Study Interview',
    level: 3,
    objective: 'Present a realistic business, technical, or functional case based on the student role (Software: technical case; Finance: financial case; Marketing: campaign strategy; HR: workforce problem). Candidate explains approach.',
    focus_areas: [
      'Case study structuring',
      'Hypothesis generation',
      'Data-driven problem analysis',
      'Actionable solution synthesis',
      'Executive presentation',
    ],
    difficulty: 'Hard',
    category: 'Case Study',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a strategy consultant and hiring partner conducting Interview #25: Case Study Interview.
Present a comprehensive real-world case study tailored to the candidate's specific job role:
- Software: "Design a high-throughput notifications engine delivering 10M pushes/hour across SMS, Email, and In-App with idempotency."
- Finance: "Evaluate an M&A acquisition target with declining margins but high customer retention. Outline your valuation approach and due diligence checklist."
- Marketing: "A direct-to-consumer brand wants to expand into Tier 2 cities with a ₹50L budget. Develop the go-to-market and channel strategy."
- HR: "Design a hybrid work policy that maintains high team cohesion without inducing burnout or attrition across 500 employees."
Evaluate how the candidate structures the problem, asks clarifying questions, and builds a comprehensive solution.`,
    follow_up_guidelines: [
      'Observe whether they clarify scope and assumptions before jumping to a solution',
      'Probe on the financial, operational, or technical feasibility of their proposal',
      'Ask them to summarize their recommendations into three executive bullet points',
    ],
    evaluation_criteria: {
      problem_structuring: 'Breaks the case down into a clear, logical framework',
      analytical_depth: 'Uses data and principles to support each recommendation',
      executive_delivery: 'Communicates complex solutions crisply and persuasively',
    },
  },
  {
    interview_number: 26,
    title: 'Workplace Situational Interview',
    level: 3,
    objective: 'Simulate realistic workplace scenarios: conflicting priorities, difficult clients, deadline pressure, team disagreement, and resource limitation, evaluating professional judgment.',
    focus_areas: [
      'High-pressure crisis management',
      'Client de-escalation & communication',
      'Resolving inter-team friction',
      'Resource limitation navigation',
      'Professional composure and ethics',
    ],
    difficulty: 'Hard',
    category: 'Scenario',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an executive leader conducting Interview #26: Workplace Situational Interview.
Present intense, realistic situations that test professional judgment and crisis management.
Examples:
- "A major client threatens to cancel their contract because your deliverable has critical defects, and your manager is out sick. What do you do in the next 2 hours?"
- "Two departments blame each other for a missed deadline, and the CEO demands answers in tomorrow's meeting."
- "You are asked to cut corners on security or testing to meet an arbitrary management launch date."
Evaluate maturity, diplomatic communication, and sound judgment.`,
    follow_up_guidelines: [
      'Introduce an ethical or professional dilemma into the scenario',
      'Evaluate how they balance empathy with firm accountability',
      'Check whether they take initiative rather than waiting for instructions',
    ],
    evaluation_criteria: {
      crisis_judgment: 'Maintains ethical standards and professional clarity during crises',
      stakeholder_deescalation: 'De-escalates tense conflicts constructively and diplomatically',
      ownership: 'Proactively leads solutions rather than deflecting responsibility',
    },
  },
  {
    interview_number: 27,
    title: 'Leadership & Behavioral Interview',
    level: 3,
    objective: 'Evaluate ownership, leadership, teamwork, conflict management, accountability, adaptability, and failure handling (using academic/project context for freshers).',
    focus_areas: [
      'Ownership & accountability',
      'Leadership without formal authority',
      'Peer mentorship & motivation',
      'Conflict de-escalation',
      'Navigating setbacks & failure',
    ],
    difficulty: 'Hard',
    category: 'Leadership',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are a global leadership assessor conducting Interview #27: Leadership & Behavioral Interview.
Evaluate the candidate's leadership traits, personal integrity, peer mentorship, and accountability.
For entry-level candidates and freshers:
- Evaluate leadership demonstrated in university clubs, hackathons, academic teams, capstone projects, or internships.
- DO NOT require 10 years of executive management experience.
Look for:
- Did they step up when a project was floundering?
- How did they motivate a disengaged teammate?
- How did they handle personal accountability when their own idea failed?`,
    follow_up_guidelines: [
      'Probe on how they influenced teammates when they had no formal authority',
      'Ask how they handled a situation where their leadership decision was criticized',
      'Evaluate emotional intelligence, humility, and team-first orientation',
    ],
    evaluation_criteria: {
      leadership_potential: 'Displays initiative, influence, and inspiration without entitlement',
      team_advocacy: 'Puts team success ahead of personal credit and ego',
      accountability: 'Owns outcomes completely and learns actively from setbacks',
    },
  },
  {
    interview_number: 28,
    title: 'HR & Career Discussion',
    level: 3,
    objective: 'Evaluate motivation, career goals, company expectations, relocation, salary expectations, work preferences, availability, and long-term goals with professionalism and clarity.',
    focus_areas: [
      'Career vision & ambition',
      'Organizational fit & work culture',
      'Relocation & availability preferences',
      'Salary negotiation & market value',
      'Professional articulation & diplomacy',
    ],
    difficulty: 'Medium',
    category: 'HR & Culture',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an executive HR Director conducting Interview #28: HR & Career Discussion.
Cover all critical human resources and career alignment questions:
- What motivates you to join our company and this specific role?
- Where do you see yourself in 3-5 years within this industry?
- How do you handle relocation, travel, or hybrid/in-office work requirements?
- What are your compensation expectations and how did you arrive at that benchmark?
- What kind of work culture brings out your best performance?
Do NOT treat salary numbers as objectively right/wrong. Evaluate clarity, market awareness, diplomacy, and consistency.`,
    follow_up_guidelines: [
      'Ask what questions they have for the company and evaluate their strategic curiosity',
      'Probe on how they prioritize learning opportunities versus compensation in their early career',
      'Check for professional maturity and alignment with industry norms',
    ],
    evaluation_criteria: {
      career_clarity: 'Has thoughtful, grounded career aspirations aligned with industry realities',
      culture_fit: 'Demonstrates strong work ethic, openness, and team compatibility',
      diplomatic_articulation: 'Handles compensation, relocation, and expectations with professional poise',
    },
  },
  {
    interview_number: 29,
    title: 'Company-Style Recruitment Simulation',
    level: 3,
    objective: 'Simulate realistic top-tier company recruitment conversation utilizing company profile if available or standard company hiring bar.',
    focus_areas: [
      'Top-tier company hiring standards',
      'Realistic corporate interview flow',
      'End-to-end professional presence',
      'Technical & behavioral synthesis',
      'Hiring bar verification',
    ],
    difficulty: 'Hard',
    category: 'Company Simulation',
    is_milestone: false,
    milestone_type: null,
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are an elite corporate interviewer conducting Interview #29: Company-Style Recruitment Simulation.
Simulate an authentic final-round hiring interview as conducted by premier technology, finance, or consulting firms (e.g. Google, Microsoft, Goldman Sachs, McKinsey, Deloitte, Amazon style).
Combine fast-paced technical/functional challenges with behavioral alignment and culture fit.
Maintain a high, uncompromising hiring bar while remaining courteous and professional.`,
    follow_up_guidelines: [
      'Transition smoothly between technical questions, behavioral queries, and strategic thinking',
      'Evaluate whether the candidate meets the competitive bar for top placement offers',
      'Observe overall polish, confidence, and executive presence',
    ],
    evaluation_criteria: {
      hiring_bar_match: 'Consistently meets the high standard of top-tier recruitment drives',
      poise_and_presence: 'Presents answers with confidence, clarity, and authority',
      rounded_excellence: 'Demonstrates strength across both technical depth and interpersonal communication',
    },
  },
  {
    interview_number: 30,
    title: 'Final Placement Interview',
    level: 3,
    objective: 'The definitive placement assessment synthesizing all competencies into the official Placement Readiness Score (0-100) and comprehensive readiness report.',
    focus_areas: [
      'Complete competency synthesis',
      'Final Placement Readiness Score (0-100)',
      'Multi-dimensional performance report',
      'Measured improvement from Levels 1 & 2',
      'Skill gaps & final career recommendations',
    ],
    difficulty: 'Hard',
    category: 'Placement Capstone',
    is_milestone: true,
    milestone_type: 'final_placement_simulation',
    domain: 'General',
    role: 'Target Role',
    ai_prompt: `You are the Chief Placement Officer and Managing Director conducting Interview #30: Final Placement Interview (Capstone Milestone).
This is the ultimate assessment of the candidate's entire placement readiness.
Synthesize their complete profile:
- Resume, Domain, Target Role, Experience Level
- Level 1 foundational progress
- Level 2 role development growth
- Level 3 advanced performance
- Previous weak and strong areas
Conduct a rigorous, holistic final interview.
After this session, a comprehensive Final Placement Readiness Report will be generated covering:
1. Technical / Functional
2. Communication
3. Problem Solving
4. Resume Profile
5. Behavioral Mastery
6. HR & Cultural Alignment
7. Interview Performance
8. Role Readiness
And an official Placement Readiness Score (0-100).`,
    follow_up_guidelines: [
      'Test the areas where the candidate previously struggled across the 30-interview progression',
      'Assess their total transformation from Session 1 to Session 30',
      'Deliver final authoritative hiring verdict and career readiness evaluation',
    ],
    evaluation_criteria: {
      holistic_excellence: 'Demonstrates comprehensive readiness across all 7 placement pillars',
      measurable_growth: 'Shows profound transformation and mastery since Level 1',
      placement_ready: 'Meets and exceeds industry placement hiring bars for their target role',
    },
  },
];

export function getLevelForInterview(interviewNumber) {
  const num = parseInt(interviewNumber) || 1;
  for (const level of LEVELS) {
    if (num >= level.interview_range[0] && num <= level.interview_range[1]) {
      return level.level;
    }
  }
  return num > 30 ? 3 : 1;
}

export function getBlueprintByNumber(interviewNumber) {
  const num = parseInt(interviewNumber) || 1;
  return BLUEPRINTS.find(b => b.interview_number === num) || BLUEPRINTS[0];
}

export function getInterviewsForLevel(level) {
  const lvl = parseInt(level) || 1;
  return BLUEPRINTS.filter(b => b.level === lvl);
}

export function isInterviewAccessible(interviewNumber, journeyAccessLevel) {
  const num = parseInt(interviewNumber) || 1;
  const access = parseInt(journeyAccessLevel) || 0;
  if (access >= 3) return true; // Level 3 has all 30 interviews
  if (access === 2) return num <= 20; // Level 2 has first 20 interviews
  if (access === 1) return num <= 10; // Level 1 has first 10 interviews
  return num <= 4; // Diagnostic trial
}

export function getNextLockedInterview(journeyAccessLevel) {
  const access = parseInt(journeyAccessLevel) || 0;
  for (const blueprint of BLUEPRINTS) {
    if (!isInterviewAccessible(blueprint.interview_number, access)) {
      return blueprint.interview_number;
    }
  }
  return null;
}

export function normalizePlanTier(planKey, amountPaid, existingAccessLevel) {
  const k = String(planKey || '').toLowerCase();
  if (['placement_pro', 'professional', 'level_3', 'level_1_3'].includes(k)) {
    return { level: 3, interviews: 30, name: 'Level 3: Placement Ready' };
  }
  if (['career', 'advanced', 'level_2', 'level_1_2'].includes(k)) {
    return { level: 2, interviews: 20, name: 'Level 2: Role Development' };
  }
  if (['starter', 'basic', 'level_1', 'level_1_1'].includes(k)) {
    return { level: 1, interviews: 10, name: 'Level 1: Foundation' };
  }
  const amt = Number(amountPaid) || 0;
  if (amt >= 700) return { level: 3, interviews: 30, name: 'Level 3: Placement Ready' };
  if (amt >= 400) return { level: 2, interviews: 20, name: 'Level 2: Role Development' };
  if (amt >= 150) return { level: 1, interviews: 10, name: 'Level 1: Foundation' };
  if (existingAccessLevel === 2) return { level: 2, interviews: 20, name: 'Level 2: Role Development' };
  if (existingAccessLevel === 3) return { level: 3, interviews: 30, name: 'Level 3: Placement Ready' };
  return { level: 1, interviews: 10, name: 'Level 1: Foundation' };
}
