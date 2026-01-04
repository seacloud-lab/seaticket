#!/bin/bash

set -e
set -x

if test "$GITHUB_EVENT_NAME" = "pull_request"; then
    branch=$GITHUB_HEAD_REF
else
    branch=${GITHUB_REF##*/}
fi
export GITHUB_BRANCH=$branch
echo 'GITHUB_BRANCH'
echo $GITHUB_BRANCH

echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" >~/.npmrc

cd $GITHUB_WORKSPACE
python -m pip install --upgrade pip
pip install -r requirements.txt

tests/dist_and_push.sh
