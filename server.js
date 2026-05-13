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

// --- 以下为新增的图片上传配置，用于支持发布功能 ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images/'); // 确保你的服务器根目录下有 images 文件夹
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });
// --- 上传配置结束 ---

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

// --- 以下为新增的“发布”和“删除”接口 ---

// 【修复 404 与 SyntaxError】发布/新增产品
app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        const product = {
            name: req.body.name,
            price: req.body.price,
            note: req.body.note,
            params: JSON.parse(req.body.params || '{}'),
            // 数据库字段使用 img，匹配 index.html 的渲染
            img: req.file ? `/images/${req.file.filename}` : '',
            createTime: new Date()
        };
        const newDoc = await db.insert(product);
        res.json(newDoc); // 返回 JSON 格式，解决 SyntaxError 报错
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '发布失败' });
    }
});

// 【修复 404】删除产品
app.delete('/api/products/:id', async (req, res) => {
    try {
        const numRemoved = await db.remove({ _id: req.params.id });
        if (numRemoved > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: '未找到该产品' });
        }
    } catch (err) {
        res.status(500).json({ error: '删除失败' });
    }
});

// --- 新增接口结束 ---

// 5. 启动监听
app.listen(PORT, '0.0.0.0', () => {
    console.log(`服务已成功启动，正在监听端口: ${PORT}`);
});