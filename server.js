const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// !!! Вставь сюда свой токен доступа !!!
const VK_ACCESS_TOKEN = 'SJQrOjWugVP9al2yobh4';

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

app.use(express.static('public'));
app.use(bodyParser.json());

// Вспомогательная функция для запроса к VK API
async function vkApi(method, params = {}) {
  const url = `https://api.vk.com/method/${method}`;
  const response = await axios.get(url, {
    params: {
      ...params,
      access_token: VK_ACCESS_TOKEN,
      v: '5.199' // последняя версия API
    }
  });
  return response.data;
}

// Роут для скачивания
app.post('/download', async (req, res) => {
  const { link } = req.body;

  if (!link || !link.startsWith('https://vk.com/')) {
    return res.status(400).json({ success: false, error: 'Неверная ссылка.' });
  }

  try {
    const parts = link.split('/');
    if (parts.length < 2) {
      return res.json({ success: false, error: 'Неизвестный формат ссылки.' });
    }

    const lastPart = parts.pop() || parts.pop(); // на случай слеша на конце

    if (link.includes('photo')) {
      // Работаем с фото
      const [ownerId, photoId] = lastPart.replace('photo', '').split('_');

      const data = await vkApi('photos.getById', {
        photos: `${ownerId}_${photoId}`
      });

      const photo = data.response[0];
      const url = photo.sizes.pop().url; // Берем самое большое фото

      const filename = uuidv4() + '.jpg';
      const filePath = path.join(downloadsDir, filename);

      const fileResponse = await axios.get(url, { responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);

      fileResponse.data.pipe(writer);

      writer.on('finish', () => {
        res.json({ success: true, downloadUrl: `/downloads/${filename}` });
      });

      writer.on('error', () => {
        res.json({ success: false, error: 'Ошибка записи фото.' });
      });

    } else if (link.includes('video')) {
      // Работаем с видео
      const [ownerId, videoId] = lastPart.replace('video', '').split('_');

      const data = await vkApi('video.get', {
        videos: `${ownerId}_${videoId}`
      });

      const video = data.response.items[0];
      const url = video.files.mp4_720 || video.files.mp4_480 || video.files.mp4_360;

      if (!url) {
        return res.json({ success: false, error: 'Нет доступной ссылки на видео.' });
      }

      const filename = uuidv4() + '.mp4';
      const filePath = path.join(downloadsDir, filename);

      const fileResponse = await axios.get(url, { responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);

      fileResponse.data.pipe(writer);

      writer.on('finish', () => {
        res.json({ success: true, downloadUrl: `/downloads/${filename}` });
      });

      writer.on('error', () => {
        res.json({ success: false, error: 'Ошибка записи видео.' });
      });

    } else {
      res.json({ success: false, error: 'Поддерживаются только фото и видео.' });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Ошибка запроса к VK API.' });
  }
});

// Делаем папку доступной для скачивания
app.use('/downloads', express.static('downloads'));

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
