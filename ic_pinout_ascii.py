#!/usr/bin/env python3
"""ASCII IC pinout diagram generator.

Supports:
- 2-sided packages (DIP/SOIC style)
- 4-sided packages (QFP/QFN style)

Examples:
  python ic_pinout_ascii.py two \
    --name "74HC00" \
    --left "1A,1Y,2A,2Y,3A,3Y,4A,GND" \
    --right "VCC,4Y,4B,3B,2B,1B,4A,4B"

  python ic_pinout_ascii.py four \
    --name "MCU" \
    --top "PA0,PA1,PA2,PA3" \
    --right "PB0,PB1,PB2,PB3" \
    --bottom "PC0,PC1,PC2,PC3" \
    --left "PD0,PD1,PD2,PD3"
"""

from __future__ import annotations

import argparse
import sys
from typing import Sequence


def parse_pin_list(raw: str) -> list[str]:
    if not raw.strip():
        return []
    items = [item.strip() for item in raw.split(",")]
    blanks = sum(1 for item in items if not item)
    if blanks:
        print(
            f"Warning: {blanks} blank item(s) in pin list will be ignored.",
            file=sys.stderr,
        )
    return [item for item in items if item]


def center_text(text: str, width: int) -> str:
    if len(text) > width:
        text = text[: max(0, width - 1)] + "…"
    return text[:width].center(width)


def segment_width(count: int, cell_width: int) -> int:
    if count <= 0:
        return 0
    return count * cell_width + (count - 1)


def pin_centers(count: int, inner_width: int, cell_width: int) -> list[int]:
    if count <= 0:
        return []

    span = segment_width(count, cell_width)
    offset = max(0, (inner_width - span) // 2)
    return [offset + idx * (cell_width + 1) + (cell_width // 2) for idx in range(count)]


def render_edge_border(inner_width: int, marker_positions: Sequence[int]) -> str:
    border = ["-"] * inner_width
    for pos in marker_positions:
        if 0 <= pos < inner_width:
            border[pos] = "+"
    return "+" + "".join(border) + "+"


def render_cells(items: Sequence[str], inner_width: int, cell_width: int) -> str:
    line = [" "] * inner_width
    if not items:
        return "".join(line)

    span = segment_width(len(items), cell_width)
    offset = max(0, (inner_width - span) // 2)

    for idx, item in enumerate(items):
        start = offset + idx * (cell_width + 1)
        cell = center_text(item, cell_width)
        for i, ch in enumerate(cell):
            pos = start + i
            if 0 <= pos < inner_width:
                line[pos] = ch

    return "".join(line)


def split_label_segments(label: str) -> list[str]:
    """Split a label at '/' for compact multi-row rendering.

    'PA0/RESET/UPDI' -> ['PA0/', 'RESET/', 'UPDI']
    'PA1'            -> ['PA1']
    """
    if "/" not in label:
        return [label]
    parts = label.split("/")
    return [p + "/" for p in parts[:-1]] + [parts[-1]]


def render_wrapped_cells(
    items: Sequence[str], inner_width: int, cell_width: int
) -> list[str]:
    """Like render_cells but splits labels on '/' into stacked rows.

    Returns one rendered string per row, with each label's '/' segments
    displayed on successive rows aligned to the same cell column.
    """
    if not items:
        return [" " * inner_width]
    segmented = [split_label_segments(item) for item in items]
    max_rows = max(len(segs) for segs in segmented)
    return [
        render_cells(
            [segs[row] if row < len(segs) else "" for segs in segmented],
            inner_width,
            cell_width,
        )
        for row in range(max_rows)
    ]


def render_stems(count: int, inner_width: int, cell_width: int) -> str:
    line = [" "] * inner_width
    if count <= 0:
        return "".join(line)

    for center in pin_centers(count, inner_width, cell_width):
        if 0 <= center < inner_width:
            line[center] = "|"

    return "".join(line)


def render_pipe_dash_trails(count: int, inner_width: int, cell_width: int) -> str:
    line = [" "] * inner_width
    if count <= 0:
        return "".join(line)

    for center in pin_centers(count, inner_width, cell_width):
        for pos in (center - 1, center + 1):
            if 0 <= pos < inner_width:
                line[pos] = "-"
        if 0 <= center < inner_width:
            line[center] = "|"

    return "".join(line)


def distribute_columns(start: int, end: int, count: int) -> list[int]:
    if count <= 0:
        return []
    if end < start:
        raise ValueError(f"distribute_columns: end ({end}) < start ({start})")

    available = end - start + 1
    # Clamp count so we never try to fit more columns than positions exist.
    count = min(count, available)

    if count == 1:
        return [(start + end) // 2]

    cols: list[int] = []
    prev = start - 1
    span = end - start

    for idx in range(count):
        col = start + round(idx * span / (count - 1))
        col = max(col, prev + 1)
        col = min(col, end - (count - idx - 1))
        # Hard clamp as final safety net.
        col = max(start, min(end, col))
        cols.append(col)
        prev = col

    return cols


def write_text(line: list[str], start: int, text: str) -> None:
    for offset, ch in enumerate(text, start=start):
        if 0 <= offset < len(line):
            line[offset] = ch


def draw_horizontal_segment(line: list[str], start: int, end: int) -> None:
    if end < start:
        return

    for pos in range(start, end + 1):
        if not (0 <= pos < len(line)):
            continue
        if line[pos] == "|":
            line[pos] = "+"
        elif line[pos] == " ":
            line[pos] = "-"


def render_top_vertical_trails(
    labels: Sequence[str],
    numbers: Sequence[int],
    pin_width: int,
    inner_width: int,
    edge_cols: Sequence[int],
) -> list[str]:
    lines: list[str] = []
    items = list(zip(labels, numbers, edge_cols))
    ordered_edge_cols = [edge_col for _, _, edge_col in items]

    for row_index, (label, num, edge_col) in enumerate(items):
        content = f"T{num:>{pin_width}} {label}"
        line = [" "] * inner_width

        for prev_col in ordered_edge_cols[:row_index]:
            if 0 <= prev_col < inner_width:
                line[prev_col] = "|"

        if not (0 <= edge_col < inner_width):
            lines.append("".join(line))
            continue

        max_content_len = max(1, inner_width - edge_col - 1)
        content = content[-max_content_len:]
        content_start = inner_width - len(content)
        draw_horizontal_segment(line, edge_col + 1, content_start - 1)
        write_text(line, content_start, content)
        line[edge_col] = "+"
        lines.append("".join(line))

    if items:
        connector_row = [" "] * inner_width
        for edge_col in ordered_edge_cols:
            if 0 <= edge_col < inner_width:
                connector_row[edge_col] = "|"
        lines.append("".join(connector_row))

    return lines


def render_bottom_vertical_trails(
    labels: Sequence[str],
    numbers: Sequence[int],
    pin_width: int,
    inner_width: int,
    edge_cols: Sequence[int],
) -> list[str]:
    """Render bottom-side pin trails, growing away from the IC body.

    Strategy: iterate pins in forward (left-to-right) order, accumulating the
    set of already-rendered columns that need continuation stems.  Append a
    connector row last, then reverse the whole list so the connector ends up
    nearest the IC border.
    """
    items = list(zip(labels, numbers, edge_cols))
    lines: list[str] = []
    rendered_cols: list[int] = []

    for label, num, edge_col in items:
        content = f"B{num:>{pin_width}} {label}"
        line = [" "] * inner_width

        for col in rendered_cols:
            if 0 <= col < inner_width:
                line[col] = "|"

        if not (0 <= edge_col < inner_width):
            lines.append("".join(line))
            rendered_cols.append(edge_col)
            continue

        max_content_len = max(1, inner_width - edge_col - 1)
        content = content[-max_content_len:]
        content_start = inner_width - len(content)
        draw_horizontal_segment(line, edge_col + 1, content_start - 1)
        write_text(line, content_start, content)
        line[edge_col] = "+"
        lines.append("".join(line))
        rendered_cols.append(edge_col)

    if items:
        connector_row = [" "] * inner_width
        for _, _, edge_col in items:
            if 0 <= edge_col < inner_width:
                connector_row[edge_col] = "|"
        lines.append("".join(connector_row))

    lines.reverse()
    return lines


def render_two_sided(name: str, left: Sequence[str], right: Sequence[str]) -> str:
    if not left and not right:
        raise ValueError("At least one pin must be provided.")

    rows = max(len(left), len(right), 1)
    total_pins = len(left) + len(right)

    pin_width = max(2, len(str(max(total_pins, 1))))
    left_width = max((len(p) for p in left), default=1)
    right_width = max((len(p) for p in right), default=1)
    inner_width = max(4, len(name) + 2)

    left_indent = pin_width + 1 + left_width + 3
    right_trailing = 3 + right_width + 1 + pin_width

    lines: list[str] = []
    lines.append(" " * left_indent + "+" + "-" * inner_width + "+")

    name_row = rows // 2
    for idx in range(rows):
        if idx < len(left):
            lnum = idx + 1
            llabel = left[idx]
            left_prefix = f"{lnum:>{pin_width}} {llabel:<{left_width}} --|"
        else:
            left_prefix = " " * left_indent + "|"

        body = center_text(name, inner_width) if idx == name_row else " " * inner_width

        if idx < len(right):
            rnum = total_pins - idx
            rlabel = right[idx]
            right_suffix = f"|-- {rlabel:<{right_width}} {rnum:<{pin_width}}"
        else:
            right_suffix = "|" + " " * right_trailing

        lines.append(left_prefix + body + right_suffix)

    lines.append(" " * left_indent + "+" + "-" * inner_width + "+")
    return "\n".join(lines)


def render_four_sided(
    name: str,
    top: Sequence[str],
    right: Sequence[str],
    bottom: Sequence[str],
    left: Sequence[str],
    vertical_spread: bool = False,
) -> str:
    total_pins = len(top) + len(right) + len(bottom) + len(left)
    if total_pins == 0:
        raise ValueError("At least one pin must be provided.")

    pin_width = max(2, len(str(total_pins)))
    left_width = max((len(p) for p in left), default=1)
    right_width = max((len(p) for p in right), default=1)

    horizontal_label_width = max(
        (len(seg) for label in [*top, *bottom] for seg in split_label_segments(label)),
        default=1,
    )
    cell_width = max(3, pin_width, horizontal_label_width)

    left_nums = list(range(1, len(left) + 1))
    bottom_nums = list(range(len(left) + 1, len(left) + len(bottom) + 1))
    right_nums_top_down = list(
        range(
            len(left) + len(bottom) + len(right),
            len(left) + len(bottom),
            -1,
        )
    )
    top_nums_left_to_right = list(
        range(
            total_pins,
            len(left) + len(bottom) + len(right),
            -1,
        )
    )

    top_span = segment_width(len(top), cell_width)
    bottom_span = segment_width(len(bottom), cell_width)
    top_entry_width = max(
        [len(f"T{num:>{pin_width}} {label}") for label, num in zip(top, top_nums_left_to_right)]
        or [1]
    )
    bottom_entry_width = max(
        [len(f"B{num:>{pin_width}} {label}") for label, num in zip(bottom, bottom_nums)]
        or [1]
    )

    if vertical_spread:
        top_track_width = top_entry_width + max(len(top) - 1, 0) * 2 + 3
        bottom_track_width = bottom_entry_width + max(len(bottom) - 1, 0) * 2 + 3
        inner_width = max(4, len(name) + 2, top_track_width, bottom_track_width)
    else:
        inner_width = max(4, len(name) + 2, top_span, bottom_span)

    top_edge_cols = (
        distribute_columns(1, inner_width - top_entry_width - 2, len(top))
        if vertical_spread and top
        else []
    )
    bottom_edge_cols = (
        distribute_columns(1, inner_width - bottom_entry_width - 2, len(bottom))
        if vertical_spread and bottom
        else []
    )

    top_markers = top_edge_cols if vertical_spread and top else pin_centers(
        len(top), inner_width, cell_width
    )
    bottom_markers = bottom_edge_cols if vertical_spread and bottom else pin_centers(
        len(bottom), inner_width, cell_width
    )

    left_indent = pin_width + 1 + left_width + 3
    right_trailing = 3 + right_width + 1 + pin_width
    # Minimum of 3 body rows so the IC name always has visible breathing room
    # even when left/right sides have only 0–2 pins.
    rows = max(len(left), len(right), 3)

    lines: list[str] = []

    if top:
        if vertical_spread:
            top_pin_lines = render_top_vertical_trails(
                top,
                top_nums_left_to_right,
                pin_width,
                inner_width,
                top_edge_cols,
            )
            for pin_line in top_pin_lines:
                lines.append(" " * (left_indent + 1) + pin_line)
        else:
            top_label_rows = render_wrapped_cells(top, inner_width, cell_width)
            top_numbers_line = render_cells(
                [str(num) for num in top_nums_left_to_right], inner_width, cell_width
            )
            top_stems_line = render_stems(len(top), inner_width, cell_width)
            top_trails_line = render_pipe_dash_trails(len(top), inner_width, cell_width)

            for row in top_label_rows:
                lines.append(" " * (left_indent + 1) + row)
            lines.append(" " * (left_indent + 1) + top_numbers_line)
            lines.append(" " * (left_indent + 1) + top_stems_line)
            lines.append(" " * (left_indent + 1) + top_trails_line)

    lines.append(" " * left_indent + render_edge_border(inner_width, top_markers))

    name_row = rows // 2
    for idx in range(rows):
        if idx < len(left):
            lnum = left_nums[idx]
            llabel = left[idx]
            left_prefix = f"{lnum:>{pin_width}} {llabel:<{left_width}} --|"
        else:
            left_prefix = " " * left_indent + "|"

        body = center_text(name, inner_width) if idx == name_row else " " * inner_width

        if idx < len(right):
            rnum = right_nums_top_down[idx]
            rlabel = right[idx]
            right_suffix = f"|-- {rlabel:<{right_width}} {rnum:<{pin_width}}"
        else:
            right_suffix = "|" + " " * right_trailing

        lines.append(left_prefix + body + right_suffix)

    lines.append(" " * left_indent + render_edge_border(inner_width, bottom_markers))

    if bottom:
        if vertical_spread:
            bottom_pin_lines = render_bottom_vertical_trails(
                bottom,
                bottom_nums,
                pin_width,
                inner_width,
                bottom_edge_cols,
            )
            for pin_line in bottom_pin_lines:
                lines.append(" " * (left_indent + 1) + pin_line)
        else:
            bottom_trails_line = render_pipe_dash_trails(len(bottom), inner_width, cell_width)
            bottom_stems_line = render_stems(len(bottom), inner_width, cell_width)
            bottom_numbers_line = render_cells(
                [str(num) for num in bottom_nums], inner_width, cell_width
            )
            bottom_label_rows = render_wrapped_cells(bottom, inner_width, cell_width)

            lines.append(" " * (left_indent + 1) + bottom_trails_line)
            lines.append(" " * (left_indent + 1) + bottom_stems_line)
            lines.append(" " * (left_indent + 1) + bottom_numbers_line)
            for row in bottom_label_rows:
                lines.append(" " * (left_indent + 1) + row)

    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate ASCII IC pinout diagrams for 2-sided and 4-sided packages."
    )
    sub = parser.add_subparsers(dest="mode")

    parser_two = sub.add_parser("two", help="Render a 2-sided (DIP/SOIC style) diagram")
    parser_two.add_argument("--name", required=True, help="IC/package name")
    parser_two.add_argument(
        "--left",
        required=True,
        help="Comma-separated left-side labels, top to bottom",
    )
    parser_two.add_argument(
        "--right",
        required=True,
        help="Comma-separated right-side labels, top to bottom",
    )
    parser_two.add_argument(
        "--allow-uneven",
        action="store_true",
        help="Allow different counts on left/right sides",
    )

    parser_four = sub.add_parser("four", help="Render a 4-sided (QFP/QFN style) diagram")
    parser_four.add_argument("--name", required=True, help="IC/package name")
    parser_four.add_argument(
        "--top", default="", help="Comma-separated top labels, left to right"
    )
    parser_four.add_argument(
        "--right", default="", help="Comma-separated right labels, top to bottom"
    )
    parser_four.add_argument(
        "--bottom", default="", help="Comma-separated bottom labels, left to right"
    )
    parser_four.add_argument(
        "--left", default="", help="Comma-separated left labels, top to bottom"
    )
    parser_four.add_argument(
        "--vertical-spread",
        action="store_true",
        help="Render top/bottom sides as vertical lists to reduce diagram width",
    )

    sub.add_parser("demo", help="Print built-in examples")

    return parser


def render_demo() -> str:
    two = render_two_sided(
        name="NE555",
        left=["GND", "TRIG", "OUT", "RESET"],
        right=["VCC", "DISCH", "THR", "CTRL"],
    )

    four = render_four_sided(
        name="STM32 (LQFP-16)",
        top=["NRST", "PA0", "PA1", "VDD"],
        right=["PB0", "PB1", "PB2", "VSS"],
        bottom=["PC0", "PC1", "PC2", "BOOT0"],
        left=["PD0", "PD1", "PD2", "VSS"],
    )

    return f"2-sided example:\n\n{two}\n\n4-sided example:\n\n{four}"


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.mode is None or args.mode == "demo":
        print(render_demo())
        if args.mode is None:
            print("\nUse --help for CLI usage.")
        return 0

    if args.mode == "two":
        left = parse_pin_list(args.left)
        right = parse_pin_list(args.right)

        if not args.allow_uneven and len(left) != len(right):
            parser.error(
                "2-sided diagrams usually require equal left/right counts. "
                "Use --allow-uneven to bypass."
            )

        print(render_two_sided(args.name, left, right))
        return 0

    if args.mode == "four":
        top = parse_pin_list(args.top)
        right = parse_pin_list(args.right)
        bottom = parse_pin_list(args.bottom)
        left = parse_pin_list(args.left)

        print(
            render_four_sided(
                args.name,
                top,
                right,
                bottom,
                left,
                vertical_spread=args.vertical_spread,
            )
        )
        return 0

    # argparse subparsers reject unknown modes before this point.
    parser.error(f"Unknown mode: {args.mode!r}")  # pragma: no cover


if __name__ == "__main__":
    sys.exit(main())
