import React from 'react';
import classnames from 'classnames';
import Main from './main';
import TopBar from './top-bar';


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
