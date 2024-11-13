import { Express } from 'express';

import signinRoutes from './signin.js';
import gameRoutes from './game.js';

export default (app: Express) => {
    app.use('/signin', signinRoutes);
    app.use('/game', gameRoutes);
};
