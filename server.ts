import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import type { GenerateContentConfig, Schema } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ordered list of valid free-tier Gemini Flash models for automatic quota failover
const FREE_TIER_MODELS = [
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
] as const;

const modelCooldownUntil: Record<string, number> = {};

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isQuotaOrTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const upper = msg.toUpperCase();
  return (
    upper.includes('429') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('QUOTA') ||
    upper.includes('503') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('404') ||
    upper.includes('NOT_FOUND')
  );
}

function formatFriendlyError(err: unknown, fallbackLabel: string): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  const upper = raw.toUpperCase();
  if (
    upper.includes('429') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('QUOTA')
  ) {
    return 'AI серверийн үнэгүй хүсэлтийн хязгаар түр дүүрсэн байна. Хэсэг хүлээгээд «Дахин боловсруулах» товчийг дарна уу.';
  }
  if (upper.includes('503') || upper.includes('UNAVAILABLE')) {
    return 'AI сервер түр ачаалалтай байна. Дахин оролдоно уу.';
  }
  if (raw.trim().startsWith('{')) {
    return fallbackLabel;
  }
  return raw || fallbackLabel;
}

async function generateWithFallback(
  contents: Parameters<GoogleGenAI['models']['generateContent']>[0]['contents'],
  config?: GenerateContentConfig
): Promise<string> {
  const ai = getGenAIClient();
  const now = Date.now();

  const available = FREE_TIER_MODELS.filter(
    (m) => !modelCooldownUntil[m] || modelCooldownUntil[m] <= now
  );
  const candidates = available.length > 0 ? available : [...FREE_TIER_MODELS];

  let lastError: unknown = null;

  for (const modelName of candidates) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config,
      });
      const text = response.text?.trim() || '';
      if (!text) {
        throw new Error(`Empty response from ${modelName}`);
      }
      if (config?.responseMimeType === 'application/json') {
        JSON.parse(text);
      }
      return text;
    } catch (err: unknown) {
      lastError = err;
      if (isQuotaOrTransientError(err)) {
        // Put exhausted model on a 5-minute cooldown so subsequent calls skip straight to healthy models
        modelCooldownUntil[modelName] = Date.now() + 5 * 60 * 1000;
      }
      continue;
    }
  }

  throw lastError || new Error('AI загвараас хариу авч чадсангүй.');
}

interface GoalPayload {
  topic?: string;
  subject?: string;
  grade?: string;
  durationMinutes?: number;
  focusNote?: string;
}

function buildGoalPromptContext(goal: GoalPayload): string {
  const topic = (goal.topic || '').trim();
  const subject = (goal.subject || 'Ерөнхий эрдэм').trim();
  const grade = (goal.grade || 'Дунд анги').trim();
  const duration = Number(goal.durationMinutes) || 40;
  const focus = goal.focusNote
    ? `\nНэмэлт чиглэл / онцлог: ${goal.focusNote.trim()}`
    : '';

  return `Хичээлийн сэдэв (Нэг зорилго): "${topic}"
Хичээл: ${subject}
Анги / Түвшин: ${grade}
Хичээлийн үргэлжлэх хугацаа: ${duration} минут${focus}`;
}

function buildCacheKey(goal: GoalPayload): string {
  return [
    (goal.subject || '').trim().toLowerCase(),
    (goal.grade || '').trim().toLowerCase(),
    String(Number(goal.durationMinutes) || 40),
    (goal.topic || '').trim().toLowerCase(),
    (goal.focusNote || '').trim().toLowerCase(),
  ].join('|');
}

// Reusable JSON Schemas for the 6 AI Bots
const RESEARCH_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Сэдвийн гол агуулга ба тухайн ангид заах арга зүйн товч тойм (3 өгүүлбэр).',
    },
    keyConcepts: {
      type: Type.ARRAY,
      description: 'Заавал эзэмшүүлэх 3-4 үндсэн ойлголт ба сурагчдад ойлгуулах энгийн зүйрлэл.',
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          definition: { type: Type.STRING },
          classroomAnalogy: { type: Type.STRING },
        },
        required: ['term', 'definition', 'classroomAnalogy'],
      },
    },
    engagingFacts: {
      type: Type.ARRAY,
      description: 'Хичээлийн эхэнд сурагчдын сонирхлыг татах 3 сонирхолтой баримт.',
      items: { type: Type.STRING },
    },
    commonMisconceptions: {
      type: Type.ARRAY,
      description: 'Сурагчдын гаргадаг 2 түгээмэл ташаа ойлголт ба залруулга.',
      items: {
        type: Type.OBJECT,
        properties: {
          misconception: { type: Type.STRING },
          correction: { type: Type.STRING },
        },
        required: ['misconception', 'correction'],
      },
    },
    crossCurricularLinks: {
      type: Type.ARRAY,
      description: 'Бусад хичээл болон бодит амьдралтай холбогдох 3 жишээ.',
      items: { type: Type.STRING },
    },
  },
  required: [
    'summary',
    'keyConcepts',
    'engagingFacts',
    'commonMisconceptions',
    'crossCurricularLinks',
  ],
};

const CONTENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    lessonObjective: {
      type: Type.STRING,
      description: 'Хичээлийн хэмжигдэхүйц тодорхой зорилго.',
    },
    materialsNeeded: {
      type: Type.ARRAY,
      description: 'Хэрэглэгдэхүүн ба бэлтгэх зүйлсийн жагсаалт (4 зүйл).',
      items: { type: Type.STRING },
    },
    timeline: {
      type: Type.ARRAY,
      description: 'Хичээлийн 4 үе шат (Сэдэлжүүлэлт, Шинэ мэдлэг, Батгах/Дадлага, Дүгнэлт).',
      items: {
        type: Type.OBJECT,
        properties: {
          phase: { type: Type.STRING },
          durationMinutes: { type: Type.INTEGER },
          teacherAction: { type: Type.STRING },
          studentActivity: { type: Type.STRING },
        },
        required: ['phase', 'durationMinutes', 'teacherAction', 'studentActivity'],
      },
    },
    slideOutline: {
      type: Type.ARRAY,
      description: 'Хичээлийн 4 слайдын агуулга ба зураглалын санаа.',
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          keyPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          visualSuggestion: { type: Type.STRING },
        },
        required: ['slideNumber', 'title', 'keyPoints', 'visualSuggestion'],
      },
    },
    interactiveActivity: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        duration: { type: Type.STRING },
        instructions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['title', 'duration', 'instructions'],
    },
  },
  required: [
    'lessonObjective',
    'materialsNeeded',
    'timeline',
    'slideOutline',
    'interactiveActivity',
  ],
};

const REPORT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    learningOutcomes: {
      type: Type.ARRAY,
      description: 'Блумын түвшнээр гаргасан 4 суралцахуйн үр дүн.',
      items: {
        type: Type.OBJECT,
        properties: {
          level: { type: Type.STRING },
          outcome: { type: Type.STRING },
        },
        required: ['level', 'outcome'],
      },
    },
    rubric: {
      type: Type.ARRAY,
      description: 'Нийлбэр нь 100 оноо болох 3 шалгууртай үнэлгээний рубрик.',
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING },
          excellent: { type: Type.STRING },
          proficient: { type: Type.STRING },
          developing: { type: Type.STRING },
          maxScore: { type: Type.INTEGER },
        },
        required: ['criterion', 'excellent', 'proficient', 'developing', 'maxScore'],
      },
    },
    differentiation: {
      type: Type.OBJECT,
      properties: {
        supportStudents: { type: Type.STRING },
        advancedStudents: { type: Type.STRING },
      },
      required: ['supportStudents', 'advancedStudents'],
    },
    homeworkAssignment: {
      type: Type.OBJECT,
      properties: {
        task: { type: Type.STRING },
        estimatedMinutes: { type: Type.INTEGER },
        deliverable: { type: Type.STRING },
      },
      required: ['task', 'estimatedMinutes', 'deliverable'],
    },
    teacherReportSummary: {
      type: Type.STRING,
      description: 'Цахим журналд тэмдэглэх ээлжит хичээлийн тайлангийн дүгнэлт.',
    },
  },
  required: [
    'learningOutcomes',
    'rubric',
    'differentiation',
    'homeworkAssignment',
    'teacherReportSummary',
  ],
};

const ANSWERS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    multipleChoiceQuiz: {
      type: Type.ARRAY,
      description: '5 сонгох тестийн асуулт, тус бүр яг 4 сонголттой (correctIndex: 0..3).',
      items: {
        type: Type.OBJECT,
        properties: {
          questionNumber: { type: Type.INTEGER },
          question: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
        },
        required: ['questionNumber', 'question', 'options', 'correctIndex', 'explanation'],
      },
    },
    openQuestions: {
      type: Type.ARRAY,
      description: '2 задгай асуулт ба зөв хариултын түлхүүр.',
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          modelAnswer: { type: Type.STRING },
          gradingHint: { type: Type.STRING },
        },
        required: ['question', 'modelAnswer', 'gradingHint'],
      },
    },
    anticipatedStudentQuestions: {
      type: Type.ARRAY,
      description: 'Сурагчдаас ирж болзошгүй 2 сониуч асуулт ба багшийн хариулт.',
      items: {
        type: Type.OBJECT,
        properties: {
          studentQuestion: { type: Type.STRING },
          teacherResponse: { type: Type.STRING },
        },
        required: ['studentQuestion', 'teacherResponse'],
      },
    },
  },
  required: ['multipleChoiceQuiz', 'openQuestions', 'anticipatedStudentQuestions'],
};

const PLANNER_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overview: {
      type: Type.OBJECT,
      properties: {
        unitName: { type: Type.STRING },
        curriculumObjective: { type: Type.STRING },
        keyCompetencies: { type: Type.STRING },
        priorKnowledge: { type: Type.STRING },
        methodology: { type: Type.STRING },
        resources: { type: Type.STRING },
      },
      required: [
        'unitName',
        'curriculumObjective',
        'keyCompetencies',
        'priorKnowledge',
        'methodology',
        'resources',
      ],
    },
    stagesTable: {
      type: Type.ARRAY,
      description: 'Ээлжит хичээлийн 5 үе шат бүхий хүснэгтийн мөрүүд.',
      items: {
        type: Type.OBJECT,
        properties: {
          stageName: { type: Type.STRING },
          durationMinutes: { type: Type.INTEGER },
          learningObjective: { type: Type.STRING },
          teacherActivity: { type: Type.STRING },
          studentActivity: { type: Type.STRING },
          materials: { type: Type.STRING },
          assessmentCheck: { type: Type.STRING },
        },
        required: [
          'stageName',
          'durationMinutes',
          'learningObjective',
          'teacherActivity',
          'studentActivity',
          'materials',
          'assessmentCheck',
        ],
      },
    },
    boardPlan: {
      type: Type.OBJECT,
      properties: {
        leftPanel: { type: Type.ARRAY, items: { type: Type.STRING } },
        centerPanel: { type: Type.ARRAY, items: { type: Type.STRING } },
        rightPanel: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['leftPanel', 'centerPanel', 'rightPanel'],
    },
  },
  required: ['overview', 'stagesTable', 'boardPlan'],
};

const EXERCISES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    worksheetTitle: { type: Type.STRING },
    instructions: { type: Type.STRING },
    problems: {
      type: Type.ARRAY,
      description: 'Ялгаатай 3 түвшний (А-1, А-2, Б-1, Б-2, В-1, В-2) 6 бодлого дасгал, нийт 100 оноо.',
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          tier: { type: Type.STRING },
          points: { type: Type.INTEGER },
          rubricCriterion: { type: Type.STRING },
          problemStatement: { type: Type.STRING },
          hint: { type: Type.STRING },
          stepByStepSolution: { type: Type.STRING },
          finalAnswer: { type: Type.STRING },
        },
        required: [
          'code',
          'tier',
          'points',
          'rubricCriterion',
          'problemStatement',
          'hint',
          'stepByStepSolution',
          'finalAnswer',
        ],
      },
    },
  },
  required: ['worksheetTitle', 'instructions', 'problems'],
};

type ServerBotId =
  | 'research'
  | 'content'
  | 'report'
  | 'answers'
  | 'planner'
  | 'exercises';

const BOT_SCHEMA_MAP: Record<ServerBotId, Schema> = {
  research: RESEARCH_SCHEMA,
  content: CONTENT_SCHEMA,
  report: REPORT_SCHEMA,
  answers: ANSWERS_SCHEMA,
  planner: PLANNER_SCHEMA,
  exercises: EXERCISES_SCHEMA,
};

const BOT_PROMPT_LABELS: Record<ServerBotId, string> = {
  research: '1. Судалгаа (онол, ухагдахуун, зүйрлэл, сонирхолтой баримт)',
  content: '2. Контент (хичээлийн 4 үе шат, 4 слайд, багийн ажил)',
  report: '3. Тайлан (100 онооны 3 шалгуурт рубрик, ялгаатай даалгавар, гэрийн даалгавар)',
  answers: '4. Хариулт (5 сонгох тест 4 хувилбартай correctIndex 0..3, 2 задгай асуулт)',
  planner: '5. Боловсруулагч (5 үе шаттай хүснэгтэн төлөвлөлт ба самбар төлөвлөлт)',
  exercises: '6. Бодлого дасгал (А-1, А-2, Б-1, Б-2, В-1, В-2 нийт 6 бодлого, нийлбэр 100 оноо)',
};

const ALL_SERVER_BOT_IDS: ServerBotId[] = [
  'research',
  'content',
  'report',
  'answers',
  'planner',
  'exercises',
];

function buildSubsetSchema(botIds: ServerBotId[]): Schema {
  const properties: Record<string, Schema> = {};
  for (const id of botIds) {
    properties[id] = BOT_SCHEMA_MAP[id];
  }
  return {
    type: Type.OBJECT,
    properties,
    required: botIds,
  };
}

// In-memory cache to avoid redundant API calls on repeated topics
const lessonBundleCache = new Map<string, Record<string, unknown>>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow embedding inside Google Sites (sites.google.com / *.googleusercontent.com) iframes
  app.use((req: Request, res: Response, next) => {
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // Endpoint returning the public/shared URL for Google Sites embedding
  app.get('/api/embed-info', (req: Request, res: Response) => {
    const envUrl = (
      process.env.SHARED_APP_URL ||
      process.env.APP_URL ||
      ''
    ).trim();
    const hostHeader = req.get('host') || '';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    const inferredOrigin = hostHeader ? `${protocol}://${hostHeader}` : '';
    const rawUrl = envUrl && envUrl !== 'MY_APP_URL' ? envUrl : inferredOrigin;
    const publicUrl = rawUrl.includes('://ais-dev-')
      ? rawUrl.replace('://ais-dev-', '://ais-pre-')
      : rawUrl;

    res.json({ publicUrl });
  });

  // Unified Endpoint for all 6 AI Bots (or any missing subset of bots)
  app.post('/api/bots/generate-all', async (req: Request, res: Response) => {
    try {
      const goal: GoalPayload = req.body?.goal || {};
      if (!goal.topic || !goal.topic.trim()) {
        res.status(400).json({ error: 'Хичээлийн сэдэв оруулна уу.' });
        return;
      }

      const requestedRaw: unknown = req.body?.botIds;
      const requestedBotIds: ServerBotId[] = Array.isArray(requestedRaw)
        ? (requestedRaw.filter((id): id is ServerBotId =>
            ALL_SERVER_BOT_IDS.includes(id as ServerBotId)
          ) as ServerBotId[])
        : ALL_SERVER_BOT_IDS;

      const targetBotIds =
        requestedBotIds.length > 0 ? requestedBotIds : ALL_SERVER_BOT_IDS;
      const isFullSix = targetBotIds.length === ALL_SERVER_BOT_IDS.length;

      const cacheKey = buildCacheKey(goal);
      const cached = lessonBundleCache.get(cacheKey);
      if (cached && targetBotIds.every((id) => Boolean(cached[id]))) {
        res.json(cached);
        return;
      }

      const context = buildGoalPromptContext(goal);
      const totalMins = Number(goal.durationMinutes) || 40;

      const generateSubset = async (
        subsetIds: ServerBotId[]
      ): Promise<Record<string, unknown>> => {
        const listDesc = subsetIds.map((id) => BOT_PROMPT_LABELS[id]).join('; ');
        const rawText = await generateWithFallback(
          `${context}\n\nДээрх хичээлийн сэдвийн хүрээнд ЕБС-ийн багшид зориулсан дараах ботуудын иж бүрэн материалыг (${listDesc}) яг ${totalMins} минутад тааруулан хооронд нь уялдаа холбоотой, цэвэр Монгол кирилл хэлээр боловсруулж өгнө үү.`,
          {
            systemInstruction:
              'Та бол Монгол улсын ЕБС-ийн багшийн туслах AI-87 системийн ерөнхий зөвлөх юм. Хичээлийн үе шатуудын минутын нийлбэр хичээлийн нийт хугацаатай яг таарна. Сонгох тест бүр 4 хувилбартай (correctIndex: 0..3). Рубрик болон 6 бодлогын онооны нийлбэр тус бүр 100 байна.',
            responseMimeType: 'application/json',
            responseSchema: buildSubsetSchema(subsetIds),
          }
        );
        return JSON.parse(rawText || '{}') as Record<string, unknown>;
      };

      let resultBundle: Record<string, unknown>;
      try {
        resultBundle = await generateSubset(targetBotIds);
      } catch (firstErr) {
        if (targetBotIds.length > 3) {
          const mid = Math.ceil(targetBotIds.length / 2);
          const firstHalf = targetBotIds.slice(0, mid);
          const secondHalf = targetBotIds.slice(mid);
          const partA = await generateSubset(firstHalf);
          const partB = await generateSubset(secondHalf);
          resultBundle = { ...partA, ...partB };
        } else {
          throw firstErr;
        }
      }

      if (isFullSix || cached) {
        const merged = { ...(cached || {}), ...resultBundle };
        if (lessonBundleCache.size > 30) {
          const firstKey = lessonBundleCache.keys().next().value;
          if (firstKey) lessonBundleCache.delete(firstKey);
        }
        lessonBundleCache.set(cacheKey, merged);
      }

      res.json(resultBundle);
    } catch (error: unknown) {
      res
        .status(500)
        .json({ error: formatFriendlyError(error, 'Хичээлийн багц боловсруулахад алдаа гарлаа.') });
    }
  });

  // AI Bot 1: Судалгаа (Research)
  app.post('/api/bots/research', async (req: Request, res: Response) => {
    try {
      const goal: GoalPayload = req.body?.goal || {};
      if (!goal.topic || !goal.topic.trim()) {
        res.status(400).json({ error: 'Хичээлийн сэдэв оруулна уу.' });
        return;
      }

      const context = buildGoalPromptContext(goal);
      const rawText = await generateWithFallback(
        `${context}\n\nДээрх хичээлийн зорилгын хүрээнд багшид зориулсан онол, арга зүйн судалгааг Монгол хэлээр боловсруулж өгнө үү.`,
        {
          systemInstruction:
            'Та бол Багшийн Туслах AI багийн "AI бот 1 — Судалгаа" хариуцсан мэргэжилтэн юм. Сурагчдын нас сэтгэхүйд тохирсон шинжлэх ухаанч, амьдралд ойр жишээтэй судалгааг цэвэр Монгол хэлээр боловсруулна.',
          responseMimeType: 'application/json',
          responseSchema: RESEARCH_SCHEMA,
        }
      );

      res.json(JSON.parse(rawText || '{}'));
    } catch (error: unknown) {
      res.status(500).json({ error: formatFriendlyError(error, 'Судалгааны бот дээр алдаа гарлаа.') });
    }
  });

  // AI Bot 2: Контент (Lesson Plan & Content)
  app.post('/api/bots/content', async (req: Request, res: Response) => {
    try {
      const goal: GoalPayload = req.body?.goal || {};
      if (!goal.topic || !goal.topic.trim()) {
        res.status(400).json({ error: 'Хичээлийн сэдэв оруулна уу.' });
        return;
      }

      const context = buildGoalPromptContext(goal);
      const totalMins = Number(goal.durationMinutes) || 40;
      const rawText = await generateWithFallback(
        `${context}\n\nДээрх сэдвээр яг ${totalMins} минутад багтах ээлжит хичээлийн төлөвлөгөө, пресентацийн слайдын бүтэц, ангид хийх идэвхтэй дасгал ажлыг Монгол хэлээр боловсруулж өгнө үү.`,
        {
          systemInstruction:
            'Та бол Багшийн Туслах AI багийн "AI бот 2 — Контент" хариуцсан мэргэжилтэн юм. Ээлжит хичээлийн үе шат бүрийн минутын нийлбэр хичээлийн нийт хугацаатай яг таарч байх ёстой.',
          responseMimeType: 'application/json',
          responseSchema: CONTENT_SCHEMA,
        }
      );

      res.json(JSON.parse(rawText || '{}'));
    } catch (error: unknown) {
      res.status(500).json({ error: formatFriendlyError(error, 'Контентын бот дээр алдаа гарлаа.') });
    }
  });

  // AI Bot 3: Тайлан (Assessment Rubric & Report)
  app.post('/api/bots/report', async (req: Request, res: Response) => {
    try {
      const goal: GoalPayload = req.body?.goal || {};
      if (!goal.topic || !goal.topic.trim()) {
        res.status(400).json({ error: 'Хичээлийн сэдэв оруулна уу.' });
        return;
      }

      const context = buildGoalPromptContext(goal);
      const rawText = await generateWithFallback(
        `${context}\n\nДээрх хичээлийн суралцахуйн үр дүн, 100 онооны үнэлгээний рубрик хүснэгт, ялгаатай суралцагчдад өгөх дэмжлэг, гэрийн даалгавар болон багшийн тайлангийн дүгнэлтийг Монгол хэлээр боловсруулна уу.`,
        {
          systemInstruction:
            'Та бол Багшийн Туслах AI багийн "AI бот 3 — Тайлан" хариуцсан үнэлгээ, хөтөлбөрийн мэргэжилтэн юм. Рубрикийн онооны нийлбэр 100 байхаар бэлтгэнэ.',
          responseMimeType: 'application/json',
          responseSchema: REPORT_SCHEMA,
        }
      );

      res.json(JSON.parse(rawText || '{}'));
    } catch (error: unknown) {
      res.status(500).json({ error: formatFriendlyError(error, 'Тайлангийн бот дээр алдаа гарлаа.') });
    }
  });

  // AI Bot 4: Хариулт (Quiz, Answer Key & Student Q&A)
  app.post('/api/bots/answers', async (req: Request, res: Response) => {
    try {
      const goal: GoalPayload = req.body?.goal || {};
      if (!goal.topic || !goal.topic.trim()) {
        res.status(400).json({ error: 'Хичээлийн сэдэв оруулна уу.' });
        return;
      }

      const context = buildGoalPromptContext(goal);
      const rawText = await generateWithFallback(
        `${context}\n\nДээрх хичээлээр сурагчдаас авах 5 сонгох тест (зөв хариулт, тайлбартай), 2 задгай асуулт, мөн сурагчдаас ангид ирж болзошгүй 2 сониуч асуулт ба багшийн хариултыг Монгол хэлээр бэлтгэнэ үү.`,
        {
          systemInstruction:
            'Та бол Багшийн Туслах AI багийн "AI бот 4 — Хариулт" хариуцсан мэргэжилтэн юм. Сонгох даалгавар бүр яг 4 хувилбартай (options массив 4 элементтэй), correctIndex нь 0-ээс 3-ын хооронд байна.',
          responseMimeType: 'application/json',
          responseSchema: ANSWERS_SCHEMA,
        }
      );

      res.json(JSON.parse(rawText || '{}'));
    } catch (error: unknown) {
      res.status(500).json({ error: formatFriendlyError(error, 'Хариултын бот дээр алдаа гарлаа.') });
    }
  });

  // AI Bot 5: Боловсруулагч (Complete Tabular Lesson Plan for Download)
  app.post('/api/bots/planner', async (req: Request, res: Response) => {
    try {
      const goal: GoalPayload = req.body?.goal || {};
      if (!goal.topic || !goal.topic.trim()) {
        res.status(400).json({ error: 'Хичээлийн сэдэв оруулна уу.' });
        return;
      }

      const context = buildGoalPromptContext(goal);
      const totalMins = Number(goal.durationMinutes) || 40;
      const rawText = await generateWithFallback(
        `${context}\n\nДээрх сэдвээр ЕБС-ийн стандартад нийцсэн «Ээлжит хичээлийн иж бүрэн төлөвлөлтийн хүснэгт» (5 үе шаттай) болон «Самбар төлөвлөлт»-ийг яг ${totalMins} минутад тааруулан Монгол хэлээр боловсруулна уу.`,
        {
          systemInstruction:
            'Та бол AI-87 багшийн туслах системийн "AI бот 5 — Боловсруулагч" мэргэжилтэн юм. Хичээлийн 5 үе шатны durationMinutes талбаруудын нийлбэр хичээлийн нийт хугацаатай яг тэнцүү байх ёстой.',
          responseMimeType: 'application/json',
          responseSchema: PLANNER_SCHEMA,
        }
      );

      res.json(JSON.parse(rawText || '{}'));
    } catch (error: unknown) {
      res
        .status(500)
        .json({ error: formatFriendlyError(error, 'Боловсруулагч бот дээр алдаа гарлаа.') });
    }
  });

  // AI Bot 6: Бодлого дасгал төлөвлөгч (Tiered Exercises & Step-by-Step Solutions)
  app.post('/api/bots/exercises', async (req: Request, res: Response) => {
    try {
      const goal: GoalPayload = req.body?.goal || {};
      if (!goal.topic || !goal.topic.trim()) {
        res.status(400).json({ error: 'Хичээлийн сэдэв оруулна уу.' });
        return;
      }

      const context = buildGoalPromptContext(goal);
      const rawText = await generateWithFallback(
        `${context}\n\nДээрх хичээлийн сэдвээр сурагчдын түвшинд тохирсон 3 шатлалтай (А-1, А-2 суурь; Б-1, Б-2 хэрэглээ; В-1, В-2 ахисан — нийт 6 даалгавар, нийлбэр 100 оноо) бодлого дасгал, дөхүүлэх санамж ба алхамчилсан бодолтыг Монгол хэлээр боловсруулж өгнө үү.`,
        {
          systemInstruction:
            'Та бол AI-87 багшийн туслах системийн "AI бот 6 — Бодлого дасгал төлөвлөгч" мэргэжилтэн юм. Тухайн хичээлийн онцлогт нийцсэн 6 даалгаврыг онооны нийлбэр нь 100 байхаар алхамчилсан бодолттой бэлтгэнэ.',
          responseMimeType: 'application/json',
          responseSchema: EXERCISES_SCHEMA,
        }
      );

      res.json(JSON.parse(rawText || '{}'));
    } catch (error: unknown) {
      res
        .status(500)
        .json({ error: formatFriendlyError(error, 'Бодлого дасгалын бот дээр алдаа гарлаа.') });
    }
  });

  // AI Student Worksheet Generator grounded in Lesson Plan
  app.post('/api/bots/worksheet', async (req: Request, res: Response) => {
    try {
      const goal: GoalPayload = req.body?.goal || {};
      const variantLabel: string = (req.body?.variantLabel || 'А хувилбар').trim();
      const planSummary: string = (req.body?.planSummary || '').trim();

      if (!goal.topic || !goal.topic.trim()) {
        res.status(400).json({ error: 'Хичээлийн сэдэв оруулна уу.' });
        return;
      }

      const context = buildGoalPromptContext(goal);
      const planContext = planSummary
        ? `\nЭэлжит хичээлийн төлөвлөлтийн гол үе шатууд ба зорилт:\n${planSummary}`
        : '';

      const rawText = await generateWithFallback(
        `${context}${planContext}\n\nДээрх ээлжит хичээлийн төлөвлөгөөн дээр үндэслэн сурагчдад ангид тарааж ажиллуулах хэвлэмэл «Даалгаврын хуудас (${variantLabel})» зохиож өгнө үү. Үүнд: 4 ухагдахуун харгалзуулах даалгавар, цэгийн оронд нөхөж бичих 4 өгүүлбэр (өгүүлбэр дотор нөхөх үгийн оронд "................" гэж бичнэ), хичээлийн үе шаттай уялдсан сурагчийн гүйцэтгэх 3 бүтээлч/задлан шинжлэх даалгавар багтана.`,
        {
          systemInstruction:
            'Та бол ЕБС-ийн багшийн туслах AI-87 системийн сурагчийн ажлын хуудас (Student Worksheet) боловсруулагч мэргэжилтэн юм. Даалгаврууд нь сурагчийн нас сэтгэхүйд тохирсон, хэвлэмэл цаасан дээр ажиллахад ойлгомжтой, цэвэр Монгол кирилл хэлээр байна.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              variantLabel: { type: Type.STRING },
              studentInstructions: { type: Type.STRING },
              matchingPairs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    definition: { type: Type.STRING },
                  },
                  required: ['term', 'definition'],
                },
              },
              fillBlanks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sentenceWithBlank: { type: Type.STRING },
                    missingWord: { type: Type.STRING },
                  },
                  required: ['sentenceWithBlank', 'missingWord'],
                },
              },
              guidedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stageTitle: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                    expectedAnswer: { type: Type.STRING },
                  },
                  required: ['stageTitle', 'prompt', 'expectedAnswer'],
                },
              },
            },
            required: [
              'title',
              'variantLabel',
              'studentInstructions',
              'matchingPairs',
              'fillBlanks',
              'guidedTasks',
            ],
          },
        }
      );

      res.json(JSON.parse(rawText || '{}'));
    } catch (error: unknown) {
      res
        .status(500)
        .json({ error: formatFriendlyError(error, 'Даалгаврын хуудас үүсгэхэд алдаа гарлаа.') });
    }
  });

  // AI ZipGrade-style Optical Answer Sheet Scanner (Multimodal Vision)
  app.post('/api/autograde/scan-sheet', async (req: Request, res: Response) => {
    try {
      const imageBase64: string = req.body?.imageBase64 || '';
      const mimeType: string = req.body?.mimeType || 'image/jpeg';
      const questionCount: number = Number(req.body?.questionCount) || 5;

      if (!imageBase64) {
        res.status(400).json({ error: 'Шалгах тестийн хуудасны зураг оруулна уу.' });
        return;
      }

      const rawText = await generateWithFallback(
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
            {
              text: `Энэхүү зураг дээрх сурагчийн тестийн хариултын хуудсыг уншина уу. Нийт ${questionCount} асуулттай (1-ээс ${questionCount} хүртэл). Сонголтууд нь А (A/1 -> 0), Б (B/2 -> 1), В (C/3 -> 2), Г (D/4 -> 3). Дугуйлаагүй бол -1 буцаана уу.`,
            },
          ],
        },
        {
          systemInstruction:
            'Та бол ZipGrade оптик уншигчтай төстэй тестийн хуудас танигч AI юм. Будсан дугуй эсвэл үсгийг 0=А/A, 1=Б/B, 2=В/C, 3=Г/D индекс рүү хөрвүүлж буцаана.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              studentName: { type: Type.STRING },
              studentCode: { type: Type.STRING },
              selectedIndices: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              scanNote: { type: Type.STRING },
            },
            required: ['studentName', 'studentCode', 'selectedIndices', 'scanNote'],
          },
        }
      );

      res.json(JSON.parse(rawText || '{}'));
    } catch (error: unknown) {
      res.status(500).json({ error: formatFriendlyError(error, 'Зураг унших явцад алдаа гарлаа.') });
    }
  });

  // Teacher Follow-up Assistant Chat
  app.post('/api/bots/chat', async (req: Request, res: Response) => {
    try {
      const goal: GoalPayload = req.body?.goal || {};
      const messageText: string = (req.body?.message || '').trim();
      const history: Array<{ role: string; content: string }> = Array.isArray(req.body?.history)
        ? req.body.history
        : [];

      if (!messageText) {
        res.status(400).json({ error: 'Асуултаа оруулна уу.' });
        return;
      }

      const context = buildGoalPromptContext(goal);
      const formattedHistory = history
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'Багш' : 'Туслах AI'}: ${m.content}`)
        .join('\n\n');

      const prompt = `${context}\n\n${
        formattedHistory ? `Өмнөх яриа:\n${formattedHistory}\n\n` : ''
      }Багшийн шинэ хүсэлт: ${messageText}\n\nТодорхой, цэгцтэй, ангид шууд хэрэгжүүлэхүйц байдлаар Монгол хэлээр хариулна уу.`;

      const replyText = await generateWithFallback(prompt, {
        systemInstruction:
          'Та бол Монгол багшийн ухаалаг туслах AI зөвлөх юм. Багшийн асуусан нэмэлт дасгал, тоглоомын аргачлал, эцэг эхэд илгээх зурвас, үнэлгээний зөвлөмжийг цэвэр Монгол хэлээр тодорхой бичнэ.',
      });

      res.json({ reply: replyText || 'Хариулт боловсруулж чадсангүй.' });
    } catch (error: unknown) {
      res.status(500).json({ error: formatFriendlyError(error, 'Туслах чат дээр алдаа гарлаа.') });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
