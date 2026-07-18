(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const revealItems = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.08 });

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  let progressFrame = null;
  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0;
    root.style.setProperty('--progress', progress.toFixed(4));
    progressFrame = null;
  };

  const requestProgressUpdate = () => {
    if (progressFrame !== null) return;
    progressFrame = window.requestAnimationFrame(updateProgress);
  };

  window.addEventListener('scroll', requestProgressUpdate, { passive: true });
  window.addEventListener('resize', requestProgressUpdate, { passive: true });
  updateProgress();

  document.querySelectorAll('.pressable').forEach((element) => {
    const release = () => element.classList.remove('is-pressed');
    element.addEventListener('pointerdown', () => element.classList.add('is-pressed'));
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('pointerleave', release);
  });

  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const navSections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;
      navLinks.forEach((link) => {
        const current = link.getAttribute('href') === `#${visible.target.id}`;
        if (current) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-25% 0px -60% 0px', threshold: [0, 0.2, 0.5] });

    navSections.forEach((section) => navObserver.observe(section));
  }

  const viewport = document.querySelector('.portfolio-viewport');
  const track = document.querySelector('.portfolio-track');
  const cards = track ? [...track.children] : [];
  const prevButton = document.querySelector('[data-carousel-prev]');
  const nextButton = document.querySelector('[data-carousel-next]');
  const statusValue = document.querySelector('.portfolio-status strong');

  if (!viewport || !track || cards.length === 0) return;

  let x = 0;
  let velocity = 0;
  let currentIndex = 0;
  let dragging = false;
  let activePointer = null;
  let pointerStart = 0;
  let xStart = 0;
  let moved = false;
  let history = [];
  let animationFrame = null;
  let lastFrameTime = 0;

  const bounds = () => ({
    max: 0,
    min: Math.min(0, viewport.clientWidth - track.scrollWidth)
  });

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const rubberband = (overshoot, dimension, constant = 0.55) => (
    (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
  );

  const snapPoints = () => {
    const { min, max } = bounds();
    return cards.map((card) => clamp(-card.offsetLeft, min, max));
  };

  const setX = (nextX) => {
    x = nextX;
    track.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  const updateControls = () => {
    if (statusValue) statusValue.textContent = String(currentIndex + 1);
    if (prevButton) prevButton.disabled = currentIndex === 0;
    if (nextButton) nextButton.disabled = currentIndex === cards.length - 1;
  };

  const nearestIndex = (value) => {
    const points = snapPoints();
    return points.reduce((best, point, index) => (
      Math.abs(point - value) < Math.abs(points[best] - value) ? index : best
    ), 0);
  };

  const stopAnimation = () => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
  };

  const animateTo = (target, initialVelocity = 0, dampingRatio = 1) => {
    stopAnimation();

    if (reduceMotion) {
      setX(target);
      return;
    }

    velocity = initialVelocity;
    lastFrameTime = performance.now();
    const response = 0.4;
    const stiffness = Math.pow((2 * Math.PI) / response, 2);
    const damping = 2 * dampingRatio * Math.sqrt(stiffness);

    const step = (time) => {
      const delta = Math.min((time - lastFrameTime) / 1000, 0.032);
      lastFrameTime = time;
      const acceleration = -stiffness * (x - target) - damping * velocity;
      velocity += acceleration * delta;
      setX(x + velocity * delta);

      if (Math.abs(velocity) < 2 && Math.abs(target - x) < 0.5) {
        setX(target);
        animationFrame = null;
        return;
      }

      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);
  };

  const goTo = (index, releaseVelocity = 0, fromGesture = false) => {
    currentIndex = clamp(index, 0, cards.length - 1);
    const target = snapPoints()[currentIndex];
    animateTo(target, releaseVelocity, fromGesture ? 0.82 : 1);
    updateControls();
  };

  const project = (initialVelocity, decelerationRate = 0.99) => (
    (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate)
  );

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stopAnimation();
    activePointer = event.pointerId;
    viewport.setPointerCapture(event.pointerId);
    dragging = true;
    moved = false;
    pointerStart = event.clientX;
    xStart = x;
    history = [{ x: event.clientX, time: performance.now() }];
    viewport.classList.add('is-dragging');
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== activePointer) return;
    const delta = event.clientX - pointerStart;
    if (!moved && Math.abs(delta) < 10) return;
    moved = true;

    const { min, max } = bounds();
    let nextX = xStart + delta;
    if (nextX > max) nextX = max + rubberband(nextX - max, viewport.clientWidth);
    if (nextX < min) nextX = min + rubberband(nextX - min, viewport.clientWidth);
    setX(nextX);

    const now = performance.now();
    history.push({ x: event.clientX, time: now });
    history = history.filter((item) => now - item.time < 120);
  });

  const endDrag = (event) => {
    if (!dragging || event.pointerId !== activePointer) return;
    dragging = false;
    viewport.classList.remove('is-dragging');

    const latest = history[history.length - 1];
    const earliest = history[0];
    const elapsed = latest && earliest ? Math.max(latest.time - earliest.time, 1) : 1;
    const releaseVelocity = latest && earliest ? ((latest.x - earliest.x) / elapsed) * 1000 : 0;
    const projectedX = x + project(releaseVelocity);
    const index = moved ? nearestIndex(projectedX) : currentIndex;
    goTo(index, releaseVelocity, true);
    activePointer = null;
  };

  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  viewport.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(currentIndex - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(currentIndex + 1);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      goTo(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      goTo(cards.length - 1);
    }
  });

  prevButton?.addEventListener('click', () => goTo(currentIndex - 1));
  nextButton?.addEventListener('click', () => goTo(currentIndex + 1));

  let resizeFrame = null;
  window.addEventListener('resize', () => {
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      stopAnimation();
      setX(snapPoints()[currentIndex]);
      resizeFrame = null;
    });
  }, { passive: true });

  setX(0);
  updateControls();
})();
