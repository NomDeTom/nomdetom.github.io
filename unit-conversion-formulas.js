// Formula calculator catalog for unit-conversion.html.
// Each ## heading defines one formula group.
// The 5-column table maps each variable to its display name, formula, units,
// and whether it is output-only (computed and not manually editable).
// Formulas may reference any other variable by its Variable name, and may use
// standard math functions: sqrt, pow, abs, log, log2, log10, sin, cos, tan,
// asin, acos, atan, atan2, ceil, floor, round, min, max, PI, E.
// Use ^ for exponentiation (equivalent to **).
// Output-only rows may also use: if <condition> then <value> else <value>.
//
// Note: each variable has exactly one formula, so it can only be auto-derived
// via that single path. Set enough inputs to feed all formula chains.

window.UNIT_CONVERSION_FORMULAS_MARKDOWN = `
## Ohm's Law

| Name       | Variable | Formula | Units | Output only |
| ---------- | -------- | ------- | ----- | ----------- |
| Voltage    | V        | I * R   | V     | no          |
| Current    | I        | V / R   | A     | no          |
| Resistance | R        | V / I   | Ω     | no          |

## Electrical Power

| Name           | Variable | Formula                      | Units | Output only |
| -------------- | -------- | ---------------------------- | ----- | ----------- |
| Power          | P        | V * I                        | W     | no          |
| Voltage        | V        | P / I                        | V     | no          |
| Current        | I        | P / V                        | A     | no          |
| Supply Status  | S        | if V >= 12 then 1 else 0     | flag  | yes         |

## Voltage Status (string output example)

| Name            | Variable | Formula                                  | Units | Output only |
| --------------- | -------- | ---------------------------------------- | ----- | ----------- |
| Voltage         | V        | V                                        | V     | no          |
| Nominal label   | OK_LABEL | "Nominal"                                | text  | hidden      |
| Low label       | LOW_LABEL| "Low"                                    | text  | hidden      |
| Status          | STATUS   | if V >= 12 then OK_LABEL else LOW_LABEL | text  | yes       |
| Direct indicator| DIRECT   | if V >= 12 then "PASS" else "CHECK"  | text  | yes         |

## Speed / Distance / Time

| Name     | Variable | Formula | Units | Output only |
| -------- | -------- | ------- | ----- | ----------- |
| Speed    | v        | d / t   | m/s   | no          |
| Distance | d        | v * t   | m     | no          |
| Time     | t        | d / v   | s     | no          |

## Circle

| Name          | Variable | Formula      | Units | Output only |
| ------------- | -------- | ------------ | ----- | ----------- |
| Radius        | r        | d / 2        | m     | no          |
| Diameter      | d        | 2 * r        | m     | no          |
| Circumference | C        | 2 * PI * r   | m     | no          |
| Area          | A        | PI * r * r   | m²    | no          |

## Kinetic Energy

| Name     | Variable | Formula           | Units | Output only |
| -------- | -------- | ----------------- | ----- | ----------- |
| Energy   | KE       | 0.5 * m * v^2     | J     | no          |
| Mass     | m        | 2 * KE / (v^2)    | kg    | no          |
| Velocity | v        | sqrt(2 * KE / m)  | m/s   | no          |
`;
