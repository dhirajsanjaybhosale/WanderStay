// WanderStay — Next-Gen Cinematic UI Engine
(function () {
  'use strict';

  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

  /* ==========================================================================
     1. THEME CONTROLLER (Cinematic Dark / Warm Light)
     ========================================================================== */
  const savedTheme = localStorage.getItem('wanderstay_theme') || localStorage.getItem('ws-theme');
  const isDarkInitial = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDarkInitial) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  }

  const themeToggles = document.querySelectorAll('#theme-toggle, #theme-toggle-mobile, .theme-toggle-btn');
  const updateToggleIcons = (isDark) => {
    themeToggles.forEach(btn => {
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      }
    });
  };

  updateToggleIcons(document.documentElement.classList.contains('dark') || document.body.classList.contains('dark'));

  themeToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      document.body.classList.toggle('dark', isDark);
      localStorage.setItem('wanderstay_theme', isDark ? 'dark' : 'light');
      localStorage.setItem('ws-theme', isDark ? 'dark' : 'light');
      updateToggleIcons(isDark);
    });
  });

  /* ==========================================================================
     2. NAVBAR CONTROLLER (Hero Transparency & Frosted Glass Morph)
     ========================================================================== */
  const navbar = document.querySelector('.site-navbar');
  const heroSection = document.querySelector('#heroSection');

  if (heroSection) {
    document.body.classList.add('is-home');
  }

  if (navbar) {
    let lastScroll = -1;
    const updateNavbar = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      if (scrollY === lastScroll) return;
      lastScroll = scrollY;

      if (heroSection) {
        if (scrollY > 40) {
          navbar.classList.add('scrolled');
          navbar.classList.remove('navbar-hero-transparent');
        } else {
          navbar.classList.remove('scrolled');
          navbar.classList.add('navbar-hero-transparent');
        }
      } else {
        if (scrollY > 20) {
          navbar.classList.add('scrolled');
        } else {
          navbar.classList.remove('scrolled');
        }
      }
    };

    window.addEventListener('scroll', updateNavbar, { passive: true });
    updateNavbar();
  }

  /* ==========================================================================
     3. KEN BURNS SLIDESHOW CONTROLLER & DESTINATION SWITCHER
     ========================================================================== */
  const heroSlides = document.querySelectorAll('.hero-slide');
  const sceneButtons = document.querySelectorAll('.hero-scene-btn');
  const locationTag = document.querySelector('#heroLocationName');

  if (heroSlides.length > 1) {
    let activeSlideIndex = 0;
    let slideTimer = null;

    const setSlide = (index) => {
      heroSlides.forEach((slide, idx) => {
        if (idx === index) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });

      sceneButtons.forEach((btn, idx) => {
        if (idx === index) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      if (locationTag && heroSlides[index]) {
        const loc = heroSlides[index].getAttribute('data-location') || 'Extraordinary Stay';
        locationTag.style.opacity = '0';
        setTimeout(() => {
          locationTag.textContent = loc;
          locationTag.style.opacity = '1';
        }, 300);
      }

      activeSlideIndex = index;
    };

    const nextSlide = () => {
      const nextIndex = (activeSlideIndex + 1) % heroSlides.length;
      setSlide(nextIndex);
    };

    if (!isReducedMotion) {
      slideTimer = setInterval(nextSlide, 7500);
    }

    sceneButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = parseInt(btn.getAttribute('data-slide'), 10);
        if (!isNaN(target)) {
          setSlide(target);
          if (slideTimer) {
            clearInterval(slideTimer);
            if (!isReducedMotion) {
              slideTimer = setInterval(nextSlide, 8500);
            }
          }
        }
      });
    });

    if (heroSection) {
      const searchWrap = document.querySelector('#heroSearchWrapper');
      if (searchWrap) {
        searchWrap.addEventListener('mouseenter', () => {
          if (slideTimer) clearInterval(slideTimer);
        });
        searchWrap.addEventListener('mouseleave', () => {
          if (!isReducedMotion) {
            slideTimer = setInterval(nextSlide, 7500);
          }
        });
      }
    }
  }

  /* ==========================================================================
     4. MOUSE-DRIVEN 3D DEPTH PARALLAX (Desktop Only, Smooth Lerp)
     ========================================================================== */
  if (heroSection && !isTouchDevice && !isReducedMotion) {
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let isMouseInside = false;

    const slidesLayer = document.querySelector('#heroSlidesContainer');
    const lightOrbs = document.querySelector('.hero-light-orbs');
    const depthElements = document.querySelectorAll('[data-depth]');

    heroSection.addEventListener('mousemove', (e) => {
      const rect = heroSection.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = x * 2;
      targetY = y * 2;
      isMouseInside = true;
    });

    heroSection.addEventListener('mouseleave', () => {
      targetX = 0;
      targetY = 0;
      isMouseInside = false;
    });

    const renderParallax = () => {
      // Smooth linear interpolation (lerp)
      mouseX += (targetX - mouseX) * 0.06;
      mouseY += (targetY - mouseY) * 0.06;

      // Layer 1: Background moves opposite slightly (2.5px)
      if (slidesLayer) {
        slidesLayer.style.transform = `translate3d(${-mouseX * 3}px, ${-mouseY * 3}px, 0)`;
      }

      // Layer 5: Light Orbs move moderately (5px)
      if (lightOrbs) {
        lightOrbs.style.transform = `translate3d(${mouseX * 6}px, ${mouseY * 6}px, 0)`;
      }

      // Layer 6: Foreground depth elements
      depthElements.forEach((el) => {
        const factor = parseFloat(el.getAttribute('data-depth')) || 0.05;
        const pxX = mouseX * factor * 100;
        const pxY = mouseY * factor * 100;
        el.style.transform = `translate3d(${pxX}px, ${pxY}px, 0)`;
      });

      requestAnimationFrame(renderParallax);
    };

    renderParallax();
  }

  /* ==========================================================================
     5. LIGHTWEIGHT ATMOSPHERIC PARTICLES CANVAS SYSTEM
     ========================================================================== */
  const canvas = document.querySelector('#heroParticlesCanvas');
  if (canvas && !isReducedMotion) {
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', onResize, { passive: true });

    const particleCount = isTouchDevice ? 15 : 38;
    const particles = [];

    class Particle {
      constructor() {
        this.reset(true);
      }

      reset(init = false) {
        this.x = Math.random() * width;
        this.y = init ? Math.random() * height : height + 10;
        this.radius = Math.random() * 2 + 0.8;
        this.baseAlpha = Math.random() * 0.35 + 0.12;
        this.alpha = this.baseAlpha;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = -(Math.random() * 0.45 + 0.2);
        this.pulseSpeed = Math.random() * 0.02 + 0.01;
        this.pulseAngle = Math.random() * Math.PI * 2;
        this.isGold = Math.random() > 0.45;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.pulseAngle += this.pulseSpeed;
        this.alpha = this.baseAlpha + Math.sin(this.pulseAngle) * 0.1;

        if (this.y < -10 || this.x < -10 || this.x > width + 10) {
          this.reset(false);
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        if (this.isGold) {
          ctx.fillStyle = `rgba(245, 158, 11, ${Math.max(0, this.alpha)})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, this.alpha)})`;
        }
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    let isVisible = true;
    if ('IntersectionObserver' in window && heroSection) {
      const heroObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            isVisible = entry.isIntersecting;
          });
        },
        { threshold: 0.05 }
      );
      heroObserver.observe(heroSection);
    }

    document.addEventListener('visibilitychange', () => {
      isVisible = !document.hidden;
    });

    const animateParticles = () => {
      if (isVisible) {
        ctx.clearRect(0, 0, width, height);
        particles.forEach((p) => {
          p.update();
          p.draw();
        });
      }
      requestAnimationFrame(animateParticles);
    };

    animateParticles();
  }

  /* ==========================================================================
     6. SEARCH BAR INTERACTION DYNAMICS
     ========================================================================== */
  const searchInput = document.querySelector('#search-where');
  const searchPanel = document.querySelector('.hero-search-panel');
  if (searchInput && searchPanel) {
    searchInput.addEventListener('focus', () => {
      searchPanel.classList.add('is-focused');
    });
    searchInput.addEventListener('blur', () => {
      searchPanel.classList.remove('is-focused');
    });
  }

  // Auto-sync Check-In and Check-Out Dates
  const checkInInput = document.querySelector('#search-checkin');
  const checkOutInput = document.querySelector('#search-checkout');
  if (checkInInput && checkOutInput) {
    const today = new Date().toISOString().split('T')[0];
    checkInInput.min = today;
    checkOutInput.min = today;

    checkInInput.addEventListener('change', () => {
      if (checkInInput.value) {
        checkOutInput.min = checkInInput.value;
        if (checkOutInput.value && checkOutInput.value < checkInInput.value) {
          checkOutInput.value = checkInInput.value;
        }
      }
    });
  }

  /* ==========================================================================
     7. SCROLL REVEAL OBSERVER (Smooth Stagger & Reveal)
     ========================================================================== */
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if (revealElements.length && 'IntersectionObserver' in window) {
    if (isReducedMotion) {
      revealElements.forEach((el) => el.classList.add('is-visible'));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -50px 0px', threshold: 0.08 }
      );

      revealElements.forEach((el) => revealObserver.observe(el));
    }
  }

  /* ==========================================================================
     8. WISHLIST HEART ANIMATION MICRO-INTERACTION
     ========================================================================== */
  document.querySelectorAll('.listing-wishlist-toggle').forEach((btn) => {
    btn.addEventListener('click', function () {
      this.classList.add('heart-pop');
      setTimeout(() => this.classList.remove('heart-pop'), 450);
    });
  });
})();
