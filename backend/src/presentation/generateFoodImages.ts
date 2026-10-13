/**
 * `npm run foods:images -w @neurocal/backend [-- id id …] [--force]`: makes one photo per catalog
 * food (src/infrastructure/catalog/foods.ts) with OpenAI's image model, in one shared style, and
 * saves them as mobile-app/assets/foods/<id>.webp. Skips foods that already have a photo unless
 * --force. Needs OPENAI_API_KEY (backend/.env). About 4 US cents a photo.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import sharp from "sharp";
import type { Food } from "../domain/foods";
import { FOODS } from "../infrastructure/catalog/foods";
import { loadConfig } from "../infrastructure/config";

const OUT = path.resolve(process.cwd(), "../mobile-app/assets/foods");
const SIZE = 512;
const AT_ONCE = 3;

/** How the food is shown, for the few that need more than "a serving of X". */
const SUBJECT: Partial<Record<string, string>> = {
  coffee: "a simple white mug of black coffee",
  "green-tea": "a simple white cup of green tea",
  "bone-broth": "a simple white mug of clear beef broth",
  "orange-juice": "a plain glass of orange juice",
  milk: "a plain glass of milk",
  kefir: "a plain glass of kefir",
  "olive-oil": "a small glass dish of golden olive oil",
  "avocado-oil": "a small glass dish of avocado oil",
  "coconut-oil": "a small glass jar of solid white coconut oil",
  honey: "a small bowl of honey with a honey dipper",
  turmeric: "a small mound of ground turmeric in a little white bowl",
  cinnamon: "two cinnamon sticks beside a small mound of ground cinnamon",
  "dark-chocolate": "two squares of dark chocolate",
  butter: "a pat of butter on a small white dish",
};

export const promptFor = (food: Food) =>
  [
    `Overhead food photograph of ${SUBJECT[food.id] ?? `one serving of ${food.name.toLowerCase()} (${food.serving})`}.`,
    "Centred on a plain warm off-white background, soft natural daylight from the top left, a gentle soft shadow.",
    "Simple and minimal: no text, no labels, no brand names, no hands, no cutlery unless needed, no busy props.",
    "Crisp, appetising, realistic studio food photography, consistent with a set of matching photos.",
  ].join(" ");

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env: use the environment as it is.
  }
  const { openAiApiKey } = loadConfig();
  if (!openAiApiKey) throw new Error("Set OPENAI_API_KEY in backend/.env first.");
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = new Set(args.filter((a) => !a.startsWith("--")));
  const foods = FOODS.filter((f) => only.size === 0 || only.has(f.id));
  await mkdir(OUT, { recursive: true });

  const todo: Food[] = [];
  for (const food of foods) if (force || !(await exists(path.join(OUT, `${food.id}.webp`)))) todo.push(food);
  console.log(`${todo.length} of ${foods.length} foods need a photo.`);

  const client = new OpenAI({ apiKey: openAiApiKey, maxRetries: 2, timeout: 120_000 });
  let done = 0;
  const failed: string[] = [];
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: AT_ONCE }, async () => {
      for (let food = queue.shift(); food; food = queue.shift()) {
        try {
          const image = await client.images.generate({ model: "gpt-image-1", prompt: promptFor(food), size: "1024x1024", quality: "medium", n: 1 });
          const b64 = image.data?.[0]?.b64_json;
          if (!b64) throw new Error("no image returned");
          const webp = await sharp(Buffer.from(b64, "base64")).resize(SIZE, SIZE).webp({ quality: 80 }).toBuffer();
          await writeFile(path.join(OUT, `${food.id}.webp`), webp);
          console.log(`  ${++done}/${todo.length} ${food.id} (${Math.round(webp.byteLength / 1024)} KB)`);
        } catch (e) {
          failed.push(food.id);
          console.error(`  ${food.id} failed: ${(e as Error).message}`);
        }
      }
    }),
  );
  if (failed.length) {
    console.error(`Failed: ${failed.join(" ")}. Run again with those ids to retry.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
