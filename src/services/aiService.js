import Groq from "groq-sdk";
import crypto from "node:crypto";
import { config } from "../config.js";
import { HttpError } from "../utils/httpError.js";
import { recordAiUsage } from "./aiUsageService.js";
import { classifyRole, determineExperienceLevel, buildRoleCategoryGuidance } from "../mentorship/roleClassification.js";

function cleanJsonResponse(text) {
  if (!text) {
    return "{}";
  }

  const stripped = text.replace(/```(?:json)?/g, "").trim().replace(/`+$/g, "").trim();
  const match = stripped.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[0] : stripped;
}


function clampScore(value) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) {
    return 5;
  }
  return Math.max(0, Math.min(10, number));
}

class AiService {
  constructor() {
    // Prefer specifying models in config so we can change them without code edits:
    this.models = Array.isArray(config.groqModels) && config.groqModels.length > 0
  ? config.groqModels
  : [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
  ];

    this.clients = Array.isArray(config.groqApiKeys) ? config.groqApiKeys.map(key => new Groq({ apiKey: key })) : [];
    this.atsCache = new Map();
  }

  rebuildClients() {
    this.clients = Array.isArray(config.groqApiKeys) ? config.groqApiKeys.map(key => new Groq({ apiKey: key })) : [];
  }

  async generateContent(prompt, feature = "interview_chat", options = {}) {
    if (this.clients.length === 0) {
      throw new HttpError(503, "Groq API key is not configured");
    }

    let lastError;

    // iterate over clients and a snapshot of models (we may modify this.models on the fly)
    for (const client of this.clients) {
      for (const model of [...this.models]) {
        try {
          const response = await client.chat.completions.create({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            ...options
          });
          await recordAiUsage({
            provider: "groq",
            model,
            feature,
            usage: response.usage
          });
          return response.choices?.[0]?.message?.content || "";
        } catch (error) {
          lastError = error;

          // Build a robust error message from possible shapes
          let errMsg = error?.message || String(error);
          try {
            if (error?.response?.data) {
              errMsg = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
            }
          } catch (e) {
            // ignore
          }

          await recordAiUsage({
            provider: "groq",
            model,
            feature,
            status: "error",
            metadata: { message: errMsg }
          });

          // Detect decommissioned-model errors and remove them from rotation so we don't retry forever
          try {
            const lower = String(errMsg).toLowerCase();
            const isDecommissioned = (
              lower.includes('model_decommissioned') ||
              lower.includes('has been decommissioned') ||
              // Groq sometimes includes the phrase "model `name` has been decommissioned"
              (/model `.*` has been decommissioned/.test(String(errMsg))) ||
              (error?.response?.data?.error?.code === 'model_decommissioned')
            );

            if (isDecommissioned) {
              this.models = this.models.filter(m => m !== model);
              console.warn(`Removed decommissioned Groq model from rotation: ${model}`);
            }
          } catch (e) {
            // swallow any errors from the detection logic
          }
        }
      }
    }

    throw new HttpError(500, `All Groq models and keys failed: ${lastError?.message || lastError}`);
  }

  async analyzeResume(resumeText) {
    // Identical resume text must always produce an identical ATS result.
    const hash = crypto.createHash("sha256").update(String(resumeText || "").trim()).digest("hex");
    const cached = this.atsCache.get(hash);
    if (cached) return cached;

    const prompt = `You are an ATS (Applicant Tracking System) evaluator.
Analyze the resume below and score SIX criteria, each an integer from 0-10, using EXACTLY this rubric:

1. contact_info: 10 = email + phone + location + LinkedIn all present; 7 = email + phone; 4 = email only; 0 = none
2. skills: 10 = dedicated skills section with 8+ role-relevant technical skills; 7 = 4-7 relevant skills; 4 = 1-3 skills or vague ("good communicator"); 0 = no skills listed
3. experience: 10 = projects/work with technologies used AND measurable outcomes (%, numbers); 7 = specific projects with tech stack but no metrics; 4 = generic duties/responsibilities only; 0 = none
4. education: 10 = degree + institution + year; 6 = degree + institution; 3 = degree only; 0 = missing
5. formatting: 10 = clear section headers + consistent bullets + 1 page equivalent length; 6 = mostly structured with minor issues; 3 = dense unstructured paragraphs; 0 = unreadable
6. keywords: 10 = strong action verbs (built, led, optimized) and industry terms throughout; 6 = some action verbs; 3 = passive language; 0 = none

Resume:
${String(resumeText || "").slice(0, 2000)}

Return ONLY valid JSON:
{
  "contact_info": 0,
  "skills": 0,
  "experience": 0,
  "education": 0,
  "formatting": 0,
  "keywords": 0,
  "skills_found": [],
  "improvements": []
}`;

    try {
      const text = await this.generateContent(prompt, "resume_ats_analysis", {
        temperature: 0,
        seed: 42
      });
      const result = JSON.parse(cleanJsonResponse(text));

      const clamp10 = (value) => {
        const n = Number.parseInt(value, 10);
        return Number.isNaN(n) ? 5 : Math.max(0, Math.min(10, n));
      };

      const breakdown = {
        contact_info: clamp10(result.contact_info),
        skills: clamp10(result.skills),
        experience: clamp10(result.experience),
        education: clamp10(result.education),
        formatting: clamp10(result.formatting),
        keywords: clamp10(result.keywords)
      };

      // Weighted sum computed in code so identical sub-scores yield an identical total.
      const atsScore = Math.round(
        breakdown.contact_info * 1.0 +
        breakdown.skills * 2.5 +
        breakdown.experience * 3.0 +
        breakdown.education * 1.5 +
        breakdown.formatting * 1.0 +
        breakdown.keywords * 1.0
      );

      const analysis = {
        ats_score: Math.max(0, Math.min(100, atsScore)),
        breakdown,
        skills_found: Array.isArray(result.skills_found) ? result.skills_found : [],
        improvements: Array.isArray(result.improvements) ? result.improvements : []
      };

      if (this.atsCache.size >= 200) this.atsCache.clear();
      this.atsCache.set(hash, analysis);
      return analysis;
    } catch (error) {
      throw new HttpError(500, `ATS analysis failed: ${error.message}`);
    }
  }

  async generateFirstQuestion(resumeText, domain, role) {
    const prompt = `You are a technical interviewer for a ${role} position in the ${domain} domain.
Based on this resume, ask the FIRST interview question.

Resume:
${resumeText.slice(0, 1000)}

Guidelines:
- Start with something from their resume (project, skill, experience)
- Make it specific to the role and domain
- Be conversational
- Ask ONE question only, 1-2 sentences

Return ONLY the question text:`;

    try {
      const text = await this.generateContent(prompt, "interview_first_question");
      return text.trim().replace(/^["']|["']$/g, "");
    } catch (error) {
      throw new HttpError(500, `Question generation failed: ${error.message}`);
    }
  }

  async generateNextQuestion(resumeText, history, domain, role) {
    const conversation = history.slice(-5).map((turn) => {
      return `Q: ${turn.question}\nA: ${(turn.answer || "").slice(0, 300)}\n`;
    }).join("\n");

    const prompt = `You are a technical interviewer for a ${role} position in the ${domain} domain.
Continue this interview naturally. Base your next question on the candidate's background (from their resume) and the conversation so far.

Resume:
${resumeText.slice(0, 1000)}

Conversation history:
${conversation}

Your task:
- If the conversation suggests a natural follow-up, do that.
- If a topic from their resume hasn't been touched, ask a relevant question.
- Keep the interview flowing like a real conversation, not a script.
- Ask ONE question only, 1-2 sentences.

Return ONLY the question text:`;

    try {
      const text = await this.generateContent(prompt, "interview_next_question");
      return text.trim().replace(/^['"]|['"]$/g, "");
    } catch (error) {
      throw new HttpError(500, `Next question generation failed: ${error.message}`);
    }
  }

  buildVideoAnalysisSection(videoMetrics) {
    if (videoMetrics?.quality_flag !== "good") {
      return `Video Analysis: Not available.
Score confidence and body_language based solely on verbal delivery cues in the answer text (sentence structure, assertiveness, hedging words, coherence).
IMPORTANT: body_language must stay within ±1 of the confidence score. Do NOT assign 0 or arbitrary values.`;
    }

    const eyeContact = (Number(videoMetrics.eye_contact || 0) * 10).toFixed(1);
    const attention = (Number(videoMetrics.attention || 0) * 10).toFixed(1);
    const stability = (Number(videoMetrics.stability || 0) * 10).toFixed(1);
    const presence = Math.round(Number(videoMetrics.face_presence || 0) * 100);
    const presenceScore = Math.min(10, presence / 10).toFixed(1);
    const suggested = (
      0.35 * Number(eyeContact) +
      0.3 * Number(attention) +
      0.2 * Number(stability) +
      0.15 * Number(presenceScore)
    ).toFixed(1);

    return `Video Analysis (computed from the candidate's webcam while they answered):
- Face presence : ${presence}% of frames had a visible face
- Eye contact   : ${eyeContact}/10 (how well the face stayed centered toward camera)
- Attention     : ${attention}/10 (engagement signals)
- Posture steadiness: ${stability}/10
- Visibility level  : ${videoMetrics.visibility || "unknown"}

IMPORTANT: Score body_language primarily from these measured video signals:
body_language ≈ round(0.35 × ${eyeContact} + 0.30 × ${attention} + 0.20 × ${stability} + 0.15 × ${presenceScore}) ≈ ${suggested}.
Use this computed value (±1 at most for judgment adjustments). Do NOT assign 0 or arbitrary values.`;
  }

  async evaluateAnswer(question, answer, videoMetrics = null) {
    const videoSection = this.buildVideoAnalysisSection(videoMetrics);

    const prompt = `You are a strict technical interviewer evaluating a candidate's response in an AI-powered interview.

QUESTION:
${question}

CANDIDATE'S ANSWER:
${answer}

${videoSection}

Scoring Rubric (apply consistently):
10 = Exceptional, would impress senior engineers
8 = Strong, clear competence with minor gaps
6 = Adequate, covers basics but lacks depth
4 = Weak, misses key points or has errors
2 = Poor, mostly incorrect or irrelevant
0 = No answer or completely off-topic

Evaluate on these dimensions (0-10 each):
1. communication (clarity, articulation, structure, and verbal expression)
2. confidence
3. body_language
4. knowledge
5. fluency
6. skill_relevance

Also provide:
- strengths: 1-2 specific things done well
- improvements: 1-2 specific, actionable things to improve
- feedback: One paragraph of coaching advice

Return ONLY valid JSON, no markdown:
{
  "communication": 0,
  "confidence": 0,
  "body_language": 0,
  "knowledge": 0,
  "fluency": 0,
  "skill_relevance": 0,
  "strengths": [],
  "improvements": [],
  "feedback": ""
}`;

    try {
      const text = await this.generateContent(prompt, "interview_answer_evaluation");
      const result = JSON.parse(cleanJsonResponse(text));

      for (const key of ["communication", "confidence", "body_language", "knowledge", "fluency", "skill_relevance"]) {
        result[key] = clampScore(result[key]);
      }
      if (result.communication == null || isNaN(result.communication)) {
        result.communication = clampScore(Number((((result.confidence || 7) + (result.fluency || 7)) / 2).toFixed(1)));
      }

      for (const key of ["strengths", "improvements"]) {
        if (!Array.isArray(result[key])) {
          result[key] = result[key] ? [String(result[key])] : [];
        }
      }

      if (typeof result.feedback !== "string" || !result.feedback.trim()) {
        result.feedback = "No feedback generated.";
      }

      return result;
    } catch (error) {
      throw new HttpError(500, `Evaluation failed: ${error.message}`);
    }
  }

  async generateScenario(category) {
    return this.generateCommunicationScenario(category);
  }

  async evaluateResponse(question, answer, category) {
    return this.evaluateCommunicationResponse(question, answer, category);
  }

  async generateReport(exchanges, category) {
    return this.generateCommunicationReport(exchanges, category);
  }

  async generateCommunicationScenario(category) {
    const isInterview = category.includes('Tell Me About') || category.includes('Behavioral') || category.includes('Strengths') || category.includes('Why This') || category.includes('Technical');
    const prompt = isInterview
      ? `You are an interview coach helping a student practice their communication skills for job interviews.

Question Category: ${category}

Create a realistic interview question for this category. The question should feel like something a real interviewer would ask.

Return ONLY valid JSON:
{
  "title": "A short label for this question type",
  "context": "A 1-2 sentence explanation of why interviewers ask this and what they look for",
  "opening": "The interview question itself, phrased naturally as an interviewer would say it"
}`
      : `You are a communication skills coach helping someone practice real-world communication scenarios.

Scenario Category: ${category}

Create a realistic communication scenario for this category. The scenario should feel like a natural situation someone would encounter in daily life or at work.

Return ONLY valid JSON:
{
  "title": "A short label for this scenario type",
  "context": "A 1-2 sentence explanation of why this communication skill matters and what to focus on",
  "opening": "The conversation starter or situation prompt, phrased naturally as it would occur in real life"
}`;

    try {
      const text = await this.generateContent(prompt, "communication_scenario");
      const result = JSON.parse(cleanJsonResponse(text));
      return {
        title: result.title || `${category} Scenario`,
        context: result.context || 'Practice this communication skill to become more effective in real-world situations.',
        opening: result.opening || 'Let\'s practice this communication scenario.',
      };
    } catch (error) {
      throw new HttpError(500, `Question generation failed: ${error.message}`);
    }
  }

  async evaluateCommunicationResponse(question, answer, category = 'General') {
    const isInterview = category.includes('Tell Me About') || category.includes('Behavioral') || category.includes('Strengths') || category.includes('Why This') || category.includes('Technical');
    const prompt = isInterview
      ? `You are a strict interview coach evaluating a candidate's response in a mock interview communication practice.

Question Category: ${category}

Interview Question:
${question}

Candidate's Answer:
${answer}

Evaluate the answer specifically on interview communication skills (0-10 each). Adjust emphasis based on category:
1. clarity — how clear, articulate, and easy to understand the answer is
2. structure — logical flow; for behavioral questions, look for STAR (Situation, Task, Action, Result); for technical categories, look for logical explanation flow
3. conciseness — gets to the point without rambling or being too brief
4. relevance — directly answers the question asked, doesn't go off-topic
5. confidence_tone — sounds professional, confident, and appropriately assertive

${category === 'Behavioral Questions (STAR)' ? 'For this category, weight "structure" higher — a strong STAR format is critical here.' : ''}
${category === 'Technical Explanations' ? 'For this category, weight "clarity" and "relevance" higher — the answer must demonstrate technical understanding clearly.' : ''}
${category === 'Salary & Negotiation Talk' ? 'For this category, weight "confidence_tone" higher — assertiveness and professionalism matter most here.' : ''}
${category === 'Tell Me About Yourself' ? 'For this category, weight "structure" and "relevance" higher — look for a coherent narrative that connects to the role.' : ''}

Also provide:
- strengths: 1-2 specific things done well in the answer
- improvements: 1-2 specific, actionable things to improve
- feedback: One paragraph of coaching advice focusing on interview communication techniques
- next_prompt: The interviewer's natural follow-up question or the next logical interview question
- real_world_tip: One specific, actionable tip for how this answer would land in a real interview and how to strengthen it further

Return ONLY valid JSON, no markdown:
{
  "clarity": 0,
  "structure": 0,
  "conciseness": 0,
  "relevance": 0,
  "confidence_tone": 0,
  "strengths": [],
  "improvements": [],
  "feedback": "",
  "next_prompt": "",
  "real_world_tip": ""
}`
      : `You are a communication skills coach evaluating someone's response in a real-world communication practice session.

Scenario Category: ${category}

Scenario Prompt:
${question}

Person's Response:
${answer}

Evaluate the response specifically on general communication skills (0-10 each). Adjust emphasis based on category:
1. clarity — how clear, articulate, and easy to understand the response is
2. structure — logical flow of ideas
3. conciseness — gets to the point without rambling or being too brief
4. relevance — directly addresses the situation, doesn't go off-topic
5. confidence_tone — sounds appropriate and well-calibrated for the context

${category === 'Conflict Resolution & Difficult Conversations' ? 'For this category, weight "structure" and "confidence_tone" higher — look for empathy-first, solution-oriented approaches.' : ''}
${category === 'Public Speaking & Presentations' ? 'For this category, weight "clarity" and "structure" higher — the response should be well-organized and engaging.' : ''}
${category === 'Persuasion & Influence' ? 'For this category, weight "relevance" and "confidence_tone" higher — look for logical arguments and confident delivery.' : ''}
${category === 'Active Listening & Empathy' ? 'For this category, weight "structure" and "relevance" higher — look for reflective listening and empathetic responses.' : ''}
${category === 'Giving & Receiving Feedback' ? 'For this category, weight "structure" and "confidence_tone" higher — look for constructive, balanced feedback.' : ''}
${category === 'Storytelling & Narrative Skills' ? 'For this category, weight "structure" and "clarity" higher — look for narrative arc and engaging delivery.' : ''}
${category === 'Crisis Communication' ? 'For this category, weight "clarity" and "confidence_tone" higher — look for calm, clear, and reassuring communication.' : ''}

Also provide:
- strengths: 1-2 specific things done well in the response
- improvements: 1-2 specific, actionable things to improve
- feedback: One paragraph of coaching advice focusing on communication techniques
- next_prompt: A natural follow-up prompt or the next logical scenario to practice
- real_world_tip: One specific, actionable tip for how this response would be received in a real situation

Return ONLY valid JSON, no markdown:
{
  "clarity": 0,
  "structure": 0,
  "conciseness": 0,
  "relevance": 0,
  "confidence_tone": 0,
  "strengths": [],
  "improvements": [],
  "feedback": "",
  "next_prompt": "",
  "real_world_tip": ""
}`;

    try {
      const text = await this.generateContent(prompt, "communication_evaluation");
      const result = JSON.parse(cleanJsonResponse(text));

      for (const key of ["clarity", "structure", "conciseness", "relevance", "confidence_tone"]) {
        result[key] = clampScore(result[key]);
      }

      for (const key of ["strengths", "improvements"]) {
        if (!Array.isArray(result[key])) {
          result[key] = result[key] ? [String(result[key])] : [];
        }
      }

      if (typeof result.feedback !== "string" || !result.feedback.trim()) {
        result.feedback = "Keep practicing to improve your communication skills.";
      }

      if (typeof result.next_prompt !== "string" || !result.next_prompt.trim()) {
        result.next_prompt = "Can you tell me more about a specific example from your experience?";
      }

      if (typeof result.real_world_tip !== "string" || !result.real_world_tip.trim()) {
        result.real_world_tip = "In real situations, aim to be specific and provide concrete examples from your experience.";
      }

      return result;
    } catch (error) {
      throw new HttpError(500, `Communication evaluation failed: ${error.message}`);
    }
  }

  async generateCommunicationReport(exchanges, category = 'General') {
    const isInterview = category.includes('Tell Me About') || category.includes('Behavioral') || category.includes('Strengths') || category.includes('Why This') || category.includes('Technical');
    const contextLabel = isInterview ? 'interview communication' : 'communication';
    const contextPlural = isInterview ? 'interviews' : 'situations';
    const prompt = `Based on this ${contextLabel} practice session, create a comprehensive coaching report.

Category: ${category}

Exchange data:
${JSON.stringify(exchanges, null, 2)}

Return a JSON with the following structure:

1. strengths: Array of 3-4 overall ${contextLabel} strengths demonstrated
2. areas_to_improve: Array of 3-4 specific areas needing improvement in ${contextLabel}
3. tips: Array of 4-5 actionable ${contextLabel} tips
4. category_insights: An object with:
   - category_mastery: One-sentence assessment of how well the person handled this category
   - key_takeaway: The single most important thing to remember for this category in real ${contextPlural}
   - recommended_focus: What to focus practice on for this category
5. real_world_preparation: Array of 4-5 specific, actionable tips for real-world ${contextPlural} based on this person's performance
6. competency_analysis: An object with:
   - demonstrated_competencies: Array of competencies shown (e.g., ["Active Listening", "Empathy", "Clarity", "Confidence"])
   - competencies_to_develop: Array of competencies that need development
   - communication_style: Assessment of their communication style

Return ONLY valid JSON:
{
  "strengths": [],
  "areas_to_improve": [],
  "tips": [],
  "category_insights": {
    "category_mastery": "",
    "key_takeaway": "",
    "recommended_focus": ""
  },
  "real_world_preparation": [],
  "competency_analysis": {
    "demonstrated_competencies": [],
    "competencies_to_develop": [],
    "communication_style": ""
  }
}`;

    try {
      const text = await this.generateContent(prompt, "communication_report");
      const result = JSON.parse(cleanJsonResponse(text));

      const defaults = {
        strengths: [],
        areas_to_improve: [],
        tips: [],
        category_insights: {
          category_mastery: '',
          key_takeaway: '',
          recommended_focus: '',
        },
        real_world_preparation: [],
        competency_analysis: {
          demonstrated_competencies: [],
          competencies_to_develop: [],
          communication_style: '',
        },
      };

      for (const key of Object.keys(defaults)) {
        if (result[key] === undefined || result[key] === null) {
          result[key] = defaults[key];
        }
      }

      if (!Array.isArray(result.strengths)) result.strengths = [];
      if (!Array.isArray(result.areas_to_improve)) result.areas_to_improve = [];
      if (!Array.isArray(result.tips)) result.tips = [];
      if (!Array.isArray(result.real_world_preparation)) result.real_world_preparation = [];
      if (typeof result.category_insights !== 'object') result.category_insights = defaults.category_insights;
      if (typeof result.competency_analysis !== 'object') result.competency_analysis = defaults.competency_analysis;

      return result;
    } catch (error) {
      throw new HttpError(500, `Report generation failed: ${error.message}`);
    }
  }

  buildStudentContext(studentContext = {}) {
    const stream = studentContext?.stream || studentContext?.domain || '';
    const targetRole = studentContext?.target_role || studentContext?.role || studentContext?.interested_role || '';
    const domain = studentContext?.domain || stream || 'General';
    const role = studentContext?.role || targetRole || 'Software Engineer';
    const experienceLevel = studentContext?.experienceLevel || determineExperienceLevel(studentContext?.resumeText || '', studentContext?.userProfile);
    const classification = classifyRole(role, domain);
    const category = studentContext?.category || classification.category;

    const categoryGuidance = buildRoleCategoryGuidance(category, domain, role, experienceLevel);

    let context = `Candidate Profile:
- Stream / Degree: ${stream || 'Not specified'}
- Selected Domain: ${domain}
- Selected Job Role: ${role}
- Role Classification: ${category} (${classification.description})
- Candidate Experience Level: ${experienceLevel}

${categoryGuidance}`;

    if (studentContext?.previousPerformance) {
      const perf = studentContext.previousPerformance;
      context += `\nCandidate Previous Performance History:
- Current Journey Level: Level ${perf.level || 1}
- Past Average Score: ${perf.avgScore != null ? `${perf.avgScore}%` : 'N/A'}
- Known Weak Areas: ${perf.weakAreas?.length ? perf.weakAreas.join(', ') : 'None identified yet'}
- Known Strong Areas: ${perf.strongAreas?.length ? perf.strongAreas.join(', ') : 'Solid general baseline'}\n`;
    }

    if (studentContext?.previousQuestions && studentContext.previousQuestions.length > 0) {
      context += `\nPREVIOUSLY ASKED QUESTIONS TO STRICTLY AVOID DUPLICATING:
${studentContext.previousQuestions.slice(-10).map((q, idx) => `${idx + 1}. ${q}`).join('\n')}
MANDATE: DO NOT ask any question that is identical or semantically similar to the questions listed above. Target a different aspect, component, or depth of the role.\n`;
    }

    return context;
  }

  async generateBlueprintFirstQuestion(resumeText, blueprint, studentContext) {
    const context = this.buildStudentContext({ ...studentContext, resumeText });
    const isCrossQuestioning = blueprint.interview_number === 24;
    const isProjectDefense = blueprint.interview_number === 23;
    const isCaseStudy = blueprint.interview_number === 25;
    const isProblemSolving = blueprint.interview_number === 15 || blueprint.interview_number === 22;

    let specificInstructions = '';
    if (isCaseStudy) {
      specificInstructions = `Present a realistic, role-specific business/technical/functional case study appropriate for a ${studentContext?.role || 'candidate'} in ${studentContext?.domain || 'this field'}. Frame the initial case context clearly and ask how they would begin analyzing or solving it.`;
    } else if (isProblemSolving) {
      specificInstructions = `Present an engaging, practical role-specific problem (NOT an abstract math or brain-teaser puzzle). Test their step-by-step troubleshooting or solution approach.`;
    } else if (isProjectDefense) {
      specificInstructions = `Identify the candidate's primary project from their resume and ask an incisive question challenging its design, architecture, or workflow rationale.`;
    }

    const prompt = `${blueprint.ai_prompt}

${context}

Candidate Resume:
${(resumeText || '').slice(0, 1500)}

${specificInstructions ? `Specific Directive: ${specificInstructions}\n` : ''}
Based on the candidate's profile, role category, resume, and the interview pattern objective above, ask the FIRST question for this interview.
Ensure the question strictly reflects the target role (${studentContext?.role || 'the role'}) and domain (${studentContext?.domain || 'the domain'}).
Return ONLY the question text (no quotes, no preamble):`;

    try {
      const text = await this.generateContent(prompt, "blueprint_first_question");
      return text.trim().replace(/^['\"]|['\"]$/g, "");
    } catch (error) {
      throw new HttpError(500, `Blueprint question generation failed: ${error.message}`);
    }
  }

  async generateBlueprintNextQuestion(resumeText, history, blueprint, studentContext) {
    const conversation = history.slice(-5).map((turn) => {
      return `Q: ${turn.question}\nA: ${(turn.answer || "").slice(0, 350)}\n`;
    }).join("\n");

    const previousQuestionsInSession = history.map(h => h.question);
    const allPrevious = [
      ...(studentContext?.previousQuestions || []),
      ...previousQuestionsInSession,
    ];

    const context = this.buildStudentContext({
      ...studentContext,
      resumeText,
      previousQuestions: allPrevious,
    });

    const isCrossQuestioning = blueprint.interview_number === 24;
    const isProjectDefense = blueprint.interview_number === 23;
    const isCaseStudy = blueprint.interview_number === 25;
    const isRoleSpecificII = blueprint.interview_number === 12;

    let patternGuidance = '';
    if (isCrossQuestioning) {
      const lastAnswer = history[history.length - 1]?.answer || '';
      patternGuidance = `MANDATORY CROSS-QUESTIONING INSTRUCTION:
The candidate just answered: "${lastAnswer.slice(0, 250)}".
Do NOT jump to a new unrelated topic. Dynamically cross-examine a specific technical or functional claim in their answer. Probe their depth, consistency, and ask for concrete justification or trade-offs.`;
    } else if (isProjectDefense) {
      patternGuidance = `MANDATORY PROJECT DEFENSE INSTRUCTION:
Critically evaluate the candidate's previous explanation. Challenge an assumption, scale limitation, or design trade-off in their project implementation.`;
    } else if (isCaseStudy) {
      patternGuidance = `MANDATORY CASE STUDY INSTRUCTION:
Advance the case study scenario based on the candidate's proposal. Introduce a realistic complication, constraint, or stakeholder pushback to see how they adapt.`;
    } else if (isRoleSpecificII) {
      patternGuidance = `MANDATORY ROLE DEPTH INSTRUCTION:
Ask a deeper, more challenging role-specific question that pushes into advanced practices and edge cases.`;
    }

    const prompt = `${blueprint.ai_prompt}

${context}

Candidate Resume:
${(resumeText || '').slice(0, 1500)}

Conversation History (Most Recent Turns):
${conversation}

${patternGuidance ? `${patternGuidance}\n` : ''}
Advance the interview toward the pattern objective (${blueprint.title}).
Ask ONE follow-up question.
Do NOT repeat any previously asked questions.
Return ONLY the question text (no quotes, no preamble):`;

    try {
      const text = await this.generateContent(prompt, "blueprint_next_question");
      return text.trim().replace(/^['\"]|['\"]$/g, "");
    } catch (error) {
      throw new HttpError(500, `Blueprint next question generation failed: ${error.message}`);
    }
  }

  async evaluateBlueprintAnswer(question, answer, blueprint, videoMetrics = null, studentContext) {
    const videoSection = this.buildVideoAnalysisSection(videoMetrics);

    const criteria = Object.entries(blueprint.evaluation_criteria || {})
      .map(([key, desc]) => `- ${key}: ${desc}`)
      .join('\n');

    const context = this.buildStudentContext(studentContext);

    const prompt = `You are evaluating a candidate's response in a structured placement interview.

Interview: ${blueprint.title} (Level ${blueprint.level})
Objective: ${blueprint.objective}

Evaluation Criteria:
${criteria}

${context}

QUESTION:
${question}

CANDIDATE'S ANSWER:
${answer}

${videoSection}

Scoring Rubric (0-10):
10 = Exceptional | 8 = Strong | 6 = Adequate | 4 = Weak | 2 = Poor | 0 = No answer

Evaluate on these dimensions (0-10 each):
1. communication (clarity, articulation, structure, and verbal expression)
2. confidence
3. body_language
4. knowledge
5. fluency
6. skill_relevance

Also provide:
- strengths: 1-2 specific things done well
- improvements: 1-2 specific, actionable things to improve
- feedback: One paragraph of coaching advice
- blueprint_score: 0-10 score based on the blueprint-specific criteria above

Return ONLY valid JSON:
{
  "communication": 0,
  "confidence": 0,
  "body_language": 0,
  "knowledge": 0,
  "fluency": 0,
  "skill_relevance": 0,
  "strengths": [],
  "improvements": [],
  "feedback": "",
  "blueprint_score": 0
}`;

    try {
      const text = await this.generateContent(prompt, "blueprint_answer_evaluation");
      const result = JSON.parse(cleanJsonResponse(text));

      for (const key of ["communication", "confidence", "body_language", "knowledge", "fluency", "skill_relevance"]) {
        result[key] = clampScore(result[key]);
      }
      if (result.communication == null || isNaN(result.communication)) {
        result.communication = clampScore(Number((((result.confidence || 7) + (result.fluency || 7)) / 2).toFixed(1)));
      }
      result.blueprint_score = clampScore(result.blueprint_score);

      for (const key of ["strengths", "improvements"]) {
        if (!Array.isArray(result[key])) {
          result[key] = result[key] ? [String(result[key])] : [];
        }
      }
      if (typeof result.feedback !== "string" || !result.feedback.trim()) {
        result.feedback = "No feedback generated.";
      }
      return result;
    } catch (error) {
      throw new HttpError(500, `Blueprint evaluation failed: ${error.message}`);
    }
  }

  async generateOverallReport(atsData, evaluations) {
    const prompt = `Based on the complete interview data below, create a comprehensive report summary.

ATS Score: ${atsData.ats_score || 0}/100
Skills Found: ${(atsData.skills_found || []).join(", ")}

Per-question evaluations:
${JSON.stringify(evaluations, null, 2)}

Return a JSON with:
- strengths: Array of 3-4 overall strengths demonstrated in the interview
- areas_to_improve: Array of 3-4 specific areas needing improvement
- interview_tips: Array of 4-5 actionable tips for future interviews

Return ONLY valid JSON:
{
  "strengths": [],
  "areas_to_improve": [],
  "interview_tips": []
}`;

    try {
      const text = await this.generateContent(prompt, "interview_overall_report");
      return JSON.parse(cleanJsonResponse(text));
    } catch (error) {
      throw new HttpError(500, `Report generation failed: ${error.message}`);
    }
  }

  async generatePlacementReadinessReport({
    interviewNumber,
    domain,
    role,
    history,
    studentProfile = {},
    level1Score = null,
    level2Score = null,
    previousWeaknesses = [],
    previousStrengths = [],
  }) {
    const classification = classifyRole(role, domain);
    const category = classification.category;
    const isLevel30 = interviewNumber === 30;
    const isLevel20 = interviewNumber === 20;

    const turnsSummary = history
      .map((h, i) => `Q${i + 1}: ${h.question}\nA: ${h.answer}\nScore: ${h.evaluation?.blueprint_score || 7}/10\nFeedback: ${h.evaluation?.feedback || ''}`)
      .join('\n\n');

    const prompt = `You are the Chief Placement Officer and Lead Interview Assessor generating an authoritative Placement Readiness Report for Interview #${interviewNumber}.
Target Role: "${role}"
Domain: "${domain}"
Role Category: ${category}
${isLevel30 ? 'CRITICAL CAPSTONE: Final Placement Simulation (Interview #30)' : isLevel20 ? 'MILESTONE: Intermediate Mock Evaluation (Interview #20)' : 'MILESTONE: Foundation Mock Evaluation (Interview #10)'}

Candidate Interview Questions & Answers in this session:
${turnsSummary}

${level1Score != null ? `Prior Level 1 Baseline Score: ${level1Score}%` : ''}
${level2Score != null ? `Prior Level 2 Intermediate Score: ${level2Score}%` : ''}
${previousWeaknesses?.length ? `Historical Weak Areas: ${previousWeaknesses.join(', ')}` : ''}
${previousStrengths?.length ? `Historical Strong Areas: ${previousStrengths.join(', ')}` : ''}

Generate an exhaustive, highly structured Placement Readiness Evaluation covering:
1. technical_functional: 0-100 score
2. communication: 0-100 score
3. problem_solving: 0-100 score
4. resume_fidelity: 0-100 score
5. behavioral_mastery: 0-100 score
6. hr_culture: 0-100 score
7. interview_performance: 0-100 score
8. role_readiness: 0-100 score
9. placement_readiness_score: 0-100 weighted overall placement readiness score
10. strengths: Array of 3-5 concrete observed strengths with context
11. weaknesses: Array of 3-5 specific weak areas to remediate
12. improvement_from_level_1: detailed assessment on measurable progress made since Level 1
13. improvement_from_level_2: detailed assessment on progress made since Level 2 (or N/A if Level 1)
14. remaining_skill_gaps: Array of 2-4 critical skill gaps still to address
15. recommended_next_steps: Array of 3-4 actionable next steps for the candidate

Return ONLY valid JSON:
{
  "technical_functional": 0,
  "communication": 0,
  "problem_solving": 0,
  "resume_fidelity": 0,
  "behavioral_mastery": 0,
  "hr_culture": 0,
  "interview_performance": 0,
  "role_readiness": 0,
  "placement_readiness_score": 0,
  "strengths": [],
  "weaknesses": [],
  "improvement_from_level_1": "",
  "improvement_from_level_2": "",
  "remaining_skill_gaps": [],
  "recommended_next_steps": []
}`;

    try {
      const text = await this.generateContent(prompt, "placement_readiness_report");
      const parsed = JSON.parse(cleanJsonResponse(text));
      for (const k of [
        'technical_functional', 'communication', 'problem_solving', 'resume_fidelity',
        'behavioral_mastery', 'hr_culture', 'interview_performance', 'role_readiness',
        'placement_readiness_score'
      ]) {
        if (typeof parsed[k] !== 'number' || isNaN(parsed[k])) {
          parsed[k] = 75;
        } else {
          parsed[k] = Math.max(0, Math.min(100, Math.round(parsed[k])));
        }
      }
      return parsed;
    } catch (err) {
      console.error('Failed to generate placement readiness report via AI:', err.message);
      const avgScore = Math.round(
        history.reduce((s, h) => s + (h.evaluation?.blueprint_score || 7) * 10, 0) / (history.length || 1)
      );
      return {
        technical_functional: avgScore,
        communication: Math.min(100, avgScore + 2),
        problem_solving: Math.max(40, avgScore - 2),
        resume_fidelity: avgScore,
        behavioral_mastery: Math.min(100, avgScore + 4),
        hr_culture: Math.min(100, avgScore + 3),
        interview_performance: avgScore,
        role_readiness: avgScore,
        placement_readiness_score: avgScore,
        strengths: [
          `Clear articulation and relevant context for ${role}`,
          "Systematic approach to problem solving under questioning",
          "Effective alignment with industry expectations",
        ],
        weaknesses: [
          "Deepen practical edge-case troubleshooting and trade-off justification",
          "Elaborate more on quantifiable business or project outcomes",
        ],
        improvement_from_level_1: level1Score != null
          ? `Improved overall readiness by ${Math.max(0, avgScore - level1Score)}% since Level 1 baseline.`
          : "Substantial progression demonstrated across foundational competencies.",
        improvement_from_level_2: level2Score != null
          ? `Improved overall readiness by ${Math.max(0, avgScore - level2Score)}% since Level 2 development.`
          : "Demonstrates consistent advancement across advanced role scenarios.",
        remaining_skill_gaps: [
          `Specialized ${category} edge-case optimization`,
          "Rapid cognitive articulation during high-pressure cross-questioning",
        ],
        recommended_next_steps: [
          `Review core ${category} frameworks and practical problem scenarios`,
          "Practice STAR method responses for high-stakes leadership questions",
          "Refine project defense explanations with concrete metrics",
        ],
      };
    }
  }
}

export const aiService = new AiService();
