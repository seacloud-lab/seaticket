import React from 'react';
import classnames from 'classnames';
import TopBar from './top-bar';
import Main from './main';


const MainPanel = ({
  className,
  title,
  children,
  ...params
}) => {

  return (
    <div className={classnames('main-panel', className)}>
      <TopBar { ...params } />
      <Main title={title}>{children}</Main>
    </div>
  );
};

export default MainPanel;
export {
  TopBar,
  Main,
};
