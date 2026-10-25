import { describe, expect, it } from "@jest/globals";
import { accountDeletedEmail, codeEmail, escapeHtml, trialEndingEmail, waitlistEmail, welcomeEmail } from "./templates";

describe("email templates", () => {
  it("puts a code in a box, and Cognito's placeholder survives for it to fill", () => {
    const e = codeEmail("{####}", "confirm", "maya@example.com");
    expect(e.subject).toBe("Your NeuroCal code");
    expect(e.html).toContain(">{####}</td>");
    expect(e.text).toContain("{####}");
    expect(e.html).toContain("Sent to maya@example.com");
    // Cognito refuses custom messages over 20,000 characters.
    expect(e.html.length).toBeLessThan(20_000);
    expect(codeEmail("123456", "reset").subject).toBe("Reset your NeuroCal password");
  });

  it("welcomes by first name, escaped, with the targets", () => {
    const e = welcomeEmail({ to: "a@b.c", name: "Maya <b>Okafor</b>", kcal: 2250, proteinG: 140, carbsG: 250, fatG: 75 });
    expect(e.subject).toBe("Welcome to NeuroCal, Maya");
    expect(e.html).toContain("Log your next meal");
    expect(e.html).toContain("2,250 kcal, 140 g protein");
    expect(e.html).not.toContain("<b>Okafor");
    expect(welcomeEmail({ to: "a@b.c", name: " ", kcal: 2000, proteinG: 1, carbsG: 1, fatG: 1 }).subject).toBe("Welcome to NeuroCal");
  });

  it("keeps the waitlist and trial texts, and links the waitlist unsubscribe", () => {
    const w = waitlistEmail({ to: "a@b.c", unsubscribeUrl: "https://neurocal.ai/unsubscribe?token=x&y=1" });
    expect(w.text).toContain("Unsubscribe here: https://neurocal.ai/unsubscribe?token=x&y=1");
    expect(w.html).toContain('href="https://neurocal.ai/unsubscribe?token=x&amp;y=1"');
    const t = trialEndingEmail({ to: "a@b.c", day: "Monday 26 October" });
    expect(t.subject).toBe("Your NeuroCal trial ends on Monday 26 October");
    expect(t.html).toContain("Cancel before then");
  });

  it("confirms a deletion with a warning for anyone who didn't do it", () => {
    const e = accountDeletedEmail({ to: "a@b.c", when: "25 October 2026, 14:32 UTC" });
    expect(e.html).toContain("Didn't do this?");
    expect(e.text).toContain("On 25 October 2026, 14:32 UTC we deleted the NeuroCal account for a@b.c");
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
