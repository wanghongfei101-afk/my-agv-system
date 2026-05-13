const express = require('express');
const path = require('path');
const multer = require('multer');
const nedb = require('nedb-promises');

const app = express();
// 核心修复：自动适配 Render 的环境端口
const PORT = process.env.PORT || 10000;

// 1. 数据库初始化 (使用相对路径确保在云端也能创建)
const db = nedb.create({ filename: './products.db', autoload: true });

// 2. 静态资源托管
// 无论你的文件是在根目录还是子目录，这行都能确保路径正确
app.use(express.static(path.join(__dirname, './')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// 3. 解析中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. 路由：显式指定根目录返回 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 以下是 API 接口示例，请确保与你之前的逻辑一致 ---

// 获取产品列表
app.get('/api/products', async (req, res) => {
    try {
        const docs = await db.find({});
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 获取单个产品
app.get('/api/products/:id', async (req, res) => {
    try {
        const doc = await db.findOne({ _id: req.params.id });
        res.json(doc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. 启动监听
app.listen(PORT, '0.0.0.0', () => {
    console.log(`服务已成功启动，正在监听端口: ${PORT}`);
});