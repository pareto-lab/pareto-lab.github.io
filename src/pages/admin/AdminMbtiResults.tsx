import { useAdminMbtiResults } from "@/hooks/useAdminMbtiResults";
import { formatDateTimeKst } from "@/lib/datetime";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ageLabel: Record<string, string> = {
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대 이상",
};

const genderLabel: Record<string, string> = {
  male: "남성",
  female: "여성",
  other: "기타",
};

const familyLabel: Record<string, string> = {
  single: "1인 가구",
  couple: "부부",
  "young-family": "영유아 자녀",
  "school-family": "학령기 자녀",
  "grown-family": "성인 자녀",
};

const hobbyLabel: Record<string, string> = {
  cooking: "요리/베이킹",
  reading: "독서/글쓰기",
  gardening: "정원",
  exercise: "운동",
  art: "그림/공예",
  music: "음악",
};

const dreamLabel: Record<string, string> = {
  "yard-bbq": "마당 바베큐",
  "home-office": "서재/작업실",
  "morning-coffee": "테라스 커피",
  "kids-play": "아이 마당",
  pool: "수영장",
  stargazing: "별 보기",
};

const labels = (values: string[], map: Record<string, string>) =>
  values.map((value) => map[value] ?? value).join(", ") || "—";

const yn = (value: boolean) => (value ? "예" : "아니오");

const AdminMbtiResults = () => {
  useDocumentTitle("MBTI 결과 관리 | 관리자 | 하우스인어스");
  const { data, isLoading, error } = useAdminMbtiResults(0, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-medium">MBTI 결과 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          주택 MBTI 결과와 이메일 저장 요청을 확인합니다.
        </p>
      </div>

      <div className="rounded-sm border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="font-medium">결과 목록</div>
          <div className="text-sm text-muted-foreground">
            전체 {data?.total.toLocaleString() ?? 0}건
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>저장일</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>기본 정보</TableHead>
              <TableHead>생활 조건</TableHead>
              <TableHead>취미</TableHead>
              <TableHead>로망</TableHead>
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
                  {error instanceof Error ? error.message : "MBTI 결과를 불러오지 못했습니다."}
                </TableCell>
              </TableRow>
            ) : data?.items.length ? (
              data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDateTimeKst(item.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.source === "email_save" ? "default" : "secondary"}>
                      {item.source === "email_save" ? "이메일 저장" : "익명"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{item.email ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {ageLabel[item.age] ?? item.age} · {genderLabel[item.gender] ?? item.gender} ·{" "}
                    {familyLabel[item.family_type] ?? item.family_type}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    운전 {yn(item.driving)} · 식물 {yn(item.plants)} · 반려동물 {yn(item.pets)} · 캠핑{" "}
                    {yn(item.camping)}
                  </TableCell>
                  <TableCell className="max-w-[240px] text-sm">
                    {labels(item.hobbies, hobbyLabel)}
                  </TableCell>
                  <TableCell className="max-w-[260px] text-sm">
                    {labels(item.dreams, dreamLabel)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  저장된 결과가 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminMbtiResults;
