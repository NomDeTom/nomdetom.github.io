// Unit conversion catalog for unit-conversion.html.
// Edit the markdown text below to add, remove, or change unit types and factors.
// Each ## heading defines one unit type; the table beneath it maps names and units to a base unit factor.
// This file is loaded as a <script> tag so it works when the page is opened as a local file:// URL.
//
// Two catalogs live here:
//   GENERIC_UNITS_CATALOG_MARKDOWN - every unit and its factor, for straight conversion.
//   MIXED_SCALES_CATALOG_MARKDOWN  - which units chain together in a mixed reading (see below).

window.GENERIC_UNITS_CATALOG_MARKDOWN = `
## Length

| Name       | Factor to base unit | Units |
| ---------- | ------------------: | ----- |
| Meter      |                   1 | m     |
| Kilometer  |                1000 | km    |
| Centimeter |                0.01 | cm    |
| Millimeter |               0.001 | mm    |
| Inch       |              0.0254 | in    |
| Foot       |              0.3048 | ft    |
| Yard       |              0.9144 | yd    |
| Mile       |            1609.344 | mi    |

## Area

| Name              | Factor to base unit | Units |
| ----------------- | ------------------: | ----- |
| Square meter      |                   1 | m^2   |
| Square kilometer  |             1000000 | km^2  |
| Square centimeter |              0.0001 | cm^2  |
| Square millimeter |            0.000001 | mm^2  |
| Hectare           |               10000 | ha    |
| Acre              |        4046.8564224 | ac    |
| Square foot       |          0.09290304 | ft^2  |
| Square inch       |          0.00064516 | in^2  |

## Mass

| Name     | Factor to base unit | Units |
| -------- | ------------------: | ----- |
| Kilogram |                   1 | kg    |
| Gram     |               0.001 | g     |
| Tonne    |                1000 | t     |
| Stone    |          6.35029318 | st    |
| Pound    |          0.45359237 | lb    |
| Ounce    |      0.028349523125 | oz    |

## Angle

| Name      | Factor to base unit | Units  |
| --------- | ------------------: | ------ |
| Degree    |                   1 | deg    |
| Radian    |   57.29577951308232 | rad    |
| Gradian   |                 0.9 | gon    |
| Turn      |                 360 | turn   |
| Arcminute | 0.016666666666666666 | arcmin |
| Arcsecond | 0.0002777777777777778 | arcsec |

## Time

| Name   | Factor to base unit | Units |
| ------ | ------------------: | ----- |
| Minute |                   1 | min   |
| Second | 0.01666666666666666666666666666667 | s     |
| Hour   |                  60 | h     |
| Day    |                1440 | d     |
| Year   |              525960 | y     |
| Decade |             5259600 | dec   |
`;

// Mixed scales for the Mixed Units calculator.
// A scale is one measure carried in remainders across several units of the same
// system: stone, pounds and ounces are not three interchangeable units, they are
// one weight written as 14 lb to the stone and 16 oz to the pound. Decimal
// systems have no scales here, because 3.7 t is written 3.7 t, never 3 t 700 kg.
//
// Each ## heading names a unit type from the catalog above. Each row is one
// scale: a display name and the units it chains, largest first, given as the
// Units symbols from that type's table.

window.MIXED_SCALES_CATALOG_MARKDOWN = `
## Mass

| Name                     | Units      |
| ------------------------ | ---------- |
| Stone, pounds and ounces | st, lb, oz |
| Stone and pounds         | st, lb     |
| Pounds and ounces        | lb, oz     |

## Length

| Name                    | Units      |
| ----------------------- | ---------- |
| Feet and inches         | ft, in     |
| Yards, feet and inches  | yd, ft, in |
| Miles and yards         | mi, yd     |

## Time

| Name                      | Units       |
| ------------------------- | ----------- |
| Hours, minutes and seconds | h, min, s  |
| Days, hours and minutes   | d, h, min   |
| Days, hours, minutes, secs | d, h, min, s |

## Angle

| Name                          | Units                |
| ----------------------------- | -------------------- |
| Degrees, arcminutes, arcsecs  | deg, arcmin, arcsec  |
`;
