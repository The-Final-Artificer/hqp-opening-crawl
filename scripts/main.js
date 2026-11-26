import { MODULE_ID, LEGACY_ID, SOCKET_NAME, SETTINGS } from './config.js';
import { handleCrawlSocket } from './crawl-socket.js';

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, SETTINGS.CRAWL_LIBRARY, {
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });
});

Hooks.once('ready', async () => {
  game.socket.on(SOCKET_NAME, payload => {
    if (payload.type?.startsWith('crawl-')) handleCrawlSocket(payload);
  });

  if (game.user.isGM) await migrateLegacyLibrary();
});

// One-time import of crawls saved under the old combined High Quality Prep
// module. The old world setting stays in the database even after that module
// stops registering it, so we read it straight from settings storage.
async function migrateLegacyLibrary() {
  const lib = game.settings.get(MODULE_ID, SETTINGS.CRAWL_LIBRARY) || [];
  if (lib.length) return;

  const legacy = game.settings.storage.get('world').find(s => s.key === `${LEGACY_ID}.crawlLibrary`);
  if (!legacy) return;

  try {
    const old = typeof legacy.value === 'string' ? JSON.parse(legacy.value) : legacy.value;
    if (Array.isArray(old) && old.length) {
      await game.settings.set(MODULE_ID, SETTINGS.CRAWL_LIBRARY, old);
      ui.notifications.info(`Opening Crawl: imported ${old.length} saved crawl(s) from High Quality Prep.`);
    }
  } catch (err) {
    console.warn('Opening Crawl | Could not import legacy crawl library', err);
  }
}

Hooks.on('getSceneControlButtons', controls => {
  if (!game.user.isGM) return;

  const tool = {
    name: 'hqp-opening-crawl',
    title: game.i18n.localize('HQP.Crawl.ToolButton'),
    icon: 'fas fa-journal-whills',
    button: true,
    onClick: () => {
      import('./CrawlEditor.js').then(m => {
        new m.CrawlEditor().render(true);
      });
    }
  };

  if (Array.isArray(controls)) {
    const notes = controls.find(c => c.name === 'notes');
    if (notes) {
      if (Array.isArray(notes.tools)) notes.tools.push(tool);
    }
  } else {
    const notes = controls.notes ?? controls.get?.('notes');
    if (notes) {
      if (notes.tools instanceof Map) notes.tools.set(tool.name, tool);
      else if (typeof notes.tools === 'object') notes.tools[tool.name] = tool;
    }
  }
});
