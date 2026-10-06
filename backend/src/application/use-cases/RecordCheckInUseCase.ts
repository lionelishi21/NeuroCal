import { InvalidError } from "../../domain/errors";
import { COGNITIVE_FLAGS, type CheckIn, type NewCheckIn } from "../../domain/types";
import type { ICheckInRepository } from "../interfaces/IRepositories";

const MAX_NOTE_LENGTH = 280;

/** ARCHITECTURE §6.4. */
export class RecordCheckInUseCase {
  constructor(private readonly checkIns: ICheckInRepository) {}

  async execute(input: { userId: string; checkIn: NewCheckIn }): Promise<CheckIn> {
    const { flags, note } = input.checkIn;
    if (flags.length === 0) throw new InvalidError("Pick at least one way you feel.");
    if (flags.some((f) => !COGNITIVE_FLAGS.includes(f))) throw new InvalidError("One of those feelings isn't recognised.");
    if (note !== undefined && note.length > MAX_NOTE_LENGTH) {
      throw new InvalidError(`Keep the note under ${MAX_NOTE_LENGTH} characters.`);
    }
    return this.checkIns.create(input.userId, { ...input.checkIn, flags: [...new Set(flags)] });
  }
}
