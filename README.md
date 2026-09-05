# KLM4416 Blog

GitHub Pages와 Jekyll로 만든 개인 기술 블로그입니다. `main` 브랜치에 푸시하면 GitHub Actions가 사이트를 빌드해 `https://klm4416.github.io`에 배포합니다.

## 처음 한 번만 설정하기

1. GitHub 저장소에서 **Settings → Pages**로 이동합니다.
2. **Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
3. 이 변경을 `main` 브랜치에 푸시합니다.
4. 저장소의 **Actions** 탭에서 `Deploy Jekyll site to Pages` 작업이 완료되면 사이트를 확인합니다.

첫 배포는 반영까지 몇 분 정도 걸릴 수 있습니다.

## 로컬에서 실행하기

GitHub Pages 호환성을 위해 Ruby 3.1을 권장합니다. 저장소의 `.ruby-version`도 3.1 계열로 맞춰 두었습니다.

```bash
gem install bundler
bundle config set --local path "vendor/bundle"
bundle install
bundle exec jekyll serve --livereload
```

브라우저에서 `http://localhost:4000`을 엽니다. 배포용 빌드만 확인하려면 다음 명령을 사용합니다.

```bash
JEKYLL_ENV=production bundle exec jekyll build
```

## 새 글 작성하기

`_posts` 폴더에 `YYYY-MM-DD-영문-슬러그.md` 파일을 추가합니다.

```markdown
---
title: 글 제목
description: 검색 결과와 공유 카드에 표시할 짧은 설명
date: 2026-09-01 12:00:00 +0900
section: Technology
kicker: 제목 위에 표시할 짧은 문구
image: /assets/images/example.svg
image_alt: 이미지 대체 텍스트
image_caption: 이미지 설명과 출처
categories: [개발]
tags: [jekyll, github-pages]
---

글 내용을 Markdown으로 작성합니다.
```

파일명과 `date`의 날짜가 미래면 해당 시점까지 글이 노출되지 않을 수 있습니다.

## 자주 수정하는 곳

| 목적 | 파일 |
| --- | --- |
| 블로그 이름, 설명, GitHub 계정 | `_config.yml` |
| 홈의 기사 그리드와 섹션 | `_layouts/home.html` |
| 자기소개 | `about.md` |
| 기사형 레이아웃과 전체 디자인 | `assets/css/style.scss` |
| 첫 예시 글 | `_posts/2026-09-01-welcome.md` |

`_config.yml`을 수정한 뒤에는 로컬 서버를 다시 시작해야 변경 사항이 반영됩니다.
