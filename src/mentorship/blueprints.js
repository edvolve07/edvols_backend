/**
 * EDVOLS 30-Interview Progression Framework
 * 
 * 3 Core Levels of 10 Interviews each:
 *   Level 1: Foundation (1–10) -> Understand baseline and fundamentals
 *   Level 2: Skill Development (11–20) -> Improve job readiness
 *   Level 3: Placement Ready (21–30) -> Simulate real recruitment & generate Readiness Score
 */

export const LEVELS = [
  {
    level: 1,
    name: 'Foundation',
    interview_range: [1, 10],
    unlock_after_interviews: 0,
    features: [
      'Self-Assessment & Career Goals',
      'Basic Communication & Clarity',
      'Aptitude Fundamentals',
      'Logical Reasoning',
      'Basic Technical & CS Concepts',
      'Resume Claim Verification',
      'Domain Fundamentals',
      'Problem-Solving Basics',
      'HR Fundamentals',
      'Level 1 Mock Evaluation',
    ],
    color: 'bg-slate-500',
  },
  {
    level: 2,
    name: 'Skill Development',
    interview_range: [11, 20],
    unlock_after_interviews: 10,
    features: [
      'Technical Round 1',
      'Technical Round 2',
      'Programming / Hands-on Logic',
      'Domain Specialization',
      'Resume Deep-Dive',
      'Project Architecture',
      'Situational Decisions',
      'STAR Behavioral Communication',
      'HR & Work Culture Fit',
      'Level 2 Mock Evaluation',
    ],
    color: 'bg-blue-600',
  },
  {
    level: 3,
    name: 'Placement Ready',
    interview_range: [21, 30],
    unlock_after_interviews: 20,
    features: [
      'Advanced Technical Reasoning',
      'Algorithmic Problem Solving',
      'Project Architecture Defense',
      'Target Role Simulation',
      'Behavioral & Leadership',
      'Crisis Scenarios & Tradeoffs',
      'Stress & Pressure Test',
      'HR & Salary Negotiation',
      'Company-Style Mock Round',
      'Final Placement Simulation',
    ],
    color: 'bg-emerald-600',
  },
];

export const BLUEPRINTS = [
  {
      "interview_number": 1,
      "title": "Introduction & Self-Assessment",
      "level": 1,
      "objective": "Understand candidate baseline confidence, career narrative, and clarity of intent.",
      "focus_areas": [
        "Self introduction",
        "Career goals",
        "Basic confidence",
        "Communication clarity"
      ],
      "difficulty": "Easy",
      "category": "Foundation",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #1: Introduction & Self-Assessment (Understand candidate baseline confidence, career narrative, and clarity of intent.).\n\nInterview Guidelines:\n1. Focus specifically on: Self introduction, Career goals, Basic confidence, Communication clarity.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Self introduction and Career goals",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Self introduction and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 2,
      "title": "Basic Communication",
      "level": 1,
      "objective": "Evaluate spoken English fluency, grammatical structure, and articulation.",
      "focus_areas": [
        "Fluency",
        "Clarity",
        "Sentence construction",
        "Conversational ability"
      ],
      "difficulty": "Easy",
      "category": "Communication",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #2: Basic Communication (Evaluate spoken English fluency, grammatical structure, and articulation.).\n\nInterview Guidelines:\n1. Focus specifically on: Fluency, Clarity, Sentence construction, Conversational ability.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Fluency and Clarity",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Fluency and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 3,
      "title": "Aptitude Fundamentals",
      "level": 1,
      "objective": "Test quantitative reasoning, mental math, and time management basics.",
      "focus_areas": [
        "Quantitative aptitude",
        "Numerical reasoning",
        "Mental calculation",
        "Time management"
      ],
      "difficulty": "Easy",
      "category": "Aptitude",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #3: Aptitude Fundamentals (Test quantitative reasoning, mental math, and time management basics.).\n\nInterview Guidelines:\n1. Focus specifically on: Quantitative aptitude, Numerical reasoning, Mental calculation, Time management.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Quantitative aptitude and Numerical reasoning",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Quantitative aptitude and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 4,
      "title": "Logical Reasoning",
      "level": 1,
      "objective": "Assess analytical deductions, pattern recognition, and logical problem decomposition.",
      "focus_areas": [
        "Logical deduction",
        "Pattern recognition",
        "Reasoning clarity",
        "Hypothesis testing"
      ],
      "difficulty": "Easy",
      "category": "Aptitude",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #4: Logical Reasoning (Assess analytical deductions, pattern recognition, and logical problem decomposition.).\n\nInterview Guidelines:\n1. Focus specifically on: Logical deduction, Pattern recognition, Reasoning clarity, Hypothesis testing.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Logical deduction and Pattern recognition",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Logical deduction and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 5,
      "title": "Basic Technical Knowledge",
      "level": 1,
      "objective": "Verify core computer science and software concepts (OOP, variables, data types, memory).",
      "focus_areas": [
        "CS fundamentals",
        "OOP principles",
        "Data types",
        "Basic algorithms",
        "Syntax mastery"
      ],
      "difficulty": "Easy",
      "category": "Technical",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #5: Basic Technical Knowledge (Verify core computer science and software concepts (OOP, variables, data types, memory).).\n\nInterview Guidelines:\n1. Focus specifically on: CS fundamentals, OOP principles, Data types, Basic algorithms, Syntax mastery.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into CS fundamentals and OOP principles",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of CS fundamentals and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 6,
      "title": "Resume-Based Questions",
      "level": 1,
      "objective": "Validate claimed skills, academic projects, and certifications on the resume.",
      "focus_areas": [
        "Resume claims",
        "Academic projects",
        "Skill validation",
        "Education journey"
      ],
      "difficulty": "Easy",
      "category": "Resume",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #6: Resume-Based Questions (Validate claimed skills, academic projects, and certifications on the resume.).\n\nInterview Guidelines:\n1. Focus specifically on: Resume claims, Academic projects, Skill validation, Education journey.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Resume claims and Academic projects",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Resume claims and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 7,
      "title": "Domain Fundamentals",
      "level": 1,
      "objective": "Probe foundational concepts in the candidate chosen tech domain (Java, Python, Web, Data, etc.).",
      "focus_areas": [
        "Domain basics",
        "Language ecosystem",
        "Runtime environment",
        "Standard libraries"
      ],
      "difficulty": "Easy",
      "category": "Technical",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #7: Domain Fundamentals (Probe foundational concepts in the candidate chosen tech domain (Java, Python, Web, Data, etc.).).\n\nInterview Guidelines:\n1. Focus specifically on: Domain basics, Language ecosystem, Runtime environment, Standard libraries.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Domain basics and Language ecosystem",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Domain basics and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 8,
      "title": "Problem-Solving Basics",
      "level": 1,
      "objective": "Assess approach to novel problems, breakdown of complexity, and structured communication.",
      "focus_areas": [
        "Problem decomposition",
        "Approach explanation",
        "Edge case intuition",
        "Logic structuring"
      ],
      "difficulty": "Easy",
      "category": "Problem Solving",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #8: Problem-Solving Basics (Assess approach to novel problems, breakdown of complexity, and structured communication.).\n\nInterview Guidelines:\n1. Focus specifically on: Problem decomposition, Approach explanation, Edge case intuition, Logic structuring.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Problem decomposition and Approach explanation",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Problem decomposition and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 9,
      "title": "HR Fundamentals",
      "level": 1,
      "objective": "Evaluate professional motivation, self-awareness, teamwork ethic, and growth mindset.",
      "focus_areas": [
        "Strengths & weaknesses",
        "Teamwork",
        "Career expectations",
        "Workplace attitude"
      ],
      "difficulty": "Easy",
      "category": "HR",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #9: HR Fundamentals (Evaluate professional motivation, self-awareness, teamwork ethic, and growth mindset.).\n\nInterview Guidelines:\n1. Focus specifically on: Strengths & weaknesses, Teamwork, Career expectations, Workplace attitude.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Strengths & weaknesses and Teamwork",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Strengths & weaknesses and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 10,
      "title": "Foundation Mock Interview",
      "level": 1,
      "objective": "Comprehensive milestone mock interview evaluating overall Level 1 readiness.",
      "focus_areas": [
        "Level 1 synthesis",
        "Communication & technical basics",
        "Resume clarity",
        "Mock composure"
      ],
      "difficulty": "Easy",
      "category": "Mock Evaluation",
      "is_milestone": true,
      "milestone_type": "foundation_mock",
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #10: Foundation Mock Interview (Comprehensive milestone mock interview evaluating overall Level 1 readiness.). This is a CRITICAL MILESTONE EVALUATION (FOUNDATION_MOCK). Thoroughly test competencies and assess candidate placement readiness.\n\nInterview Guidelines:\n1. Focus specifically on: Level 1 synthesis, Communication & technical basics, Resume clarity, Mock composure.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Level 1 synthesis and Communication & technical basics",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Level 1 synthesis and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 11,
      "title": "Technical Round 1",
      "level": 2,
      "objective": "Examine core data structures (Arrays, Strings, Stacks, Queues, HashMaps, Trees) and operations.",
      "focus_areas": [
        "Data structures",
        "Time & space complexity",
        "CRUD operations",
        "Search & sort"
      ],
      "difficulty": "Medium",
      "category": "Technical",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #11: Technical Round 1 (Examine core data structures (Arrays, Strings, Stacks, Queues, HashMaps, Trees) and operations.).\n\nInterview Guidelines:\n1. Focus specifically on: Data structures, Time & space complexity, CRUD operations, Search & sort.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Data structures and Time & space complexity",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Data structures and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 12,
      "title": "Technical Round 2",
      "level": 2,
      "objective": "Evaluate system fundamentals, relational and NoSQL databases, RESTful APIs, and protocols.",
      "focus_areas": [
        "Databases & indexing",
        "REST API design",
        "HTTP protocols",
        "Basic system design"
      ],
      "difficulty": "Medium",
      "category": "Technical",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #12: Technical Round 2 (Evaluate system fundamentals, relational and NoSQL databases, RESTful APIs, and protocols.).\n\nInterview Guidelines:\n1. Focus specifically on: Databases & indexing, REST API design, HTTP protocols, Basic system design.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Databases & indexing and REST API design",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Databases & indexing and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 13,
      "title": "Programming / Problem Solving",
      "level": 2,
      "objective": "Challenge candidate with algorithmic implementation and code optimization tasks.",
      "focus_areas": [
        "Algorithmic coding",
        "Edge cases handling",
        "Optimization techniques",
        "Dry-running code"
      ],
      "difficulty": "Medium",
      "category": "Problem Solving",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #13: Programming / Problem Solving (Challenge candidate with algorithmic implementation and code optimization tasks.).\n\nInterview Guidelines:\n1. Focus specifically on: Algorithmic coding, Edge cases handling, Optimization techniques, Dry-running code.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Algorithmic coding and Edge cases handling",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Algorithmic coding and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 14,
      "title": "Domain-Specific Interview",
      "level": 2,
      "objective": "Deep dive into candidate specific domain frameworks, design patterns, and asynchronous paradigms.",
      "focus_areas": [
        "Framework internals",
        "State management",
        "Concurrency & async",
        "Design patterns"
      ],
      "difficulty": "Medium",
      "category": "Technical",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #14: Domain-Specific Interview (Deep dive into candidate specific domain frameworks, design patterns, and asynchronous paradigms.).\n\nInterview Guidelines:\n1. Focus specifically on: Framework internals, State management, Concurrency & async, Design patterns.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Framework internals and State management",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Framework internals and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 15,
      "title": "Resume Deep-Dive",
      "level": 2,
      "objective": "Critically examine depth of hands-on experience, architecture choices, and role contributions.",
      "focus_areas": [
        "Project ownership",
        "Architecture decisions",
        "Tech stack tradeoffs",
        "Contribution depth"
      ],
      "difficulty": "Medium",
      "category": "Resume",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #15: Resume Deep-Dive (Critically examine depth of hands-on experience, architecture choices, and role contributions.).\n\nInterview Guidelines:\n1. Focus specifically on: Project ownership, Architecture decisions, Tech stack tradeoffs, Contribution depth.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Project ownership and Architecture decisions",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Project ownership and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 16,
      "title": "Project-Based Interview",
      "level": 2,
      "objective": "Examine end-to-end lifecycle of a featured project: architecture, deployment, bugs, and tradeoffs.",
      "focus_areas": [
        "System lifecycle",
        "Database schema design",
        "Testing & debugging",
        "User feedback handling"
      ],
      "difficulty": "Medium",
      "category": "Technical",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #16: Project-Based Interview (Examine end-to-end lifecycle of a featured project: architecture, deployment, bugs, and tradeoffs.).\n\nInterview Guidelines:\n1. Focus specifically on: System lifecycle, Database schema design, Testing & debugging, User feedback handling.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into System lifecycle and Database schema design",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of System lifecycle and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 17,
      "title": "Situational Questions",
      "level": 2,
      "objective": "Test handling of ambiguous requirements, missed deadlines, scope changes, and technical disputes.",
      "focus_areas": [
        "Ambiguity management",
        "Deadline pressure",
        "Prioritization",
        "Conflict resolution"
      ],
      "difficulty": "Medium",
      "category": "Behavioral",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #17: Situational Questions (Test handling of ambiguous requirements, missed deadlines, scope changes, and technical disputes.).\n\nInterview Guidelines:\n1. Focus specifically on: Ambiguity management, Deadline pressure, Prioritization, Conflict resolution.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Ambiguity management and Deadline pressure",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Ambiguity management and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 18,
      "title": "Communication & Behavioral Interview",
      "level": 2,
      "objective": "Assess structured behavioral storytelling using the STAR (Situation, Task, Action, Result) method.",
      "focus_areas": [
        "STAR framework",
        "Clear articulation",
        "Empathy & listening",
        "Collaborative mindset"
      ],
      "difficulty": "Medium",
      "category": "Communication",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #18: Communication & Behavioral Interview (Assess structured behavioral storytelling using the STAR (Situation, Task, Action, Result) method.).\n\nInterview Guidelines:\n1. Focus specifically on: STAR framework, Clear articulation, Empathy & listening, Collaborative mindset.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into STAR framework and Clear articulation",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of STAR framework and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 19,
      "title": "HR Interview",
      "level": 2,
      "objective": "Evaluate corporate culture adaptability, learning pace, ethics, and long-term commitment.",
      "focus_areas": [
        "Culture fit",
        "Continuous learning",
        "Feedback receptivity",
        "Professional ethics"
      ],
      "difficulty": "Medium",
      "category": "HR",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #19: HR Interview (Evaluate corporate culture adaptability, learning pace, ethics, and long-term commitment.).\n\nInterview Guidelines:\n1. Focus specifically on: Culture fit, Continuous learning, Feedback receptivity, Professional ethics.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Culture fit and Continuous learning",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Culture fit and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 20,
      "title": "Intermediate Mock Interview",
      "level": 2,
      "objective": "Full simulated intermediate recruitment round comparing progress against Level 1 baseline.",
      "focus_areas": [
        "Level 2 synthesis",
        "Technical competence",
        "Project depth",
        "Comparative improvement"
      ],
      "difficulty": "Medium",
      "category": "Mock Evaluation",
      "is_milestone": true,
      "milestone_type": "intermediate_mock",
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #20: Intermediate Mock Interview (Full simulated intermediate recruitment round comparing progress against Level 1 baseline.). This is a CRITICAL MILESTONE EVALUATION (INTERMEDIATE_MOCK). Thoroughly test competencies and assess candidate placement readiness.\n\nInterview Guidelines:\n1. Focus specifically on: Level 2 synthesis, Technical competence, Project depth, Comparative improvement.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Level 2 synthesis and Technical competence",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Level 2 synthesis and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 21,
      "title": "Advanced Technical Interview",
      "level": 3,
      "objective": "Deep-dive into microservices, caching, database sharding, concurrency, and security protocols.",
      "focus_areas": [
        "Scalability & caching",
        "Concurrency control",
        "Security best practices",
        "Resilience patterns"
      ],
      "difficulty": "Hard",
      "category": "Technical",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #21: Advanced Technical Interview (Deep-dive into microservices, caching, database sharding, concurrency, and security protocols.).\n\nInterview Guidelines:\n1. Focus specifically on: Scalability & caching, Concurrency control, Security best practices, Resilience patterns.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Scalability & caching and Concurrency control",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Scalability & caching and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 22,
      "title": "Advanced Programming / Problem Solving",
      "level": 3,
      "objective": "Complex dynamic programming, graph traversal, and advanced algorithmic design.",
      "focus_areas": [
        "Dynamic programming",
        "Graph algorithms",
        "Heuristics & trees",
        "Optimal complexity"
      ],
      "difficulty": "Hard",
      "category": "Problem Solving",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #22: Advanced Programming / Problem Solving (Complex dynamic programming, graph traversal, and advanced algorithmic design.).\n\nInterview Guidelines:\n1. Focus specifically on: Dynamic programming, Graph algorithms, Heuristics & trees, Optimal complexity.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Dynamic programming and Graph algorithms",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Dynamic programming and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 23,
      "title": "Project Defense Interview",
      "level": 3,
      "objective": "Rigorous architectural critique of candidate flagship project: decisions, failures, and defense.",
      "focus_areas": [
        "Architecture defense",
        "Bottleneck diagnosis",
        "Alternative tradeoffs",
        "Production scalability"
      ],
      "difficulty": "Hard",
      "category": "Technical",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #23: Project Defense Interview (Rigorous architectural critique of candidate flagship project: decisions, failures, and defense.).\n\nInterview Guidelines:\n1. Focus specifically on: Architecture defense, Bottleneck diagnosis, Alternative tradeoffs, Production scalability.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Architecture defense and Bottleneck diagnosis",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Architecture defense and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 24,
      "title": "Role-Specific Interview",
      "level": 3,
      "objective": "Simulation tailored to the student specific target job title (e.g. Full Stack, Backend, Data, Cloud).",
      "focus_areas": [
        "Role requirements",
        "Industry workflow",
        "Tooling mastery",
        "Pragmatic delivery"
      ],
      "difficulty": "Hard",
      "category": "Technical",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #24: Role-Specific Interview (Simulation tailored to the student specific target job title (e.g. Full Stack, Backend, Data, Cloud).).\n\nInterview Guidelines:\n1. Focus specifically on: Role requirements, Industry workflow, Tooling mastery, Pragmatic delivery.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Role requirements and Industry workflow",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Role requirements and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 25,
      "title": "Behavioral & Leadership Interview",
      "level": 3,
      "objective": "Assess mentoring junior peers, taking ownership, technical leadership, and strategic alignment.",
      "focus_areas": [
        "Initiative & ownership",
        "Peer mentorship",
        "Influence without authority",
        "Strategic vision"
      ],
      "difficulty": "Hard",
      "category": "Behavioral",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #25: Behavioral & Leadership Interview (Assess mentoring junior peers, taking ownership, technical leadership, and strategic alignment.).\n\nInterview Guidelines:\n1. Focus specifically on: Initiative & ownership, Peer mentorship, Influence without authority, Strategic vision.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Initiative & ownership and Peer mentorship",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Initiative & ownership and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 26,
      "title": "Situational / Scenario Interview",
      "level": 3,
      "objective": "Real-time incident response: production crashes, security vulnerabilities, and emergency patches.",
      "focus_areas": [
        "Crisis management",
        "Root cause analysis",
        "Tradeoff under pressure",
        "Post-mortem learning"
      ],
      "difficulty": "Hard",
      "category": "Behavioral",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #26: Situational / Scenario Interview (Real-time incident response: production crashes, security vulnerabilities, and emergency patches.).\n\nInterview Guidelines:\n1. Focus specifically on: Crisis management, Root cause analysis, Tradeoff under pressure, Post-mortem learning.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Crisis management and Root cause analysis",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Crisis management and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 27,
      "title": "Stress / Follow-Up Interview",
      "level": 3,
      "objective": "Test composure, logical consistency, and conviction when interviewer challenges assertions.",
      "focus_areas": [
        "Composure under challenge",
        "Logical consistency",
        "Constructive pushback",
        "Confidence without arrogance"
      ],
      "difficulty": "Hard",
      "category": "Interview Performance",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #27: Stress / Follow-Up Interview (Test composure, logical consistency, and conviction when interviewer challenges assertions.).\n\nInterview Guidelines:\n1. Focus specifically on: Composure under challenge, Logical consistency, Constructive pushback, Confidence without arrogance.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Composure under challenge and Logical consistency",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Composure under challenge and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 28,
      "title": "HR & Salary Discussion",
      "level": 3,
      "objective": "Professional negotiation, compensation market awareness, career trajectory, and relocation readiness.",
      "focus_areas": [
        "Compensation rationale",
        "Relocation & shifts",
        "Notice period conduct",
        "5-year trajectory"
      ],
      "difficulty": "Hard",
      "category": "HR",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #28: HR & Salary Discussion (Professional negotiation, compensation market awareness, career trajectory, and relocation readiness.).\n\nInterview Guidelines:\n1. Focus specifically on: Compensation rationale, Relocation & shifts, Notice period conduct, 5-year trajectory.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Compensation rationale and Relocation & shifts",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Compensation rationale and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 29,
      "title": "Company-Style Mock Interview",
      "level": 3,
      "objective": "Simulate top-tier tech company recruitment bar with strict rubric evaluation and scoring.",
      "focus_areas": [
        "Company hiring bar",
        "End-to-end discipline",
        "Pacing & polish",
        "Industry competitiveness"
      ],
      "difficulty": "Hard",
      "category": "Mock Evaluation",
      "is_milestone": false,
      "milestone_type": null,
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #29: Company-Style Mock Interview (Simulate top-tier tech company recruitment bar with strict rubric evaluation and scoring.).\n\nInterview Guidelines:\n1. Focus specifically on: Company hiring bar, End-to-end discipline, Pacing & polish, Industry competitiveness.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Company hiring bar and End-to-end discipline",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Company hiring bar and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
    },
  {
      "interview_number": 30,
      "title": "FINAL PLACEMENT SIMULATION",
      "level": 3,
      "objective": "The definitive placement assessment synthesizing all 7 competencies into the Placement Readiness Score.",
      "focus_areas": [
        "Comprehensive synthesis",
        "Final readiness index",
        "Technical & HR excellence",
        "Holistic hiring verdict"
      ],
      "difficulty": "Hard",
      "category": "Placement",
      "is_milestone": true,
      "milestone_type": "final_placement_simulation",
      "domain": "General",
      "role": "Software Engineer",
      "ai_prompt": "You are a senior hiring manager and placement interviewer conducting Interview #30: FINAL PLACEMENT SIMULATION (The definitive placement assessment synthesizing all 7 competencies into the Placement Readiness Score.). This is a CRITICAL MILESTONE EVALUATION (FINAL_PLACEMENT_SIMULATION). Thoroughly test competencies and assess candidate placement readiness.\n\nInterview Guidelines:\n1. Focus specifically on: Comprehensive synthesis, Final readiness index, Technical & HR excellence, Holistic hiring verdict.\n2. Ask ONE question at a time in 1-2 clear, professional sentences.\n3. Adapt questions dynamically to the candidate target role and domain.\n4. Encourage structured responses with concrete examples or logic.\n5. Provide actionable constructive feedback and scoring across competencies.\n\nReturn ONLY the interview question text:",
      "follow_up_guidelines": [
        "Probe specifically into Comprehensive synthesis and Final readiness index",
        "Ask for specific real-world examples or architectural choices",
        "Test candidate depth and consistency when answering follow-up questions"
      ],
      "evaluation_criteria": {
        "content_depth": "Demonstrates strong grasp of Comprehensive synthesis and related concepts",
        "clarity_and_articulation": "Communicates reasoning clearly, concisely, and professionally",
        "problem_approach": "Shows systematic, structured approach to problem solving and explanations",
        "role_suitability": "Meets the industry placement hiring bar for the target job role"
      }
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
  if (access >= 3) return true; // Level 3 (or legacy 6) has all 30 interviews
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
