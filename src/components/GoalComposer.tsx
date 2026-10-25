import React, { useState } from 'react';
import { Clock, Play, RotateCcw } from 'lucide-react';
import type { LessonGoal, SavedLesson } from '../types';
import {
  ALL_SUBJECTS,
  GRADE_GROUPS,
  PRESET_GOALS,
  SUBJECT_GROUPS,
} from '../data/sampleLesson';

interface GoalComposerProps {
  draftGoal: LessonGoal;
  onChangeDraft: (updated: LessonGoal) => void;
  onRunAllBots: (goalToRun?: LessonGoal) => void;
  isRunning: boolean;
  topicInputRef: React.RefObject<HTMLInputElement | null>;
  savedLessons: SavedLesson[];
  activeLessonId: string;
  onSelectSavedLesson: (lesson: SavedLesson) => void;
}

const CUSTOM_SUBJECT_VALUE = '__CUSTOM_SUBJECT__';

const PRESET_ACCENTS = [
  'bg-sky-50 hover:bg-sky-100 text-sky-900 border-sky-200',
  'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200',
  'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200',
  'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200',
  'bg-teal-50 hover:bg-teal-100 text-teal-900 border-teal-200',
  'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200',
];

export const GoalComposer: React.FC<GoalComposerProps> = ({
  draftGoal,
  onChangeDraft,
  onRunAllBots,
  isRunning,
  topicInputRef,
  savedLessons,
  activeLessonId,
  onSelectSavedLesson,
}) => {
  const isCustomSubject =
    draftGoal.subject !== '' && !ALL_SUBJECTS.includes(draftGoal.subject);
  const [customMode, setCustomMode] = useState<boolean>(isCustomSubject);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftGoal.topic.trim() || !draftGoal.subject.trim() || isRunning) return;
    onRunAllBots(draftGoal);
  };

  return (
    <section className="h-full flex flex-col justify-between rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-7 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div>
        <div className="flex items-baseline justify-between gap-4 pb-4 mb-5 border-b border-slate-100">
          <div>
            <div className="text-xs font-bold text-[#EA580C]">
              Шинэ хичээл үүсгэгч · 6–12-р анги
            </div>
            <h2 className="mt-0.5 text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Нэг зорилго тодорхойлох
            </h2>
          </div>
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Бүх судлагдахуун
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="lesson-topic-input"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Хичээлийн сэдэв ба гол зорилго
            </label>
            <input
              ref={topicInputRef}
              id="lesson-topic-input"
              type="text"
              value={draftGoal.topic}
              onChange={(e) => onChangeDraft({ ...draftGoal, topic: e.target.value })}
              placeholder="Жишээ нь: Квадрат тэгшитгэл, Монголын нууц товчоо, Омын хууль..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#F97316] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="lesson-subject-select"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Хичээл
              </label>
              <select
                id="lesson-subject-select"
                value={customMode ? CUSTOM_SUBJECT_VALUE : draftGoal.subject}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === CUSTOM_SUBJECT_VALUE) {
                    setCustomMode(true);
                    onChangeDraft({ ...draftGoal, subject: '' });
                  } else {
                    setCustomMode(false);
                    onChangeDraft({ ...draftGoal, subject: val });
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-[#F97316] focus:bg-white focus:outline-none"
              >
                {SUBJECT_GROUPS.map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.subjects.map((subj) => (
                      <option key={subj} value={subj}>
                        {subj}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <optgroup label="Нэмэлт / Дугуйлан">
                  <option value={CUSTOM_SUBJECT_VALUE}>
                    Бусад сонгон / Дугуйлан бичих...
                  </option>
                </optgroup>
              </select>
            </div>

            <div>
              <label
                htmlFor="lesson-grade-select"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Анги
              </label>
              <select
                id="lesson-grade-select"
                value={draftGoal.grade}
                onChange={(e) => onChangeDraft({ ...draftGoal, grade: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-medium text-slate-900 focus:border-[#F97316] focus:bg-white focus:outline-none"
              >
                {GRADE_GROUPS.map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.grades.map((gr) => (
                      <option key={gr} value={gr}>
                        {gr}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="lesson-duration-select"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Хугацаа
              </label>
              <select
                id="lesson-duration-select"
                value={draftGoal.durationMinutes}
                onChange={(e) =>
                  onChangeDraft({
                    ...draftGoal,
                    durationMinutes: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-medium text-slate-900 tabular-nums focus:border-[#F97316] focus:bg-white focus:outline-none"
              >
                <option value={40}>40 мин (Ээлжит)</option>
                <option value={80}>80 мин (Хос цаг)</option>
                <option value={35}>35 мин (Богино)</option>
                <option value={90}>90 мин (Гүнзгий)</option>
              </select>
            </div>
          </div>

          {customMode && (
            <div>
              <label
                htmlFor="custom-subject-input"
                className="block text-xs font-bold text-slate-700 mb-1.5"
              >
                Сонгон судлах хичээл / Дугуйлангийн нэр
              </label>
              <input
                id="custom-subject-input"
                type="text"
                value={draftGoal.subject}
                onChange={(e) => onChangeDraft({ ...draftGoal, subject: e.target.value })}
                placeholder="Жишээ нь: Робот техник, Шатар, Мэтгэлцээн, Экологи..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#F97316] focus:bg-white focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label
              htmlFor="lesson-focus-input"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Нэмэлт чиглэл (заавал биш)
            </label>
            <input
              id="lesson-focus-input"
              type="text"
              value={draftGoal.focusNote || ''}
              onChange={(e) =>
                onChangeDraft({ ...draftGoal, focusNote: e.target.value })
              }
              placeholder="Жишээ нь: ЭЕШ-ийн жишиг бодлого оруулах, багаар туршилт хийх..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#F97316] focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={
                isRunning || !draftGoal.topic.trim() || !draftGoal.subject.trim()
              }
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-[#EA580C] hover:to-[#C2410C] disabled:opacity-60 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition-all duration-150 cursor-pointer whitespace-nowrap"
            >
              {isRunning ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>6 AI бот зэрэг боловсруулж байна...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>6 AI ботыг зэрэг ажиллуулах</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Bottom Preset Subjects & Lesson History */}
      <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
        <div>
          <div className="text-xs font-bold text-slate-600 mb-2.5">
            Бэлэн жишээ сэдвүүдээр шууд турших:
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_GOALS.map((preset, idx) => (
              <button
                key={preset.topic}
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setCustomMode(false);
                  onChangeDraft(preset);
                  onRunAllBots(preset);
                }}
                className={`text-left px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 truncate max-w-[230px] ${
                  PRESET_ACCENTS[idx % PRESET_ACCENTS.length]
                }`}
                title={`${preset.subject} (${preset.grade}): ${preset.topic}`}
              >
                {preset.grade} · {preset.subject}
              </button>
            ))}
          </div>
        </div>

        {savedLessons.length > 1 && (
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Өмнөх хичээлүүд ({savedLessons.length})</span>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
              {savedLessons.map((item) => {
                const active = item.id === activeLessonId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCustomMode(!ALL_SUBJECTS.includes(item.goal.subject));
                      onSelectSavedLesson(item);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      active
                        ? 'bg-orange-50 text-orange-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="truncate">
                      {item.goal.subject} · {item.goal.topic}
                    </span>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0 tabular-nums">
                      {item.goal.grade}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
