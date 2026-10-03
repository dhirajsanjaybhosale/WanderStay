document.addEventListener('DOMContentLoaded', function(){
  const navSearchForm = document.querySelector('.nav-search');
  const heroSearchForm = document.querySelector('.hero-search');

  if(navSearchForm && heroSearchForm){
    // hide navbar search when hero search is present (avoids duplicate inputs)
    navSearchForm.style.display = 'none';

    // keep inputs in sync if both exist in DOM for any reason
    const navInput = navSearchForm.querySelector('input[name="q"]');
    const heroInput = heroSearchForm.querySelector('input[name="q"]');
    if(navInput && heroInput){
      // copy initial value
      navInput.value = heroInput.value;
      // sync both ways
      heroInput.addEventListener('input', ()=> navInput.value = heroInput.value);
      navInput.addEventListener('input', ()=> heroInput.value = navInput.value);
    }
  }

  // If category pills are clicked, ensure any visible search input reflects the active category
  const categoryPills = Array.from(document.querySelectorAll('.category-pill'));
  if(categoryPills.length){
    categoryPills.forEach(p => {
      p.addEventListener('click', ()=>{
        const cat = p.textContent.trim();
        const visibleInput = document.querySelector('.hero-search input[name="q"]') || document.querySelector('.nav-search input[name="q"]');
        if(visibleInput) visibleInput.value = cat;
      });
    });
  }
});
