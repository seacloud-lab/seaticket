#!/usr/bin/env python3
"""Replace imported Seadb Base IDs with their original Base IDs."""

import argparse
import json
import logging
import uuid
from pathlib import Path
from typing import Any
import sys
import os
import requests
import base64

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'seahub.settings')
import django

django.setup()
from seahub.settings import SEADB_SERVER_URL
from seahub.utils import uuid_str_to_36_chars


logger = logging.getLogger(__name__)


def parse_response(response):
    if response.status_code >= 400 or response.status_code < 200:
        raise ConnectionError(response.status_code, response.text)
    else:
        try:
            return response.json()
        except:
            pass

class SeaDBAPI:
    def __init__(self, seadb_user, seadb_password, timeout=30):
        self.timeout = timeout
        self.server_url = SEADB_SERVER_URL
        self.headers = None
        self.user = seadb_user
        self.password = seadb_password
        self.gen_headers()

    def gen_headers(self):
        auth_str = f"{self.user}:{self.password}"
        b64 = base64.b64encode(auth_str.encode("utf-8")).decode()
        self.headers = {
            "Authorization": f"Basic {b64}"
        }
    
    def update_base_id(self, base_id, new_base_id):
        base_id = uuid_str_to_36_chars(base_id)        
        post_data = {
            "base_id": new_base_id
        }
        url = f'{self.server_url}/api/v1/{base_id}/base/update-base-id'
        response = requests.post(url, json=post_data, headers=self.headers, timeout=self.timeout)
        return parse_response(response)


def load_mapping(mapping_file: Path) -> dict[str, str]:
    try:
        data = json.loads(mapping_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Failed to read mapping file {mapping_file}: {exc}") from exc

    if not isinstance(data, dict):
        raise RuntimeError("The input mapping must be a JSON object.")

    mapping: dict[str, str] = {}
    for old_base_id, imported_base_id in data.items():
        if not isinstance(old_base_id, str) or not isinstance(imported_base_id, str):
            raise RuntimeError("Base ID mapping keys and values must be strings.")
        mapping[old_base_id] = imported_base_id

    return mapping


def load_state(state_file: Path) -> dict[str, dict[str, Any]]:
    if not state_file.exists():
        return {}

    try:
        data = json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Failed to read state file {state_file}: {exc}") from exc

    if not isinstance(data, dict):
        raise RuntimeError("The state file must be a JSON object.")

    return data


def write_state(state: dict[str, dict[str, Any]], state_file: Path) -> None:
    state_file.parent.mkdir(parents=True, exist_ok=True)
    temporary_file = state_file.with_suffix(f"{state_file.suffix}.tmp")
    temporary_file.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_file.replace(state_file)


def generate_temporary_id(used_ids: set[str]) -> str:
    temporary_id = str(uuid.uuid4())
    while temporary_id in used_ids:
        temporary_id = str(uuid.uuid4())
    used_ids.add(temporary_id)
    return temporary_id


def prepare_state(
    imported_mapping: dict[str, str],
    existing_state: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    used_ids = set(imported_mapping) | set(imported_mapping.values())
    state: dict[str, dict[str, Any]] = {}

    for old_base_id, imported_base_id in imported_mapping.items():
        previous = existing_state.get(old_base_id, {})
        if not isinstance(previous, dict):
            raise RuntimeError(f"Invalid state for Base {old_base_id}.")

        temporary_base_id = previous.get("temporary_base_id")
        if not isinstance(temporary_base_id, str):
            temporary_base_id = generate_temporary_id(used_ids)
        else:
            used_ids.add(temporary_base_id)

        state[old_base_id] = {
            "imported_base_id": imported_base_id,
            "temporary_base_id": temporary_base_id,
            "status": previous.get("status", "pending"),
        }

    return state


def release_original_ids(
    seadb_api: SeaDBAPI,
    state: dict[str, dict[str, Any]],
    state_file: Path,
) -> list[str]:
    failed_base_ids: list[str] = []
    for old_base_id, item in state.items():
        if item["status"] in {"original_id_released", "completed"}:
            continue

        temporary_base_id = item["temporary_base_id"]
        logger.info(
            "Releasing original Base ID %s by renaming it to %s.",
            old_base_id,
            temporary_base_id,
        )
        try:
            seadb_api.update_base_id(old_base_id, temporary_base_id)
        except Exception as exc:
            failed_base_ids.append(old_base_id)
            logger.error(
                "Failed to release original Base ID %s: %s",
                old_base_id,
                exc,
                exc_info=True,
            )
            continue

        item["status"] = "original_id_released"
        write_state(state, state_file)

    return failed_base_ids


def restore_original_ids(
    seadb_api: SeaDBAPI,
    state: dict[str, dict[str, Any]],
    state_file: Path,
) -> list[str]:
    failed_base_ids: list[str] = []
    for old_base_id, item in state.items():
        if item["status"] == "completed":
            continue
        if item["status"] != "original_id_released":
            logger.warning(
                "Skipping Base %s because its original ID has not been released; status: %s.",
                old_base_id,
                item["status"],
            )
            continue

        imported_base_id = item["imported_base_id"]
        logger.info(
            "Renaming imported Base %s to original Base ID %s.",
            imported_base_id,
            old_base_id,
        )
        try:
            seadb_api.update_base_id(imported_base_id, old_base_id)
        except Exception as exc:
            failed_base_ids.append(old_base_id)
            logger.error(
                "Failed to restore original Base ID %s from imported Base %s: %s",
                old_base_id,
                imported_base_id,
                exc,
                exc_info=True,
            )
            continue

        item["status"] = "completed"
        write_state(state, state_file)

    return failed_base_ids


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(name)s:%(lineno)s %(funcName)s %(message)s",
        stream=sys.stdout,
        force=True,
    )
    parser = argparse.ArgumentParser(
        description="Replace imported Seadb Base IDs with their original IDs."
    )
    parser.add_argument(
        "--mapping-file",
        type=Path,
        required=True,
        help="JSON file generated by import_all_bases.py",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("base_id_replace_mapping.json"),
        help="Checkpoint and result file (default: ./base_id_replace_mapping.json)",
    )

    parser.add_argument(
        "--admin-user",
        required=True,
        help="seadb admin user",
    )
    parser.add_argument(
        "--admin-password",
        required=True,
        help="seadb admin password",
    )
    args = parser.parse_args()

    try:
        imported_mapping = load_mapping(args.mapping_file)
        if not imported_mapping:
            raise RuntimeError("The input mapping is empty.")

        state = prepare_state(imported_mapping, load_state(args.output))
        write_state(state, args.output)
        seadb_api = SeaDBAPI(args.admin_user, args.admin_password)

        failed_base_ids = release_original_ids(seadb_api, state, args.output)
        failed_base_ids.extend(
            restore_original_ids(seadb_api, state, args.output)
        )
    except Exception as exc:
        logger.error("Base ID replacement failed: %s", exc, exc_info=True)
        try:
            if "state" in locals():
                write_state(state, args.output)
        except OSError:
            logger.exception("Failed to save replacement state to %s.", args.output)
        return 1

    if failed_base_ids:
        logger.error(
            "%d Base(s) failed and can be retried on the next run: %s",
            len(failed_base_ids),
            ", ".join(failed_base_ids),
        )
        return 1

    logger.info(
        "Successfully restored %d Base ID(s); mapping saved to %s.",
        len(state),
        args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
