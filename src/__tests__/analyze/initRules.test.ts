import { describe, it, expect } from "vitest";
import { shouldSkipRulesVersionCheck } from "../../analyze/helpers/initRules.js";

describe("shouldSkipRulesVersionCheck", () => {
    it("skips when flag is set and rules are cached", () => {
        expect(shouldSkipRulesVersionCheck(true, undefined, true)).toBe(true);
    });

    it("skips when env var is 'true' and rules are cached", () => {
        expect(shouldSkipRulesVersionCheck(false, "true", true)).toBe(true);
    });

    it("does not skip when neither flag nor env var is set", () => {
        expect(shouldSkipRulesVersionCheck(false, undefined, true)).toBe(false);
    });

    it("does not skip when rules are not cached yet, even if flag is set", () => {
        expect(shouldSkipRulesVersionCheck(true, undefined, false)).toBe(false);
    });

    it("does not skip for a non-'true' env var value", () => {
        expect(shouldSkipRulesVersionCheck(false, "false", true)).toBe(false);
    });
});
