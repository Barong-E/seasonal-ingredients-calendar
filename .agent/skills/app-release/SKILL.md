---
name: app-release
description: Triggers when releasing, building, or updating the Android app for Google Play Console.
---

# 플레이 콘솔 배포 빌드 규칙 (App Release & Build Guide)

이 스킬은 사용자가 앱 업데이트, AAB 배포용 빌드, 플레이 콘솔 출시 준비 등을 요청할 때만 활성화되어 에이전트의 뇌(Context)에 로드됩니다.

- **배포 안내 필수 요소**: 플레이 콘솔 업로드용 배포 빌드(AAB 빌드) 요청을 완료했을 때는, 사용자에게 결과 보고(또는 walkthrough.md) 시 다음 세 가지 사항을 반드시 포함하여 알려주어야 한다:
  1) **배포 파일의 정확한 파일 경로(file:// 링크 포함)와 용량 크기**
  2) **구글 플레이 콘솔에 입력할 출시명(Release Name) 및 XML 형식의 출시 노트(Release Notes)**
  3) **어떻게 앱 업데이트를 진행하는지 상세한 단계별 업로드 가이드**
