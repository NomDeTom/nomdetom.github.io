#!/usr/bin/env python3
"""ASCII IC pinout diagram generator.

Supports:
- 2-sided packages (DIP/SOIC style)
- 4-sided packages (QFP/QFN style)

Numbering schemas (--numbering):
  ccw   Counterclockwise from pin 1 at top-left (default).  Standard for
        DIP, SOIC, QFP, QFN packages.  For 2-sided: left column 1..n
        top-to-bottom, right column 2n..n+1 top-to-bottom.  For 4-sided:
        left column 1..nl top-to-bottom, bottom row nl+1.. left-to-right,
        right column top-to-bottom (decreasing), top row left-to-right
        (decreasing).
  cw    Clockwise from pin 1 at top-left.  Meaningful for 4-sided only
        (identical to ccw for 2-sided).  Top row 1..nt left-to-right, right
        column nt+1.. top-to-bottom, bottom row (decreasing) left-to-right,
        left column (decreasing) top-to-bottom.
  seq   Each side numbered independently from 1.  Useful for connectors,
        headers, or any package where side identity matters more than a
        global pin number.
  none  Labels only; pin numbers are suppressed entirely.  Reduces diagram
        width when numbers add no value.

Examples:
    python ic_pinout_ascii.py two \
        --name "J1" \
        --pins "TX,RX,GND,VCC,EN,RST" \
        --counts "3,3" \
        --sequence alternating \
        --start left-top

    python ic_pinout_ascii.py four \
        --name "MCU" \
        --pins "PA0,PA1,PA2,PA3,PB0,PB1,PB2,PB3,PC0,PC1,PC2,PC3,PD0,PD1,PD2,PD3" \
        --counts "4,4,4,4" \
        --sequence ccw \
        --start left-top

    python ic_pinout_ascii.py four \
        --name "MCU" \
        --pins "PA0,PA1,PA2,PA3,PB0,PB1,PB2,PB3,PC0,PC1,PC2,PC3,PD0,PD1,PD2,PD3" \
        --counts "4,4,4,4" \
        --sequence cw \
        --start top-left

LLM Usage Guide:
    Goal:
        Provide pin labels as one ordered list, then describe geometry/traversal.

    Required arguments (new interface only):
        two:  --name, --pins, --counts "left,right"
        four: --name, --pins, --counts "top,right,bottom,left"

    Traversal controls:
        --sequence:
            ccw          Consume one side at a time in counterclockwise side order.
            cw           Consume one side at a time in clockwise side order.
            alternating  Round-robin across sides in traversal order.

        --start:
            Must be a valid endpoint for the selected sequence and package type.
            two:  left-top, right-top, left-bottom, right-bottom
            four: top-left, right-top, bottom-right, left-bottom,
                        left-top, bottom-left, right-bottom, top-right

    Number rendering (--numbering):
        ccw/cw/seq/none only affect displayed pin numbers, not pin placement from
        --pins. Use "none" when label-only diagrams are preferred.

    Prompt-friendly generation recipe (for LLM agents):
        1) Count pins per side and compute total expected pins.
        2) Build --counts in side order (two: left,right; four: top,right,bottom,left).
        3) Ensure len(--pins list) == sum(--counts).
        4) Choose --sequence and a compatible --start.
        5) Optionally choose --numbering and --vertical-spread.

    Common failure causes:
        - Pin count mismatch between --pins and --counts.
        - Invalid --start for chosen --sequence direction.
        - Empty labels from accidental repeated commas in --pins.

    Minimal examples:
        python ic_pinout_ascii.py two --name "J1" \
            --pins "A,B,C,D,E,F" --counts "3,3" \
            --sequence alternating --start left-top --numbering seq

        python ic_pinout_ascii.py four --name "MCU" \
            --pins "P1,P2,P3,P4,P5,P6,P7,P8,P9,P10,P11,P12" \
            --counts "3,3,3,3" --sequence ccw --start left-top --numbering ccw
"""

from __future__ import annotations

import argparse
import sys
from typing import Sequence


TWO_CCW_STARTS = {"left-top", "right-bottom"}
TWO_CW_STARTS = {"right-top", "left-bottom"}
FOUR_CCW_STARTS = {"left-top", "bottom-left", "right-bottom", "top-right"}
FOUR_CW_STARTS = {"top-left", "right-top", "bottom-right", "left-bottom"}


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


def parse_side_counts(raw: str, expected: int, arg_name: str) -> list[int]:
    items = [item.strip() for item in raw.split(",") if item.strip()]
    if len(items) != expected:
        raise ValueError(
            f"{arg_name} must contain exactly {expected} comma-separated integers."
        )

    counts: list[int] = []
    for item in items:
        try:
            value = int(item)
        except ValueError as exc:
            raise ValueError(f"{arg_name} must contain integers only.") from exc
        if value < 0:
            raise ValueError(f"{arg_name} values must be >= 0.")
        counts.append(value)
    return counts


def rotate_cycle(cycle: Sequence[str], start_side: str) -> list[str]:
    idx = cycle.index(start_side)
    return list(cycle[idx:]) + list(cycle[:idx])


def side_orientation_start(side: str, orient: str) -> str:
    if side == "top":
        return "left" if orient == "fwd" else "right"
    if side == "right":
        return "top" if orient == "fwd" else "bottom"
    if side == "bottom":
        return "left" if orient == "fwd" else "right"
    if side == "left":
        return "top" if orient == "fwd" else "bottom"
    raise ValueError(f"Unknown side: {side!r}")


def infer_direction_from_start(
    start: str, ccw_starts: set[str], cw_starts: set[str], dimension: str
) -> str:
    if start in ccw_starts:
        return "ccw"
    if start in cw_starts:
        return "cw"
    raise ValueError(
        f"Invalid --start for {dimension} package: {start!r}. "
        f"Expected one of: {', '.join(sorted(ccw_starts | cw_starts))}."
    )


def assign_ordered_two_sided(
    pins: Sequence[str],
    left_count: int,
    right_count: int,
    sequence: str,
    start: str,
) -> tuple[list[str], list[str]]:
    total = left_count + right_count
    if len(pins) != total:
        raise ValueError(
            f"Pin list length ({len(pins)}) must match left+right counts ({total})."
        )

    if sequence == "alternating":
        direction = infer_direction_from_start(start, TWO_CCW_STARTS, TWO_CW_STARTS, "2-sided")
    else:
        direction = sequence

    if direction == "ccw":
        valid_starts = TWO_CCW_STARTS
        cycle = ["left", "right"]
        orientation = {"left": "fwd", "right": "rev"}
    elif direction == "cw":
        valid_starts = TWO_CW_STARTS
        cycle = ["right", "left"]
        orientation = {"right": "fwd", "left": "rev"}
    else:
        raise ValueError(f"Unknown sequence: {sequence!r}")

    if start not in valid_starts:
        raise ValueError(
            f"--start {start!r} is incompatible with --sequence {sequence!r} for 2-sided layout."
        )

    start_side, start_endpoint = start.split("-")
    if side_orientation_start(start_side, orientation[start_side]) != start_endpoint:
        raise ValueError(
            f"--start {start!r} does not match traversal direction for --sequence {sequence!r}."
        )

    side_order = rotate_cycle(cycle, start_side)
    counts = {"left": left_count, "right": right_count}
    assigned = {"left": [""] * left_count, "right": [""] * right_count}

    if sequence in ("ccw", "cw"):
        pin_idx = 0
        for side in side_order:
            side_indices = (
                range(counts[side])
                if orientation[side] == "fwd"
                else range(counts[side] - 1, -1, -1)
            )
            for idx in side_indices:
                assigned[side][idx] = pins[pin_idx]
                pin_idx += 1
    else:  # alternating
        side_indices = {
            side: list(range(counts[side]))
            if orientation[side] == "fwd"
            else list(range(counts[side] - 1, -1, -1))
            for side in side_order
        }
        pos = {side: 0 for side in side_order}
        pin_idx = 0
        while pin_idx < len(pins):
            progressed = False
            for side in side_order:
                p = pos[side]
                idxs = side_indices[side]
                if p >= len(idxs):
                    continue
                assigned[side][idxs[p]] = pins[pin_idx]
                pos[side] += 1
                pin_idx += 1
                progressed = True
                if pin_idx >= len(pins):
                    break
            if not progressed:
                break

    return assigned["left"], assigned["right"]


def assign_ordered_four_sided(
    pins: Sequence[str],
    top_count: int,
    right_count: int,
    bottom_count: int,
    left_count: int,
    sequence: str,
    start: str,
) -> tuple[list[str], list[str], list[str], list[str]]:
    total = top_count + right_count + bottom_count + left_count
    if len(pins) != total:
        raise ValueError(
            f"Pin list length ({len(pins)}) must match top+right+bottom+left counts ({total})."
        )

    if sequence == "alternating":
        direction = infer_direction_from_start(start, FOUR_CCW_STARTS, FOUR_CW_STARTS, "4-sided")
    else:
        direction = sequence

    if direction == "ccw":
        valid_starts = FOUR_CCW_STARTS
        cycle = ["left", "bottom", "right", "top"]
        orientation = {"left": "fwd", "bottom": "fwd", "right": "rev", "top": "rev"}
    elif direction == "cw":
        valid_starts = FOUR_CW_STARTS
        cycle = ["top", "right", "bottom", "left"]
        orientation = {"top": "fwd", "right": "fwd", "bottom": "rev", "left": "rev"}
    else:
        raise ValueError(f"Unknown sequence: {sequence!r}")

    if start not in valid_starts:
        raise ValueError(
            f"--start {start!r} is incompatible with --sequence {sequence!r} for 4-sided layout."
        )

    start_side, start_endpoint = start.split("-")
    if side_orientation_start(start_side, orientation[start_side]) != start_endpoint:
        raise ValueError(
            f"--start {start!r} does not match traversal direction for --sequence {sequence!r}."
        )

    side_order = rotate_cycle(cycle, start_side)
    counts = {
        "top": top_count,
        "right": right_count,
        "bottom": bottom_count,
        "left": left_count,
    }
    assigned = {
        "top": [""] * top_count,
        "right": [""] * right_count,
        "bottom": [""] * bottom_count,
        "left": [""] * left_count,
    }

    if sequence in ("ccw", "cw"):
        pin_idx = 0
        for side in side_order:
            side_indices = (
                range(counts[side])
                if orientation[side] == "fwd"
                else range(counts[side] - 1, -1, -1)
            )
            for idx in side_indices:
                assigned[side][idx] = pins[pin_idx]
                pin_idx += 1
    else:  # alternating
        side_indices = {
            side: list(range(counts[side]))
            if orientation[side] == "fwd"
            else list(range(counts[side] - 1, -1, -1))
            for side in side_order
        }
        pos = {side: 0 for side in side_order}
        pin_idx = 0
        while pin_idx < len(pins):
            progressed = False
            for side in side_order:
                p = pos[side]
                idxs = side_indices[side]
                if p >= len(idxs):
                    continue
                assigned[side][idxs[p]] = pins[pin_idx]
                pos[side] += 1
                pin_idx += 1
                progressed = True
                if pin_idx >= len(pins):
                    break
            if not progressed:
                break

    return assigned["top"], assigned["right"], assigned["bottom"], assigned["left"]


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


def render_edge_border(
    inner_width: int,
    marker_positions: Sequence[int],
    left_corner: str,
    right_corner: str,
    marker_char: str,
) -> str:
    border = ["─"] * inner_width
    for pos in marker_positions:
        if 0 <= pos < inner_width:
            border[pos] = marker_char
    return left_corner + "".join(border) + right_corner


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


def render_wrapped_center_text(text: str, width: int) -> list[str]:
    """Wrap center text into multiple centered rows.

    Split on '/' boundaries first (preserving slash on non-final segments),
    then hard-wrap each segment if it still exceeds the available width.
    """
    if width <= 0:
        return [""]
    if not text:
        return [" " * width]

    rows: list[str] = []
    for segment in split_label_segments(text):
        if not segment:
            rows.append("")
            continue
        for start in range(0, len(segment), width):
            rows.append(segment[start : start + width])

    if not rows:
        rows = [""]

    return [row.center(width) for row in rows]


def render_stems(count: int, inner_width: int, cell_width: int) -> str:
    line = [" "] * inner_width
    if count <= 0:
        return "".join(line)

    for center in pin_centers(count, inner_width, cell_width):
        if 0 <= center < inner_width:
            line[center] = "│"

    return "".join(line)


def render_pipe_dash_trails(count: int, inner_width: int, cell_width: int) -> str:
    line = [" "] * inner_width
    if count <= 0:
        return "".join(line)

    for center in pin_centers(count, inner_width, cell_width):
        for pos in (center - 1, center + 1):
            if 0 <= pos < inner_width:
                line[pos] = "─"
        if 0 <= center < inner_width:
            line[center] = "│"

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

    span = end - start
    # Prefer perfectly even steps whenever the span allows it.
    if span % (count - 1) == 0:
        step = span // (count - 1)
        return [start + idx * step for idx in range(count)]

    cols: list[int] = []
    prev = start - 1

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
        if line[pos] == "│":
            line[pos] = "┼"
        elif line[pos] == " ":
            line[pos] = "─"


def render_top_vertical_trails(
    labels: Sequence[str],
    numbers: Sequence[int],
    pin_width: int,
    inner_width: int,
    edge_cols: Sequence[int],
    show_numbers: bool = True,
) -> list[str]:
    lines: list[str] = []
    items = list(zip(labels, numbers, edge_cols))
    if items:
        if show_numbers:
            contents = [f"{num:>{pin_width}} {label}" for label, num, _ in items]
        else:
            contents = [label for label, _, _ in items]
        required_width = max(
            [inner_width]
            + [edge_col + 3 + len(content) for (_, _, edge_col), content in zip(items, contents)]  # Adjusted spacing
        )
        inner_width = max(inner_width, required_width)

    ordered_edge_cols = [edge_col for _, _, edge_col in items]

    for row_index, (label, num, edge_col) in enumerate(items):
        content = f"{num:>{pin_width}} {label}" if show_numbers else label
        line = [" "] * inner_width

        for prev_col in ordered_edge_cols[:row_index]:
            if 0 <= prev_col < inner_width:
                line[prev_col] = "│"

        if not (0 <= edge_col < inner_width):
            lines.append("".join(line))
            continue

        content_start = max(edge_col + 3, inner_width - len(content))  # Ensure alignment is preserved
        draw_horizontal_segment(line, edge_col + 1, content_start - 2)
        write_text(line, content_start, content)
        # Top fan-out rows connect from package (below) to labels (right).
        line[edge_col] = "┌"
        lines.append("".join(line))

    if items:
        connector_row = [" "] * inner_width
        for edge_col in ordered_edge_cols:
            if 0 <= edge_col < inner_width:
                connector_row[edge_col] = "│"
        lines.append("".join(connector_row))

    return lines

def render_bottom_vertical_trails(
    labels: Sequence[str],
    numbers: Sequence[int],
    pin_width: int,
    inner_width: int,
    edge_cols: Sequence[int],
    show_numbers: bool = True,
) -> list[str]:
    """Render bottom-side pin trails, growing away from the IC body.

    Strategy: iterate pins in forward (left-to-right) order, accumulating the
    set of already-rendered columns that need continuation stems.  Append a
    connector row last, then reverse the whole list so the connector ends up
    nearest the IC border.
    """
    items = list(zip(labels, numbers, edge_cols))
    if items:
        if show_numbers:
            contents = [f"{num:>{pin_width}} {label}" for label, num, _ in items]
        else:
            contents = [label for label, _, _ in items]
        required_width = max(
            [inner_width]
            + [edge_col + 3 + len(content) for (_, _, edge_col), content in zip(items, contents)]  # Adjusted spacing
        )
        inner_width = max(inner_width, required_width)

    lines: list[str] = []
    rendered_cols: list[int] = []

    for label, num, edge_col in items:
        content = f"{num:>{pin_width}} {label}" if show_numbers else label
        line = [" "] * inner_width

        for col in rendered_cols:
            if 0 <= col < inner_width:
                line[col] = "│"

        if not (0 <= edge_col < inner_width):
            lines.append("".join(line))
            rendered_cols.append(edge_col)
            continue

        content_start = max(edge_col + 3, inner_width - len(content))  # Ensure alignment is preserved
        draw_horizontal_segment(line, edge_col + 1, content_start - 2)
        write_text(line, content_start, content)
        # Bottom fan-out rows connect from package (above) to labels (right).
        line[edge_col] = "└"
        lines.append("".join(line))
        rendered_cols.append(edge_col)

    if items:
        connector_row = [" "] * inner_width
        for _, _, edge_col in items:
            if 0 <= edge_col < inner_width:
                connector_row[edge_col] = "│"
        lines.append("".join(connector_row))

    lines.reverse()
    return lines


def render_two_sided(
    name: str,
    left: Sequence[str],
    right: Sequence[str],
    numbering: str = "ccw",
) -> str:
    if not left and not right:
        raise ValueError("At least one pin must be provided.")

    total_pins = len(left) + len(right)
    show_numbers = numbering != "none"

    # --- Pin number sequences (visual display order) ---
    # cw is identical to ccw for 2-sided packages (there is only one meaningful
    # counterclockwise direction for a DIP/SOIC footprint).
    if numbering == "seq":
        pin_width = max(2, len(str(max(len(left), len(right), 1))))
        left_nums = list(range(1, len(left) + 1))
        right_nums = list(range(1, len(right) + 1))
    else:  # ccw, cw, none
        pin_width = max(2, len(str(max(total_pins, 1))))
        left_nums = list(range(1, len(left) + 1))
        right_nums = list(range(total_pins, len(left), -1))

    left_width = max((len(p) for p in left), default=1)
    right_width = max((len(p) for p in right), default=1)
    inner_width = max(4, len(name) + 2)
    name_rows = render_wrapped_center_text(name, inner_width)
    rows = max(len(left), len(right), len(name_rows), 1)

    if show_numbers:
        left_indent = pin_width + 1 + left_width + 3
        right_trailing = 3 + right_width + 1 + pin_width
    else:
        left_indent = left_width + 3
        right_trailing = 3 + right_width

    lines: list[str] = []
    lines.append(" " * left_indent + "┌" + "─" * inner_width + "┐")

    name_start = (rows - len(name_rows)) // 2
    for idx in range(rows):
        if idx < len(left):
            llabel = left[idx]
            if show_numbers:
                left_prefix = f"{llabel:<{left_width}} {left_nums[idx]:>{pin_width}} ──┤"
            else:
                left_prefix = f"{llabel:<{left_width}} ──┤"
        else:
            left_prefix = " " * left_indent + "│"

        if name_start <= idx < name_start + len(name_rows):
            body = name_rows[idx - name_start]
        else:
            body = " " * inner_width

        if idx < len(right):
            rlabel = right[idx]
            if show_numbers:
                right_suffix = (
                    f"├── {right_nums[idx]:>{pin_width}}   {rlabel:<{right_width}}"
                )
            else:
                right_suffix = f"├── {rlabel:<{right_width}}"
        else:
            right_suffix = "│" + " " * right_trailing

        lines.append(left_prefix + body + right_suffix)

    lines.append(" " * left_indent + "└" + "─" * inner_width + "┘")
    return "\n".join(lines)


def render_four_sided(
    name: str,
    top: Sequence[str],
    right: Sequence[str],
    bottom: Sequence[str],
    left: Sequence[str],
    vertical_spread: bool = False,
    numbering: str = "ccw",
) -> str:
    total_pins = len(top) + len(right) + len(bottom) + len(left)
    if total_pins == 0:
        raise ValueError("At least one pin must be provided.")

    show_numbers = numbering != "none"

    if numbering == "seq":
        pin_width = max(2, len(str(max(len(top), len(right), len(bottom), len(left), 1))))
    else:
        pin_width = max(2, len(str(total_pins)))

    # --- Pin number sequences (all in visual display order) ---
    if numbering in ("ccw", "none"):
        left_nums = list(range(1, len(left) + 1))
        bottom_nums = list(range(len(left) + 1, len(left) + len(bottom) + 1))
        right_nums_top_down = list(range(
            len(left) + len(bottom) + len(right), len(left) + len(bottom), -1,
        ))
        top_nums_left_to_right = list(range(
            total_pins, len(left) + len(bottom) + len(right), -1,
        ))
    elif numbering == "cw":
        # Pin 1 at top-left of top side, going clockwise.
        top_nums_left_to_right = list(range(1, len(top) + 1))
        right_nums_top_down = list(range(len(top) + 1, len(top) + len(right) + 1))
        # Bottom increases right-to-left in CW, so left-to-right visual is decreasing.
        bottom_nums = list(range(
            len(top) + len(right) + len(bottom), len(top) + len(right), -1,
        ))
        # Left increases bottom-to-top in CW, so top-to-bottom visual is decreasing.
        left_nums = list(range(
            total_pins, len(top) + len(right) + len(bottom), -1,
        ))
    elif numbering == "seq":
        left_nums = list(range(1, len(left) + 1))
        bottom_nums = list(range(1, len(bottom) + 1))
        right_nums_top_down = list(range(1, len(right) + 1))
        top_nums_left_to_right = list(range(1, len(top) + 1))
    else:
        raise ValueError(f"Unknown numbering schema: {numbering!r}")

    left_width = max((len(p) for p in left), default=1)
    right_width = max((len(p) for p in right), default=1)

    horizontal_label_width = max(
        (len(seg) for label in [*top, *bottom] for seg in split_label_segments(label)),
        default=1,
    )
    cell_width = max(3, pin_width, horizontal_label_width)

    top_span = segment_width(len(top), cell_width)
    bottom_span = segment_width(len(bottom), cell_width)

    if show_numbers:
        top_entry_width = max(
            [len(f"{num:>{pin_width}} {label}") for label, num in zip(top, top_nums_left_to_right)]
            or [1]
        )
        bottom_entry_width = max(
            [len(f"{num:>{pin_width}} {label}") for label, num in zip(bottom, bottom_nums)]
            or [1]
        )
    else:
        top_entry_width = max([len(label) for label in top] or [1])
        bottom_entry_width = max([len(label) for label in bottom] or [1])

    if vertical_spread:
        # Give short labels a little extra horizontal fan-out so adjacent
        # vertical tracks are easier to read, while keeping long labels compact.
        top_spread_bonus = max(0, min(max(0, len(top) - 1), 10 - top_entry_width))
        bottom_spread_bonus = max(0, min(max(0, len(bottom) - 1), 10 - bottom_entry_width))
        # Keep width just large enough for the longest trail label plus one
        # distinct connector column per pin.
        top_track_width = top_entry_width + len(top) + 2 + top_spread_bonus
        bottom_track_width = bottom_entry_width + len(bottom) + 2 + bottom_spread_bonus
        track_width = max(4, top_track_width, bottom_track_width)
        # Keep the IC body compact; it does not need to match label trail width.
        min_body_for_markers = max(len(top), len(bottom)) * 2 + 1
        body_inner_width = max(4, len(name) + 2, min_body_for_markers)

        # Nudge width to support even marker spacing for active top/bottom sides.
        active_counts = [count for count in (len(top), len(bottom)) if count > 1]
        if active_counts:
            guard = 0
            while any((body_inner_width - 3) % (count - 1) != 0 for count in active_counts):
                body_inner_width += 1
                guard += 1
                if guard > 128:
                    break

        # Long labels can make trails too dominant; shift all marker columns left
        # by reserving a little right margin as a fallback.
        max_entry_width = max(top_entry_width, bottom_entry_width)
        vertical_pin_right_padding = max(0, min(max(len(top), len(bottom)), (max_entry_width - 18) // 3))
    else:
        body_inner_width = max(4, len(name) + 2, top_span, bottom_span)
        track_width = body_inner_width
        vertical_pin_right_padding = 0

    name_rows = render_wrapped_center_text(name, body_inner_width)

    top_edge_cols = (
        distribute_columns(
            1,
            max(1, body_inner_width - 2 - vertical_pin_right_padding),
            len(top),
        )
        if vertical_spread and top
        else []
    )
    bottom_edge_cols = (
        distribute_columns(
            1,
            max(1, body_inner_width - 2 - vertical_pin_right_padding),
            len(bottom),
        )
        if vertical_spread and bottom
        else []
    )

    top_markers = top_edge_cols if vertical_spread and top else pin_centers(
        len(top), body_inner_width, cell_width
    )
    bottom_markers = bottom_edge_cols if vertical_spread and bottom else pin_centers(
        len(bottom), body_inner_width, cell_width
    )

    if show_numbers:
        left_indent = pin_width + 1 + left_width + 3
        right_trailing = 3 + right_width + 1 + pin_width
    else:
        left_indent = left_width + 3
        right_trailing = 3 + right_width

    # Minimum of 3 body rows so the IC name always has visible breathing room
    # even when left/right sides have only 0–2 pins.
    rows = max(len(left), len(right), len(name_rows), 3)

    lines: list[str] = []

    if top:
        if vertical_spread:
            top_pin_lines = render_top_vertical_trails(
                top,
                top_nums_left_to_right,
                pin_width,
                track_width,
                top_edge_cols,
                show_numbers=show_numbers,
            )
            for pin_line in top_pin_lines:
                lines.append(" " * (left_indent + 1) + pin_line)
        else:
            top_label_rows = render_wrapped_cells(top, body_inner_width, cell_width)
            top_stems_line = render_stems(len(top), body_inner_width, cell_width)

            for row in top_label_rows:
                lines.append(" " * (left_indent + 1) + row)
            if show_numbers:
                top_numbers_line = render_cells(
                    [str(num) for num in top_nums_left_to_right], body_inner_width, cell_width
                )
                lines.append(" " * (left_indent + 1) + top_numbers_line)
            lines.append(" " * (left_indent + 1) + top_stems_line)

    lines.append(
        " " * left_indent
        + render_edge_border(
            body_inner_width,
            top_markers,
            left_corner="┌",
            right_corner="┐",
            marker_char="┴",
        )
    )

    name_start = (rows - len(name_rows)) // 2
    for idx in range(rows):
        if idx < len(left):
            llabel = left[idx]
            if show_numbers:
                left_prefix = f"{llabel:<{left_width}} {left_nums[idx]:>{pin_width}} ──┤"
            else:
                left_prefix = f"{llabel:<{left_width}} ──┤"
        else:
            left_prefix = " " * left_indent + "│"

        if name_start <= idx < name_start + len(name_rows):
            body = name_rows[idx - name_start]
        else:
            body = " " * body_inner_width

        if idx < len(right):
            rlabel = right[idx]
            if show_numbers:
                right_suffix = (
                    f"├── {right_nums_top_down[idx]:>{pin_width}}   {rlabel:<{right_width}}"
                )
            else:
                right_suffix = f"├── {rlabel:<{right_width}}"
        else:
            right_suffix = "│" + " " * right_trailing

        lines.append(left_prefix + body + right_suffix)

    lines.append(
        " " * left_indent
        + render_edge_border(
            body_inner_width,
            bottom_markers,
            left_corner="└",
            right_corner="┘",
            marker_char="┬",
        )
    )

    if bottom:
        if vertical_spread:
            bottom_pin_lines = render_bottom_vertical_trails(
                bottom,
                bottom_nums,
                pin_width,
                track_width,
                bottom_edge_cols,
                show_numbers=show_numbers,
            )
            for pin_line in bottom_pin_lines:
                lines.append(" " * (left_indent + 1) + pin_line)
        else:
            bottom_stems_line = render_stems(len(bottom), body_inner_width, cell_width)
            bottom_label_rows = render_wrapped_cells(bottom, body_inner_width, cell_width)

            lines.append(" " * (left_indent + 1) + bottom_stems_line)
            if show_numbers:
                bottom_numbers_line = render_cells(
                    [str(num) for num in bottom_nums], body_inner_width, cell_width
                )
                lines.append(" " * (left_indent + 1) + bottom_numbers_line)
            for row in bottom_label_rows:
                lines.append(" " * (left_indent + 1) + row)

    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Generate ASCII IC pinout diagrams from an ordered pin list. "
            "Use --pins, --counts, --sequence, and --start."
        )
    )
    sub = parser.add_subparsers(dest="mode")

    parser_two = sub.add_parser(
        "two",
        help="Render a 2-sided diagram (counts: left,right)",
    )
    parser_two.add_argument("--name", required=True, help="IC/package name")
    parser_two.add_argument(
        "--pins",
        required=True,
        help="Ordered comma-separated pin labels",
    )
    parser_two.add_argument(
        "--counts",
        required=True,
        help="Side pin counts as left,right",
    )
    parser_two.add_argument(
        "--sequence",
        choices=["ccw", "cw", "alternating"],
        default="ccw",
        help=(
            "How ordered --pins are walked around the package (default: ccw). "
            "ccw: side-by-side counterclockwise, cw: side-by-side clockwise, "
            "alternating: round-robin across sides in traversal order."
        ),
    )
    parser_two.add_argument(
        "--start",
        choices=["left-top", "right-top", "left-bottom", "right-bottom"],
        default="left-top",
        help="Traversal start endpoint (default: left-top)",
    )
    parser_two.add_argument(
        "--numbering",
        choices=["ccw", "cw", "seq", "none"],
        default="ccw",
        help=(
            "Pin numbering schema (default: ccw). "
            "ccw: counterclockwise, standard DIP/SOIC — pin 1 at top-left going down; "
            "cw: treated as ccw for 2-sided packages; "
            "seq: each side numbered independently from 1; "
            "none: labels only, no pin numbers."
        ),
    )

    parser_four = sub.add_parser(
        "four",
        help="Render a 4-sided diagram (counts: top,right,bottom,left)",
    )
    parser_four.add_argument("--name", required=True, help="IC/package name")
    parser_four.add_argument(
        "--pins",
        required=True,
        help="Ordered comma-separated pin labels",
    )
    parser_four.add_argument(
        "--counts",
        required=True,
        help="Side pin counts as top,right,bottom,left",
    )
    parser_four.add_argument(
        "--sequence",
        choices=["ccw", "cw", "alternating"],
        default="ccw",
        help=(
            "How ordered --pins are walked around the package (default: ccw). "
            "ccw: side-by-side counterclockwise, cw: side-by-side clockwise, "
            "alternating: round-robin across sides in traversal order."
        ),
    )
    parser_four.add_argument(
        "--start",
        choices=[
            "top-left",
            "right-top",
            "bottom-right",
            "left-bottom",
            "left-top",
            "bottom-left",
            "right-bottom",
            "top-right",
        ],
        default="left-top",
        help="Traversal start endpoint (default: left-top)",
    )
    parser_four.add_argument(
        "--vertical-spread",
        action="store_true",
        help="Render top/bottom sides as vertical lists to reduce diagram width",
    )
    parser_four.add_argument(
        "--numbering",
        choices=["ccw", "cw", "seq", "none"],
        default="ccw",
        help=(
            "Pin numbering schema (default: ccw). "
            "ccw: counterclockwise, standard QFP/QFN — pin 1 at top-left of left side; "
            "cw: clockwise — pin 1 at top-left of top side; "
            "seq: each side numbered independently from 1; "
            "none: labels only, no pin numbers."
        ),
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
        ordered_pins = parse_pin_list(args.pins)
        try:
            left_count, right_count = parse_side_counts(args.counts, 2, "--counts")
            left, right = assign_ordered_two_sided(
                ordered_pins,
                left_count,
                right_count,
                sequence=args.sequence,
                start=args.start,
            )
        except ValueError as exc:
            parser.error(str(exc))

        print(render_two_sided(args.name, left, right, numbering=args.numbering))
        return 0

    if args.mode == "four":
        ordered_pins = parse_pin_list(args.pins)
        try:
            top_count, right_count, bottom_count, left_count = parse_side_counts(
                args.counts,
                4,
                "--counts",
            )
            top, right, bottom, left = assign_ordered_four_sided(
                ordered_pins,
                top_count,
                right_count,
                bottom_count,
                left_count,
                sequence=args.sequence,
                start=args.start,
            )
        except ValueError as exc:
            parser.error(str(exc))

        print(
            render_four_sided(
                args.name,
                top,
                right,
                bottom,
                left,
                vertical_spread=args.vertical_spread,
                numbering=args.numbering,
            )
        )
        return 0

    # argparse subparsers reject unknown modes before this point.
    parser.error(f"Unknown mode: {args.mode!r}")  # pragma: no cover


if __name__ == "__main__":
    sys.exit(main())
