import { COFFEE_PRODUCT_IDS, type CoffeeAddIn, type CoffeeCup, type CoffeeKind, MAX_CUPS_A_DAY, afterCurfew, cupNutrition, curfewClock, wakeHourOf } from "../../domain/coffee";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { isIsoDate, isOnLocalDay, localDateOf, localTimeOf } from "../../domain/localDay";
import type { Product } from "../../domain/types";
import type { ICatalogRepository } from "../interfaces/ICatalogRepository";
import type { IClock } from "../interfaces/IClock";
import type { ICoffeeRepository, IProfileRepository } from "../interfaces/IRepositories";

const HOUR_MS = 3_600_000;

export interface CoffeeDay {
  date: string;
  /** Oldest first, each marked when it came after the caffeine curfew. */
  cups: (CoffeeCup & { afterCurfew: boolean })[];
  caffeineMg: number;
  /** From the add-ins; they count toward the day's calories. */
  kcal: number;
  /** The caffeine curfew, local "HH:MM". */
  curfew: string;
}

/** The coffee log: a cup with its add-ins in one tap, and the day's cups, caffeine and curfew. */
export class CoffeeUseCases {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly coffee: ICoffeeRepository,
    private readonly clock: IClock,
    private readonly catalog?: Pick<ICatalogRepository, "productsByIds">,
  ) {}

  /** What goes in a good cup: mould-tested coffee, pure C8, grass-fed butter or ghee, creatine. */
  async products(): Promise<Product[]> {
    return this.catalog ? this.catalog.productsByIds(COFFEE_PRODUCT_IDS) : [];
  }

  /** Logs a cup and returns the day it falls on, with it. */
  async log(userId: string, input: { kind: CoffeeKind; addIns: CoffeeAddIn[]; takenAt?: Date }): Promise<CoffeeDay> {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const now = this.clock.now();
    const takenAt = input.takenAt ?? now;
    if (takenAt.getTime() > now.getTime() + 5 * 60_000) throw new InvalidError("That cup is in the future.");
    if (now.getTime() - takenAt.getTime() > 48 * HOUR_MS) throw new InvalidError("Log a cup from the last two days.");
    const date = localDateOf(takenAt, profile.timeZone);
    if ((await this.cupsOn(userId, date, profile.timeZone)).length >= MAX_CUPS_A_DAY) {
      throw new InvalidError(`That's ${MAX_CUPS_A_DAY} cups today already.`);
    }
    await this.coffee.add(userId, { takenAt, kind: input.kind, addIns: [...new Set(input.addIns)] });
    return this.day(userId, date);
  }

  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.coffee.delete(userId, id))) throw new NotFoundError("No such cup.");
  }

  async day(userId: string, date?: string): Promise<CoffeeDay> {
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    if (date !== undefined && !isIsoDate(date)) throw new InvalidError("Use a date like 2026-10-23.");
    const day = date ?? localDateOf(this.clock.now(), profile.timeZone);
    const wake = wakeHourOf(profile.bioProfile);
    const cups = (await this.cupsOn(userId, day, profile.timeZone)).map((c) => ({ ...c, afterCurfew: afterCurfew(localTimeOf(c.takenAt, profile.timeZone), wake) }));
    const totals = cups.map(cupNutrition);
    return {
      date: day,
      cups,
      caffeineMg: totals.reduce((s, n) => s + n.caffeineMg, 0),
      kcal: Math.round(totals.reduce((s, n) => s + n.kcal, 0)),
      curfew: curfewClock(wake),
    };
  }

  /** Cups on a local day: a window wide enough for any time zone, then the exact day. */
  private async cupsOn(userId: string, date: string, timeZone: string) {
    const noon = Date.parse(`${date}T12:00:00Z`);
    const cups = await this.coffee.listBetween(userId, new Date(noon - 26 * HOUR_MS), new Date(noon + 26 * HOUR_MS));
    return cups.filter((c) => isOnLocalDay(c.takenAt, { date, timeZone }));
  }
}
