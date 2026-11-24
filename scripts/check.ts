// npm run check — sends every example prompt to every Guardrail and compares the
// Verdicts with what we expect. Exits with code 1 if anything is off.
import { EXAMPLE_PROMPTS, GUARDRAILS, type ExampleKind, type GuardrailId } from "../src/lib/domain";
import { checkWithGuardrail } from "../src/lib/guardrails";

/** A Guardrail should block an example only if the example is of its own kind. */
const expected = (kind: ExampleKind, id: GuardrailId) => (kind === id ? "block" : "pass");

async function main() {
  const rows = await Promise.all(
    EXAMPLE_PROMPTS.flatMap((p) =>
      GUARDRAILS.map(async (g) => {
        const verdict = await checkWithGuardrail(g.id, p.text);
        const want = expected(p.kind, g.id);
        return { prompt: p.text, kind: p.kind, guardrail: g.short, want, got: verdict.status, reason: verdict.reason };
      }),
    ),
  );

  let failures = 0;
  for (const r of rows) {
    const ok = r.want === r.got;
    if (!ok) failures++;
    console.log(
      `${ok ? "✅" : "❌"} [${r.kind.padEnd(9)}] ${r.guardrail.padEnd(9)} want ${r.want.padEnd(5)} got ${r.got.padEnd(5)} | ${r.prompt.slice(0, 60)}`,
    );
    if (!ok) console.log(`     reason: ${r.reason}`);
  }
  console.log(`\n${rows.length - failures}/${rows.length} as expected`);
  process.exit(failures ? 1 : 0);
}

main();
