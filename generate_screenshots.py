import os
from PIL import Image, ImageDraw, ImageFont

# Dimensions for high-res mobile screenshot
WIDTH = 1080
HEIGHT = 1920

# Fonts
FONT_REGULAR_PATH = "/Library/Fonts/Arial Unicode.ttf"
if not os.path.exists(FONT_REGULAR_PATH):
    FONT_REGULAR_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"

def get_font(size, bold=False):
    try:
        if bold and os.path.exists("/System/Library/Fonts/Supplemental/Arial Bold.ttf"):
            return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", size)
        return ImageFont.truetype(FONT_REGULAR_PATH, size)
    except Exception:
        return ImageFont.load_default()

def draw_rounded_rect(draw, bbox, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

def draw_header(draw, title, subtitle, bg_color=(255, 255, 255)):
    # Status bar
    font_status = get_font(28, bold=True)
    draw.text((60, 30), "09:41", fill=(30, 41, 59), font=font_status)
    draw.text((WIDTH - 220, 30), "5G  ●●●  98%", fill=(30, 41, 59), font=font_status)

    # Top Brand / Navigation
    font_brand = get_font(34, bold=True)
    font_sub = get_font(26, bold=False)
    
    # App Logo icon
    draw_rounded_rect(draw, (60, 90, 130, 160), radius=16, fill=(15, 23, 42))
    # Small icon accent inside
    draw_rounded_rect(draw, (75, 105, 115, 145), radius=6, fill=(255, 255, 255))
    
    draw.text((150, 95), title, fill=(15, 23, 42), font=font_brand)
    draw.text((150, 140), subtitle, fill=(100, 116, 139), font=font_sub)

    # Avatar / profile placeholder
    draw_rounded_rect(draw, (WIDTH - 140, 95, WIDTH - 60, 175), radius=40, fill=(226, 232, 240), outline=(203, 213, 225), width=2)
    draw.text((WIDTH - 110, 115), "H", fill=(71, 85, 105), font=get_font(36, bold=True))

def draw_bottom_nav(draw, active_tab_index=0):
    nav_y = HEIGHT - 170
    draw.rectangle((0, nav_y, WIDTH, HEIGHT), fill=(255, 255, 255), outline=(226, 232, 240), width=2)
    
    tabs = [
        ("Điều Hành", "🚛"),
        ("Đội Xe", "🔧"),
        ("Đối Soát", "📊"),
        ("Cài Đặt", "⚙️")
    ]
    
    tab_width = WIDTH // 4
    font_tab = get_font(24, bold=True)
    
    for i, (name, icon) in enumerate(tabs):
        center_x = i * tab_width + tab_width // 2
        is_active = (i == active_tab_index)
        
        color = (15, 23, 42) if is_active else (148, 163, 184)
        if is_active:
            draw_rounded_rect(draw, (center_x - 70, nav_y + 15, center_x + 70, nav_y + 90), radius=20, fill=(241, 245, 249))
        
        draw.text((center_x - 15, nav_y + 25), icon, font=get_font(34))
        
        bbox = draw.textbbox((0, 0), name, font=font_tab)
        text_w = bbox[2] - bbox[0]
        draw.text((center_x - text_w // 2, nav_y + 105), name, fill=color, font=font_tab)

# ----------------------------------------------------
# SCREENSHOT 1: DISPATCH & TRIP SCHEDULE
# ----------------------------------------------------
def generate_screenshot_1():
    img = Image.new("RGB", (WIDTH, HEIGHT), color=(248, 250, 252))
    draw = ImageDraw.Draw(img)

    draw_header(draw, "PhuPhatCorp TMS", "Điều Hành & Lịch Đi Hàng")

    # Banner / Hero Card
    draw_rounded_rect(draw, (60, 200, WIDTH - 60, 410), radius=28, fill=(15, 23, 42))
    draw.text((100, 230), "Tổng Quan Lịch Chuyến Hôm Nay", fill=(255, 255, 255), font=get_font(32, bold=True))
    draw.text((100, 275), "Kết nối 5 cụm nhà máy trọng điểm", fill=(148, 163, 184), font=get_font(24))

    # Metrics inside Banner
    metrics = [
        ("38", "Tổng Chuyến", (255, 255, 255)),
        ("32", "Đã Giao Xong", (74, 222, 128)),
        ("6", "Đang Chạy", (56, 189, 248)),
        ("284T", "Khối Lượng", (251, 191, 36)),
    ]
    metric_w = (WIDTH - 180) // 4
    for i, (val, label, color) in enumerate(metrics):
        mx = 90 + i * metric_w
        draw.text((mx + 10, 315), val, fill=color, font=get_font(36, bold=True))
        draw.text((mx + 10, 365), label, fill=(203, 213, 225), font=get_font(20))

    # Factory Filter Tabs
    factories = [("CLF (14)", True), ("VFM (10)", False), ("MCC (8)", False), ("CLV (4)", False), ("NDFC (2)", False)]
    fx = 60
    for name, active in factories:
        bg = (15, 23, 42) if active else (255, 255, 255)
        fg = (255, 255, 255) if active else (71, 85, 105)
        border = None if active else (226, 232, 240)
        draw_rounded_rect(draw, (fx, 440, fx + 175, 505), radius=18, fill=bg, outline=border, width=2)
        draw.text((fx + 24, 458), name, fill=fg, font=get_font(24, bold=True))
        fx += 190

    # Section Title
    draw.text((60, 535), "Danh Sách Chuyến Đang Vận Hành", fill=(15, 23, 42), font=get_font(30, bold=True))
    draw.text((WIDTH - 210, 540), "+ Thêm chuyến", fill=(2, 132, 199), font=get_font(24, bold=True))

    # Trip Cards
    trips = [
        {
            "code": "CLF-20260924-001",
            "truck": "60C-889.21",
            "driver": "Trần Văn Hùng",
            "from_to": "Nhà máy CLF  ➔  Cảng Cát Lái (Cát Lái, Q2)",
            "goods": "Gạo thơm xuất khẩu • 32.5 Tấn",
            "status": "ĐANG GIAO HÀNG",
            "status_bg": (224, 242, 254),
            "status_fg": (3, 105, 161),
            "time": "Khởi hành: 07:30 • Dự kiến: 11:30"
        },
        {
            "code": "CLF-20260924-002",
            "truck": "60H-012.44",
            "driver": "Nguyễn Văn Phát",
            "from_to": "Nhà máy CLF  ➔  Kho Phân Phối Long An",
            "goods": "Thức ăn thủy sản • 28.0 Tấn",
            "status": "ĐÃ HOÀN THÀNH",
            "status_bg": (220, 252, 231),
            "status_fg": (21, 128, 61),
            "time": "Giao lúc: 09:15 • Ký nhận: 100%"
        },
        {
            "code": "CLF-20260924-003",
            "truck": "60C-311.95",
            "driver": "Lê Hoàng Nam",
            "from_to": "Nhà máy CLF  ➔  Đại lý Tiền Giang",
            "goods": "Tấm cám công nghiệp • 15.2 Tấn",
            "status": "CHỜ BỐC HÀNG",
            "status_bg": (254, 243, 199),
            "status_fg": (180, 83, 9),
            "time": "Lịch bốc: 10:00 • Cân tải: Sẵn sàng"
        },
        {
            "code": "CLF-20260924-004",
            "truck": "60C-554.12",
            "driver": "Phạm Quốc Bảo",
            "from_to": "Nhà máy CLF  ➔  Kho Tổng Đồng Nai",
            "goods": "Gạo bao 50kg • 20.0 Tấn",
            "status": "ĐÃ XẾP TÀI XẾ",
            "status_bg": (241, 245, 249),
            "status_fg": (71, 85, 105),
            "time": "Lịch bốc: 13:30 • Điều xe hoàn tất"
        }
    ]

    card_y = 590
    for trip in trips:
        draw_rounded_rect(draw, (60, card_y, WIDTH - 60, card_y + 260), radius=24, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
        
        # Truck badge
        draw_rounded_rect(draw, (90, card_y + 25, 270, card_y + 75), radius=12, fill=(15, 23, 42))
        draw.text((110, card_y + 35), trip["truck"], fill=(255, 255, 255), font=get_font(24, bold=True))
        
        draw.text((290, card_y + 38), f"Tài xế: {trip['driver']}", fill=(71, 85, 105), font=get_font(24))

        # Status badge
        draw_rounded_rect(draw, (WIDTH - 300, card_y + 25, WIDTH - 90, card_y + 75), radius=12, fill=trip["status_bg"])
        draw.text((WIDTH - 280, card_y + 37), trip["status"], fill=trip["status_fg"], font=get_font(20, bold=True))

        # Route
        draw.text((90, card_y + 95), trip["from_to"], fill=(15, 23, 42), font=get_font(26, bold=True))
        
        # Details
        draw.text((90, card_y + 145), f"📦 {trip['goods']}", fill=(71, 85, 105), font=get_font(24))
        draw.text((90, card_y + 190), f"⏱️ {trip['time']}", fill=(100, 116, 139), font=get_font(22))

        # Quick action link
        draw.text((WIDTH - 210, card_y + 190), "Chi tiết  ➔", fill=(2, 132, 199), font=get_font(22, bold=True))

        card_y += 280

    draw_bottom_nav(draw, active_tab_index=0)
    return img

# ----------------------------------------------------
# SCREENSHOT 2: FLEET & MAINTENANCE
# ----------------------------------------------------
def generate_screenshot_2():
    img = Image.new("RGB", (WIDTH, HEIGHT), color=(248, 250, 252))
    draw = ImageDraw.Draw(img)

    draw_header(draw, "PhuPhatCorp TMS", "Quản Lý Đội Xe & Bảo Dưỡng")

    # Banner / Metrics Bar
    draw_rounded_rect(draw, (60, 200, WIDTH - 60, 390), radius=28, fill=(15, 23, 42))
    draw.text((100, 230), "Tình Trạng Kỹ Thuật Đội Phương Tiện", fill=(255, 255, 255), font=get_font(32, bold=True))
    draw.text((100, 275), "Theo dõi hạn đăng kiểm, bảo hiểm & thay nhớt", fill=(148, 163, 184), font=get_font(24))

    metrics = [
        ("42", "Tổng Xe", (255, 255, 255)),
        ("2", "Đăng Kiểm Gấp", (248, 113, 113)),
        ("1", "Cần Thay Nhớt", (251, 191, 36)),
        ("100%", "Bảo Hiểm", (74, 222, 128)),
    ]
    metric_w = (WIDTH - 180) // 4
    for i, (val, label, color) in enumerate(metrics):
        mx = 90 + i * metric_w
        draw.text((mx + 10, 310), val, fill=color, font=get_font(34, bold=True))
        draw.text((mx + 10, 355), label, fill=(203, 213, 225), font=get_font(20))

    # Urgent Warning Card
    draw_rounded_rect(draw, (60, 415, WIDTH - 60, 580), radius=24, fill=(254, 242, 242), outline=(254, 202, 202), width=2)
    draw.text((90, 435), "⚠️  CẢNH BÁO BẢO DƯỠNG CẦN XỬ LÝ GẤP", fill=(185, 28, 28), font=get_font(24, bold=True))
    
    # Alert 1
    draw.text((90, 480), "• Xe 60C-521.88: Hạn đăng kiểm còn 5 ngày (Đến 29/09/2026)", fill=(153, 27, 27), font=get_font(24, bold=True))
    draw.text((90, 520), "• Xe 60H-082.91: Vượt chu kỳ thay nhớt 350 km (ODO: 152,350 km)", fill=(180, 83, 9), font=get_font(24, bold=True))

    # Section Title
    draw.text((60, 615), "Danh Mục Phương Tiện Vận Tải", fill=(15, 23, 42), font=get_font(30, bold=True))
    draw.text((WIDTH - 230, 620), "Lọc trạng thái ▼", fill=(71, 85, 105), font=get_font(24))

    # Vehicles list
    vehicles = [
        {
            "plate": "60C-889.21",
            "model": "Đầu Kéo Dongfeng (Tải trọng 32.5T)",
            "driver": "Tài xế: Trần Văn Hùng",
            "odo": "184,200 km",
            "oil": "Nhớt: Còn 3,800 km",
            "oil_status": "OK",
            "inspection": "Đăng kiểm: 18/03/2027 (Còn 175 ngày)",
            "insurance": "Bảo hiểm: Còn 9 tháng",
            "status": "HOẠT ĐỘNG TỐT",
            "status_bg": (220, 252, 231),
            "status_fg": (21, 128, 61),
        },
        {
            "plate": "60H-082.91",
            "model": "Xe Tải Hino 15T Thùng Bạt",
            "driver": "Tài xế: Võ Quốc Tuấn",
            "odo": "152,350 km",
            "oil": "Nhớt: QUÁ HẠN 350 KM",
            "oil_status": "WARN",
            "inspection": "Đăng kiểm: 12/12/2026 (Còn 79 ngày)",
            "insurance": "Bảo hiểm: Còn 6 tháng",
            "status": "CẦN BẢO DƯỠNG",
            "status_bg": (254, 243, 199),
            "status_fg": (180, 83, 9),
        },
        {
            "plate": "60C-521.88",
            "model": "Xe Tải Isuzu 8T Chở Gạo",
            "driver": "Tài xế: Đỗ Minh Quân",
            "odo": "96,400 km",
            "oil": "Nhớt: Còn 1,200 km",
            "oil_status": "OK",
            "inspection": "Đăng kiểm: CÒN 5 NGÀY",
            "insurance": "Bảo hiểm: Đầy đủ",
            "status": "ĐĂNG KIỂM GẤP",
            "status_bg": (254, 226, 226),
            "status_fg": (185, 28, 28),
        },
        {
            "plate": "60C-114.78",
            "model": "Xe Tải Hyundai 5T Giao Nội Thành",
            "driver": "Tài xế: Huỳnh Hữu Nghĩa",
            "odo": "64,100 km",
            "oil": "Nhớt: Còn 4,500 km",
            "oil_status": "OK",
            "inspection": "Đăng kiểm: 25/05/2027 (Còn 240 ngày)",
            "insurance": "Bảo hiểm: Còn 11 tháng",
            "status": "SẴN SÀNG",
            "status_bg": (241, 245, 249),
            "status_fg": (71, 85, 105),
        }
    ]

    card_y = 665
    for v in vehicles:
        draw_rounded_rect(draw, (60, card_y, WIDTH - 60, card_y + 245), radius=24, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
        
        # Plate badge
        draw_rounded_rect(draw, (90, card_y + 22, 270, card_y + 72), radius=12, fill=(15, 23, 42))
        draw.text((110, card_y + 32), v["plate"], fill=(255, 255, 255), font=get_font(24, bold=True))
        
        draw.text((290, card_y + 35), v["model"], fill=(15, 23, 42), font=get_font(24, bold=True))

        # Status badge
        draw_rounded_rect(draw, (WIDTH - 290, card_y + 22, WIDTH - 90, card_y + 72), radius=12, fill=v["status_bg"])
        draw.text((WIDTH - 270, card_y + 34), v["status"], fill=v["status_fg"], font=get_font(18, bold=True))

        # Vehicle stats
        draw.text((90, card_y + 90), f"👤 {v['driver']}   •   🛣️ ODO: {v['odo']}", fill=(71, 85, 105), font=get_font(24))
        
        oil_color = (185, 28, 28) if v["oil_status"] == "WARN" else (21, 128, 61)
        draw.text((90, card_y + 135), f"🛢️ {v['oil']}", fill=oil_color, font=get_font(24, bold=(v["oil_status"] == "WARN")))
        draw.text((90, card_y + 180), f"📋 {v['inspection']}   •   🛡️ {v['insurance']}", fill=(100, 116, 139), font=get_font(22))

        card_y += 265

    draw_bottom_nav(draw, active_tab_index=1)
    return img

# ----------------------------------------------------
# SCREENSHOT 3: RECONCILIATION & E-TICKET
# ----------------------------------------------------
def generate_screenshot_3():
    img = Image.new("RGB", (WIDTH, HEIGHT), color=(248, 250, 252))
    draw = ImageDraw.Draw(img)

    draw_header(draw, "PhuPhatCorp TMS", "Đối Soát Kế Toán & Chứng Từ")

    # Banner / Metrics Bar
    draw_rounded_rect(draw, (60, 200, WIDTH - 60, 390), radius=28, fill=(15, 23, 42))
    draw.text((100, 230), "Kỳ Đối Soát Cước Vận Tải T09/2026", fill=(255, 255, 255), font=get_font(32, bold=True))
    draw.text((100, 275), "Tự động khớp dữ liệu chuyến, phiếu cân & hóa đơn", fill=(148, 163, 184), font=get_font(24))

    metrics = [
        ("156/158", "Khớp Lệnh", (74, 222, 128)),
        ("98.7%", "Tỷ Lệ Chuẩn", (56, 189, 248)),
        ("485.2M", "Tổng Cước", (251, 191, 36)),
        ("0.00%", "Lệch Cân", (255, 255, 255)),
    ]
    metric_w = (WIDTH - 180) // 4
    for i, (val, label, color) in enumerate(metrics):
        mx = 90 + i * metric_w
        draw.text((mx + 10, 310), val, fill=color, font=get_font(32, bold=True))
        draw.text((mx + 10, 355), label, fill=(203, 213, 225), font=get_font(20))

    # Highlight Card: Public e-Ticket Sharing
    draw_rounded_rect(draw, (60, 415, WIDTH - 60, 715), radius=26, fill=(255, 255, 255), outline=(2, 132, 199), width=2)
    
    # Card Header
    draw.text((90, 440), "📱  TRA CỨU CHỨNG TỪ ĐIỆN TỬ (PUBLIC e-TICKET)", fill=(2, 132, 199), font=get_font(24, bold=True))
    draw_rounded_rect(draw, (WIDTH - 270, 435, WIDTH - 90, 480), radius=10, fill=(224, 242, 254))
    draw.text((WIDTH - 250, 447), "KHÔNG CẦN LOGIN", fill=(3, 105, 161), font=get_font(18, bold=True))

    draw.text((90, 490), "Chuyến xe: 60C-889.21  •  Mã vận đơn: #PPC-92841", fill=(15, 23, 42), font=get_font(26, bold=True))
    draw.text((90, 530), "Khách hàng: Công ty Nông Sản Nam Bộ  •  Ngày: 24/09/2026", fill=(71, 85, 105), font=get_font(24))

    # Proof details
    draw_rounded_rect(draw, (90, 575, WIDTH - 90, 685), radius=18, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
    
    draw.text((120, 595), "⚖️ Phiếu cân hàng: 32,500 kg (Khớp chuẩn 100%)", fill=(21, 128, 61), font=get_font(22, bold=True))
    draw.text((120, 635), "📄 3 Ảnh chứng từ ký nhận đã được tải lên & mã hóa an toàn", fill=(71, 85, 105), font=get_font(22))
    
    draw_rounded_rect(draw, (WIDTH - 270, 600, WIDTH - 120, 660), radius=12, fill=(15, 23, 42))
    draw.text((WIDTH - 250, 617), "📥 Tải tất cả", fill=(255, 255, 255), font=get_font(20, bold=True))

    # Section Title
    draw.text((60, 745), "Danh Sách Đối Soát Chuyến Gần Đây", fill=(15, 23, 42), font=get_font(30, bold=True))
    draw.text((WIDTH - 210, 750), "Xuất Excel ⤓", fill=(21, 128, 61), font=get_font(24, bold=True))

    # Reconciliation Rows
    reconciles = [
        {
            "truck": "60C-889.21",
            "route": "CLF ➔ Cảng Cát Lái",
            "weight": "32.50 Tấn",
            "price": "3,450,000 đ",
            "diff": "Lệch: 0 kg",
            "status": "ĐÃ KHỚP",
            "status_bg": (220, 252, 231),
            "status_fg": (21, 128, 61),
        },
        {
            "truck": "60H-012.44",
            "route": "VFM ➔ Kho Long An",
            "weight": "28.00 Tấn",
            "price": "2,800,000 đ",
            "diff": "Lệch: +20 kg (Trong dung sai)",
            "status": "ĐÃ KHỚP",
            "status_bg": (220, 252, 231),
            "status_fg": (21, 128, 61),
        },
        {
            "truck": "60C-311.95",
            "route": "MCC ➔ Tiền Giang",
            "weight": "15.20 Tấn",
            "price": "1,950,000 đ",
            "diff": "Lệch: 0 kg",
            "status": "ĐÃ DUYỆT",
            "status_bg": (224, 242, 254),
            "status_fg": (3, 105, 161),
        },
        {
            "truck": "60C-554.12",
            "route": "NDFC ➔ Biên Hòa",
            "weight": "20.00 Tấn",
            "price": "2,200,000 đ",
            "diff": "Đang chờ phiếu cân về",
            "status": "CHỜ ĐỐI SOÁT",
            "status_bg": (254, 243, 199),
            "status_fg": (180, 83, 9),
        }
    ]

    card_y = 795
    for r in reconciles:
        draw_rounded_rect(draw, (60, card_y, WIDTH - 60, card_y + 215), radius=22, fill=(255, 255, 255), outline=(226, 232, 240), width=2)
        
        # Truck Plate
        draw_rounded_rect(draw, (90, card_y + 20, 260, card_y + 68), radius=10, fill=(15, 23, 42))
        draw.text((105, card_y + 28), r["truck"], fill=(255, 255, 255), font=get_font(24, bold=True))
        
        draw.text((280, card_y + 30), r["route"], fill=(15, 23, 42), font=get_font(24, bold=True))

        # Status badge
        draw_rounded_rect(draw, (WIDTH - 280, card_y + 20, WIDTH - 90, card_y + 68), radius=10, fill=r["status_bg"])
        draw.text((WIDTH - 260, card_y + 30), r["status"], fill=r["status_fg"], font=get_font(18, bold=True))

        # Financials & Weights
        draw.text((90, card_y + 85), f"Tải trọng: {r['weight']}   •   Thành tiền: {r['price']}", fill=(71, 85, 105), font=get_font(24, bold=True))
        draw.text((90, card_y + 130), f"🔍 {r['diff']}", fill=(100, 116, 139), font=get_font(22))
        
        draw.text((WIDTH - 230, card_y + 130), "Xem bảng kê  ➔", fill=(2, 132, 199), font=get_font(20, bold=True))

        card_y += 235

    draw_bottom_nav(draw, active_tab_index=2)
    return img

# Generate and save all 3
img1 = generate_screenshot_1()
img2 = generate_screenshot_2()
img3 = generate_screenshot_3()

paths = [
    ("frontend/public/screenshots/screenshot-1-dispatch.png", img1),
    ("frontend/public/screenshots/screenshot-2-fleet.png", img2),
    ("frontend/public/screenshots/screenshot-3-accounting.png", img3),
    ("mobile/web_v2_mobile/web/screenshots/screenshot-1-dispatch.png", img1),
    ("mobile/web_v2_mobile/web/screenshots/screenshot-2-fleet.png", img2),
    ("mobile/web_v2_mobile/web/screenshots/screenshot-3-accounting.png", img3),
]

for p, im in paths:
    im.save(p, "PNG")
    print(f"Saved {p} ({im.size[0]}x{im.size[1]})")
