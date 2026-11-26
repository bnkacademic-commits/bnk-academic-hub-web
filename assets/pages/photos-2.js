/* ย้ายมาจากสคริปต์ในหน้า photos.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
    mountFooter();
    applyBranding();
    var $ = function (id) { return document.getElementById(id); };
    // 2.02.0: อัลบั้มล่าสุด 5 อัลบั้มแสดงเสมอ (ไม่มีคำค้น) · รายการด้านล่างเริ่มที่ปีการศึกษาปัจจุบัน (เปลี่ยนได้) · โหลดเพิ่มทีละ 10
    var albums = [], hero = [], st = { q: '', year: 'cur', sem: '', video: false, next: 0, more: false, years: [], total: null }, tok = 0;
    // 2.32.0: ตัวกรองเป็นปุ่ม (ปีการศึกษา · ภาคเรียน · มีวิดีโอ) แทนช่องเลือก
    function chip(attr, val, on, txt) { return '<button type="button" class="bx-chip' + (on ? ' on' : '') + '" ' + attr + '="' + escapeHtml(val) + '" aria-pressed="' + on + '">' + txt + '</button>'; }
    function filtersHtml() {
      return '<div class="phx-flt" role="group" aria-label="กรองอัลบั้ม">' + chip('data-y', '', !st.year, 'ทุกปีการศึกษา') + st.years.map(function (y, i) { return chip('data-y', y, st.year === y, (i ? '' : 'ปีการศึกษา ') + escapeHtml(y)); }).join('') + '</div>' +
        '<div class="phx-flt" role="group" aria-label="กรองภาคเรียน">' + chip('data-s', '', !st.sem, 'ทุกภาคเรียน') + ['1', '2', '3'].map(function (x) { return chip('data-s', x, st.sem === x, x === '3' ? 'ภาคฤดูร้อน' : 'ภาคเรียนที่ ' + x); }).join('') +
        '<button type="button" class="bx-chip ph-vid' + (st.video ? ' on' : '') + '" id="phVid" aria-pressed="' + st.video + '"><i class="fa-solid fa-play" aria-hidden="true"></i> มีวิดีโอ</button></div>';
    }
    // หัวหน้า: ตัวเลขรวม + ปกอัลบั้มล่าสุดเรียงเป็นพื้นหลัง (ไม่มีปก = สีไล่โทน)
    function fmtN(n) { return Number(n || 0).toLocaleString('th-TH'); }
    function paintStats(x) { if (!x) return; $('phSt').innerHTML = '<span><b>' + fmtN(x.albums) + '</b>อัลบั้ม</span><span><b>' + fmtN(x.photos) + '</b>รูป</span>' + (x.videos ? '<span><b>' + fmtN(x.videos) + '</b>วิดีโอ</span>' : ''); }
    function paintMosaic() {
      var urls = hero.map(function (a) { return albumCoverUrl(a, 400); }).filter(Boolean), box = $('phMos'), h = '';
      for (var i = 0; i < 32; i++) h += '<i' + (urls.length ? ' style="background-image:url(\'' + urls[i % urls.length].replace(/'/g, '%27') + '\')"' : '') + '></i>';
      box.innerHTML = h;
    }
    paintMosaic();
    async function load(append) {
      var root = $('phRoot'), my = ++tok, first = st.year === 'cur';
      try { history.replaceState(null, '', location.pathname + (st.q ? '?q=' + encodeURIComponent(st.q) : '')); } catch (e) { /* ไม่เป็นไร */ }
      if (st.q && st.q.replace(/\s/g, '').length < 2) { root.innerHTML = filtersHtml() + '<div class="pubc-empty">กรุณาพิมพ์อย่างน้อย 2 ตัวอักษร</div>'; return; }
      if (!append) { st.next = 0; if (!root.querySelector('.alb-grid')) root.innerHTML = '<div class="loading">กำลังโหลด</div>'; }
      var btn = $('phMore'); if (btn) { btn.disabled = true; btn.textContent = 'กำลังโหลด...'; }
      try {
        var r = await apiCall('publicAlbumList', { q: st.q, year: st.year, semester: st.sem, video: st.video ? 1 : 0, offset: st.next, hero: !append && !hero.length && !st.q ? 1 : 0 });
        if (my !== tok) return;
        if (r.schoolName) $('phSub').textContent = 'ภาพบรรยากาศกิจกรรมของ' + r.schoolName;
        if (r.years) st.years = r.years;
        if (first) st.year = r.year || '';
        if (r.hero) { hero = r.hero; paintMosaic(); loadManagedCovers($('phRoot'), hero, true).then(paintMosaic); }
        if (r.stats) paintStats(r.stats);
        if (!append) albums = [];
        var add = r.items || []; albums = albums.concat(add); st.next = r.nextOffset || albums.length; st.more = !!r.more; if (r.total != null) st.total = r.total;
        render(append ? add : null);
      } catch (e) { if (my === tok) root.innerHTML = '<div class="error-box">' + escapeHtml(e.message) + '</div>'; }
    }
    function listOf(arr) { var hid = {}; if (!st.q && !st.video) hero.forEach(function (a) { hid[a.id] = 1; }); return arr.filter(function (a) { return !hid[a.id]; }); }
    function render(added) {
      var root = $('phRoot');
      if (added && $('phList')) { // โหลดเพิ่ม = ต่อท้ายรายการเดิม (ไม่วาดใหม่ทั้งหน้า)
        var more = listOf(added), tmp = document.createElement('div'); tmp.innerHTML = more.map(function (a) { return albumCardHtml(a, {}); }).join('');
        var list = $('phList'); while (tmp.firstChild) list.appendChild(tmp.firstChild);
        wireAlbumCovers(list); loadManagedCovers(list, more, true); moreBtn(); return;
      }
      var showHero = !st.q && !st.video && hero.length, rest = listOf(albums);
      var label = st.q ? 'ผลการค้นหา' : st.year ? 'อัลบั้มปีการศึกษา ' + escapeHtml(st.year) + (st.sem ? ' ' + (st.sem === '3' ? 'ภาคฤดูร้อน' : 'ภาคเรียนที่ ' + st.sem) : '') : 'อัลบั้มทั้งหมด' + (st.sem ? ' ' + (st.sem === '3' ? 'ภาคฤดูร้อน' : 'ภาคเรียนที่ ' + st.sem) : '');
      // 2.02.4: อัลบั้มล่าสุด = การ์ดใหญ่ 2 (กว้าง 2 ช่อง ชื่อวางบนรูป) + การ์ดปกติ 4 · การ์ดทุกใบสูงเท่ากัน ปกแนวนอน
      root.innerHTML = (showHero ? '<div class="bx-sec"><span class="bx-band">ล่าสุด</span><span class="bx-ln"></span></div><div class="alb-grid ph-fix ph-hero2">' + hero.map(function (a, i) { var h = albumCardHtml(a, {}); return i < 2 ? h.replace('class="alb-card"', 'class="alb-card alb-big"') : h; }).join('') + '</div>' : '') +
        '<div class="bx-sec"><h2 class="ph-h ph-h2">' + label + '</h2><span class="bx-ln"></span>' + (st.total != null ? '<small class="bx-cnt">' + st.total + ' อัลบั้ม</small>' : '') + '</div>' + filtersHtml() +
        (rest.length ? '<div class="alb-grid ph-fix ph-list" id="phList">' + rest.map(function (a) { return albumCardHtml(a, {}); }).join('') + '</div>' :
          '<div class="pubc-empty"><i class="fa-solid fa-images" aria-hidden="true"></i> ' + (st.q ? 'ไม่พบอัลบั้มที่ตรงกับ "' + escapeHtml(st.q) + '"<div class="hint">ลองพิมพ์คำอื่น หรือพิมพ์เพียงบางส่วนของชื่อกิจกรรม</div>' : (albums.length ? 'อัลบั้มของช่วงนี้แสดงอยู่ในอัลบั้มล่าสุดด้านบนแล้ว' : 'ยังไม่มีอัลบั้มในช่วงนี้ — ลองเลือกปีการศึกษาอื่น')) + '</div>') +
        '<div class="ph-more-wrap" id="phMoreWrap"></div>';
      wireAlbumCovers(root); loadManagedCovers(root, (showHero ? hero : []).concat(rest), true); moreBtn();
    }
    function moreBtn() { var w = $('phMoreWrap'); if (w) w.innerHTML = st.more ? '<button type="button" class="btn btn-secondary" id="phMore">โหลดเพิ่มอีก 10 อัลบั้ม</button>' : ''; }
    $('phForm').addEventListener('submit', function (e) { e.preventDefault(); st.q = $('phSearch').value.replace(/\s+/g, ' ').trim(); load(false); });
    $('phSearch').addEventListener('input', function () { if (!this.value.trim() && st.q) { st.q = ''; load(false); } });
    $('phRoot').addEventListener('click', function (e) { var c = e.target.closest('[data-y]'); if (c) { st.year = c.getAttribute('data-y'); load(false); return; } c = e.target.closest('[data-s]'); if (c) { st.sem = c.getAttribute('data-s'); load(false); } }); // 2.32.0
    $('phRoot').addEventListener('click', function (e) {
      if (e.target.closest('#phMore')) { load(true); return; }
      if (e.target.closest('#phVid')) { st.video = !st.video; load(false); return; } // 2.02.4
      var card = e.target.closest('[data-alb]'); if (!card || !e.target.closest('[data-alb-copy]')) return;
      var a = albums.concat(hero).filter(function (x) { return x.id === card.getAttribute('data-alb'); })[0];
      if (a) copyAlbumText(a);
    });
    getSiteSettings().then(function (s0) { var n = (s0 && s0.schoolName) || ''; if (n) $('phSub').textContent = 'ภาพบรรยากาศกิจกรรมของ' + n; }).catch(function () {});
    st.q = new URLSearchParams(location.search).get('q') || ''; $('phSearch').value = st.q;
    load(false);
  
