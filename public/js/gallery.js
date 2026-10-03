// WanderStay — Premium Property Gallery Interaction Script
(function () {
  'use strict';

  const mainImg = document.getElementById('main-gallery-img');
  const thumbs = document.querySelectorAll('.gallery-thumb-item img, .thumb-img');

  if (mainImg && thumbs.length) {
    thumbs.forEach(t => {
      t.addEventListener('click', function () {
        const targetSrc = this.getAttribute('data-src') || this.src;
        if (!targetSrc || mainImg.src === targetSrc) return;

        // Smooth cross-fade transition
        mainImg.style.opacity = '0.35';
        mainImg.style.transform = 'scale(0.985)';

        setTimeout(() => {
          mainImg.src = targetSrc;
          mainImg.style.opacity = '1';
          mainImg.style.transform = 'scale(1)';
        }, 180);

        // Highlight active thumbnail
        thumbs.forEach(thumb => thumb.classList.remove('active-thumb'));
        this.classList.add('active-thumb');
      });
    });
  }
})();
