/* ============================================================
   ПАРАГРАФ — интерактив и анимации
   Чистый ванильный JS, без зависимостей.
   ============================================================ */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Шапка: фон при скролле ---------- */
  const header = document.querySelector(".header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Мобильное меню ---------- */
  const burger = document.querySelector(".burger");
  const mobileMenu = document.querySelector(".mobile-menu");
  if (burger && mobileMenu) {
    const close = () => { mobileMenu.classList.remove("open"); document.body.style.overflow = ""; };
    burger.addEventListener("click", () => {
      mobileMenu.classList.add("open");
      document.body.style.overflow = "hidden";
    });
    mobileMenu.querySelectorAll("[data-close], nav a").forEach((el) =>
      el.addEventListener("click", close)
    );
  }

  /* ---------- Появление секций ----------
     IntersectionObserver для красивой анимации + резервный обработчик
     scroll/resize/load, чтобы контент НИКОГДА не оставался скрытым,
     даже если IO повёл себя нестабильно. */
  const reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (reveals.length) {
    if (reduceMotion) {
      reveals.forEach((el) => el.classList.add("in"));
    } else {
      const show = (el) => el.classList.add("in");
      let io = null;
      if ("IntersectionObserver" in window) {
        io = new IntersectionObserver(
          (entries) => entries.forEach((e) => {
            if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
          }),
          { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
        );
        reveals.forEach((el) => io.observe(el));
      }
      // Резерв: показываем всё, что уже попало во вьюпорт.
      const sweep = () => {
        const vh = window.innerHeight || document.documentElement.clientHeight;
        for (let i = reveals.length - 1; i >= 0; i--) {
          const el = reveals[i];
          if (el.classList.contains("in")) { reveals.splice(i, 1); continue; }
          if (el.getBoundingClientRect().top < vh * 0.92) {
            show(el);
            if (io) io.unobserve(el);
            reveals.splice(i, 1);
          }
        }
      };
      window.addEventListener("scroll", sweep, { passive: true });
      window.addEventListener("resize", sweep, { passive: true });
      window.addEventListener("load", sweep);
      sweep();
    }
  }

  /* ---------- Карточки: подсветка за курсором + 3D-тилт ---------- */
  const fine = window.matchMedia("(pointer:fine)").matches && window.matchMedia("(hover:hover)").matches;
  if (!reduceMotion) {
    document.querySelectorAll(".card, .package").forEach((card) => {
      card.addEventListener("mousemove", (ev) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${ev.clientX - r.left}px`);
        card.style.setProperty("--my", `${ev.clientY - r.top}px`);
        if (fine) {
          const px = (ev.clientX - r.left) / r.width;
          const py = (ev.clientY - r.top) / r.height;
          const rx = (py - 0.5) * -7;
          const ry = (px - 0.5) * 7;
          card.style.transform = `perspective(820px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
        }
      });
      card.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
  }

  /* ---------- FAQ-аккордеон ---------- */
  document.querySelectorAll(".faq-q").forEach((q) => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      const answer = item.querySelector(".faq-a");
      const isOpen = item.classList.contains("open");
      // закрыть остальные
      document.querySelectorAll(".faq-item.open").forEach((other) => {
        if (other !== item) {
          other.classList.remove("open");
          other.querySelector(".faq-a").style.maxHeight = null;
        }
      });
      item.classList.toggle("open", !isOpen);
      answer.style.maxHeight = isOpen ? null : answer.scrollHeight + "px";
    });
  });

  /* ---------- Счётчик-анимация (штраф 300 000 ₽) ---------- */
  const counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
  if (counters.length) {
    const format = (n) => n.toLocaleString("ru-RU");
    const run = (el) => {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      const target = parseInt(el.getAttribute("data-count"), 10);
      if (reduceMotion) { el.textContent = format(target); return; }
      const dur = 1600;
      let start = null;
      const step = (ts) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = format(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      const cio = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } }),
        { threshold: 0.5 }
      );
      counters.forEach((el) => cio.observe(el));
    }
    // Резерв: запускаем счётчик, когда он во вьюпорте (на случай нестабильного IO).
    const csweep = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      counters.forEach((el) => {
        if (!el.dataset.done) {
          const r = el.getBoundingClientRect();
          if (r.top < vh * 0.85 && r.bottom > 0) run(el);
        }
      });
    };
    window.addEventListener("scroll", csweep, { passive: true });
    window.addEventListener("load", csweep);
    csweep();
  }

  /* ---------- Форма заявки: оба согласия включают кнопку ---------- */
  const form = document.querySelector("[data-lead-form]");
  if (form) {
    const consents = Array.prototype.slice.call(form.querySelectorAll("[data-consent]"));
    const submit = form.querySelector("[data-submit]");
    const allOk = () => consents.length > 0 && consents.every((c) => c.checked);
    const sync = () => { submit.disabled = !allOk(); };
    sync();
    consents.forEach((c) => c.addEventListener("change", sync));

    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!allOk()) return;
      // ПДн на сайте НЕ хранятся: заявка уходит в Telegram-бота.
      // (Альтернатива — Formspree: задайте action и method="POST" в <form>
      //  и уберите этот обработчик.)
      const name = (form.querySelector("[name=name]") || {}).value || "";
      const contact = (form.querySelector("[name=contact]") || {}).value || "";
      const tg = form.getAttribute("data-tg") || "https://t.me/paragrafdocbot";
      const text = encodeURIComponent(
        `Здравствуйте! Хочу подобрать документы для репетитора.\nИмя: ${name}\nКонтакт: ${contact}`
      );
      const url = tg.includes("?") ? `${tg}&text=${text}` : `${tg}?text=${text}`;
      window.open(url, "_blank", "noopener");
      const ok = form.querySelector(".form-ok");
      if (ok) ok.style.display = "block";
      form.reset();
      sync();
    });
  }

  /* ---------- Cookie-баннер + веб-аналитика ---------- */
  (function () {
    const banner = document.querySelector(".cookie-banner");
    if (!banner) return;
    let accepted = false;
    try { accepted = localStorage.getItem("paragraf-cookie") === "1"; } catch (e) {}

    const initAnalytics = () => {
      // Веб-аналитика (Яндекс.Метрика). Вставьте код счётчика вместо заглушки —
      // он подключится только ПОСЛЕ согласия пользователя.
      // Пример: (function(m,e,t,r,i,k,a){...})(window,document,'script',
      //   'https://mc.yandex.ru/metrika/tag.js','ym'); ym(XXXXXX,'init',{...});
    };

    if (accepted) { initAnalytics(); return; }
    setTimeout(() => banner.classList.add("show"), 1000);
    const btn = banner.querySelector("[data-cookie-accept]");
    if (btn) btn.addEventListener("click", () => {
      try { localStorage.setItem("paragraf-cookie", "1"); } catch (e) {}
      banner.classList.remove("show");
      initAnalytics();
    });
  })();

  /* ---------- Год в футере ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Параллакс водяного знака § (скролл + мышь) ---------- */
  (function () {
    const wm = document.querySelector(".hero-watermark");
    if (!wm || reduceMotion) return;
    let mx = 0, my = 0, ticking = false;
    const apply = () => {
      ticking = false;
      const r = wm.getBoundingClientRect();
      const fromCenter = (r.top + r.height / 2) - window.innerHeight / 2;
      wm.style.transform = `translate(${mx * 22}px, ${(-fromCenter * 0.10) + my * 20}px)`;
    };
    const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } };
    window.addEventListener("scroll", req, { passive: true });
    if (fine) window.addEventListener("mousemove", (e) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
      req();
    }, { passive: true });
    apply();
  })();

  /* ---------- Полоса прогресса прокрутки ---------- */
  (function () {
    const bar = document.querySelector(".scroll-progress");
    if (!bar) return;
    const upd = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
    };
    upd();
    window.addEventListener("scroll", upd, { passive: true });
    window.addEventListener("resize", upd);
  })();

  /* ---------- Магнитные кнопки ---------- */
  if (fine && !reduceMotion) {
    document.querySelectorAll(".btn-lg, [data-magnetic]").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.4}px)`;
      });
      btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
    });
  }

  /* ---------- Кастомный курсор (точный указатель) ---------- */
  if (fine && !reduceMotion) {
    const dot = document.querySelector(".cursor-dot");
    const ring = document.querySelector(".cursor-ring");
    if (dot && ring) {
      document.documentElement.classList.add("cursor-on");
      let cx = window.innerWidth / 2, cy = window.innerHeight / 2, rx = cx, ry = cy;
      window.addEventListener("mousemove", (e) => {
        cx = e.clientX; cy = e.clientY;
        dot.style.transform = `translate(${cx}px, ${cy}px)`;
      }, { passive: true });
      const loop = () => {
        rx += (cx - rx) * 0.18; ry += (cy - ry) * 0.18;
        ring.style.transform = `translate(${rx}px, ${ry}px)`;
        requestAnimationFrame(loop);
      };
      loop();
      document.querySelectorAll("a, button, .card, .package, .faq-q, input, label, [data-magnetic]").forEach((el) => {
        el.addEventListener("mouseenter", () => ring.classList.add("hover"));
        el.addEventListener("mouseleave", () => ring.classList.remove("hover"));
      });
      window.addEventListener("mousedown", () => ring.classList.add("down"));
      window.addEventListener("mouseup", () => ring.classList.remove("down"));
      document.addEventListener("mouseleave", () => { dot.style.opacity = "0"; ring.style.opacity = "0"; });
      document.addEventListener("mouseenter", () => { dot.style.opacity = ""; ring.style.opacity = ""; });
    }
  }

  /* ---------- Плавающие § на фоне ---------- */
  const floatHost = document.querySelector(".float-paragraphs");
  if (floatHost && !reduceMotion) {
    const N = window.innerWidth < 760 ? 6 : 11;
    for (let i = 0; i < N; i++) {
      const s = document.createElement("span");
      s.textContent = "§";
      const size = 24 + Math.random() * 70;
      s.style.fontSize = size + "px";
      s.style.left = Math.random() * 100 + "vw";
      s.style.animationDuration = 26 + Math.random() * 30 + "s";
      s.style.animationDelay = -Math.random() * 40 + "s";
      floatHost.appendChild(s);
    }
  }

  /* ---------- Canvas: золотая «пыль» ---------- */
  const canvas = document.getElementById("dust");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    let w, h, dots = [], raf;
    const COUNT = () => Math.min(70, Math.floor(window.innerWidth / 22));

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      dots = Array.from({ length: COUNT() }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -(Math.random() * 0.25 + 0.05),
        a: Math.random() * 0.5 + 0.15,
      }));
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.y < -5) { d.y = h + 5; d.x = Math.random() * w; }
        if (d.x < -5) d.x = w + 5;
        if (d.x > w + 5) d.x = -5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217, 164, 65, ${d.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    tick();
    window.addEventListener("resize", resize);
    // пауза, когда вкладка не видна
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else tick();
    });
  }
})();
