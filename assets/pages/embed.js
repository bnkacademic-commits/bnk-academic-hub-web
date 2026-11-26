/* ย้ายมาจากสคริปต์ในหน้า embed.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
(function () {
  var q = {}; location.hash.replace(/^#/, '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
  var box = document.getElementById('emb'), card = q.s === 'card';
  var thumb = function (id, w) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 800); };
  var ic = '<span class="ph-ic"><i class="fa-solid fa-images" aria-hidden="true"></i></span>';
  function fail(t) { box.innerHTML = '<div class="msg"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> ' + escapeHtml(t) + '</div>'; }
  if (!q.a) { fail('ไม่ได้ระบุอัลบั้ม'); return; }
  apiCall('publicAlbumEmbed', { id: q.a }).then(function (d) {
    var a = d.album, url = a.url, n = a.photoCount || 0;
    document.title = a.title;
    var tgt = ' href="' + escapeHtml(url) + '" target="_blank" rel="noopener"';
    var foot = '<div class="e-f"><small><i class="fa-solid fa-images" aria-hidden="true"></i> คลังรูปภาพ' + (d.schoolName ? ' · ' + escapeHtml(d.schoolName) : '') + '</small><a class="btn"' + tgt + '><i class="fa-solid fa-folder-open" aria-hidden="true"></i> ดูรูปทั้งหมด</a></div>';
    var meta = '<small><i class="fa-solid fa-calendar-days" aria-hidden="true"></i> ' + escapeHtml(d.dateLabel || '') + (n ? ' · ' + n + ' รูป' : '') + '</small>';
    var ph = d.photos || [];
    var img = function (id, i, w) { return id ? '<img src="' + (i === 0 && !id ? '' : thumb(id, w)) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-i="' + i + '" />' : ''; };
    if (card || ph.length === 0) {
      var cv = ph[0] ? img(ph[0], 0, 1000) : (a.coverUrl && !/drive\.google\.com/.test(a.coverUrl) ? '<img src="' + escapeHtml(a.coverUrl) + '" alt="" referrerpolicy="no-referrer" data-i="0" />' : ic);
      box.className = 'e e-c';
      box.innerHTML = '<a class="e-c-cv"' + tgt + ' aria-label="ดูรูปทั้งหมด">' + cv + (n ? '<span class="e-c-n"><i class="fa-solid fa-images" aria-hidden="true"></i> ' + n + ' รูป</span>' : '') + '</a>' +
        '<div class="e-h"><b title="' + escapeHtml(a.title) + '">' + escapeHtml(a.title) + '</b>' + meta + '</div>' + foot;
    } else {
      var show = ph.slice(0, 5), k = show.length >= 5 ? 5 : show.length >= 3 ? 3 : show.length;
      show = show.slice(0, k);
      var rest = Math.max(0, n - k);
      box.className = 'e';
      box.innerHTML = '<div class="e-h"><b title="' + escapeHtml(a.title) + '">' + escapeHtml(a.title) + '</b>' + meta + '</div>' +
        '<div class="e-g g' + k + '">' + show.map(function (id, i) {
          var last = i === k - 1 && rest > 0;
          return '<a' + tgt + (last ? ' class="more" data-more="+' + rest + '"' : '') + ' aria-label="ดูรูปทั้งหมด">' + img(id, i, i === 0 ? 1000 : 500) + '</a>';
        }).join('') + '</div>' + foot;
    }
    // รูปย่อจาก Google Drive โหลดไม่ได้ → รูปแรกใช้รูปปกที่เก็บในระบบ · รูปอื่นเป็นไอคอน
    Array.prototype.forEach.call(box.querySelectorAll('img'), function (el) {
      el.addEventListener('error', function () {
        if (el.getAttribute('data-i') === '0' && d.coverData && el.src.indexOf('data:') !== 0) { el.src = d.coverData; return; }
        var p = el.parentNode; el.remove(); if (p && !p.querySelector('.ph-ic')) p.insertAdjacentHTML('afterbegin', ic);
      });
    });
  }).catch(function (e) { fail(e && e.message ? e.message : 'โหลดอัลบั้มไม่สำเร็จ'); });
})();
