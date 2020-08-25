#!/bin/bash
GIT_PATH=/home/stt/prod/bot
SITE_PATH=/home/stt/prod/website
DATA_PATH=/home/stt/prod/data

pushd $GIT_PATH

git pull 2>&1
if [ $? -ne 0 ]
then
    echo "Failed during git pull"
    exit 1
fi

# TODO: versioning?
docker build --tag stt-datacore/bot:latest .
if [ $? -ne 0 ]
then
    echo "Failed during Docker build"
    exit 3
fi

popd

# TODO: remove old image and restart; is there a best practices for this?
docker stop DCBot
docker rm DCBot

docker run -d --name=DCBot \
    --restart unless-stopped \
    --net=host \
    --mount type=bind,source="$DATA_PATH",target=/data \
    --mount type=bind,source="$SITE_PATH",target=/sitedata \
    --env PROFILE_DATA_PATH=/data/profiles \
    --env DB_CONNECTION_STRING=sqlite:/data/datacore.db \
    --env DC_DATA_PATH=/sitedata/static/structured \
    --env CONFIG_PATH=/data/bot_config.json \
    --env LOG_PATH=/data/logs/ \
    --env-file "$DATA_PATH/env.list" \
    stt-datacore/bot:latest
