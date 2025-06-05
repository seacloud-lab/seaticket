import { gettingStartLink, useCaseLink, videoTutorialsLink, traingingServicesLink } from '../../../utils/constants';

let GUIDE_LIST = [];

if (gettingStartLink) {
  GUIDE_LIST.push(
    {
      title: 'SeaTable 入门介绍',
      description: '通过 5 分钟的视频，让您快速掌握 SeaTable 基本使用。',
      imgLink: 'introduction.png',
      bgc: 'rgb(253, 245, 236)',
      link: gettingStartLink,
    }
  );
}

if (useCaseLink) {
  GUIDE_LIST.push(
    {
      title: '多行业使用案例',
      description: '包含商贸电商、教育培训、企业服务、金融证券等多行业真实案例和模板，让您快速复制使用。',
      imgLink: 'use-case.png',
      bgc: 'rgb(238, 250, 251)',
      link: useCaseLink,
    },
  );
}

if (traingingServicesLink) {
  GUIDE_LIST.push(
    {
      title: '培训服务',
      description: '报名参加我们每月的线上培训讲座、学习答疑、从入门到精通，提高数字化能力。',
      imgLink: 'training-services.png',
      bgc: 'rgb(245, 239, 248)',
      link: traingingServicesLink,
    },
  );
}

if (videoTutorialsLink) {
  GUIDE_LIST.push(
    {
      title: 'SeaTable 视频教程库',
      description: '包含基础应用、软件技巧、插件使用、案例等多个教程，您可按需观看学习。',
      imgLink: 'video-tutorial.png',
      bgc: 'rgb(238, 246, 254)',
      link: videoTutorialsLink,
    },
  );
}

export { GUIDE_LIST };
