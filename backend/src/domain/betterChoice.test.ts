import { describe, expect, it } from "@jest/globals";
import { deviceUsedIn } from "./betterChoice";

describe("deviceUsedIn", () => {
  it("finds the device a step names, in any of its usual spellings", () => {
    expect(deviceUsedIn(["Mix.", "Air-fry at 160°C for 8 minutes."])).toBe("kitchen:air-fryer");
    expect(deviceUsedIn(["Put it in the airfryer basket."])).toBe("kitchen:air-fryer");
    expect(deviceUsedIn(["Blitz the dates in a blender until smooth."])).toBe("kitchen:blender");
    expect(deviceUsedIn(["Churn in an ice cream maker, or freeze in a Ninja Creami pint."])).toBe("kitchen:ice-cream-maker");
  });

  it("doesn't read cooking words as devices", () => {
    expect(deviceUsedIn(["Stir to blend the spices.", "Fry in a pan.", "Bake at 160°C."])).toBeNull();
  });
});
