#!/bin/bash
: ${PYTHON=python3}

set -e
set -x

TESTSDIR=$(python -c "import os; print(os.path.dirname(os.path.realpath('$0')))")
SRCDIR=$(dirname "${TESTSDIR}")

cd "$SRCDIR"

function commit_dist_files() {
    git checkout -b dist-$GITHUB_BRANCH
    git add -u .
    git add -A frontend/build
    git add -A frontend/webpack-stats.pro.json
    git add -A media/assets
    git add -A static/scripts
    git add -A locale
    git add -A seahub/trusted_ip/locale
    git config --global user.email "github_actions@seafile.com"
    git config --global user.name "GitHub Actions CI"
    git commit -m "[dist][CI SKIP] GitHub Actions CI build: #$GITHUB_RUN_NUMBER, based on commit $GITHUB_SHA."
}

function upload_files() {
    git remote add token-origin https://x-access-token:$GITHUB_TOKEN@github.com/seafileltd/seaqa-web.git
    git push -f token-origin dist-$GITHUB_BRANCH
}

function build_frontend() {
    echo "Building frontend/src files ..."
    cd ./frontend
    npm install
    CI=false npm run build
    cd ..
}

build_frontend
make dist
commit_dist_files
upload_files
