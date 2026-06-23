import { Property } from "@/data/properties";

// Google Sheets 공개 URL에서 스프레드시트 ID 추출
// 일반 URL: /spreadsheets/d/{ID}/edit
// 게시 URL: /spreadsheets/d/e/{EXPORT_ID}/pubhtml
export const extractSheetId = (url: string): string | null => {
  // 일반 스프레드시트 URL
  const normalMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:\/|$)/);
  if (normalMatch && !url.includes('/d/e/')) {
    return normalMatch[1];
  }
  
  // pubhtml 게시 URL (e/ 형식)
  const pubMatch = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (pubMatch) {
    return pubMatch[1];
  }
  
  return null;
};

// Google Sheets에서 데이터 fetch (웹에 게시된 시트)
export const fetchPropertiesFromSheet = async (
  sheetId: string,
  sheetName: string = "Sheet1"
): Promise<Property[]> => {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch Google Sheet data");
  }

  const text = await response.text();
  // Google returns JSONP-like response, need to extract JSON
  const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/);
  if (!jsonMatch) {
    throw new Error("Invalid Google Sheets response format");
  }

  const data = JSON.parse(jsonMatch[1]);
  const rows = data.table.rows;
  const cols = data.table.cols;

  // 헤더 매핑 (첫 번째 행이 헤더라고 가정)
  const headers = cols.map((col: { label: string }) => col.label.toLowerCase());

  const properties: Property[] = rows.slice(0).map((row: { c: Array<{ v: string | number | null }> }, index: number) => {
    const getValue = (columnName: string): string => {
      const colIndex = headers.indexOf(columnName.toLowerCase());
      if (colIndex === -1) return "";
      const cell = row.c[colIndex];
      return cell?.v?.toString() || "";
    };

    const getNumberValue = (columnName: string): number => {
      const colIndex = headers.indexOf(columnName.toLowerCase());
      if (colIndex === -1) return 0;
      const cell = row.c[colIndex];
      return typeof cell?.v === "number" ? cell.v : parseFloat(cell?.v?.toString() || "0") || 0;
    };

    // 라이프스타일 하이라이트 파싱 (쉼표로 구분)
    const highlightsStr = getValue("lifestylehighlights");
    const lifestyleHighlights = highlightsStr
      ? highlightsStr.split(",").map((h) => h.trim())
      : [];

    // 오픈하우스 이벤트 파싱 (JSON 문자열 또는 세미콜론으로 구분)
    const eventsStr = getValue("openhouseevents");
    let openHouseEvents: Property["openHouseEvents"] = [];
    if (eventsStr) {
      try {
        openHouseEvents = JSON.parse(eventsStr);
      } catch {
        // 세미콜론으로 구분된 형식: "2025-01-18,오전 10:00,8;2025-01-25,오후 2:00,12"
        openHouseEvents = eventsStr.split(";").map((event) => {
          const [date, time, spots] = event.split(",").map((s) => s.trim());
          return {
            date: date || "",
            time: time || "",
            availableSpots: parseInt(spots) || 0,
          };
        });
      }
    }

    // status 파싱 (on/off, 기본값은 on)
    const statusValue = getValue("status").toLowerCase();
    const status: "on" | "off" = statusValue === "off" ? "off" : "on";

    // tags 파싱 (쉼표로 구분)
    const tagsStr = getValue("tags");
    const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : [];

    return {
      id: getValue("id") || (index + 1).toString(),
      slug: null,
      title: getValue("title"),
      subtitle: getValue("subtitle"),
      location: getValue("location"),
      price: getNumberValue("price"),
      image: getValue("image") ? convertGoogleDriveUrl(getValue("image")) : "/placeholder.svg",
      lifestyleStory: getValue("lifestylestory"),
      lifestyleHighlights,
      openHouseEvents,
      status,
      tags,
      loanInfo: {
        estimatedMonthlyPayment: getNumberValue("monthlypayment"),
        maxLoanAmount: getNumberValue("maxloanamount"),
        interestRate: getNumberValue("interestrate"),
        loanTerm: getNumberValue("loanterm"),
      },
    };
  });

  return properties.filter((p) => p.title); // 빈 행 제외
};

// Google Drive 링크를 직접 이미지 URL로 변환
const convertGoogleDriveUrl = (url: string): string => {
  // https://drive.google.com/file/d/{FILE_ID}/view?... → thumbnail URL
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
  }
  // https://drive.google.com/open?id={FILE_ID}
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) {
    return `https://drive.google.com/thumbnail?id=${match2[1]}&sz=w1000`;
  }
  return url;
};

// 기본 시트 ID (로컬 스토리지에서 관리)
const SHEET_ID_KEY = "houseinearth_sheet_id";

export const getStoredSheetId = (): string | null => {
  return localStorage.getItem(SHEET_ID_KEY);
};

export const setStoredSheetId = (sheetId: string): void => {
  localStorage.setItem(SHEET_ID_KEY, sheetId);
};

export const clearStoredSheetId = (): void => {
  localStorage.removeItem(SHEET_ID_KEY);
};
