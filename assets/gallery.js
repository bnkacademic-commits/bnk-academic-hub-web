// gallery.js (ตั้งแต่ 1.76) — การ์ดอัลบั้มของคลังรูปภาพ ใช้ร่วมกันระหว่าง gallery.html (ในระบบ) และ photos.html (หน้าสาธารณะ)
// ต้องโหลดหลัง api.js (ใช้ escapeHtml, formatDateThai, groupLabel, deptThemeColor, showToast)
var GALLERY_PAGE = 40;
function albumSemLabel(a) { return a.semester === 'summer' ? 'ภาคฤดูร้อน' : 'ภาคเรียนที่ ' + a.semester; }
// 1.78: วันที่จัดกิจกรรม "เริ่ม – ถึง" (ถึงวันที่ว่าง = วันเดียว) เช่น 8–10 ต.ค. 2569 · 28 ก.ย. – 2 ต.ค. 2569
function albumDateLabel(a) {
  var f1 = formatDateThai(a.eventDate);
  if (!a.endDate || a.endDate === a.eventDate) return f1;
  var f2 = formatDateThai(a.endDate), p1 = f1.split(' '), p2 = f2.split(' ');
  if (p1.length === 3 && p2.length === 3) {
    if (p1[1] === p2[1] && p1[2] === p2[2]) return p1[0] + '–' + f2;
    if (p1[2] === p2[2]) return p1[0] + ' ' + p1[1] + ' – ' + f2;
  }
  return f1 + ' – ' + f2;
}
function albumCoverUrl(a, w) { return a.coverFileId ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(a.coverFileId) + '&sz=w' + (w || 640) : ''; }
function albumColor(a) { return (a.department && deptThemeColor(a.department)) || 'var(--primary)'; }
function albumCardHtml(a, opts) {
  opts = opts || {};
  var cover = albumCoverUrl(a);
  var coverHtml = cover
    ? '<img class="alb-img" src="' + cover + '" alt="" loading="lazy" referrerpolicy="no-referrer" />'
    : '';
  return '<article class="alb-card" data-alb="' + escapeHtml(a.id) + '" style="--ac:' + albumColor(a) + '">' +
    '<a class="alb-cover' + (cover ? '' : ' no-cover') + '" href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener" aria-label="เปิดอัลบั้ม ' + escapeHtml(a.title) + '">' +
      coverHtml + '<span class="alb-icon"><i class="fa-solid fa-images" aria-hidden="true"></i></span>' +
      '<span class="alb-date">' + escapeHtml(albumDateLabel(a)) + '</span>' +
      (a.photoCount > 0 ? '<span class="alb-count"><i class="fa-solid fa-images" aria-hidden="true"></i> ' + a.photoCount + ' รูป</span>' : '') +
    '</a>' +
    '<div class="alb-body"><div class="alb-title">' + escapeHtml(a.title) + '</div>' +
      '<div class="alb-meta">' + escapeHtml(albumSemLabel(a)) + ' ปีการศึกษา ' + escapeHtml(a.academicYear) +
        (a.department ? ' · <span class="alb-dept">' + escapeHtml(groupLabel(a.department)) + '</span>' : '') + '</div>' +
      (a.subjectGroup ? '<div class="alb-subj"><i class="fa-solid fa-book" aria-hidden="true"></i> กลุ่มสาระการเรียนรู้' + escapeHtml(a.subjectGroup) + '</div>' : '') +
      (opts.showOwner && a.createdByName ? '<div class="alb-owner"><i class="fa-solid fa-user" aria-hidden="true"></i> ' + escapeHtml(a.createdByName) + '</div>' : '') +
      '<div class="alb-foot">' +
        (opts.inSystem ? (a.canEdit
          ? '<button type="button" class="alb-pub ' + (a.isPublic ? 'on' : '') + '" data-alb-pub title="กดเพื่อเปลี่ยน"><i class="fa-solid ' + (a.isPublic ? 'fa-globe' : 'fa-lock') + '" aria-hidden="true"></i> ' + (a.isPublic ? 'สาธารณะ' : 'เฉพาะในระบบ') + '</button>'
          : '<span class="alb-pub ' + (a.isPublic ? 'on' : '') + '"><i class="fa-solid ' + (a.isPublic ? 'fa-globe' : 'fa-lock') + '" aria-hidden="true"></i> ' + (a.isPublic ? 'สาธารณะ' : 'เฉพาะในระบบ') + '</span>') : '') +
        '<span class="alb-acts">' +
          (opts.inSystem && a.canEdit ? '<button type="button" class="icon-btn" data-alb-edit title="แก้ไข" aria-label="แก้ไข ' + escapeHtml(a.title) + '"><i class="fa-solid fa-pen"></i></button>' +
            '<button type="button" class="icon-btn del" data-alb-del title="ลบ" aria-label="ลบ ' + escapeHtml(a.title) + '"><i class="fa-solid fa-trash"></i></button>' : '') +
          // 1.78: คัดลอกข้อความไปส่งในกลุ่มได้เฉพาะเจ้าของอัลบั้ม (ในระบบ)
          (opts.inSystem && a.mine ? '<button type="button" class="icon-btn" data-alb-copy title="คัดลอกข้อความไปส่งในกลุ่ม" aria-label="คัดลอกข้อความ ' + escapeHtml(a.title) + '"><i class="fa-solid fa-copy"></i></button>' : '') +
          '<a class="alb-open" href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener" title="เปิดอัลบั้ม" aria-label="เปิดอัลบั้ม ' + escapeHtml(a.title) + '"><i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i></a>' +
        '</span></div></div></article>';
}
// รูปปกโหลดไม่ได้ (เช่น เจ้าของเลิกแชร์) = ใช้ไอคอน
function wireAlbumCovers(root) {
  root.querySelectorAll('img.alb-img:not([data-w])').forEach(function (img) {
    img.setAttribute('data-w', '1');
    img.addEventListener('error', function () { var c = img.closest('.alb-cover'); if (c) c.classList.add('no-cover'); img.remove(); });
  });
}
// ข้อความสำหรับส่งในกลุ่ม LINE/กลุ่มโรงเรียน
function albumShareText(a) {
  return 'ภาพกิจกรรม: ' + a.title + '\n' +
    'วันที่ ' + albumDateLabel(a) + ' · ' + albumSemLabel(a) + ' ปีการศึกษา ' + a.academicYear + '\n' +
    (a.department ? groupLabel(a.department) + '\n' : '') +
    (a.subjectGroup ? 'กลุ่มสาระการเรียนรู้' + a.subjectGroup + '\n' : '') +
    'ดูภาพทั้งหมด: ' + a.url;
}
async function copyAlbumText(a) {
  var text = albumShareText(a);
  // มือถือ: ใช้หน้าต่างแชร์ของเครื่อง (ส่งเข้า LINE ได้ทันที) · คอมพิวเตอร์: คัดลอก
  var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.share) {
    try { await navigator.share({ text: text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(text); showToast('คัดลอกข้อความแล้ว — นำไปวางในกลุ่มได้เลย'); }
  catch (e) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('คัดลอกข้อความแล้ว — นำไปวางในกลุ่มได้เลย'); } catch (e2) { showToast('คัดลอกไม่สำเร็จ', true); }
    ta.remove();
  }
}
// กรอง: ค้นหา + ภาคเรียน + กลุ่ม (+ ของฉัน)
function filterAlbums(list, f) {
  var q = String(f.q || '').trim().toLowerCase();
  return list.filter(function (a) {
    if (f.semester && a.semester !== f.semester) return false;
    if (f.group && !groupFilterMatch(f.group, a.department, a.subjectGroup)) return false; // 1.79: กลุ่มบริหารงาน ('d:…') หรือกลุ่มสาระฯ
    if (f.mine && !a.mine) return false;
    if (q && (a.title + ' ' + (a.department || '') + ' ' + (a.subjectGroup || '') + ' ' + (a.createdByName || '')).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}
