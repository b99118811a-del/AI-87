import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ScanLine,
  Send,
  Eye,
  EyeOff,
  Printer,
} from 'lucide-react';
import type {
  ActiveViewTab,
  BotId,
  BotProgressState,
  ChatMessage,
  GradedStudentRecord,
  LessonGoal,
  LessonOutputs,
} from '../types';
import {
  downloadExercisesWorksheetWord,
  downloadLessonPlanExcelCsv,
  downloadLessonPlanWord,
} from '../utils/exportLessonPlan';
import { copyTextSafe } from '../utils/clipboard';
import { ZipGradePanel } from './ZipGradePanel';

interface BotOutputPanelProps {
  goal: LessonGoal;
  outputs: LessonOutputs;
  botStates: Record<BotId, BotProgressState>;
  activeTab: ActiveViewTab;
  onChangeTab: (tab: ActiveViewTab) => void;
  onRetryBot: (botId: BotId) => void;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => Promise<void>;
  isChatLoading: boolean;
  onPrint: () => void;
  onOpenWorksheetModal: () => void;
  gradedStudents: GradedStudentRecord[];
  onAddGradedStudents: (records: GradedStudentRecord[]) => void;
  onUpdateGradedStudent: (
    id: string,
    patch: Partial<GradedStudentRecord>
  ) => void;
  onRemoveGradedStudent: (id: string) => void;
  onClearGradedStudents: () => void;
}

const TAB_ITEMS: Array<{ id: ActiveViewTab; label: string; botId?: BotId }> = [
  { id: 'overview', label: 'Нэгдсэн самбар' },
  { id: 'research', label: '1. Судалгаа', botId: 'research' },
  { id: 'content', label: '2. Контент', botId: 'content' },
  { id: 'report', label: '3. Тайлан', botId: 'report' },
  { id: 'answers', label: '4. Хариулт', botId: 'answers' },
  { id: 'planner', label: '5. Боловсруулагч', botId: 'planner' },
  { id: 'exercises', label: '6. Бодлого дасгал', botId: 'exercises' },
  { id: 'zipgrade', label: 'ZipGrade Засагч' },
];

const QUICK_CHAT_PROMPTS = [
  'Хичээлийн эхэнд хийх 5 минутын хөгжилтэй сэдэлжүүлэх тоглоом санал болгооч',
  'Эцэг эхчүүдэд хичээлийн талаар илгээх товч зурвас бэлтгэж өгнө үү',
  'Сул сурлагатай сурагчид зориулсан хялбаршуулсан 3 дасгал нэмье',
];

export const BotOutputPanel: React.FC<BotOutputPanelProps> = ({
  goal,
  outputs,
  botStates,
  activeTab,
  onChangeTab,
  onRetryBot,
  chatMessages,
  onSendChat,
  isChatLoading,
  onPrint,
  onOpenWorksheetModal,
  gradedStudents,
  onAddGradedStudents,
  onUpdateGradedStudent,
  onRemoveGradedStudent,
  onClearGradedStudents,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showQuizAnswers, setShowQuizAnswers] = useState<boolean>(true);
  const [studentSelections, setStudentSelections] = useState<Record<number, number>>({});
  const [chatInput, setChatInput] = useState<string>('');
  const [includeAppendixInWord, setIncludeAppendixInWord] = useState<boolean>(true);

  // Bot 6 (Exercises) interactive state
  const [tierFilter, setTierFilter] = useState<'ALL' | 'А' | 'Б' | 'В'>('ALL');
  const [showExerciseSolutions, setShowExerciseSolutions] = useState<boolean>(true);

  const handleCopyText = async (key: string, text: string) => {
    const ok = await copyTextSafe(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isChatLoading) return;
    setChatInput('');
    await onSendChat(trimmed);
  };

  const renderSkeleton = (label: string, progress: number) => (
    <div className="py-10 space-y-4">
      <div className="flex items-center justify-between text-sm font-semibold text-[#D95D1E]">
        <span>{label} боловсруулж байна...</span>
        <span className="font-mono tabular-nums">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#EFECE6] overflow-hidden">
        <div
          style={{ transform: `scaleX(${Math.max(0.1, progress / 100)})` }}
          className="h-full w-full origin-left bg-[#EB6B26] transition-transform duration-200"
        />
      </div>
      <div className="space-y-3 pt-2">
        <div className="h-4 w-3/4 rounded bg-[#F2EFE9] animate-pulse" />
        <div className="h-4 w-full rounded bg-[#F2EFE9] animate-pulse" />
        <div className="h-4 w-5/6 rounded bg-[#F2EFE9] animate-pulse" />
        <div className="h-28 w-full rounded-xl bg-[#F7F5F0] animate-pulse" />
      </div>
    </div>
  );

  const renderErrorState = (botId: BotId, errorMsg?: string) => {
    const raw = (errorMsg || '').trim();
    const cleanMessage =
      !raw ||
      raw.startsWith('{') ||
      raw.toUpperCase().includes('429') ||
      raw.toUpperCase().includes('QUOTA') ||
      raw.toUpperCase().includes('RESOURCE_EXHAUSTED')
        ? 'Энэ ботын агуулга хараахан үүсээгүй эсвэл серверийн хүсэлтийн хязгаар түр хэтэрсэн байсан тул доорх товчийг дарж шууд үүсгэнэ үү.'
        : raw;

    return (
      <div className="py-10 px-6 rounded-xl bg-amber-50/60 border border-amber-200/80 text-center space-y-3.5 max-w-xl mx-auto">
        <p className="text-sm font-semibold text-slate-800 leading-relaxed">
          {cleanMessage}
        </p>
        <button
          type="button"
          onClick={() => onRetryBot(botId)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#EB6B26] text-white text-xs font-bold hover:bg-[#DC5E1B] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Одоо боловсруулах</span>
        </button>
      </div>
    );
  };

  const renderResearchSection = () => {
    const state = botStates.research;
    const data = outputs.research;
    if (state.status === 'working' && !data) {
      return renderSkeleton('AI бот 1 (Судалгаа)', state.progress);
    }
    if (state.status === 'error' && !data) {
      return renderErrorState('research', state.error);
    }
    if (!data) {
      return renderErrorState('research', 'Судалгааны мэдээлэл одоогоор хоосон байна.');
    }

    const plainTextForCopy = [
      `СЭДВИЙН СУДАЛГАА: ${goal.topic}`,
      data.summary,
      '',
      'ҮНДСЭН ОЙЛГОЛТУУД:',
      ...data.keyConcepts.map(
        (c) => `- ${c.term}: ${c.definition} (Зүйрлэл: ${c.classroomAnalogy})`
      ),
      '',
      'СОНИРХОЛТОЙ БАРИМТУУД:',
      ...data.engagingFacts.map((f, idx) => `${idx + 1}. ${f}`),
    ].join('\n');

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#EFECE6]">
          <div>
            <div className="text-xs font-semibold text-[#78716C]">
              AI бот 1 · Онол ба Арга зүйн судалгаа
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#1C1917]">
              Сэдвийн суурь судалгаа ба жишээнүүд
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyText('research', plainTextForCopy)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedKey === 'research' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#1E9E63]" />
                  <span>Хуулагдлаа</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Хуулах</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={state.status === 'working'}
              onClick={() => onRetryBot('research')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${state.status === 'working' ? 'animate-spin' : ''}`} />
              <span>Шинэчлэх</span>
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-2">Арга зүйн тойм</h4>
          <p className="text-[15px] leading-relaxed text-[#44403C]">{data.summary}</p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-3">
            Эзэмшүүлэх үндсэн ойлголт ба сурагчдад ойлгуулах зүйрлэл
          </h4>
          <div className="divide-y divide-[#EFECE6] border-y border-[#EFECE6]">
            {data.keyConcepts.map((item, idx) => (
              <div key={idx} className="py-4 space-y-1.5">
                <div className="text-sm font-bold text-[#1C1917]">
                  0{idx + 1}. {item.term}
                </div>
                <p className="text-sm text-[#44403C] leading-relaxed">{item.definition}</p>
                <p className="text-xs text-[#9A4212] bg-[#FDF5EF] px-3 py-2 rounded-lg">
                  <span className="font-semibold">Ангид тайлбарлах зүйрлэл:</span>{' '}
                  {item.classroomAnalogy}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-bold text-[#1C1917] mb-3">
              Сонирхол татах баримтууд
            </h4>
            <ol className="space-y-2.5 text-sm text-[#44403C] leading-relaxed">
              {data.engagingFacts.map((fact, idx) => (
                <li key={idx} className="flex gap-2.5">
                  <span className="font-mono tabular-nums font-semibold text-[#D95D1E] shrink-0">
                    0{idx + 1}.
                  </span>
                  <span>{fact}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[#1C1917] mb-3">
              Түгээмэл ташаа ойлголт ба залруулга
            </h4>
            <div className="space-y-3">
              {data.commonMisconceptions.map((m, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-[#FAF8F5] space-y-1.5 text-sm">
                  <p className="font-semibold text-[#991B1B]">
                    Ташаа бодол: {m.misconception}
                  </p>
                  <p className="text-[#166534]">
                    Зөв тайлбар: {m.correction}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-2.5">
            Хичээл хоорондын залгамж холбоо
          </h4>
          <ul className="space-y-1.5 text-sm text-[#44403C]">
            {data.crossCurricularLinks.map((link, idx) => (
              <li key={idx} className="flex items-baseline gap-2">
                <span aria-hidden="true" className="text-[#A8A29E]">—</span>
                <span>{link}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const renderContentSection = () => {
    const state = botStates.content;
    const data = outputs.content;
    if (state.status === 'working' && !data) {
      return renderSkeleton('AI бот 2 (Контент)', state.progress);
    }
    if (state.status === 'error' && !data) {
      return renderErrorState('content', state.error);
    }
    if (!data) {
      return renderErrorState('content', 'Контентын мэдээлэл одоогоор хоосон байна.');
    }

    const plainTextForCopy = [
      `ЭЭЛЖИТ ХИЧЭЭЛИЙН КОНТЕНТ: ${goal.topic}`,
      `Зорилго: ${data.lessonObjective}`,
      '',
      'ХИЧЭЭЛИЙН ҮЕ ШАТ:',
      ...data.timeline.map(
        (t) => `${t.phase} (${t.durationMinutes} мин)\n  Багш: ${t.teacherAction}\n  Сурагч: ${t.studentActivity}`
      ),
      '',
      'СЛАЙДЫН ТӨЛӨВЛӨГӨӨ:',
      ...data.slideOutline.map(
        (s) => `Слайд ${s.slideNumber}: ${s.title} — ${s.keyPoints.join('; ')}`
      ),
    ].join('\n');

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#EFECE6]">
          <div>
            <div className="text-xs font-semibold text-[#78716C]">
              AI бот 2 · Пресентацийн слайд ба Ангийн дасгал
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#1C1917]">
              Хичээлийн контент ({goal.durationMinutes} минут)
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyText('content', plainTextForCopy)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedKey === 'content' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#1E9E63]" />
                  <span>Хуулагдлаа</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Хуулах</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={state.status === 'working'}
              onClick={() => onRetryBot('content')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${state.status === 'working' ? 'animate-spin' : ''}`} />
              <span>Шинэчлэх</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <h4 className="text-sm font-bold text-[#1C1917] mb-2">Хичээлийн зорилго</h4>
            <p className="text-[15px] leading-relaxed text-[#44403C]">
              {data.lessonObjective}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#1C1917] mb-2">Хэрэглэгдэхүүн</h4>
            <ul className="space-y-1.5 text-xs text-[#44403C]">
              {data.materialsNeeded.map((mat, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span aria-hidden="true" className="text-[#D95D1E]">•</span>
                  <span>{mat}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-3">
            Цагийн хуваарилалт ба үйл ажиллагаа
          </h4>
          <div className="overflow-x-auto border border-[#EAE4DC] rounded-xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#EAE4DC] text-xs font-semibold text-[#57534E]">
                  <th className="py-3 px-4">Үе шат</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Хугацаа</th>
                  <th className="py-3 px-4">Багшийн чиглүүлэг</th>
                  <th className="py-3 px-4">Сурагчийн үйл ажиллагаа</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {data.timeline.map((step, idx) => (
                  <tr key={idx} className="hover:bg-[#FCFBF9] align-top">
                    <td className="py-3.5 px-4 font-semibold text-[#1C1917]">
                      {step.phase}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-[#D95D1E] whitespace-nowrap">
                      {step.durationMinutes} мин
                    </td>
                    <td className="py-3.5 px-4 text-[#44403C] leading-relaxed">
                      {step.teacherAction}
                    </td>
                    <td className="py-3.5 px-4 text-[#44403C] leading-relaxed">
                      {step.studentActivity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-3">
            Пресентацийн слайдын бүтэц
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.slideOutline.map((slide) => (
              <div
                key={slide.slideNumber}
                className="p-4 rounded-xl bg-[#FAF8F5] space-y-2"
              >
                <div className="text-xs font-mono tabular-nums font-semibold text-[#78716C]">
                  Слайд {slide.slideNumber}
                </div>
                <div className="text-sm font-bold text-[#1C1917]">{slide.title}</div>
                <ul className="space-y-1 text-xs text-[#44403C]">
                  {slide.keyPoints.map((pt, idx) => (
                    <li key={idx}>— {pt}</li>
                  ))}
                </ul>
                <p className="pt-1 text-[11px] text-[#78716C]">
                  Зураглал: {slide.visualSuggestion}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#FDF5EF] space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-bold text-[#9A3412]">
              Ангийн идэвхтэй дасгал: {data.interactiveActivity.title}
            </h4>
            <span className="text-xs font-mono tabular-nums font-semibold text-[#C2410C] shrink-0">
              {data.interactiveActivity.duration}
            </span>
          </div>
          <ol className="space-y-1.5 text-sm text-[#431407] leading-relaxed">
            {data.interactiveActivity.instructions.map((inst, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="font-mono tabular-nums font-semibold shrink-0">
                  {idx + 1}.
                </span>
                <span>{inst}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  };

  const renderReportSection = () => {
    const state = botStates.report;
    const data = outputs.report;
    if (state.status === 'working' && !data) {
      return renderSkeleton('AI бот 3 (Тайлан)', state.progress);
    }
    if (state.status === 'error' && !data) {
      return renderErrorState('report', state.error);
    }
    if (!data) {
      return renderErrorState('report', 'Тайлангийн мэдээлэл одоогоор хоосон байна.');
    }

    const totalScore = data.rubric.reduce((acc, r) => acc + (Number(r.maxScore) || 0), 0);

    const plainTextForCopy = [
      `ҮНЭЛГЭЭНИЙ РУБРИК БА ТАЙЛАН: ${goal.topic}`,
      '',
      'СУРАЛЦАХУЙН ҮР ДҮН:',
      ...data.learningOutcomes.map((o) => `- [${o.level}] ${o.outcome}`),
      '',
      'БАГШИЙН ТЭМДЭГЛЭЛ ТАЙЛАН:',
      data.teacherReportSummary,
    ].join('\n');

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#EFECE6]">
          <div>
            <div className="text-xs font-semibold text-[#78716C]">
              AI бот 3 · Үнэлгээний шалгуур ба Ээлжит хичээлийн тайлан
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#1C1917]">
              Суралцахуйн үр дүн ба Рубрик
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onChangeTab('zipgrade')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EB6B26] hover:bg-[#DC5E1B] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>Тестийн дүн рубрикээр оруулах</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopyText('report', plainTextForCopy)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedKey === 'report' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#1E9E63]" />
                  <span>Хуулагдлаа</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Хуулах</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={state.status === 'working'}
              onClick={() => onRetryBot('report')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${state.status === 'working' ? 'animate-spin' : ''}`} />
              <span>Шинэчлэх</span>
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-3">
            Блумын таксономийн суралцахуйн үр дүнгүүд
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.learningOutcomes.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-[#FAF8F5]">
                <div className="text-xs font-bold text-[#D95D1E] mb-1">
                  {item.level}
                </div>
                <p className="text-sm text-[#44403C] leading-relaxed">{item.outcome}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-bold text-[#1C1917]">
              Үнэлгээний рубрик хүснэгт
            </h4>
            <span className="text-xs font-mono tabular-nums text-[#57534E]">
              Нийт оноо: {totalScore}
            </span>
          </div>
          <div className="overflow-x-auto border border-[#EAE4DC] rounded-xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#EAE4DC] text-xs font-semibold text-[#57534E]">
                  <th className="py-3 px-3.5">Шалгуур</th>
                  <th className="py-3 px-3.5">Маш сайн</th>
                  <th className="py-3 px-3.5">Хангалттай</th>
                  <th className="py-3 px-3.5">Дэмжлэг хэрэгтэй</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Оноо</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {data.rubric.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#FCFBF9] align-top">
                    <td className="py-3.5 px-3.5 font-semibold text-[#1C1917]">
                      {row.criterion}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#166534] leading-relaxed">
                      {row.excellent}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#44403C] leading-relaxed">
                      {row.proficient}
                    </td>
                    <td className="py-3.5 px-3.5 text-[#78716C] leading-relaxed">
                      {row.developing}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-[#1C1917] whitespace-nowrap">
                      {row.maxScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <h4 className="text-sm font-bold text-[#1C1917]">
              Ялгаатай суралцагчдад ажиллах арга зүй
            </h4>
            <p className="text-sm text-[#44403C] leading-relaxed">
              <span className="font-semibold text-[#1C1917]">Дэмжлэг шаардлагатай сурагчид: </span>
              {data.differentiation.supportStudents}
            </p>
            <p className="text-sm text-[#44403C] leading-relaxed">
              <span className="font-semibold text-[#1C1917]">Ахисан түвшний сурагчид: </span>
              {data.differentiation.advancedStudents}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-[#1C1917]">
              Гэрийн даалгавар ({data.homeworkAssignment.estimatedMinutes} мин)
            </h4>
            <p className="text-sm text-[#44403C] leading-relaxed">
              {data.homeworkAssignment.task}
            </p>
            <p className="text-xs text-[#78716C]">
              Хүлээлгэн өгөх хэлбэр: {data.homeworkAssignment.deliverable}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-[#EFECE6]">
          <h4 className="text-sm font-bold text-[#1C1917] mb-2">
            Цахим журнал / Тайланд бүртгэх хичээлийн дүгнэлт загвар
          </h4>
          <p className="text-sm text-[#44403C] leading-relaxed bg-[#FAF8F5] p-4 rounded-xl">
            {data.teacherReportSummary}
          </p>
        </div>
      </div>
    );
  };

  const renderAnswersSection = () => {
    const state = botStates.answers;
    const data = outputs.answers;
    if (state.status === 'working' && !data) {
      return renderSkeleton('AI бот 4 (Хариулт)', state.progress);
    }
    if (state.status === 'error' && !data) {
      return renderErrorState('answers', state.error);
    }
    if (!data) {
      return renderErrorState('answers', 'Тест, хариултын мэдээлэл одоогоор хоосон байна.');
    }

    const optionLetters = ['А', 'Б', 'В', 'Г', 'Д'];

    const plainTextForCopy = [
      `СОРИЛ БА ХАРИУЛТЫН ТҮЛХҮҮР: ${goal.topic}`,
      '',
      ...data.multipleChoiceQuiz.map(
        (q) =>
          `${q.questionNumber}. ${q.question}\n` +
          q.options.map((opt, idx) => `   ${optionLetters[idx] || idx + 1}) ${opt}`).join('\n') +
          `\n   Зөв хариулт: ${optionLetters[q.correctIndex] || ''} — ${q.explanation}`
      ),
    ].join('\n\n');

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#EFECE6]">
          <div>
            <div className="text-xs font-semibold text-[#78716C]">
              AI бот 4 · Мэдлэг шалгах сорил ба Хариултын түлхүүр
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#1C1917]">
              Сурагчийн тест ба Асуулт хариулт
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onChangeTab('zipgrade')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EB6B26] hover:bg-[#DC5E1B] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>ZipGrade автомат засагч нээх</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQuizAnswers((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#E2DCD2] hover:bg-[#F2EFE9] text-xs font-semibold text-[#1C1917] transition-colors cursor-pointer whitespace-nowrap"
            >
              {showQuizAnswers ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Хариулт нуух</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Түлхүүр харах</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleCopyText('answers', plainTextForCopy)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedKey === 'answers' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#1E9E63]" />
                  <span>Хуулагдлаа</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Тест хуулах</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={state.status === 'working'}
              onClick={() => onRetryBot('answers')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${state.status === 'working' ? 'animate-spin' : ''}`} />
              <span>Шинэчлэх</span>
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {data.multipleChoiceQuiz.map((q) => {
            const selectedIdx = studentSelections[q.questionNumber];
            const hasAnswered = selectedIdx !== undefined;

            return (
              <div key={q.questionNumber} className="pb-5 border-b border-[#F0ECE4] last:border-b-0">
                <p className="text-sm font-bold text-[#1C1917] mb-3">
                  <span className="font-mono tabular-nums mr-1.5">{q.questionNumber}.</span>
                  {q.question}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, idx) => {
                    const isCorrect = idx === q.correctIndex;
                    const isChosen = selectedIdx === idx;

                    let optionStyle =
                      'border-[#E7E2DA] bg-[#FCFBF9] hover:bg-[#F5F2EC] text-[#44403C]';
                    if (showQuizAnswers && isCorrect) {
                      optionStyle =
                        'border-[#22A96B] bg-[#EEFBF3] text-[#14532D] font-semibold';
                    } else if (!showQuizAnswers && hasAnswered) {
                      if (isCorrect) {
                        optionStyle =
                          'border-[#22A96B] bg-[#EEFBF3] text-[#14532D] font-semibold';
                      } else if (isChosen && !isCorrect) {
                        optionStyle =
                          'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setStudentSelections((prev) => ({
                            ...prev,
                            [q.questionNumber]: idx,
                          }))
                        }
                        className={`text-left px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-colors cursor-pointer flex items-baseline gap-2 ${optionStyle}`}
                      >
                        <span className="font-mono font-bold shrink-0">
                          {optionLetters[idx] || idx + 1}.
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {(showQuizAnswers || hasAnswered) && (
                  <p className="mt-2.5 text-xs text-[#166534] bg-[#F3FAF6] px-3 py-2 rounded-lg">
                    <span className="font-bold">
                      Зөв хариулт ({optionLetters[q.correctIndex] || q.correctIndex + 1}):{' '}
                    </span>
                    {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-3">
            Задгай бодох асуулт ба Үлгэрчилсэн хариулт
          </h4>
          <div className="space-y-4">
            {data.openQuestions.map((oq, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#FAF8F5] space-y-2">
                <p className="text-sm font-bold text-[#1C1917]">
                  Асуулт {idx + 1}: {oq.question}
                </p>
                {showQuizAnswers && (
                  <>
                    <p className="text-sm text-[#44403C] leading-relaxed">
                      <span className="font-semibold text-[#1E9E63]">Загвар хариулт: </span>
                      {oq.modelAnswer}
                    </p>
                    <p className="text-xs text-[#78716C]">
                      Дүгнэх зөвлөмж: {oq.gradingHint}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-3">
            Сурагчдаас ирж болзошгүй сониуч асуулт ба Багшийн тайлбар
          </h4>
          <div className="divide-y divide-[#EFECE6] border-y border-[#EFECE6]">
            {data.anticipatedStudentQuestions.map((qa, idx) => (
              <div key={idx} className="py-3.5 space-y-1.5 text-sm">
                <p className="font-semibold text-[#1C1917]">
                  Сурагч: «{qa.studentQuestion}»
                </p>
                <p className="text-[#44403C] leading-relaxed">
                  <span className="font-semibold text-[#D95D1E]">Багшийн хариулт: </span>
                  {qa.teacherResponse}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPlannerSection = () => {
    const state = botStates.planner;
    const data = outputs.planner;

    if (state.status === 'working' && !data) {
      return renderSkeleton('AI бот 5 (Боловсруулагч хүснэгт)', state.progress);
    }
    if (state.status === 'error' && !data) {
      return renderErrorState('planner', state.error);
    }
    if (!data) {
      return (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-[#57534E]">
            Энэ хичээлийн иж бүрэн хүснэгтэн төлөвлөлтийг үүсгэхэд бэлэн байна.
          </p>
          <button
            type="button"
            onClick={() => onRetryBot('planner')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EB6B26] hover:bg-[#DC5E1B] text-white text-sm font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Иж бүрэн төлөвлөлт боловсруулах</span>
          </button>
        </div>
      );
    }

    const totalMinutes = data.stagesTable.reduce(
      (sum, row) => sum + (Number(row.durationMinutes) || 0),
      0
    );

    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#EFECE6]">
          <div>
            <div className="text-xs font-semibold text-[#78716C]">
              AI бот 5 · Боловсруулагч · ЕБС-ийн стандартын хүснэгтэн хөтөлбөр
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#1C1917]">
              Ээлжит хичээлийн иж бүрэн төлөвлөлт
            </h3>
            <label className="mt-2.5 inline-flex items-center gap-2 text-xs text-[#57534E] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAppendixInWord}
                onChange={(e) => setIncludeAppendixInWord(e.target.checked)}
                className="rounded border-[#D6CEC2] text-[#EB6B26] focus:ring-[#EB6B26]"
              />
              <span>Word файлд Бодлого дасгал, Рубрик болон Тестийн түлхүүрийг хамт хавсаргах</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenWorksheetModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>Даалгаврын хуудас үүсгэх</span>
            </button>

            <button
              type="button"
              onClick={() =>
                downloadLessonPlanWord(goal, data, outputs, includeAppendixInWord)
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EB6B26] hover:bg-[#DC5E1B] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Word (.doc) татах</span>
            </button>

            <button
              type="button"
              onClick={() => downloadLessonPlanExcelCsv(goal, data)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D6CEC2] bg-[#FAF8F5] hover:bg-[#F2EDE4] text-[#1C1917] text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
              <span>Excel (.csv) татах</span>
            </button>

            <button
              type="button"
              disabled={state.status === 'working'}
              onClick={() => onRetryBot('planner')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${state.status === 'working' ? 'animate-spin' : ''}`} />
              <span>Шинэчлэх</span>
            </button>
          </div>
        </div>

        {/* Table 1 */}
        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-3">
            1. Хичээлийн ерөнхий мэдээлэл ба сургалтын арга зүй
          </h4>
          <div className="overflow-x-auto border border-[#DED8CE] rounded-xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <tbody className="divide-y divide-[#EAE4DC]">
                <tr>
                  <th className="py-3 px-4 bg-[#FAF8F5] font-semibold text-[#44403C] w-1/4 border-r border-[#EAE4DC]">
                    Судлагдахуун · Анги
                  </th>
                  <td className="py-3 px-4 text-[#1C1917] font-semibold">
                    {goal.subject} · {goal.grade} ({goal.durationMinutes} минут)
                  </td>
                </tr>
                <tr>
                  <th className="py-3 px-4 bg-[#FAF8F5] font-semibold text-[#44403C] border-r border-[#EAE4DC]">
                    Бүлэг сэдэв
                  </th>
                  <td className="py-3 px-4 text-[#44403C]">{data.overview.unitName}</td>
                </tr>
                <tr>
                  <th className="py-3 px-4 bg-[#FAF8F5] font-semibold text-[#44403C] border-r border-[#EAE4DC]">
                    Ээлжит хичээлийн сэдэв
                  </th>
                  <td className="py-3 px-4 font-bold text-[#1C1917]">{goal.topic}</td>
                </tr>
                <tr>
                  <th className="py-3 px-4 bg-[#FAF8F5] font-semibold text-[#44403C] border-r border-[#EAE4DC]">
                    Суралцахуйн зорилт
                  </th>
                  <td className="py-3 px-4 text-[#44403C] leading-relaxed">
                    {data.overview.curriculumObjective}
                  </td>
                </tr>
                <tr>
                  <th className="py-3 px-4 bg-[#FAF8F5] font-semibold text-[#44403C] border-r border-[#EAE4DC]">
                    Хөгжүүлэх чадвар
                  </th>
                  <td className="py-3 px-4 text-[#44403C] leading-relaxed">
                    {data.overview.keyCompetencies}
                  </td>
                </tr>
                <tr>
                  <th className="py-3 px-4 bg-[#FAF8F5] font-semibold text-[#44403C] border-r border-[#EAE4DC]">
                    Өмнөх мэдлэг, төсөөлөл
                  </th>
                  <td className="py-3 px-4 text-[#44403C] leading-relaxed">
                    {data.overview.priorKnowledge}
                  </td>
                </tr>
                <tr>
                  <th className="py-3 px-4 bg-[#FAF8F5] font-semibold text-[#44403C] border-r border-[#EAE4DC]">
                    Сургалтын арга зүй
                  </th>
                  <td className="py-3 px-4 text-[#44403C] leading-relaxed">
                    {data.overview.methodology}
                  </td>
                </tr>
                <tr>
                  <th className="py-3 px-4 bg-[#FAF8F5] font-semibold text-[#44403C] border-r border-[#EAE4DC]">
                    Хэрэглэгдэхүүн ба ТХМ
                  </th>
                  <td className="py-3 px-4 text-[#44403C] leading-relaxed">
                    {data.overview.resources}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2 */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-sm font-bold text-[#1C1917]">
              2. Ээлжит хичээлийн үйл ажиллагааны төлөвлөлтийн хүснэгт
            </h4>
            <span className="text-xs font-mono tabular-nums text-[#57534E]">
              Нийт: {totalMinutes} минут
            </span>
          </div>
          <div className="overflow-x-auto border border-[#DED8CE] rounded-xl">
            <table className="w-full min-w-[760px] text-left border-collapse text-xs sm:text-[13px]">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#DED8CE] text-xs font-bold text-[#44403C]">
                  <th className="py-3 px-3 border-r border-[#EAE4DC] w-[14%]">Хичээлийн үе шат</th>
                  <th className="py-3 px-2.5 border-r border-[#EAE4DC] text-right whitespace-nowrap w-[7%]">
                    Хугацаа
                  </th>
                  <th className="py-3 px-3 border-r border-[#EAE4DC] w-[15%]">Алхмын зорилт</th>
                  <th className="py-3 px-3 border-r border-[#EAE4DC] w-[22%]">
                    Багшийн чиглүүлэх үйл ажиллагаа
                  </th>
                  <th className="py-3 px-3 border-r border-[#EAE4DC] w-[20%]">
                    Сурагчийн үйл ажиллагаа
                  </th>
                  <th className="py-3 px-3 border-r border-[#EAE4DC] w-[11%]">Хэрэглэгдэхүүн</th>
                  <th className="py-3 px-3 w-[11%]">Явцын үнэлгээ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE4DC]">
                {data.stagesTable.map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#FCFBF9] align-top">
                    <td className="py-3.5 px-3 border-r border-[#EFECE6] font-bold text-[#1C1917]">
                      {row.stageName}
                    </td>
                    <td className="py-3.5 px-2.5 border-r border-[#EFECE6] text-right font-mono tabular-nums font-bold text-[#D95D1E] whitespace-nowrap">
                      {row.durationMinutes} мин
                    </td>
                    <td className="py-3.5 px-3 border-r border-[#EFECE6] text-[#44403C] leading-relaxed">
                      {row.learningObjective}
                    </td>
                    <td className="py-3.5 px-3 border-r border-[#EFECE6] text-[#292524] leading-relaxed">
                      {row.teacherActivity}
                    </td>
                    <td className="py-3.5 px-3 border-r border-[#EFECE6] text-[#292524] leading-relaxed">
                      {row.studentActivity}
                    </td>
                    <td className="py-3.5 px-3 border-r border-[#EFECE6] text-[#57534E] leading-relaxed">
                      {row.materials}
                    </td>
                    <td className="py-3.5 px-3 text-[#57534E] leading-relaxed">
                      {row.assessmentCheck}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 3 */}
        <div>
          <h4 className="text-sm font-bold text-[#1C1917] mb-3">
            3. Самбар төлөвлөлтийн бүдүүвч хүснэгт
          </h4>
          <div className="overflow-x-auto border border-[#DED8CE] rounded-xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#DED8CE] text-xs font-bold text-[#44403C]">
                  <th className="py-3 px-4 border-r border-[#EAE4DC] w-[30%]">
                    Зүүн хэсэг (Зорилт, Түлхүүр үгс)
                  </th>
                  <th className="py-3 px-4 border-r border-[#EAE4DC] w-[40%]">
                    Төв хэсэг (Гол онол, Томьёо, Бүдүүвч)
                  </th>
                  <th className="py-3 px-4 w-[30%]">
                    Баруун хэсэг (Дасгал, Дүгнэлт, Даалгавар)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="align-top">
                  <td className="py-4 px-4 border-r border-[#EFECE6] space-y-2 text-[#44403C]">
                    {data.boardPlan.leftPanel.map((line, i) => (
                      <p key={i} className="leading-relaxed">• {line}</p>
                    ))}
                  </td>
                  <td className="py-4 px-4 border-r border-[#EFECE6] space-y-2 text-[#1C1917] font-medium">
                    {data.boardPlan.centerPanel.map((line, i) => (
                      <p key={i} className="leading-relaxed">• {line}</p>
                    ))}
                  </td>
                  <td className="py-4 px-4 space-y-2 text-[#44403C]">
                    {data.boardPlan.rightPanel.map((line, i) => (
                      <p key={i} className="leading-relaxed">• {line}</p>
                    ))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderExercisesSection = () => {
    const state = botStates.exercises;
    const data = outputs.exercises;

    if (state.status === 'working' && !data) {
      return renderSkeleton('AI бот 6 (Бодлого дасгал)', state.progress);
    }
    if (state.status === 'error' && !data) {
      return renderErrorState('exercises', state.error);
    }
    if (!data) {
      return (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm text-[#57534E]">
            Энэ сэдвийн шаталсан (А, Б, В түвшний) бодлого, дасгалуудыг үүсгэхэд бэлэн байна.
          </p>
          <button
            type="button"
            onClick={() => onRetryBot('exercises')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EB6B26] hover:bg-[#DC5E1B] text-white text-sm font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Бодлого дасгал боловсруулах</span>
          </button>
        </div>
      );
    }

    const filteredProblems = data.problems.filter((p) => {
      if (tierFilter === 'ALL') return true;
      return p.code.toUpperCase().startsWith(tierFilter) || p.tier.includes(tierFilter);
    });

    const totalPts = data.problems.reduce((s, p) => s + (Number(p.points) || 0), 0);

    return (
      <div className="space-y-7">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#EFECE6]">
          <div>
            <div className="text-xs font-semibold text-[#78716C]">
              AI бот 6 · Бодлого дасгал төлөвлөгч · Нийт {totalPts} оноо
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#1C1917]">
              {data.worksheetTitle}
            </h3>
            <p className="mt-1 text-xs text-[#57534E]">{data.instructions}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenWorksheetModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Даалгаврын хуудас (A4 / PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => downloadExercisesWorksheetWord(goal, data, false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EB6B26] hover:bg-[#DC5E1B] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Сурагчийн хуудас (.doc)</span>
            </button>

            <button
              type="button"
              onClick={() => downloadExercisesWorksheetWord(goal, data, true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D6CEC2] bg-[#FAF8F5] hover:bg-[#F2EDE4] text-[#1C1917] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Бодолттой түлхүүр (.doc)</span>
            </button>

            <button
              type="button"
              disabled={state.status === 'working'}
              onClick={() => onRetryBot('exercises')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-medium text-[#44403C] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${state.status === 'working' ? 'animate-spin' : ''}`} />
              <span>Шинэчлэх</span>
            </button>
          </div>
        </div>

        {/* Tier Filter + Solution Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F5F2EC]">
            {(
              [
                { key: 'ALL', label: 'Бүх түвшин' },
                { key: 'А', label: 'А · Суурь' },
                { key: 'Б', label: 'Б · Хэрэглээ' },
                { key: 'В', label: 'В · Ахисан' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTierFilter(item.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tierFilter === item.key
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowExerciseSolutions((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-semibold text-[#1C1917] transition-colors cursor-pointer whitespace-nowrap"
          >
            {showExerciseSolutions ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Бодолт нуух</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Алхамчилсан бодолт харах</span>
              </>
            )}
          </button>
        </div>

        {/* Structured Tiered Problems List */}
        <div className="divide-y divide-[#EAE4DC] border-y border-[#EAE4DC]">
          {filteredProblems.map((prob, idx) => (
            <div key={idx} className="py-5 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-xs font-semibold text-[#78716C]">
                  <span className="font-mono font-bold text-[#1C1917] mr-2">
                    Даалгавар {prob.code}
                  </span>
                  <span>{prob.tier}</span>
                  <span aria-hidden="true" className="mx-1.5">·</span>
                  <span>Шалгуур: {prob.rubricCriterion}</span>
                </div>
                <span className="font-mono tabular-nums text-xs font-bold text-[#D95D1E]">
                  {prob.points} оноо
                </span>
              </div>

              <p className="text-sm sm:text-[15px] text-[#1C1917] font-medium leading-relaxed">
                {prob.problemStatement}
              </p>

              <p className="text-xs text-[#57534E]">
                <span className="font-semibold text-[#9A3412]">Дөхүүлэх санамж: </span>
                {prob.hint}
              </p>

              {showExerciseSolutions && (
                <div className="p-4 rounded-xl bg-[#FAF8F5] space-y-1.5 text-xs sm:text-sm">
                  <p className="text-[#292524] leading-relaxed">
                    <span className="font-bold text-[#15804D]">Алхамчилсан бодолт: </span>
                    {prob.stepByStepSolution}
                  </p>
                  <p className="font-semibold text-[#1C1917]">
                    Хариу: {prob.finalAnswer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOverviewSection = () => {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#EFECE6]">
          <div>
            <div className="text-xs font-semibold text-[#78716C]">
              Нэг зорилгын нэгдсэн үр дүн · {goal.subject} · {goal.grade}
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#1C1917]">
              {goal.topic}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {outputs.planner && (
              <button
                type="button"
                onClick={() =>
                  downloadLessonPlanWord(goal, outputs.planner!, outputs, true)
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#EB6B26] hover:bg-[#DC5E1B] text-xs font-bold text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Иж бүрэн Word (.doc) татах</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onChangeTab('zipgrade')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-semibold text-[#1C1917] transition-colors cursor-pointer whitespace-nowrap"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>ZipGrade Засагч</span>
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E2DCD2] hover:bg-[#F8F6F2] text-xs font-semibold text-[#1C1917] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Хэвлэх</span>
            </button>
          </div>
        </div>

        {/* Summary Digest of all 6 Bots */}
        <div className="divide-y divide-[#EFECE6]">
          <div className="py-4 first:pt-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="text-xs font-bold text-[#D95D1E]">
                AI бот 1 · Судалгаа
              </div>
              <p className="text-sm text-[#44403C] leading-relaxed">
                {outputs.research
                  ? outputs.research.summary
                  : botStates.research.status === 'working'
                  ? 'Сэдвийн онол, зүйрлэл, сонирхолтой баримтуудыг боловсруулж байна...'
                  : 'Одоогоор боловсруулаагүй байна.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeTab('research')}
              className="text-xs font-semibold text-[#1C1917] underline underline-offset-4 hover:text-[#D95D1E] whitespace-nowrap shrink-0 self-start cursor-pointer"
            >
              Дэлгэрэнгүй
            </button>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="text-xs font-bold text-[#D95D1E]">
                AI бот 2 · Контент ба Слайд
              </div>
              <p className="text-sm text-[#44403C] leading-relaxed">
                {outputs.content
                  ? outputs.content.lessonObjective
                  : botStates.content.status === 'working'
                  ? 'Пресентацийн слайд болон ангийн идэвхтэй дасгал ажлыг бэлтгэж байна...'
                  : 'Одоогоор боловсруулаагүй байна.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeTab('content')}
              className="text-xs font-semibold text-[#1C1917] underline underline-offset-4 hover:text-[#D95D1E] whitespace-nowrap shrink-0 self-start cursor-pointer"
            >
              Слайд үзэх
            </button>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="text-xs font-bold text-[#D95D1E]">
                AI бот 3 · Тайлан ба Рубрик
              </div>
              <p className="text-sm text-[#44403C] leading-relaxed">
                {outputs.report
                  ? outputs.report.teacherReportSummary
                  : botStates.report.status === 'working'
                  ? 'Үнэлгээний рубрик болон суралцахуйн үр дүнгийн тайланг тооцоолж байна...'
                  : 'Одоогоор боловсруулаагүй байна.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeTab('report')}
              className="text-xs font-semibold text-[#1C1917] underline underline-offset-4 hover:text-[#D95D1E] whitespace-nowrap shrink-0 self-start cursor-pointer"
            >
              Рубрик үзэх
            </button>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="text-xs font-bold text-[#D95D1E]">
                AI бот 4 · Хариулт ба Сорил (ZipGrade автомат засагчтай холбогдсон)
              </div>
              <p className="text-sm text-[#44403C] leading-relaxed">
                {outputs.answers
                  ? `${outputs.answers.multipleChoiceQuiz.length} сонгох тест, задгай асуулт болон ZipGrade оптик уншигчийн түлхүүр бэлэн.`
                  : botStates.answers.status === 'working'
                  ? 'Сурагчдаас авах тест болон хариултын түлхүүрийг боловсруулж байна...'
                  : 'Одоогоор боловсруулаагүй байна.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeTab('answers')}
              className="text-xs font-semibold text-[#1C1917] underline underline-offset-4 hover:text-[#D95D1E] whitespace-nowrap shrink-0 self-start cursor-pointer"
            >
              Тест үзэх
            </button>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="text-xs font-bold text-[#1E9E63]">
                AI бот 5 · Боловсруулагч (Хүснэгтээр татаж авах иж бүрэн төлөвлөлт)
              </div>
              <p className="text-sm text-[#44403C] leading-relaxed">
                {outputs.planner
                  ? `${outputs.planner.stagesTable.length} үе шаттай иж бүрэн хүснэгтэн төлөвлөлт болон самбар төлөвлөлт Word (.doc), Excel (.csv) форматаар татахад бэлэн.`
                  : botStates.planner.status === 'working'
                  ? 'Ээлжит хичээлийн иж бүрэн хүснэгтэн төлөвлөлтийг боловсруулж байна...'
                  : 'Боловсруулагч таб руу орж хүснэгт үүсгэнэ үү.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeTab('planner')}
              className="text-xs font-bold text-[#D95D1E] underline underline-offset-4 hover:text-[#9A3412] whitespace-nowrap shrink-0 self-start cursor-pointer"
            >
              Хүснэгт & Татах
            </button>
          </div>

          <div className="py-4 pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="text-xs font-bold text-[#1D4ED8]">
                AI бот 6 · Бодлого дасгал төлөвлөгч (А, Б, В түвшний ажлын хуудас)
              </div>
              <p className="text-sm text-[#44403C] leading-relaxed">
                {outputs.exercises
                  ? `${outputs.exercises.problems.length} шаталсан бодлого дасгал, дөхүүлэх санамж ба алхамчилсан бодолт Word (.doc) хуудсаар татахад бэлэн.`
                  : botStates.exercises.status === 'working'
                  ? 'А, Б, В түвшний бодлого дасгал ба алхамчилсан бодолтыг бэлтгэж байна...'
                  : 'Бодлого дасгал таб руу орж ажлын хуудас үүсгэнэ үү.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeTab('exercises')}
              className="text-xs font-bold text-[#1C1917] underline underline-offset-4 hover:text-[#D95D1E] whitespace-nowrap shrink-0 self-start cursor-pointer"
            >
              Бодлого үзэх
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white border border-[#EAE4DC] p-5 sm:p-7">
        {/* Segmented Control Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-[#F5F2EC] mb-6">
          {TAB_ITEMS.map((tab) => {
            const active = activeTab === tab.id;
            const botStatus = tab.botId ? botStates[tab.botId].status : null;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <span>{tab.label}</span>
                {botStatus === 'working' && (
                  <span className="ml-1 font-mono text-[11px] text-[#D95D1E]">
                    ···
                  </span>
                )}
                {botStatus === 'completed' && (
                  <span className="ml-1 text-[11px] text-[#1E9E63]">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active View Body */}
        {activeTab === 'overview' && renderOverviewSection()}
        {activeTab === 'research' && renderResearchSection()}
        {activeTab === 'content' && renderContentSection()}
        {activeTab === 'report' && renderReportSection()}
        {activeTab === 'answers' && renderAnswersSection()}
        {activeTab === 'planner' && renderPlannerSection()}
        {activeTab === 'exercises' && renderExercisesSection()}
        {activeTab === 'zipgrade' && (
          <ZipGradePanel
            goal={goal}
            quizQuestions={outputs.answers?.multipleChoiceQuiz || []}
            rubricRows={outputs.report?.rubric || []}
            gradedStudents={gradedStudents}
            onAddStudents={onAddGradedStudents}
            onUpdateStudent={onUpdateGradedStudent}
            onRemoveStudent={onRemoveGradedStudent}
            onClearAllStudents={onClearGradedStudents}
          />
        )}
      </section>

      {/* Interactive Teacher Follow-up Assistant Chat */}
      <section
        id="teacher-chat-panel"
        className="rounded-2xl bg-white border border-[#EAE4DC] p-5 sm:p-7"
      >
        <div className="mb-4">
          <div className="text-xs font-semibold text-[#78716C]">
            Шууд ярилцах туслах · Сэдвийн хүрээнд нэмэлт материал бэлтгэх
          </div>
          <h3 className="mt-0.5 text-lg font-bold text-[#1C1917]">
            AI-87 Багшийн зөвлөхөөс асуух
          </h3>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_CHAT_PROMPTS.map((qPrompt) => (
            <button
              key={qPrompt}
              type="button"
              disabled={isChatLoading}
              onClick={() => onSendChat(qPrompt)}
              className="text-left px-3 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F2EDE4] border border-[#E7E2DA] text-xs text-[#44403C] transition-colors cursor-pointer disabled:opacity-50"
            >
              {qPrompt}
            </button>
          ))}
        </div>

        {chatMessages.length > 0 && (
          <div className="mb-4 max-h-80 overflow-y-auto space-y-3 pr-1 border-y border-[#F0ECE4] py-4">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#FDF1E7] text-[#1C1917] ml-6 sm:ml-14'
                    : 'bg-[#FAF8F5] text-[#292524] mr-4 sm:mr-10'
                }`}
              >
                <div className="text-[11px] font-semibold text-[#78716C] mb-1">
                  {msg.role === 'user' ? 'Багш' : 'AI-87 Зөвлөх'} · {msg.timestamp}
                </div>
                <div>{msg.content}</div>
              </div>
            ))}
            {isChatLoading && (
              <div className="rounded-xl px-4 py-3 text-sm bg-[#FAF8F5] text-[#78716C] mr-10">
                Хариулт бичиж байна...
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleChatSubmit} className="flex items-center gap-2.5">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Жишээ нь: Энэ хичээл дээр олимпиадын түвшний дахиад 2 бодлого нэмж өгөөч..."
            className="flex-1 rounded-xl border border-[#DED8CE] bg-[#FCFBF9] px-4 py-2.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#EB6B26] focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={isChatLoading || !chatInput.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1C1917] hover:bg-[#292524] disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Илгээх</span>
          </button>
        </form>
      </section>
    </div>
  );
};
