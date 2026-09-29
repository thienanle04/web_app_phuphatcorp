import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  UserCheck,
  Server,
  Phone,
  Mail,
  ArrowLeft,
  ChevronRight,
  Calculator,
  LogIn,
  CheckCircle2,
  Clock,
  Database,
  Smartphone,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const SUPPORT_PHONE_RAW = '+84924462355';
const SUPPORT_PHONE_DISPLAY = '+84 924 462 355';
const SUPPORT_EMAIL = 'nguyenphuchung09@gmail.com';

const SECTIONS = [
  { id: 'introduction', title: '1. Giới thiệu & Phạm vi áp dụng', icon: ShieldCheck },
  { id: 'data-collection', title: '2. Thông tin chúng tôi thu thập', icon: Database },
  { id: 'data-usage', title: '3. Mục đích sử dụng dữ liệu', icon: Eye },
  { id: 'data-sharing', title: '4. Chia sẻ & Bảo mật thông tin', icon: Lock },
  { id: 'data-retention', title: '5. Thời gian lưu trữ dữ liệu', icon: Clock },
  { id: 'user-rights', title: '6. Quyền của người dùng', icon: UserCheck },
  { id: 'device-permissions', title: '7. Quyền truy cập thiết bị & Di động', icon: Smartphone },
  { id: 'contact', title: '8. Đơn vị phụ trách & Liên hệ', icon: Mail },
];

export function PrivacyPolicyPage() {
  const [copiedType, setCopiedType] = useState<'phone' | 'email' | null>(null);
  const [activeSection, setActiveSection] = useState('introduction');

  const handleCopy = (text: string, type: 'phone' | 'email') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -90;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 selection:bg-neutral-900 selection:text-white dark:selection:bg-neutral-100 dark:selection:text-neutral-900">
      {/* Sticky Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-neutral-900/85 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/support"
              className="p-2 -ml-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Quay lại trang Hỗ trợ"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-neutral-900 dark:bg-neutral-100 rounded-xl flex items-center justify-center text-white dark:text-neutral-900 shadow-xs transition-transform group-hover:scale-105">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-base sm:text-lg tracking-tight block leading-tight">PhuPhatCorp</span>
                <span className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 block leading-tight font-medium">
                  Chính Sách Quyền Riêng Tư
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/support"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Trung tâm hỗ trợ</span>
            </Link>
            <ThemeToggle className="h-9 w-9 rounded-lg" />
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

      {/* Hero Header */}
      <section className="relative overflow-hidden pt-12 pb-12 sm:pt-16 sm:pb-16 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-b from-white via-neutral-50 to-neutral-100/60 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 mb-4 border border-emerald-200 dark:border-emerald-800/80">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Cam kết bảo vệ dữ liệu cá nhân & vận hành</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 leading-tight">
            Chính Sách Bảo Mật & Quyền Riêng Tư
          </h1>
          <p className="mt-4 text-sm sm:text-base text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto">
            Hệ thống Quản lý Vận tải & Logistics PhuPhatCorp (TMS) tuân thủ các quy định bảo vệ dữ liệu cá nhân, đảm bảo
            tính an toàn, minh bạch và chính xác trong mọi hoạt động điều hành và đối soát.
          </p>

          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Hiệu lực từ: <strong>24/09/2026</strong></span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-neutral-400" />
              <span>Phiên bản: <strong>2.0 (TMS Multi-Factory)</strong></span>
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Table of Contents - Desktop Sticky Sidebar */}
          <aside className="hidden lg:block lg:col-span-4">
            <div className="sticky top-24 p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-3">
                Mục lục chính sách
              </h3>
              <nav className="space-y-1">
                {SECTIONS.map((sec) => {
                  const Icon = sec.icon;
                  const isCurrent = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all ${
                        isCurrent
                          ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{sec.title}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 px-3">
                  Cần giải đáp về quyền dữ liệu?
                </div>
                <a
                  href={`tel:${SUPPORT_PHONE_RAW}`}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Hotline: {SUPPORT_PHONE_DISPLAY}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                </a>
              </div>
            </div>
          </aside>

          {/* Detailed Policy Sections */}
          <article className="lg:col-span-8 space-y-12">
            {/* Section 1 */}
            <section id="introduction" className="scroll-mt-24 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Mục 1</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                1. Giới thiệu & Phạm vi áp dụng
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Chính sách Quyền riêng tư này giải thích cách <strong>PhuPhatCorp</strong> (&quot;chúng tôi&quot;, &quot;PhuPhatCorp TMS&quot;)
                thu thập, lưu trữ, sử dụng và bảo vệ thông tin khi bạn truy cập trang web, sử dụng ứng dụng di động hoặc
                tham gia vào quy trình điều phối vận tải, giao nhận hàng hóa và đối soát kế toán của chúng tôi.
              </p>
              <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 text-xs sm:text-sm text-emerald-900 dark:text-emerald-300 leading-relaxed">
                <strong>Cam kết cốt lõi:</strong> Chúng tôi chỉ thu thập các thông tin tối thiểu cần thiết để vận hành quy
                trình điều phối vận tải và đối soát chứng từ. Chúng tôi cam kết tuyệt đối không bán hoặc trao đổi dữ liệu cá
                nhân của người dùng cho bất kỳ bên quảng cáo thứ ba nào.
              </div>
            </section>

            {/* Section 2 */}
            <section id="data-collection" className="scroll-mt-24 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                <Database className="w-3.5 h-3.5 text-sky-500" />
                <span>Mục 2</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                2. Thông tin chúng tôi thu thập
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Để phục vụ việc vận hành hệ thống logistics giữa 5 cụm nhà máy (CLF, VFM, MCC, CLV, NDFC) và các đại lý giao
                hàng, chúng tôi có thể thu thập các danh mục thông tin sau:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    <span>Thông tin tài khoản & Nhân sự</span>
                  </h4>
                  <ul className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 space-y-1.5 list-disc list-inside">
                    <li>Họ và tên, địa chỉ email làm việc.</li>
                    <li>Số điện thoại liên lạc tài xế và điều phối viên.</li>
                    <li>Vai trò, chức danh và quyền hạn nội bộ (RBAC).</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-500" />
                    <span>Dữ liệu chuyến hàng & Chứng từ</span>
                  </h4>
                  <ul className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 space-y-1.5 list-disc list-inside">
                    <li>Biển số xe, chủng loại đầu kéo, tải trọng.</li>
                    <li>Lộ trình: Điểm nhận hàng, điểm giao hàng.</li>
                    <li>Phiếu cân điện tử, hình ảnh biên bản giao nhận.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <Server className="w-4 h-4 text-amber-500" />
                    <span>Dữ liệu đội xe & Bảo dưỡng</span>
                  </h4>
                  <ul className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 space-y-1.5 list-disc list-inside">
                    <li>Chỉ số đồng hồ ODO, nhật ký thay dầu nhớt.</li>
                    <li>Thời hạn đăng kiểm phương tiện & bảo hiểm xe.</li>
                    <li>Lịch sử sửa chữa, vật tư thay thế và định mức xăng dầu.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-500" />
                    <span>Nhật ký bảo mật (Audit Log)</span>
                  </h4>
                  <ul className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 space-y-1.5 list-disc list-inside">
                    <li>Địa chỉ IP truy cập, thiết bị và phiên làm việc.</li>
                    <li>Thời gian đăng nhập, thao tác sửa đổi dữ liệu.</li>
                    <li>Lịch sử phê duyệt quy trình (Workflow logs).</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="data-usage" className="scroll-mt-24 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                <Eye className="w-3.5 h-3.5 text-amber-500" />
                <span>Mục 3</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                3. Mục đích sử dụng dữ liệu
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Thông tin được thu thập chỉ phục vụ cho các mục đích vận hành kỹ thuật và nghiệp vụ hợp pháp sau:
              </p>
              <div className="space-y-2.5">
                {[
                  'Lập lịch, điều phối xe và gán chuyến tự động cho tài xế theo đúng tuyến đường và tải trọng hàng.',
                  'Giám sát an toàn kỹ thuật phương tiện: Nhắc lịch bảo dưỡng, chu kỳ thay nhớt và cảnh báo hạn đăng kiểm.',
                  'Tự động khớp dữ liệu chuyến, tính cước vận chuyển theo biểu giá và kiểm soát chênh lệch tải trọng cân.',
                  'Tạo mã tra cứu chứng từ điện tử (e-Ticket) công khai giúp đối tác xem phiếu cân và hóa đơn nhanh chóng.',
                  'Phục vụ công tác kiểm toán, đối soát kế toán và thực hiện nghĩa vụ theo quy định pháp luật vận tải.',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 4 */}
            <section id="data-sharing" className="scroll-mt-24 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                <Lock className="w-3.5 h-3.5 text-purple-500" />
                <span>Mục 4</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                4. Chia sẻ & Bảo mật thông tin
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Chúng tôi áp dụng các tiêu chuẩn an ninh thông tin nghiêm ngặt:
              </p>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 mb-1">
                    Cơ chế phân quyền đa tầng (RBAC & Data Scopes)
                  </h4>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                    Nhân sự từng phòng ban hoặc chi nhánh nhà máy chỉ được phép xem và xử lý các dữ liệu thuộc phạm vi phụ
                    trách, ngăn chặn nguy cơ rò rỉ thông tin nội bộ.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 mb-1">
                    Mã hóa đường truyền & Lưu trữ an toàn
                  </h4>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                    Mọi giao tiếp dữ liệu giữa trình duyệt, ứng dụng di động và máy chủ đều được mã hóa chuẩn HTTPS/TLS 1.3.
                    Ảnh chụp chứng từ được lưu trữ trên hạ tầng bảo mật với mã khóa truy cập giới hạn thời gian.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 mb-1">
                    Liên kết tra cứu công khai (Public e-Tickets)
                  </h4>
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                    Liên kết chia sẻ chứng từ cho khách hàng được tạo bằng mã bảo mật ngẫu nhiên (secure hash token). Khách
                    hàng chỉ xem được thông tin của chuyến hàng tương ứng, không thể truy cập dữ liệu chuyến khác.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section id="data-retention" className="scroll-mt-24 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Mục 5</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                5. Thời gian lưu trữ dữ liệu
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Dữ liệu vận tải, phiếu cân và chứng từ kế toán được lưu trữ theo chu kỳ hoạt động của doanh nghiệp và quy định
                về lưu trữ chứng từ vận chuyển, kế toán theo pháp luật Việt Nam. Khi dữ liệu hết thời hạn lưu trữ hoặc có yêu
                cầu thanh lý hợp lệ, hệ thống sẽ tiến hành xóa hoặc ẩn danh hóa an toàn.
              </p>
            </section>

            {/* Section 6 */}
            <section id="user-rights" className="scroll-mt-24 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                <UserCheck className="w-3.5 h-3.5 text-sky-500" />
                <span>Mục 6</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                6. Quyền của người dùng đối với dữ liệu
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Người dùng và nhân sự được cấp tài khoản trên hệ thống có đầy đủ các quyền sau:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs sm:text-sm">
                <div className="p-3.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <strong>• Quyền truy cập & Xem:</strong> Xem lại thông tin cá nhân và nhật ký thao tác đã thực hiện.
                </div>
                <div className="p-3.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <strong>• Quyền chỉnh sửa:</strong> Cập nhật thông tin liên hệ, đổi mật khẩu và cập nhật hồ sơ.
                </div>
                <div className="p-3.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <strong>• Quyền yêu cầu hỗ trợ:</strong> Đề nghị quản trị viên kiểm tra dữ liệu hoặc trích xuất báo cáo.
                </div>
                <div className="p-3.5 rounded-xl bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                  <strong>• Quyền khóa/Xóa tài khoản:</strong> Yêu cầu vô hiệu hóa tài khoản khi chấm dứt công tác.
                </div>
              </div>
            </section>

            {/* Section 7 */}
            <section id="device-permissions" className="scroll-mt-24 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                <span>Mục 7</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                7. Quyền truy cập thiết bị & Di động (Mobile / App Permissions)
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Khi sử dụng ứng dụng di động PhuPhatCorp Mobile (hoặc PWA), ứng dụng có thể yêu cầu một số quyền thiết bị
                nhằm phục vụ trực tiếp công tác giao nhận:
              </p>
              <div className="space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                <p>
                  <strong>• Quyền Máy ảnh & Thư viện ảnh (Camera & Photos):</strong> Cho phép tài xế chụp ảnh phiếu cân,
                  biên bản giao hàng và biên lai mua dầu để đính kèm lên chuyến đi.
                </p>
                <p>
                  <strong>• Quyền Thông báo (Push Notifications):</strong> Để gửi thông báo lịch chuyến mới, nhắc hạn đăng
                  kiểm và phê duyệt phiếu sửa chữa xe kịp thời.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section id="contact" className="scroll-mt-24 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                <Mail className="w-3.5 h-3.5 text-emerald-500" />
                <span>Mục 8</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                8. Đơn vị phụ trách & Thông tin liên hệ
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Nếu bạn có bất kỳ câu hỏi, thắc mắc hoặc khiếu nại nào liên quan đến Chính sách Bảo mật hoặc việc xử lý dữ
                liệu tại PhuPhatCorp, vui lòng liên hệ với Bộ phận Quản trị Dữ liệu qua các kênh chính thức:
              </p>

              <div className="p-6 rounded-2xl bg-neutral-900 text-white space-y-4 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white">Ban Quản trị Kỹ thuật PhuPhatCorp</h4>
                    <span className="text-xs text-neutral-400">Hệ thống Quản lý Vận tải & Logistics Doanh nghiệp</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-neutral-800/90 border border-neutral-700/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block">Hotline Kỹ thuật</span>
                      <span className="font-mono font-bold text-sm text-white">{SUPPORT_PHONE_DISPLAY}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(SUPPORT_PHONE_DISPLAY, 'phone')}
                      className="p-1.5 rounded-lg bg-neutral-700 text-neutral-300 hover:text-white"
                      title="Sao chép số"
                    >
                      {copiedType === 'phone' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-neutral-800/90 border border-neutral-700/80 flex items-center justify-between">
                    <div className="min-w-0 mr-2">
                      <span className="text-[10px] uppercase font-bold text-neutral-400 block">Email Tiếp nhận</span>
                      <span className="font-mono font-medium text-xs sm:text-sm text-white truncate block">
                        {SUPPORT_EMAIL}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(SUPPORT_EMAIL, 'email')}
                      className="p-1.5 rounded-lg bg-neutral-700 text-neutral-300 hover:text-white flex-shrink-0"
                      title="Sao chép email"
                    >
                      {copiedType === 'email' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-3">
                  <a
                    href={`tel:${SUPPORT_PHONE_RAW}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Gọi Hotline ngay</span>
                  </a>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=[Privacy] Yêu cầu về Quyền riêng tư & Dữ liệu`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Gửi thư qua Email</span>
                  </a>
                </div>
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 py-10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-neutral-900 dark:bg-neutral-100 rounded-lg flex items-center justify-center text-white dark:text-neutral-900">
                <Calculator className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-sm text-neutral-900 dark:text-neutral-100">PhuPhatCorp TMS</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6">
              <Link to="/support" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                Trung tâm Hỗ trợ & Liên hệ
              </Link>
              <Link to="/login" className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                Đăng nhập
              </Link>
              <Link to="/privacy" className="font-semibold text-neutral-900 dark:text-neutral-100">
                Chính sách Quyền riêng tư
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
            <div>© {new Date().getFullYear()} PhuPhatCorp. Bảo lưu mọi quyền.</div>
            <div>Hotline: {SUPPORT_PHONE_DISPLAY} • Email: {SUPPORT_EMAIL}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PrivacyPolicyPage;
