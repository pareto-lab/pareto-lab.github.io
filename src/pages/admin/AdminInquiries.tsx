import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminInquiries } from "@/hooks/useAdminInquiries";
import { useAdminOpenHouseInquiries } from "@/hooks/useAdminOpenHouseInquiries";
import type { Inquiry, InquiryType } from "@/types/inquiry";
import type { OpenHouseInquiry } from "@/types/openHouseInquiry";
import { formatDateTimeKst } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type TabValue = InquiryType | "open_house_schedule";

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: "house_question", label: "집 문의" },
  { value: "metrics_question", label: "지표 문의" },
  { value: "portfolio_request", label: "포트폴리오 의뢰" },
  { value: "open_house_schedule", label: "오픈하우스 일정 문의" },
  { value: "matched_property_subscribe", label: "맞춤 매물 정보 수신" },
  { value: "delivery_question", label: "최종 결과물 질의" },
];

const tabLabel = (value: TabValue) =>
  TABS.find((tab) => tab.value === value)?.label ?? value;

const contactLabel = (item: Inquiry) => {
  if (!item.contact_value) return "—";
  if (item.contact_type === "phone") return `전화 ${item.contact_value}`;
  if (item.contact_type === "email") return `이메일 ${item.contact_value}`;
  return item.contact_value;
};

const PropertyCell = ({
  propertyId,
  propertyTitle,
}: {
  propertyId: string | null;
  propertyTitle: string | null;
}) => {
  if (!propertyTitle) return <span>—</span>;
  if (!propertyId) return <span>{propertyTitle}</span>;
  return (
    <Link
      to={`/properties/${propertyId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {propertyTitle}
    </Link>
  );
};

const InquiryTable = ({ type }: { type: InquiryType }) => {
  const { data, isLoading, error } = useAdminInquiries(type, 0, 100);

  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="font-medium">{tabLabel(type)}</div>
        <div className="text-sm text-muted-foreground">
          전체 {data?.total.toLocaleString() ?? 0}건
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>접수일</TableHead>
            <TableHead>종류</TableHead>
            <TableHead>매물</TableHead>
            <TableHead>이름</TableHead>
            <TableHead>연락처</TableHead>
            <TableHead>내용</TableHead>
            <TableHead>지역</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                불러오는 중...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-destructive">
                {error instanceof Error ? error.message : "문의 목록을 불러오지 못했습니다."}
              </TableCell>
            </TableRow>
          ) : data?.items.length ? (
            data.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTimeKst(item.created_at)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{tabLabel(item.type)}</Badge>
                </TableCell>
                <TableCell className="max-w-[180px] truncate">
                  <PropertyCell
                    propertyId={item.property_id}
                    propertyTitle={item.property_title}
                  />
                </TableCell>
                <TableCell>{item.name ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{contactLabel(item)}</TableCell>
                <TableCell className="max-w-[360px] whitespace-pre-wrap text-sm">
                  {item.question ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {[item.city, item.district].filter(Boolean).join(" ") || "—"}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                접수된 항목이 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const OpenHouseInquiryTable = () => {
  const { data, isLoading, error } = useAdminOpenHouseInquiries(0, 100);

  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="font-medium">{tabLabel("open_house_schedule")}</div>
        <div className="text-sm text-muted-foreground">
          전체 {data?.total.toLocaleString() ?? 0}건
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>접수일</TableHead>
            <TableHead>종류</TableHead>
            <TableHead>매물</TableHead>
            <TableHead>이름</TableHead>
            <TableHead>이메일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                불러오는 중...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-destructive">
                {error instanceof Error
                  ? error.message
                  : "오픈하우스 일정 문의를 불러오지 못했습니다."}
              </TableCell>
            </TableRow>
          ) : data?.items.length ? (
            data.items.map((item: OpenHouseInquiry) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTimeKst(item.created_at)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {tabLabel("open_house_schedule")}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[180px] truncate">
                  <PropertyCell
                    propertyId={item.property_id}
                    propertyTitle={item.property_title}
                  />
                </TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell className="whitespace-nowrap">{item.email}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                접수된 항목이 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const AdminInquiries = () => {
  useDocumentTitle("문의·의뢰 관리 | 관리자 | 하우스인어스");
  const [tab, setTab] = useState<TabValue>("house_question");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-medium">문의·의뢰 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          집 문의, 지표 문의, 포트폴리오 의뢰, 오픈하우스 일정 문의를 종류별로 확인합니다.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 md:w-[1080px]">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === "open_house_schedule" ? (
        <OpenHouseInquiryTable />
      ) : (
        <InquiryTable type={tab} />
      )}
    </div>
  );
};

export default AdminInquiries;
