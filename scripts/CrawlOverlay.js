import { MODULE_ID } from './config.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CrawlOverlay extends HandlebarsApplicationMixin(ApplicationV2) {

  static _instance = null;
  #crawlData = {};
  #audio = null;
  #audioFadeInterval = null;
  #fadeTimer = null;
  #fading = false;

  static DEFAULT_OPTIONS = {
    tag: 'section',
    id: 'hqp-crawl-overlay',
    classes: ['hqp-opening-crawl'],
    window: { frame: false, positioned: false, controls: [] },
    position: { width: '100%', height: '100%', top: 0, left: 0 },
    actions: {
      stopCrawl: CrawlOverlay._onStop
    }
  };

  static PARTS = {
    crawl: { template: `modules/${MODULE_ID}/templates/crawl-overlay.hbs` }
  };

  constructor(crawlData) {
    super();
    this.#crawlData = crawlData;
  }

  async _prepareContext() {
    const d = this.#crawlData;
    const paragraphs = (d.body || '').split(/\n\s*\n/).filter(p => p.trim());
    const bodyHtml = paragraphs.map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`).join('');

    // Timing: intro 6s, then campaign title 6s, crawl follows quickly
    const hasIntro = d.showIntro && d.introText;
    const hasCampaign = !!d.campaignTitle;
    let introDelay = 1;
    let campaignDelay = hasIntro ? 8 : 1;
    let crawlDelay = 0;
    if (hasCampaign) crawlDelay = campaignDelay + 4;
    else if (hasIntro) crawlDelay = 8;

    const fontStyle = f => (f && f !== 'Default') ? `font-family: '${f}', sans-serif;` : '';

    return {
      title: d.title || '',
      subtitle: d.subtitle || '',
      body: d.body || '',
      bodyHtml,
      backgroundImage: d.backgroundImage || '',
      speed: d.speed || 90,
      angle: d.angle ?? 27,
      viewportFontSize: 420 * ((d.textScale ?? 100) / 100),
      // Keep visual width constant as font-size scales: em shrinks inversely
      // so fewer characters fit per line at larger sizes.
      viewportWidth: 18 * (100 / (d.textScale ?? 100)),
      viewportMargin: 9 * (100 / (d.textScale ?? 100)),
      campaignFontSize: 600 * ((d.campaignScale ?? 100) / 100),
      color: d.color || '#FFFF82',
      titleColor: d.titleColor || d.color || '#FFFF82',
      subtitleColor: d.subtitleColor || d.color || '#FFFF82',
      showIntro: hasIntro,
      introText: d.introText || '',
      introColor: d.introColor || '#4BD5EE',
      introFontStyle: fontStyle(d.introFont),
      campaignTitle: d.campaignTitle || '',
      campaignTitleColor: d.campaignTitleColor || d.color || '#FFFF82',
      campaignTitleFontStyle: fontStyle(d.campaignTitleFont),
      titleFontStyle: fontStyle(d.titleFont),
      subtitleFontStyle: fontStyle(d.subtitleFont),
      bodyFontStyle: fontStyle(d.bodyFont),
      introDelay,
      campaignDelay,
      crawlDelay,
      showStop: game.user.isGM
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const wrapper = this.element.querySelector('.hqp-crawl-wrapper');
    const showStars = this.#crawlData.showStars ?? true;
    if (wrapper && !this.#crawlData.backgroundImage && showStars) {
      for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'hqp-star';
        star.style.top = Math.floor(Math.random() * wrapper.clientHeight) + 'px';
        star.style.left = Math.floor(Math.random() * wrapper.clientWidth) + 'px';
        wrapper.appendChild(star);
      }
    }

    const content = this.element.querySelector('.hqp-crawl-content');
    if (content) {
      content.addEventListener('animationend', () => {
        CrawlOverlay.stop();
      }, { once: true });
    }

    if (this.#crawlData.music) {
      this.#playAudio(this.#crawlData.music, this.#crawlData.volume);
    }

    // Calculate when half the text has scrolled past top of viewport.
    // Animation: top goes from 100% to -170% over `speed` seconds.
    // Total travel = 270% of viewport height.
    // The vanishing point is at top: 0%.
    // Text starts at top: 100%, so top of text reaches 0% after
    //   scrolling 100% out of 270% => at time (100/270) * speed.
    // Half the text height past 0% means we need an extra
    //   (textHeight / 2) of scrolling in viewport-% terms.
    // We measure textHeight after render to get this right.
    this.#scheduleFade(content);
  }

  #scheduleFade(content) {
    if (!content) return;

    requestAnimationFrame(() => {
      const viewport = content.parentElement;
      if (!viewport) return;

      const viewportH = viewport.offsetHeight;
      const contentH = content.offsetHeight;
      const speed = (this.#crawlData.speed || 90) * 1000;

      // Account for intro/campaign delays before crawl starts
      const hasIntro = this.#crawlData.showIntro && this.#crawlData.introText;
      const hasCampaign = !!this.#crawlData.campaignTitle;
      let crawlDelay = 0;
      if (hasCampaign) crawlDelay = (hasIntro ? 8 : 1) + 4;
      else if (hasIntro) crawlDelay = 8;
      const crawlDelayMs = crawlDelay * 1000;

      // Start fading when nearly all the text has scrolled past the readable
      // zone. The base vanish point (45) was tuned for the default 27 degree tilt.
      // Steeper angles compress text at the top more, so it vanishes sooner.
      // Shallower angles keep it readable further up. Scale using cosine ratio.
      const angle = this.#crawlData.angle ?? 27;
      const angleRatio = Math.cos(angle * Math.PI / 180) / Math.cos(27 * Math.PI / 180);
      const baseVanish = 45 * angleRatio;
      const contentPct = (contentH / viewportH) * 100;
      // 0.65 = wait until 65% of content has passed before fading.
      // Cap at 90% of total travel so the fade always finishes before animationend.
      const scrollNeeded = Math.min(baseVanish + (contentPct * 0.6), 270 * 0.9);
      const totalTravel = 270;
      const triggerTime = crawlDelayMs + (scrollNeeded / totalTravel) * speed;

      this.#fadeTimer = setTimeout(() => {
        if (!this.#fading) this.#beginFadeOut();
      }, triggerTime);
    });
  }

  #beginFadeOut() {
    this.#fading = true;

    // Slow fade to black over 4 seconds
    const fadeDuration = 4000;

    const wrapper = this.element?.querySelector('.hqp-crawl-wrapper');
    if (wrapper) {
      wrapper.style.transition = `opacity ${fadeDuration}ms ease-in`;
      wrapper.style.opacity = '0';
    }

    // Fade audio over 6 seconds
    const audioFadeDuration = 6000;
    if (this.#audio) {
      const startVol = this.#audio.volume ?? 0.8;
      const steps = 40;
      const interval = audioFadeDuration / steps;
      const volStep = startVol / steps;
      let currentStep = 0;

      this.#audioFadeInterval = setInterval(() => {
        currentStep++;
        const newVol = Math.max(0, startVol - volStep * currentStep);
        try { this.#audio.volume = newVol; } catch {}
        if (currentStep >= steps) {
          clearInterval(this.#audioFadeInterval);
          this.#audioFadeInterval = null;
        }
      }, interval);
    }

    // Close after audio fade finishes + buffer
    setTimeout(() => {
      CrawlOverlay.stop();
    }, audioFadeDuration + 700);
  }

  async #playAudio(src, volume) {
    try {
      this.#audio = await foundry.audio.AudioHelper.play({
        src,
        volume: volume ?? 0.8,
        loop: false
      });
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not play crawl audio:`, err);
    }
  }

  #stopAudio() {
    if (this.#audio) {
      this.#audio.stop?.();
      this.#audio = null;
    }
  }

  #cleanup() {
    if (this.#fadeTimer) {
      clearTimeout(this.#fadeTimer);
      this.#fadeTimer = null;
    }
    if (this.#audioFadeInterval) {
      clearInterval(this.#audioFadeInterval);
      this.#audioFadeInterval = null;
    }
    this.#stopAudio();
  }

  async close(options) {
    this.#cleanup();
    CrawlOverlay._instance = null;

    // Place curtain BEFORE closing so there's no flash
    CrawlOverlay.#fadeFromBlack();
    await super.close(options);
  }

  static #fadeFromBlack() {
    const curtain = document.createElement('div');
    curtain.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99998;
      background: #000;
      opacity: 1;
      transition: opacity 2s ease-out;
      pointer-events: none;
    `;
    document.body.appendChild(curtain);

    // Trigger the fade after a frame so the transition fires
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        curtain.style.opacity = '0';
      });
    });

    curtain.addEventListener('transitionend', () => {
      curtain.remove();
    }, { once: true });
  }

  // --- Static API ---

  static async play(crawlData) {
    if (CrawlOverlay._instance) {
      await CrawlOverlay._instance.close();
    }
    const overlay = new CrawlOverlay(crawlData);
    CrawlOverlay._instance = overlay;
    await overlay.render(true);
  }

  static async stop() {
    if (CrawlOverlay._instance) {
      await CrawlOverlay._instance.close();
    }
  }

  static _onStop(event, target) {
    import('./crawl-socket.js').then(m => m.emitCrawlStop());
  }
}
