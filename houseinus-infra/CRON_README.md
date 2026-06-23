# houseinus 자동 배포 cron 설정

`master` → `release` / `dev-release` 브랜치로 push되면 서버가 자동으로 당겨서 배포하도록 cron을 등록한다. **따라만 하면 되게** 써놓았다.

## 0. 개요

### 등록할 job

총 **4개** — (prod|dev) × (web|api).

| env  | 프로젝트 | 경로 (AGENTS.md 기준) | 실행 명령 | 감시 브랜치 |
| --- | --- | --- | --- | --- |
| prod | web | `/home/yeibeen/serve/prod-apps/houseinus-web` | `node release.js` | `release` |
| prod | api | `/home/yeibeen/serve/prod-apps/houseinus-api` | `python3 release.py` | `release` |
| dev  | web | `/home/yeibeen/serve/dev-apps/houseinus-web`  | `node release.js --dev` | `dev-release` |
| dev  | api | `/home/yeibeen/serve/dev-apps/houseinus-api`  | `python3 release.py --dev` | `dev-release` |

> **경로가 다를 경우**: AGENTS.md 기준 경로를 썼다. 실제 clone 경로와 다르면 crontab 줄만 수정.

### 실행 주체

**yeibeen 사용자**로 실행한다 (root 아님).

- houseinus-api 는 **user-level systemd** (`systemctl --user`)로 동작하므로 sudo 불필요.
- repo 소유자(yeibeen)가 cron을 돌리므로 git safe.directory 예외도 필요 없음.
- root 권한이 필요한 단계는 **최초 1회 linger 활성화**뿐.

### 폴링 주기

**3분**. cron의 최소 단위.

release 스크립트는 락 파일로 동시 실행을 방지하고, 새 커밋이 없으면 즉시 종료하므로 부담 없음.

---

## 1. 사전 준비 (한 번만)

### 1-1. 로그인 lingering 활성화 (★ 유일하게 root 필요한 단계)

cron이 yeibeen으로 돌 때 `systemctl --user`를 호출하려면 user 세션이 부팅 시부터 상주해야 한다. `loginctl enable-linger`로 활성화:

```sh
sudo loginctl enable-linger yeibeen
```

확인:

```sh
loginctl show-user yeibeen | grep Linger
# Linger=yes
```

이후로는 로그아웃해도 `/run/user/$(id -u)` 가 유지되고 user systemd가 계속 실행된다.

### 1-2. 필수 커맨드 PATH 확인

cron이 주는 PATH는 최소(`/usr/bin:/bin` 수준). yeibeen 세션에 필요한 커맨드가 어디 있는지 확인:

```sh
which git node npm python3 uv
# 예:
#   /usr/bin/git
#   /usr/bin/node
#   /usr/bin/npm
#   /usr/bin/python3
#   /home/yeibeen/.local/bin/uv
```

위에서 나오는 경로(특히 `~/.local/bin`)는 **§2-2의 crontab PATH 라인에 포함**돼야 한다.

> `node`가 nvm 등으로 `~/.nvm/...`에 있다면 해당 경로도 PATH에 추가. 시스템 node로 바꿀 거면 `sudo apt install nodejs npm`.

### 1-3. 애플리케이션 사전 구성

cron 첫 실행 전에 각 repo가 한 번이라도 정상 빌드/실행 가능한 상태여야 한다:

```sh
# web
cd /home/yeibeen/serve/prod-apps/houseinus-web && npm install && npm run build
cd /home/yeibeen/serve/dev-apps/houseinus-web  && npm install && npm run build

# api
cd /home/yeibeen/serve/prod-apps/houseinus-api && uv sync && uv run alembic upgrade head
cd /home/yeibeen/serve/dev-apps/houseinus-api  && uv sync && uv run alembic upgrade head
```

api는 `config.json`도 미리 만들어둬야 한다 (`config.example.json` 복사 후 DB/Redis/OAuth 값 채우기).

### 1-4. user systemd 서비스 등록 (api 두 개)

```sh
# prod api → 서비스명: houseinus-api, 포트 38080
cd /home/yeibeen/serve/prod-apps/houseinus-api
python3 install_service.py

# dev api → 서비스명: houseinus-api-dev, 포트 39080
cd /home/yeibeen/serve/dev-apps/houseinus-api
python3 install_service.py --dev
```

`--dev` 를 주면 서비스명과 포트(`39080`)가 자동으로 dev용으로 세팅된다. 명시적으로 바꾸고 싶으면 `--name foo --port 12345` 로 오버라이드 가능.

설치 후 수동 기동:

```sh
systemctl --user start houseinus-api
systemctl --user start houseinus-api-dev

systemctl --user status houseinus-api
systemctl --user status houseinus-api-dev
```

둘 다 `active (running)` 이어야 이후 cron 배포가 정상 흐른다. 바인딩 포트 확인:

```sh
ss -tlnp | grep -E '38080|39080'
# 38080, 39080 각각 떠 있어야 정상.
```

> **주의**: 이전 버전의 `install_service.py` (포트 고정)를 썼다면 dev 도 38080 으로 떠서 prod 와 충돌한다. 서버에서 `git pull` 후 위 절차로 **재설치** 필요:
> ```sh
> systemctl --user stop houseinus-api-dev
> cd /home/yeibeen/serve/dev-apps/houseinus-api
> git pull
> python3 install_service.py --dev
> systemctl --user start houseinus-api-dev
> ```

### 1-5. cron 로그 디렉터리

release 스크립트는 각 repo 안에 자체 로그를 쌓지만, cron stdout/stderr 도 별도로 받아두면 디버깅이 편하다. yeibeen 홈 아래 두면 sudo 없이 관리 가능:

```sh
mkdir -p ~/log/houseinus
```

---

## 2. crontab 등록

### 2-1. yeibeen crontab 열기

```sh
crontab -e
```

(sudo 없음. 처음이면 에디터 선택지 뜸. nano 무난.)

### 2-2. 아래 내용 **통째로 붙여넣기**

```crontab
SHELL=/bin/bash
PATH=/home/yeibeen/.local/bin:/usr/bin:/bin
MAILTO=""

# ------------------------------------------------------------------
# houseinus 자동 배포 (3분 간격, yeibeen 사용자)
# ------------------------------------------------------------------

# prod web  (release branch → nginx dist swap)
*/3 * * * * cd /home/yeibeen/serve/prod-apps/houseinus-web && node release.js >> /home/yeibeen/log/houseinus/web-prod-cron.log 2>&1

# prod api  (release branch → user service: houseinus-api)
*/3 * * * * cd /home/yeibeen/serve/prod-apps/houseinus-api && python3 release.py >> /home/yeibeen/log/houseinus/api-prod-cron.log 2>&1

# dev web   (dev-release branch → nginx dist swap)
*/3 * * * * cd /home/yeibeen/serve/dev-apps/houseinus-web && node release.js --dev >> /home/yeibeen/log/houseinus/web-dev-cron.log 2>&1

# dev api   (dev-release branch → user service: houseinus-api-dev)
*/3 * * * * cd /home/yeibeen/serve/dev-apps/houseinus-api && python3 release.py --dev >> /home/yeibeen/log/houseinus/api-dev-cron.log 2>&1
```

- `PATH` 라인에 **`/home/yeibeen/.local/bin` 가 포함**돼야 uv가 잡힌다. §1-2 결과가 다르면 맞춰 수정.
- `MAILTO=""` — cron mail 억제.
- `>> ... 2>&1` — cron이 뱉는 stdout/stderr 도 파일로 저장. release 스크립트 자체 로그는 여기와 별개로 repo 안에 쌓인다.
- release.py는 내부적으로 `XDG_RUNTIME_DIR=/run/user/<uid>` 을 자동 설정하므로 crontab에 별도 설정 불필요.

저장 후 종료.

### 2-3. 등록 확인

```sh
crontab -l
```

붙여넣은 내용이 출력되면 완료. cron 데몬이 즉시 인지하고, 다음 `*/3` 분에 실행.

---

## 3. 동작 확인

### 3-1. 3분 기다린 뒤 로그 확인

```sh
# cron 자체가 job을 실행했는지 (Ubuntu 기반)
journalctl -u cron --since "5 minutes ago" --user-unit=cron 2>/dev/null || \
  sudo journalctl -u cron --since "5 minutes ago"

# release 스크립트 자체 로그 (이게 핵심)
tail -f /home/yeibeen/serve/prod-apps/houseinus-api/houseinus-release.log
tail -f /home/yeibeen/serve/dev-apps/houseinus-api/houseinus-release-dev.log
tail -f /home/yeibeen/serve/prod-apps/houseinus-web/houseinus-release.log
tail -f /home/yeibeen/serve/dev-apps/houseinus-web/houseinus-release-dev.log

# cron stdout/stderr (스크립트가 터졌을 때 흔적이 여기로)
tail -f ~/log/houseinus/api-prod-cron.log
tail -f ~/log/houseinus/web-prod-cron.log
```

첫 실행 시 `"no new commits … skipping deploy"` 가 찍히면 정상.

### 3-2. 실제 배포 테스트

로컬에서:

```sh
cd houseinus-web
# master 에 뭐 하나 커밋해서 push 한 뒤 release 브랜치 갱신
npm run publish:dev    # 또는 release 에 직접 merge
```

3분 이내:
- 텔레그램 알림 수신 (Jeongmin, Yeibeen)
- `<repo>/houseinus-release*.log` 에 `"release deploy completed successfully"` 라인
- prod api: `curl http://127.0.0.1:38080/api/v1/health` → `{"status":"ok", ...}`
- dev api:  `curl http://127.0.0.1:39080/api/v1/health`

---

## 4. 운영 커맨드 빠른참조

전부 sudo 없이 돌아간다.

```sh
# 현재 등록된 crontab
crontab -l

# 특정 환경 배포 일시 중단 (해당 줄 앞에 # 붙이고 저장)
crontab -e

# 서비스 상태
systemctl --user status houseinus-api
systemctl --user status houseinus-api-dev

# 서비스 로그 실시간
journalctl --user -u houseinus-api -f
journalctl --user -u houseinus-api-dev -f

# 수동 배포 강제 실행 (cron 기다리기 싫을 때)
cd /home/yeibeen/serve/prod-apps/houseinus-api && python3 release.py

# 수동 재시작
systemctl --user restart houseinus-api
```

---

## 5. 문제 해결

### 5-1. 3분이 지났는데 아무 것도 안 됨

```sh
# cron 자체가 돌았는지
sudo journalctl -u cron --since "10 minutes ago"   # cron 데몬은 system, 이것만 sudo

# release 스크립트가 실행되긴 했는지 (repo 안 로그)
ls -la /home/yeibeen/serve/prod-apps/houseinus-api/houseinus-release.log

# cron stdout/stderr
cat ~/log/houseinus/api-prod-cron.log
```

로그 자체가 안 쌓이면 **crontab 경로 또는 PATH 문제**다.

### 5-2. `uv: command not found`

→ cron의 `PATH`에 uv 설치 경로 없음.
확인: `which uv`. 결과 경로를 §2-2의 `PATH` 라인에 추가.

### 5-3. `Failed to connect to bus: No such file or directory` 또는 `Failed to get D-Bus connection`

→ `systemctl --user` 가 세션을 못 찾음. 원인:
- **linger가 활성화 안 됨** → §1-1 다시
- `/run/user/<uid>` 디렉터리가 없음 → linger 활성화 후 재부팅 또는 `sudo systemctl start user@<uid>.service`

### 5-4. `another deploy is already running (pid: ...)` 가 계속 뜸

실제 pid가 살아있으면 이전 배포가 멈춰있음. `ps -p <pid>` 확인 후 필요하면 kill.

```sh
# 프로세스가 이미 죽었는데 락만 남은 경우
rm /home/yeibeen/serve/prod-apps/houseinus-api/.release.lock
```

### 5-5. 배포 실패 텔레그램 알림이 왔을 때

1. 알림에 포함된 `error:`, `rollback:`, `alembic before/after:` 값 확인
2. `<repo>/houseinus-release.log` 에서 실패 직전 로그 확인
3. `rollback: completed` 면 서비스는 이전 버전으로 살아있음 — 원인 수정 후 새 커밋 push
4. `rollback: … DB migration NOT rolled back …` 면 DB 가 새 스키마에 있음. 마이그레이션을 되돌릴지 코드를 고쳐 앞으로 진행할지 수동 판단.

### 5-6. 특정 시간대 배포 차단

crontab 시간 spec 조정. 예: 야간(00-06시)만 허용:
```crontab
*/3 0-6 * * * cd ... && python3 release.py ...
```

---

## 6. 체크리스트 (한 번 쭉 훑기)

- [ ] `loginctl show-user yeibeen | grep Linger` → `Linger=yes`
- [ ] `which git node npm python3 uv` — 전부 경로 출력
- [ ] `systemctl --user status houseinus-api` — active
- [ ] `systemctl --user status houseinus-api-dev` — active
- [ ] 각 web/api repo 에 `config.json` / `.venv` / `dist` / `node_modules` 사전 구성됨
- [ ] `ls ~/log/houseinus` — 디렉터리 존재
- [ ] `crontab -l` — 4줄 전부 출력
- [ ] 3분 후 `houseinus-release*.log` 에 "no new commits" 찍힘
- [ ] 테스트 push 후 텔레그램 알림 수신
