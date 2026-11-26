import { SOCKET_NAME } from './config.js';
import { CrawlOverlay } from './CrawlOverlay.js';

export function emitCrawlPlay(crawlData) {
  game.socket.emit(SOCKET_NAME, { type: 'crawl-play', data: crawlData });
  CrawlOverlay.play(crawlData);
}

export function emitCrawlStop() {
  game.socket.emit(SOCKET_NAME, { type: 'crawl-stop', data: {} });
  CrawlOverlay.stop();
}

export function handleCrawlSocket(payload) {
  switch (payload.type) {
    case 'crawl-play':
      CrawlOverlay.play(payload.data);
      break;
    case 'crawl-stop':
      CrawlOverlay.stop();
      break;
  }
}
