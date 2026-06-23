import { motion, type Variants, type Easing } from "framer-motion";
import { Link } from "react-router-dom";
import { MapPin, Clock, Mail, ArrowRight, Users, Handshake, Sparkles, Sofa, BookOpen, BarChart3, type LucideIcon } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PortfolioRequestButton from "@/components/PortfolioRequestButton";
import NaverMapView from "@/components/NaverMapView";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import heroImage from "@/assets/About_Hero.png";
import gardenImage from "@/assets/lifestyle-garden.jpg";
import sunsetImage from "@/assets/lifestyle-sunset.jpg";
import backyardImage from "@/assets/lifestyle-backyard-wine.jpg";
import recruitImage from "@/assets/About_Recruit.jpeg";
import yardImage from "@/assets/lifestyle-yard-play.jpg";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.13, ease: "easeOut" },
  }),
};

const whatWeDo: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Sparkles,
    title: "집의 매력을 더 선명하게",
    desc: "좋은 집이 가진 강점을 더 잘 보이도록 정리합니다.",
  },
  {
    icon: Sofa,
    title: "집에서의 미래를 상상할 수 있게",
    desc: "그 공간에서의 하루가 자연스럽게 그려지도록 생활의 언어로 풀어냅니다.",
  },
  {
    icon: BookOpen,
    title: "누구나 더 쉽게 이해할 수 있게",
    desc: "처음 주택을 고민하는 사람도 꼭 필요한 포인트를 꼼꼼하게 확인할 수 있도록 돕습니다.",
  },
  {
    icon: BarChart3,
    title: "데이터를 기반으로",
    desc: "탄탄한 정보와 지표를 바탕으로 집을 더 깊고 입체적으로 이해할 수 있게 합니다.",
  },
];

const AboutUs = () => {
  useDocumentTitle("회사 소개 | 하우스인어스");
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative h-[90vh] min-h-[600px] overflow-hidden">
        <motion.div
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={heroImage}
            alt="아침 햇살이 스며드는 공간"
            className="w-full h-full object-cover -scale-x-100"
          />
          <div className="absolute inset-0 bg-stone-900/40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-900/70 via-stone-900/40 to-transparent" />
        </motion.div>

        <div className="relative h-full flex items-end pb-20 md:pb-32">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.5 }}
              className="max-w-2xl"
            >
              <span className="editorial-subheading text-primary-foreground/70 mb-4 block">
                ABOUT
              </span>
              <h1 className="font-serif text-4xl md:text-6xl text-primary-foreground font-medium leading-tight mb-6 break-keep">
                집을, 더 마음 가게 보여주는 방법
              </h1>
              <div className="text-primary-foreground/80 text-base md:text-lg font-light leading-relaxed max-w-2xl space-y-5 break-keep">
                <p>
                  하우스인어스는 주택의 매력과 분위기, 그리고 그 안에서 펼쳐질 생활을 보여주고 싶었습니다.
                </p>
                <p>
                  어떤 집은 가격만으로는 설명되지 않습니다.<br />
                  햇빛이 머무는 시간, 마당의 쓰임, 창밖의 초록, 가족이 함께 있는 장면까지.
                </p>
                <p>
                  하우스인어스는 집을 단순한 매물이 아니라, 누군가의 취향과 생활이 담길 공간으로 소개합니다.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── MISSION ──────────────────────────────────────────── */}
      <section className="py-24 md:py-36 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              <span className="editorial-subheading text-primary mb-5 block">
                MISSION
              </span>
              <h2 className="font-serif text-4xl md:text-5xl font-medium text-foreground leading-tight mb-8 break-keep">
                좋은 집의 매력이<br />더 잘 전해지도록
              </h2>
              <div className="w-12 h-0.5 bg-primary mb-8" />
              <div className="text-muted-foreground leading-relaxed text-[15px] space-y-5 break-keep">
                <p>
                  하우스인어스는 집을 보는 기준이 조금 더 섬세해지기를 바랍니다.<br />
                  크기와 가격만이 아니라, 그 공간이 주는 분위기와 생활의 가능성까지 함께 느껴질 수 있도록 말입니다.
                </p>
                <p>
                  우리는 한 채의 집이 가진 매력을 더 또렷하게 보여주고,<br />
                  누군가에게는 막연했던 주거의 상상을 더 구체적으로 그려볼 수 있게 돕습니다.
                </p>
                <p>
                  집을 고르는 일이 조금 더 설레고, 조금 더 선명해지도록.<br />
                  그것이 하우스인어스가 하고 싶은 일입니다.
                </p>
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={1}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="grid grid-cols-2 gap-3 h-[480px]"
            >
              <div className="relative overflow-hidden rounded-sm row-span-2">
                <img src={gardenImage} alt="텃밭" className="w-full h-full object-cover" />
              </div>
              <div className="relative overflow-hidden rounded-sm">
                <img src={sunsetImage} alt="일출" className="w-full h-full object-cover" />
              </div>
              <div className="relative overflow-hidden rounded-sm">
                <img src={backyardImage} alt="마당" className="w-full h-full object-cover" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE DO ───────────────────────────────────────── */}
      <section className="py-24 bg-secondary/50">
        <div className="container mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="text-center max-w-xl mx-auto mb-16"
          >
            <span className="editorial-subheading text-primary mb-5 block">
              WHAT WE DO
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-medium text-foreground leading-tight">
              하우스인어스가 하는 일
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {whatWeDo.map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i * 0.5}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                className="bg-background rounded-sm p-7 border border-border group hover:-translate-y-1 transition-all duration-300"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-serif text-lg font-medium text-foreground mb-3 leading-snug">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-[13px] leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RECRUIT — full-width with image ──────────────────── */}
      <section className="relative overflow-hidden">
        <div className="grid md:grid-cols-2 min-h-[600px]">
          {/* Image side */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="relative h-[360px] md:h-full"
          >
            <img src={recruitImage} alt="채용" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-foreground/10 md:block hidden" />
          </motion.div>

          {/* Text side */}
          <div className="flex items-center bg-background">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="px-8 md:px-16 py-16 md:py-24 max-w-xl"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <span className="editorial-subheading text-primary mb-4 block">
                RECRUIT
              </span>
              <h2 className="font-serif text-3xl md:text-4xl font-medium text-foreground leading-tight mb-6 break-keep">
                하우스인어스와<br />함께할 동료를 찾습니다
              </h2>
              <div className="text-muted-foreground leading-relaxed text-[15px] space-y-4 mb-8 break-keep">
                <p>
                  하우스인어스는 파레토랩에서 만들고 있는 서비스입니다.
                </p>
                <p>
                  <span className="inline-block">좋은 제품을 만드는 개발자,</span>{" "}
                  <span className="inline-block">브랜드의 결을 만드는 크리에이티브 디렉터,</span>{" "}
                  <span className="inline-block">사람들에게 자연스럽게 닿게 만드는 마케터,</span>{" "}
                  <span className="inline-block">그 외에도 다양한 방식으로 함께할 분들을 기다리고 있습니다.</span>
                </p>
              </div>
              <a
                href="mailto:recruit@paretolab.kr"
                className="inline-flex items-center gap-2 bg-foreground text-background px-7 py-3.5 rounded-sm text-sm font-medium hover:bg-foreground/90 transition-colors"
              >
                연락하기 <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── JOIN US — centered, dark ─────────────────────────── */}
      <section className="py-24 md:py-32 bg-foreground text-primary-foreground overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none">
          <span className="font-serif text-[22rem] text-primary-foreground absolute -bottom-20 -right-10 leading-none select-none">
            집
          </span>
        </div>

        <div className="container mx-auto px-6 relative">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center mb-6 mx-auto">
              <Handshake className="w-5 h-5 text-primary-foreground/70" />
            </div>
            <span className="editorial-subheading text-primary-foreground/50 mb-4 block">
              JOIN US
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-medium leading-tight mb-6 break-keep">
              함께 만들어갈<br />이야기가 있으신가요?
            </h2>
            <div className="w-12 h-0.5 bg-primary mx-auto mb-8" />
            
            <p className="text-primary-foreground/70 leading-relaxed mb-10 text-[15px] max-w-2xl mx-auto">
              <span className="inline-block">하우스인어스는 집의 매력을 더 잘 전하고 싶은 매도자,</span>{" "}
              <span className="inline-block">좋은 집을 더 깊이 이해하고 싶은 매수자,</span>{" "}
              <span className="inline-block">그리고 더 나은 주거 탐색 경험에 공감하는 중개사와 파트너를 언제나 환영합니다.</span>
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                to="/"
                onClick={() => window.scrollTo(0, 0)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 rounded-sm text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                매물 보러가기
              </Link>
              <PortfolioRequestButton customTrigger={
                <button className="inline-flex items-center gap-2 border border-primary-foreground/30 text-primary-foreground/80 px-7 py-3.5 rounded-sm text-sm font-medium hover:border-primary-foreground/60 hover:text-primary-foreground transition-colors">
                  포트폴리오 의뢰하기
                </button>
              } />
              <a
                href="mailto:business@paretolab.kr"
                className="inline-flex items-center gap-2 border border-primary-foreground/30 text-primary-foreground/80 px-7 py-3.5 rounded-sm text-sm font-medium hover:border-primary-foreground/60 hover:text-primary-foreground transition-colors"
              >
                파트너 문의하기 <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── VISIT US — grid with map ─────────────────────────── */}
      <section className="py-16 md:py-20 bg-secondary/30">
        <div className="container mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="grid md:grid-cols-2 gap-10 items-start">
              {/* Info */}
              <div>
                <span className="editorial-subheading text-primary mb-4 block">
                  VISIT US
                </span>
                <h2 className="font-serif text-2xl md:text-3xl font-medium text-foreground leading-tight mb-8">
                  찾아오시는 길
                </h2>

                <div className="space-y-6 text-[15px] text-muted-foreground">
                  <div className="flex items-start gap-4">
                    <MapPin className="w-[1.125rem] h-[1.125rem] text-primary shrink-0 mt-1" strokeWidth={2} />
                    <div className="leading-relaxed break-keep">
                      <p>경기도 용인시 기흥구 동백중앙로 245 (동백문월드) 215호</p>
                      <p className="mt-1 text-[13px] text-primary font-medium">
                        용인시산업진흥원 입주 기업{" "}
                        <a
                          href="https://ypa.or.kr/promotion/live_company/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors ml-1 font-normal"
                        >
                          소개 보러가기
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Clock className="w-[1.125rem] h-[1.125rem] text-primary shrink-0" strokeWidth={2} />
                    <p>평일 09:00 – 18:00 · 주말 예약 상담</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Mail className="w-[1.125rem] h-[1.125rem] text-primary shrink-0" strokeWidth={2} />
                    <a href="mailto:business@paretolab.kr" className="hover:text-primary transition-colors">
                      business@paretolab.kr
                    </a>
                  </div>
                </div>
              </div>

              {/* Map */}
              <div className="w-full h-[280px] md:h-[320px] rounded-sm overflow-hidden border border-border">
                <NaverMapView className="w-full h-full" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutUs;