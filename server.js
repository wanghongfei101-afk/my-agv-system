const express = require('express');
const multer = require('multer');
const path = require('path');
const Datastore = require('nedb-promises');

const app = express();
const db = Datastore.create({ filename: 'products.db', autoload: true });
const userDb = Datastore.create({ filename: 'users.db', autoload: true });

// --- 中间件配置 (必须放在路由之前) ---
app.use(express.json()); // 解析 JSON 格式的请求体
app.use('/images', express.static('images')); // 静态资源目录
app.use(express.static('./')); // 托管 HTML 文件

// --- 初始化账号逻辑 ---
async function initUsers() {
    const admin = await userDb.findOne({ username: 'admin' });
    if (!admin) {
        await userDb.insert({
            username: 'admin',
            password: 'admin888',
            name: '系统管理员',
            role: 'admin'
        });
    }
    const user = await userDb.findOne({ username: 'user' });
    if (!user) {
        await userDb.insert({
            username: 'user',
            password: 'user123',
            name: '产品查看员',
            role: 'user'
        });
    }
}
initUsers();

// --- 路由接口 ---

// 1. 登录接口 (保留这一个即可，包含了角色返回)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await userDb.findOne({ username, password });
        if (user) {
            res.json({
                success: true,
                name: user.name,
                role: user.role
            });
        } else {
            res.json({ success: false, message: '账号或密码错误' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 2. 产品配置相关
const storage = multer.diskStorage({
    destination: 'images/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// 获取列表
app.get('/api/products', async (req, res) => {
    const products = await db.find({});
    res.json(products);
});

// 获取详情
app.get('/api/products/:id', async (req, res) => {
    const product = await db.findOne({ _id: req.params.id });
    res.json(product);
});

// 新增产品
app.post('/api/products', upload.fields([
    { name: 'img', maxCount: 1 },
    { name: 'drawing', maxCount: 1 },
    { name: 'other', maxCount: 10 },
    { name: 'videoFiles', maxCount: 10 }
]), async (req, res) => {
    try {
        const files = req.files;
        const body = req.body;
        const newProduct = {
            name: body.name,
            price: body.price,
            note: body.note,
            params: JSON.parse(body.params),
            img: files.img ? 'images/' + files.img[0].filename : '',
            drawing: files.drawing ? 'images/' + files.drawing[0].filename : '',
            other: files.other ? files.other.map(f => 'images/' + f.filename) : [],
            videos: JSON.parse(body.videos).map((v, index) => ({
                name: v.name,
                desc: v.desc,
                url: files.videoFiles && files.videoFiles[index] ? 'images/' + files.videoFiles[index].filename : v.url
            }))
        };
        const doc = await db.insert(newProduct);
        res.json({ success: true, id: doc._id });
    } catch (e) { res.status(500).json({ success: false }); }
});

// 更新产品 (PUT)
app.put('/api/products/:id', upload.fields([
    { name: 'img', maxCount: 1 },
    { name: 'drawing', maxCount: 1 },
    { name: 'other', maxCount: 10 },
    { name: 'videoFiles', maxCount: 10 }
]), async (req, res) => {
    try {
        const id = req.params.id;
        const files = req.files;
        const body = req.body;
        const oldProduct = await db.findOne({ _id: id });
        if (!oldProduct) return res.status(404).json({ success: false });

        const updateData = {
            name: body.name,
            price: body.price,
            note: body.note,
            params: JSON.parse(body.params),
            img: files.img ? 'images/' + files.img[0].filename : oldProduct.img,
            drawing: files.drawing ? 'images/' + files.drawing[0].filename : oldProduct.drawing,
            other: files.other ? files.other.map(f => 'images/' + f.filename) : oldProduct.other,
        };

        const videoInfo = JSON.parse(body.videos);
        let videoFileIndex = 0;
        updateData.videos = videoInfo.map((v) => {
            // 如果前端标记是新上传的视频文件
            if (v.isNew && files.videoFiles && files.videoFiles[videoFileIndex]) {
                const file = files.videoFiles[videoFileIndex++];
                return { name: v.name, desc: v.desc, url: 'images/' + file.filename };
            }
            return v;
        });

        await db.update({ _id: id }, { $set: updateData });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// 删除产品
app.delete('/api/products/:id', async (req, res) => {
    await db.remove({ _id: req.params.id });
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`服务启动于端口 ${PORT}`));