import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Users } from "lucide-react";
import { useAdminOpenHouseCalendar } from "@/hooks/useAdminOpenHouseCalendar";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import type {
  OpenHouseEvent,
  OpenHouseEventStatus,
} from "@/types/openHouse";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const statusLabel: Record<OpenHouseEventStatus, string> = {
  scheduled: "예정",
  closed: "마감",
  cancelled: "취소",
};

const statusVariant: Record<
  OpenHouseEventStatus,
  "default" | "secondary" | "outline"
> = {
  scheduled: "default",
  closed: "secondary",
  cancelled: "outline",
};

const parseEventDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const formatDate = (d: Date) =>
  d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

const AdminOpenHouseCalendar = () => {
  useDocumentTitle("오픈하우스 캘린더 | 관리자 | 하우스인어스");
  const [selected, setSelected] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  });

  const { data, isLoading, error } = useAdminOpenHouseCalendar();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, OpenHouseEvent[]>();
    for (const e of data?.items ?? []) {
      const key = e.date;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [data?.items]);

  const datesWithEvents = useMemo(
    () => Array.from(eventsByDate.keys()).map(parseEventDate),
    [eventsByDate],
  );

  const selectedKey = dateKey(selected);
  const selectedEvents = eventsByDate.get(selectedKey) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-medium">오픈하우스 캘린더</h1>
        <p className="text-sm text-muted-foreground mt-1">
          전체 매물의 오픈하우스 일정을 한눈에 확인합니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          일정을 불러오지 못했습니다: {error instanceof Error ? error.message : ""}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <div className="rounded-sm border border-border bg-card p-2 self-start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            modifiers={{ hasEvents: datesWithEvents }}
            modifiersClassNames={{
              hasEvents:
                "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
            }}
          />
          <div className="px-3 pb-2 pt-1 text-xs text-muted-foreground">
            전체 {data?.total.toLocaleString() ?? 0}건
            {isLoading ? " · 불러오는 중..." : null}
          </div>
        </div>

        <div className="rounded-sm border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="font-medium">{formatDate(selected)}</div>
              <div className="text-xs text-muted-foreground">
                {selectedEvents.length}건의 일정
              </div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {selectedEvents.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                선택한 날짜에 등록된 오픈하우스가 없습니다.
              </div>
            ) : (
              selectedEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EventRow = ({ event }: { event: OpenHouseEvent }) => {
  const hasCapacity = event.capacity > 0;
  return (
    <div className="flex flex-wrap items-start gap-4 px-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[event.status]}>
            {statusLabel[event.status]}
          </Badge>
          {event.property_id ? (
            <Link
              to={`/admin/properties/${event.property_id}`}
              className="font-medium hover:underline truncate"
            >
              {event.property_title ?? event.property_id}
            </Link>
          ) : (
            <span className="font-medium">{event.property_title ?? "—"}</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {event.time}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {hasCapacity
              ? `${event.reservation_count}/${event.capacity}명 (잔여 ${event.available_spots})`
              : `${event.reservation_count}명 예약됨 (정원 미정)`}
          </span>
        </div>
        {event.notes ? (
          <p className="mt-2 text-sm text-foreground/80 whitespace-pre-wrap">
            {event.notes}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default AdminOpenHouseCalendar;
