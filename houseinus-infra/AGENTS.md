# AGENTS.md

`houseinus` 프로젝트는, 현재 단일 베어메탈 Ubuntu 서버에서 Serve되고 있으며, 이 Repository는 해당 서버에서 그냥 `git pull`을 통해 업데이트 됩니다. 따라서 서버 내 로컬 절대 경로를 다수 사용하고 있습니다.

# Prod/Dev 서버 내 구성 현황

`/home/yeibeen/serve/houseinus-infra` 경로에 houseinus-infra Repository가 위치하고 있습니다.

예: 이 파일의 위치는 `/home/yeibeen/serve/houseinus-infra/AGENTS.md` 입니다.

## Prod

`/home/yeibeen/serve/prod-apps` 경로에 프로덕션용 Repository Clone들이 위치하고 있습니다.

예: `/home/yeibeen/serve/prod-apps/houseinus-web`

## Dev

`/home/yeibeen/serve/dev-apps` 경로에 개발용 Repository Clone들이 위치하고 있습니다.

예: `/home/yeibeen/serve/dev-apps/houseinus-web`
