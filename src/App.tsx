import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Code2, Download, ExternalLink, FileText } from 'lucide-react';
import { BotOutputPanel } from './components/BotOutputPanel';
import { GoogleSitesEmbedModal } from './components/GoogleSitesEmbedModal';
import { PrintLessonSheet } from './components/PrintLessonSheet';
import { StudentWorksheetModal } from './components/StudentWorksheetModal';
import { UnifiedDashboard } from './components/UnifiedDashboard';
import {
  INITIAL_SAMPLE_LESSON,
  SAMPLE_GRADED_STUDENTS,
} from './data/sampleLesson';
import { downloadLessonPlanWord } from './utils/exportLessonPlan';
import type {
  ActiveViewTab,
  AnswersResult,
  BotId,
  BotProgressState,
  ChatMessage,
  ContentResult,
  ExercisesResult,
  GradedStudentRecord,
  LessonGoal,
  LessonOutputs,
  PlannerResult,
  ReportResult,
  ResearchResult,
  SavedLesson,
} from './types';

const STORAGE_KEY = 'ai87_saved_lessons_v3';
const GRADEBOOK_STORAGE_KEY = 'ai87_gradebook_v1';

const ALL_BOT_IDS: BotId[] = [
  'research',
  'content',
  'report',
  'answers',
  'planner',
  'exercises',
];

function loadSavedLessons(): SavedLesson[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [INITIAL_SAMPLE_LESSON];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: SavedLesson) => ({
        ...item,
        outputs: {
          research: item.outputs?.research ?? null,
          content: item.outputs?.content ?? null,
          report: item.outputs?.report ?? null,
          answers: item.outputs?.answers ?? null,
          planner: item.outputs?.planner ?? null,
          exercises: item.outputs?.exercises ?? null,
        },
      }));
    }
  } catch {
    // Fallback to initial sample
  }
  return [INITIAL_SAMPLE_LESSON];
}

export default function App() {
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>(() =>
    loadSavedLessons()
  );
  const [activeLessonId, setActiveLessonId] = useState<string>(
    () => loadSavedLessons()[0].id
  );
  const [activeGoal, setActiveGoal] = useState<LessonGoal>(
    () => loadSavedLessons()[0].goal
  );
  const [draftGoal, setDraftGoal] = useState<LessonGoal>(
    () => loadSavedLessons()[0].goal
  );
  const [outputs, setOutputs] = useState<LessonOutputs>(
    () => loadSavedLessons()[0].outputs
  );

  // Per-lesson graded student records (persisted + pre-seeded for initial sample lesson)
  const [gradebookByLesson, setGradebookByLesson] = useState<
    Record<string, GradedStudentRecord[]>
  >(() => {
    try {
      const raw = localStorage.getItem(GRADEBOOK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            [INITIAL_SAMPLE_LESSON.id]: SAMPLE_GRADED_STUDENTS,
            ...parsed,
          };
        }
      }
    } catch {
      // Ignore storage error
    }
    return {
      [INITIAL_SAMPLE_LESSON.id]: SAMPLE_GRADED_STUDENTS,
    };
  });

  const [botStates, setBotStates] = useState<Record<BotId, BotProgressState>>(() => {
    const first = loadSavedLessons()[0].outputs;
    return {
      research: {
        status: first.research ? 'completed' : 'idle',
        progress: first.research ? 100 : 0,
      },
      content: {
        status: first.content ? 'completed' : 'idle',
        progress: first.content ? 100 : 0,
      },
      report: {
        status: first.report ? 'completed' : 'idle',
        progress: first.report ? 100 : 0,
      },
      answers: {
        status: first.answers ? 'completed' : 'idle',
        progress: first.answers ? 100 : 0,
      },
      planner: {
        status: first.planner ? 'completed' : 'idle',
        progress: first.planner ? 100 : 0,
      },
      exercises: {
        status: first.exercises ? 'completed' : 'idle',
        progress: first.exercises ? 100 : 0,
      },
    };
  });

  const [activeTab, setActiveTab] = useState<ActiveViewTab>('overview');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState<boolean>(false);
  const [isWorksheetModalOpen, setIsWorksheetModalOpen] =
    useState<boolean>(false);

  const isEmbedMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('embed') === '1';
  const standaloneUrl =
    typeof window !== 'undefined'
      ? window.location.origin.replace('://ais-dev-', '://ais-pre-')
      : '/';

  const topicInputRef = useRef<HTMLInputElement | null>(null);
  const outputTopRef = useRef<HTMLDivElement | null>(null);
  const progressIntervalsRef = useRef<Partial<Record<BotId, number>>>({});

  const [printTargetLessons, setPrintTargetLessons] = useState<
    SavedLesson[] | null
  >(null);
  const [customWorksheetPrintHtml, setCustomWorksheetPrintHtml] = useState<
    string | null
  >(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLessons.slice(0, 24)));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedLessons]);

  useEffect(() => {
    try {
      localStorage.setItem(
        GRADEBOOK_STORAGE_KEY,
        JSON.stringify(gradebookByLesson)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [gradebookByLesson]);

  useEffect(() => {
    return () => {
      Object.values(progressIntervalsRef.current).forEach((timerId) => {
        if (timerId) window.clearInterval(timerId);
      });
    };
  }, []);

  const startBotProgressTicker = (botId: BotId) => {
    if (progressIntervalsRef.current[botId]) {
      window.clearInterval(progressIntervalsRef.current[botId]);
    }
    const speedStep =
      botId === 'research'
        ? 7
        : botId === 'content'
        ? 5.6
        : botId === 'report'
        ? 6
        : botId === 'answers'
        ? 5.2
        : botId === 'planner'
        ? 4.8
        : 5.4;

    progressIntervalsRef.current[botId] = window.setInterval(() => {
      setBotStates((prev) => {
        const current = prev[botId];
        if (current.status !== 'working') return prev;
        const remaining = 92 - current.progress;
        const delta = Math.max(1.2, Math.min(speedStep, remaining * 0.16));
        const nextProgress = Math.min(92, current.progress + delta);
        return {
          ...prev,
          [botId]: { ...current, progress: nextProgress },
        };
      });
    }, 280);
  };

  const stopBotProgressTicker = (botId: BotId) => {
    const id = progressIntervalsRef.current[botId];
    if (id) {
      window.clearInterval(id);
      delete progressIntervalsRef.current[botId];
    }
  };

  const autoRecoveredLessonRef = useRef<string | null>(null);

  const executeSingleBotFetch = async (
    botId: BotId,
    goalToUse: LessonGoal
  ): Promise<
    | ResearchResult
    | ContentResult
    | ReportResult
    | AnswersResult
    | PlannerResult
    | ExercisesResult
    | null
  > => {
    setBotStates((prev) => ({
      ...prev,
      [botId]: { status: 'working', progress: 14 },
    }));
    startBotProgressTicker(botId);

    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalToUse }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Серверээс хариу авахад алдаа гарлаа.');
      }

      stopBotProgressTicker(botId);
      setBotStates((prev) => ({
        ...prev,
        [botId]: { status: 'completed', progress: 100 },
      }));

      setOutputs((prev) => ({
        ...prev,
        [botId]: data,
      }));

      return data;
    } catch (err: unknown) {
      stopBotProgressTicker(botId);
      const errMessage =
        err instanceof Error ? err.message : 'Боловсруулалт амжилтгүй боллоо.';
      setBotStates((prev) => ({
        ...prev,
        [botId]: { status: 'error', progress: 100, error: errMessage },
      }));
      return null;
    }
  };

  const executeBatchBotsFetch = async (
    targetBotIds: BotId[],
    goalToUse: LessonGoal,
    lessonIdToUpdate: string,
    existingOutputs?: LessonOutputs
  ): Promise<Partial<LessonOutputs> | null> => {
    if (targetBotIds.length === 0) return null;

    setBotStates((prev) => {
      const next = { ...prev };
      targetBotIds.forEach((id) => {
        next[id] = { status: 'working', progress: 14 };
      });
      return next;
    });
    targetBotIds.forEach((id) => startBotProgressTicker(id));

    try {
      const response = await fetch('/api/bots/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalToUse,
          botIds: targetBotIds,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Хичээлийн багц боловсруулахад алдаа гарлаа.');
      }

      targetBotIds.forEach((id) => stopBotProgressTicker(id));

      const receivedPatch: Partial<LessonOutputs> = {};
      targetBotIds.forEach((id) => {
        if (data && data[id]) {
          receivedPatch[id] = data[id];
        }
      });

      setBotStates((prev) => {
        const next = { ...prev };
        targetBotIds.forEach((id) => {
          if (receivedPatch[id]) {
            next[id] = { status: 'completed', progress: 100 };
          } else {
            next[id] = {
              status: 'error',
              progress: 100,
              error: 'Энэ ботын өгөгдөл дутуу ирлээ. Дахин боловсруулах дарна уу.',
            };
          }
        });
        return next;
      });

      const baseOutputs: LessonOutputs = existingOutputs || {
        research: null,
        content: null,
        report: null,
        answers: null,
        planner: null,
        exercises: null,
      };
      const mergedOutputs: LessonOutputs = {
        ...baseOutputs,
        ...receivedPatch,
      };

      setOutputs((prev) => ({
        ...prev,
        ...receivedPatch,
      }));

      if (Object.keys(receivedPatch).length > 0) {
        const nowLabel = new Date().toLocaleTimeString('mn-MN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setSavedLessons((prev) => {
          const exists = prev.some((x) => x.id === lessonIdToUpdate);
          if (exists) {
            return prev.map((item) =>
              item.id === lessonIdToUpdate
                ? {
                    ...item,
                    outputs: {
                      ...item.outputs,
                      ...receivedPatch,
                    },
                  }
                : item
            );
          }
          const newSaved: SavedLesson = {
            id: lessonIdToUpdate,
            createdAt: nowLabel,
            goal: goalToUse,
            outputs: mergedOutputs,
          };
          return [newSaved, ...prev];
        });
      }

      return receivedPatch;
    } catch (err: unknown) {
      targetBotIds.forEach((id) => stopBotProgressTicker(id));
      const errMessage =
        err instanceof Error ? err.message : 'Боловсруулалт амжилтгүй боллоо.';
      setBotStates((prev) => {
        const next = { ...prev };
        targetBotIds.forEach((id) => {
          next[id] = { status: 'error', progress: 100, error: errMessage };
        });
        return next;
      });
      return null;
    }
  };

  // Automatically complete any missing bots if an incomplete lesson was persisted in localStorage
  useEffect(() => {
    if (autoRecoveredLessonRef.current === activeLessonId) return;
    if (!activeGoal.topic.trim()) return;

    const missingIds = ALL_BOT_IDS.filter((id) => !outputs[id]);
    const isWorking = ALL_BOT_IDS.some((id) => botStates[id].status === 'working');

    if (missingIds.length > 0 && !isWorking) {
      autoRecoveredLessonRef.current = activeLessonId;
      void executeBatchBotsFetch(missingIds, activeGoal, activeLessonId, outputs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId]);

  const handleRunAllBots = async (overrideGoal?: LessonGoal) => {
    const targetGoal = overrideGoal || draftGoal;
    if (!targetGoal.topic.trim()) return;

    const newLessonId = `lesson-${Date.now()}`;
    autoRecoveredLessonRef.current = newLessonId;
    setActiveLessonId(newLessonId);
    setActiveGoal(targetGoal);
    setChatMessages([]);
    const emptyOutputs: LessonOutputs = {
      research: null,
      content: null,
      report: null,
      answers: null,
      planner: null,
      exercises: null,
    };
    setOutputs(emptyOutputs);

    await executeBatchBotsFetch(
      ALL_BOT_IDS,
      targetGoal,
      newLessonId,
      emptyOutputs
    );
  };

  const handleRetryBot = async (botId: BotId) => {
    const missingIds = ALL_BOT_IDS.filter((id) => !outputs[id]);
    // If multiple bots are missing, complete all missing bots + clicked bot in 1 unified request
    if (missingIds.length > 1) {
      const batchTargets = Array.from(new Set<BotId>([botId, ...missingIds]));
      await executeBatchBotsFetch(
        batchTargets,
        activeGoal,
        activeLessonId,
        outputs
      );
      return;
    }

    const updatedPart = await executeSingleBotFetch(botId, activeGoal);
    if (updatedPart) {
      setSavedLessons((prev) =>
        prev.map((item) =>
          item.id === activeLessonId
            ? {
                ...item,
                outputs: {
                  ...item.outputs,
                  [botId]: updatedPart,
                },
              }
            : item
        )
      );
    }
  };

  const handleSelectSavedLesson = (lesson: SavedLesson) => {
    ALL_BOT_IDS.forEach((b) => stopBotProgressTicker(b));
    setActiveLessonId(lesson.id);
    setActiveGoal(lesson.goal);
    setDraftGoal(lesson.goal);
    setOutputs(lesson.outputs);
    if (lesson.gradedStudents && lesson.gradedStudents.length > 0) {
      setGradebookByLesson((prev) => ({
        ...prev,
        [lesson.id]: prev[lesson.id]?.length ? prev[lesson.id] : lesson.gradedStudents!,
      }));
    }
    setChatMessages([]);
    setBotStates({
      research: {
        status: lesson.outputs.research ? 'completed' : 'idle',
        progress: lesson.outputs.research ? 100 : 0,
      },
      content: {
        status: lesson.outputs.content ? 'completed' : 'idle',
        progress: lesson.outputs.content ? 100 : 0,
      },
      report: {
        status: lesson.outputs.report ? 'completed' : 'idle',
        progress: lesson.outputs.report ? 100 : 0,
      },
      answers: {
        status: lesson.outputs.answers ? 'completed' : 'idle',
        progress: lesson.outputs.answers ? 100 : 0,
      },
      planner: {
        status: lesson.outputs.planner ? 'completed' : 'idle',
        progress: lesson.outputs.planner ? 100 : 0,
      },
      exercises: {
        status: lesson.outputs.exercises ? 'completed' : 'idle',
        progress: lesson.outputs.exercises ? 100 : 0,
      },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveCurrentToArchive = (
    classGroup: string,
    teacherNote: string
  ) => {
    const todayDate = new Date().toLocaleDateString('mn-MN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const nowTime = new Date().toLocaleTimeString('mn-MN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const currentStudents = gradebookByLesson[activeLessonId] || [];

    setSavedLessons((prev) => {
      const exists = prev.some((x) => x.id === activeLessonId);
      if (exists) {
        return prev.map((item) =>
          item.id === activeLessonId
            ? {
                ...item,
                savedDate: todayDate,
                createdAt: nowTime,
                classGroup: classGroup || item.classGroup,
                teacherNote: teacherNote || item.teacherNote,
                goal: activeGoal,
                outputs,
                gradedStudents: currentStudents,
              }
            : item
        );
      }
      const newArchived: SavedLesson = {
        id: activeLessonId,
        savedDate: todayDate,
        createdAt: nowTime,
        classGroup: classGroup || undefined,
        teacherNote: teacherNote || undefined,
        goal: activeGoal,
        outputs,
        gradedStudents: currentStudents,
      };
      return [newArchived, ...prev];
    });
  };

  const handleDeleteArchivedLesson = (lessonId: string) => {
    setSavedLessons((prev) => {
      const remaining = prev.filter((x) => x.id !== lessonId);
      if (remaining.length === 0) return [INITIAL_SAMPLE_LESSON];
      if (lessonId === activeLessonId) {
        const nextActive = remaining[0];
        setActiveLessonId(nextActive.id);
        setActiveGoal(nextActive.goal);
        setDraftGoal(nextActive.goal);
        setOutputs(nextActive.outputs);
      }
      return remaining;
    });
  };

  const handlePrintLessons = (lessons: SavedLesson[]) => {
    setCustomWorksheetPrintHtml(null);
    setPrintTargetLessons(lessons);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        window.print();
        setPrintTargetLessons(null);
      }, 60);
    });
  };

  const handlePrintWorksheetHtml = (combinedHtml: string) => {
    setCustomWorksheetPrintHtml(combinedHtml);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        window.print();
        setCustomWorksheetPrintHtml(null);
      }, 60);
    });
  };

  const handleFocusNewLesson = () => {
    setActiveTab('overview');
    setDraftGoal((prev) => ({ ...prev, topic: '' }));
    window.setTimeout(() => {
      if (topicInputRef.current) {
        topicInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        topicInputRef.current.focus();
      }
    }, 50);
  };

  const handleSelectTabFromHub = (tab: ActiveViewTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickDownloadWord = () => {
    if (!outputs.planner) return;
    downloadLessonPlanWord(activeGoal, outputs.planner, outputs, true);
  };

  // Gradebook handlers for active lesson
  const activeGradedStudents = gradebookByLesson[activeLessonId] || [];

  const handleAddGradedStudents = (records: GradedStudentRecord[]) => {
    setGradebookByLesson((prev) => {
      const existingList = [...(prev[activeLessonId] || [])];
      const prependNew: GradedStudentRecord[] = [];

      records.forEach((incoming) => {
        const normName = incoming.studentName.trim().toLowerCase();
        const normCode = incoming.studentCode.trim().toLowerCase();
        const matchIdx = existingList.findIndex((ex) => {
          const exName = ex.studentName.trim().toLowerCase();
          const exCode = ex.studentCode.trim().toLowerCase();
          const codeMatches =
            normCode &&
            !normCode.startsWith('№') &&
            exCode === normCode;
          const nameMatches =
            normName &&
            !normName.startsWith('сурагч #') &&
            exName === normName;
          return Boolean(codeMatches || nameMatches);
        });

        if (matchIdx >= 0) {
          const prevRec = existingList[matchIdx];
          existingList[matchIdx] = {
            ...incoming,
            id: prevRec.id,
            preScorePct:
              incoming.preScorePct ??
              prevRec.preScorePct ??
              prevRec.percentage,
            midScorePct:
              incoming.midScorePct ?? prevRec.percentage,
          };
        } else {
          prependNew.push(incoming);
        }
      });

      return {
        ...prev,
        [activeLessonId]: [...prependNew, ...existingList],
      };
    });
  };

  const handleUpdateGradedStudent = (
    studentId: string,
    patch: Partial<GradedStudentRecord>
  ) => {
    setGradebookByLesson((prev) => ({
      ...prev,
      [activeLessonId]: (prev[activeLessonId] || []).map((stu) =>
        stu.id === studentId ? { ...stu, ...patch } : stu
      ),
    }));
  };

  const handleRemoveGradedStudent = (studentId: string) => {
    setGradebookByLesson((prev) => ({
      ...prev,
      [activeLessonId]: (prev[activeLessonId] || []).filter(
        (s) => s.id !== studentId
      ),
    }));
  };

  const handleClearGradedStudents = () => {
    setGradebookByLesson((prev) => ({
      ...prev,
      [activeLessonId]: [],
    }));
  };

  const handleSendChat = async (message: string) => {
    const timeLabel = new Date().toLocaleTimeString('mn-MN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: timeLabel,
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setIsChatLoading(true);

    try {
      const response = await fetch('/api/bots/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: activeGoal,
          message,
          history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Алдаа гарлаа');
      }

      const replyMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString('mn-MN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setChatMessages((prev) => [...prev, replyMsg]);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'Холболтын алдаа гарлаа. Дахин оролдоно уу.';
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Уучлаарай, алдаа гарлаа: ${errMsg}`,
          timestamp: timeLabel,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const isAnyBotWorking = ALL_BOT_IDS.some(
    (id) => botStates[id].status === 'working'
  );

  return (
    <div id="top" className="min-h-screen flex flex-col">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200/90">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 lg:px-8 py-3.5">
          {/* Zone 1: Single wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            AI-87
          </a>

          {/* Zone 2: 5 concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'overview'
                  ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2 decoration-[#F97316]'
                  : 'hover:text-slate-900'
              }`}
            >
              Нэгдсэн самбар
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('planner')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'planner'
                  ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2 decoration-[#F97316]'
                  : 'hover:text-slate-900'
              }`}
            >
              Боловсруулагч
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('exercises')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'exercises'
                  ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2 decoration-[#F97316]'
                  : 'hover:text-slate-900'
              }`}
            >
              Бодлого дасгал
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'report'
                  ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2 decoration-[#F97316]'
                  : 'hover:text-slate-900'
              }`}
            >
              Рубрик
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('zipgrade')}
              className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'zipgrade'
                  ? 'text-slate-900 font-bold underline underline-offset-8 decoration-2 decoration-[#F97316]'
                  : 'hover:text-slate-900'
              }`}
            >
              ZipGrade Засагч
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleFocusNewLesson}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              Шинэ хичээл бэлтгэх
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main
        className={`no-print flex-1 max-w-[1360px] w-full mx-auto ${
          isEmbedMode
            ? 'px-2.5 sm:px-4 py-4'
            : 'px-4 sm:px-6 lg:px-8 py-6 sm:py-8'
        }`}
      >
        {activeTab === 'overview' ? (
          <UnifiedDashboard
            activeGoal={activeGoal}
            draftGoal={draftGoal}
            onChangeDraft={setDraftGoal}
            onRunAllBots={handleRunAllBots}
            isAnyBotWorking={isAnyBotWorking}
            topicInputRef={topicInputRef}
            savedLessons={savedLessons}
            activeLessonId={activeLessonId}
            onSelectSavedLesson={handleSelectSavedLesson}
            outputs={outputs}
            botStates={botStates}
            selectedTab={activeTab}
            onSelectTab={handleSelectTabFromHub}
            onRetryBot={handleRetryBot}
            gradedStudents={activeGradedStudents}
            gradebookByLesson={gradebookByLesson}
            chatMessages={chatMessages}
            onSendChat={handleSendChat}
            isChatLoading={isChatLoading}
            onPrint={() =>
              handlePrintLessons([
                {
                  id: activeLessonId,
                  createdAt: '',
                  goal: activeGoal,
                  outputs,
                  gradedStudents: activeGradedStudents,
                },
              ])
            }
            onPrintLessons={handlePrintLessons}
            onSaveCurrentToArchive={handleSaveCurrentToArchive}
            onDeleteArchivedLesson={handleDeleteArchivedLesson}
            onOpenEmbedModal={() => setIsEmbedModalOpen(true)}
            onOpenWorksheetModal={() => setIsWorksheetModalOpen(true)}
          />
        ) : (
          <div ref={outputTopRef} className="space-y-6">
            {/* Compact Colorful Lesson Context Ribbon when inside a Bot / ZipGrade tab */}
            <div className="rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#1E1B4B] text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Нэгдсэн самбар</span>
                </button>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-sky-300">
                    {activeGoal.subject} · {activeGoal.grade} · {activeGoal.durationMinutes} минут
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-white truncate">
                    {activeGoal.topic}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsWorksheetModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-xs font-bold text-teal-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5 text-teal-300" />
                  <span>Даалгаврын хуудас</span>
                </button>

                {outputs.planner && (
                  <button
                    type="button"
                    onClick={handleQuickDownloadWord}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-xs font-bold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Иж бүрэн Word (.doc) татах</span>
                  </button>
                )}
              </div>
            </div>

            <BotOutputPanel
              goal={activeGoal}
              outputs={outputs}
              botStates={botStates}
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              onRetryBot={handleRetryBot}
              chatMessages={chatMessages}
              onSendChat={handleSendChat}
              isChatLoading={isChatLoading}
              onPrint={() => window.print()}
              onOpenWorksheetModal={() => setIsWorksheetModalOpen(true)}
              gradedStudents={activeGradedStudents}
              onAddGradedStudents={handleAddGradedStudents}
              onUpdateGradedStudent={handleUpdateGradedStudent}
              onRemoveGradedStudent={handleRemoveGradedStudent}
              onClearGradedStudents={handleClearGradedStudents}
            />
          </div>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="no-print border-t border-slate-200/90 bg-white/60 py-5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>AI-87 — Дунд болон ахлах сургуулийн 6 боттой багшийн туслах ба ZipGrade автомат үнэлгээний систем</span>
          <div className="flex flex-wrap items-center gap-4">
            {isEmbedMode ? (
              <a
                href={standaloneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900 underline underline-offset-4 whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Бүтэн дэлгэцээр шинэ цонхонд нээх</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setIsEmbedModalOpen(true)}
                className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-900 underline underline-offset-4 cursor-pointer whitespace-nowrap"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Google Sites руу оруулах код авах</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="hover:text-slate-900 underline underline-offset-4 cursor-pointer whitespace-nowrap"
            >
              Хөтөлбөрийг хэвлэх / PDF хадгалах
            </button>
          </div>
        </div>
      </footer>

      {/* Google Sites Embed Wizard Modal */}
      <GoogleSitesEmbedModal
        isOpen={isEmbedModalOpen}
        onClose={() => setIsEmbedModalOpen(false)}
      />

      {/* Printable Student Worksheet Builder & Live A4 Preview Modal */}
      <StudentWorksheetModal
        isOpen={isWorksheetModalOpen}
        onClose={() => setIsWorksheetModalOpen(false)}
        goal={activeGoal}
        outputs={outputs}
        onPrintWorksheetHtml={handlePrintWorksheetHtml}
      />

      {/* Printable Official Lesson Plan OR Student Worksheet Sheet */}
      {customWorksheetPrintHtml ? (
        <div
          className="hidden print-only bg-white text-black p-6"
          dangerouslySetInnerHTML={{ __html: customWorksheetPrintHtml }}
        />
      ) : (
        <PrintLessonSheet
          lessonsToPrint={
            printTargetLessons && printTargetLessons.length > 0
              ? printTargetLessons
              : [
                  {
                    id: activeLessonId,
                    createdAt: '',
                    goal: activeGoal,
                    outputs,
                    gradedStudents: activeGradedStudents,
                  },
                ]
          }
          gradebookByLesson={gradebookByLesson}
        />
      )}
    </div>
  );
}
