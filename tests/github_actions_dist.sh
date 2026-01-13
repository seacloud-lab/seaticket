#!/bin/bash

set -e
set -x

# get branch name
if test $GITHUB_EVENT_NAME = "pull_request"; then
    branch=$GITHUB_HEAD_REF
else
    branch=${GITHUB_REF##*/}
fi
export GITHUB_BRANCH=$branch
echo 'GITHUB_BRANCH'
echo $GITHUB_BRANCH

# write conf
mkdir -p /tmp/conf
export CONF_PATH=/tmp/conf
export SEAQA_CONFIG_NAME=seaqa_config.yaml

cat >/tmp/conf/seaqa_config.yaml <<EOF
global:
  SEADB_INNER_SERVER_URL: http://172.19.0.2:8888
  SEAQA_AI_INNER_SERVER_URL: http://127.0.0.1:8887
  SEAQA_INDEXER_INNER_SERVER_URL: http://127.0.0.1:8888

seaqa-web:
  SEAQA_EVENTS_INNER_SERVER_URL: http://127.0.0.1:6001

EOF

echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" >~/.npmrc

cd $GITHUB_WORKSPACE
python -m pip install --upgrade pip
pip install -r requirements.txt

tests/dist_and_push.sh
