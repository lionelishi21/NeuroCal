import { writeFileSync } from "node:fs";
import { buildOpenApi } from "./openapi";

/** `npm run openapi` (from packages/contracts): writes the document next to package.json. */
writeFileSync("openapi.json", `${JSON.stringify(buildOpenApi(), null, 2)}\n`);
console.log("Wrote packages/contracts/openapi.json");
