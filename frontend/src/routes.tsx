import { RouteObject, createHashRouter } from 'react-router-dom';

import { Dashboard } from './screens/Dashboard';
import { Detail } from './screens/Detail';
import { Root } from './screens/Root';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: ':id', element: <Detail /> },
    ],
  },
];

// Hash router : app servie sous `/community` (route serveur unique), routage dans le fragment. CCTP 51C.
export const router = createHashRouter(routes);
