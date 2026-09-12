import { differenceInCalendarDays, format, isSameDay, isSameMonth, isSameYear, startOfWeek, addDays } from "date-fns";
import { pt } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";
import type { Task } from "../../shared/types";

const TZ = "Europe/Lisbon";

export function nowInLisbon(): Date {
  return new Date();
}

function taskDueDate(task: Task): Date | null {
  if (!task.dueDate) return null;
  const [y, m, d] = task.dueDate.split("-").map(Number);
  const time = task.dueTime ? task.dueTime.split(":").map(Number) : [0, 0];
  // data de calendário em Lisboa
  return new TZDate(y, m - 1, d, time[0], time[1], TZ);
}

export function todayLisbon(): Date {
  const now = new Date();
  return new TZDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), TZ);
}

export type GroupKey =
  | "atraso"
  | "hoje"
  | "amanha"
  | "semana"
  | "mes"
  | "ano"
  | "depois"
  | "semdata";

export const GROUP_LABELS: Record<GroupKey, string> = {
  atraso: "Em atraso",
  hoje: "Hoje",
  amanha: "Amanhã",
  semana: "Esta semana",
  mes: "Este mês",
  ano: "Este ano",
  depois: "Mais tarde",
  semdata: "Sem data",
};

const GROUP_ORDER: GroupKey[] = ["atraso", "hoje", "amanha", "semana", "mes", "ano", "depois", "semdata"];

export function groupKeyFor(task: Task): GroupKey {
  const due = taskDueDate(task);
  if (!due) return "semdata";
  const now = new Date();
  const nowLisbon = new TZDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), TZ);
  if (task.dueTime) {
    const [y, m, d] = task.dueDate!.split("-").map(Number);
    const [hh, mm] = task.dueTime.split(":").map(Number);
    const dueMoment = new TZDate(y, m - 1, d, hh, mm, TZ);
    if (dueMoment.getTime() < nowLisbon.getTime()) return "atraso";
  } else {
    const days = differenceInCalendarDays(startOfDayTz(due), startOfDayTz(nowLisbon));
    if (days < 0) return "atraso";
  }
  const dueDay = startOfDayTz(due);
  const today = startOfDayTz(nowLisbon);
  if (isSameDay(dueDay, today)) return "hoje";
  if (isSameDay(dueDay, addDays(today, 1))) return "amanha";
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  if (dueDay >= weekStart && dueDay < addDays(weekStart, 7)) return "semana";
  if (isSameMonth(dueDay, today)) return "mes";
  if (isSameYear(dueDay, today)) return "ano";
  return "depois";
}

function startOfDayTz(d: Date): Date {
  return new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), TZ);
}

export function groupOpenTasks(tasks: Task[]): [GroupKey, Task[]][] {
  const map = new Map<GroupKey, Task[]>();
  for (const t of tasks) {
    if (t.deletedAt || t.completedAt) continue;
    const key = groupKeyFor(t);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const da = a.dueDate ? a.dueDate + (a.dueTime ?? " 23:59").replace(" ", "T") : "9999-99-99";
      const db_ = b.dueDate ? b.dueDate + (b.dueTime ?? " 23:59").replace(" ", "T") : "9999-99-99";
      if (da !== db_) return da < db_ ? -1 : 1;
      if (!!a.dueTime !== !!b.dueTime) return a.dueTime ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : 1;
    });
  }
  return GROUP_ORDER.filter((k) => map.has(k)).map((k) => [k, map.get(k)!]);
}

export function formatDue(task: Task): string | null {
  if (!task.dueDate) return null;
  const [y, m, d] = task.dueDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const label = format(date, "d 'de' MMMM", { locale: pt });
  const time = task.dueTime ? ` · ${task.dueTime}` : "";
  return `${label}${time}`;
}
