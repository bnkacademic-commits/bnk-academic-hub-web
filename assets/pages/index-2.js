/* ย้ายมาจากสคริปต์ในหน้า index.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
        // 1.92.4.271026: มีรูปหน้าเข้าสู่ระบบที่จำไว้ -> ใส่ทันที (ก่อนโหลดค่าตั้งค่า) ไม่เห็นหัวสีม่วงแวบ — ค่าจริงอัปเดตอีกครั้งใน applyBranding()
        (function () { try { var b = JSON.parse(localStorage.getItem('bnkah_brand') || 'null'); if (b && b.loginHeroDataUrl) { var h = document.querySelector('.login-hero'), im = document.createElement('img'); im.className = 'login-hero-img'; im.alt = b.siteName || ''; im.src = b.loginHeroDataUrl; h.appendChild(im); h.classList.add('has-image'); } } catch (e) {} })();
      
