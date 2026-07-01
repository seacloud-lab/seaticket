#!/bin/bash

is_skipped_path()
{
    local file_path="$1"

    case "$file_path" in
        frontend/*)
            return 1
            ;;
        *)
            return 0
            ;;
    esac
}

if [ -z "${GITHUB_BASE_REF:-}" ]; then
    echo "GITHUB_BASE_REF is empty, run frontend tests by default."
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
        echo "Frontend tests triggered by changed file: $file_path"
        exit 0
    fi
done <<EOF
$FILES
EOF

echo "Backend/static/media/locale only changes should not trigger frontend tests."
exit 1
