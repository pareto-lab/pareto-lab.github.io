# Release Script Guide

## 개요

이 프로젝트의 자동 배포 스크립트는 [release.js](release.js:1) 입니다.

- 프로덕션 배포: `node release.js`
- 개발 배포: `node release.js --dev`

`--dev` 옵션이 없으면 `release` 브랜치를 대상으로 동작하고, `--dev` 옵션이 있으면 `dev-release` 브랜치를 대상으로 동작합니다.

헬스체크 URL은 `release.js`의 `BASE_URL` 상수로 관리합니다.

- 프로덕션: `http://127.0.0.1:30080`
- 개발: `http://127.0.0.1:31080`

## 스크립트가 하는 일

스크립트는 아래 순서로 동작합니다.

1. `.release.lock` 파일로 이미 배포 중인지 확인하고, 배포 중이면 이번 실행은 건너뜁니다.
2. 대상 브랜치가 로컬에 없으면 만들고, `origin/<branch>` 를 tracking 하도록 맞춥니다.
3. `git fetch origin <branch>` 로 원격 변경사항을 가져옵니다.
4. 새 커밋이 있을 때만 `git pull --ff-only` 를 수행합니다.
5. `npm install` 후 `npm run build -- --outDir pre-dist` 로 `pre-dist` 에 먼저 빌드합니다.
6. 빌드가 성공하면 기존 `dist` 를 백업한 뒤 `pre-dist` 를 `dist` 로 교체합니다.
7. `BASE_URL` 로 헬스체크를 수행합니다.
8. 실패하면 이전 `dist` 와 이전 git revision 으로 rollback 을 시도합니다.
9. 로그는 프로젝트 루트에 저장되며, 파일이 10MB에 도달하면 자동으로 rotate 됩니다.

## 실행 예시

### 프로덕션

```bash
cd <PROJECT_ROOT>
node release.js
```

### 개발

```bash
cd <PROJECT_ROOT>
node release.js --dev
```

## Cron 등록

크론은 2분마다 한 번씩 실행하도록 아래처럼 등록하면 됩니다.

먼저 서버에서 `node` 경로를 확인합니다.

```bash
command -v node
```

현재 확인된 값은 `/usr/bin/node` 였지만, 서버마다 다를 수 있으니 실제 서버에서 다시 확인하는 것을 권장합니다.

로그는 서버 공용 `/var/log` 대신 프로젝트 디렉터리 안에 남기도록 사용합니다.

- 프로덕션 로그 파일: `houseinus-release.log`
- 개발 로그 파일: `houseinus-release-dev.log`
- 각 로그 파일은 10MB 기준으로 rotate 되며, `*.log.1` 부터 `*.log.5` 까지 백업을 유지합니다.
- 이 로테이션은 `release.js`가 직접 처리하므로, crontab 에서는 `>>` 리다이렉션을 붙이지 않는 것을 권장합니다.

### 프로덕션 서버 crontab

```cron
*/3 * * * * cd <PROJECT_ROOT> && /usr/bin/node release.js
```

### 개발 서버 crontab

```cron
*/3 * * * * cd <PROJECT_ROOT> && /usr/bin/node release.js --dev
```

예를 들어 프로젝트 경로가 `/srv/houseinus-web` 라면 다음처럼 넣으면 됩니다.

### 프로덕션 서버 예시

```cron
*/3 * * * * cd /home/yeibeen/serve/houseinus-web && /usr/bin/node release.js
```

### 개발 서버 예시

```cron
*/3 * * * * cd /home/yeibeen/serve/houseinus-web-dev && /usr/bin/node release.js --dev
```

## crontab 편집 방법

```bash
crontab -e
```

저장 후 아래 명령으로 등록 결과를 확인할 수 있습니다.

```bash
crontab -l
```

## 주의사항

- 이 스크립트는 작업 트리가 dirty 상태이면 자동 배포를 중단합니다.
- `BASE_URL` 이 실제 서비스 헬스체크 주소와 다르면 `release.js`를 수정해야 합니다.
- 로그를 shell redirection 으로 다른 파일에 보내면, `release.js`의 내장 rotate 정책은 그 리다이렉션 파일에는 적용되지 않습니다.
- 개발서버와 프로덕션서버는 서로 다른 서버 또는 서로 다른 배포 디렉터리에서 돌리는 것을 권장합니다.
- 같은 디렉터리에서 개발용과 프로덕션용 크론을 동시에 돌리면 `dist` 와 `.release.lock` 를 공유하므로 충돌할 수 있습니다.
