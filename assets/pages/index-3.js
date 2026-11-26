/* ย้ายมาจากสคริปต์ในหน้า index.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
    // 2.33.4: ย้ายรูปหัวการ์ด + ทางลัดไปฝั่งซ้ายเมื่อจอกว้าง (กลับเข้าการ์ด / ใต้การ์ดเมื่อจอแคบ)
    (function () {
      var mq = window.matchMedia ? window.matchMedia('(min-width: 860px)') : null;
      var side = document.getElementById('loginSide'), card = document.querySelector('.login-card'), wrap = document.querySelector('.login-wrap');
      var hero = document.querySelector('.login-hero'), sc = document.getElementById('loginSc'), mid = side.querySelector('.login-side-mid');
      function place() {
        if (mq && mq.matches) { if (hero.parentNode !== side) side.insertBefore(hero, mid); if (sc.parentNode !== side) side.appendChild(sc); }
        else { if (hero.parentNode !== card) card.insertBefore(hero, card.firstChild); if (sc.parentNode !== wrap) wrap.appendChild(sc); }
      }
      place();
      if (mq) { if (mq.addEventListener) mq.addEventListener('change', place); else if (mq.addListener) mq.addListener(place); }
    })();
  
