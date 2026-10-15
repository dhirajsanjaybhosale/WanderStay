/**
 * WanderStay Cinematic Image Gallery & Full-Screen Viewer
 * - Responsive hero gallery with thumbnail swapping and smooth crossfades
 * - Full-screen modal lightbox with keyboard shortcuts
 * - Next / Previous controls and live image counter
 * - Touch swipe support for mobile devices
 * - Preloading and graceful image error fallback
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Data Retrieval
    const dataEl = document.getElementById('listingGalleryData');
    if (!dataEl) return;

    let galleryPhotos = [];
    try {
      galleryPhotos = JSON.parse(dataEl.textContent);
    } catch (e) {
      console.warn('Could not parse gallery photos json:', e);
      return;
    }

    if (!Array.isArray(galleryPhotos) || galleryPhotos.length === 0) return;

    const totalPhotos = galleryPhotos.length;
    let currentIndex = 0;

    // 2. Main Page Elements
    const heroImg = document.getElementById('main-gallery-img');
    const heroContainer = document.getElementById('galleryMainHero');
    const pageThumbs = document.querySelectorAll('.gallery-interactive-thumb');
    const sideThumbs = document.querySelectorAll('.gallery-side-thumb');
    const openAllBtns = document.querySelectorAll('.open-gallery-modal-trigger');

    // 3. Lightbox Modal Elements
    const lightbox = document.getElementById('cinematicLightbox');
    if (!lightbox) return;

    const lbCloseBtn = document.getElementById('lbCloseBtn');
    const lbPrevBtn = document.getElementById('lbPrevBtn');
    const lbNextBtn = document.getElementById('lbNextBtn');
    const lbMainImg = document.getElementById('lbMainImage');
    const lbCounterCurrent = document.getElementById('lbCurrentIndex');
    const lbCounterTotal = document.getElementById('lbTotalCount');
    const lbThumbTray = document.getElementById('lbThumbTray');
    const lbMediaWrapper = document.getElementById('lbMediaWrapper');
    const lbSpinner = document.getElementById('lbSpinner');

    if (lbCounterTotal) {
      lbCounterTotal.textContent = totalPhotos;
    }

    // --- On-Page Hero Swapping with Crossfade ---
    function setPageHero(index) {
      if (index < 0 || index >= totalPhotos) return;
      currentIndex = index;
      const photo = galleryPhotos[currentIndex];
      const targetSrc = photo.hero || photo.original;

      if (heroImg && heroImg.src !== targetSrc) {
        heroImg.style.opacity = '0.35';
        heroImg.style.transform = 'scale(0.985)';

        setTimeout(() => {
          heroImg.src = targetSrc;
          heroImg.style.opacity = '1';
          heroImg.style.transform = 'scale(1)';
        }, 160);
      }

      // Update active thumbnail border on the page
      pageThumbs.forEach(btn => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (idx === currentIndex) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Attach click listeners to page thumbnail strip
    pageThumbs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        setPageHero(idx);
      });
    });

    // Side thumbnails click opens lightbox or swaps
    sideThumbs.forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = parseInt(thumb.getAttribute('data-index'), 10) || 0;
        openLightbox(idx);
      });
    });

    // Clicking hero image opens full-screen lightbox
    if (heroContainer) {
      heroContainer.addEventListener('click', () => {
        openLightbox(currentIndex);
      });
    }

    // Open full gallery buttons
    openAllBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openLightbox(currentIndex);
      });
    });

    // --- Full-Screen Lightbox Functionality ---
    function openLightbox(index = 0) {
      currentIndex = (index + totalPhotos) % totalPhotos;
      lightbox.classList.remove('d-none');
      // Trigger reflow for animation
      void lightbox.offsetWidth;
      lightbox.classList.add('lightbox-visible');
      document.body.style.overflow = 'hidden';

      showLightboxPhoto(currentIndex);
      window.addEventListener('keydown', handleKeydown);
    }

    function closeLightbox() {
      lightbox.classList.remove('lightbox-visible');
      setTimeout(() => {
        lightbox.classList.add('d-none');
        document.body.style.overflow = '';
      }, 250);

      window.removeEventListener('keydown', handleKeydown);
    }

    function showLightboxPhoto(index) {
      currentIndex = (index + totalPhotos) % totalPhotos;
      const photo = galleryPhotos[currentIndex];
      const fullUrl = photo.full || photo.original;

      if (lbCounterCurrent) {
        lbCounterCurrent.textContent = currentIndex + 1;
      }

      if (lbMainImg) {
        lbMainImg.style.opacity = '0';
        lbMainImg.style.transform = 'scale(0.96)';
        if (lbSpinner) lbSpinner.classList.remove('d-none');

        const tempImg = new Image();
        tempImg.onload = () => {
          lbMainImg.src = fullUrl;
          lbMainImg.style.opacity = '1';
          lbMainImg.style.transform = 'scale(1)';
          if (lbSpinner) lbSpinner.classList.add('d-none');
        };
        tempImg.onerror = () => {
          lbMainImg.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85';
          lbMainImg.style.opacity = '1';
          lbMainImg.style.transform = 'scale(1)';
          if (lbSpinner) lbSpinner.classList.add('d-none');
        };
        tempImg.src = fullUrl;
      }

      // Update lightbox bottom tray
      if (lbThumbTray) {
        const trayItems = lbThumbTray.querySelectorAll('.lb-tray-thumb');
        trayItems.forEach(item => {
          const itemIdx = parseInt(item.getAttribute('data-index'), 10);
          if (itemIdx === currentIndex) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          } else {
            item.classList.remove('active');
          }
        });
      }

      // Sync on-page hero with lightbox navigation
      setPageHero(currentIndex);

      // Preload adjacent images
      preloadAdjacent(currentIndex);
    }

    function preloadAdjacent(idx) {
      const nextIdx = (idx + 1) % totalPhotos;
      const prevIdx = (idx - 1 + totalPhotos) % totalPhotos;
      [nextIdx, prevIdx].forEach(i => {
        const p = galleryPhotos[i];
        if (p && (p.full || p.original)) {
          const img = new Image();
          img.src = p.full || p.original;
        }
      });
    }

    function nextPhoto() {
      showLightboxPhoto(currentIndex + 1);
    }

    function prevPhoto() {
      showLightboxPhoto(currentIndex - 1);
    }

    // Lightbox Controls
    if (lbCloseBtn) lbCloseBtn.addEventListener('click', closeLightbox);
    if (lbNextBtn) lbNextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextPhoto(); });
    if (lbPrevBtn) lbPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevPhoto(); });

    // Click outside to close (media wrapper click)
    if (lbMediaWrapper) {
      lbMediaWrapper.addEventListener('click', (e) => {
        if (e.target === lbMediaWrapper) {
          closeLightbox();
        }
      });
    }

    // Keyboard controls
    function handleKeydown(e) {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowRight' || e.key === 'Right') {
        nextPhoto();
      } else if (e.key === 'ArrowLeft' || e.key === 'Left') {
        prevPhoto();
      }
    }

    // Lightbox Tray clicks
    if (lbThumbTray) {
      lbThumbTray.addEventListener('click', (e) => {
        const thumbBtn = e.target.closest('.lb-tray-thumb');
        if (thumbBtn) {
          const idx = parseInt(thumbBtn.getAttribute('data-index'), 10);
          if (!isNaN(idx)) {
            showLightboxPhoto(idx);
          }
        }
      });
    }

    // --- Mobile Touch Swipe Support ---
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    const swipeTarget = lbMediaWrapper || lightbox;

    swipeTarget.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    swipeTarget.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length === 1) {
        touchEndX = e.touches[0].clientX;
        touchEndY = e.touches[0].clientY;
      }
    }, { passive: true });

    swipeTarget.addEventListener('touchend', () => {
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      // Only handle if horizontal swipe is significantly greater than vertical
      if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          // Swiped Left -> Next
          nextPhoto();
        } else {
          // Swiped Right -> Prev
          prevPhoto();
        }
      }

      // Reset
      touchStartX = 0;
      touchStartY = 0;
      touchEndX = 0;
      touchEndY = 0;
    });

    // Also support swipe on page hero for mobile
    if (heroContainer) {
      let heroStartX = 0;
      let heroEndX = 0;

      heroContainer.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
          heroStartX = e.touches[0].clientX;
        }
      }, { passive: true });

      heroContainer.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches.length === 1) {
          heroEndX = e.changedTouches[0].clientX;
          const diff = heroEndX - heroStartX;
          if (diff < -50) {
            setPageHero((currentIndex + 1) % totalPhotos);
          } else if (diff > 50) {
            setPageHero((currentIndex - 1 + totalPhotos) % totalPhotos);
          }
        }
      });
    }
  });
})();
