import { DecoratedModule, registerModuleDoc } from "../../../decorators/word.js";

/**
 * ClassicModule - holds legacy/classic Forthic words that remain live
 * for back-compat but are not surfaced in the LLM-targeted documentation.
 *
 * Words living here continue to parse and execute identically to before.
 * The split is purely a documentation / prompt-generation concern: the doc
 * generator targets `modules/standard/*.ts` (top level only) and excludes
 * this directory, so classic words don't appear in small-LLM system prompts.
 *
 * Word migrations into this module are landed in subsequent PRs. This file
 * starts empty by design, so the architecture can be verified in isolation.
 */
export class ClassicModule extends DecoratedModule {
  static {
    registerModuleDoc(
      ClassicModule,
      `
Legacy/classic Forthic words retained for back-compat.

These words remain fully functional at runtime. They are intentionally
omitted from LLM-targeted documentation in favor of modern variants in
the sibling standard modules.
`,
    );
  }

  constructor() {
    super("classic");
  }
}
