#!/usr/bin/env python3
"""Export all Seadb bases into separate directories."""

import argparse
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


def list_base_ids() -> list[str]:
    result = run_command("seadb-cli", "base", "list", "--scope", "mine")
    return list(dict.fromkeys(BASE_ID_PATTERN.findall(result.stdout)))


def export_base(base_id: str, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    run_command(
        "seadb-cli",
        "export",
        "--base",
        base_id,
        "--output",
        str(output_dir),
    )


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s %(funcName)s %(message)s",
        stream=sys.stdout,
        force=True,
    )
    parser = argparse.ArgumentParser(description="Export all Seadb bases.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("dump_dir"),
        help="Export root directory (default: ./dump_dir)",
    )
    args = parser.parse_args()

    try:
        base_ids = list_base_ids()
        args.output.mkdir(parents=True, exist_ok=True)
    except (OSError, RuntimeError) as exc:
        logger.error("Initialization failed: %s", exc, exc_info=True)
        return 1

    if not base_ids:
        logger.error("No Base IDs found.")
        return 1

    failed_base_ids: list[str] = []
    for base_id in base_ids:
        logger.info("Starting export for Base %s...", base_id)
        try:
            export_base(base_id, args.output)
        except (OSError, RuntimeError) as exc:
            failed_base_ids.append(base_id)
            logger.error("Failed to export Base %s: %s", base_id, exc, exc_info=True)
            continue
        logger.info("Base %s exported successfully to %s", base_id, args.output)

    if failed_base_ids:
        logger.error(
            "%d Base export(s) failed: %s",
            len(failed_base_ids),
            ", ".join(failed_base_ids),
        )
        return 1

    logger.info(
        "All %d Base(s) exported successfully to %s", len(base_ids), args.output
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
