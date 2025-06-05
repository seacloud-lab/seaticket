#!/bin/bash
: ${PYTHON=python3}

set -e
set -x
DTABLE_WEB_TESTSDIR=$(python -c "import os; print(os.path.dirname(os.path.realpath('$0')))")
DTABLE_WEB_SRCDIR=$(dirname "${DTABLE_WEB_TESTSDIR}")

export PYTHONPATH="/usr/local/lib/python3/site-packages:/usr/local/lib/python3/dist-packages:/usr/lib/python3/site-packages:${DTABLE_WEB_SRCDIR}/thirdpart:${PYTHONPATH}"
cd "$DTABLE_WEB_SRCDIR"
set +x

function commit_dist_files() {
    echo 'commit dtable-web'
    git checkout -b dist-$GITHUB_BRANCH
    git add -u . && git add -A media/assets && git add -A static/scripts && git add -A frontend && git add -A locale
    git config --global user.email "github_actions@seafile.com"
    git config --global user.name "GitHub Actions CI"
    git commit -m "[dist][CI SKIP] GitHub Actions CI build: #$GITHUB_BUILD_NUMBER, based on commit $GITHUB_SHA." -m "$GITHUB_COMMIT_MESSAGE"
}

function upload_files() {
    echo 'push dist to dtable-web'
    git remote add token-origin https://x-access-token:$GITHUB_TOKEN@github.com/seafileltd/dtable-web.git
    git push -f token-origin dist-$GITHUB_BRANCH
}

function make_dist() {
    echo "Making dist files ..."
    make dist
}

function build_frontend() {
    echo "Building frontend/src files ..."
    cd ./frontend && npm install && CI=false npm run build && cd ..
}

build_frontend
make_dist
commit_dist_files
upload_files
