import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useUpdateProperty } from "@/hooks/useAdminProperties";
import {
  useAdminOpenHouseEvents,
  useAdminOpenHouseReservations,
  useCreateOpenHouseEvent,
  useDeleteOpenHouseEvent,
  useUpdateOpenHouseEvent,
  useUpdateOpenHouseReservation,
} from "@/hooks/useAdminOpenHouse";
import { useDirtyGuard } from "@/hooks/useDirtyGuard";
import { formatDateTimeKst } from "@/lib/datetime";
import type { LoanInfo, Property } from "@/types/property";
import type {
  OpenHouseEvent,
  OpenHouseEventPayload,
  OpenHouseEventStatus,
  OpenHouseReservation,
  OpenHouseReservationStatus,
} from "@/types/openHouse";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import SaveBar from "@/components/admin/property/SaveBar";

interface LoanFormState {
  loan_info: LoanInfo;
}

const fromProperty = (p: Property): LoanFormState => ({
  loan_info: { ...p.loan_info },
});

const statusLabel: Record<OpenHouseEventStatus, string> = {
  scheduled: "예정",
  closed: "마감",
  cancelled: "취소",
};

const emptyEvent: OpenHouseEventPayload = {
  date: "",
  time: "",
  capacity: 0,
  status: "scheduled",
  notes: "",
};

/** "HH:MM - HH:MM" ↔ [startTime, endTime] */
const parseTimeRange = (time: string): [string, string] => {
  const rangeMatch = time.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (rangeMatch) return [rangeMatch[1].padStart(5, "0"), rangeMatch[2].padStart(5, "0")];
  // 시작 시간만 있는 경우 "HH:MM"
  const singleMatch = time.trim().match(/^(\d{1,2}:\d{2})$/);
  if (singleMatch) return [singleMatch[1].padStart(5, "0"), ""];
  return ["", ""];
};
const formatTimeRange = (start: string, end: string): string => {
  if (!start && !end) return "";
  if (!end) return start;
  if (!start) return end;
  return `${start} - ${end}`;
};

/** 00:00 ~ 23:30, 30분 단위 */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const TimeSelect = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <Select value={value || ""} onValueChange={onChange}>
    <SelectTrigger className="flex-1 min-w-0">
      <SelectValue placeholder="--:--" />
    </SelectTrigger>
    <SelectContent>
      {TIME_OPTIONS.map((t) => (
        <SelectItem key={t} value={t}>
          {t}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);


const toEventPayload = (event: OpenHouseEvent): OpenHouseEventPayload => ({
  date: event.date,
  time: event.time,
  capacity: event.capacity,
  status: event.status,
  notes: event.notes ?? "",
});

const EventsLoanTab = ({ property }: { property: Property }) => {
  const update = useUpdateProperty(property.id);
  const [form, setForm] = useState<LoanFormState>(() => fromProperty(property));
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const events = useAdminOpenHouseEvents(property.id);
  const createEvent = useCreateOpenHouseEvent(property.id);
  const [newEvent, setNewEvent] = useState<OpenHouseEventPayload>(emptyEvent);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => setForm(fromProperty(property)), [property]);
  useEffect(() => {
    const first = events.data?.items[0]?.id ?? null;
    if (!selectedEventId && first) setSelectedEventId(first);
    if (selectedEventId && !events.data?.items.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(first);
    }
  }, [events.data?.items, selectedEventId]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(fromProperty(property)),
    [form, property],
  );
  useDirtyGuard(dirty);

  const onSaveLoan = async () => {
    setSaveErr(null);
    try {
      await update.mutateAsync({ loan_info: form.loan_info });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  };

  const setLoan = <K extends keyof LoanInfo>(k: K, v: LoanInfo[K]) =>
    setForm((f) => ({ ...f, loan_info: { ...f.loan_info, [k]: v } }));

  const onCreateEvent = async () => {
    const created = await createEvent.mutateAsync({
      ...newEvent,
      notes: newEvent.notes || null,
    });
    setSelectedEventId(created.id);
    setNewEvent(emptyEvent);
  };

  const selectedEvent = events.data?.items.find((event) => event.id === selectedEventId) ?? null;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">오픈하우스 일정</h2>
          <div className="text-xs text-muted-foreground">
            {events.data?.total.toLocaleString() ?? 0}개 일정
          </div>
        </div>

        <div className="rounded-sm border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[10rem_1fr_7rem_8rem]">
            <Input
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent((prev) => ({ ...prev, date: e.target.value }))}
            />
            <div className="flex items-center gap-1.5">
              <TimeSelect
                value={parseTimeRange(newEvent.time)[0]}
                onChange={(v) => {
                  const [, end] = parseTimeRange(newEvent.time);
                  setNewEvent((prev) => ({ ...prev, time: formatTimeRange(v, end) }));
                }}
              />
              <span className="text-muted-foreground text-sm shrink-0">~</span>
              <TimeSelect
                value={parseTimeRange(newEvent.time)[1]}
                onChange={(v) => {
                  const [start] = parseTimeRange(newEvent.time);
                  setNewEvent((prev) => ({ ...prev, time: formatTimeRange(start, v) }));
                }}
              />
            </div>
            <Input
              type="number"
              min={0}
              placeholder="정원"
              value={newEvent.capacity}
              onChange={(e) =>
                setNewEvent((prev) => ({ ...prev, capacity: Number(e.target.value) || 0 }))
              }
            />
            <Select
              value={newEvent.status}
              onValueChange={(value) =>
                setNewEvent((prev) => ({ ...prev, status: value as OpenHouseEventStatus }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">예정</SelectItem>
                <SelectItem value="closed">마감</SelectItem>
                <SelectItem value="cancelled">취소</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="메모"
            value={newEvent.notes ?? ""}
            onChange={(e) => setNewEvent((prev) => ({ ...prev, notes: e.target.value }))}
            rows={2}
          />
          <Button
            type="button"
            size="sm"
            onClick={onCreateEvent}
            disabled={!newEvent.date || !newEvent.time.trim() || createEvent.isPending}
          >
            <Plus className="mr-1 h-4 w-4" />
            일정 만들기
          </Button>
        </div>

        <div className="space-y-3">
          {events.isLoading ? (
            <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              일정을 불러오는 중...
            </div>
          ) : events.data?.items.length ? (
            events.data.items.map((event) => (
              <EventEditor
                key={event.id}
                propertyId={property.id}
                event={event}
                selected={event.id === selectedEventId}
                onSelect={() => setSelectedEventId(event.id)}
              />
            ))
          ) : (
            <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              등록된 오픈하우스 일정이 없습니다.
            </div>
          )}
        </div>

        <ReservationsPanel propertyId={property.id} event={selectedEvent} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">대출 정보 (LoanCalculator)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">예상 월 상환액 (원)</Label>
            <Input
              type="number"
              min={0}
              value={form.loan_info.estimated_monthly_payment ?? ""}
              onChange={(e) =>
                setLoan("estimated_monthly_payment", Number(e.target.value) || null)
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">최대 대출 가능액 (원)</Label>
            <Input
              type="number"
              min={0}
              value={form.loan_info.max_loan_amount ?? ""}
              onChange={(e) => setLoan("max_loan_amount", Number(e.target.value) || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">금리 (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.loan_info.interest_rate ?? ""}
              onChange={(e) => setLoan("interest_rate", Number(e.target.value) || null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">대출 기간 (년)</Label>
            <Input
              type="number"
              min={0}
              value={form.loan_info.loan_term ?? ""}
              onChange={(e) => setLoan("loan_term", Number(e.target.value) || null)}
            />
          </div>
        </div>
      </section>

      <SaveBar
        dirty={dirty}
        saving={update.isPending}
        onSave={onSaveLoan}
        error={saveErr}
      />
    </div>
  );
};

const EventEditor = ({
  propertyId,
  event,
  selected,
  onSelect,
}: {
  propertyId: string;
  event: OpenHouseEvent;
  selected: boolean;
  onSelect: () => void;
}) => {
  const updateEvent = useUpdateOpenHouseEvent(propertyId);
  const deleteEvent = useDeleteOpenHouseEvent(propertyId);
  const [form, setForm] = useState<OpenHouseEventPayload>(() => toEventPayload(event));

  useEffect(() => setForm(toEventPayload(event)), [event]);
  const dirty = JSON.stringify(form) !== JSON.stringify(toEventPayload(event));

  const onSave = () =>
    updateEvent.mutate({
      id: event.id,
      payload: {
        ...form,
        notes: form.notes || null,
      },
    });

  return (
    <div
      className={`rounded-sm border bg-card p-4 space-y-3 ${
        selected ? "border-primary" : "border-border"
      }`}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[10rem_1fr_7rem_8rem]">
        <Input
          type="date"
          value={form.date}
          onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
        />
        <div className="flex items-center gap-1.5">
          <TimeSelect
            value={parseTimeRange(form.time)[0]}
            onChange={(v) => {
              const [, end] = parseTimeRange(form.time);
              setForm((prev) => ({ ...prev, time: formatTimeRange(v, end) }));
            }}
          />
          <span className="text-muted-foreground text-sm shrink-0">~</span>
          <TimeSelect
            value={parseTimeRange(form.time)[1]}
            onChange={(v) => {
              const [start] = parseTimeRange(form.time);
              setForm((prev) => ({ ...prev, time: formatTimeRange(start, v) }));
            }}
          />
        </div>
        <Input
          type="number"
          min={0}
          value={form.capacity}
          onChange={(e) => setForm((prev) => ({ ...prev, capacity: Number(e.target.value) || 0 }))}
        />
        <Select
          value={form.status}
          onValueChange={(value) =>
            setForm((prev) => ({ ...prev, status: value as OpenHouseEventStatus }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled">예정</SelectItem>
            <SelectItem value="closed">마감</SelectItem>
            <SelectItem value="cancelled">취소</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={form.notes ?? ""}
        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
        rows={2}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={event.status === "scheduled" ? "default" : "secondary"}>
            {statusLabel[event.status]}
          </Badge>
          <span>예약 {event.reservation_count.toLocaleString()}건</span>
          <span>잔여 {event.capacity > 0 ? `${event.available_spots}자리` : "정원 미정"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSelect}>
            예약 보기
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={!dirty || updateEvent.isPending}
          >
            저장
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => deleteEvent.mutate(event.id)}
            disabled={deleteEvent.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const ReservationsPanel = ({
  propertyId,
  event,
}: {
  propertyId: string;
  event: OpenHouseEvent | null;
}) => {
  const reservations = useAdminOpenHouseReservations(propertyId, event?.id ?? null);

  if (!event) {
    return (
      <div className="rounded-sm border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        예약 목록을 볼 일정을 선택하세요.
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="font-medium">예약 목록</div>
          <div className="text-xs text-muted-foreground">
            {event.date} · {event.time}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {reservations.data?.total.toLocaleString() ?? 0}건
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>접수일</TableHead>
            <TableHead>성함</TableHead>
            <TableHead>이메일</TableHead>
            <TableHead>연락처</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>메모</TableHead>
            <TableHead className="text-right">저장</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                예약을 불러오는 중...
              </TableCell>
            </TableRow>
          ) : reservations.data?.items.length ? (
            reservations.data.items.map((reservation) => (
              <ReservationRow
                key={reservation.id}
                propertyId={propertyId}
                eventId={event.id}
                reservation={reservation}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                예약자가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const ReservationRow = ({
  propertyId,
  eventId,
  reservation,
}: {
  propertyId: string;
  eventId: string;
  reservation: OpenHouseReservation;
}) => {
  const updateReservation = useUpdateOpenHouseReservation(propertyId, eventId);
  const [status, setStatus] = useState<OpenHouseReservationStatus>(reservation.status);
  const [notes, setNotes] = useState(reservation.notes ?? "");

  useEffect(() => {
    setStatus(reservation.status);
    setNotes(reservation.notes ?? "");
  }, [reservation]);

  const dirty = status !== reservation.status || notes !== (reservation.notes ?? "");

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {formatDateTimeKst(reservation.created_at)}
      </TableCell>
      <TableCell className="font-medium">{reservation.name}</TableCell>
      <TableCell className="whitespace-nowrap">{reservation.email}</TableCell>
      <TableCell className="whitespace-nowrap">{reservation.phone}</TableCell>
      <TableCell>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as OpenHouseReservationStatus)}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="reserved">예약</SelectItem>
            <SelectItem value="cancelled">취소</SelectItem>
            <SelectItem value="attended">방문 완료</SelectItem>
            <SelectItem value="no_show">미방문</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!dirty || updateReservation.isPending}
          onClick={() =>
            updateReservation.mutate({
              id: reservation.id,
              status,
              notes: notes || null,
            })
          }
        >
          저장
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default EventsLoanTab;
