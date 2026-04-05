// ============================================================
// SANATAN BIRADARI SEVA TRUST — script.js
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // ---- DOM refs ----
  const navbar      = document.getElementById('navbar');
  const hamburger   = document.getElementById('hamburger');
  const navLinks    = document.getElementById('navLinks');
  const backToTop   = document.getElementById('backToTop');
  const contactForm = document.getElementById('contactForm');

  // ============================================================
  // NAVBAR: scroll + hamburger
  // ============================================================
  function updateNavbar () {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  // Close mobile menu when a link is clicked
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });

  // ============================================================
  // BACK TO TOP BUTTON
  // ============================================================
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  }, { passive: true });

  // ============================================================
  // SCROLL REVEAL (IntersectionObserver)
  // ============================================================
  const revealEls = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger children inside same parent
        const siblings = Array.from(entry.target.parentElement.querySelectorAll('.reveal'));
        const idx = siblings.indexOf(entry.target);
        const delay = idx * 80;

        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);

        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealEls.forEach(el => revealObserver.observe(el));

  // ============================================================
  // SMOOTH SCROLLING for anchor links
  // ============================================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const offset = navbar.offsetHeight + 8;
      const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ============================================================
  // FORM VALIDATION
  // ============================================================
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const nameInput  = document.getElementById('name');
      const phoneInput = document.getElementById('phone');
      const nameErr    = document.getElementById('nameErr');
      const phoneErr   = document.getElementById('phoneErr');
      const formSuccess= document.getElementById('formSuccess');

      let valid = true;

      // Reset states
      nameInput.classList.remove('error');
      phoneInput.classList.remove('error');
      nameErr.classList.remove('visible');
      phoneErr.classList.remove('visible');
      formSuccess.classList.remove('visible');

      // Validate name
      if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
        nameInput.classList.add('error');
        nameErr.classList.add('visible');
        valid = false;
      }

      // Validate phone (10 digits)
      const phoneVal = phoneInput.value.trim().replace(/\s+/g, '');
      if (!/^\d{10}$/.test(phoneVal)) {
        phoneInput.classList.add('error');
        phoneErr.classList.add('visible');
        valid = false;
      }

      if (valid) {
        // Simulate submission
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        setTimeout(() => {
          contactForm.reset();
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          formSuccess.classList.add('visible');

          setTimeout(() => {
            formSuccess.classList.remove('visible');
          }, 5000);
        }, 1200);
      }
    });

    // Live inline validation — remove error on input
    document.getElementById('name').addEventListener('input', function () {
      this.classList.remove('error');
      document.getElementById('nameErr').classList.remove('visible');
    });
    document.getElementById('phone').addEventListener('input', function () {
      this.classList.remove('error');
      document.getElementById('phoneErr').classList.remove('visible');
    });
  }

  // ============================================================
  // ACTIVE NAV LINK HIGHLIGHT on scroll
  // ============================================================
  const sections = document.querySelectorAll('section[id]');

  function highlightNav () {
    const scrollY = window.scrollY + navbar.offsetHeight + 40;
    sections.forEach(section => {
      const top    = section.offsetTop;
      const height = section.offsetHeight;
      const id     = section.getAttribute('id');
      const link   = document.querySelector(`.nav-links a[href="#${id}"]`);
      if (!link) return;
      if (scrollY >= top && scrollY < top + height) {
        document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', highlightNav, { passive: true });

  // ============================================================
  // STAT COUNTER ANIMATION
  // ============================================================
  function animateCounter (el, target, suffix, duration) {
    let start = 0;
    const step = duration / 60;
    const increment = target / (duration / (1000 / 60));

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        el.textContent = target + suffix;
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(start) + suffix;
      }
    }, step);
  }

  const statNums = document.querySelectorAll('.stat-num');
  const statData = [
    { target: 500, suffix: '+' },
    { target: 10,  suffix: '+' },
    { target: 100, suffix: '%' },
  ];

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        statNums.forEach((el, i) => {
          const data = statData[i];
          if (data) animateCounter(el, data.target, data.suffix, 1200);
        });
        statsObserver.disconnect();
      }
    });
  }, { threshold: 0.5 });

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) statsObserver.observe(heroStats);

});
