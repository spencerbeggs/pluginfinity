import { assert, describe, it } from "@effect/vitest";
import { ComponentInvalid, ComponentsInvalid, ConfigIssue } from "../src/errors.js";

const token = (message: string) => ConfigIssue.make({ key: "line 3", message, kind: "token" });

describe("token remediation", () => {
	it("leads with the fix and offers no claude-only block for a Claude failure", () => {
		const error = new ComponentInvalid({
			path: "skills/a/SKILL.md",
			target: "claude",
			issues: [token("unknown skill `nope`")],
		});
		const hint = error.remediation.hint ?? "";
		assert.isTrue(hint.startsWith("Correct the listed problems in skills/a/SKILL.md"), hint);
		assert.notInclude(hint, "pluginfinity:only claude");
		assert.include(hint, "pluginfinity:only copilot");
		assert.include(hint, "\\{{");
		assert.include(hint, "inline code");
	});

	it("names a host block for another target on a Copilot failure", () => {
		const error = new ComponentInvalid({
			path: "agents/b.md",
			target: "copilot",
			issues: [token("`{{plugin_root}}` has no value on copilot")],
		});
		const hint = error.remediation.hint ?? "";
		assert.isTrue(hint.startsWith("Correct the listed problems in agents/b.md"), hint);
		assert.include(hint, "pluginfinity:only claude");
		assert.notInclude(hint, "pluginfinity:only copilot");
	});

	it("leads the aggregate hint with the fix too", () => {
		const one = new ComponentInvalid({ path: "p", target: "claude", issues: [token("x")] });
		const hint = new ComponentsInvalid({ path: "cfg", components: [one] }).remediation.hint ?? "";
		assert.isTrue(hint.startsWith("Correct each listed file"), hint);
		assert.include(hint, "pluginfinity:only");
	});
});
