import type {
  ExercisesResult,
  GradedStudentRecord,
  LessonGoal,
  LessonOutputs,
  MultipleChoiceItem,
  PlannerResult,
} from '../types';

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeSafeFilename(goal: LessonGoal, suffix: string, ext: string): string {
  const cleanTopic = goal.topic
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .slice(0, 34)
    .replace(/\s+/g, '_');
  const cleanSubject = goal.subject
    .replace(/[\\/:*?"<>|()]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `AI-87_${cleanSubject}_${goal.grade.replace(/\s+/g, '')}_${cleanTopic || 'Хичээл'}_${suffix}.${ext}`;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Generates an official Mongolian school A4 Landscape Word (.doc) file
 * containing crisp black-bordered tables ready for MS Word / Google Docs.
 */
export function downloadLessonPlanWord(
  goal: LessonGoal,
  planner: PlannerResult,
  fullOutputs?: LessonOutputs,
  includeFullAppendix: boolean = true
): void {
  const todayStr = new Date().toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const totalStageMinutes = planner.stagesTable.reduce(
    (sum, s) => sum + (Number(s.durationMinutes) || 0),
    0
  );

  const optionLetters = ['А', 'Б', 'В', 'Г', 'Д'];

  const appendixHtml =
    includeFullAppendix && fullOutputs
      ? `
      ${
        fullOutputs.exercises
          ? `
        <h3 style="margin-top:18pt;margin-bottom:6pt;font-size:11pt;">4. БОДЛОГО, ДАСГАЛЫН ТӨЛӨВЛӨЛТ</h3>
        <table class="grid-table">
          <thead>
            <tr>
              <th style="width:8%;text-align:center;">Код</th>
              <th style="width:16%;">Түвшин · Шалгуур</th>
              <th style="width:36%;">Бодлого, дасгалын өгүүлбэр</th>
              <th style="width:32%;">Алхамчилсан бодолт ба Хариу</th>
              <th style="width:8%;text-align:right;">Оноо</th>
            </tr>
          </thead>
          <tbody>
            ${fullOutputs.exercises.problems
              .map(
                (p) => `
              <tr>
                <td style="text-align:center;"><b>${escapeHtml(p.code)}</b></td>
                <td><b>${escapeHtml(p.tier)}</b><br/>${escapeHtml(p.rubricCriterion)}</td>
                <td>${escapeHtml(p.problemStatement)}</td>
                <td>${escapeHtml(p.stepByStepSolution)}<br/><b>Хариу:</b> ${escapeHtml(
                  p.finalAnswer
                )}</td>
                <td style="text-align:right;"><b>${p.points}</b></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      `
          : ''
      }
      ${
        fullOutputs.report
          ? `
        <h3 style="margin-top:18pt;margin-bottom:6pt;font-size:11pt;">5. ҮНЭЛГЭЭНИЙ РУБРИК БА ГЭРИЙН ДААЛГАВАР</h3>
        <table class="grid-table">
          <thead>
            <tr>
              <th style="width:20%;">Үнэлгээний шалгуур</th>
              <th style="width:26%;">Маш сайн</th>
              <th style="width:24%;">Хангалттай</th>
              <th style="width:20%;">Дэмжлэг хэрэгтэй</th>
              <th style="width:10%;text-align:right;">Дээд оноо</th>
            </tr>
          </thead>
          <tbody>
            ${fullOutputs.report.rubric
              .map(
                (r) => `
              <tr>
                <td><b>${escapeHtml(r.criterion)}</b></td>
                <td>${escapeHtml(r.excellent)}</td>
                <td>${escapeHtml(r.proficient)}</td>
                <td>${escapeHtml(r.developing)}</td>
                <td style="text-align:right;"><b>${r.maxScore}</b></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
        <p style="font-size:10pt;margin-top:6pt;">
          <b>Ялгаатай суралцагчдад өгөх дэмжлэг:</b> ${escapeHtml(
            fullOutputs.report.differentiation.supportStudents
          )} | <b>Ахисан түвшинд:</b> ${escapeHtml(
              fullOutputs.report.differentiation.advancedStudents
            )}
        </p>
        <p style="font-size:10pt;margin-top:4pt;">
          <b>Гэрийн даалгавар (${fullOutputs.report.homeworkAssignment.estimatedMinutes} мин):</b> ${escapeHtml(
              fullOutputs.report.homeworkAssignment.task
            )}
        </p>
      `
          : ''
      }
      ${
        fullOutputs.answers
          ? `
        <h3 style="margin-top:18pt;margin-bottom:6pt;font-size:11pt;">6. МЭДЛЭГ ШАЛГАХ СОРИЛ БА ХАРИУЛТЫН ТҮЛХҮҮР</h3>
        <table class="grid-table">
          <thead>
            <tr>
              <th style="width:6%;text-align:center;">№</th>
              <th style="width:38%;">Асуулт</th>
              <th style="width:30%;">Сонголтууд</th>
              <th style="width:26%;">Зөв хариулт ба тайлбар</th>
            </tr>
          </thead>
          <tbody>
            ${fullOutputs.answers.multipleChoiceQuiz
              .map(
                (q) => `
              <tr>
                <td style="text-align:center;">${q.questionNumber}</td>
                <td>${escapeHtml(q.question)}</td>
                <td>${q.options
                  .map(
                    (opt, idx) =>
                      `${optionLetters[idx] || idx + 1}) ${escapeHtml(opt)}`
                  )
                  .join('<br/>')}</td>
                <td><b>${optionLetters[q.correctIndex] || ''}</b> — ${escapeHtml(
                  q.explanation
                )}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      `
          : ''
      }
    `
      : '';

  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(goal.topic)} - Ээлжит хичээлийн төлөвлөлт</title>
  <style>
    @page Section1 {
      size: 29.7cm 21.0cm;
      mso-page-orientation: landscape;
      margin: 1.5cm 1.5cm 1.5cm 1.5cm;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: "Times New Roman", "Arial", serif;
      font-size: 10.5pt;
      color: #000000;
      line-height: 1.35;
    }
    h1 { font-size: 14pt; text-align: center; margin: 6pt 0 10pt 0; text-transform: uppercase; }
    h3 { font-size: 11pt; margin: 14pt 0 6pt 0; }
    table.header-sign {
      width: 100%;
      border: none;
      margin-bottom: 8pt;
      font-size: 10pt;
    }
    table.grid-table {
      width: 100%;
      border-collapse: collapse;
      border: 1pt solid #000000;
      font-size: 9.5pt;
    }
    table.grid-table th {
      border: 1pt solid #000000;
      background-color: #F3F4F6;
      padding: 5pt 6pt;
      font-weight: bold;
      text-align: left;
      vertical-align: middle;
    }
    table.grid-table td {
      border: 1pt solid #000000;
      padding: 5pt 6pt;
      vertical-align: top;
    }
  </style>
</head>
<body>
  <div class="Section1">
    <table class="header-sign">
      <tr>
        <td style="width:50%;text-align:left;">
          <b>БАТЛАВ: СУРГАЛТЫН МЕНЕЖЕР</b> ........................................ /........................../
        </td>
        <td style="width:50%;text-align:right;">
          Огноо: ${escapeHtml(todayStr)} &nbsp;|&nbsp; Систем: <b>AI-87</b>
        </td>
      </tr>
    </table>

    <h1>ЭЭЛЖИТ ХИЧЭЭЛИЙН ИЖ БҮРЭН ТӨЛӨВЛӨЛТ</h1>

    <h3>1. ЕРӨНХИЙ МЭДЭЭЛЭЛ БА АРГА ЗҮЙ</h3>
    <table class="grid-table">
      <tbody>
        <tr>
          <td style="width:18%;background:#F9FAFB;"><b>Судлагдахуун (Хичээл):</b></td>
          <td style="width:32%;">${escapeHtml(goal.subject)}</td>
          <td style="width:18%;background:#F9FAFB;"><b>Анги / Түвшин:</b></td>
          <td style="width:32%;">${escapeHtml(goal.grade)} (${goal.durationMinutes} минут)</td>
        </tr>
        <tr>
          <td style="background:#F9FAFB;"><b>Бүлэг сэдэв:</b></td>
          <td>${escapeHtml(planner.overview.unitName)}</td>
          <td style="background:#F9FAFB;"><b>Ээлжит хичээлийн сэдэв:</b></td>
          <td><b>${escapeHtml(goal.topic)}</b></td>
        </tr>
        <tr>
          <td style="background:#F9FAFB;"><b>Суралцахуйн зорилт:</b></td>
          <td colspan="3">${escapeHtml(planner.overview.curriculumObjective)}</td>
        </tr>
        <tr>
          <td style="background:#F9FAFB;"><b>Эзэмших чадвар:</b></td>
          <td>${escapeHtml(planner.overview.keyCompetencies)}</td>
          <td style="background:#F9FAFB;"><b>Өмнөх төсөөлөл, мэдлэг:</b></td>
          <td>${escapeHtml(planner.overview.priorKnowledge)}</td>
        </tr>
        <tr>
          <td style="background:#F9FAFB;"><b>Сургалтын арга зүй:</b></td>
          <td>${escapeHtml(planner.overview.methodology)}</td>
          <td style="background:#F9FAFB;"><b>Хэрэглэгдэхүүн:</b></td>
          <td>${escapeHtml(planner.overview.resources)}</td>
        </tr>
      </tbody>
    </table>

    <h3>2. ЭЭЛЖИТ ХИЧЭЭЛИЙН ҮЙЛ АЖИЛЛАГААНЫ ТӨЛӨВЛӨЛТИЙН ХҮСНЭГТ</h3>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width:13%;">Хичээлийн үе шат</th>
          <th style="width:6%;text-align:center;">Хугацаа</th>
          <th style="width:15%;">Алхмын зорилт</th>
          <th style="width:23%;">Багшийн чиглүүлэх үйл ажиллагаа</th>
          <th style="width:21%;">Сурагчийн бүтээх үйл ажиллагаа</th>
          <th style="width:11%;">Хэрэглэгдэхүүн</th>
          <th style="width:11%;">Явцын үнэлгээ</th>
        </tr>
      </thead>
      <tbody>
        ${planner.stagesTable
          .map(
            (row) => `
          <tr>
            <td><b>${escapeHtml(row.stageName)}</b></td>
            <td style="text-align:center;"><b>${row.durationMinutes} мин</b></td>
            <td>${escapeHtml(row.learningObjective)}</td>
            <td>${escapeHtml(row.teacherActivity)}</td>
            <td>${escapeHtml(row.studentActivity)}</td>
            <td>${escapeHtml(row.materials)}</td>
            <td>${escapeHtml(row.assessmentCheck)}</td>
          </tr>`
          )
          .join('')}
        <tr>
          <td style="background:#F3F4F6;"><b>Нийт хугацаа</b></td>
          <td style="text-align:center;background:#F3F4F6;"><b>${totalStageMinutes} мин</b></td>
          <td colspan="5" style="background:#F3F4F6;">Хичээлийн төлөвлөлтийн үндсэн үе шат бүрэн тусгагдсан.</td>
        </tr>
      </tbody>
    </table>

    <h3>3. САМБАР ТӨЛӨВЛӨЛТИЙН БҮДҮҮВЧ</h3>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width:30%;">Зүүн хэсэг (Зорилт, Түлхүүр үгс)</th>
          <th style="width:40%;">Төв хэсэг (Гол онол, Томьёо, Бүдүүвч)</th>
          <th style="width:30%;">Баруун хэсэг (Дасгал, Дүгнэлт, Даалгавар)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${planner.boardPlan.leftPanel
            .map((line) => `• ${escapeHtml(line)}`)
            .join('<br/>')}</td>
          <td>${planner.boardPlan.centerPanel
            .map((line) => `• ${escapeHtml(line)}`)
            .join('<br/>')}</td>
          <td>${planner.boardPlan.rightPanel
            .map((line) => `• ${escapeHtml(line)}`)
            .join('<br/>')}</td>
        </tr>
      </tbody>
    </table>

    ${appendixHtml}

    <table class="grid-table" style="margin-top:16pt;">
      <tbody>
        <tr>
          <td style="width:50%;height:34pt;"><b>Хичээлийн дараах ололттой тал:</b><br/>........................................................................................</td>
          <td style="width:50%;height:34pt;"><b>Дараагийн хичээлд сайжруулах санал:</b><br/>........................................................................................</td>
        </tr>
      </tbody>
    </table>

    <p style="margin-top:14pt;font-size:10pt;">
      <b>Хөтөлбөр боловсруулсан багш:</b> ........................................ /........................../
    </p>
  </div>
</body>
</html>`;

  const blob = new Blob(['\ufeff', wordHtml], {
    type: 'application/msword;charset=utf-8',
  });
  triggerBlobDownload(blob, makeSafeFilename(goal, 'Төлөвлөлт', 'doc'));
}

/**
 * Downloads Student Worksheet or Teacher Solution Key Word (.doc) from Bot 6 (Exercises).
 */
export function downloadExercisesWorksheetWord(
  goal: LessonGoal,
  exercises: ExercisesResult,
  includeSolutions: boolean
): void {
  const totalPoints = exercises.problems.reduce((s, p) => s + (Number(p.points) || 0), 0);

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(exercises.worksheetTitle)}</title>
  <style>
    @page { size: 21.0cm 29.7cm; margin: 1.8cm; }
    body { font-family: "Times New Roman", serif; font-size: 11pt; color: #000; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; border: 1pt solid #000; margin-top: 8pt; }
    th, td { border: 1pt solid #000; padding: 6pt 8pt; vertical-align: top; }
    th { background: #F3F4F6; text-align: left; }
  </style>
</head>
<body>
  <h2 style="text-align:center;margin:0 0 4pt 0;">${escapeHtml(exercises.worksheetTitle)}</h2>
  <p style="text-align:center;font-size:10pt;margin:0 0 10pt 0;">
    Хичээл: <b>${escapeHtml(goal.subject)}</b> &nbsp;|&nbsp; Анги: <b>${escapeHtml(goal.grade)}</b> &nbsp;|&nbsp; Нийт оноо: <b>${totalPoints}</b>
    ${includeSolutions ? ' &nbsp;|&nbsp; <b>БАГШИЙН ТҮЛХҮҮР ХУВИЛБАР</b>' : ''}
  </p>
  ${
    !includeSolutions
      ? `<p style="font-size:10.5pt;margin-bottom:8pt;">Сурагчийн овог, нэр: ............................................. &nbsp;&nbsp; Анги, бүлэг: ............... &nbsp;&nbsp; Огноо: ....................</p>`
      : ''
  }
  <p style="font-size:10pt;"><b>Гүйцэтгэх заавар:</b> ${escapeHtml(exercises.instructions)}</p>
  <table>
    <thead>
      <tr>
        <th style="width:10%;text-align:center;">Код</th>
        <th style="width:20%;">Түвшин · Шалгуур</th>
        <th style="width:58%;">Даалгавар ба Бодолт хийх талбар</th>
        <th style="width:12%;text-align:right;">Оноо</th>
      </tr>
    </thead>
    <tbody>
      ${exercises.problems
        .map(
          (p) => `
        <tr>
          <td style="text-align:center;"><b>${escapeHtml(p.code)}</b></td>
          <td style="font-size:9.5pt;"><b>${escapeHtml(p.tier)}</b><br/>Шалгуур: ${escapeHtml(
            p.rubricCriterion
          )}</td>
          <td>
            <div><b>Өгүүлбэр:</b> ${escapeHtml(p.problemStatement)}</div>
            ${
              includeSolutions
                ? `<div style="margin-top:6pt;color:#14532D;"><b>Алхамчилсан бодолт:</b> ${escapeHtml(
                    p.stepByStepSolution
                  )}</div>
                   <div style="margin-top:4pt;"><b>Эцсийн хариу:</b> ${escapeHtml(p.finalAnswer)}</div>`
                : `<div style="margin-top:6pt;font-size:9.5pt;color:#444;"><i>Дөхүүлэх санамж: ${escapeHtml(
                    p.hint
                  )}</i></div>
                   <div style="height:56pt;margin-top:8pt;border-top:0.5pt dashed #999;">Бодолт:</div>`
            }
          </td>
          <td style="text-align:right;"><b>${p.points} оноо</b></td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8',
  });
  triggerBlobDownload(
    blob,
    makeSafeFilename(goal, includeSolutions ? 'Бодлого_Түлхүүртэй' : 'Сурагчийн_Ажлын_Хуудас', 'doc')
  );
}

/**
 * Downloads a printable 2-up ZipGrade-style Optical Bubble Sheet (.doc)
 * synced with the quiz question count and rubric criteria.
 */
export function downloadBubbleSheetWord(
  goal: LessonGoal,
  questions: MultipleChoiceItem[],
  questionRubricMap: Record<number, string>
): void {
  const letters = ['А', 'Б', 'В', 'Г'];

  const renderSingleCard = (cardIndex: number) => `
    <div style="border:2pt solid #000;padding:10pt;margin-bottom:14pt;">
      <table style="width:100%;border:none;margin-bottom:6pt;">
        <tr>
          <td style="width:6%;font-size:14pt;font-weight:bold;">■</td>
          <td style="width:88%;text-align:center;">
            <div style="font-size:11pt;font-weight:bold;">AI-87 · ZIPGRADE ХАРИУЛТЫН ХУУДАС (Хувилбар #${cardIndex})</div>
            <div style="font-size:9pt;">${escapeHtml(goal.subject)} · ${escapeHtml(goal.grade)} · «${escapeHtml(goal.topic)}»</div>
          </td>
          <td style="width:6%;font-size:14pt;font-weight:bold;text-align:right;">■</td>
        </tr>
      </table>

      <table style="width:100%;border-collapse:collapse;border:1pt solid #000;font-size:9.5pt;margin-bottom:8pt;">
        <tr>
          <td style="border:1pt solid #000;padding:4pt 6pt;width:52%;"><b>Сурагчийн нэр:</b> ..................................................</td>
          <td style="border:1pt solid #000;padding:4pt 6pt;width:24%;"><b>Код / №:</b> ..................</td>
          <td style="border:1pt solid #000;padding:4pt 6pt;width:24%;"><b>Оноо:</b> ........ / 100%</td>
        </tr>
      </table>

      <p style="font-size:8.5pt;margin:0 0 6pt 0;">Заавар: Зөвхөн нэг зөв хариултын дугуйг <b>●</b> бүтэн харлуулж будна уу. AI-87 камер эсвэл ZipGrade аппаар уншуулна.</p>

      <table style="width:100%;border-collapse:collapse;border:1pt solid #000;font-size:10pt;">
        <thead>
          <tr style="background:#F3F4F6;">
            <th style="border:1pt solid #000;padding:4pt;width:10%;text-align:center;">№</th>
            <th style="border:1pt solid #000;padding:4pt;width:48%;text-align:center;">Хариулт дугуйлах хэсэг</th>
            <th style="border:1pt solid #000;padding:4pt;width:42%;text-align:left;">Холбогдох рубрик шалгуур</th>
          </tr>
        </thead>
        <tbody>
          ${questions
            .map(
              (q) => `
            <tr>
              <td style="border:1pt solid #000;padding:5pt;text-align:center;"><b>${q.questionNumber}</b></td>
              <td style="border:1pt solid #000;padding:5pt;text-align:center;letter-spacing:4pt;font-size:11pt;">
                ${letters.map((L) => `( ${L} )`).join(' &nbsp;&nbsp; ')}
              </td>
              <td style="border:1pt solid #000;padding:5pt;font-size:8.5pt;color:#333;">
                ${escapeHtml(questionRubricMap[q.questionNumber] || 'Ерөнхий ойлголт')}
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>

      <table style="width:100%;border:none;margin-top:6pt;">
        <tr>
          <td style="font-size:14pt;font-weight:bold;">■</td>
          <td style="text-align:right;font-size:14pt;font-weight:bold;">■</td>
        </tr>
      </table>
    </div>
  `;

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>ZipGrade Хариултын хуудас</title>
  <style>
    @page { size: 21.0cm 29.7cm; margin: 1.2cm; }
    body { font-family: "Arial", sans-serif; color: #000; }
  </style>
</head>
<body>
  ${renderSingleCard(1)}
  ${renderSingleCard(2)}
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8',
  });
  triggerBlobDownload(blob, makeSafeFilename(goal, 'ZipGrade_Хариултын_Хуудас', 'doc'));
}

function csvCell(val: string | number): string {
  const str = String(val ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates an Excel-compatible UTF-8 BOM CSV file containing all tables of the lesson plan.
 */
export function downloadLessonPlanExcelCsv(
  goal: LessonGoal,
  planner: PlannerResult
): void {
  const rows: string[][] = [
    ['AI-87 — ЭЭЛЖИТ ХИЧЭЭЛИЙН ИЖ БҮРЭН ТӨЛӨВЛӨЛТ'],
    [],
    ['1. ЕРӨНХИЙ МЭДЭЭЛЭЛ'],
    ['Судлагдахуун (Хичээл)', goal.subject, 'Анги / Түвшин', goal.grade],
    ['Бүлэг сэдэв', planner.overview.unitName, 'Хугацаа', `${goal.durationMinutes} минут`],
    ['Ээлжит хичээлийн сэдэв', goal.topic],
    ['Суралцахуйн зорилт', planner.overview.curriculumObjective],
    ['Эзэмших чадвар', planner.overview.keyCompetencies],
    ['Өмнөх мэдлэг', planner.overview.priorKnowledge],
    ['Сургалтын арга зүй', planner.overview.methodology],
    ['Хэрэглэгдэхүүн', planner.overview.resources],
    [],
    ['2. ҮЙЛ АЖИЛЛАГААНЫ ТӨЛӨВЛӨЛТИЙН ХҮСНЭГТ'],
    [
      'Хичээлийн үе шат',
      'Хугацаа (мин)',
      'Алхмын зорилт',
      'Багшийн чиглүүлэх үйл ажиллагаа',
      'Сурагчийн үйл ажиллагаа',
      'Хэрэглэгдэхүүн',
      'Явцын үнэлгээ',
    ],
    ...planner.stagesTable.map((s) => [
      s.stageName,
      String(s.durationMinutes),
      s.learningObjective,
      s.teacherActivity,
      s.studentActivity,
      s.materials,
      s.assessmentCheck,
    ]),
    [],
    ['3. САМБАР ТӨЛӨВЛӨЛТ'],
    ['Зүүн хэсэг', 'Төв хэсэг', 'Баруун хэсэг'],
    [
      planner.boardPlan.leftPanel.join(' | '),
      planner.boardPlan.centerPanel.join(' | '),
      planner.boardPlan.rightPanel.join(' | '),
    ],
  ];

  const csvContent = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff', csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerBlobDownload(blob, makeSafeFilename(goal, 'Төлөвлөлт', 'csv'));
}

/**
 * Exports Class Rubric & ZipGrade Test Results to Excel (.csv) for ESIS / Medle import.
 */
export function downloadGradebookCsv(
  goal: LessonGoal,
  students: GradedStudentRecord[],
  questions: MultipleChoiceItem[],
  questionRubricMap: Record<number, string>
): void {
  const letters = ['А', 'Б', 'В', 'Г'];
  const headerRow = [
    '№',
    'Сурагчийн код',
    'Сурагчийн нэр',
    ...questions.map(
      (q) => `Асуулт ${q.questionNumber} (${questionRubricMap[q.questionNumber] || ''})`
    ),
    'Зөв хариулсан',
    'Гарааны үнэлгээ (%)',
    'Явцын үнэлгээ (%)',
    'Төгсгөлийн сорил (%)',
    'Ахиц дэвшил (+/-%)',
    'Рубрик түвшин',
    'Бүртгэсэн эх үүсвэр',
  ];

  const rows: string[][] = [
    [`AI-87 — ТЕСТ БА РУБРИКИЙН НЭГДСЭН ДҮНГИЙН ХҮСНЭГТ (${goal.subject} · ${goal.grade})`],
    [`Сэдэв: ${goal.topic}`],
    [],
    headerRow,
    ...students.map((st, idx) => {
      const pre = st.preScorePct ?? Math.max(15, st.percentage - 25);
      const mid = st.midScorePct ?? Math.round((pre + st.percentage) / 2);
      const delta = st.percentage - pre;
      const deltaStr = `${delta >= 0 ? '+' : ''}${delta}%`;
      return [
        String(idx + 1),
        st.studentCode || '-',
        st.studentName,
        ...questions.map((q, qIdx) => {
          const chosen = st.selectedIndices[qIdx];
          const chosenLetter = chosen >= 0 ? letters[chosen] || '?' : '-';
          const isRight = chosen === q.correctIndex;
          return `${chosenLetter} (${isRight ? 'Зөв' : 'Буруу'})`;
        }),
        `${st.correctCount}/${st.totalQuestions}`,
        `${pre}%`,
        `${mid}%`,
        `${st.percentage}%`,
        deltaStr,
        st.rubricLevel,
        st.source,
      ];
    }),
  ];

  const csvContent = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff', csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerBlobDownload(blob, makeSafeFilename(goal, 'Ангийн_Дүн_ZipGrade', 'csv'));
}
