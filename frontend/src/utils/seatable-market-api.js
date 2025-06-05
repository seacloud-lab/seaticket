import axios from 'axios';
import { seatableMarketUrl, lang } from './constants';

class SeaTableMarketAPI {

  constructor() {
    this.req = axios.create();
  }

  initServer() {
    this.server = seatableMarketUrl.replace(/\/+$/, '');
    this.serverByLang = lang === 'zh-cn' ? 'https://market.seatable.cn' : 'https://market.seatable.io';
  }

  listPlugins() {
    this.initServer();
    const url = this.serverByLang + '/api/plugins/';
    return this.req.get(url);
  }

  listTemplates() {
    this.initServer();
    const url = this.server + '/api/templates/';
    return this.req.get(url);
  }

}

const seaTableMarketAPI = new SeaTableMarketAPI();

export default seaTableMarketAPI;
