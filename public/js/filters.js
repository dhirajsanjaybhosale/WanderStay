/**
 * WanderStay Advanced Search & Filter Interactions
 * - Dynamic rating pill selector
 * - Clean URL parameter serialization on form submit
 * - Desktop sidebar toggle
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Rating Pill Selection
    const ratingButtons = document.querySelectorAll('.rating-btn-select');
    ratingButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetInput = document.getElementById(targetId);
        const val = btn.getAttribute('data-val') || '';

        if (targetInput) {
          targetInput.value = val;
        }

        // Toggle active class among siblings with the same data-target
        const parent = btn.closest('.filter-rating-pill-group');
        if (parent) {
          parent.querySelectorAll('.rating-btn-select').forEach(sibling => {
            sibling.classList.remove('active');
          });
          btn.classList.add('active');
        }
      });
    });

    // 2. Form Clean Submission (prevent polluting URL with empty inputs)
    const filterForms = document.querySelectorAll('#desktopFilterForm, #mobileFilterForm');
    filterForms.forEach(form => {
      form.addEventListener('submit', (e) => {
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
          if (input.name && !input.disabled) {
            // Remove empty text/number/select inputs from submission
            if ((input.type === 'text' || input.type === 'search' || input.type === 'number' || input.tagName === 'SELECT' || input.type === 'hidden') && input.value.trim() === '') {
              input.disabled = true;
            }
          }
        });
      });
    });

    // 3. Desktop Sidebar Toggle (Collapse / Expand)
    const toggleSidebarBtn = document.getElementById('toggleDesktopSidebarBtn');
    const filterSidebar = document.getElementById('desktopFilterSidebar');
    const listingsMainCol = document.getElementById('listingsMainCol');

    if (toggleSidebarBtn && filterSidebar && listingsMainCol) {
      toggleSidebarBtn.addEventListener('click', () => {
        const isHidden = filterSidebar.classList.contains('d-none');
        if (isHidden) {
          filterSidebar.classList.remove('d-none');
          toggleSidebarBtn.innerHTML = '<i class="fa-solid fa-sliders me-1"></i> Hide Filters';
        } else {
          filterSidebar.classList.add('d-none');
          toggleSidebarBtn.innerHTML = '<i class="fa-solid fa-sliders me-1"></i> Show Filters';
        }
      });
    }
  });
})();
