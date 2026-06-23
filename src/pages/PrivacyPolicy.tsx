import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const PrivacyPolicy = () => {
  useDocumentTitle("개인정보처리방침 | 하우스인어스");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-6 pt-24 pb-16 max-w-3xl">
        <h1 className="font-serif text-3xl font-semibold text-foreground mb-2">
          개인정보처리방침
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          시행일: 2026년 4월 22일 · v1
        </p>

        <div className="text-sm text-foreground leading-normal space-y-5">
          <p>
            파레토랩(이하 "회사")이 운영하는 <strong>하우스인어스(House in Us)</strong>는 단독주택 및
            타운하우스의 특성과 생활 가치를 보다 체계적으로 전달할 수 있도록 온라인 집소개서, PDF
            포트폴리오, 사진 및 외부 플랫폼용 이미지 자료를 제작·제공하는 서비스입니다. 회사는
            이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.
            본 개인정보처리방침은 회사가 어떠한 개인정보를 수집하고, 어떤 목적으로 이용하며,
            어떻게 보호하는지를 설명합니다.
          </p>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제1조 (개인정보의 처리 목적)
            </h2>
            <p>회사는 다음 목적을 위하여 개인정보를 처리합니다.</p>
            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>
                <strong>회원가입 및 계정 관리</strong>
                <ul className="list-disc list-inside pl-5 mt-0.5 space-y-0.5 text-muted-foreground">
                  <li>회원 식별, 본인 확인 및 로그인 지원</li>
                  <li>작성 중인 집소개서의 임시 저장 및 재접속 지원</li>
                </ul>
              </li>
              <li>
                <strong>집소개서 및 포트폴리오 제작 서비스 제공</strong>
                <ul className="list-disc list-inside pl-5 mt-0.5 space-y-0.5 text-muted-foreground">
                  <li>주택 소개용 온라인 페이지, PDF 포트폴리오, 사진 자료 및 외부 플랫폼용 이미지 제작</li>
                  <li>사진 보정, 문안 작성, 레이아웃 편집, 지표 산정 및 콘텐츠 구성</li>
                </ul>
              </li>
              <li>
                <strong>주택 권리 및 게시 권한 확인</strong>
                <ul className="list-disc list-inside pl-5 mt-0.5 space-y-0.5 text-muted-foreground">
                  <li>주택 소유자 또는 적법한 권한 보유 여부 확인</li>
                  <li>위임장, 동의서 등 제출 자료 검토</li>
                </ul>
              </li>
              <li>
                <strong>서비스 운영 및 고객 지원</strong>
                <ul className="list-disc list-inside pl-5 mt-0.5 space-y-0.5 text-muted-foreground">
                  <li>상담, 문의 대응, 일정 조율, 계약 체결 및 서비스 진행</li>
                  <li>결제 확인, 환불 처리 및 분쟁 대응</li>
                </ul>
              </li>
              <li>
                <strong>서비스 품질 개선 및 통계 분석</strong>
                <ul className="list-disc list-inside pl-5 mt-0.5 space-y-0.5 text-muted-foreground">
                  <li>접속 기록 분석, 기능 개선, 사용자 경험 향상</li>
                  <li>마케팅 및 광고 효과 측정</li>
                </ul>
              </li>
              <li>
                <strong>법령상 의무 이행</strong>
                <ul className="list-disc list-inside pl-5 mt-0.5 space-y-0.5 text-muted-foreground">
                  <li>세무, 회계, 전자상거래 관련 법령 준수</li>
                  <li>관계기관 요청 대응</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제2조 (처리하는 개인정보 항목)
            </h2>
            <p>회사는 서비스 제공 과정에서 다음 정보를 수집할 수 있습니다.</p>

            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold mb-1">1. 회원가입 및 로그인 시</h3>
                <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
                  <li>이름 또는 닉네임</li>
                  <li>이메일 주소</li>
                  <li>휴대전화번호(선택)</li>
                  <li>비밀번호(암호화 저장)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-1">2. 서비스 신청 및 진행 시</h3>
                <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
                  <li>신청인 이름, 연락처</li>
                  <li>주택 주소</li>
                  <li>방문 희망 일정</li>
                  <li>주택 사진 및 영상</li>
                  <li>주택 관련 도면, 공적 서류 및 기타 참고 자료</li>
                  <li>관리 이력, 생활 정보, 인터뷰 응답 내용</li>
                  <li>상담 메모</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-1">3. 권리 확인 시</h3>
                <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
                  <li>소유자 성명</li>
                  <li>위임장 또는 동의서</li>
                  <li>신분 확인 자료 일부</li>
                  <li>기타 게시 권한 확인을 위한 자료</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-1">4. 결제 및 세무 처리 시</h3>
                <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
                  <li>입금자명</li>
                  <li>결제 내역</li>
                  <li>사업자등록번호(세금계산서 발행 시)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-base font-semibold mb-1">5. 자동 생성 정보</h3>
                <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
                  <li>IP 주소</li>
                  <li>쿠키</li>
                  <li>브라우저 및 기기 정보</li>
                  <li>접속 일시</li>
                  <li>이용 기록</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제3조 (개인정보의 수집 방법)
            </h2>
            <p>회사는 다음 방법으로 개인정보를 수집합니다.</p>
            <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
              <li>홈페이지 회원가입 및 서비스 신청 양식</li>
              <li>상담 과정(이메일, 전화, 문자, 카카오톡, 당근 채팅 등)</li>
              <li>계약서 및 서비스 진행 동의서</li>
              <li>이용자가 직접 업로드한 자료</li>
              <li>서비스 이용 과정에서 자동 생성되는 정보</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제4조 (민감정보 및 고유식별정보 처리)
            </h2>
            <p>
              회사는 원칙적으로 주민등록번호, 건강정보 등 법령상 민감정보 및 고유식별정보를 수집하지
              않습니다.
            </p>
            <p>
              다만, 이용자가 서비스 이용 과정에서 제출하는 권리 확인 자료, 사진, 영상, 문서 및 기타
              참고 자료에 주민등록번호, 가족 사진 또는 얼굴 이미지, 상장·증서·우편물 등에 기재된
              이름, 차량 번호판, 주소, 연락처 등 서비스 제공에 불필요한 개인정보가 포함된 경우에는
              가능한 범위 내에서 이를 가리거나 제거한 후 제출하도록 안내할 수 있습니다.
            </p>
            <p>
              이용자는 권리 확인 자료 및 기타 자료 제출 시 주민등록번호 뒷자리 등 서비스 제공에
              필요하지 않은 정보는 가린 후 제출할 수 있습니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제5조 (개인정보의 처리 및 보유 기간)
            </h2>
            <p>
              회사는 개인정보의 처리 목적이 달성되면 지체 없이 파기합니다. 다만 다음 정보는 아래
              기간 동안 보관할 수 있습니다.
            </p>
            <ol className="list-decimal list-inside pl-4 space-y-0.5 text-muted-foreground">
              <li>회원정보: 회원 탈퇴 시까지</li>
              <li>작성 중 임시 저장 데이터: 마지막 접속일로부터 12개월</li>
              <li>상담 및 문의 기록: 3년</li>
              <li>계약 및 결제 관련 자료: 관련 법령에 따른 기간</li>
              <li>접속 로그: 3개월 또는 관련 법령상 보관 기간</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제6조 (개인정보의 제3자 제공)
            </h2>
            <p>회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.</p>
            <p>다만 다음의 경우에는 예외로 합니다.</p>
            <ol className="list-decimal list-inside pl-4 space-y-0.5 text-muted-foreground">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 따라 제공이 요구되는 경우</li>
              <li>수사기관 등 적법한 절차에 따른 요청이 있는 경우</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제7조 (개인정보 처리의 위탁)
            </h2>
            <p>회사는 서비스 운영을 위하여 다음과 같은 업무를 외부에 위탁할 수 있습니다.</p>
            <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
              <li>클라우드 서버 및 데이터 저장</li>
              <li>이메일 및 문자 발송</li>
              <li>결제 처리</li>
              <li>웹 분석 서비스</li>
              <li>고객 문의 관리</li>
            </ul>
            <p>회사는 위탁계약 체결 시 개인정보가 안전하게 처리되도록 관리·감독합니다.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제8조 (개인정보의 국외 이전)
            </h2>
            <p>
              회사는 서비스 운영 과정에서 일부 개인정보를 해외에 위치한 서비스 제공자에게 저장하거나
              처리할 수 있습니다. 회사는 관련 법령이 요구하는 경우 필요한 고지 및 동의 절차를
              진행합니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제9조 (개인정보의 파기)
            </h2>
            <p>회사는 개인정보 보유기간 경과 또는 처리 목적 달성 시 지체 없이 파기합니다.</p>
            <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
              <li>전자적 파일: 복구 불가능한 방식으로 영구 삭제</li>
              <li>종이 문서: 분쇄 또는 소각</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제10조 (이용자의 권리 및 행사 방법)
            </h2>
            <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
              <li>개인정보 열람</li>
              <li>정정</li>
              <li>삭제</li>
              <li>처리정지</li>
              <li>동의 철회</li>
              <li>회원 탈퇴</li>
            </ul>
            <p>권리 행사는 아래 연락처를 통해 요청할 수 있으며 회사는 관련 법령에 따라 처리합니다.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제11조 (개인정보의 안전성 확보조치)
            </h2>
            <p>회사는 개인정보 보호를 위하여 다음과 같은 조치를 시행합니다.</p>
            <ul className="list-disc list-inside pl-4 space-y-0.5 text-muted-foreground">
              <li>HTTPS 기반 암호화 통신</li>
              <li>비밀번호 암호화 저장</li>
              <li>접근 권한 최소화</li>
              <li>관리자 계정 보호</li>
              <li>정기적인 보안 점검 및 업데이트</li>
              <li>접속기록 관리</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제12조 (쿠키 및 분석 도구)
            </h2>
            <p>
              회사는 서비스 개선과 마케팅 성과 분석을 위하여 쿠키 및 분석 도구를 사용할 수 있습니다.
            </p>
            <p>
              이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며, 이 경우 일부 기능 이용이
              제한될 수 있습니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제13조 (개인정보 보호책임자)
            </h2>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>성명: 안예빈</li>
              <li>상호: 파레토랩</li>
              <li>
                이메일:{" "}
                <a href="mailto:yeibeen.ahn@paretolab.kr" className="text-primary hover:underline">
                  yeibeen.ahn@paretolab.kr
                </a>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제14조 (권익침해 구제방법)
            </h2>
            <p>이용자는 개인정보 침해와 관련하여 아래 기관에 상담 또는 신고할 수 있습니다.</p>
            <ul className="list-disc list-inside pl-4 space-y-0.5">
              <li>
                <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  개인정보침해신고센터
                </a>
              </li>
              <li>
                <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  개인정보분쟁조정위원회
                </a>
              </li>
              <li>
                <a href="https://www.spo.go.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  대검찰청 사이버수사과
                </a>
              </li>
              <li>
                <a href="https://ecrm.police.go.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  경찰청 사이버범죄 신고시스템(ECRM)
                </a>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              제15조 (개인정보처리방침의 변경)
            </h2>
            <p>
              본 개인정보처리방침은 <strong>2026년 4월 22일</strong>부터 적용됩니다.
            </p>
            <p>
              회사는 법령, 서비스 내용 또는 내부 정책의 변경에 따라 본 방침을 수정할 수 있으며,
              중요한 변경 사항은 홈페이지를 통해 사전에 안내합니다.
            </p>
          </section>

          <div className="pt-6 border-t border-border text-sm text-muted-foreground space-y-0.5">
            <p>공고일자: 2026년 4월 22일</p>
            <p>시행일자: 2026년 4월 22일</p>
            <p>버전: v1</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
