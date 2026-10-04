import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://sajidaturseb.github.io",
  "http://127.0.0.1:4180", "http://localhost:4180",
  "http://127.0.0.1:4182", "http://localhost:4182",
]);
// The answer key is kept on the server as well as in the student-facing lesson data.
const answerKeys = [
  "0100222", "1001000", "2221020", "2102010", "0211222",
  "0210121", "2101111", "2122220", "0222211", "2102201",
  "2111112", "2010110", "2202021", "2201111", "0122021",
  "2102102", "2102102", "0100121", "2001001", "0210002",
  "1101111", "1200012", "2021010", "0121002", "0202000",
];
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function respond(request: Request, body: unknown, status = 200) {
  const origin = request.headers.get("origin") ?? "";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://sajidaturseb.github.io",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-teacher-pin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json; charset=utf-8",
      "Vary": "Origin",
    },
  });
}
function text(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }
function integer(value: unknown, min: number, max: number) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error("invalid_number");
  return n;
}
function normalize(raw: Record<string, unknown>) {
  const studentName = text(raw.studentName, 80);
  const studentGroup = text(raw.group, 60);
  const lessonTitle = text(raw.lessonTitle, 160);
  const attemptId = text(raw.attemptId, 80);
  const lessonId = integer(raw.lessonId, 1, 25);
  const score = integer(raw.score, 0, 7);
  const total = integer(raw.total, 7, 7);
  const durationSeconds = integer(raw.durationSeconds, 1, 86400);
  if (!studentName || !studentGroup || !lessonTitle || !attemptId) throw new Error("invalid_attempt");
  if (!Array.isArray(raw.answers) || raw.answers.length !== 7) throw new Error("invalid_answers");
  const answers = raw.answers.map((value, index) => {
    const answer = value as Record<string, unknown>;
    const selected = integer(answer.selected, 0, 2);
    const correct = Number(answerKeys[lessonId - 1][index]);
    return { number: index + 1, selected, correct, isCorrect: selected === correct };
  });
  if (score !== answers.filter(answer => answer.isCorrect).length) throw new Error("invalid_score");
  return {
    student_name: studentName, student_group: studentGroup,
    lesson_id: lessonId, lesson_title: lessonTitle,
    score, total, percent: Math.round(score / total * 100),
    duration_seconds: durationSeconds, attempt_id: attemptId, answers,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return respond(request, { ok: true });
  if (request.method !== "POST") return respond(request, { ok: false, error: "method_not_allowed" }, 405);
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return respond(request, { ok: false, error: "invalid_json" }, 400); }
  if (body.action === "list") {
    const teacherPin = Deno.env.get("TEACHER_PIN") ?? "";
    if (!teacherPin || request.headers.get("x-teacher-pin") !== teacherPin)
      return respond(request, { ok: false, error: "invalid_pin" }, 401);
    const { data, error } = await supabase.from("tajwid1_quiz_attempts")
      .select("submitted_at,student_name,student_group,lesson_id,lesson_title,score,total,percent,duration_seconds,answers")
      .order("submitted_at", { ascending: false }).limit(5000);
    if (error) { console.error(error); return respond(request, { ok: false, error: "database_error" }, 500); }
    return respond(request, { ok: true, results: data });
  }
  let record;
  try { record = normalize(body); }
  catch { return respond(request, { ok: false, error: "invalid_request" }, 400); }
  const { error } = await supabase.from("tajwid1_quiz_attempts").upsert(record, {
    onConflict: "attempt_id", ignoreDuplicates: true,
  });
  if (error) { console.error(error); return respond(request, { ok: false, error: "database_error" }, 500); }
  return respond(request, { ok: true }, 201);
});
