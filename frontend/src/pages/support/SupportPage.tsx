import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone,
  Mail,
  Clock,
  MapPin,
  Check,
  Copy,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Truck,
  ShieldCheck,
  Wrench,
  Fuel,
  FileSpreadsheet,
  Calculator,
  Receipt,
  Headphones,
  HelpCircle,
  MessageSquare,
  Sparkles,
  Send,
  Building2,
  CheckCircle2,
  LogIn,
} from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const SUPPORT_PHONE_RAW = '+840924462355';
const SUPPORT_PHONE_DISPLAY = '+84 0924 462 355';
const SUPPORT_EMAIL = 'nguyenphuchung09@gmail.com';

const CORE_MODULES = [
  {
    icon: Truck,
    title: 'Điều hành & Lịch đi hàng',
    badge: 'Dispatch & Operations',
    description:
      'Quản lý điều phối xe thông minh, lập kế hoạch lịch đi hàng kết nối 5 cụm nhà máy (CLF, VFM, MCC, CLV, NDFC) và điểm giao nhận toàn quốc.',
    highlights: ['Lập lịch chuyến tự động', 'Theo dõi trạng thái giao hàng', 'Phân công tài xế & đầu xe tối ưu'],
  },
  {
    icon: Wrench,
    title: 'Quản lý Đội xe & Bảo dưỡng',
    badge: 'Fleet & Maintenance',
    description:
      'Theo dõi toàn diện hồ sơ phương tiện, lịch trình bảo dưỡng định kỳ, kiểm soát hạn đăng kiểm, bảo hiểm và lịch sử sửa chữa chi tiết.',
    highlights: ['Nhắc hạn đăng kiểm & bảo hiểm', 'Cảnh báo định kỳ thay nhớt', 'Nhật ký chi phí sửa chữa'],
  },
  {
    icon: Fuel,
    title: 'Quản lý Nhiên liệu & Tiêu hao',
    badge: 'Fuel Management',
    description:
      'Giám sát định mức tiêu thụ dầu theo từng dòng xe và cung đường thực tế, phân tích dữ liệu nhập cây xăng và phát hiện bất thường.',
    highlights: ['Định mức tiêu hao theo cung đường', 'Thống kê tiêu thụ theo đầu xe', 'Biểu đồ phân tích trực quan'],
  },
  {
    icon: Calculator,
    title: 'Bảng giá Tuyến đường & Phụ phí',
    badge: 'Route Pricing & Matrix',
    description:
      'Hệ thống quản lý ma trận giá cước đa chiều, bảng giá theo thời kỳ linh hoạt và tự động áp dụng các loại phụ phí khách hàng.',
    highlights: ['Ma trận giá theo tải trọng & cự ly', 'Bộ giá linh hoạt theo thời kỳ', 'Quản lý phụ phí khách hàng'],
  },
  {
    icon: FileSpreadsheet,
    title: 'Đối soát & Kế toán Vận tải',
    badge: 'Accounting & Reconciliation',
    description:
      'Tự động hóa đối soát chuyến đi, xử lý chênh lệch tải trọng cân hàng, lập bảng kê thợ và quản lý hóa đơn vận chuyển chính xác.',
    highlights: ['Khớp dữ liệu chuyến hàng tự động', 'Xử lý chênh lệch cân hàng', 'Bảng kê thanh toán công nợ'],
  },
  {
    icon: Receipt,
    title: 'Chứng từ Điện tử & Tra cứu Nhanh',
    badge: 'e-Tickets & Tracking',
    description:
      'Cung cấp liên kết tra cứu chứng từ vận chuyển công khai và an toàn cho khách hàng, hỗ trợ xem và tải chứng từ mọi lúc mọi nơi.',
    highlights: ['Tra cứu không cần đăng nhập', 'Tải trọn bộ chứng từ chuyến hàng', 'Mã hóa an toàn bảo mật cao'],
  },
];

const FAQS = [
  {
    question: 'Làm thế nào để tôi có thể đăng ký tài khoản sử dụng hệ thống?',
    answer:
      'Hệ thống PhuPhatCorp phục vụ cho cán bộ điều hành, kế toán, tài xế và đối tác của công ty. Bạn có thể bấm nút "Đăng ký" trên giao diện hoặc liên hệ trực tiếp qua số hotline +84 924 462 355 / email nguyenphuchung09@gmail.com để quản trị viên phê duyệt quyền truy cập phù hợp.',
  },
  {
    question: 'Khách hàng hoặc tài xế có thể xem chứng từ chuyến đi mà không cần tài khoản không?',
    answer:
      'Có. PhuPhatCorp hỗ trợ tính năng chia sẻ chứng từ điện tử qua liên kết an toàn (Public Ticket). Đối tác chỉ cần mở liên kết được cung cấp là có thể xem chi tiết hành trình và tải toàn bộ ảnh chụp chứng từ mà không cần đăng nhập.',
  },
  {
    question: 'Khi gặp sự cố phát sinh ngoài giờ làm việc, tôi cần liên hệ kênh nào?',
    answer:
      'Tổng đài hotline kỹ thuật +84 924 462 355 hoạt động 24/7 đối với các trường hợp khẩn cấp về điều phối xe trên đường, sự cố giao nhận hàng hóa hoặc lỗi gián đoạn truy cập hệ thống.',
  },
  {
    question: 'Hệ thống có hỗ trợ tùy chỉnh bảng giá cước và phụ phí cho từng khách hàng không?',
    answer:
      'Có. Phân hệ Bảng giá tuyến đường (Route Pricing) cho phép cấu hình chi tiết ma trận cước, bộ giá theo từng chu kỳ và các chính sách phụ phí riêng biệt cho từng khách hàng hoặc tuyến vận chuyển.',
  },
];

export function SupportPage() {
  const [copiedType, setCopiedType] = useState<'phone' | 'email' | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Quick form state
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    category: 'general',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleCopy = (text: string, type: 'phone' | 'email') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contact || !formData.message) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      // Trigger mailto as secondary action
      const subject = encodeURIComponent(`[Hỗ trợ PhuPhatCorp] Yêu cầu từ ${formData.name} - ${formData.category}`);
      const body = encodeURIComponent(
        `Họ tên: ${formData.name}\nLiên hệ: ${formData.contact}\nDanh mục: ${formData.category}\n\nNội dung:\n${formData.message}`,
      );
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    }, 600);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 selection:bg-neutral-900 selection:text-white dark:selection:bg-neutral-100 dark:selection:text-neutral-900">
      {/* Top sticky navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-neutral-900 dark:bg-neutral-100 rounded-xl flex items-center justify-center text-white dark:text-neutral-900 shadow-sm transition-transform group-hover:scale-105">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg sm:text-xl tracking-tight block leading-tight">PhuPhatCorp</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 block leading-tight font-medium">
                Vận Tải & Logistics
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600 dark:text-neutral-400">
            <a href="#features" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
              Tính năng
            </a>
            <a href="#contact" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
              Liên hệ
            </a>
            <a href="#faq" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
              Hỏi đáp
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="h-9 w-9 rounded-lg" />
            <a
              href={`tel:${SUPPORT_PHONE_RAW}`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{SUPPORT_PHONE_DISPLAY}</span>
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all shadow-xs"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-b from-white via-neutral-50 to-neutral-100/60 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-950">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-neutral-300/40 via-neutral-200/20 to-transparent dark:from-neutral-700/30 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-neutral-200/70 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 mb-6 border border-neutral-300/60 dark:border-neutral-700/60 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Trung tâm Hỗ trợ & Vận hành Kỹ thuật 24/7</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 max-w-4xl mx-auto leading-[1.15]">
            Hệ thống Quản lý Vận tải Toàn diện{' '}
            <span className="bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-500 dark:from-neutral-100 dark:via-neutral-300 dark:to-neutral-500 bg-clip-text text-transparent">
              PhuPhatCorp
            </span>
          </h1>

          <p className="mt-5 sm:mt-6 text-base sm:text-lg lg:text-xl text-neutral-600 dark:text-neutral-300 max-w-3xl mx-auto font-normal leading-relaxed">
            Nền tảng số hóa tối ưu hóa chuỗi vận tải: điều phối xe thông minh, quản lý đội xe và bảo dưỡng, kiểm soát
            nhiên liệu, tự động đối soát chuyến hàng và minh bạch chứng từ vận chuyển.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all shadow-md hover:shadow-lg"
            >
              <Headphones className="w-4 h-4" />
              <span>Liên hệ hỗ trợ ngay</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-semibold text-sm border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-all shadow-xs"
            >
              <LogIn className="w-4 h-4" />
              <span>Truy cập hệ thống</span>
            </Link>
          </div>

          {/* Key Metrics / Highlights Bar */}
          <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-xs shadow-2xs">
              <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">5+ Nhà máy</div>
              <div className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                CLF, VFM, MCC, CLV, NDFC
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-xs shadow-2xs">
              <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">100%</div>
              <div className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                Chứng từ số hóa & Tra cứu
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-xs shadow-2xs">
              <div className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100">24/7</div>
              <div className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                Hỗ trợ kỹ thuật & Điều phối
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 backdrop-blur-xs shadow-2xs">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">99.9%</div>
              <div className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                Hệ thống hoạt động ổn định
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Contact Channels Section */}
      <section id="contact" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            <Headphones className="w-4 h-4 text-emerald-500" />
            <span>Thông tin liên hệ trực tiếp</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Chúng tôi luôn sẵn sàng hỗ trợ bạn
          </h2>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
            Nếu bạn cần hỗ trợ về tài khoản, kỹ thuật, đối soát cước phí hoặc điều hành chuyến hàng, vui lòng liên hệ qua
            các kênh chính thức dưới đây.
          </p>
        </div>

        {/* 3 Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Card 1: Phone Hotline */}
          <div className="relative group p-6 sm:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                  Hotline & Zalo
                </span>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">Tổng đài Hỗ trợ</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                  Tiếp nhận các sự cố khẩn cấp về điều phối xe, tài xế trên đường và lỗi truy cập hệ thống 24/7.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between">
                <span className="font-mono font-bold text-base sm:text-lg text-neutral-900 dark:text-neutral-100">
                  {SUPPORT_PHONE_DISPLAY}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(SUPPORT_PHONE_DISPLAY, 'phone')}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  title="Sao chép số điện thoại"
                >
                  {copiedType === 'phone' ? (
                    <span className="flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 gap-1">
                      <Check className="w-4 h-4" /> Đã chép
                    </span>
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <a
                href={`tel:${SUPPORT_PHONE_RAW}`}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-xs"
              >
                <Phone className="w-4 h-4" />
                <span>Gọi ngay (+84) 0924 462 355</span>
              </a>
            </div>
          </div>

          {/* Card 2: Email */}
          <div className="relative group p-6 sm:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase text-sky-600 dark:text-sky-400 tracking-wider">
                  Hòm thư điện tử
                </span>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">Email Kỹ thuật & Nghiệp vụ</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                  Gửi yêu cầu tài khoản, xuất báo cáo đối soát công nợ, kiến nghị tính năng hoặc gửi tài liệu đối soát.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex items-center justify-between">
                <span className="font-mono text-xs sm:text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate mr-2">
                  {SUPPORT_EMAIL}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(SUPPORT_EMAIL, 'email')}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex-shrink-0"
                  title="Sao chép email"
                >
                  {copiedType === 'email' ? (
                    <span className="flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 gap-1">
                      <Check className="w-4 h-4" /> Đã chép
                    </span>
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors shadow-xs"
              >
                <Mail className="w-4 h-4" />
                <span>Gửi Email hỗ trợ</span>
              </a>
            </div>
          </div>

          {/* Card 3: Working hours & Operations */}
          <div className="relative group p-6 sm:p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                  Thời gian làm việc
                </span>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">Khung giờ tiếp nhận</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                  Đội ngũ hỗ trợ nghiệp vụ & kế toán trực xử lý trong giờ hành chính; hotline kỹ thuật xử lý 24/7.
                </p>
              </div>

              <div className="space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
                <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="font-medium">Thứ Hai - Thứ Bảy:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">07:30 - 18:00</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="font-medium">Chủ Nhật & Ngày lễ:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Trực Hotline 24/7</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="font-medium">Thời gian phản hồi:</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">Dưới 15 phút</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <div className="inline-flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <MapPin className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <span>Phục vụ toàn hệ thống kho vận & nhà máy PhuPhatCorp</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick message / feedback form box */}
        <div className="rounded-3xl bg-neutral-900 text-white p-6 sm:p-10 lg:p-12 relative overflow-hidden shadow-xl">
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-12 translate-y-12">
            <Truck className="w-96 h-96" />
          </div>

          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-semibold mb-4 border border-neutral-700">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gửi yêu cầu hỗ trợ nhanh</span>
            </div>
            <h3 className="text-xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Bạn có câu hỏi hoặc cần giải đáp nghiệp vụ?
            </h3>
            <p className="text-sm sm:text-base text-neutral-300 mb-6">
              Điền thông tin bên dưới để gửi tin nhắn trực tiếp đến ban quản trị kỹ thuật qua email{' '}
              <span className="font-semibold text-white underline">{SUPPORT_EMAIL}</span>.
            </p>

            {submitted ? (
              <div className="p-6 rounded-2xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-base text-white">Yêu cầu đã được khởi tạo thành công!</h4>
                  <p className="text-sm text-emerald-300">
                    Ứng dụng email của bạn đã được mở để gửi tin nhắn đến <strong>{SUPPORT_EMAIL}</strong>. Ban hỗ trợ sẽ
                    phản hồi lại bạn trong thời gian sớm nhất.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: '', contact: '', category: 'general', message: '' });
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white underline hover:text-emerald-300"
                  >
                    Gửi yêu cầu khác
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Họ và tên <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-white placeholder-neutral-500 text-sm focus:outline-hidden focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      Email hoặc Số điện thoại <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="email@example.com hoặc 090..."
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-white placeholder-neutral-500 text-sm focus:outline-hidden focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Phân hệ cần hỗ trợ</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-white text-sm focus:outline-hidden focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                  >
                    <option value="general">Hỗ trợ chung & Giải đáp thông tin</option>
                    <option value="dispatch">Điều hành vận tải & Lịch chuyến (5 nhà máy)</option>
                    <option value="fleet">Đội xe, Đăng kiểm, Thay nhớt & Bảo dưỡng</option>
                    <option value="accounting">Kế toán, Đối soát cước & Bảng kê thợ</option>
                    <option value="pricing">Biểu giá cước tuyến đường & Phụ phí</option>
                    <option value="account">Cấp tài khoản & Quản lý phân quyền</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Nội dung yêu cầu <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Mô tả cụ thể vấn đề hoặc thông tin bạn cần ban hỗ trợ xử lý..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/90 border border-neutral-700 text-white placeholder-neutral-500 text-sm focus:outline-hidden focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-neutral-900 font-bold text-sm hover:bg-neutral-200 transition-all shadow-md disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu hỗ trợ'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Application Overview & Core Modules Section */}
      <section id="features" className="py-16 sm:py-24 bg-white dark:bg-neutral-900/60 border-y border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
              <Building2 className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
              <span>Tổng quan giải pháp PhuPhatCorp TMS</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Các phân hệ nghiệp vụ chính của ứng dụng
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
              Được thiết kế chuyên biệt cho ngành vận tải hàng rời, lúa gạo và logistics công nghiệp với quy trình khép
              kín từ điều phối xe đến quyết toán tài chính.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {CORE_MODULES.map((module, idx) => {
              const Icon = module.icon;
              return (
                <div
                  key={idx}
                  className="p-6 sm:p-7 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between group shadow-2xs hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono">
                        {module.badge}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">{module.title}</h3>
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
                      {module.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-neutral-200/60 dark:border-neutral-800 space-y-1.5">
                    {module.highlights.map((item, hIdx) => (
                      <div key={hIdx} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security & Workflow Section */}
      <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>An toàn & Phân quyền đa tầng</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-tight">
              Bảo mật dữ liệu & Kiểm soát phân quyền chuẩn doanh nghiệp
            </h2>
            <p className="mt-4 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Hệ thống xây dựng trên cơ chế kiểm soát truy cập dựa trên vai trò (Role-Based Access Control) kết hợp phạm vi
              dữ liệu (Data Scope), đảm bảo mỗi nhân sự chỉ thao tác đúng phần việc được giao.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex gap-4 p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 flex-shrink-0 font-bold text-xs">
                  01
                </div>
                <div>
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                    Phạm vi dữ liệu theo Nhà máy & Tuyến xe
                  </h4>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Cho phép phân tách quyền truy xuất số liệu giữa các đơn vị thành viên CLF, VFM, MCC, CLV, NDFC.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 flex-shrink-0 font-bold text-xs">
                  02
                </div>
                <div>
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                    Nhật ký kiểm toán (Audit Trail) minh bạch
                  </h4>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Ghi nhận đầy đủ mọi thao tác tạo mới, cập nhật, điều chỉnh cước và xóa dữ liệu phục vụ đối soát.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200 flex-shrink-0 font-bold text-xs">
                  03
                </div>
                <div>
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                    Quy trình phê duyệt (Workflow Approval)
                  </h4>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Tùy biến các bước duyệt phiếu sửa chữa xe, duyệt chênh lệch tải trọng và duyệt bảng giá theo phân cấp.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white shadow-xl relative overflow-hidden">
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-emerald-400">
                <Headphones className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold">Cần hỗ trợ kỹ thuật hoặc cấp quyền?</h3>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Đội ngũ kỹ sư phần mềm và chuyên viên vận hành luôn túc trực để hỗ trợ cấu hình tài khoản, phân quyền và
                xử lý mọi vướng mắc trong quá trình sử dụng.
              </p>

              <div className="p-4 rounded-2xl bg-neutral-800/80 border border-neutral-700 space-y-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-neutral-400">Hotline hỗ trợ:</span>
                  <a href={`tel:${SUPPORT_PHONE_RAW}`} className="font-mono font-bold text-white hover:underline">
                    {SUPPORT_PHONE_DISPLAY}
                  </a>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-neutral-400">Hòm thư quản trị:</span>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-mono font-medium text-white hover:underline truncate ml-2">
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-white text-neutral-900 font-bold text-sm hover:bg-neutral-100 transition-colors shadow-md"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập vào bảng điều khiển</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 sm:py-24 bg-white dark:bg-neutral-900/60 border-t border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
              <HelpCircle className="w-4 h-4 text-amber-500" />
              <span>Giải đáp thắc mắc</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Câu hỏi thường gặp (FAQ)
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
              Một số thông tin hữu ích giúp bạn hiểu rõ hơn về cách vận hành và hỗ trợ của PhuPhatCorp.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4.5 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-neutral-900 dark:text-neutral-100 hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    <span>{faq.question}</span>
                    <span className="p-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 flex-shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed border-t border-neutral-200/60 dark:border-neutral-800 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-neutral-900 dark:bg-neutral-100 rounded-xl flex items-center justify-center text-white dark:text-neutral-900 shadow-xs">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight block text-neutral-900 dark:text-neutral-100">
                  PhuPhatCorp
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 block">
                  Hệ thống Quản lý Vận tải & Logistics Doanh nghiệp
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              <Link to="/login" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                Đăng nhập
              </Link>
              <Link to="/register" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                Đăng ký tài khoản
              </Link>
              <a href="#features" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                Mô tả phân hệ
              </a>
              <a href="#contact" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                Thông tin liên hệ
              </a>
              <Link to="/privacy" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                Chính sách Quyền riêng tư
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-500">
            <div>
              © {new Date().getFullYear()} PhuPhatCorp. All rights reserved. Hỗ trợ kỹ thuật:{' '}
              <a href={`tel:${SUPPORT_PHONE_RAW}`} className="font-semibold text-neutral-700 dark:text-neutral-300 hover:underline">
                {SUPPORT_PHONE_DISPLAY}
              </a>{' '}
              |{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-neutral-700 dark:text-neutral-300 hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span>Hệ thống TMS Doanh nghiệp</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default SupportPage;
