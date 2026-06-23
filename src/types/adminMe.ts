export interface AdminMe {
  telegram_user_id: string | null;
  notify_inquiry_house: boolean;
  notify_inquiry_metrics: boolean;
  notify_inquiry_portfolio: boolean;
  notify_open_house_inquiry: boolean;
  notify_inquiry_matched_property: boolean;
  notify_inquiry_delivery: boolean;
  notify_mbti: boolean;
  notify_delivery_publish: boolean;
}

export interface AdminMeUpdatePayload {
  telegram_user_id?: string | null;
  notify_inquiry_house?: boolean;
  notify_inquiry_metrics?: boolean;
  notify_inquiry_portfolio?: boolean;
  notify_open_house_inquiry?: boolean;
  notify_inquiry_matched_property?: boolean;
  notify_inquiry_delivery?: boolean;
  notify_mbti?: boolean;
  notify_delivery_publish?: boolean;
}
