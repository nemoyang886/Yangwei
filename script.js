(() => {
  const root = document.documentElement;
  const revealItems = [...document.querySelectorAll('.reveal')];

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  let progressFrame = null;
  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
    root.style.setProperty('--scroll-progress', progress.toFixed(4));
    progressFrame = null;
  };

  const requestProgressUpdate = () => {
    if (progressFrame !== null) return;
    progressFrame = window.requestAnimationFrame(updateProgress);
  };

  window.addEventListener('scroll', requestProgressUpdate, { passive: true });
  window.addEventListener('resize', requestProgressUpdate, { passive: true });
  updateProgress();

  const planningBoard = document.querySelector('#planning-board');
  const clarifyButton = planningBoard?.querySelector('.clarify-button');
  const clarifyLabel = clarifyButton?.querySelector('span');

  clarifyButton?.addEventListener('click', () => {
    const isClarified = planningBoard.classList.toggle('is-clarified');
    clarifyButton.setAttribute('aria-pressed', String(isClarified));
    if (clarifyLabel) {
      clarifyLabel.textContent = isClarified ? '再放回原样' : '把问题理顺一点';
    }
  });

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];

  const selectTab = (selectedTab, moveFocus = true) => {
    tabs.forEach((tab) => {
      const isSelected = tab === selectedTab;
      tab.setAttribute('aria-selected', String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    });

    panels.forEach((panel) => {
      panel.hidden = panel.id !== selectedTab.getAttribute('aria-controls');
    });

    if (moveFocus) selectedTab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab, false));
    tab.addEventListener('keydown', (event) => {
      let nextIndex = index;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex === index && !['Home', 'End'].includes(event.key)) return;

      event.preventDefault();
      selectTab(tabs[nextIndex]);
    });
  });

  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const observedSections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && observedSections.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;
      navLinks.forEach((link) => {
        const isCurrent = link.getAttribute('href') === `#${visible.target.id}`;
        if (isCurrent) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-20% 0px -58% 0px', threshold: [0, 0.1, 0.35] });

    observedSections.forEach((section) => sectionObserver.observe(section));
  }
})();
