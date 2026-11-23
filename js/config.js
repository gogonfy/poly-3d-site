/* =========================================================
   POLY — настройки сайта
   Заполни значения ниже. Пока стоят заглушки, сайт работает
   в демо-режиме: статус «Демо», онлайн и посещения скрыты.
   ========================================================= */

window.POLY_CONFIG = {
  /* Ссылка для покупки курсов: Boosty или Telegram. */
  buyUrl: 'https://boosty.to/YOUR-PAGE',

  /* Firebase Realtime Database (онлайн, посещения, статус, заявки).
     Инструкция — в README.md, раздел «Firebase». */
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR-PROJECT.firebaseapp.com',
    databaseURL: 'https://YOUR-PROJECT-default-rtdb.firebaseio.com',
    projectId: 'YOUR-PROJECT'
  }
};
