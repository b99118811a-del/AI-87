import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Code2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  ScanLine,
  Send,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  ActiveViewTab,
  BotId,
  BotProgressState,
  ChatMessage,
  GradedStudentRecord,
  LessonGoal,
  LessonOutputs,
  SavedLesson,
} from '../types';
import {
  downloadBubbleSheetWord,
  downloadExercisesWorksheetWord,
  downloadLessonPlanExcelCsv,
  downloadLessonPlanWord,
} from '../utils/exportLessonPlan';
import { resolveStudentStageScores } from './AchievementCharts';
import { BOT_THEMES, BotCustomIcon, BotHubDiagram } from './BotHubDiagram';
import { GoalComposer } from './GoalComposer';
import { MyLessonsArchive } from './MyLessonsArchive';

interface UnifiedDashboardProps {
  activeGoal: LessonGoal;
  draftGoal: LessonGoal;
  onChangeDraft: (updated: LessonGoal) => void;
  onRunAllBots: (goalToRun?: LessonGoal) => void;
  isAnyBotWorking: boolean;
  topicInputRef: React.RefObject<HTMLInputElement | null>;
  savedLessons: SavedLesson[];
  activeLessonId: string;
  onSelectSavedLesson: (lesson: SavedLesson) => void;
  outputs: LessonOutputs;
  botStates: Record<BotId, BotProgressState>;
  selectedTab: ActiveViewTab;
  onSelectTab: (tab: ActiveViewTab) => void;
  onRetryBot: (botId: BotId) => void;
  gradedStudents: GradedStudentRecord[];
  gradebookByLesson: Record<string, GradedStudentRecord[]>;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => Promise<void>;
  isChatLoading: boolean;
  onPrint: () => void;
  onPrintLessons: (lessons: SavedLesson[]) => void;
  onSaveCurrentToArchive: (classGroup: string, teacherNote: string) => void;
  onDeleteArchivedLesson: (lessonId: string) => void;
  onOpenEmbedModal: () => void;
  onOpenWorksheetModal: () => void;
}

const TIMELINE_SEGMENT_COLORS = [
  '#0EA5E9',
  '#8B5CF6',
  '#F59E0B',
  '#10B981',
  '#F97316',
];

const QUICK_CHAT_PROMPTS = [
  'Хичээлийн эхэнд хийх 5 минутын сэдэлжүүлэх тоглоом санал болгооч',
  'Эцэг эхчүүдэд илгээх хичээлийн товч мэдээлэл бэлтгэж өгнө үү',
  'Дэмжлэг хэрэгтэй сурагчид өгөх хялбаршуулсан 3 дасгал нэмье',
];

const LETTERS = ['А', 'Б', 'В', 'Г'];

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  activeGoal,
  draftGoal,
  onChangeDraft,
  onRunAllBots,
  isAnyBotWorking,
  topicInputRef,
  savedLessons,
  activeLessonId,
  onSelectSavedLesson,
  outputs,
  botStates,
  selectedTab,
  onSelectTab,
  onRetryBot,
  gradedStudents,
  gradebookByLesson,
  chatMessages,
  onSendChat,
  isChatLoading,
  onPrint,
  onPrintLessons,
  onSaveCurrentToArchive,
  onDeleteArchivedLesson,
  onOpenEmbedModal,
  onOpenWorksheetModal,
}) => {
  const [chatInput, setChatInput] = useState<string>('');

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isChatLoading) return;
    setChatInput('');
    await onSendChat(trimmed);
  };

  const classSnapshot = useMemo(() => {
    if (gradedStudents.length === 0) {
      return {
        avgFinal: 0,
        avgDelta: 0,
        qualityPct: 0,
        chartData: [
          { stage: '1. Гараа', score: 0 },
          { stage: '2. Ойлголт', score: 0 },
          { stage: '3. Явц', score: 0 },
          { stage: '4. Төгсгөл', score: 0 },
        ],
      };
    }

    const stagesList = gradedStudents.map((s) => resolveStudentStageScores(s));
    const n = stagesList.length;
    const avgPre = Math.round(stagesList.reduce((a, b) => a + b.pre, 0) / n);
    const avgConcept = Math.round(
      stagesList.reduce((a, b) => a + b.concept, 0) / n
    );
    const avgMid = Math.round(stagesList.reduce((a, b) => a + b.mid, 0) / n);
    const avgFinal = Math.round(stagesList.reduce((a, b) => a + b.final, 0) / n);
    const excCount = gradedStudents.filter(
      (s) => s.rubricLevel === 'Маш сайн'
    ).length;

    return {
      avgFinal,
      avgDelta: avgFinal - avgPre,
      qualityPct: Math.round((excCount / n) * 100),
      chartData: [
        { stage: '1. Гарааны', score: avgPre },
        { stage: '2. Ойлголт', score: avgConcept },
        { stage: '3. Явцын', score: avgMid },
        { stage: '4. Төгсгөлийн', score: avgFinal },
      ],
    };
  }, [gradedStudents]);

  const stagesTimeline = outputs.planner?.stagesTable || [];
  const totalTimelineMins = Math.max(
    1,
    stagesTimeline.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) ||
      activeGoal.durationMinutes
  );

  const conceptsCount = outputs.research?.keyConcepts.length || 0;
  const factsCount = outputs.research?.engagingFacts.length || 0;
  const slidesCount = outputs.content?.slideOutline.length || 0;
  const problemsCount = outputs.exercises?.problems.length || 0;
  const quizCount = outputs.answers?.multipleChoiceQuiz.length || 0;

  const renderEmptyBotCardBody = (botId: BotId, loadingLabel: string) => {
    const st = botStates[botId];
    if (st.status === 'working') {
      return (
        <div className="py-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{loadingLabel}</span>
            <span className="font-mono tabular-nums">{Math.round(st.progress)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              style={{
                transform: `scaleX(${Math.max(0.1, st.progress / 100)})`,
                backgroundColor: BOT_THEMES[botId].accentHex,
              }}
              className="h-full w-full origin-left transition-transform duration-200"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="py-2 space-y-2.5">
        <p className="text-xs text-slate-500">
          Энэ ботын агуулга хараахан бэлэн болоогүй байна.
        </p>
        <button
          type="button"
          onClick={() => onRetryBot(botId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Одоо үүсгэх</span>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-7">
      {/* ROW 1: Asymmetric 2-Column Hero Split (Network Stage + Goal Composer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          <BotHubDiagram
            goal={activeGoal}
            botStates={botStates}
            selectedTab={selectedTab}
            onSelectTab={onSelectTab}
            onFocusGoalInput={() => topicInputRef.current?.focus()}
            canDownloadPlan={Boolean(outputs.planner)}
            onQuickDownloadWord={() => {
              if (outputs.planner) {
                downloadLessonPlanWord(activeGoal, outputs.planner, outputs, true);
              }
            }}
            canDownloadWorksheet={Boolean(outputs.exercises)}
            onQuickDownloadWorksheet={() => {
              if (outputs.exercises) {
                downloadExercisesWorksheetWord(
                  activeGoal,
                  outputs.exercises,
                  false
                );
              }
            }}
            onOpenWorksheetModal={onOpenWorksheetModal}
          />
        </div>

        <div className="lg:col-span-5">
          <GoalComposer
            draftGoal={draftGoal}
            onChangeDraft={onChangeDraft}
            onRunAllBots={onRunAllBots}
            isRunning={isAnyBotWorking}
            topicInputRef={topicInputRef}
            savedLessons={savedLessons}
            activeLessonId={activeLessonId}
            onSelectSavedLesson={onSelectSavedLesson}
          />
        </div>
      </div>

      {/* ROW 2: Full-Width 4-Tile Colorful KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onSelectTab('research')}
          className="text-left rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white p-5 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="text-xs font-semibold text-sky-100">
            Онол ба Судалгаа
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-3xl font-extrabold">
            {conceptsCount} ойлголт
          </div>
          <div className="mt-2 text-xs text-sky-100 flex items-center justify-between">
            <span className="tabular-nums">{factsCount} сонирхолтой баримт</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('content')}
          className="text-left rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white p-5 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="text-xs font-semibold text-amber-100">
            Пресентаци ба Хичээл
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-3xl font-extrabold">
            {slidesCount} слайд
          </div>
          <div className="mt-2 text-xs text-amber-100 flex items-center justify-between">
            <span className="tabular-nums">{activeGoal.durationMinutes} минутын бүтэц</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('exercises')}
          className="text-left rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white p-5 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="text-xs font-semibold text-teal-100">
            Шаталсан бодлого ба Сорил
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-3xl font-extrabold">
            {problemsCount} бодлого
          </div>
          <div className="mt-2 text-xs text-teal-100 flex items-center justify-between">
            <span className="tabular-nums">А, Б, В түвшин · {quizCount} тест</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('zipgrade')}
          className="text-left rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-5 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="text-xs font-semibold text-indigo-100">
            ZipGrade Ангийн Амжилт
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-3xl font-extrabold">
            {classSnapshot.avgFinal}%
          </div>
          <div className="mt-2 text-xs text-indigo-100 flex items-center justify-between">
            <span className="tabular-nums">
              Ахиц {classSnapshot.avgDelta >= 0 ? '+' : ''}
              {classSnapshot.avgDelta}% · {gradedStudents.length} сурагч
            </span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </button>
      </div>

      {/* ROW 3: Interactive Proportional Lesson Time Ribbon */}
      {stagesTimeline.length > 0 && (
        <section className="rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3.5">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                Ээлжит хичээлийн цагийн хуваарьлалт ({activeGoal.durationMinutes} минут)
              </h3>
              <p className="text-xs text-slate-500">
                Боловсруулагч ботын төлөвлөсөн үе шат бүрийн хугацааны харьцаа
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('planner')}
              className="text-xs font-bold text-[#EA580C] hover:text-[#C2410C] underline underline-offset-4 cursor-pointer whitespace-nowrap"
            >
              Дэлгэрэнгүй хүснэгт харах
            </button>
          </div>

          {/* Colorful Multi-Segment Bar */}
          <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden flex gap-0.5">
            {stagesTimeline.map((stage, idx) => {
              const widthPct = Math.max(
                8,
                Math.round((stage.durationMinutes / totalTimelineMins) * 100)
              );
              return (
                <div
                  key={stage.stageName}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor:
                      TIMELINE_SEGMENT_COLORS[idx % TIMELINE_SEGMENT_COLORS.length],
                  }}
                  title={`${stage.stageName}: ${stage.durationMinutes} мин`}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                />
              );
            })}
          </div>

          <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {stagesTimeline.map((stage, idx) => (
              <div key={stage.stageName} className="min-w-0">
                <div className="font-bold text-slate-800 truncate">
                  <span
                    style={{
                      color:
                        TIMELINE_SEGMENT_COLORS[idx % TIMELINE_SEGMENT_COLORS.length],
                    }}
                    className="mr-1.5"
                  >
                    ■
                  </span>
                  {stage.stageName}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                  {stage.durationMinutes} минут
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ROW 4: Colorful 3-Column Bento Grid of the 6 AI Bots */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              6 AI ботын бэлтгэсэн багц материалууд
            </h2>
            <p className="text-xs text-slate-500">
              Карт бүр дээр дарж дэлгэрэнгүй агуулгыг үзэх эсвэл Word/Excel файлаар шууд татаж авна уу
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenWorksheetModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-xs font-bold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Даалгаврын хуудас</span>
            </button>

            <a
              href="#my-lessons-archive"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 border border-orange-200 hover:bg-orange-100 text-xs font-bold text-orange-950 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Archive className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Миний хичээлүүд ({savedLessons.length})</span>
            </a>

            <button
              type="button"
              onClick={onOpenEmbedModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 border border-sky-200 hover:bg-sky-100 text-xs font-bold text-sky-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Code2 className="w-3.5 h-3.5 text-sky-700" />
              <span>Google Sites руу оруулах</span>
            </button>

            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Хөтөлбөр хэвлэх / PDF</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Судалгаа (Sky) */}
          <div className="rounded-2xl bg-white border border-sky-200/80 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div
                style={{ backgroundColor: BOT_THEMES.research.softBg }}
                className="px-5 py-4 border-b border-sky-100 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: BOT_THEMES.research.iconBg }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <BotCustomIcon id="research" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-sky-700">
                      AI бот 1 · Онол ба Судалгаа
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 truncate">
                      Судалгаа ба Зүйрлэл
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRetryBot('research')}
                  title="Шинэчлэх"
                  className="p-1.5 rounded-lg hover:bg-sky-100 text-sky-700 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      botStates.research.status === 'working' ? 'animate-spin' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="p-5 space-y-3">
                {outputs.research ? (
                  <>
                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {outputs.research.summary}
                    </p>
                    <div className="pt-2 border-t border-slate-100 text-xs text-slate-700 space-y-1">
                      {outputs.research.keyConcepts.slice(0, 3).map((c, idx) => (
                        <div key={c.term} className="truncate">
                          <span className="font-mono font-bold text-sky-600 mr-1.5">
                            0{idx + 1}.
                          </span>
                          <span className="font-semibold">{c.term}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  renderEmptyBotCardBody(
                    'research',
                    'Сэдвийн онол, зүйрлэл боловсруулж байна...'
                  )
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {conceptsCount} ухагдахуун
              </span>
              <button
                type="button"
                onClick={() => onSelectTab('research')}
                className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:text-sky-900 cursor-pointer whitespace-nowrap"
              >
                <span>Дэлгэрэнгүй</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: Контент (Amber) */}
          <div className="rounded-2xl bg-white border border-amber-200/80 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div
                style={{ backgroundColor: BOT_THEMES.content.softBg }}
                className="px-5 py-4 border-b border-amber-100 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: BOT_THEMES.content.iconBg }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <BotCustomIcon id="content" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-amber-700">
                      AI бот 2 · Слайд ба Дадлага
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 truncate">
                      Хичээлийн Контент
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRetryBot('content')}
                  title="Шинэчлэх"
                  className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      botStates.content.status === 'working' ? 'animate-spin' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="p-5 space-y-3">
                {outputs.content ? (
                  <>
                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {outputs.content.lessonObjective}
                    </p>
                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-700">
                      {outputs.content.slideOutline.slice(0, 3).map((sl) => (
                        <div key={sl.slideNumber} className="truncate">
                          <span className="font-mono font-bold text-amber-600 mr-1.5">
                            #{sl.slideNumber}
                          </span>
                          <span>{sl.title}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  renderEmptyBotCardBody(
                    'content',
                    'Пресентацийн слайд бэлтгэж байна...'
                  )
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {slidesCount} слайд · Багийн ажил
              </span>
              <button
                type="button"
                onClick={() => onSelectTab('content')}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 cursor-pointer whitespace-nowrap"
              >
                <span>Слайд үзэх</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: Тайлан & Рубрик (Emerald) */}
          <div className="rounded-2xl bg-white border border-emerald-200/80 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div
                style={{ backgroundColor: BOT_THEMES.report.softBg }}
                className="px-5 py-4 border-b border-emerald-100 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: BOT_THEMES.report.iconBg }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <BotCustomIcon id="report" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-emerald-700">
                      AI бот 3 · Шалгуур ба Гэрийн даалгавар
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 truncate">
                      Тайлан ба Рубрик
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRetryBot('report')}
                  title="Шинэчлэх"
                  className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      botStates.report.status === 'working' ? 'animate-spin' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="p-5 space-y-3">
                {outputs.report ? (
                  <>
                    <div className="space-y-1.5 text-xs">
                      {outputs.report.rubric.slice(0, 3).map((r) => (
                        <div
                          key={r.criterion}
                          className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-b-0"
                        >
                          <span className="font-semibold text-slate-800 truncate">
                            {r.criterion}
                          </span>
                          <span className="font-mono tabular-nums font-bold text-emerald-700 shrink-0">
                            {r.maxScore} оноо
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      Гэрийн даалгавар: {outputs.report.homeworkAssignment.task}
                    </p>
                  </>
                ) : (
                  renderEmptyBotCardBody(
                    'report',
                    'Үнэлгээний рубрик боловсруулж байна...'
                  )
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {outputs.report?.rubric.length || 0} шалгуурт рубрик
              </span>
              <button
                type="button"
                onClick={() => onSelectTab('report')}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer whitespace-nowrap"
              >
                <span>Рубрик үзэх</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 4: Хариулт & Сорил (Indigo) */}
          <div className="rounded-2xl bg-white border border-indigo-200/80 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div
                style={{ backgroundColor: BOT_THEMES.answers.softBg }}
                className="px-5 py-4 border-b border-indigo-100 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: BOT_THEMES.answers.iconBg }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <BotCustomIcon id="answers" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-indigo-700">
                      AI бот 4 · Тест ба Түлхүүр
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 truncate">
                      Сорил ба Хариулт
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRetryBot('answers')}
                  title="Шинэчлэх"
                  className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      botStates.answers.status === 'working' ? 'animate-spin' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="p-5 space-y-3">
                {outputs.answers ? (
                  <>
                    <div className="text-xs font-semibold text-slate-700">
                      Тестийн зөв хариултын түлхүүр:
                    </div>
                    <div className="font-mono tabular-nums text-xs font-bold text-indigo-700 bg-indigo-50/70 px-3 py-2 rounded-lg">
                      {outputs.answers.multipleChoiceQuiz
                        .map(
                          (q) =>
                            `${q.questionNumber}-${LETTERS[q.correctIndex] || 'А'}`
                        )
                        .join(' · ')}
                    </div>
                    <p className="text-xs text-slate-500">
                      Нээлттэй асуулт: {outputs.answers.openQuestions.length} · Сурагчийн түгээмэл асуулт:{' '}
                      {outputs.answers.anticipatedStudentQuestions.length}
                    </p>
                  </>
                ) : (
                  renderEmptyBotCardBody(
                    'answers',
                    'Сорилын асуулт ба түлхүүр үүсгэж байна...'
                  )
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {quizCount} сонгох тест
              </span>
              <button
                type="button"
                onClick={() => onSelectTab('answers')}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer whitespace-nowrap"
              >
                <span>Тест ажиллах</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 5: Боловсруулагч (Coral Orange) */}
          <div className="rounded-2xl bg-white border border-orange-200/80 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div
                style={{ backgroundColor: BOT_THEMES.planner.softBg }}
                className="px-5 py-4 border-b border-orange-100 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: BOT_THEMES.planner.iconBg }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <BotCustomIcon id="planner" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-orange-700">
                      AI бот 5 · Хүснэгтэн хөтөлбөр
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 truncate">
                      Боловсруулагч
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRetryBot('planner')}
                  title="Шинэчлэх"
                  className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-700 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      botStates.planner.status === 'working' ? 'animate-spin' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="p-5 space-y-3">
                {outputs.planner ? (
                  <>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {outputs.planner.overview.curriculumObjective}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={onOpenWorksheetModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Даалгаврын хуудас</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadLessonPlanWord(
                            activeGoal,
                            outputs.planner!,
                            outputs,
                            true
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Word (.doc)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadLessonPlanExcelCsv(activeGoal, outputs.planner!)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Excel (.csv)</span>
                      </button>
                    </div>
                  </>
                ) : (
                  renderEmptyBotCardBody(
                    'planner',
                    'Ээлжит хичээлийн хүснэгт бэлтгэж байна...'
                  )
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {stagesTimeline.length} үе шат · Самбар төлөвлөлт
              </span>
              <button
                type="button"
                onClick={() => onSelectTab('planner')}
                className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 hover:text-orange-900 cursor-pointer whitespace-nowrap"
              >
                <span>Хүснэгт нээх</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 6: Бодлого дасгал (Teal) */}
          <div className="rounded-2xl bg-white border border-teal-200/80 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div
                style={{ backgroundColor: BOT_THEMES.exercises.softBg }}
                className="px-5 py-4 border-b border-teal-100 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{ backgroundColor: BOT_THEMES.exercises.iconBg }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  >
                    <BotCustomIcon id="exercises" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-teal-700">
                      AI бот 6 · А, Б, В түвшний даалгавар
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 truncate">
                      Бодлого дасгал
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRetryBot('exercises')}
                  title="Шинэчлэх"
                  className="p-1.5 rounded-lg hover:bg-teal-100 text-teal-700 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      botStates.exercises.status === 'working' ? 'animate-spin' : ''
                    }`}
                  />
                </button>
              </div>

              <div className="p-5 space-y-3">
                {outputs.exercises ? (
                  <>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {outputs.exercises.worksheetTitle}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={onOpenWorksheetModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Даалгаврын хуудас</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadExercisesWorksheetWord(
                            activeGoal,
                            outputs.exercises!,
                            false
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-900 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Word (.doc)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadExercisesWorksheetWord(
                            activeGoal,
                            outputs.exercises!,
                            true
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>Түлхүүр (.doc)</span>
                      </button>
                    </div>
                  </>
                ) : (
                  renderEmptyBotCardBody(
                    'exercises',
                    'Шаталсан бодлого дасгал боловсруулж байна...'
                  )
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {problemsCount} бодлого · 100 оноо
              </span>
              <button
                type="button"
                onClick={() => onSelectTab('exercises')}
                className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer whitespace-nowrap"
              >
                <span>Бодлого үзэх</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ROW 5: Live Student Progress Mini-Chart + Teacher Advisor Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: ZipGrade & Student Progress Live Visual */}
        <section className="lg:col-span-7 rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs font-bold text-indigo-600">
                  ZipGrade Автомат Засагч · Хичээлийн явцын өөрчлөлт
                </div>
                <h3 className="mt-0.5 text-lg font-extrabold text-slate-900">
                  Сурагчдын ахиц дэвшлийн чиг хандлага
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {outputs.answers &&
                  outputs.answers.multipleChoiceQuiz.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadBubbleSheetWord(
                          activeGoal,
                          outputs.answers!.multipleChoiceQuiz,
                          {}
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Хариултын хуудас (.doc)</span>
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => onSelectTab('zipgrade')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>ZipGrade Засагч нээх</span>
                </button>
              </div>
            </div>

            <div className="mt-4 h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={classSnapshot.chartData}
                  margin={{ top: 10, right: 16, left: -14, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="overviewProgressFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="stage"
                    tick={{ fill: '#475569', fontSize: 11 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: '#64748B', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'Ангийн дундаж']}
                    contentStyle={{
                      borderRadius: '12px',
                      borderColor: '#E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#4F46E5"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#overviewProgressFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 tabular-nums">
            <span>
              Бүртгэгдсэн: <strong className="text-slate-900">{gradedStudents.length} сурагч</strong>
            </span>
            <span>
              Сургалтын чанар (≥80%):{' '}
              <strong className="text-emerald-700">{classSnapshot.qualityPct}%</strong>
            </span>
            <span>
              Дундаж өсөлт:{' '}
              <strong className="text-indigo-700">
                {classSnapshot.avgDelta >= 0 ? '+' : ''}
                {classSnapshot.avgDelta}%
              </strong>
            </span>
          </div>
        </section>

        {/* Right: AI-87 Teacher Advisor Chat */}
        <section className="lg:col-span-5 rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100">
              <div className="text-xs font-bold text-[#EA580C]">
                Шууд ярилцах туслах · Нэмэлт санаа ба материал
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-slate-900">
                AI-87 Багшийн зөвлөх
              </h3>
            </div>

            <div className="flex flex-wrap gap-2 my-3.5">
              {QUICK_CHAT_PROMPTS.map((qPrompt) => (
                <button
                  key={qPrompt}
                  type="button"
                  disabled={isChatLoading}
                  onClick={() => onSendChat(qPrompt)}
                  className="text-left px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-orange-50 hover:text-orange-900 border border-slate-200 text-xs text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {qPrompt}
                </button>
              ))}
            </div>

            {chatMessages.length > 0 && (
              <div className="mb-3.5 max-h-48 overflow-y-auto space-y-2.5 pr-1 border-y border-slate-100 py-3">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-orange-50 text-slate-900 ml-6'
                        : 'bg-slate-50 text-slate-800 mr-4'
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-slate-500 mb-0.5">
                      {msg.role === 'user' ? 'Багш' : 'AI-87 Зөвлөх'} · {msg.timestamp}
                    </div>
                    <div>{msg.content}</div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="rounded-xl px-3.5 py-2.5 text-xs bg-slate-50 text-slate-500">
                    Хариулт боловсруулж байна...
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleChatSubmit} className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Нэмэлт бодлого, тоглоом, зөвлөгөө асуух..."
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#F97316] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={isChatLoading || !chatInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Илгээх</span>
            </button>
          </form>
        </section>
      </div>

      {/* ROW 6: «Миний хичээлүүд» — Lesson Plan & Results PDF Archive */}
      <MyLessonsArchive
        savedLessons={savedLessons}
        activeLessonId={activeLessonId}
        activeGoal={activeGoal}
        activeOutputs={outputs}
        activeGradedStudents={gradedStudents}
        gradebookByLesson={gradebookByLesson}
        onSelectLesson={onSelectSavedLesson}
        onSaveCurrentToArchive={onSaveCurrentToArchive}
        onDeleteArchivedLesson={onDeleteArchivedLesson}
        onPrintLessons={onPrintLessons}
      />
    </div>
  );
};
