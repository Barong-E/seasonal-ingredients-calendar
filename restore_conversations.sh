#!/bin/bash

# Antigravity IDE 이전 대화 기록 복구 스크립트
# 이 스크립트는 overview.txt 파일을 transcript.jsonl 파일로 복사하여 예전 대화 기록을 복구합니다.

TARGET_DIR="$HOME/.gemini/antigravity-ide/brain"

echo "=================================================="
echo " Antigravity IDE 2.0 대화 기록 복구를 시작합니다."
echo " 대상 폴더: $TARGET_DIR"
echo "=================================================="

if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ 에러: Antigravity IDE 데이터 폴더를 찾을 수 없습니다."
    echo "경로를 확인해 주세요: $TARGET_DIR"
    exit 1
fi

count=0
success_count=0

# brain 폴더 안의 모든 하위 폴더들을 찾습니다.
for dir in "$TARGET_DIR"/*; do
    if [ -d "$dir" ]; then
        # logs 폴더 경로 정의
        LOGS_DIR="$dir/.system_generated/logs"
        OVERVIEW_FILE="$LOGS_DIR/overview.txt"
        TRANSCRIPT_FILE="$LOGS_DIR/transcript.jsonl"
        
        # overview.txt 파일이 존재하는지 확인
        if [ -f "$OVERVIEW_FILE" ]; then
            count=$((count+1))
            dir_name=$(basename "$dir")
            
            # transcript.jsonl 파일이 이미 존재하는지 확인
            if [ ! -f "$TRANSCRIPT_FILE" ]; then
                echo "⏳ 대화방 [$dir_name] 복구 중..."
                cp "$OVERVIEW_FILE" "$TRANSCRIPT_FILE"
                if [ $? -eq 0 ]; then
                    echo "✅ 대화방 [$dir_name] 복구 완료!"
                    success_count=$((success_count+1))
                else
                    echo "❌ 대화방 [$dir_name] 복구 실패 (파일 복사 오류)"
                fi
            else
                echo "ℹ️ 대화방 [$dir_name]은 이미 transcript.jsonl 파일이 존재합니다. 건너뜁니다."
            fi
        fi
    fi
done

echo "=================================================="
echo " 대화 기록 복구 작업이 끝났습니다!"
echo " - 발견된 예전 대화방 수: $count개"
echo " - 새로 복구 완료된 대화방 수: $success_count개"
echo "=================================================="
echo "💡 이제 Antigravity IDE를 다시 시작하시면 예전 대화 기록을 보실 수 있습니다."
