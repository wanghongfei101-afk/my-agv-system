const express = require('express');
const path = require('path');
const multer = require('multer');
const nedb = require('nedb-promises');

const app = express();
const PORT = process.env.PORT || 10000;

// 1. 数据库初始化
const db = nedb.create({ filename: './products.db', autoload: true });
// 【修复点】必须初始化用户数据库
const userDb = nedb.create({ filename: './users.db', autoload: true });

// 2. 静态资源托管
app.use(express.static(path.join(__dirname, './')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// 3. 解析中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. 首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API 接口 ---

// 【修复点】新增：处理登录请求
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await userDb.findOne({ username, password });
        if (user) {
            // 关键点：返回 user.name。如果数据库没设 name，就用 username 代替
            res.json({
                success: true,
                role: user.role,
                name: user.name || username
            });
        } else {
            res.json({ success: false, message: '账号或密码错误' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取产品列表
app.get('/api/products', async (req, res) => {
    try {
        const docs = await db.find({});
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 获取单个产品详情
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