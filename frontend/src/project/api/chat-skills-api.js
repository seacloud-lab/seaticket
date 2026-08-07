import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '@/constants';


class ChatSkillsAPI {

  initForUsage({ siteRoot, xcsrfHeaders }) {
    if (siteRoot && siteRoot.charAt(siteRoot.length - 1) === '/') {
      this.server = siteRoot.substring(0, siteRoot.length - 1);
    } else {
      this.server = siteRoot;
    }
    this.req = axios.create({
      headers: {
        'X-CSRFToken': xcsrfHeaders,
      }
    });
    return this;
  }

  listChatSkills(projectUuid) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/chat-skills/';
    return this.req.get(url);
  }

  getChatSkill(projectUuid, skillName) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/chat-skills/' + skillName + '/';
    return this.req.get(url);
  }

  createChatSkill(projectUuid, data) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/chat-skills/';
    return this.req.post(url, data);
  }

  updateChatSkill(projectUuid, skillName, data) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/chat-skills/' + skillName + '/';
    return this.req.put(url, data);
  }

  deleteChatSkill(projectUuid, skillName) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/chat-skills/' + skillName + '/';
    return this.req.delete(url);
  }

  validateChatSkill(projectUuid, data) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/chat-skills/validate/';
    return this.req.post(url, data);
  }
}

const chatSkillsAPI = new ChatSkillsAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
chatSkillsAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { chatSkillsAPI };
