const express = require('express');
const path = require('path');
const multer = require('multer');
const nedb = require('nedb-promises');

const app = express();
const PORT = process.env.PORT || 10000;

const db = nedb.create({ filename: './products.db', autoload: true });
const userDb = nedb.create({ filename: './users.db', autoload: true });

// --- 修复：支持多类型文件上传 ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'images/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
const multiUpload = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'otherImages', maxCount: 10 },
    { name: 'video', maxCount: 1 }
]);

app.use(express.static(path.join(__dirname, './')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await userDb.findOne({ username, password });
        if (user) {
            res.json({ success: true, role: user.role, name: user.name || username });
        } else {
            res.json({ success: false, message: '账号或密码错误' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const docs = await db.find({});
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const doc = await db.findOne({ _id: req.params.id });
        res.json(doc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 修复：新增发布接口 (支持视频、多图) ---
app.post('/api/products', multiUpload, async (req, res) => {
    try {
        const product = {
            name: req.body.name,
            price: req.body.price,
            note: req.body.note,
            params: JSON.parse(req.body.params || '{}'),
            img: req.files['image'] ? `/images/${req.files['image'][0].filename}` : '',
            otherImgs: req.files['otherImages'] ? req.files['otherImages'].map(f => `/images/${f.filename}`) : [],
            video: req.files['video'] ? `/images/${req.files['video'][0].filename}` : '',
            createTime: new Date()
        };
        const newDoc = await db.insert(product);
        res.json(newDoc);
    } catch (err) {
        res.status(500).json({ error: '发布失败' });
    }
});

// --- 修复：新增编辑保存接口 ---
app.put('/api/products/:id', multiUpload, async (req, res) => {
    try {
        const updateData = {
            name: req.body.name,
            price: req.body.price,
            note: req.body.note,
            params: JSON.parse(req.body.params || '{}')
        };
        if (req.files['image']) updateData.img = `/images/${req.files['image'][0].filename}`;
        if (req.files['otherImages']) updateData.otherImgs = req.files['otherImages'].map(f => `/images/${f.filename}`);
        if (req.files['video']) updateData.video = `/images/${req.files['video'][0].filename}`;

        await db.update({ _id: req.params.id }, { $set: updateData });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '更新失败' });
    }
});

// --- 修复：新增删除接口 ---
app.delete('/api/products/:id', async (req, res) => {
    try {
        await db.remove({ _id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '删除失败' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`服务已成功启动，正在监听端口: ${PORT}`);
});