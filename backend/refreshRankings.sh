#!/bin/bash

cd /home/leog0495/Desktop/BroncoSort/backend || exit 1

echo "===== Starting ranking refresh: $(date) ====="

echo "Rebuilding rankings..."
node getProfessorRankings.js
if [ $? -ne 0 ]; then
  echo "getProfessorRankings.js failed"
  exit 1
fi

echo "===== Ranking refresh complete: $(date) ====="
