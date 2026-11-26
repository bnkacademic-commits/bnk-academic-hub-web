/* ย้ายมาจากสคริปต์ในหน้า index.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
    mountFooter({ compact: true }); // 1.80: หน้าล็อกอินใช้ footer แบบย่อ
    applyBranding();

    // 2.32.0: ทางลัดใต้กล่องล็อกอิน — เว็บเช็คชื่อ · Care Center · คลังรูปภาพ / ทำเนียบ (เฉพาะที่เปิดสาธารณะ) · ค้นหาเกียรติบัตร
    (function () {
      var KEY = 'bnkah_login_sc', box = document.getElementById('loginSc');
      function paint(v) {
        if (!v) return;
        var L = [
          { u: v.att, t: 'BNK<br>E&#8209;Attendance', i: 'icons/sc-att-192.png', ext: 1 },
          { u: v.care, t: 'BNK<br>Care&nbsp;Center', i: 'icons/sc-care-192.png', ext: 1 },
          v.gal ? { u: 'photos.html', t: 'คลัง<br>รูปภาพ', i: 'icons/app-gallery-192.png' } : null,
          v.dir ? { u: 'directory.html', t: 'ทำเนียบ<br>บุคลากร', i: 'icons/app-directory-192.png' } : null,
          { u: 'certificate.html', t: 'ค้นหา<br>เกียรติบัตร', i: 'icons/app-certs-192.png' }
        ].filter(function (x) { return x && x.u; });
        box.innerHTML = '<div class="login-sc-h">ทางลัด · ไม่ต้องเข้าสู่ระบบ</div><div class="login-sc-g" style="--n:' + L.length + '">' + L.map(function (x) {
          return '<a href="' + escapeHtml(x.u) + '"' + (x.ext ? ' target="_blank" rel="noopener"' : '') + '><img src="' + x.i + '?v=2.32.0" alt="" width="56" height="56" loading="lazy"><span>' + x.t + '</span></a>';
        }).join('') + '</div>';
        box.hidden = false;
      }
      try { paint(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { /* ไม่มีค่าที่จำไว้ */ }
      apiCall('publicShortcuts', {}).then(function (v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ข้าม */ } paint(v); }).catch(function () {});
    })();

    // ถ้าล็อกอินอยู่แล้ว พาไปหน้าที่เหมาะสมทันที
    (function () {
      var s = getSession();
      if (s && getToken()) location.href = homePageFor(s);
    })();

    var form = document.getElementById('loginForm');
    var errorBox = document.getElementById('errorBox');
    var loginBtn = document.getElementById('loginBtn');
    var usernameInput = document.getElementById('username');
    var passwordInput = document.getElementById('password');
    var rememberCheckbox = document.getElementById('rememberMe');

    // ---------- ปุ่มแสดง/ซ่อนรหัสผ่าน (ตั้งแต่ V11.8) ----------
    var togglePasswordBtn = document.getElementById('togglePasswordBtn');
    var togglePasswordIcon = togglePasswordBtn.querySelector('i');
    togglePasswordBtn.addEventListener('click', function () {
      var showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      togglePasswordIcon.classList.toggle('fa-eye', showing);
      togglePasswordIcon.classList.toggle('fa-eye-slash', !showing);
    });

    // ---------- 1.80: จำชื่อผู้ใช้ (เฉพาะชื่อผู้ใช้) + เข้าสู่ระบบอัตโนมัติ ----------
    // เดิม (V11.8) "จดจำฉันไว้ในเบราว์เซอร์นี้" เก็บรหัสผ่านไว้ในเครื่องด้วย — เลิกเก็บแล้ว และลบรหัสผ่านที่เคยเก็บไว้ทิ้งทันที
    // ที่เปิดหน้านี้ (เก็บชื่อผู้ใช้ไว้ให้เหมือนเดิม) · การไม่ต้องล็อกอินบ่อยใช้ "เข้าสู่ระบบอัตโนมัติ" แทน (token ฝั่ง Worker)
    var REMEMBER_LOGIN_KEY = 'bnkah_remember_login';
    var KEEP_PREF_KEY = 'bnkah_keep_pref';
    var keepCheckbox = document.getElementById('keepLogin');
    (function restoreRememberedLogin() {
      try {
        var raw = localStorage.getItem(REMEMBER_LOGIN_KEY);
        if (raw) {
          var saved = JSON.parse(raw);
          if (saved && saved.username) {
            usernameInput.value = saved.username;
            rememberCheckbox.checked = true;
            if ('password' in saved) localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({ username: saved.username }));
          } else localStorage.removeItem(REMEMBER_LOGIN_KEY);
        }
        keepCheckbox.checked = localStorage.getItem(KEEP_PREF_KEY) === '1';
      } catch (e) { /* localStorage อาจถูกปิด หรือค่าที่เก็บไว้เสียหาย — ข้ามไปเฉยๆ */ }
      if (usernameInput.value) passwordInput.focus();
    })();
    var keepInfoBtn = document.getElementById('keepInfoBtn'), keepTip = document.getElementById('keepTip');
    function setKeepTip(open) { keepTip.hidden = !open; keepInfoBtn.setAttribute('aria-expanded', String(open)); }
    keepInfoBtn.addEventListener('click', function (e) { e.stopPropagation(); setKeepTip(keepTip.hidden); });
    keepInfoBtn.addEventListener('mouseenter', function () { if (matchMedia('(hover: hover)').matches) setKeepTip(true); });
    keepInfoBtn.addEventListener('mouseleave', function () { if (matchMedia('(hover: hover)').matches) setKeepTip(false); });
    document.addEventListener('click', function (e) { if (!keepTip.hidden && !e.target.closest('.remember-line')) setKeepTip(false); });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errorBox.hidden = true;
      loginBtn.disabled = true;
      loginBtn.textContent = 'กำลังเข้าสู่ระบบ...';
      try {
        var username = usernameInput.value.trim();
        var password = passwordInput.value;
        var data = await apiCall('login', { username: username, password: password, keep: keepCheckbox.checked, device: deviceInfo() }); // 2.02.0: ชื่ออุปกรณ์
        try {
          if (rememberCheckbox.checked) localStorage.setItem(REMEMBER_LOGIN_KEY, JSON.stringify({ username: username }));
          else localStorage.removeItem(REMEMBER_LOGIN_KEY);
          localStorage.setItem(KEEP_PREF_KEY, keepCheckbox.checked ? '1' : '0');
        } catch (e) { /* localStorage อาจถูกปิด — ไม่กระทบการล็อกอิน แค่จำค่าไว้ให้ไม่ได้ */ }
        setSession(data.token, data.user);
        storeNavFav(data.user.navFav || []); // 2.13.0: เมนูโปรดของบัญชีนี้
        applyAccountTheme(data.user); // 1.41.111026: ใช้ Dark Mode ที่บัญชีนี้เคยเลือกไว้
        location.href = homePageFor(data.user);
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.hidden = false;
        loginBtn.disabled = false;
        loginBtn.textContent = 'เข้าสู่ระบบ';
      }
    });
  
