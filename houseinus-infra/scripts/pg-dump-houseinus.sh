#!/usr/bin/env bash
#
# pg-dump-houseinus.sh
#
# Houseinus prod DB(Roo Container Manager의 Postgres 18.3)를 매일 한 번 dump해서
# Roo NFS 공유(/mnt/services/houseinus/dumps)에 떨어뜨린다. 같은 폴더를 Synology
# Hyper Backup이 03:30에 Google Drive로 올리므로 추가 업로드 단계는 없다.
#
# 자세한 흐름/복구 절차는 BACKUP_README.md 참고.
#
# 인증: ~/.pgpass 사용. 권한은 chmod 600.
#   포맷: 192.168.0.200:15432:houseinus:houseinus:<password>

set -euo pipefail

BIN="/usr/lib/postgresql/18/bin/pg_dump"
DB_HOST="192.168.0.200"
DB_PORT="15432"
DB_USER="houseinus"
DB_NAME="houseinus"
DUMP_DIR="/mnt/services/houseinus/dumps"
RETENTION_DAYS=14

# NFS 마운트 끊긴 상태면 빈 곳에 쓰지 않고 즉시 종료
mountpoint -q /mnt/services || {
  echo "$(date -Is) ERROR: /mnt/services not mounted, aborting dump"
  exit 1
}

mkdir -p "$DUMP_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
OUT="$DUMP_DIR/houseinus-${TS}.dump"

"$BIN" \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -Fc \
  -f "$OUT"

# 로컬(=NFS) 측 retention. Google Drive 측 버전은 Hyper Backup이 관리.
find "$DUMP_DIR" -maxdepth 1 -name 'houseinus-*.dump' -mtime "+$RETENTION_DAYS" -delete

echo "$(date -Is) OK: $OUT ($(du -h "$OUT" | cut -f1))"
