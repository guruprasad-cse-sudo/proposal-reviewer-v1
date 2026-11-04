# Adding or changing an agency or scheme

All agency knowledge lives in `rules/agencies/<agency>.json`. Changing a cap, a TRL range, the weights or the tips needs no code change: edit the file, push, and Render redeploys. An admin can also press **Reload rule files** on the Admin page after a deploy.

The tests (`npm test`) check every rule file: weights must add up to 100, `trl` must be `[from, to]`, and every entry in `requiredSections` must be a known section.

## Add a scheme to an existing agency

Add an entry under `"schemes"`:

```json
"crg": {
  "name": "Core Research Grant (CRG)",
  "capLakh": 60,
  "capHard": false,
  "maxMonths": 36,
  "trl": [1, 4],
  "kind": "basic",
  "phdRequired": true,
  "weights": { "track": 15, "expertise": 15, "merit": 25, "feasibility": 15, "budget": 8, "impact": 10, "alignment": 4, "quality": 8 },
  "requiredSections": ["summary", "problem", "sota", "gap", "objectives", "methodology", "timeline", "deliverables", "budget", "references"],
  "tips": ["One line per thing the panel looks for in this call."]
}
```

## Add a new agency (for example ICMR or DBT)

Copy an existing file, change `id` (must match the file name), `name`, `full`, `portal`, `order` (position in menus), `focus` (words that show mission fit; leave empty for broad agencies) and `rules`.

## Scheme fields

| Field | Meaning |
|---|---|
| `capLakh` | Budget cap in ₹ lakh, or `null` if not fixed |
| `capHard` | `true`: over the cap is a FAIL; otherwise a WARN |
| `capExcludesOverhead` | Cap applies to direct cost only |
| `maxMonths`, `maxHard` | Usual maximum duration; `maxHard` makes it a FAIL |
| `trl` | TRL window the call usually funds |
| `kind` | `basic`, `applied`, `tech`, `infra` or `mixed`; changes how impact is scored |
| `phdRequired` | PI must have a PhD |
| `earlyCareer` | Track record leans on publications rather than past grants |
| `noCoPI` | Co-PIs not allowed |
| `neverFundedBy` | Regex of agencies the PI must not have had a PI grant from, e.g. `"serb\|anrf"` |
| `noForeignTravel` | Foreign travel in the budget is a FAIL |
| `maxWords` | Word limit for the proposal text (short proposals) |
| `trlStatementRequired` | Proposal must state TRL at start and end |
| `extraReviewAboveLakh` | Info note above this budget |
| `coPIRolesCritical` | Name-only Co-PIs are a high-priority issue |
| `weights` | Eight dimension weights adding up to 100 |
| `requiredSections` | Section keys from `shared/src/constants.ts` (`SECTIONS`) |
| `tips` | Shown in the app and sent to Claude as the call's criteria |

## Agency `rules`

| Field | Meaning |
|---|---|
| `oneProjectAtATime.match` | Warn if the PI has an ongoing PI project from agencies matching this regex |
| `oneBoardOnly` | Duplicate submission is a FAIL (DRDO research boards) |
| `requireUserLab` | Text naming the user lab; missing contact is flagged |
| `requireUserLabSoft` | Missing user lab is only a warning |
| `requireThrustTopic` | Warn if the topic is not from the call's list |
| `requireDomainExpert` | Warn if the PI's expertise match is low |
| `requireState` | Institution must be in this state |
| `oneSchemePerCall` | Info note naming the schemes that exclude each other |
| `privateCostShare` | Info note shown to private institutions |
| `requireCostComparison` | Missing cost comparison is high priority |
| `industryPartnerHelps` | Suggest an industry partner when none |
| `mentionNationalMission` | Suggest linking to a national mission |

## New kinds of check

A rule that cannot be expressed with these fields needs a few lines in `shared/src/scoring.ts`. Add the flag to `shared/src/types.ts`, handle it in `evaluate()`, and add a test in `shared/test/scoring.test.ts`.

## New proposal sections

Add a key and a regular expression to `SECTIONS` in `shared/src/constants.ts`, then use the key in `requiredSections`.
