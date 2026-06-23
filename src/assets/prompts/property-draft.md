# 매물 상세 페이지 JSON 초안 작성 부탁

아래에 매물의 특징/장점/단점을 정리해두었어. 이 정보를 바탕으로 우리 사이트의 매물 상세 페이지에 들어갈 카피를 한국어로 작성하고, 마지막에 JSON 한 덩어리로만 출력해줘.

## 매물 정보

- **위치**: (예: 경기도 양평군 강하면 ○○로 12-3)
- **가격**: (예: 9억 8천만원)
- **대지/실내 면적**: (예: 대지 280㎡ / 실내 165㎡, 2층)
- **방/화장실**: (예: 방 3 / 화장실 2)
- **사용승인**: (예: 2019년)

## 주요 특징

- (예: 남향 마당 + 텃밭, 거실 통창 너머로 산뷰)
- (예: 마당에서 직접 진입 가능한 대형 거실, 다용도 데크)
- (예: 천장 노출보 + 원목 마감)

## 장점 (강조해서 써줘)

- (예: 차로 5분 거리에 두물머리, 카페거리)
- (예: 학군: 도보 10분 OO초등학교)
- (예: 단열 성능 우수, 패시브하우스 인증)

## 단점 (가볍게 고지하는 정도로만, 부정적 어조 피하기)

- (예: 시내까지 차로 25분 — "한적함을 즐기는 분께 잘 맞는 거리")
- (예: 대중교통 다소 부족 — "차량 한 대 이상 권장")

## 작성 가이드

- 톤은 잡지 인터뷰처럼 따뜻하고 차분하게.
- "이 집의 이야기" (`lifestyle_story`)는 3~4문단, 각 문단을 빈 줄(`\n\n`)로 구분.
- "기다리는 순간들" (`lifestyle_highlights`)은 6~10개의 짧은 문장. 일상의 순간을 떠올리게.
- 단점은 `lifestyle_story` 후반에 부드럽게 한 번만 언급.
- `evaluation_metrics`는 4~6개. 가격대비가치, 위치, 단지환경, 채광, 공간감 등에서 골라 0~100점으로.
- `nearby_places`는 카테고리 2~4개로 묶어줘 (학교/편의/자연/교통 중 선택).
- `tags`는 한글 단문 3~6개 ("남향마당", "패시브하우스" 식).

## 출력 JSON 스키마

아래 형식 그대로 채워줘. 모르겠는 필드나 해당 없는 필드는 빼거나 빈 배열로. **이미지를 참조하는 필드 (`hero_image_id`, `interior_photos`, `floorplans`, `lifestyle_scenarios`)는 비워두면 됨** — 이미지는 따로 업로드 후 어드민 UI에서 연결할 거야.

```json
{
  "title": "string — 짧고 시적인 매물명",
  "subtitle": "string — 한 줄 카피, 이탤릭으로 표시됨",
  "location": "string — 주소 또는 지역명",
  "price": 0,
  "slug": "string-or-null — URL 슬러그 (영문 소문자/하이픈, 비울 거면 null)",
  "tags": ["짧은 태그 3~6개"],
  "lifestyle_story": "string — 빈 줄 두 개(\\n\\n)로 문단 구분된 본문",
  "lifestyle_highlights": ["일상의 순간 6~10개"],
  "specs": {
    "beds": 0,
    "baths": 0,
    "land_area": "string — 예: 280㎡ (85평)",
    "indoor_area": "string — 예: 165㎡ (50평)",
    "built_year": "string — 예: 2019",
    "scale": "string — 예: 지상 2층 / 철근콘크리트"
  },
  "loan_info": {
    "estimated_monthly_payment": 0,
    "max_loan_amount": 0,
    "interest_rate": 0,
    "loan_term": 0
  },
  "house_plan_specs": {
    "main": [{ "label": "string", "value": "string" }],
    "collapsed": [{ "label": "string", "value": "string" }]
  },
  "nearby_places": [
    {
      "icon": "School | Building2 | ShoppingCart | Trees | Bus | MapPin",
      "label": "string — 카테고리명",
      "places": [{ "name": "string", "distance": "string" }]
    }
  ],
  "evaluation_metrics": [
    { "score": 0, "title": "string", "description": "string" }
  ]
}
```

부탁할게!
