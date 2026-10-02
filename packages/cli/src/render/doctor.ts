// The doctor report, drawn for its audience: a grouped checklist for people,
// one JSON object for agents and CI.

import type { DoctorCheck, DoctorReport } from "@pluginfinity/engine";

const GROUP_TITLES = [
	["runtime", "Runtime"],
	["hosts", "Hosts"],
	["tools", "Tools"],
	["config", "Config"],
] as const;

const glyph = (check: DoctorCheck): string =>
	check.status === "pass" ? "✓" : check.severity === "required" ? "✗" : "!";

/** The checklist lines a person reads, one remediation line under each failure. */
export const doctorLines = (report: DoctorReport): ReadonlyArray<string> =>
	GROUP_TITLES.flatMap(([group, title]) => {
		const checks = report.checks.filter((check) => check.group === group);
		if (checks.length === 0) return [];
		return [
			title,
			...checks.flatMap((check) => [
				`  ${glyph(check)} ${check.label}: ${check.detail}`,
				...(check.status === "fail" && check.remediation !== null ? [`      ${check.remediation.hint}`] : []),
			]),
		];
	});

/** The one JSON object `--agent` and `--ci` read. */
export const doctorJson = (report: DoctorReport): string =>
	JSON.stringify({
		engine_version: report.engineVersion,
		distribution: report.distribution,
		ok: report.ok,
		checks: report.checks.map((check) => ({
			id: check.id,
			status: check.status,
			severity: check.severity,
			version: check.version,
			path: check.path,
			remediation: check.remediation,
		})),
	});
