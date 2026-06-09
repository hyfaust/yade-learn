#!/usr/bin/env python3
"""
build.py — Generate app.js from chapter README.md files.

This script reads the markdown tutorial files from each chapter directory
and generates the CHAPTERS section of app.js, ensuring the web viewer
content stays in sync with the source markdown files.

Usage:
    python3 build.py
"""

import os
import re

# ── Configuration ──────────────────────────────────────────────

CHAPTERS = [
    {"id": 1, "dir": "01_bouncing_sphere",     "title": "弹跳球",          "level": "beginner",     "icon": "🟢"},
    {"id": 2, "dir": "02_gravity_deposition",   "title": "重力沉降",        "level": "beginner",     "icon": "🟢"},
    {"id": 3, "dir": "03_oedometric_test",      "title": "一维压缩试验",    "level": "intermediate", "icon": "🟡"},
    {"id": 4, "dir": "04_periodic_shear",       "title": "周期性简单剪切",  "level": "intermediate", "icon": "🟡"},
    {"id": 5, "dir": "05_sphere_packing",       "title": "球体堆积技术",    "level": "intermediate", "icon": "🟡"},
    {"id": 6, "dir": "06_triaxial_test",        "title": "三轴试验",        "level": "advanced",     "icon": "🔴"},
    {"id": 7, "dir": "07_concrete_mechanics",   "title": "混凝土力学",      "level": "advanced",     "icon": "🔴"},
    {"id": 8, "dir": "08_clumps_breakage",      "title": "团簇与破碎",      "level": "advanced",     "icon": "🔴"},
    {"id": 9, "dir": "09_fluid_coupling",       "title": "流固耦合",        "level": "advanced",     "icon": "🔴"},
]

APP_JS = "app.js"
README_FILE = "README.md"

# ── Helpers ────────────────────────────────────────────────────

def escape_for_template_literal(text: str) -> str:
    """Escape characters that would break a JS template literal (backtick string)."""
    # Escape backslashes first (must be done before other escapes)
    text = text.replace("\\", "\\\\")
    # Escape backticks
    text = text.replace("`", "\\`")
    # Escape ${...} template literal expressions
    text = text.replace("${", "\\${")
    return text


def read_chapter_markdown(chapter_dir: str) -> str:
    """Read README.md from a chapter directory and return its content."""
    path = os.path.join(chapter_dir, README_FILE)
    if not os.path.exists(path):
        print(f"  WARNING: {path} not found, skipping")
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def build_chapters_js(chapters_data: list) -> str:
    """Generate the JavaScript CHAPTERS object from chapter data."""
    lines = ["  const CHAPTERS = {"]
    for ch in chapters_data:
        escaped_md = escape_for_template_literal(ch["markdown"])
        lines.append(f'    {ch["id"]}: {{')
        lines.append(f'      title: "{ch["title"]}",')
        lines.append(f'      level: "{ch["level"]}",')
        lines.append(f'      icon: "{ch["icon"]}",')
        lines.append(f"      markdown: `{escaped_md}`")
        lines.append("    },")
    lines.append("  };")
    return "\n".join(lines)


# ── Main ───────────────────────────────────────────────────────

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    print("Building app.js from chapter README.md files...\n")

    # 1. Read chapter markdown files
    chapters_data = []
    for ch in CHAPTERS:
        print(f"  Reading {ch['dir']}/{README_FILE}...")
        md = read_chapter_markdown(ch["dir"])
        if not md:
            print(f"  SKIPPED: {ch['dir']}")
            continue
        chapters_data.append({
            "id": ch["id"],
            "title": ch["title"],
            "level": ch["level"],
            "icon": ch["icon"],
            "markdown": md,
        })
        print(f"  OK: {len(md)} chars")

    # 2. Read existing app.js
    with open(APP_JS, "r", encoding="utf-8") as f:
        app_js = f.read()

    # 3. Find the CHAPTERS section boundaries
    #    Start: "  const CHAPTERS = {"
    #    End:   the line after the closing "  };"  (before CHAPTER_META)
    chapters_start = app_js.find("  const CHAPTERS = {")
    if chapters_start == -1:
        print("ERROR: Could not find 'const CHAPTERS = {' in app.js")
        return

    # Find the end of CHAPTERS: look for "  /*" that starts the next section
    # (the CHAPTER_META section comment)
    meta_marker = "  /* --------------------------------------------------------\n     2. CHAPTER METADATA"
    chapters_end = app_js.find(meta_marker, chapters_start)
    if chapters_end == -1:
        print("ERROR: Could not find CHAPTER_META section marker in app.js")
        return

    # 4. Build the new chapters section
    new_chapters = build_chapters_js(chapters_data)

    # 5. Assemble the new app.js
    before = app_js[:chapters_start]
    after = app_js[chapters_end:]
    new_app_js = before + new_chapters + "\n\n" + after

    # 6. Write the generated file
    with open(APP_JS, "w", encoding="utf-8") as f:
        f.write(new_app_js)

    print(f"\n✓ Generated {APP_JS} ({len(new_app_js)} bytes)")
    print(f"  {len(chapters_data)} chapters processed")


if __name__ == "__main__":
    main()
