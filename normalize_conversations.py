import os
import json

def main():
    brain_dir = os.path.expanduser("~/.gemini/antigravity-ide/brain")
    
    if not os.path.exists(brain_dir):
        print(f"❌ 에러: 브레인 디렉토리가 없습니다: {brain_dir}")
        return

    print("==================================================")
    print(" 대화방 로그 단계 번호(step_index) 정렬을 시작합니다.")
    print("==================================================")
    
    count = 0
    for folder in os.listdir(brain_dir):
        folder_path = os.path.join(brain_dir, folder)
        if os.path.isdir(folder_path):
            transcript_path = os.path.join(folder_path, ".system_generated", "logs", "transcript.jsonl")
            
            if os.path.exists(transcript_path):
                try:
                    # 파일 읽기
                    with open(transcript_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    
                    # 순차적으로 인덱스 재부여
                    new_lines = []
                    current_idx = 0
                    for line in lines:
                        line_str = line.strip()
                        if not line_str:
                            continue
                        
                        data = json.loads(line_str)
                        data['step_index'] = current_idx
                        new_lines.append(json.dumps(data, ensure_ascii=False))
                        current_idx += 1
                    
                    # 변경 사항을 파일에 다시 덮어쓰기
                    with open(transcript_path, 'w', encoding='utf-8') as f:
                        f.write('\n'.join(new_lines) + '\n')
                    
                    print(f"✅ 정렬 완료: {folder} ({current_idx}개 단계)")
                    count += 1
                except Exception as e:
                    print(f"❌ 오류 발생 ({folder}): {e}")

    print("==================================================")
    print(f"🎉 모든 대화방 정렬 완료! 총 {count}개 대화방이 정렬되었습니다.")
    print("==================================================")

if __name__ == '__main__':
    main()
