#!/bin/bash

is_skipped_path()
{
    local file_path="$1"

    case "$file_path" in
        frontend/*|media/*|static/*|locale/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

if [ -z "${GITHUB_BASE_REF:-}" ]; then
    echo "GITHUB_BASE_REF is empty, run backend tests by default."
    exit 0
fi

git fetch origin "$GITHUB_BASE_REF"
FILES="$(git diff --name-only "origin/$GITHUB_BASE_REF")"

echo "$FILES"

while IFS= read -r file_path
do
    [ -z "$file_path" ] && continue
    echo "Testing $file_path..."

    if ! is_skipped_path "$file_path"; then
        echo "Backend tests triggered by changed file: $file_path"
        exit 0
    fi
done <<EOF
$FILES
EOF

echo "Static/media/frontend/locale only changes should not trigger backend tests."
exit 1
