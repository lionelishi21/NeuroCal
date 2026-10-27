import { NotFoundError } from "../../domain/errors";
import { LEVEL_NAMES } from "../../domain/levels";
import { localDateOf } from "../../domain/localDay";
import { ACTIVITY, ACTIVITIES } from "../../domain/performance";
import { SESSION_KIND } from "../../domain/session";
import { addDays } from "../../domain/weight";
import { type WeeklyReport, type WorkingItem, weeklyReportOf } from "../../domain/weeklyReport";
import type { IClock } from "../interfaces/IClock";
import type { IPerformanceRepository, IProfileRepository, IWeightRepository } from "../interfaces/IRepositories";
import type { BrainCheckUseCases } from "./BrainCheckUseCases";
import type { GetHistoryUseCase } from "./GetHistoryUseCase";
import type { GetLevelUseCase } from "./GetLevelUseCase";
import type { PerformanceUseCases } from "./PerformanceUseCases";
import type { SessionUseCases } from "./SessionUseCases";
import type { StackUseCases } from "./StackUseCases";

const DAY_MS = 86_400_000;
const DECIDED = new Set(["helping", "worse", "no_change", "lasted", "faded"]);

/** Where the report reads each part from: the use cases behind the screens it brings together. */
export interface WeeklyReportSources {
  history: Pick<GetHistoryUseCase, "execute">;
  brain: Pick<BrainCheckUseCases, "history">;
  performance: Pick<PerformanceUseCases, "view">;
  performanceSessions: Pick<IPerformanceRepository, "listBetween">;
  weights: Pick<IWeightRepository, "list">;
  stack: Pick<StackUseCases, "get">;
  sessions: Pick<SessionUseCases, "day">;
  level: Pick<GetLevelUseCase, "execute">;
}

/** The last full week (Monday to Sunday) in one report (domain/weeklyReport.ts). */
export class GetWeeklyReportUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly clock: IClock,
    private readonly sources: WeeklyReportSources,
  ) {}

  async execute(userId: string): Promise<WeeklyReport> {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const tz = profile.timeZone;
    const now = this.clock.now();
    const today = localDateOf(now, tz);
    // Monday is 1 and Sunday 7: the last full week ends on the Sunday before today.
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
    const weekEnd = addDays(today, -weekday);
    const weekStart = addDays(weekEnd, -6);
    const inWeek = (d: Date) => {
      const date = localDateOf(d, tz);
      return date >= weekStart && date <= weekEnd;
    };
    const s = this.sources;
    const quiet = <T>(p: Promise<T>) => p.catch(() => null);

    const [days, brain, perfView, perfWeek, weights, stack, sessions, level] = await Promise.all([
      s.history.execute({ userId, days: 14, endDate: weekEnd }),
      quiet(s.brain.history(userId, 30)),
      quiet(s.performance.view(userId)),
      s.performanceSessions.listBetween(userId, new Date(Date.parse(`${weekStart}T00:00:00Z`) - DAY_MS), new Date(Date.parse(`${weekEnd}T00:00:00Z`) + 2 * DAY_MS)),
      s.weights.list(userId, weekStart),
      quiet(s.stack.get(userId)),
      quiet(s.sessions.day(userId)),
      quiet(s.level.execute({ userId })),
    ]);

    const week = perfWeek.filter((x) => inWeek(x.startedAt));
    const activities = ACTIVITIES.map((a) => {
      const mine = week.filter((x) => x.activity === a);
      return { label: ACTIVITY[a].label, sessions: mine.length, sharpness: mine.length ? mine.reduce((n, x) => n + x.sharpness, 0) / mine.length : 0 };
    });
    const weighIns = weights.filter((w) => w.date <= weekEnd);

    const working: WorkingItem[] = [
      ...[...(stack?.items ?? []), ...(stack?.stopped ?? [])].flatMap((i) =>
        i.experiment && DECIDED.has(i.experiment.verdict)
          ? [{ name: i.name, kind: "supplement" as const, verdict: i.experiment.verdict as WorkingItem["verdict"], summary: i.experiment.summary }]
          : [],
      ),
      ...(sessions?.insights ?? []).flatMap((i) =>
        DECIDED.has(i.experiment.verdict)
          ? [{ name: SESSION_KIND[i.kind].label, kind: "practice" as const, verdict: i.experiment.verdict as WorkingItem["verdict"], summary: i.experiment.summary }]
          : [],
      ),
    ];

    const next = level && level.level < 5 ? level.level + 1 : null;
    const nextHabits = level?.requirements.filter((r) => r.level === next) ?? [];

    return weeklyReportOf({
      weekStart,
      weekEnd,
      thisWeek: days.slice(7),
      lastWeek: days.slice(0, 7),
      brain: {
        scores: (brain?.checks ?? []).filter((c) => inWeek(c.takenAt)).map((c) => c.score),
        usual: brain?.baselineScore ?? null,
        newLevel: brain?.newLevel ? { up: brain.newLevel.direction === "up", from: brain.newLevel.from, to: brain.newLevel.to } : null,
      },
      performance: { activities, pattern: perfView?.summaries.flatMap((x) => x.insights)[0]?.summary ?? null },
      weight: {
        startKg: weighIns[0]?.kg ?? null,
        endKg: weighIns.at(-1)?.kg ?? null,
        goalKg: profile.weightGoal?.targetKg ?? null,
      },
      working,
      level: {
        level: level?.level ?? 0,
        name: level?.name ?? LEVEL_NAMES[0],
        nextName: next === null ? null : LEVEL_NAMES[next]!,
        nextMet: nextHabits.filter((r) => r.met).length,
        nextOf: nextHabits.length,
        missing: nextHabits.filter((r) => !r.met).map((r) => r.title),
      },
    });
  }
}
