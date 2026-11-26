export const MODULE_ID = 'hqp-opening-crawl';
export const SOCKET_NAME = `module.${MODULE_ID}`;

// Crawls used to live in the combined High Quality Prep module.
// The migration in main.js imports that library on first load.
export const LEGACY_ID = 'high-quality-prep';

export const SETTINGS = {
  CRAWL_LIBRARY: 'crawlLibrary'
};

export const CRAWL_DEFAULTS = {
  speed: 90,
  angle: 27,
  textScale: 100,
  campaignScale: 100,
  color: '#FFFF82'
};
