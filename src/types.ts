export type BotId =
  | 'research'
  | 'content'
  | 'report'
  | 'answers'
  | 'planner'
  | 'exercises';

export type ActiveViewTab = BotId | 'overview' | 'zipgrade';

export type BotStatus = 'idle' | 'working' | 'completed' | 'error';

export interface LessonGoal {
  topic: string;
  subject: string;
  grade: string;
  durationMinutes: number;
  focusNote?: string;
}

export interface KeyConcept {
  term: string;
  definition: string;
  classroomAnalogy: string;
}

export interface Misconception {
  misconception: string;
  correction: string;
}

export interface ResearchResult {
  summary: string;
  keyConcepts: KeyConcept[];
  engagingFacts: string[];
  commonMisconceptions: Misconception[];
  crossCurricularLinks: string[];
}

export interface LessonPhase {
  phase: string;
  durationMinutes: number;
  teacherAction: string;
  studentActivity: string;
}

export interface SlideItem {
  slideNumber: number;
  title: string;
  keyPoints: string[];
  visualSuggestion: string;
}

export interface ContentResult {
  lessonObjective: string;
  materialsNeeded: string[];
  timeline: LessonPhase[];
  slideOutline: SlideItem[];
  interactiveActivity: {
    title: string;
    duration: string;
    instructions: string[];
  };
}

export interface LearningOutcome {
  level: string;
  outcome: string;
}

export interface RubricRow {
  criterion: string;
  excellent: string;
  proficient: string;
  developing: string;
  maxScore: number;
}

export interface ReportResult {
  learningOutcomes: LearningOutcome[];
  rubric: RubricRow[];
  differentiation: {
    supportStudents: string;
    advancedStudents: string;
  };
  homeworkAssignment: {
    task: string;
    estimatedMinutes: number;
    deliverable: string;
  };
  teacherReportSummary: string;
}

export interface MultipleChoiceItem {
  questionNumber: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface OpenQuestionItem {
  question: string;
  modelAnswer: string;
  gradingHint: string;
}

export interface StudentQAItem {
  studentQuestion: string;
  teacherResponse: string;
}

export interface AnswersResult {
  multipleChoiceQuiz: MultipleChoiceItem[];
  openQuestions: OpenQuestionItem[];
  anticipatedStudentQuestions: StudentQAItem[];
}

export interface PlannerStageRow {
  stageName: string;
  durationMinutes: number;
  learningObjective: string;
  teacherActivity: string;
  studentActivity: string;
  materials: string;
  assessmentCheck: string;
}

export interface PlannerResult {
  overview: {
    unitName: string;
    curriculumObjective: string;
    keyCompetencies: string;
    priorKnowledge: string;
    methodology: string;
    resources: string;
  };
  stagesTable: PlannerStageRow[];
  boardPlan: {
    leftPanel: string[];
    centerPanel: string[];
    rightPanel: string[];
  };
}

export interface ExerciseProblemItem {
  code: string;
  tier: string;
  points: number;
  rubricCriterion: string;
  problemStatement: string;
  hint: string;
  stepByStepSolution: string;
  finalAnswer: string;
}

export interface ExercisesResult {
  worksheetTitle: string;
  instructions: string;
  problems: ExerciseProblemItem[];
}

export interface GradedStudentRecord {
  id: string;
  studentName: string;
  studentCode: string;
  selectedIndices: number[];
  correctCount: number;
  totalQuestions: number;
  preScorePct?: number;
  midScorePct?: number;
  percentage: number;
  rubricLevel: 'Маш сайн' | 'Хангалттай' | 'Дэмжлэг хэрэгтэй';
  source: 'AI Зураг уншигч' | 'ZipGrade CSV' | 'Шуурхай бөглөлт';
}

export interface BotProgressState {
  status: BotStatus;
  progress: number;
  error?: string;
}

export interface LessonOutputs {
  research: ResearchResult | null;
  content: ContentResult | null;
  report: ReportResult | null;
  answers: AnswersResult | null;
  planner: PlannerResult | null;
  exercises: ExercisesResult | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SavedLesson {
  id: string;
  createdAt: string;
  savedDate?: string;
  classGroup?: string;
  teacherNote?: string;
  goal: LessonGoal;
  outputs: LessonOutputs;
  gradedStudents?: GradedStudentRecord[];
}

export interface WorksheetMatchPair {
  term: string;
  definition: string;
}

export interface WorksheetFillBlankItem {
  sentenceWithBlank: string;
  missingWord: string;
}

export interface WorksheetGuidedTask {
  stageTitle: string;
  prompt: string;
  expectedAnswer: string;
}

export interface StudentWorksheetData {
  title: string;
  variantLabel: string;
  studentInstructions: string;
  matchingPairs: WorksheetMatchPair[];
  fillBlanks: WorksheetFillBlankItem[];
  guidedTasks: WorksheetGuidedTask[];
}
