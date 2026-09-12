#!/usr/bin/env python3
"""Generate a mapping from Seadb base IDs to their table templates."""

import argparse
import json
import logging
import re
import sys
import subprocess
from pathlib import Path
from typing import Any


BASE_ID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
)
TABLE_SUFFIX_PATTERN = re.compile(r"_\d+$")
logger = logging.getLogger(__name__)
NEED_CUSTOM_COLUMNS = {
    "github_issue": ["labels", "issue_type"],
    "tickets": ["state", "substate", "type"],
    "portal_issues": ["state", "substate", "type"],
    "general_task": ["status", "size", "priority"],
    "linear_issue": ["state", "labels"],
    "jira_issue": ["status", "issue_type", "priority"],
}


def run_command(*args: str) -> str:
    """Run a command and return stdout, raising a useful error on failure."""
    try:
        result = subprocess.run(
            args,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "seadb-cli was not found. Make sure it is installed and available in PATH."
        ) from exc
    except subprocess.CalledProcessError as exc:
        error = exc.stderr.strip() or exc.stdout.strip() or "no error output"
        raise RuntimeError(f"Command failed: {' '.join(args)}\n{error}") from exc

    return result.stdout


def list_base_ids() -> list[str]:
    output = run_command("seadb-cli", "base", "list", "--scope", "mine")
    # UUID matching avoids depending on the CLI table's box-drawing characters.
    return list(dict.fromkeys(BASE_ID_PATTERN.findall(output)))


def get_base_metadata(base_id: str) -> dict[str, Any]:
    output = run_command("seadb-cli", "base", "metadata", base_id)
    try:
        metadata = json.loads(output)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Metadata for Base {base_id} is not valid JSON.") from exc

    if not isinstance(metadata, dict) or not isinstance(metadata.get("tables"), list):
        raise RuntimeError(f"Metadata for Base {base_id} has no valid tables field.")

    return metadata


def build_mapping(base_ids: list[str], template_name: str) -> dict[str, dict[str, dict[str, str]]]:
    mapping: dict[str, dict[str, dict[str, str]]] = {}

    for base_id in base_ids:
        tables: dict[str, dict[str, str]] = {}
        for table in get_base_metadata(base_id)["tables"]:
            if not isinstance(table, dict) or not isinstance(table.get("name"), str):
                logger.warning(
                    "Base %s contains a table without a valid name; skipping it.",
                    base_id,
                )
                continue

            table_name = table["name"]
            template_table_name = TABLE_SUFFIX_PATTERN.sub("", table_name)
            table_mapping = {"template_table_name": template_table_name, 'template_base_name': template_name}
            custom_columns = NEED_CUSTOM_COLUMNS.get(template_table_name)
            if custom_columns is not None:
                table_mapping["custom_columns"] = custom_columns
            tables[table_name] = table_mapping

        mapping[base_id] = tables

    return mapping


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        stream=sys.stdout,
        force=True,
    )
    parser = argparse.ArgumentParser(
        description="Generate a JSON mapping from Seadb bases to table templates."
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("."),
        help="Output directory (default: current directory)",
    )

    parser.add_argument(
        "--template-name",
        required=True,
        help="Template name to use for every Base",
    )
    args = parser.parse_args()

    try:
        base_ids = list_base_ids()
        mapping = build_mapping(base_ids, args.template_name)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.mkdir(parents=True, exist_ok=True)
        for base_id, tables in mapping.items():
            output_file = args.output / f"{base_id}.json"
            output_file.write_text(
                json.dumps(tables, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
    except RuntimeError as exc:
        logger.error("%s", exc, exc_info=True)
        return 1

    logger.info(
        "Processed %d Base(s); results saved to directory: %s",
        len(base_ids),
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
