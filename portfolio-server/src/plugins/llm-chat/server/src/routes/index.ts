import adminApiRoutes from './admin-api';
import contentAPIRoutes from './content-api';
import vectorRoutes from './vector-routes';

export default {
  admin: {
    type: 'admin',
    routes: [...adminApiRoutes.routes, ...vectorRoutes.routes]
  },
  'content-api': contentAPIRoutes,
};
