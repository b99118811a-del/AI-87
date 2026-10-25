import React from 'react';
import { Download, FileText, ScanLine } from 'lucide-react';
import type { ActiveViewTab, BotId, BotProgressState, LessonGoal } from '../types';

interface BotHubDiagramProps {
  goal: LessonGoal;
  botStates: Record<BotId, BotProgressState>;
  selectedTab: ActiveViewTab;
  onSelectTab: (tab: ActiveViewTab) => void;
  onFocusGoalInput: () => void;
  canDownloadPlan: boolean;
  onQuickDownloadWord: () => void;
  canDownloadWorksheet?: boolean;
  onQuickDownloadWorksheet?: () => void;
  onOpenWorksheetModal?: () => void;
}

export interface BotVisualTheme {
  id: BotId;
  numberLabel: string;
  title: string;
  roleShort: string;
  accentHex: string;
  softBg: string;
  iconBg: string;
  textAccent: string;
  lineCoords: { x2: string; y2: string };
}

export const BOT_THEMES: Record<BotId, BotVisualTheme> = {
  research: {
    id: 'research',
    numberLabel: 'AI бот 1',
    title: 'Судалгаа',
    roleShort: 'Онол, зүйрлэл, баримт',
    accentHex: '#0EA5E9',
    softBg: '#F0F9FF',
    iconBg: '#E0F2FE',
    textAccent: '#0369A1',
    lineCoords: { x2: '24%', y2: '22%' },
  },
  content: {
    id: 'content',
    numberLabel: 'AI бот 2',
    title: 'Контент',
    roleShort: 'Слайд ба идэвхтэй дасгал',
    accentHex: '#F59E0B',
    softBg: '#FFFBEB',
    iconBg: '#FEF3C7',
    textAccent: '#B45309',
    lineCoords: { x2: '76%', y2: '22%' },
  },
  report: {
    id: 'report',
    numberLabel: 'AI бот 3',
    title: 'Тайлан',
    roleShort: 'Үнэлгээний рубрик',
    accentHex: '#10B981',
    softBg: '#ECFDF5',
    iconBg: '#D1FAE5',
    textAccent: '#047857',
    lineCoords: { x2: '24%', y2: '78%' },
  },
  answers: {
    id: 'answers',
    numberLabel: 'AI бот 4',
    title: 'Хариулт',
    roleShort: 'Сорил тест ба түлхүүр',
    accentHex: '#6366F1',
    softBg: '#EEF2FF',
    iconBg: '#E0E7FF',
    textAccent: '#4338CA',
    lineCoords: { x2: '76%', y2: '78%' },
  },
  planner: {
    id: 'planner',
    numberLabel: 'AI бот 5',
    title: 'Боловсруулагч',
    roleShort: 'Хүснэгтэн төлөвлөлт',
    accentHex: '#F97316',
    softBg: '#FFF7ED',
    iconBg: '#FFEDD5',
    textAccent: '#C2410C',
    lineCoords: { x2: '26%', y2: '100%' },
  },
  exercises: {
    id: 'exercises',
    numberLabel: 'AI бот 6',
    title: 'Бодлого дасгал',
    roleShort: 'А, Б, В ажлын хуудас',
    accentHex: '#14B8A6',
    softBg: '#F0FDFA',
    iconBg: '#CCFBF1',
    textAccent: '#0F766E',
    lineCoords: { x2: '74%', y2: '100%' },
  },
};

const TOP_FOUR_IDS: BotId[] = ['research', 'content', 'report', 'answers'];
const BOTTOM_TWO_IDS: BotId[] = ['planner', 'exercises'];

export function BotCustomIcon({ id }: { id: BotId }) {
  if (id === 'research') {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
        <circle cx="14" cy="14" r="7.5" fill="#BAE6FD" stroke="#0284C7" strokeWidth="2.2" />
        <path d="M19.5 19.5L26 26" stroke="#0369A1" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M11 11.5C12 10.3 13.5 10 15 10.4" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'content') {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
        <path d="M7 24.5H25" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" />
        <path
          d="M19.8 6.8L23.7 10.7L13.2 21.2L8.5 22L9.3 17.3L19.8 6.8Z"
          fill="#FBBF24"
          stroke="#92400E"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (id === 'report') {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
        <rect x="6" y="14" width="4.5" height="12" rx="1.2" fill="#10B981" />
        <rect x="13.75" y="10" width="4.5" height="16" rx="1.2" fill="#059669" />
        <rect x="21.5" y="6.5" width="4.5" height="19.5" rx="1.2" fill="#34D399" />
        <path d="M4.5 26H27.5" stroke="#065F46" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === 'answers') {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
        <path
          d="M16 6.5C9.92 6.5 5 10.58 5 15.6C5 18.14 6.26 20.43 8.3 22.08L7.2 26.2L11.88 24.22C13.18 24.54 14.56 24.7 16 24.7C22.08 24.7 27 20.62 27 15.6C27 10.58 22.08 6.5 16 6.5Z"
          fill="#C7D2FE"
          stroke="#4F46E5"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="11.5" cy="15.6" r="1.5" fill="#312E81" />
        <circle cx="16" cy="15.6" r="1.5" fill="#312E81" />
        <circle cx="20.5" cy="15.6" r="1.5" fill="#312E81" />
      </svg>
    );
  }
  if (id === 'planner') {
    return (
      <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
        <rect x="5" y="6" width="22" height="20" rx="2.5" fill="#FED7AA" stroke="#C2410C" strokeWidth="2" />
        <path d="M5 12H27" stroke="#C2410C" strokeWidth="2" />
        <path d="M5 19H27" stroke="#EA580C" strokeWidth="1.5" />
        <path d="M13 12V26" stroke="#EA580C" strokeWidth="1.5" />
        <path d="M20 12V26" stroke="#EA580C" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" aria-hidden="true">
      <rect x="6" y="5" width="20" height="22" rx="3" fill="#99F6E4" stroke="#0F766E" strokeWidth="2" />
      <path d="M10.5 11.5H15.5M13 9V14" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 11.5H21.5" stroke="#EA580C" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M11 20H21M11 23H17" stroke="#115E59" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export const BotHubDiagram: React.FC<BotHubDiagramProps> = ({
  goal,
  botStates,
  selectedTab,
  onSelectTab,
  onFocusGoalInput,
  canDownloadPlan,
  onQuickDownloadWord,
  canDownloadWorksheet,
  onQuickDownloadWorksheet,
  onOpenWorksheetModal,
}) => {
  const statesList = Object.values(botStates);
  const completedCount = statesList.filter((s) => s.status === 'completed').length;
  const anyWorking = statesList.some((s) => s.status === 'working');
  const anyError = statesList.some((s) => s.status === 'error');

  let statusSummary = `6 AI бот бэлэн (${completedCount}/6 дууссан)`;
  if (anyWorking) {
    statusSummary = `AI баг зэрэг ажиллаж байна (${completedCount}/6)`;
  } else if (anyError) {
    statusSummary = 'Зарим бот дээр дахин ажиллуулах шаардлагатай';
  }

  const renderBotNode = (id: BotId) => {
    const theme = BOT_THEMES[id];
    const state = botStates[id];
    const isSelected = selectedTab === id;
    const isCompleted = state.status === 'completed';
    const isWorking = state.status === 'working';
    const isError = state.status === 'error';

    const scaleValue = isCompleted
      ? 1
      : isWorking
      ? Math.max(0.15, Math.min(0.95, state.progress / 100))
      : isError
      ? 1
      : 0.1;

    return (
      <button
        key={id}
        type="button"
        onClick={() => onSelectTab(id)}
        className={`group text-left rounded-2xl p-3.5 sm:p-4 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          isSelected
            ? 'bg-white text-[#0F172A] ring-2 ring-[#FB923C] shadow-lg -translate-y-0.5'
            : 'bg-white/95 hover:bg-white text-[#0F172A] shadow-md hover:-translate-y-0.5'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            style={{ backgroundColor: theme.iconBg }}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105"
          >
            <BotCustomIcon id={id} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              style={{ color: theme.textAccent }}
              className="text-[11px] font-bold whitespace-nowrap"
            >
              {theme.numberLabel}
            </div>
            <div className="text-sm sm:text-base font-extrabold text-[#0F172A] tracking-tight truncate">
              {theme.title}
            </div>
          </div>
        </div>

        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            style={{
              transform: `scaleX(${scaleValue})`,
              backgroundColor: isError ? '#DC2626' : theme.accentHex,
            }}
            className="h-full w-full origin-left rounded-full transition-transform duration-200"
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold">
          {isCompleted && (
            <span className="text-emerald-700 truncate">✓ {theme.roleShort}</span>
          )}
          {isWorking && (
            <>
              <span className="text-slate-600 truncate">Боловсруулж байна...</span>
              <span
                style={{ color: theme.textAccent }}
                className="font-mono tabular-nums font-bold shrink-0"
              >
                {Math.round(state.progress)}%
              </span>
            </>
          )}
          {isError && <span className="text-red-600 truncate">! Дахин оролдох</span>}
          {state.status === 'idle' && (
            <span className="text-slate-500 truncate">{theme.roleShort}</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col justify-between rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#1E1B4B] text-white p-5 sm:p-7 select-none">
      {/* Top Active Lesson Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-5 border-b border-white/10">
        <div className="space-y-1 max-w-xl">
          <div className="text-xs font-semibold text-sky-300 tracking-wide">
            <span>{goal.subject}</span>
            <span aria-hidden="true" className="mx-1.5 text-white/40">·</span>
            <span>{goal.grade}</span>
            <span aria-hidden="true" className="mx-1.5 text-white/40">·</span>
            <span className="tabular-nums">{goal.durationMinutes} минут</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-snug">
            {goal.topic}
          </h1>
        </div>

        <span className="text-xs font-semibold text-amber-300 tabular-nums whitespace-nowrap">
          {statusSummary}
        </span>
      </div>

      {/* Interactive Radial 6-Bot Network Stage */}
      <div className="my-6">
        <div className="relative mx-auto max-w-[560px]">
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            aria-hidden="true"
          >
            {TOP_FOUR_IDS.map((botId) => {
              const theme = BOT_THEMES[botId];
              const st = botStates[botId];
              const isWorking = st.status === 'working';
              return (
                <line
                  key={botId}
                  x1="50%"
                  y1="50%"
                  x2={theme.lineCoords.x2}
                  y2={theme.lineCoords.y2}
                  stroke={theme.accentHex}
                  strokeOpacity={0.85}
                  strokeWidth="2.6"
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                  className={isWorking ? 'animate-dash-flow' : ''}
                />
              );
            })}
            <line
              x1="50%"
              y1="50%"
              x2="26%"
              y2="100%"
              stroke={BOT_THEMES.planner.accentHex}
              strokeOpacity={0.85}
              strokeWidth="2.4"
              strokeDasharray="7 6"
              className={botStates.planner.status === 'working' ? 'animate-dash-flow' : ''}
            />
            <line
              x1="50%"
              y1="50%"
              x2="74%"
              y2="100%"
              stroke={BOT_THEMES.exercises.accentHex}
              strokeOpacity={0.85}
              strokeWidth="2.4"
              strokeDasharray="7 6"
              className={botStates.exercises.status === 'working' ? 'animate-dash-flow' : ''}
            />
          </svg>

          {/* Central Glowing Target Hub: "Нэг зорилго" */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <button
              type="button"
              onClick={onFocusGoalInput}
              title={`Хичээлийн сэдэв өөрчлөх: ${goal.topic}`}
              className="pointer-events-auto group w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#FF7A2F] to-[#EA580C] hover:from-[#FF8B47] hover:to-[#F97316] text-white ring-4 ring-white/15 shadow-[0_0_40px_rgba(249,115,22,0.45)] flex flex-col items-center justify-center px-3 text-center transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 cursor-pointer"
            >
              <svg viewBox="0 0 44 44" className="w-9 h-9 mb-1" fill="none" aria-hidden="true">
                <circle cx="20" cy="24" r="12" fill="#FFFFFF" />
                <circle cx="20" cy="24" r="9.5" stroke="#DC2626" strokeWidth="2.6" />
                <circle cx="20" cy="24" r="5" stroke="#DC2626" strokeWidth="2.4" />
                <circle cx="20" cy="24" r="2.2" fill="#DC2626" />
                <path d="M20 24L33 11" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M31 9L36 8L35 13L31 9Z" fill="#38BDF8" />
              </svg>
              <span className="text-xs sm:text-sm font-extrabold leading-tight tracking-tight whitespace-nowrap">
                Нэг зорилго
              </span>
              <span className="mt-0.5 text-[10px] font-semibold text-white/90 max-w-[96px] truncate">
                {goal.subject}
              </span>
            </button>
          </div>

          {/* 2x2 Grid of Bots 1..4 */}
          <div className="relative z-10 grid grid-cols-2 gap-x-4 sm:gap-x-10 gap-y-24 sm:gap-y-28">
            {TOP_FOUR_IDS.map((botId) => renderBotNode(botId))}
          </div>
        </div>

        {/* Bottom Pair: Bot 5 & Bot 6 */}
        <div className="mx-auto max-w-[560px] mt-4 grid grid-cols-2 gap-x-4 sm:gap-x-10">
          {BOTTOM_TWO_IDS.map((botId) => renderBotNode(botId))}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              canDownloadPlan ? onQuickDownloadWord() : onSelectTab('planner')
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Төлөвлөлт (.doc)</span>
          </button>

          {(onOpenWorksheetModal || onQuickDownloadWorksheet) && (
            <button
              type="button"
              onClick={() => {
                if (onOpenWorksheetModal) {
                  onOpenWorksheetModal();
                } else if (canDownloadWorksheet && onQuickDownloadWorksheet) {
                  onQuickDownloadWorksheet();
                } else {
                  onSelectTab('exercises');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/35 text-teal-100 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5 text-teal-300" />
              <span>Даалгаврын хуудас</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('zipgrade')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <ScanLine className="w-3.5 h-3.5 text-amber-300" />
          <span>ZipGrade Автомат Засагч</span>
        </button>
      </div>
    </div>
  );
};
