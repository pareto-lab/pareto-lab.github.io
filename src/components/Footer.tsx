import { Link, useLocation, useNavigate } from "react-router-dom";
import { trackCTAClick } from "@/utils/analytics";

const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleViewListings = () => {
    trackCTAClick("view_all_listings", "footer_nav");

    if (location.pathname === "/") {
      document.getElementById("listings")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    navigate("/?scroll=listings");
  };

  return (
    <footer className="bg-secondary py-16 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <Link to="/" className="font-serif text-2xl font-semibold text-foreground tracking-tight">
              하우스인어스
            </Link>
            <p className="mt-4 text-muted-foreground max-w-md leading-relaxed">
              집은 단순한 공간이 아닙니다. 삶의 가장 소중한 순간들이 펼쳐지는 무대입니다.
              하우스인어스는 단순히 살 곳을 찾는 것을 넘어, 자신이 꿈꾸는 생활에 어울리는 집을 더 잘 이해하고
              상상할 수 있도록 집의 이야기와 생활 정보를 콘텐츠로 정리해 전합니다.
            </p>
            <p className="mt-4 text-xs text-muted-foreground/70 leading-relaxed font-sans">
              하우스인어스는 파레토랩(paretolab.kr)이 운영하는 경기도 단독주택 전문 큐레이션 플랫폼입니다.
            </p>
          </div>
          <div>
            <h4 className="editorial-subheading mb-4">탐색</h4>
            <ul className="space-y-3">
              <li>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-primary transition-colors"
                  onClick={handleViewListings}
                >
                  매물 보기
                </button>
              </li>
              <li>
                <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
                  오픈하우스
                </Link>
              </li>
              <li>
                <Link 
                  to="/" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => trackCTAClick("loan_info", "footer_nav")}
                >
                  대출 안내
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="editorial-subheading mb-4">연결</h4>
            <ul className="space-y-3">
              <li>
                <a href="https://www.instagram.com/houseinus_official?igsh=MWpzZ3VndWtybXJtOA==" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  인스타그램
                </a>
              </li>
              <li>
                <a href="https://pf.kakao.com/_xbpFKX/friend" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  카카오톡
                </a>
              </li>
              <li>
                <a 
                  href="mailto:contact@paretolab.kr" 
                  className="text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => trackCTAClick("contact_email", "footer_nav")}
                >
                  문의하기
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} 하우스인어스. 파레토랩. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              이용약관
            </Link>
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              개인정보처리방침
            </Link>
            <p className="text-sm text-muted-foreground">
              특별한 삶을 위해 정성껏 큐레이션합니다.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
