import adminApiRoutes from './admin-api';
import contentAPIRoutes from './content-api';

const routes = {
  admin: {
    type: 'admin',
    routes: adminApiRoutes,
  },
  'content-api': {
    type: 'content-api',
    routes: contentAPIRoutes,
  },
};

export default routes;
