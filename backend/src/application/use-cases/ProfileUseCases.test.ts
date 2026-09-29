import { describe, expect, it } from "@jest/globals";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { InMemoryProfiles, profile } from "../testing/fakes";
import { GetProfileUseCase, UpdateProfileUseCase } from "./ProfileUseCases";

const { userId: _, ...full } = profile();

describe("UpdateProfileUseCase", () => {
  it("needs every required field the first time, then accepts partial updates", async () => {
    const profiles = new InMemoryProfiles();
    const update = new UpdateProfileUseCase(profiles);
    await expect(update.execute({ userId: "u1", patch: { displayName: "Lionel" } })).rejects.toThrow(
      "also send: dietaryPreference, dailyCalorieTarget, macroTargets",
    );
    await update.execute({ userId: "u1", patch: full });
    const updated = await update.execute({ userId: "u1", patch: { dailyCalorieTarget: 2000 } });
    expect(updated).toMatchObject({ dailyCalorieTarget: 2000, displayName: "Lionel", timeZone: "America/Chicago" });
  });

  it("defaults the time zone to UTC and rejects unknown ones", async () => {
    const update = new UpdateProfileUseCase(new InMemoryProfiles());
    const { timeZone: __, ...withoutZone } = full;
    expect((await update.execute({ userId: "u1", patch: withoutZone })).timeZone).toBe("UTC");
    await expect(update.execute({ userId: "u1", patch: { timeZone: "Mars/Olympus" } })).rejects.toBeInstanceOf(InvalidError);
  });

  it("rejects a zero calorie target", async () => {
    const update = new UpdateProfileUseCase(new InMemoryProfiles());
    await expect(update.execute({ userId: "u1", patch: { ...full, dailyCalorieTarget: 0 } })).rejects.toBeInstanceOf(InvalidError);
  });
});

describe("GetProfileUseCase", () => {
  it("is not found before setup", async () => {
    await expect(new GetProfileUseCase(new InMemoryProfiles()).execute({ userId: "u1" })).rejects.toBeInstanceOf(NotFoundError);
  });
});
