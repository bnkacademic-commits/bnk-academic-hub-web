// manual.js (ตั้งแต่ 1.76) — คู่มือการใช้งาน (ป็อปอัพจากปุ่มรูปหนังสือในแถบบน) · โหลดเมื่อกดปุ่มครั้งแรกเท่านั้น (openManual ใน api.js)
// ภาพประกอบอยู่ที่ assets/manual/*.jpg — ถ่ายจากระบบจริงด้วยข้อมูลตัวอย่าง กรอบแดง/หมายเลขวาดจากตำแหน่งจริงของปุ่มในหน้าเว็บ
// หมายเลขในรายการ "ขั้นตอน" ตรงกับหมายเลขสีแดงในภาพเดียวกัน
// บทบาท: t = ครู · s = เจ้าหน้าที่ · e = ผู้บริหาร · a = Super Admin (เห็นหัวข้อทั่วไป + เจ้าหน้าที่ — ไม่มีหัวข้อเฉพาะ Super Admin)
var MANUAL_TOPICS = [
  {
    id: 'start', group: 'common', title: 'เริ่มต้นใช้งาน', icon: 'fa-door-open', roles: 'tsea',
    lead: 'เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านที่ได้รับจากโรงเรียน แล้วรู้จักปุ่มหลักที่อยู่ด้านบนของทุกหน้า',
    figs: [
      { img: 'start-login', cap: 'หน้าเข้าสู่ระบบ', steps: ['กรอกชื่อผู้ใช้ (Username)', 'กรอกรหัสผ่าน — กดรูปตาเพื่อดูสิ่งที่พิมพ์', 'กด "เข้าสู่ระบบ" (ติ๊ก "จดจำฉันไว้" เฉพาะเครื่องส่วนตัว)'] },
      { img: 'start-topbar', cap: 'แถบด้านบนและเมนูด้านข้าง', steps: ['เมนูหลัก — กดปุ่ม ☰ มุมซ้ายบนเพื่อกาง/หุบชื่อเมนู', 'รีเฟรชข้อมูลล่าสุดโดยไม่ต้องโหลดหน้าใหม่', 'คู่มือการใช้งาน (หน้านี้)', 'กระดิ่งแจ้งเตือน — ตัวเลขสีแดงคือเรื่องใหม่', 'เมนูบัญชี: ธีมสี เปลี่ยนรูปโปรไฟล์ เปลี่ยนรหัสผ่าน แจ้งปัญหา และออกจากระบบ'] }
    ],
    tips: ['เข้าสู่ระบบได้ทีละเครื่อง — เมื่อเข้าจากเครื่องใหม่ เครื่องเดิมจะออกจากระบบให้อัตโนมัติ', 'ลืมรหัสผ่าน ติดต่อผู้ดูแลระบบให้ตั้งรหัสผ่านใหม่']
  },
  {
    id: 'home', group: 'common', title: 'หน้าแรก', icon: 'fa-house', roles: 'ts',
    lead: 'หน้าแรกรวมทุกอย่างที่ต้องรู้: ประกาศ ปฏิทินกำหนดส่งงาน และเช็คลิสต์ว่าส่งงานอะไรไปแล้วบ้าง',
    figs: [
      { img: 'home-1', cap: 'ประกาศ ปฏิทิน และเช็คลิสต์', steps: ['ประกาศจากกลุ่มบริหารงานต่างๆ — กดลูกศรมุมขวาเพื่อย่อ/ขยาย', 'ปฏิทินกำหนดส่งงาน — วันที่มีจุดสีคือวันกำหนดส่ง กดเพื่อดูรายละเอียด · เลือกกลุ่มบริหารงานได้จากปุ่มด้านบน', 'เช็คลิสต์การส่งงาน — เลือกปีการศึกษาและภาคเรียน ตัวเลขสีแดงคือจำนวนงานที่ยังไม่ส่ง'] }
    ]
  },
  {
    id: 'submit', group: 'common', title: 'ส่งผลงาน', icon: 'fa-paper-plane', roles: 'ts',
    lead: 'ส่งงานตามกำหนดจากรายการ "กำหนดส่งงาน" ในหน้าแรก หรือส่งงานอื่นเองได้ทุกเมื่อ',
    figs: [
      { img: 'submit-1', cap: 'ปุ่มส่งงานในหน้าแรก', steps: ['"ส่งงาน" — งานที่ยังไม่ได้ส่ง ระบบเลือกประเภทงาน ปีการศึกษา และภาคเรียนให้แล้ว', '"ส่งงานเพิ่มหรือแก้ไข" — งานที่ส่งแล้ว ใช้เพิ่มไฟล์หรือส่งไฟล์ใหม่', '"ส่งงาน (กำหนดเอง)" — ส่งงานที่ไม่อยู่ในกำหนดการ เลือกประเภทงานเอง'] },
      { img: 'submit-2', cap: 'หน้าต่างส่งงาน', steps: ['ปีการศึกษาและภาคเรียนของผลงาน', 'ประเภทงาน', 'ลากไฟล์มาวาง หรือกดเพื่อเลือกไฟล์ (ครั้งละไม่เกิน 20 ไฟล์ ไฟล์ละไม่เกิน 25MB)', 'กด "ยืนยันส่ง" แล้วรอจนขึ้นว่าส่งสำเร็จ'] },
      { img: 'submit-3', cap: 'ผลงานของฉันทั้งหมด (ด้านล่างของหน้าแรก)', steps: ['ค้นหา และกรองตามปีการศึกษา/ภาคเรียน', 'พรีวิว ดาวน์โหลด หรือลบทีละไฟล์', 'เพิ่มไฟล์ในชุดเดิมโดยไม่ต้องเลือกประเภทงานใหม่'] }
    ],
    tips: ['ชื่อไฟล์ที่ส่งจะกลายเป็นชื่อผลงาน — ตั้งชื่อไฟล์ให้สื่อความหมายก่อนส่ง', 'ไฟล์ Word, Excel, PowerPoint, PDF และรูปภาพ พรีวิวในระบบได้ทั้งหมด']
  },
  {
    id: 'memo', group: 'common', title: 'จัดทำบันทึกข้อความ', icon: 'fa-file-lines', roles: 'ts', needMemo: true,
    lead: 'สร้างบันทึกข้อความรายงานการส่งผลงานจากงานที่ส่งในระบบ พร้อมพิมพ์หรือบันทึกเป็น PDF ได้ทันที',
    figs: [
      { img: 'memo-1', cap: 'เลือกภาคเรียนและรายการที่จะแนบ', steps: ['เลือกปีการศึกษาและภาคเรียนที่รายงาน', 'ระบบติ๊กผลงานที่ส่งแล้วในภาคเรียนนั้นไว้ให้ — ยกเลิกติ๊กรายการที่ไม่ต้องการแนบได้'] },
      { img: 'memo-2', cap: 'รายละเอียดและพิมพ์', steps: ['เลือกหัวเรื่องที่โรงเรียนตั้งไว้ หรือพิมพ์หัวเรื่องเอง', 'แก้ไขเนื้อหาได้อิสระ', 'กด "พิมพ์ / บันทึกเป็น PDF" แล้วเลือกเครื่องพิมพ์ หรือ "Save as PDF"'] }
    ]
  },
  {
    id: 'certs', group: 'common', title: 'คลังเกียรติบัตร', icon: 'fa-award', roles: 'tsea',
    lead: 'รวมเกียรติบัตรของครู นักเรียน และโรงเรียน ทั้งที่โรงเรียนออกให้ (ภายใน) และจากหน่วยงานอื่น (ภายนอก)',
    figs: [
      { img: 'certs-1', cap: 'ค้นหาและดูเกียรติบัตร', steps: ['เลือก "ภายในโรงเรียน" หรือ "ภายนอกโรงเรียน"', 'กรองตามผู้ได้รับ: ครู นักเรียน หรือโรงเรียน', 'ค้นหาจากชื่อกิจกรรม ชื่อผู้ได้รับ เลขที่ หรือรางวัล แล้วกรองตามปีการศึกษา ภาคเรียน กิจกรรม หรือเฉพาะที่ฉันเพิ่ม/ได้รับ — ปุ่ม "ล้างตัวกรอง" ขึ้นเมื่อกรองอยู่', 'ดูเกียรติบัตร — กดลูกศรด้านขวาเพื่อดูรายชื่อทั้งหมดในรายการ'] },
      { img: 'staff-certs-1', cap: 'เพิ่มเกียรติบัตร', steps: ['"ภายใน" — เกียรติบัตรที่โรงเรียนออกให้ ระบบจองเลขที่ให้อัตโนมัติ แล้วอัพโหลดไฟล์ทีหลังได้', '"ภายนอก" — เกียรติบัตรที่ได้รับจากหน่วยงานอื่น'] }
    ],
    tips: ['ครูที่มีชื่ออยู่ในเกียรติบัตรภายในจะได้รับแจ้งเตือนเมื่อจองเลขและเมื่ออัพโหลดไฟล์แล้ว', 'ปุ่ม "แชร์หน้าค้นหา" ให้คนนอกระบบค้นหาเกียรติบัตรได้โดยไม่ต้องเข้าสู่ระบบ']
  },
  {
    id: 'orders', group: 'common', title: 'คลังคำสั่ง', icon: 'fa-file-signature', roles: 'tsea',
    lead: 'ค้นหาและเปิดดูคำสั่งของโรงเรียน (ไฟล์ PDF) — ทุกคนเพิ่มคำสั่งได้ แก้ไข/ลบได้เฉพาะผู้อัพโหลด',
    figs: [
      { img: 'orders-1', cap: 'คลังคำสั่ง', steps: ['ค้นหาจากชื่อ เลขที่ หรือผู้รับผิดชอบ แล้วกรองตามปีการศึกษา ภาคเรียน กลุ่ม (กลุ่มบริหารงาน/กลุ่มสาระฯ) หรือที่ฉันเพิ่ม/รับผิดชอบ', 'ดูคำสั่งในระบบ', 'ดาวน์โหลดไฟล์คำสั่ง', 'เพิ่มคำสั่งใหม่'] }
    ],
    tips: ['เมื่อมีคำสั่งใหม่ ทุกคนจะได้รับแจ้งเตือนที่กระดิ่ง']
  },
  {
    id: 'gallery', group: 'common', title: 'คลังรูปภาพ', icon: 'fa-images', roles: 'tsea',
    lead: 'รวมลิงก์อัลบั้มภาพกิจกรรมจาก Google Drive ของครูทุกคน — ครูทุกคนเพิ่มอัลบั้มได้',
    figs: [
      { img: 'gallery-1', cap: 'หน้าคลังรูปภาพ', steps: ['เพิ่มอัลบั้มใหม่', 'แชร์หน้าสาธารณะ — ลิงก์และ QR Code ให้คนนอกระบบดูอัลบั้มที่เปิดสาธารณะ', 'ค้นหา แล้วกรองตามปีการศึกษา ภาคเรียน กลุ่ม (กลุ่มบริหารงาน/กลุ่มสาระฯ) หรือที่ฉันเพิ่ม — เริ่มต้นแสดงปีการศึกษาปัจจุบันทุกภาคเรียน เลือก "ทุกปีการศึกษา" เพื่อดูย้อนหลัง', 'คัดลอกข้อความ (ชื่อกิจกรรม วันที่ ลิงก์) ไปวางในกลุ่มโรงเรียน — มีเฉพาะในอัลบั้มที่คุณเพิ่มเอง บนมือถือจะเปิดหน้าต่างแชร์ให้เลือกแอปได้เลย', 'เปิดอัลบั้มใน Google Drive (กดที่รูปปกก็ได้)'] },
      { img: 'gallery-2', cap: 'เพิ่มอัลบั้ม', steps: ['ชื่อกิจกรรม', 'วันที่จัดกิจกรรม (วันเริ่ม)', 'ถึงวันที่ — ใส่เฉพาะกิจกรรมหลายวัน จัดวันเดียวเว้นว่างไว้', 'กลุ่มสาระการเรียนรู้ (ไม่บังคับ — เลือก "ไม่มี" ได้) และเลือกกลุ่มบริหารงาน ภาคเรียน ปีการศึกษา ในช่องข้างเคียง', 'ลิงก์โฟลเดอร์ Google Drive หรือ Google Photos — โฟลเดอร์ต้องแชร์แบบ "ทุกคนที่มีลิงก์"', 'ลิงก์รูปหน้าปก (ไม่บังคับ) — ไม่ใส่ ระบบดึงรูปแรกในโฟลเดอร์ให้เอง', 'แสดงในหน้าสาธารณะ — ค่าเริ่มต้นปิด เปิดเฉพาะอัลบั้มที่เผยแพร่ภาพนักเรียนได้', 'บันทึก — ทุกคนในระบบได้รับแจ้งเตือนอัลบั้มใหม่'] },
      { img: 'gallery-3', cap: 'จัดการอัลบั้มของฉัน', steps: ['เลือก "ที่ฉันเพิ่ม" เพื่อดูเฉพาะอัลบั้มของตัวเอง', 'กดป้าย "สาธารณะ / เฉพาะในระบบ" เพื่อสลับการแสดงในหน้าสาธารณะ', 'แก้ไขรายละเอียด', 'ลบอัลบั้ม (ไม่ลบรูปใน Google Drive)'] },
      { img: 'gallery-4', cap: 'แชร์หน้าสาธารณะ', steps: [] }
    ],
    tips: ['แก้ไข ลบ และเปลี่ยนการแสดงสาธารณะได้เฉพาะเจ้าของอัลบั้ม เจ้าหน้าที่ และผู้ดูแลระบบ', 'ถ้ารูปปกไม่ขึ้น (ขึ้นเป็นไอคอน) ให้ตรวจการแชร์โฟลเดอร์ หรือใส่ลิงก์รูปหน้าปกเอง']
  },
  {
    id: 'portfolio', group: 'common', title: 'หน้าแสดงผลงานของฉัน', icon: 'fa-id-card', roles: 'ts',
    lead: 'ผลงานที่ส่งในระบบรวมเป็นหน้าแสดงผลงานสาธารณะของแต่ละคน แชร์ให้ผู้ประเมินหรือผู้ปกครองดูได้โดยไม่ต้องเข้าสู่ระบบ',
    figs: [
      { img: 'portfolio-1', cap: 'ปุ่มในหน้าแรก', steps: ['กด "หน้าผลงานของฉัน"'] },
      { img: 'portfolio-2', cap: 'ลิงก์และ QR Code', steps: ['QR Code สำหรับสแกนหรือพิมพ์แนบเอกสาร', 'เปิดหน้าผลงาน', 'คัดลอกลิงก์ไปส่งต่อ'] },
      { img: 'portfolio-3', cap: 'ตัวอย่างหน้าแสดงผลงาน', steps: [] }
    ],
    tips: ['เลือกดูผลงานตามปีการศึกษาและภาคเรียนได้ในหน้าแสดงผลงาน', 'เมนู "ทำเนียบบุคลากร" รวมรายชื่อทุกคน กดชื่อเพื่อไปยังหน้าแสดงผลงานของคนนั้น']
  },
  {
    id: 'exec', group: 'exec', title: 'หน้าแรกผู้บริหาร', icon: 'fa-chart-pie', roles: 'e',
    lead: 'ภาพรวมการส่งงานของบุคลากรทั้งโรงเรียน (ดูได้อย่างเดียว)',
    figs: [
      { img: 'exec-1', cap: 'หน้าแรกผู้บริหาร', steps: ['ตัวเลขสรุป: บุคลากร กำหนดส่งที่ยังเปิดอยู่ ผลงานทั้งหมด และอัตราการส่งครบ', 'ปฏิทินกำหนดส่งงาน — กดวันที่มีจุดสีเพื่อดูรายละเอียด', 'สรุปแต่ละงาน: ส่งตรงเวลา ส่งช้า และยังไม่ส่ง', 'เปิดหน้าสรุปรวมการส่งงานฉบับเต็ม'] }
    ]
  },
  {
    id: 'summary', group: 'staff', title: 'สรุปรวมการส่งงาน', icon: 'fa-chart-column', roles: 'sea',
    lead: 'ดูว่าใครส่งงานอะไรแล้วบ้าง แยกตามประเภทงานหรือแยกตามกำหนดการ',
    figs: [
      { img: 'staff-summary-1', cap: 'แท็บ "ทั้งหมด"', steps: ['สลับแท็บ "ทั้งหมด" / "สรุปแยกแต่ละงาน"', 'จำนวนครูและจำนวนผลงานทั้งหมด', 'ค้นหาชื่อครู ประเภทงาน หรือชื่อไฟล์ และกรองตามปีการศึกษา/ภาคเรียน', 'ผลงานจัดกลุ่มตามประเภทงาน — กดเพื่อดูรายชื่อและไฟล์'] },
      { img: 'staff-summary-2', cap: 'แท็บ "สรุปแยกแต่ละงาน"', steps: ['ค้นหา และเลือกงาน ปีการศึกษา ภาคเรียน', 'จำนวนที่ส่งตามกำหนด หลังกำหนด และยังไม่ส่ง', 'ส่งออกรายงานสรุป', 'รายชื่อพร้อมสถานะและวันเวลาที่ส่ง'] }
    ]
  },
  {
    id: 'announce', group: 'staff', title: 'ประกาศและปฏิทิน', icon: 'fa-bullhorn', roles: 'sa',
    lead: 'เพิ่มประกาศและกำหนดส่งงาน ซึ่งจะแสดงในหน้าแรกของครูทุกคน',
    figs: [
      { img: 'staff-announce-1', cap: 'แท็บประกาศ', steps: ['แท็บ ประกาศ / ปฏิทิน / เรื่องที่แจ้ง', 'เพิ่มประกาศ — กำหนดช่วงวันที่แสดงและผู้รับได้', 'แก้ไขหรือลบประกาศของกลุ่มตัวเอง'] },
      { img: 'staff-announce-2', cap: 'แท็บปฏิทิน', steps: ['แท็บปฏิทิน', 'เพิ่มกำหนดการ — ผูกกับประเภทงานเพื่อให้ขึ้นในเช็คลิสต์และปุ่ม "ส่งงาน" ของครู', 'แก้ไขหรือลบกำหนดการ'] }
    ]
  },
  {
    id: 'reports', group: 'staff', title: 'เรื่องที่แจ้ง', icon: 'fa-inbox', roles: 'sa',
    lead: 'เรื่องที่ครูแจ้งถึงกลุ่มบริหารงานของคุณ อยู่ในหน้า "ประกาศและปฏิทิน" แท็บ "เรื่องที่แจ้ง"',
    figs: [
      { img: 'staff-reports-1', cap: 'จัดการเรื่องที่แจ้ง', steps: ['แท็บเรื่องที่แจ้ง — ตัวเลขสีแดงคือเรื่องที่ยังรอรับเรื่อง', 'กรองตามสถานะ', 'เลือกเรื่องที่ต้องการดู', 'พิมพ์ตอบกลับผู้แจ้ง', 'เปลี่ยนสถานะ: รอรับเรื่อง / กำลังดำเนินการ / เสร็จแล้ว', 'ส่งต่อให้กลุ่มอื่นหรือผู้ดูแลระบบ เมื่อไม่ใช่เรื่องของกลุ่มคุณ', 'กดส่ง — ผู้แจ้งได้รับแจ้งเตือนทันที'] }
    ],
    tips: ['เรื่องที่เสร็จแล้วเก็บไว้ 1 ปีแล้วลบอัตโนมัติ']
  },
  {
    id: 'directory', group: 'common', title: 'ทำเนียบบุคลากร', icon: 'fa-address-book', roles: 'tsea', needDirectory: true,
    lead: 'รายชื่อผู้บริหาร ครู และบุคลากรของโรงเรียน ดูได้ทั้งแบบผังองค์กรและแบบการ์ด',
    figs: [
      { img: 'directory-1', cap: 'ทำเนียบบุคลากร (แบบการ์ด)', steps: ['จัดกลุ่มตามกลุ่มสาระการเรียนรู้ หรือกลุ่มบริหารงาน', 'เลือกดูเฉพาะกลุ่มที่ต้องการ', 'สลับมุมมอง ผังองค์กร / การ์ด', 'กดที่การ์ดเพื่อเปิดหน้าแสดงผลงานของคนนั้น'] }
    ]
  },
  {
    id: 'bell', group: 'common', title: 'กระดิ่งแจ้งเตือน', icon: 'fa-bell', roles: 'tsea',
    lead: 'แจ้งเรื่องใหม่ที่เกี่ยวกับคุณ: เกียรติบัตรที่มีชื่อคุณ คำสั่งใหม่ อัลบั้มรูปภาพใหม่ และความคืบหน้าของเรื่องที่แจ้ง',
    figs: [
      { img: 'bell-1', cap: 'ตัวเลขบนกระดิ่ง', steps: ['ตัวเลขสีแดงคือจำนวนเรื่องใหม่ตั้งแต่เปิดกระดิ่งครั้งล่าสุด'] },
      { img: 'bell-2', cap: 'รายการแจ้งเตือน', steps: ['แสดงทั้งหมด หรือเฉพาะที่ยังไม่อ่าน', 'กดรายการเพื่อไปยังหน้านั้น — จุดสีฟ้าคือยังไม่อ่าน', 'อ่านทั้งหมดแล้ว'] }
    ],
    tips: ['สถานะอ่านแล้วตรงกันทุกเครื่องที่เข้าสู่ระบบ', 'แจ้งเตือนเก็บไว้ 30 วันแล้วลบอัตโนมัติ']
  },
  {
    id: 'report', group: 'common', title: 'แจ้งปัญหา', icon: 'fa-headset', roles: 'tsea',
    lead: 'พบปัญหาการใช้งาน หรือมีเรื่องถึงกลุ่มบริหารงาน แจ้งได้จากเมนูบัญชี',
    figs: [
      { img: 'report-1', cap: 'เมนูบัญชี', steps: ['กดชื่อของคุณมุมขวาบน แล้วเลือก "แจ้งปัญหา"'] },
      { img: 'report-2', cap: 'เลือกเรื่อง', steps: ['ปัญหาการใช้งานระบบ (เว็บมีปัญหา) — ส่งถึงผู้ดูแลระบบ', 'เรื่องของกลุ่มบริหารงาน — ส่งถึงเจ้าหน้าที่กลุ่มนั้น', '"เรื่องที่ฉันแจ้ง" — ติดตามสถานะและอ่านคำตอบ'] },
      { img: 'report-3', cap: 'กรอกรายละเอียด', steps: ['ผู้รับเรื่อง — กด "เปลี่ยน" เพื่อเลือกใหม่', 'หัวข้อสั้นๆ', 'รายละเอียดปัญหา', 'แนบภาพหน้าจอได้สูงสุด 3 รูป (ไม่บังคับ)', 'กด "ส่งเรื่อง"'] }
    ],
    tips: ['ระบบแนบชื่อหน้า เบราว์เซอร์ และขนาดจอให้อัตโนมัติ ช่วยให้แก้ปัญหาได้เร็วขึ้น', 'แจ้งได้ไม่เกิน 10 เรื่องต่อวัน']
  },
  {
    id: 'tips', group: 'common', title: 'เคล็ดลับ', icon: 'fa-lightbulb', roles: 'tsea',
    lead: 'ปรับการแสดงผลให้สบายตา และวิธีแก้เมื่อหน้าเว็บแสดงผลไม่ถูกต้อง',
    figs: [
      { img: 'tips-theme', cap: 'ธีมและบัญชี (เมนูบัญชี)', steps: ['เลือกธีม กระดาษขาว / ถนอมตา / กลางคืน', 'เปลี่ยนรหัสผ่าน'] },
      { img: 'tips-version', cap: 'เลขเวอร์ชันท้ายหน้า', steps: ['กดเลขเวอร์ชันท้ายหน้า แล้วเลือก "โหลดหน้าใหม่" หรือ "ล้างแคชแล้วโหลดใหม่" เมื่อหน้าเว็บค้างหรือไม่อัพเดต'] }
    ],
    tips: ['คลังคำสั่ง คลังเกียรติบัตร และคลังรูปภาพ ใช้ตัวกรองแบบเดียวกัน — บนมือถือกดปุ่ม "ตัวกรอง" ข้างช่องค้นหา', 'ข้อมูลไม่ตรงกับที่เพิ่งแก้จากอีกเครื่อง กดปุ่มรีเฟรช (ลูกศรวน) ที่แถบด้านบน', 'บนมือถือ เพิ่มหน้าเว็บไว้ที่หน้าจอหลักเพื่อเปิดได้เร็วเหมือนแอป']
  }
];

function manualRoleOf(s) {
  if (!s) return 't';
  if (s.role === 'executive') return 'e';
  if (s.role === 'admin') return s.hasHub ? 's' : 'a';
  return 't';
}
// 1.79: สารบัญเรียงตามลำดับเมนูข้างที่ตั้งไว้จริง (ตั้งค่าระบบ → ลำดับเมนู) — หัวข้อที่ไม่มีในเมนูอยู่ต้น (_first) หรือท้าย (_last)
var MANUAL_SLOT = { start: '_first', home: 'home', submit: 'home', portfolio: 'home', exec: 'home', memo: 'memo', summary: 'summary', announce: 'announce', reports: 'announce',
  directory: 'directory', orders: 'orders', certs: 'certs', gallery: 'gallery', bell: '_last', report: '_last', tips: '_last' };
function manualTopicsFor(s) {
  var r = manualRoleOf(s);
  var st = (typeof _settingsCache !== 'undefined' && _settingsCache) ? _settingsCache : (typeof cachedBrand === 'function' ? cachedBrand() : null);
  var memoOn = typeof isMemoEnabled === 'function' ? isMemoEnabled(st) : true;
  var dirOn = !(st && st.directoryMode === 'off');
  var list = MANUAL_TOPICS.filter(function (t) { return t.roles.indexOf(r) !== -1 && (!t.needMemo || memoOn) && (!t.needDirectory || dirOn); });
  var nav = typeof currentNavOrder === 'function' ? currentNavOrder() : [];
  var rank = function (t) { var sl = MANUAL_SLOT[t.id] || '_last'; if (sl === '_first') return -1; if (sl === '_last') return 1000; var i = nav.indexOf(sl); return i === -1 ? 999 : i; };
  return list.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) { return rank(a.t) - rank(b.t) || a.i - b.i; }).map(function (x) { return x.t; });
}
var _manual = null;
var MANUAL_KEY = 'bnkah_manual_topic';
function manualImg(name) { return 'assets/manual/' + name + '.jpg?v=' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''); }

function manualOpen(topicId) {
  var s = typeof getSession === 'function' ? getSession() : null;
  var topics = manualTopicsFor(s);
  if (!_manual) {
    var el = document.createElement('div');
    el.className = 'modal-backdrop'; el.id = 'manualModal'; el.hidden = true;
    el.innerHTML = '<div class="modal-box mn-box" role="dialog" aria-modal="true" aria-labelledby="manualTitle">' +
      '<button type="button" class="modal-close-x" id="manualCloseX" aria-label="ปิด">✕</button>' +
      '<h3 id="manualTitle"><i class="fa-solid fa-book-open" aria-hidden="true"></i> คู่มือการใช้งาน</h3>' +
      '<select id="manualSelect" class="mn-select" aria-label="เลือกหัวข้อ"></select>' +
      '<div class="mn-wrap"><nav class="mn-toc" id="manualToc" aria-label="หัวข้อคู่มือ"></nav><div class="mn-main" id="manualMain" tabindex="-1"></div></div>' +
      '<div class="mn-zoom" id="manualZoom" hidden><img alt="" /><button type="button" class="modal-close-x" aria-label="ปิดภาพ">✕</button></div>' +
      '</div>';
    document.body.appendChild(el);
    _manual = { el: el, topics: topics, cur: '' };
    el.querySelector('#manualCloseX').addEventListener('click', manualClose);
    el.querySelector('#manualToc').addEventListener('click', function (e) { var b = e.target.closest('[data-mn]'); if (b) manualShow(b.getAttribute('data-mn')); });
    el.querySelector('#manualSelect').addEventListener('change', function (e) { manualShow(e.target.value); });
    el.querySelector('#manualMain').addEventListener('click', function (e) {
      var nav = e.target.closest('[data-mn]'); if (nav) { manualShow(nav.getAttribute('data-mn')); return; }
      var im = e.target.closest('img.mn-img'); if (im) manualZoom(im.getAttribute('src'), im.getAttribute('alt'));
    });
    var z = el.querySelector('#manualZoom');
    z.addEventListener('click', function () { z.hidden = true; });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !_manual || _manual.el.hidden) return;
      if (!z.hidden) { z.hidden = true; return; }
      manualClose();
    });
  }
  _manual.topics = topics;
  // 1.79: รายการเดียว ไม่แบ่งกลุ่ม — ลำดับตามเมนูจริง
  _manual.el.querySelector('#manualToc').innerHTML = topics.map(function (t) {
    return '<button type="button" class="mn-link" data-mn="' + t.id + '"><i class="fa-solid ' + t.icon + '" aria-hidden="true"></i><span>' + escapeHtml(t.title) + '</span></button>';
  }).join('');
  _manual.el.querySelector('#manualSelect').innerHTML = topics.map(function (t) { return '<option value="' + t.id + '">' + escapeHtml(t.title) + '</option>'; }).join('');
  _manual.topics = topics;
  topics = _manual.topics;
  var last = '';
  try { last = localStorage.getItem(MANUAL_KEY) || ''; } catch (e) { /* ไม่เป็นไร */ }
  var want = topicId || last;
  if (!topics.some(function (t) { return t.id === want; })) want = topics[0].id;
  _manual.el.querySelector('#manualZoom').hidden = true;
  showModalEl(_manual.el);
  manualShow(want);
}
function manualClose() { if (_manual) hideModalEl(_manual.el); }
function manualZoom(src, alt) {
  var z = _manual.el.querySelector('#manualZoom');
  var im = z.querySelector('img'); im.src = src; im.alt = alt || '';
  z.hidden = false;
}
function manualShow(id) {
  var st = _manual, topics = st.topics;
  var i = 0; topics.forEach(function (t, k) { if (t.id === id) i = k; });
  var t = topics[i];
  st.cur = t.id;
  try { localStorage.setItem(MANUAL_KEY, t.id); } catch (e) { /* ไม่เป็นไร */ }
  st.el.querySelectorAll('#manualToc [data-mn]').forEach(function (b) { var on = b.getAttribute('data-mn') === t.id; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); });
  st.el.querySelector('#manualSelect').value = t.id;
  var prev = topics[i - 1], next = topics[i + 1];
  var h = '<h2 class="mn-h"><span class="mn-ic"><i class="fa-solid ' + t.icon + '" aria-hidden="true"></i></span>' + escapeHtml(t.title) + '</h2>' +
    '<p class="mn-lead">' + escapeHtml(t.lead) + '</p>' +
    t.figs.map(function (f) {
      return '<figure class="mn-fig"><figcaption>' + escapeHtml(f.cap) + '</figcaption>' +
        '<img class="mn-img" src="' + manualImg(f.img) + '" alt="' + escapeHtml(f.cap) + '" loading="lazy" title="กดเพื่อขยาย" />' +
        (f.steps.length ? '<ol class="mn-steps">' + f.steps.map(function (x, k) { return '<li><span class="mn-n">' + (k + 1) + '</span><span>' + escapeHtml(x) + '</span></li>'; }).join('') + '</ol>' : '') +
        '</figure>';
    }).join('') +
    (t.tips && t.tips.length ? '<div class="mn-tips"><div class="mn-tips-h"><i class="fa-solid fa-lightbulb" aria-hidden="true"></i> ควรรู้</div><ul>' + t.tips.map(function (x) { return '<li>' + escapeHtml(x) + '</li>'; }).join('') + '</ul></div>' : '') +
    '<div class="mn-pager">' +
      (prev ? '<button type="button" class="btn btn-secondary btn-sm" data-mn="' + prev.id + '"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i> ' + escapeHtml(prev.title) + '</button>' : '<span></span>') +
      (next ? '<button type="button" class="btn btn-secondary btn-sm" data-mn="' + next.id + '">' + escapeHtml(next.title) + ' <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>' : '<span></span>') +
    '</div>';
  var main = st.el.querySelector('#manualMain');
  main.innerHTML = h;
  main.scrollTop = 0;
}
