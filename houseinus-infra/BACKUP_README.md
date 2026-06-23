# Backup

Houseinus 운영 데이터를 매일 Roo의 NFS 공유(`Services/houseinus`)에 모아두고, Synology 측에서 Hyper Backup으로 Google Drive에 올린다.

## 현재 운영 상태

| 단계 | 상태 | 적용일 |
| --- | --- | --- |
| [1] uploads rsync (`*/30 * * * *`) | 운영 중 | 2026-05-12 |
| [2] Postgres dump (`0 0 * * *`) | 운영 중 | 2026-05-12 |
| [3] Hyper Backup → Google Drive | 운영 중 (기존 Vaultwarden 잡에 `Services/houseinus` 추가) | 2026-05-12 |

매일 03:30에 `Services/houseinus/uploads` + `Services/houseinus/dumps` 두 폴더가 Vaultwarden과 동일 잡으로 Google Drive에 올라간다. Rotation은 `From earliest / 16 versions` 그대로 — 자세한 분석은 아래 "[3] Hyper Backup → Google Drive" 섹션 끝의 retention 메모 참고.

## 전체 흐름

```
Gopher                                Roo (Synology)            Google
─────────────────────                ────────────────────       ──────
[1] uploads/ ──30분 rsync─▶  /Services/houseinus/uploads/
                                              │
[2] PostgreSQL 18 ──00:00 pg_dump─▶ /Services/houseinus/dumps/
                                              │
                                              └─ 03:30 매일 ─ Hyper Backup ─▶ Google Drive
```

- `/mnt/services`는 Gopher에서 Roo의 `Services` 공유 폴더를 NFS로 마운트한 경로. Transmission이 이미 같은 공유를 쓰고 있어서 새 마운트를 추가하지 않는다.
- Gopher 측 운영 사용자는 `yeibeen`. 모든 cron은 `yeibeen`의 user crontab에 등록.

## [1] uploads rsync

houseinus-api의 사용자 업로드 파일을 30분마다 Roo로 미러링한다.

| 항목 | 값 |
| --- | --- |
| Source | `/home/yeibeen/serve/prod-apps/houseinus-api/uploads/` |
| Target | `/mnt/services/houseinus/uploads/` |
| 주기 | `*/30 * * * *` (매시 00, 30분) |
| 보존 | `--delete` 미사용 — 소스에서 지워져도 백업은 보존 |

### 사전 준비

```bash
mountpoint -q /mnt/services && echo "OK: mounted"
mkdir -p /mnt/services/houseinus/uploads ~/logs
```

### 초기 동기화 (cron 등록 전 한 번)

```bash
rsync -a --no-owner --no-group --no-perms --modify-window=1 --info=stats2 \
  /home/yeibeen/serve/prod-apps/houseinus-api/uploads/ \
  /mnt/services/houseinus/uploads/ \
  | tee -a ~/logs/rsync-houseinus-uploads.log
```

### Cron 등록

`yeibeen`으로 `crontab -e`:

```cron
*/30 * * * * /usr/bin/flock -n /tmp/rsync-houseinus-uploads.lock /usr/bin/rsync -a --no-owner --no-group --no-perms --modify-window=1 --info=stats2 /home/yeibeen/serve/prod-apps/houseinus-api/uploads/ /mnt/services/houseinus/uploads/ >> /home/yeibeen/logs/rsync-houseinus-uploads.log 2>&1
```

### 플래그 의미

| 플래그 | 이유 |
| --- | --- |
| `flock -n` | 이전 실행이 안 끝났으면 이번 회차 skip — 초기 대용량 sync 안전 |
| `-a` | archive 모드 (recursive + mtime 보존 + 심볼릭링크) |
| `--no-owner --no-group --no-perms` | Synology NFS의 squash 매핑이 거부하는 chown/chgrp/chmod 시도를 끔 |
| `--modify-window=1` | 로컬 ext4(ns) vs NFS(s) mtime 정밀도 차이로 같은 파일이 매번 변경으로 잡히는 문제 회피 |
| `--info=stats2` | 종료 시 짧은 요약만 출력 |

## [2] PostgreSQL dump

houseinus-api가 쓰는 Roo의 Container Manager Postgres 18.3을 매일 자정에 dump한다.

| 항목 | 값 |
| --- | --- |
| DB host | `192.168.0.200:15432` |
| 실행 위치 | Gopher, `yeibeen` user cron |
| 출력 형식 | Postgres custom format (`-Fc`, 압축 포함) |
| Target | `/mnt/services/houseinus/dumps/houseinus-YYYYMMDD-HHMMSS.dump` |
| 주기 | `0 0 * * *` (매일 00:00) |
| 로컬 보존 | 14일. 그 이전 dump는 스크립트가 매 회 삭제 |
| 원격 보존 | Hyper Backup의 버전 정책 |

### 사전 준비

Gopher에 서버와 같은 메이저의 `pg_dump`가 필요하다. Ubuntu에서 PGDG 저장소를 추가하고:

```bash
sudo apt install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list'
sudo apt update
sudo apt install -y postgresql-client-18

# 18 binary가 깔렸는지 직접 확인 (postgresql-common wrapper가 16을 고를 수 있으므로 경로로 검증)
/usr/lib/postgresql/18/bin/pg_dump --version   # 18.x 출력 확인
```

스크립트는 wrapper를 거치지 않고 18 binary를 명시적으로 호출한다(아래 `BIN` 변수).

DB 자격증명은 `~/.pgpass`로 보관(스크립트에 하드코드 금지).

```bash
cat > ~/.pgpass <<'EOF'
192.168.0.200:15432:houseinus:houseinus:<DB_PASSWORD>
EOF
chmod 600 ~/.pgpass
```

`<DB_PASSWORD>`는 houseinus-api `config.json`의 DB 섹션 값과 일치시킨다. 사용자명/DB명은 prod 기준 모두 `houseinus`.

### Dump 스크립트

스크립트는 이 저장소에 함께 들어 있다: [`scripts/pg-dump-houseinus.sh`](scripts/pg-dump-houseinus.sh). 서버에서는 `~/serve/houseinus-infra/scripts/pg-dump-houseinus.sh`로 노출되며, repo 갱신 시 `git pull`로 같이 받는다(`chmod +x`는 git이 보존).

스크립트 핵심:

- `BIN="/usr/lib/postgresql/18/bin/pg_dump"` — wrapper(`/usr/bin/pg_dump`)가 16을 고를 수 있어 18 binary 절대 경로 명시
- `-Fc` — Postgres custom format (압축 + `pg_restore`로 복구)
- `mountpoint -q /mnt/services` 가드 — NFS 끊긴 상태에서 빈 곳에 쓰지 않음
- 14일 이전 dump는 매 회 `find ... -delete`로 정리

### Cron 등록

`yeibeen`의 `crontab -e`에 추가:

```cron
0 0 * * * /usr/bin/flock -n /tmp/pg-dump-houseinus.lock /home/yeibeen/serve/houseinus-infra/scripts/pg-dump-houseinus.sh >> /home/yeibeen/logs/pg-dump-houseinus.log 2>&1
```

## [3] Hyper Backup → Google Drive

Vaultwarden 데이터를 매일 03:30에 Google Drive로 올리는 기존 Hyper Backup 잡이 이미 있다. 여기에 `Services/houseinus` 폴더를 source에 추가한다.

DSM UI:

1. Hyper Backup → 기존 Vaultwarden 잡 → **Settings**
2. **Source** 탭 → `Services/houseinus` 체크 (또는 하위 `uploads`, `dumps` 두 개를 개별 선택)
3. **Schedule** 03:30 — 변경 없음
4. **Destination** Google Drive — 변경 없음
5. 저장 → **즉시 한 번 백업 실행**해서 정상 동작 확인

> 별도 잡으로 분리하는 것도 가능하지만, retention/암호화 설정을 두 번 관리해야 한다. 같은 시간대에 두 잡이 Google Drive로 동시에 push하면 API 부하가 생길 수 있으니 5~10분 어긋나게 둘 것.

### Retention 메모

Vaultwarden 잡에 그대로 얹었으므로 rotation은 **From earliest / 16 versions**. 이 정책이 houseinus 데이터에 어떻게 작용하는지:

- **uploads** — rsync에 `--delete`를 안 걸어둬서 Roo `Services/houseinus/uploads/`는 사실상 영구 보존. 16 versions는 "파일이 손상돼서 그 시점 이전 상태가 필요할 때" 윈도우 역할(약 16일).
- **dumps** — 스크립트가 NFS 측에 14일 retention. 매일 03:30 Hyper Backup이 그 순간의 폴더 상태를 스냅샷. 16일 전 스냅샷도 그 시점 기준 직전 14일치 dump 파일을 들고 있으므로 **효과적 복구 윈도우는 최대 약 30일**.

이 정도면 paretolab 규모에서 충분. Google Drive 사용량을 한 달쯤 뒤 한 번 보고, 가파르면 Smart Recycle(같은 16 versions로도 몇 달치 보유 가능)로 전환을 검토.

## 복구 절차

### uploads

```bash
# Roo 측 백업 → Gopher (rsync 반대 방향)
rsync -a --no-owner --no-group --no-perms --modify-window=1 \
  /mnt/services/houseinus/uploads/ \
  /home/yeibeen/serve/prod-apps/houseinus-api/uploads/
```

Google Drive 측에서 복구가 필요하면 DSM Hyper Backup → Restore → Google Drive 잡에서 `Services/houseinus/uploads` 선택.

### Postgres

```bash
# 1. 운영 중인 서비스 중지
systemctl --user stop houseinus-api

# 2. 기존 DB 정리 (필요 시)
psql -h 192.168.0.200 -p 15432 -U <DB_USER> -d postgres -c "DROP DATABASE <DB_NAME>;"
psql -h 192.168.0.200 -p 15432 -U <DB_USER> -d postgres -c "CREATE DATABASE <DB_NAME>;"

# 3. dump 복구 (custom format → pg_restore)
pg_restore -h 192.168.0.200 -p 15432 -U <DB_USER> -d <DB_NAME> \
  --clean --if-exists --no-owner --no-privileges \
  /mnt/services/houseinus/dumps/houseinus-YYYYMMDD-HHMMSS.dump

# 4. 서비스 재기동
systemctl --user start houseinus-api

# 5. 헬스체크
curl -fsS http://127.0.0.1:38080/api/v1/health
```

`--clean --if-exists`는 복구 전 같은 객체를 drop. `--no-owner --no-privileges`는 dump가 가졌던 owner/grant를 무시(다른 환경으로 옮길 때 유용).

## 모니터링

| 항목 | 위치 |
| --- | --- |
| rsync 로그 | `~/logs/rsync-houseinus-uploads.log` |
| pg_dump 로그 | `~/logs/pg-dump-houseinus.log` |
| Hyper Backup 결과 | DSM 알림센터 + Hyper Backup → Job → Log |

빠른 점검:

```bash
tail -n 5 ~/logs/rsync-houseinus-uploads.log
tail -n 5 ~/logs/pg-dump-houseinus.log
ls -lh /mnt/services/houseinus/dumps/ | tail -5
du -sh /mnt/services/houseinus/uploads /mnt/services/houseinus/dumps
```
