#!/usr/bin/env python3
"""Import all exported Seadb bases with their matching table templates."""

import argparse
import json
import logging
import re
import sys
import subprocess
from pathlib import Path


BASE_ID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
)
logger = logging.getLogger(__name__)


def run_command(*args: str) -> subprocess.CompletedProcess[str]:
    """Run a command and return its completed process."""
    try:
        return subprocess.run(args, text=True, capture_output=True, check=True)
    except FileNotFoundError as exc:
        raise RuntimeError(
            "seadb-cli was not found. Make sure it is installed and available in PATH."
        ) from exc
    except subprocess.CalledProcessError as exc:
        error = exc.stderr.strip() or exc.stdout.strip() or "no error output"
        raise RuntimeError(f"Command failed: {' '.join(args)}\n{error}") from exc


def import_base(
    dump_file: Path,
    table_templates_file: Path
) -> str:
    result = run_command(
        "seadb-cli",
        "import",
        "--input",
        str(dump_file),
        "--table-templates",
        str(table_templates_file),
    )
    imported_base_ids = BASE_ID_PATTERN.findall(
        f"{result.stdout}\n{result.stderr}"
    )
    if not imported_base_ids:
        raise RuntimeError(
            "The import command succeeded, but no new Base ID was found in its output."
        )

    return imported_base_ids[-1]


def write_mapping(mapping: dict[str, str], output_file: Path) -> None:
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(
        json.dumps(mapping, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s %(funcName)s %(message)s",
        stream=sys.stdout,
        force=True,
    )
    parser = argparse.ArgumentParser(description="Import all Seadb bases.")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("dump_dir"),
        help="Directory containing dump and table template files (default: ./dump_dir)",
    )
    parser.add_argument(
        "--table-templates-dir",
        type=Path,
        default=None,
        help="Directory containing table template JSON files (default: --input-dir)",
    )
    parser.add_argument(
        "--mapping-output",
        type=Path,
        default=Path("base_id_mapping.json"),
        help="Old-to-new Base ID mapping file (default: ./base_id_mapping.json)",
    )
    args = parser.parse_args()

    table_templates_dir = args.table_templates_dir or args.input_dir
    if not args.input_dir.is_dir():
        logger.error("Input directory does not exist: %s", args.input_dir)
        return 1
    if not table_templates_dir.is_dir():
        logger.error("Table templates directory does not exist: %s", table_templates_dir)
        return 1

    dump_files = sorted(args.input_dir.glob("*.dump"))
    if not dump_files:
        logger.error("No dump files found in directory: %s", args.input_dir)
        return 1

    mapping: dict[str, str] = {}
    failed_base_ids: list[str] = []

    for dump_file in dump_files:
        base_id = dump_file.stem
        if not BASE_ID_PATTERN.fullmatch(base_id):
            logger.warning("Skipping file with an unrecognized Base ID: %s", dump_file)
            continue

        table_templates_file = table_templates_dir / f"{base_id}.json"
        if not table_templates_file.is_file():
            failed_base_ids.append(base_id)
            logger.error(
                "Failed to import Base %s: matching table templates file not found: %s",
                base_id,
                table_templates_file,
            )
            continue

        logger.info("Starting import for Base %s...", base_id)
        try:
            new_base_id = import_base(
                dump_file,
                table_templates_file
            )
            mapping[base_id] = new_base_id
            write_mapping(mapping, args.mapping_output)
        except (OSError, RuntimeError) as exc:
            failed_base_ids.append(base_id)
            logger.error("Failed to import Base %s: %s", base_id, exc, exc_info=True)
            continue

        logger.info("Base %s imported successfully; new Base ID: %s", base_id, new_base_id)

    if not mapping:
        logger.error("No Base was imported successfully.")
        return 1

    if failed_base_ids:
        logger.error(
            "%d Base import(s) failed: %s",
            len(failed_base_ids),
            ", ".join(failed_base_ids),
        )

    logger.info(
        "All %d Base(s) imported successfully; mapping file: %s",
        len(mapping),
        args.mapping_output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
