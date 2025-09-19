import { gettext } from '@/constants';

const STEP = {
  TYPE: 'type',
  CONFIG: 'config',
  GITHUB: 'github',
  DISCOURSE: 'discourse',
};

const STEPS = [
  { key: STEP.TYPE, name: gettext('Select connection type') },
  { key: STEP.CONFIG, name: gettext('Fill in connection details') },
  { key: STEP.GITHUB, name: gettext('Link to GitHub webhook') },
  { key: STEP.DISCOURSE, name: gettext('Link to Discourse webhook') },
];

export { STEP, STEPS };
