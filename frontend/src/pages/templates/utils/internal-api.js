import axios from 'axios';
import { siteRoot } from './constants';

class SeatableMarketInternalAPI {

  init(server) {
    this.server = server;
    this.req = axios.create();
    return this;
  }

  listPlugins() {
    const url = '/api/plugins/';
    return this.req.get(url);
  }

  listTemplates() {
    const url = '/api/templates/';
    return this.req.get(url);
  }

  listCases() {
    const url = '/api/cases/';
    return this.req.get(url);
  }

  getPluginDownloadLink(path) {
    const url = '/api/download-plugin-link/?path=' + encodeURIComponent(path);
    return this.req.get(url);
  }

  getMarkdownContent(markdownLink) {
    const url = markdownLink;
    return this.req.get(url);
  }

}

let seatableMarketInternalAPI = new SeatableMarketInternalAPI();
seatableMarketInternalAPI.init(siteRoot);

export { seatableMarketInternalAPI };
