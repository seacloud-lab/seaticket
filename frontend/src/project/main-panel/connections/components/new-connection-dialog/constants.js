import { gettext } from '@/constants';

const STEP = {
  TYPE: 'type',
  CONFIG: 'config',
  GITHUB: 'github',
};

const STEPS = [
  { key: STEP.TYPE, name: gettext('Select connection type') },
  { key: STEP.CONFIG, name: gettext('Fill in connection details') },
  { key: STEP.GITHUB, name: gettext('Link to GitHub webhook') },
];

export { STEP, STEPS };
