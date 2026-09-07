// Unit conversion catalog for unit-conversion.html.
// Edit the markdown text below to add, remove, or change unit types and factors.
// Each ## heading defines one unit type; the table beneath it maps names and units to a base unit factor.
// A fourth "Offset to base unit" column is optional and defaults to 0. A unit converts as
// value * factor + offset, which is how Celsius and Fahrenheit share a table with Kelvin.
// Types that use an offset accept negative input; factor-only types still clamp at zero.
// This file is loaded as a <script> tag so it works when the page is opened as a local file:// URL.
//
// Two catalogs live here:
//   GENERIC_UNITS_CATALOG_MARKDOWN - every unit and its factor, for straight conversion.
//   MIXED_SCALES_CATALOG_MARKDOWN  - which units chain together in a mixed reading (see below).

window.GENERIC_UNITS_CATALOG_MARKDOWN = `
## Length

| Name              | Factor to base unit | Units |
| ----------------- | ------------------: | ----- |
| Meter             |                   1 | m     |
| Kilometer         |                1000 | km    |
| Centimeter        |                0.01 | cm    |
| Millimeter        |               0.001 | mm    |
| Micrometer        |            0.000001 | um    |
| Nanometer         |         0.000000001 | nm    |
| Thou              |           0.0000254 | thou  |
| Inch              |              0.0254 | in    |
| Foot              |              0.3048 | ft    |
| Yard              |              0.9144 | yd    |
| Chain             |             20.1168 | ch    |
| Furlong           |             201.168 | fur   |
| Mile              |            1609.344 | mi    |
| Nautical mile     |                1852 | nmi   |
| Astronomical unit |        149597870700 | AU    |
| Light-year        |  9.4607304725808e15 | ly    |
| Parsec            | 3.0856775814913673e16 | pc  |

## Area

| Name              | Factor to base unit | Units |
| ----------------- | ------------------: | ----- |
| Square meter      |                   1 | m^2   |
| Square kilometer  |             1000000 | km^2  |
| Square centimeter |              0.0001 | cm^2  |
| Square millimeter |            0.000001 | mm^2  |
| Square mile       |     2589988.110336 | mi^2  |
| Hectare           |               10000 | ha    |
| Acre              |        4046.8564224 | ac    |
| Rood              |       1011.7141056 | rood  |
| Are               |                 100 | a     |
| Square yard       |          0.83612736 | yd^2  |
| Square foot       |          0.09290304 | ft^2  |
| Square inch       |          0.00064516 | in^2  |

## Volume

| Name                   | Factor to base unit | Units     |
| ---------------------- | ------------------: | --------- |
| Cubic meter            |                   1 | m^3       |
| Liter                  |               0.001 | L         |
| Milliliter             |            0.000001 | mL        |
| Cubic centimeter       |            0.000001 | cm^3      |
| Cubic millimeter       |         0.000000001 | mm^3      |
| Cubic yard             |      0.764554857984 | yd^3      |
| Cubic foot             |      0.028316846592 | ft^3      |
| Cubic inch             |      0.000016387064 | in^3      |
| Barrel (oil)           |      0.158987294928 | bbl       |
| Gallon (US)            |      0.003785411784 | US gal    |
| Quart (US)             |      0.000946352946 | US qt     |
| Pint (US)              |      0.000473176473 | US pt     |
| Cup (US)               |     0.0002365882365 | US cup    |
| Fluid ounce (US)       |  0.0000295735295625 | US fl oz  |
| Gallon (imperial)      |          0.00454609 | imp gal   |
| Quart (imperial)       |        0.0011365225 | imp qt    |
| Pint (imperial)        |       0.00056826125 | imp pt    |
| Fluid ounce (imperial) |     0.0000284130625 | imp fl oz |

## Mass

| Name               | Factor to base unit | Units    |
| ------------------ | ------------------: | -------- |
| Kilogram           |                   1 | kg       |
| Megatonne          |          1000000000 | Mt       |
| Kilotonne          |             1000000 | kt       |
| Tonne              |                1000 | t        |
| Long ton (UK)      |        1016.0469088 | long tn  |
| Short ton (US)     |           907.18474 | short tn |
| Hundredweight (UK) |         50.80234544 | cwt      |
| Hundredweight (US) |           45.359237 | sh cwt   |
| Stone              |          6.35029318 | st       |
| Pound              |          0.45359237 | lb       |
| Ounce              |      0.028349523125 | oz       |
| Troy ounce         |        0.0311034768 | oz t     |
| Gram               |               0.001 | g        |
| Carat              |              0.0002 | ct       |
| Grain              |       0.00006479891 | gr       |
| Milligram          |            0.000001 | mg       |

## Angle

| Name      | Factor to base unit | Units  |
| --------- | ------------------: | ------ |
| Degree    |                   1 | deg    |
| Radian    |   57.29577951308232 | rad    |
| Gradian   |                 0.9 | gon    |
| Turn      |                 360 | turn   |
| Milliradian | 0.05729577951308232 | mrad |
| NATO mil  |             0.05625 | mil    |
| Arcminute | 0.016666666666666666 | arcmin |
| Arcsecond | 0.0002777777777777778 | arcsec |

## Time

| Name        | Factor to base unit | Units |
| ----------- | ------------------: | ----- |
| Minute      |                   1 | min   |
| Millisecond | 0.00001666666666666666666666666667 | ms |
| Microsecond | 0.00000001666666666666666666666667 | us |
| Second      | 0.01666666666666666666666666666667 | s     |
| Hour        |                  60 | h     |
| Day         |                1440 | d     |
| Week        |               10080 | wk    |
| Year        |              525960 | y     |
| Decade      |             5259600 | dec   |
| Century     |            52596000 | cent  |
| Millennium  |           525960000 | kyr   |

## Speed

| Name                    | Factor to base unit | Units  |
| ----------------------- | ------------------: | ------ |
| Meter per second        |                   1 | m/s    |
| Kilometer per hour      | 0.27777777777777777777777777777778 | km/h   |
| Mile per hour           |             0.44704 | mph    |
| Knot                    | 0.51444444444444444444444444444444 | kn     |
| Foot per second         |              0.3048 | ft/s   |
| Kilometer per second    |                1000 | km/s   |
| Centimeter per second   |                0.01 | cm/s   |
| Meter per minute        | 0.01666666666666666666666666666667 | m/min  |
| Foot per minute         |             0.00508 | ft/min |
| Inch per second         |              0.0254 | in/s   |
| Mach (sea level, ISA)   |              340.29 | Ma     |
| Speed of light          |           299792458 | c      |

## Temperature

| Name       | Factor to base unit | Units | Offset to base unit |
| ---------- | ------------------: | ----- | ------------------: |
| Kelvin     |                   1 | K     |                   0 |
| Celsius    |                   1 | °C    |              273.15 |
| Fahrenheit |                 5/9 | °F    | 255.372222222222222 |
| Rankine    |                 5/9 | °R    |                   0 |

## Pressure

| Name                      | Factor to base unit | Units    |
| ------------------------- | ------------------: | -------- |
| Pascal                    |                   1 | Pa       |
| Kilopascal                |                1000 | kPa      |
| Megapascal                |             1000000 | MPa      |
| Hectopascal               |                 100 | hPa      |
| Bar                       |              100000 | bar      |
| Millibar                  |                 100 | mbar     |
| Atmosphere                |              101325 | atm      |
| Torr                      |  133.32236842105263 | Torr     |
| Millimeter of mercury     |       133.322387415 | mmHg     |
| Inch of mercury           |      3386.388640341 | inHg     |
| Inch of water (4 C)       |            249.0889 | inH2O    |
| Millimeter of water (4 C) |             9.80665 | mmH2O    |
| Pound per square inch     |   6894.757293168361 | psi      |
| Kip per square inch       |   6894757.293168361 | ksi      |
| Kilogram-force per sq cm  |             98066.5 | kgf/cm^2 |

## Force

| Name               | Factor to base unit | Units |
| ------------------ | ------------------: | ----- |
| Newton             |                   1 | N     |
| Meganewton         |             1000000 | MN    |
| Kilonewton         |                1000 | kN    |
| Millinewton        |               0.001 | mN    |
| Ton-force (metric) |             9806.65 | tf    |
| Kilogram-force     |             9.80665 | kgf   |
| Gram-force         |          0.00980665 | gf    |
| Pound-force        |     4.4482216152605 | lbf   |
| Ounce-force        | 0.27801385095378125 | ozf   |
| Poundal            |      0.138254954376 | pdl   |
| Dyne               |             0.00001 | dyn   |

## Energy

| Name                 | Factor to base unit | Units  |
| -------------------- | ------------------: | ------ |
| Joule                |                   1 | J      |
| Megajoule            |             1000000 | MJ     |
| Kilojoule            |                1000 | kJ     |
| Millijoule           |               0.001 | mJ     |
| Megawatt-hour        |          3600000000 | MWh    |
| Kilowatt-hour        |             3600000 | kWh    |
| Watt-hour            |                3600 | Wh     |
| Milliwatt-hour       |                 3.6 | mWh    |
| Kilocalorie          |                4184 | kcal   |
| Calorie              |               4.184 | cal    |
| British thermal unit |       1055.05585262 | BTU    |
| Therm                |       105505585.262 | thm    |
| Foot-pound           |  1.3558179483314004 | ft lbf |
| Erg                  |           0.0000001 | erg    |
| Ton of TNT           |          4184000000 | tTNT   |
| Electronvolt         |     1.602176634e-19 | eV     |

## Power

| Name                    | Factor to base unit | Units    |
| ----------------------- | ------------------: | -------- |
| Watt                    |                   1 | W        |
| Gigawatt                |          1000000000 | GW       |
| Megawatt                |             1000000 | MW       |
| Kilowatt                |                1000 | kW       |
| Milliwatt               |               0.001 | mW       |
| Horsepower (mechanical) |   745.6998715822702 | hp       |
| Horsepower (metric)     |           735.49875 | PS       |
| Ton of refrigeration    |     3516.8528420667 | TR       |
| BTU per hour            | 0.29307107017222222 | BTU/h    |
| Foot-pound per second   |  1.3558179483314004 | ft lbf/s |
| Calorie per second      |               4.184 | cal/s    |

## Frequency

| Name                  | Factor to base unit  | Units |
| --------------------- | -------------------: | ----- |
| Hertz                 |                    1 | Hz    |
| Terahertz             |        1000000000000 | THz   |
| Gigahertz             |           1000000000 | GHz   |
| Megahertz             |              1000000 | MHz   |
| Kilohertz             |                 1000 | kHz   |
| Millihertz            |                0.001 | mHz   |
| Revolution per minute | 0.016666666666666666 | rpm   |
| Radian per second     |  0.15915494309189535 | rad/s |
| Degree per second     | 0.002777777777777778 | deg/s |

## Data

| Name     | Factor to base unit | Units |
| -------- | ------------------: | ----- |
| Byte     |                   1 | B     |
| Bit      |               0.125 | bit   |
| Kilobit  |                 125 | kbit  |
| Megabit  |              125000 | Mbit  |
| Gigabit  |           125000000 | Gbit  |
| Kilobyte |                1000 | kB    |
| Megabyte |             1000000 | MB    |
| Gigabyte |          1000000000 | GB    |
| Terabyte |       1000000000000 | TB    |
| Petabyte |    1000000000000000 | PB    |
| Kibibyte |                1024 | KiB   |
| Mebibyte |             1048576 | MiB   |
| Gibibyte |          1073741824 | GiB   |
| Tebibyte |       1099511627776 | TiB   |
| Pebibyte |    1125899906842624 | PiB   |

## Data rate

| Name                | Factor to base unit | Units  |
| ------------------- | ------------------: | ------ |
| Bit per second      |                   1 | bit/s  |
| Kilobit per second  |                1000 | kbit/s |
| Megabit per second  |             1000000 | Mbit/s |
| Gigabit per second  |          1000000000 | Gbit/s |
| Terabit per second  |       1000000000000 | Tbit/s |
| Byte per second     |                   8 | B/s    |
| Kilobyte per second |                8000 | kB/s   |
| Megabyte per second |             8000000 | MB/s   |
| Gigabyte per second |          8000000000 | GB/s   |
| Kibibyte per second |                8192 | KiB/s  |
| Mebibyte per second |             8388608 | MiB/s  |
| Gibibyte per second |          8589934592 | GiB/s  |
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

| Name                                      | Units                    |
| ----------------------------------------- | ------------------------ |
| Stone, pounds and ounces                  | st, lb, oz               |
| Stone and pounds                          | st, lb                   |
| Pounds and ounces                         | lb, oz                   |
| Tons and hundredweight                    | long tn, cwt             |
| Tons, hundredweight and stone             | long tn, cwt, st         |
| Tons, hundredweight, stone and pounds     | long tn, cwt, st, lb     |
| Hundredweight and stone                   | cwt, st                  |
| Hundredweight, stone and pounds           | cwt, st, lb              |
| Short tons and hundredweight (US)         | short tn, sh cwt         |
| Short tons, hundredweight and pounds (US) | short tn, sh cwt, lb     |

## Volume

| Name                                 | Units                              |
| ------------------------------------ | ---------------------------------- |
| Gallons, quarts and pints (US)       | US gal, US qt, US pt               |
| Gallons, quarts, pints and fl oz (US)| US gal, US qt, US pt, US fl oz     |
| Quarts, pints and fluid ounces (US)  | US qt, US pt, US fl oz             |
| Gallons, quarts and pints (imperial) | imp gal, imp qt, imp pt            |
| Gallons, quarts, pints, fl oz (imp)  | imp gal, imp qt, imp pt, imp fl oz |
| Quarts, pints and fluid ounces (imp) | imp qt, imp pt, imp fl oz          |

## Length

| Name                          | Units          |
| ----------------------------- | -------------- |
| Feet and inches               | ft, in         |
| Yards, feet and inches        | yd, ft, in     |
| Miles and yards               | mi, yd         |
| Miles, yards, feet and inches | mi, yd, ft, in |
| Miles, furlongs and chains    | mi, fur, ch    |

## Time

| Name                                    | Units             |
| --------------------------------------- | ----------------- |
| Hours, minutes and seconds              | h, min, s         |
| Days, hours and minutes                 | d, h, min         |
| Days, hours, minutes, secs              | d, h, min, s      |
| Weeks, days and hours                   | wk, d, h          |
| Decades and years                       | dec, y            |
| Centuries, decades and years            | cent, dec, y      |
| Millennia, centuries and decades        | kyr, cent, dec    |
| Millennia, centuries, decades and years | kyr, cent, dec, y |

## Angle

| Name                          | Units                |
| ----------------------------- | -------------------- |
| Degrees, arcminutes, arcsecs  | deg, arcmin, arcsec  |
`;
