/* ย้ายมาจากสคริปต์ในหน้า certificate.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
    var params = new URLSearchParams(location.search);
    var ACT = params.get('a') || '', YEAR = params.get('y') || '', EMBED = params.get('embed') === '1';
    var actItems = [];
    function $(id) { return document.getElementById(id); }
    if (EMBED) { document.body.classList.add('pubc-embed'); $('pubcTopbar').hidden = true; }
    else { mountFooter(); }
    applyBranding();
    getSiteSettings().then(function (s) { var n = (s && s.schoolName) || ''; if (n && !ACT) $('pubcSub').textContent = n + ' · พิมพ์ชื่อของคุณเพื่อดาวน์โหลดเกียรติบัตร'; if (n) document.title = 'ค้นหาเกียรติบัตร — ' + n; }).catch(function () {});

    function semText(s) { return s === 'summer' ? 'ภาคฤดูร้อน' : 'ภาคเรียนที่ ' + s; }
    function mark(text, q) {
      var t = String(text || ''), e = escapeHtml(t);
      if (!q) return e;
      var i = t.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return e;
      return escapeHtml(t.slice(0, i)) + '<mark>' + escapeHtml(t.slice(i, i + q.length)) + '</mark>' + escapeHtml(t.slice(i + q.length));
    }
    function btns(it) {
      if (!it.file) return '<span class="pubc-nofile">ยังไม่เปิดให้ดาวน์โหลด</span>';
      var dl = driveDownloadUrl(it.file.fileUrl) || it.file.fileUrl;
      return '<button type="button" class="btn btn-ghost btn-sm" data-view="' + escapeHtml(it.id) + '"><i class="fa-solid fa-eye"></i> ดู</button>' +
        '<a class="btn btn-success btn-sm" href="' + escapeHtml(dl) + '" target="_blank" rel="noopener" download><i class="fa-solid fa-download"></i> ดาวน์โหลด</a>';
    }
    var shown = [];
    function view(id) {
      var it = shown.filter(function (x) { return x.id === id; })[0];
      if (!it || !it.file) return;
      openFilePreview(it.file.previewUrl || drivePreviewUrl(it.file.fileUrl), it.name + ' — ' + it.activity, it.file.fileUrl, undefined, null, fileKindOf(it.file.name, it.file.mimeType));
    }

    // ---------- โหมดค้นหา ----------
    async function search(q) {
      var res = $('pubcRes');
      q = q.replace(/\s+/g, ' ').trim();
      if (q.replace(/\s/g, '').length < 3) { res.innerHTML = '<div class="pubc-empty">กรุณาพิมพ์อย่างน้อย 3 ตัวอักษร</div>'; return; }
      res.innerHTML = '<div class="loading">กำลังค้นหา...</div>';
      try {
        var r = await apiCall('publicCertSearch', { q: q });
        shown = r.items || [];
        try { history.replaceState(null, '', location.pathname + '?q=' + encodeURIComponent(q) + (EMBED ? '&embed=1' : '')); } catch (e) { /* ไม่เป็นไร */ }
        if (!shown.length) { res.innerHTML = '<div class="pubc-empty"><i class="fa-solid fa-magnifying-glass"></i> ไม่พบเกียรติบัตรที่ตรงกับ "' + escapeHtml(q) + '"<div class="hint">ลองพิมพ์เฉพาะชื่อหรือเฉพาะนามสกุล หรือสอบถามครูผู้รับผิดชอบกิจกรรม</div></div>'; return; }
        res.innerHTML = '<div class="pubc-count">พบ ' + shown.length + ' รายการ</div>' + shown.map(function (it) {
          return '<div class="pubc-card"><div class="pubc-thumb" aria-hidden="true"><i class="fa-solid fa-award"></i></div><div class="pubc-b">' +
            '<div class="pubc-n">' + mark(it.name, q) + (it.cls ? ' <span class="pubc-cls">' + escapeHtml(it.cls) + '</span>' : '') + '</div>' +
            '<div class="pubc-a">' + escapeHtml(it.activity) + (it.competition ? ' · ' + escapeHtml(it.competition) : '') + '</div>' +
            '<div class="pubc-chips">' + (it.award ? '<span class="ordc-chip cert-award"><i class="fa-solid fa-trophy"></i> ' + escapeHtml(it.award) + '</span>' : '') +
              (it.awardLevel ? '<span class="ordc-chip cert-level"><i class="fa-solid fa-layer-group"></i> ' + escapeHtml(it.awardLevel) + '</span>' : '') +
              (it.certNo ? '<span class="ordc-chip cert-nochip"><i class="fa-solid fa-hashtag"></i> ' + mark(it.certNo, q) + '</span>' : '') +
              '<span class="ordc-chip">' + (it.scope === 'internal' ? 'ภายในโรงเรียน' : 'ภายนอกโรงเรียน') + '</span>' +
              '<span class="ordc-chip">' + escapeHtml(formatDateThai(it.certDate)) + '</span></div>' +
            '</div><div class="pubc-act">' + btns(it) + '</div></div>';
        }).join('') + (shown.length >= 60 ? '<div class="hint" style="text-align:center;">แสดง 60 รายการแรก — พิมพ์ชื่อให้ละเอียดขึ้นเพื่อจำกัดผลลัพธ์</div>' : '');
      } catch (err) { res.innerHTML = '<div class="error-box">' + escapeHtml(err.message || 'ค้นหาไม่สำเร็จ') + '</div>'; }
    }

    // ---------- โหมดกิจกรรม ----------
    function renderActivity() {
      var q = $('pubcQ').value.replace(/\s+/g, ' ').trim().toLowerCase();
      var list = actItems.filter(function (it) { return !q || (it.name + ' ' + it.cls + ' ' + it.certNo + ' ' + it.competition).toLowerCase().indexOf(q) !== -1; });
      shown = list;
      var res = $('pubcRes');
      if (!actItems.length) { res.innerHTML = '<div class="pubc-empty">ไม่พบเกียรติบัตรนักเรียนของกิจกรรมนี้</div>'; return; }
      if (!list.length) { res.innerHTML = '<div class="pubc-empty">ไม่พบชื่อที่ค้นหาในกิจกรรมนี้</div>'; return; }
      var groups = [], by = {};
      list.forEach(function (it) {
        var k = it.competition + '|' + it.award + '|' + (it.awardLevel || '');
        if (!by[k]) { by[k] = { competition: it.competition, award: it.award, items: [] }; groups.push(by[k]); }
        by[k].items.push(it);
      });
      var hasNo = list.some(function (it) { return it.certNo; });
      res.innerHTML = groups.map(function (g, gi) {
        var h = (g.competition || g.award || groups.length > 1) ? '<h2 class="pubc-gh"><span class="cert-grp-num">' + (gi + 1) + '</span> ' + escapeHtml(g.competition || 'ผู้ได้รับเกียรติบัตร') + (g.award ? ' <span class="ordc-chip cert-award"><i class="fa-solid fa-trophy"></i> ' + escapeHtml(g.award) + '</span>' : '') + (g.items[0].awardLevel ? ' <span class="ordc-chip cert-level"><i class="fa-solid fa-layer-group"></i> ' + escapeHtml(g.items[0].awardLevel) + '</span>' : '') + '</h2>' : '';
        return h + '<div class="pubc-table"><table><tbody>' + g.items.map(function (it) {
          return '<tr>' + (hasNo ? '<td class="no">' + (it.certNo ? '<span class="cert-no">' + escapeHtml(it.certNo) + '</span>' : '') + '</td>' : '') +
            '<td><b>' + mark(it.name, q) + '</b>' + (it.cls ? ' <span class="pubc-cls">' + escapeHtml(it.cls) + '</span>' : '') + '</td><td class="act">' + btns(it) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      }).join('');
    }
    async function loadActivity() {
      $('pubcTitle').textContent = ACT;
      $('pubcSub').textContent = 'กำลังโหลด...';
      $('pubcQ').placeholder = 'ค้นหาชื่อในกิจกรรมนี้';
      $('pubcHint').hidden = true; $('pubcGo').hidden = true;
      $('pubcBack').hidden = false; $('pubcBack').href = 'certificate.html' + (EMBED ? '?embed=1' : '');
      document.body.classList.add('pubc-actmode');
      document.title = ACT + ' — เกียรติบัตร';
      try {
        var r = await apiCall('publicCertActivity', { a: ACT, y: YEAR });
        actItems = r.items || [];
        var first = actItems[0];
        $('pubcSub').textContent = first ? (first.scope === 'internal' ? 'เกียรติบัตรภายใน' : 'เกียรติบัตรภายนอก') + ' · ' + formatDateThai(first.certDate) + (YEAR ? ' · ปีการศึกษา ' + YEAR : '') + ' · ' + actItems.length + ' คน' : (YEAR ? 'ปีการศึกษา ' + YEAR : '');
        renderActivity();
      } catch (err) { $('pubcSub').textContent = ''; $('pubcRes').innerHTML = '<div class="error-box">' + escapeHtml(err.message || 'โหลดข้อมูลไม่สำเร็จ') + '</div>'; }
    }

    $('pubcRes').addEventListener('click', function (e) { var b = e.target.closest('[data-view]'); if (b) view(b.getAttribute('data-view')); });
    if (ACT) {
      $('pubcQ').addEventListener('input', debounce(renderActivity, 200));
      $('pubcForm').addEventListener('submit', function (e) { e.preventDefault(); renderActivity(); });
      loadActivity();
    } else {
      $('pubcForm').addEventListener('submit', function (e) { e.preventDefault(); search($('pubcQ').value); });
      // 2.32.0: กิจกรรมล่าสุด — กดแล้วเปิดรายชื่อทั้งกิจกรรม
      apiCall('publicCertRecent', {}).then(function (r) {
        var L = (r && r.items) || [], box = $('pubcRecent'); if (!L.length) return;
        box.innerHTML = '<span class="ctx-rl">กิจกรรมล่าสุด:</span>' + L.map(function (x) { return '<a class="bx-chip" href="certificate.html?a=' + encodeURIComponent(x.a) + (x.y ? '&y=' + encodeURIComponent(x.y) : '') + (EMBED ? '&embed=1' : '') + '">' + escapeHtml(x.a) + '</a>'; }).join('');
        box.hidden = false;
      }).catch(function () {});
      var q0 = params.get('q');
      if (q0) { $('pubcQ').value = q0; search(q0); } else { $('pubcQ').focus(); }
    }
  
