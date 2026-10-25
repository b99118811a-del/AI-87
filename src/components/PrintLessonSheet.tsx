import React from 'react';
import { resolveStudentStageScores } from './AchievementCharts';
import { computeLessonResultSummary } from '../utils/pdfArchiveExport';
import type { GradedStudentRecord, SavedLesson } from '../types';

interface PrintLessonSheetProps {
  lessonsToPrint: SavedLesson[];
  gradebookByLesson: Record<string, GradedStudentRecord[]>;
}

export const PrintLessonSheet: React.FC<PrintLessonSheetProps> = ({
  lessonsToPrint,
  gradebookByLesson,
}) => {
  const optionLetters = ['А', 'Б', 'В', 'Г'];

  return (
    <div className="hidden print-only p-8 text-black bg-white space-y-10 text-sm">
      {lessonsToPrint.map((lesson, lessonIdx) => {
        const { goal, outputs } = lesson;
        const students =
          gradebookByLesson[lesson.id]?.length > 0
            ? gradebookByLesson[lesson.id]
            : lesson.gradedStudents || [];
        const stats = computeLessonResultSummary(students);

        return (
          <div
            key={lesson.id}
            style={{
              pageBreakBefore: lessonIdx > 0 ? 'always' : 'auto',
            }}
            className="space-y-5"
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span>БАТЛАВ: СУРГАЛТЫН МЕНЕЖЕР .................................</span>
              <span>
                AI-87 ХИЧЭЭЛИЙН АРХИВ{' '}
                {lessonsToPrint.length > 1
                  ? `(#${lessonIdx + 1}/${lessonsToPrint.length})`
                  : ''}
              </span>
            </div>

            <div className="border-b-2 border-black pb-4">
              <div className="text-xs font-semibold">
                AI-87 · ЭЭЛЖИТ ХИЧЭЭЛИЙН ИЖ БҮРЭН ТӨЛӨВЛӨЛТ БА ҮР ДҮНГИЙН ТАЙЛАН
              </div>
              <h1 className="text-2xl font-bold mt-1">{goal.topic}</h1>
              <p className="mt-1 text-xs">
                Хичээл: {goal.subject} · Анги: {goal.grade}
                {lesson.classGroup ? ` · Бүлэг: ${lesson.classGroup}` : ''} ·
                Хугацаа: {goal.durationMinutes} минут
                {lesson.savedDate ? ` · Огноо: ${lesson.savedDate}` : ''}
              </p>
              {lesson.teacherNote && (
                <p className="mt-1 text-xs">
                  Багшийн тэмдэглэл: {lesson.teacherNote}
                </p>
              )}
            </div>

            {outputs.planner && (
              <section className="space-y-3">
                <h2 className="text-base font-bold">
                  1. Хичээлийн ерөнхий мэдээлэл ба төлөвлөлтийн хүснэгт
                </h2>
                <table className="w-full border-collapse border border-black text-xs">
                  <tbody>
                    <tr>
                      <td className="border border-black p-2 font-semibold w-1/4">
                        Бүлэг сэдэв
                      </td>
                      <td className="border border-black p-2">
                        {outputs.planner.overview.unitName}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2 font-semibold">
                        Суралцахуйн зорилт
                      </td>
                      <td className="border border-black p-2">
                        {outputs.planner.overview.curriculumObjective}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2 font-semibold">
                        Арга зүй ба Хэрэглэгдэхүүн
                      </td>
                      <td className="border border-black p-2">
                        {outputs.planner.overview.methodology} |{' '}
                        {outputs.planner.overview.resources}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full border-collapse border border-black text-xs mt-3">
                  <thead>
                    <tr>
                      <th className="border border-black p-2 text-left">Үе шат</th>
                      <th className="border border-black p-2 text-right">Хугацаа</th>
                      <th className="border border-black p-2 text-left">Зорилт</th>
                      <th className="border border-black p-2 text-left">
                        Багшийн үйл ажиллагаа
                      </th>
                      <th className="border border-black p-2 text-left">
                        Сурагчийн үйл ажиллагаа
                      </th>
                      <th className="border border-black p-2 text-left">Үнэлгээ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outputs.planner.stagesTable.map((row, idx) => (
                      <tr key={idx}>
                        <td className="border border-black p-2 font-semibold">
                          {row.stageName}
                        </td>
                        <td className="border border-black p-2 text-right">
                          {row.durationMinutes} мин
                        </td>
                        <td className="border border-black p-2">
                          {row.learningObjective}
                        </td>
                        <td className="border border-black p-2">
                          {row.teacherActivity}
                        </td>
                        <td className="border border-black p-2">
                          {row.studentActivity}
                        </td>
                        <td className="border border-black p-2">
                          {row.assessmentCheck}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {outputs.report && (
              <section className="space-y-2">
                <h2 className="text-base font-bold">2. Үнэлгээний рубрик</h2>
                <table className="w-full border-collapse border border-black text-xs">
                  <thead>
                    <tr>
                      <th className="border border-black p-2 text-left">Шалгуур</th>
                      <th className="border border-black p-2 text-left">Маш сайн</th>
                      <th className="border border-black p-2 text-left">
                        Хангалттай
                      </th>
                      <th className="border border-black p-2 text-right">Оноо</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outputs.report.rubric.map((r, idx) => (
                      <tr key={idx}>
                        <td className="border border-black p-2 font-semibold">
                          {r.criterion}
                        </td>
                        <td className="border border-black p-2">{r.excellent}</td>
                        <td className="border border-black p-2">{r.proficient}</td>
                        <td className="border border-black p-2 text-right">
                          {r.maxScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {outputs.answers && (
              <section className="space-y-2">
                <h2 className="text-base font-bold">
                  3. Мэдлэг шалгах сорил ба түлхүүр
                </h2>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                  {outputs.answers.multipleChoiceQuiz.map((q) => (
                    <li key={q.questionNumber}>
                      <div>{q.question}</div>
                      <div>
                        {q.options
                          .map((opt, idx) => `${optionLetters[idx] || idx + 1}) ${opt}`)
                          .join('   ')}
                      </div>
                      <div className="font-semibold">
                        Зөв хариулт: {optionLetters[q.correctIndex]} —{' '}
                        {q.explanation}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {students.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-base font-bold">
                  4. Хичээлийн үр дүн ба сурагчдын үнэлгээний тайлан (ZipGrade)
                </h2>
                <p className="text-xs font-semibold">
                  Нийт сурагч: {stats.studentCount} · Ангийн дундаж:{' '}
                  {stats.avgFinal}% · Сургалтын чанар (≥80%): {stats.qualityPct}% ·
                  Дундаж ахиц: {stats.avgDelta >= 0 ? '+' : ''}
                  {stats.avgDelta}%
                </p>
                <table className="w-full border-collapse border border-black text-xs">
                  <thead>
                    <tr>
                      <th className="border border-black p-1.5 text-left">Код</th>
                      <th className="border border-black p-1.5 text-left">
                        Сурагчийн нэр
                      </th>
                      <th className="border border-black p-1.5 text-right">
                        Гараа
                      </th>
                      <th className="border border-black p-1.5 text-right">Явц</th>
                      <th className="border border-black p-1.5 text-right">
                        Төгсгөл
                      </th>
                      <th className="border border-black p-1.5 text-right">
                        Ахиц
                      </th>
                      <th className="border border-black p-1.5 text-left">
                        Түвшин
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((stu) => {
                      const st = resolveStudentStageScores(stu);
                      return (
                        <tr key={stu.id}>
                          <td className="border border-black p-1.5">
                            {stu.studentCode}
                          </td>
                          <td className="border border-black p-1.5 font-semibold">
                            {stu.studentName}
                          </td>
                          <td className="border border-black p-1.5 text-right">
                            {st.pre}%
                          </td>
                          <td className="border border-black p-1.5 text-right">
                            {st.mid}%
                          </td>
                          <td className="border border-black p-1.5 text-right font-bold">
                            {st.final}%
                          </td>
                          <td className="border border-black p-1.5 text-right">
                            {st.delta >= 0 ? '+' : ''}
                            {st.delta}%
                          </td>
                          <td className="border border-black p-1.5">
                            {stu.rubricLevel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        );
      })}
    </div>
  );
};
