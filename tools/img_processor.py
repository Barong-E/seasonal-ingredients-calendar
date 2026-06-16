import os
import collections
from PIL import Image

def process_icon():
    src_path = "/Users/barong/.gemini/antigravity-ide/brain/17e2be66-f727-4adc-b35a-a98cade1ffa7/media__1781619411410.png"
    dest_dir = "/Users/barong/MyProjects/Seasonal Ingredients Calendar/android/app/src/main/res/drawable-nodpi"
    dest_path = os.path.join(dest_dir, "ic_launcher_foreground_custom.png")

    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)

    print("이미지 처리 시작...")
    img = Image.open(src_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()

    # 1. 플러드 필로 외곽 및 카드 배경 제거 (누끼 따기)
    visited = [[False] * height for _ in range(width)]
    queue = collections.deque()

    # 모서리 4점을 시작점으로 큐에 삽입
    for x in (0, width - 1):
        for y in (0, height - 1):
            queue.append((x, y))
            visited[x][y] = True

    # 흰색/회색 계열 배경을 탐지하기 위한 임계값
    # 카드 그림자 테두리를 뚫고 넘어가 내부 흰색 영역까지 전부 투명으로 지우기 위해 임계값을 80으로 충분히 크게 설정
    threshold = 80
    bg_color = pixels[0, 0]

    def color_dist(c1, c2):
        return ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2)**0.5

    while queue:
        x, y = queue.popleft()
        # 배경 판정된 곳은 투명화 (RGBA = 0, 0, 0, 0)
        pixels[x, y] = (0, 0, 0, 0)

        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height and not visited[nx][ny]:
                curr_color = pixels[nx, ny]
                # 회색 그림자 테두리 및 흰색 카드 배경 탐색 조건
                # 노란 종, 빨간 앵두, 초록 줄기는 색상이 뚜렷하여 배경색과 거리가 100 이상이므로 안전함
                is_bg = (curr_color[0] > 210 and curr_color[1] > 210 and curr_color[2] > 210) or (color_dist(curr_color, bg_color) < threshold)
                if is_bg:
                    visited[nx][ny] = True
                    queue.append((nx, ny))

    # 2. 투명하지 않은 실제 종+앵두 영역(Bounding Box) 계산
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    has_pixels = False

    for x in range(width):
        for y in range(height):
            if pixels[x, y][3] > 0: # 알파 채널이 0보다 큰 경우 (실제 오브젝트)
                has_pixels = True
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y

    if not has_pixels:
        print("오류: 오브젝트를 찾지 못했습니다.")
        return

    # 종 오브젝트 크롭
    cropped_bell = img.crop((min_x, min_y, max_x + 1, max_y + 1))
    bell_w, bell_h = cropped_bell.size
    print(f"오브젝트 검출 크기: {bell_w}x{bell_h}")

    # 3. 512x512 고해상도 투명 캔버스 생성 및 종을 정중앙 정렬
    target_size = 512
    canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))

    # 종이 안전 영역(중앙 66%, 즉 340픽셀 너비/높이) 내에 딱 들어가도록 비율 조정
    max_bound = 330
    scale = min(max_bound / bell_w, max_bound / bell_h)
    
    new_w = int(bell_w * scale)
    new_h = int(bell_h * scale)
    resized_bell = cropped_bell.resize((new_w, new_h), Image.Resampling.LANCZOS)
    print(f"안전 영역 리사이즈 크기: {new_w}x{new_h}")

    # 캔버스 중앙에 페이스트
    offset_x = (target_size - new_w) // 2
    offset_y = (target_size - new_h) // 2
    canvas.paste(resized_bell, (offset_x, offset_y), resized_bell)

    # 4. 저장
    canvas.save(dest_path, "PNG")
    print(f"가공 완료: {dest_path}")

if __name__ == "__main__":
    process_icon()
