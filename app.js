"use strict";
exports.__esModule = true;
var mysql = require("mysql");
var express = require("express");
var path = require("path");
var IO = require("socket.io");
var http = require("http");
var MD5 = require("crypto-js/md5");
var bodyParser = require("body-parser");
var DB;
(function (DB) {
    //设置配置信息，连接数据库连接池
    var connectionLimit = 10;
    var host = "localhost";
    var user = "root";
    var password = "H171023";
    var database = "test";
    var pool = mysql.createPool({
        connectionLimit: connectionLimit,
        host: host,
        user: user,
        password: password,
        database: database
    });
    //保存数据到数据库
    var InsertData = /** @class */ (function () {
        function InsertData() {
        }
        //商品咨询
        InsertData.goodsConsulting = function (data) {
            pool.query("INSERT INTO goods_consulting SET ?", data, function exceptions(error, results, fields) {
                if (error)
                    throw error;
            });
        };
        //聊天记录
        InsertData.saveMessage = function (data) {
            pool.query("INSERT INTO text_message SET ?", data, function exceptions(error, results, fields) {
                if (error)
                    throw error;
            });
        };
        //图片记录
        InsertData.saveIMG = function (data) {
            pool.query("INSERT INTO img_message SET ?", data, function exceptions(error, results, fields) {
                if (error)
                    throw error;
            });
        };
        return InsertData;
    }());
    DB.InsertData = InsertData;
})(DB || (DB = {}));
var SocketIOServer;
(function (SocketIOServer) {
    //载入http模块
    var app = express();
    var server = http.createServer(app);
    //设置静态资源的存放位置是public，index.html是首选文件
    app.use(express.static(path.join(__dirname, "public")));
    app.use(bodyParser.json()); // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
    //端口是默认8080，启动服务器
    var port = process.env.PORT || 8080;
    server.listen(port, function showPort() {
        console.log("\u5BA2\u670D\u670D\u52A1\u5668\u542F\u52A8\uFF0C\u7AEF\u53E3\u662F" + port);
    });
    //配置渲染引擎和路径
    app.set("views", path.join(__dirname, "public"));
    app.set("view engine", "hbs");
    //房间列表
    var roomsList = new Map();
    //创建socket服务
    var socketIO = IO(server);
    //路由
    var router = express.Router();
    //用户信息
    router.get("/user-entrance", function data(req, res) {
        var shop = req.query.shop;
        //渲染页面数据
        res.render("user-entrance", {
            shop: shop
        });
    });
    客服信息
    router.get("/service-entrance", function data(req, res) {
        var shop = req.query.shop;
        var goods = req.query.goods;
        var uid = req.query.uid;
        var md5 = MD5(shop + uid);
        console.log(shop + goods + uid + "service-entrance：" + md5);
        //渲染页面数据
        res.render("service-entrance", {
            shop: shop,
            uid: uid,
            goods: goods,
            md5: md5
        });
    });
    //用户界面
    router.post("/user", function data(req, res) {
        var id = req.body.id;
        var roomID = req.body.roomID;
        var uid = req.body.uid;
        var goods = req.body.goods;
        var shop = req.body.shop;
        var md5 = MD5(shop + uid);
        console.log(req.body);
        //渲染页面数据
        res.render("user", {
            id: id,
            shop: shop,
            goods: goods,
            roomID: roomID,
            uid: uid,
            md5: md5
        });
    });
    //客服界面
    router.get("/roomList", function data(req, res) {
        var shop = req.query.shop;
        var goods = req.query.goods;
        var id = req.query.id;
        var md5 = req.query.md5;
        console.log("roomList" + md5);
        //渲染页面数据
        res.render("roomList", {
            shop: shop,
            goods: goods,
            id: id,
            md5: md5
        });
    });
    //店铺（命名空间）列表
    var shopList = new Set();
    //ajax返回服务器端数量
    // router.get("/server/get-num", function get(req, res) {
    //     res.send("" + serverNum);
    // });
    // //ajax增加服务器端
    // router.get("/server/add", function (req, res) {
    //     var name = req.query.name;
    //     // console.log(`参数name：${name}`)
    //     SocketIOServer.add(name);
    //     res.send('增加后服务器列表数量' + shopList.size);
    // });
    // //ajax关闭服务器端
    // router.get("/server/close", function close(req, res) {
    //     socketIO.close(function message() {
    //         console.log('关闭服务器');
    //     });
    //     res.send("等待关闭服务器。。。。。");
    // });
    // //ajax显示已有服务器端列表
    router.get("/server/show", function show(req, res) {
        var list = new Array();
        var listNum = 0;
        var keys = shopList.keys();
        var room = '';
        while (room = keys.next().value) {
            console.log(room + "===========" + listNum);
            list[listNum++] = room;
        }

        res.send(list);
    });
    app.use("/", router);
    SocketIOServer.add = function (name) {
        addServer(name);
        shopList.add(name);
    };
    //服务器开启数量
    var serverNum = 0;
    var addServer = function add(name) {
        ++serverNum;
        console.log("\u5DF2\u7ECF\u5F00\u542F" + serverNum + "\u4E2A\u670D\u52A1\u5668");
        //客户端连接成功后
        socketIO.of("/" + name).on('connection', function connection(socket) {
            console.log(name + '====服务器端开启===');
            //客户进入客服保存的记录
            socket.on('user_time', function save(data) {
                if (data !== undefined) {
                    DB.InsertData.goodsConsulting(data);
                }
            });
            //
            socket.on('join', function rooms(data) {
                //房间是否被建立
                if (!roomsList.has(data.roomID)) {
                    //新建房间
                    roomsList.set(data.roomID, new Set());
                    //添加房间的人
                    roomsList.get(data.roomID).add(data.id);
                }
                else {
                    //添加房间的人
                    roomsList.get(data.roomID).add(data.id);
                }
                socket.join(data.roomID);
            });
            socket.on('new_message', function message(data, db) {
                var rooms = Object.keys(socket.rooms);
                socket.to(data.roomID).emit('new_message', data);
                DB.InsertData.saveMessage(db);
            });
            socket.on('get_rooms', function getRoomsList() {
                var roomsNum = roomsList.size;
                var roomArray = new Array();
                var listNum = 0;
                var keys = roomsList.keys();
                var room = '';
                while (room = keys.next().value) {
                    roomArray[listNum++] = room;
                }
                socket.emit('show_rooms', roomArray);
            });
          
        });
    };
})(SocketIOServer || (SocketIOServer = {}));
var main;
(function (main) {
    let shopString = '';

    var fs = require("fs");
    var buf = new Buffer.alloc(1024 * 1024);

    console.log("准备打开已存在的文件！");
    fs.open('json/shop.json', 'r+', function(err, fd) {
        if (err) {
            return console.error(err);
        }
        console.log("文件打开成功！");
        console.log("准备读取文件：");
        fs.read(fd, buf, 0, buf.length, 0, function(err, bytes){
            if (err){
                console.log(err);
            }
            console.log(bytes + "  字节被读取");
            
            // 仅输出读取的字节
            if(bytes > 0){
                shopString += buf.slice(0, bytes).toString();
                
                const shopList = JSON.parse(shopString);
                
                shopList.shop.forEach(function (element) {
                    SocketIOServer.add(element);
                });
            }
        });

    });
    
    
})(main || (main = {}));
