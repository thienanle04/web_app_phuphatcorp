# Test cases: Route pricing period manual adjust

**Ngày:** 2026-09-15  
**BA:** `docs/ba/20260915_route-pricing-period-manual-adjust-analysis.md`

## Unit

| ID | Case | Expect |
|----|------|--------|
| T01 | tier price = 0 createAbsolute | Passes validate → PERIOD_REQUIRED without fixture (not INVALID_TIERS giá) |
| T02 | tier price < 0 | INVALID_TIERS |
| T03 | Cascade math 2_000_000 × 1.05 | 2_100_000 after roundToThousands |
| T04 | truck min_billable still rejected | INVALID_TIERS |
| T05 | Regression weight overlap / trips / lookup deferred | Pass |

## Integration (manual / follow-up)

| ID | Case | Expect |
|----|------|--------|
| I01 | PUT manual-adjust mid period | Flags set; later periods scaled; other tiers untouched |
| I02 | Later period had flag on same tier | Flag cleared after cascade |
| I03 | updateAbsolute preserve flag when price unchanged | Flag kept on absolute |
| I04 | Matrix cells shape `{ value, manual_adjusted }` | FE parse OK |
