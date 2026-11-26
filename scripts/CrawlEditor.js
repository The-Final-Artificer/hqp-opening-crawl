import { MODULE_ID, SETTINGS, CRAWL_DEFAULTS } from './config.js';
import { CrawlOverlay } from './CrawlOverlay.js';
import { emitCrawlPlay } from './crawl-socket.js';
import { FONT_LIST } from './fonts.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CrawlEditor extends HandlebarsApplicationMixin(ApplicationV2) {

  _selectedId = '';

  static DEFAULT_OPTIONS = {
    id: 'hqp-crawl-editor',
    classes: ['hqp-opening-crawl'],
    window: {
      title: 'HQP.Crawl.Editor',
      resizable: true
    },
    position: { width: 1600, height: 920 },
    actions: {
      deleteCrawl: CrawlEditor._onDeleteCrawl,
      saveCrawl: CrawlEditor._onSaveCrawl,
      previewCrawl: CrawlEditor._onPreview,
      playForAll: CrawlEditor._onPlayForAll,
      pickBackground: CrawlEditor._onPickBackground,
      pickMusic: CrawlEditor._onPickMusic
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/crawl-editor.hbs` }
  };

  // --- Data ---

  _getLibrary() {
    return game.settings.get(MODULE_ID, SETTINGS.CRAWL_LIBRARY) || [];
  }

  async _setLibrary(lib) {
    await game.settings.set(MODULE_ID, SETTINGS.CRAWL_LIBRARY, lib);
  }

  _getFormData() {
    const el = this.element;
    if (!el) return {};
    const val = name => el.querySelector(`[name="${name}"]`)?.value ?? '';
    return {
      showIntro: el.querySelector('[name="showIntro"]')?.checked ?? false,
      introText: val('introText'),
      introColor: val('introColor') || '#4BD5EE',
      introFont: val('introFont') || 'Default',
      campaignTitle: val('campaignTitle'),
      campaignTitleColor: val('campaignTitleColor') || CRAWL_DEFAULTS.color,
      campaignTitleFont: val('campaignTitleFont') || 'Default',
      title: val('title'),
      titleFont: val('titleFont') || 'Default',
      subtitle: val('subtitle'),
      subtitleFont: val('subtitleFont') || 'Default',
      body: val('body'),
      bodyFont: val('bodyFont') || 'Default',
      backgroundImage: val('backgroundImage'),
      showStars: el.querySelector('[name="showStars"]')?.checked ?? true,
      music: val('music'),
      speed: Number(val('speed')) || CRAWL_DEFAULTS.speed,
      angle: val('angle') === '' ? CRAWL_DEFAULTS.angle : Number(val('angle')),
      textScale: Number(val('textScale')) || CRAWL_DEFAULTS.textScale,
      campaignScale: Number(val('campaignScale')) || CRAWL_DEFAULTS.campaignScale,
      volume: Number(val('volume')) ?? 0.8,
      color: val('color') || CRAWL_DEFAULTS.color,
      titleColor: val('titleColor') || CRAWL_DEFAULTS.color,
      subtitleColor: val('subtitleColor') || CRAWL_DEFAULTS.color,
      saveName: val('saveName')
    };
  }

  // --- Rendering ---

  async _prepareContext() {
    const library = this._getLibrary();
    const selected = library.find(c => c.id === this._selectedId);

    const body = selected?.body || '';
    const paragraphs = body.split(/\n\s*\n/).filter(p => p.trim());
    const bodyHtml = paragraphs.map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`).join('');

    const textScale = selected?.textScale ?? CRAWL_DEFAULTS.textScale;
    const campaignScale = selected?.campaignScale ?? CRAWL_DEFAULTS.campaignScale;
    const fontStyle = f => (f && f !== 'Default') ? `font-family: '${f}', sans-serif;` : '';

    return {
      fonts: FONT_LIST,
      library,
      selectedId: this._selectedId,
      saveName: selected?.name || '',
      showIntro: selected?.showIntro ?? false,
      introText: selected?.introText || '',
      introColor: selected?.introColor || '#4BD5EE',
      introFont: selected?.introFont || 'Default',
      campaignTitle: selected?.campaignTitle || '',
      campaignTitleColor: selected?.campaignTitleColor || CRAWL_DEFAULTS.color,
      campaignTitleFont: selected?.campaignTitleFont || 'Default',
      title: selected?.title || '',
      titleFont: selected?.titleFont || 'Default',
      subtitle: selected?.subtitle || '',
      subtitleFont: selected?.subtitleFont || 'Default',
      body,
      bodyHtml,
      bodyFont: selected?.bodyFont || 'Default',
      backgroundImage: selected?.backgroundImage || '',
      showStars: selected?.showStars ?? true,
      music: selected?.music || '',
      speed: selected?.speed || CRAWL_DEFAULTS.speed,
      angle: selected?.angle ?? CRAWL_DEFAULTS.angle,
      textScale,
      campaignScale,
      volume: selected?.volume ?? 0.8,
      volumePercent: Math.round((selected?.volume ?? 0.8) * 100),
      color: selected?.color || CRAWL_DEFAULTS.color,
      titleColor: selected?.titleColor || CRAWL_DEFAULTS.color,
      subtitleColor: selected?.subtitleColor || CRAWL_DEFAULTS.color,
      // Precomputed values used by the preview (same formulas as CrawlOverlay)
      viewportFontSize: 420 * (textScale / 100),
      viewportWidth: 18 * (100 / textScale),
      viewportMargin: 9 * (100 / textScale),
      // Preview is locked to a 50% campaign size so the pane layout stays
      // stable regardless of the slider. The slider still drives the real
      // crawl via CRAWL_DEFAULTS / form data read at play time.
      campaignFontSize: 600 * 0.5,
      introFontStyle: fontStyle(selected?.introFont),
      campaignTitleFontStyle: fontStyle(selected?.campaignTitleFont),
      titleFontStyle: fontStyle(selected?.titleFont),
      subtitleFontStyle: fontStyle(selected?.subtitleFont),
      bodyFontStyle: fontStyle(selected?.bodyFont)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this._sizedToScreen) {
      this._sizedToScreen = true;
      this.setPosition({
        width: window.innerWidth,
        height: window.innerHeight,
        top: 0,
        left: 0
      });
    }

    const slider = this.element.querySelector('input[name="speed"]');
    const label = this.element.querySelector('.hqp-speed-value');
    if (slider && label) {
      slider.addEventListener('input', () => {
        label.textContent = `${slider.value}s`;
      });
    }

    const volSlider = this.element.querySelector('input[name="volume"]');
    const volLabel = this.element.querySelector('.hqp-volume-value');
    if (volSlider && volLabel) {
      volSlider.addEventListener('input', () => {
        volLabel.textContent = `${Math.round(volSlider.value * 100)}%`;
      });
    }

    const angleSlider = this.element.querySelector('input[name="angle"]');
    const angleLabel = this.element.querySelector('.hqp-angle-value');
    const updateAngleLabel = () => {
      const deg = Number(angleSlider?.value) || 0;
      if (angleLabel) angleLabel.textContent = `${deg}°`;
    };
    const applyAngle = () => {
      // Stage height depends on angle (tilted text has smaller visual
      // footprint), so refit the whole crawl stage rather than just the
      // transform. The title preview doesn't tilt so it's unaffected.
      this._fitPreviewStage();
    };
    if (angleSlider) {
      angleSlider.addEventListener('input', () => {
        updateAngleLabel();
        applyAngle();
      });
      updateAngleLabel();
      applyAngle();
    }

    const sizeSlider = this.element.querySelector('input[name="textScale"]');
    const sizeLabel = this.element.querySelector('.hqp-textscale-value');
    const campSlider = this.element.querySelector('input[name="campaignScale"]');
    const campSizeLabel = this.element.querySelector('.hqp-campaignscale-value');

    const applySizes = () => {
      const textPct = Number(sizeSlider?.value) || 100;
      const campPct = Number(campSlider?.value) || 100;
      if (sizeLabel) sizeLabel.textContent = `${textPct}%`;
      if (campSizeLabel) campSizeLabel.textContent = `${campPct}%`;

      const viewport = this.element.querySelector('.hqp-crawl-preview-stage .hqp-crawl-viewport');
      if (viewport) {
        viewport.style.fontSize = `${420 * (textPct / 100)}%`;
        viewport.style.width = `${18 * (100 / textPct)}em`;
        viewport.style.marginLeft = `-${9 * (100 / textPct)}em`;
        this._fitPreviewStage();
      }
      // Intentionally not touching the preview's campaign title font size.
      // It's pinned at 50% via _prepareContext so the pane stays stable
      // while the user experiments with the slider.
    };

    for (const s of [sizeSlider, campSlider]) {
      if (s) s.addEventListener('input', applySizes);
    }
    applySizes();

    this._fitPreviewStage();
    this._fitTitlePreview();
    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver(() => {
      this._fitPreviewStage();
      this._fitTitlePreview();
    });
    const crawlPane = this.element.querySelector('.hqp-preview-pane');
    const titlePane = this.element.querySelector('.hqp-title-preview-pane');
    if (crawlPane) this._resizeObserver.observe(crawlPane);
    if (titlePane) this._resizeObserver.observe(titlePane);

    const select = this.element.querySelector('select[name="librarySelect"]');
    if (select) {
      select.addEventListener('change', () => {
        this._selectedId = select.value;
        this.render(true);
      });
    }

    this._bindPreviewUpdates();
    this._bindFontSelects();
  }

  _applyViewportTransform(viewport) {
    const deg = Number(this.element.querySelector('input[name="angle"]')?.value) || 0;
    // transform-origin (50% 100%) lives in the base CSS so the tilt pivots
    // at the viewport's bottom edge, same perceived depth as the real crawl.
    viewport.style.transform = `perspective(325px) rotateX(${deg}deg)`;
  }

  _fitPreviewStage() {
    const pane = this.element?.querySelector('.hqp-preview-pane');
    const stage = this.element?.querySelector('.hqp-crawl-preview-stage');
    const inner = this.element?.querySelector('.hqp-crawl-preview-stage-inner');
    const viewport = this.element?.querySelector('.hqp-crawl-preview-stage .hqp-crawl-viewport');
    const content = this.element?.querySelector('.hqp-crawl-preview-stage .hqp-crawl-content');
    if (!pane || !stage || !inner || !viewport) return;

    const PAD_TOP = 20;
    const MIN_H = 180;
    const PERSPECTIVE = 325; // must match the value in the viewport's transform

    const scale = pane.clientWidth / 1280;
    inner.style.width = '1280px';
    inner.style.transform = `scale(${scale})`;

    this._applyViewportTransform(viewport);

    const rad = (Number(this.element.querySelector('input[name="angle"]')?.value) || 0) * Math.PI / 180;
    const cosTheta = Math.cos(rad);
    const sinTheta = Math.sin(rad);

    // rotateX about the bottom edge tips the top backward; perspective
    // then foreshortens it further. The top of the content lands at:
    //   contentH * cos(angle) * persp / (persp + contentH * sin(angle))
    // below the pivot (i.e. above the stage bottom). Stage height = that
    // projected height + a small top pad so the title lands at y = PAD_TOP.
    const contentH = content?.offsetHeight ?? 0;
    const proj = PERSPECTIVE / (PERSPECTIVE + contentH * sinTheta);
    const visualH = contentH * cosTheta * proj;
    const stageH = Math.max(MIN_H, PAD_TOP + visualH);

    inner.style.height = `${stageH}px`;
    stage.style.height = `${stageH * scale}px`;
  }

  _fitTitlePreview() {
    const pane = this.element?.querySelector('.hqp-title-preview-pane');
    const stage = this.element?.querySelector('.hqp-title-preview-stage');
    const inner = this.element?.querySelector('.hqp-title-preview-stage-inner');
    const intro = this.element?.querySelector('.hqp-title-preview-stage .hqp-intro');
    const campaign = this.element?.querySelector('.hqp-title-preview-stage .hqp-campaign-title');
    if (!pane || !stage || !inner) return;

    const PAD_TOP = 40;
    const PAD_BOTTOM = 40;
    const GAP = 40;
    const MIN_H = 200;

    // offsetHeight is the untransformed box height. The inner stage is
    // transform:scale()'d later, but that's a visual pass only, it doesn't
    // change the measurements we use here.
    const introH = intro?.offsetHeight ?? 0;
    const campH = campaign?.offsetHeight ?? 0;
    const gap = (introH > 0 && campH > 0) ? GAP : 0;
    const stageH = Math.max(MIN_H, PAD_TOP + introH + gap + campH + PAD_BOTTOM);

    // Inline `top` overrides the fallback CSS percentages. Elements center
    // themselves via the translate(-50%, -50%) that lives in the base CSS,
    // so we position them by their vertical center.
    if (intro) intro.style.top = `${PAD_TOP + introH / 2}px`;
    if (campaign) campaign.style.top = `${PAD_TOP + introH + gap + campH / 2}px`;

    const scale = pane.clientWidth / 1280;
    inner.style.width = '1280px';
    inner.style.height = `${stageH}px`;
    inner.style.transform = `scale(${scale})`;
    stage.style.height = `${stageH * scale}px`;
  }

  _bindPreviewUpdates() {
    const el = this.element;

    // Intro + campaign title live in the title preview pane. Everything
    // else (title, subtitle, body) lives in the main crawl preview.
    const textFields = [
      { input: 'introText',     sel: '.hqp-title-preview-stage .hqp-intro' },
      { input: 'campaignTitle', sel: '.hqp-title-preview-stage .hqp-campaign-title' },
      { input: 'title',         sel: '.hqp-crawl-preview-stage .hqp-crawl-title' },
      { input: 'subtitle',      sel: '.hqp-crawl-preview-stage .hqp-crawl-subtitle' },
    ];

    const colorFields = [
      { input: 'introColor',         sel: '.hqp-title-preview-stage .hqp-intro' },
      { input: 'campaignTitleColor', sel: '.hqp-title-preview-stage .hqp-campaign-title' },
      { input: 'titleColor',         sel: '.hqp-crawl-preview-stage .hqp-crawl-title' },
      { input: 'subtitleColor',      sel: '.hqp-crawl-preview-stage .hqp-crawl-subtitle' },
      { input: 'color',              sel: '.hqp-crawl-preview-stage .hqp-crawl-body' },
    ];

    const titleOwned = new Set(['introText', 'campaignTitle']);
    for (const { input, sel } of textFields) {
      const field = el.querySelector(`[name="${input}"]`);
      const node = el.querySelector(sel);
      if (!field || !node) continue;
      field.addEventListener('input', () => {
        node.textContent = field.value;
        node.style.display = field.value ? '' : 'none';
        if (titleOwned.has(input)) this._fitTitlePreview();
      });
    }

    for (const { input, sel } of colorFields) {
      const field = el.querySelector(`[name="${input}"]`);
      const node = el.querySelector(sel);
      if (!field || !node) continue;
      field.addEventListener('input', () => {
        node.style.color = field.value;
      });
    }

    // Body field rebuilds <p> blocks from its textarea so paragraph spacing
    // matches the real crawl, and refits the crawl stage since content height
    // just changed.
    const bodyField = el.querySelector('[name="body"]');
    const bodyNode = el.querySelector('.hqp-crawl-preview-stage .hqp-crawl-body');
    if (bodyField && bodyNode) {
      bodyField.addEventListener('input', () => {
        const paragraphs = bodyField.value.split(/\n\s*\n/).filter(p => p.trim());
        bodyNode.innerHTML = paragraphs.map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`).join('');
        bodyNode.style.display = bodyField.value ? '' : 'none';
        this._fitPreviewStage();
      });
    }

    // Background image + stars (applied to both preview wrappers).
    const bgInput = el.querySelector('[name="backgroundImage"]');
    const starsCheck = el.querySelector('[name="showStars"]');
    const updateBg = () => this._updatePreviewBackground();
    if (bgInput) bgInput.addEventListener('input', updateBg);
    if (starsCheck) starsCheck.addEventListener('change', updateBg);
    this._updatePreviewBackground();
  }

  _bindFontSelects() {
    const el = this.element;

    const fontSelects = el.querySelectorAll('.hqp-font-select');
    for (const sel of fontSelects) {
      const previewSel = sel.dataset.preview;
      const node = el.querySelector(previewSel);

      // Style each option in its own font
      for (const opt of sel.options) {
        if (opt.value && opt.value !== 'Default') {
          opt.style.fontFamily = `'${opt.value}', sans-serif`;
        }
      }

      // Apply initial font
      const initial = sel.value;
      if (initial && initial !== 'Default') {
        sel.style.fontFamily = `'${initial}', sans-serif`;
        if (node) node.style.fontFamily = `'${initial}', sans-serif`;
      }

      sel.addEventListener('change', () => {
        const font = sel.value;
        if (font && font !== 'Default') {
          sel.style.fontFamily = `'${font}', sans-serif`;
          if (node) node.style.fontFamily = `'${font}', sans-serif`;
        } else {
          sel.style.fontFamily = '';
          if (node) node.style.fontFamily = '';
        }
        // Different fonts have different line heights, so the title/body
        // previews may need a resize to stay snug around the text.
        if (previewSel?.includes('title-preview-stage')) this._fitTitlePreview();
        if (previewSel?.includes('crawl-preview-stage')) this._fitPreviewStage();
      });
    }
  }

  _updatePreviewBackground() {
    const el = this.element;
    const wrappers = el?.querySelectorAll('.hqp-crawl-wrapper');
    if (!wrappers?.length) return;

    const bgPath = el.querySelector('[name="backgroundImage"]')?.value;
    const showStars = el.querySelector('[name="showStars"]')?.checked;

    for (const wrapper of wrappers) {
      wrapper.querySelectorAll('.hqp-star').forEach(s => s.remove());

      if (bgPath) {
        wrapper.style.backgroundImage = `url('${bgPath}')`;
        wrapper.style.backgroundSize = 'cover';
        wrapper.style.backgroundPosition = 'center';
      } else {
        wrapper.style.backgroundImage = '';
        if (showStars) {
          // Stars fill the wrapper (which matches stage-inner dimensions)
          // and sit behind the foreground elements.
          const h = wrapper.offsetHeight || 720;
          const w = wrapper.offsetWidth || 1280;
          const count = Math.max(30, Math.round((w * h) / 16000));
          for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.className = 'hqp-star';
            star.style.top = Math.floor(Math.random() * h) + 'px';
            star.style.left = Math.floor(Math.random() * w) + 'px';
            wrapper.appendChild(star);
          }
        }
      }
    }
  }

  async close(options) {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    return super.close(options);
  }

  // --- Actions (`this` = instance, bound by Foundry's action dispatcher) ---

  static async _onDeleteCrawl(event, target) {
    if (!this._selectedId) return;
    const lib = this._getLibrary().filter(c => c.id !== this._selectedId);
    await this._setLibrary(lib);
    this._selectedId = '';
    ui.notifications.info(game.i18n.localize('HQP.Crawl.Deleted'));
    this.render(true);
  }

  static async _onSaveCrawl(event, target) {
    const data = this._getFormData();
    if (!data.saveName) {
      ui.notifications.warn('Enter a name to save the crawl.');
      return;
    }

    const lib = this._getLibrary();

    if (this._selectedId) {
      const existing = lib.find(c => c.id === this._selectedId);
      const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: 'Save Crawl' },
        content: `<p>A crawl named <strong>${existing?.name || this._selectedId}</strong> already exists.</p>`,
        buttons: [
          { action: 'overwrite', label: 'Overwrite', icon: 'fas fa-save' },
          { action: 'new', label: 'Save as New', icon: 'fas fa-plus' },
          { action: 'cancel', label: 'Cancel', icon: 'fas fa-times' }
        ]
      });

      if (choice === 'cancel' || !choice) return;

      if (choice === 'overwrite') {
        const idx = lib.findIndex(c => c.id === this._selectedId);
        if (idx >= 0) lib[idx] = { ...lib[idx], ...data, name: data.saveName };
      } else {
        const entry = { id: foundry.utils.randomID(), name: data.saveName, ...data };
        delete entry.saveName;
        lib.push(entry);
        this._selectedId = entry.id;
      }
    } else {
      const entry = { id: foundry.utils.randomID(), name: data.saveName, ...data };
      delete entry.saveName;
      lib.push(entry);
      this._selectedId = entry.id;
    }

    await this._setLibrary(lib);
    ui.notifications.info(game.i18n.localize('HQP.Crawl.Saved'));
    this.render(true);
  }

  static _onPreview(event, target) {
    const data = this._getFormData();
    CrawlOverlay.play(data);
  }

  static _onPlayForAll(event, target) {
    const data = this._getFormData();
    emitCrawlPlay(data);
  }

  static _onPickBackground(event, target) {
    const input = this.element.querySelector('input[name="backgroundImage"]');
    new foundry.applications.apps.FilePicker({
      type: 'image',
      current: input.value,
      callback: path => {
        input.value = path;
        this._updatePreviewBackground();
      }
    }).render(true);
  }

  static _onPickMusic(event, target) {
    const input = this.element.querySelector('input[name="music"]');
    new foundry.applications.apps.FilePicker({
      type: 'audio',
      current: input.value,
      callback: path => { input.value = path; }
    }).render(true);
  }
}
