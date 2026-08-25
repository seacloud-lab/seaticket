import axios from 'axios';
import Cookies from 'js-cookie';
import { siteRoot } from '@/constants';


class SkillsAPI {

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

  listSkills(projectUuid) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/skills/';
    return this.req.get(url);
  }

  listSkillCommands(projectUuid) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/skills/commands/';
    return this.req.get(url);
  }

  getSkill(projectUuid, skillName) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/skills/' + skillName + '/';
    return this.req.get(url);
  }

  createSkill(projectUuid, data) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/skills/';
    return this.req.post(url, data);
  }

  updateSkill(projectUuid, skillName, data) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/skills/' + skillName + '/';
    return this.req.put(url, data);
  }

  deleteSkill(projectUuid, skillName) {
    const url = this.server + '/api/v1/project/' + projectUuid + '/skills/' + skillName + '/';
    return this.req.delete(url);
  }
}

const skillsAPI = new SkillsAPI();
const xcsrfHeaders = Cookies.get('seaqa_csrftoken');
skillsAPI.initForUsage({ siteRoot, xcsrfHeaders });

export { skillsAPI };
