import path from 'node:path';
import { Router } from 'express';

import { HTML_FILES_PATH } from '../config.js';
import { texts } from '../data.js';

const router = Router();

router.get('/', (req, res) => {
    const page = path.join(HTML_FILES_PATH, 'game.html');
    res.sendFile(page);
});

router.get('/texts/:id', (req, res) => {
    const { id } = req.params;
    const selectedText = texts[id];
    res.json({ text: selectedText });
});

export default router;
