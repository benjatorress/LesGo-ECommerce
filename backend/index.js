import { createApp } from './app.js';

const port = process.env.PORT || 5000;
createApp().listen(port, '0.0.0.0', () => {
  console.log(`Servidor LesGo Backend ejecutándose en http://localhost:${port}`);
});
