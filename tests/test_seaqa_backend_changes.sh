#!/bin/bash

test_fn()
{
    FN=$1
    shift;
    echo "Testing $FN..."

    patt="frontend*"
    [[ $FN == $patt ]] && return 0

    patt="media*"
    [[ $FN == $patt ]] && return 0

    patt="static*"
    [[ $FN == $patt ]] && return 0

    patt="locale*"
    [[ $FN == $patt ]] && return 0

    return 1
}

if test -z "$GITHUB_BASE_REF"; then
    echo "GITHUB_BASE_REF is empty, run backend tests by default."
    exit 0
fi

git fetch origin $GITHUB_BASE_REF
FILES=`git diff --name-only origin/$GITHUB_BASE_REF`

echo "$FILES"

for i in $FILES
do
    test_fn $i
    retval=$?

    if [ "$retval" == 1 ]; then
        echo "File changes need to trigger backend tests."
        exit 0
    fi

done

echo "Static/media/frontend/locale only changes should not trigger backend tests."
exit 1
