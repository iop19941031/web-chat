import * as mysql from 'mysql';
import  express from 'express';
import * as path from 'path';
import  IO from 'socket.io';
import * as http from 'http';
import  MD5 from 'crypto-js/md5';
import * as fs from 'fs';
import * as bodyParser from 'body-parser';
import * as multer from 'multer';



namespace DataFormat{
    //进入客服系统数据格式
    export interface LoginMessage{
        id: string;
        roomID: string;
    }
    //聊天记录格式
    export interface Message{
        id: string;
        message: string;
        roomID: string;
    }
    //聊天记录格式（数据库版）
    export interface MessageDB{
        shop: string;
        id: string;
        md5: string;
        message: string;
    }
    //用户进入客服时间格式（数据库版）
    export interface GoodsConsultingDB{
        uid: string;
        md5: string;
        goods: string;
        shop: string;
    }

    //图片消息格式
    export interface IMGMessage{
        name: string;
        id: string;
        roomID: string;
        img: any;
        md5: string;
    }
    //保存图片格式
    export interface IMGDB{
        id: string;
        src: any;
        md5: string;
    }
}

namespace DB{
     //设置数据库的配置信息，并连接到数据库连接池开启数据库服务
    const connectionLimit:number = 10;
    const host: string = "localhost";
    const user: string = "root";
    const password: string = "H171023";
    const database:string = "test";
    
    const pool:any = mysql.createPool({
        connectionLimit,
        host,
        user,
        password,
        database
    });
    
    //数据库的操作
    
    export class InsertData{
        //向数据库插入客户进入客服系统的时间记录
        static goodsConsulting(data: DataFormat.GoodsConsultingDB):void{
            pool.query("INSERT INTO goods_consulting SET ?", data, 
                function exceptions(error: never, results: any, fields:any): void {
                if (error) throw error;
            });
        }
        //向数据库插入聊天记录
        static saveMessage(data: DataFormat.MessageDB):void{
            pool.query("INSERT INTO text_message SET ?", data, 
                function exceptions(error: never, results: any, fields:any): void {
                if (error) throw error;
            });
        }
        //向数据库插入图片记录
        static saveIMG(data: DataFormat.IMGDB): void{
            pool.query("INSERT INTO img_message SET ?", data, 
                function exceptions(error: never, results: any, fields:any): void {
                if (error) throw error;
            });
        }
    }
}

namespace SocketIOServer{
   
    
    //载入http模块
    const app:any = express();
    const server: any = http.createServer(app);

    //设置静态资源的存放位置是public，index.html是首选文件
    app.use(express.static(path.join(__dirname, "public")));

    app.use(bodyParser.json()); // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

    //端口是默认3000，启动服务器
    const port: number | string = process.env.PORT || 3000;
    server.listen(port, function showPort(){
        console.log(`客服服务器启动，端口是${port}`);
    });

    //配置渲染引擎和路径
    app.set("views", path.join(__dirname, "public"));
    app.set("view engine", "hbs");

    

    //房间列表
    const roomsList: Map<string, Set<string>> = new Map();

    //创建socket服务
    const socketIO = IO(server);
    

    //路由
    const router:any = express.Router();

    //可以忽略，测验用途，用户信息
    router.get("/user-entrance", function data(req:any, res:any){
        const shop = req.query.shop;
        //渲染页面，向页面传入参数
        res.render("user-entrance", {
            shop
        });
    });

    //可以忽略，测验用途，客服信息
    router.get("/service-entrance", function data(req:any, res:any){
        const shop = req.query.shop;
        const goods = req.query.goods;
        const uid = req.query.uid;
        const md5 = MD5(shop  + uid);
        // console.log(shop+goods+uid+"service-entrance：" + md5);
        //渲染页面，向页面传入参数
        res.render("service-entrance", {
            shop,
            uid,
            goods,
            md5
        });
    });

    //可以忽略，测验用户客服端的用途，用户界面
    router.post("/user", function data(req:any, res:any){
        const id = req.body.id;
        const roomID = req.body.roomID;
        const uid = req.body.uid;
        const goods = req.body.goods;
        const shop = req.body.shop;
        const md5 = MD5(shop +  uid);
        // console.log(req.body);
        // console.log("用户界面店铺名：" + shop);
        // console.log('=========进入房间页面========');
        //渲染页面数据
        res.render("user", {
            id,
            shop,
            goods,
            roomID,
            uid,
            md5
        });
    });

    //客服客户端界面
    router.get("/roomList", function data(req:any, res:any){
        const roomID = req.query.roomID;
        const shop = req.query.shop;
        const goods = req.query.goods;
        const id = req.query.id;
        const md5 = req.query.md5;
        // console.log("roomList" + md5);
        //渲染页面数据
        res.render("roomList", {
            shop,
            goods,
            id,
            md5,
            roomID
        });

    });
    
    //店铺房间里面的人数
    const shopList = new Set();
    //ajax返回已经开启的客服服务器端数量
    router.get("/server/get-num", function get(req: any, res: any){
        res.send(`${serverNum}`);
    });
    //ajax增加客服服务器端的数量
    router.get("/server/add", function (req: any, res: any){
        const name: string = req.query.name;
        // console.log(`参数name：${name}`)
        add(name);
        res.send('增加后服务器列表数量' + shopList.size)
    });
    //ajax关闭所有的客服服务器端
    router.get("/server/close", function close(req: any, res: any){
        socketIO.close(function message() : void{
            console.log('关闭服务器');            
        });
        res.send("等待关闭服务器。。。。。");
    });
    //ajax显示全部的服务器端名字列表
    router.get("/server/show", function show(req: any, res: any){
        const list: Array<string> = new Array();
        let listNum: number = 0;
        let keys: IterableIterator<string> = shopList.keys(); 
        let room: string = '' ;
        while(room = keys.next().value){
            console.log(`${room}===========${listNum}`)
            list[listNum++] = room;
        }
        // console.log(list.length + '房间列表总数')
        res.send(list);
    });
    app.use("/", router);

    export const add: Function = function (name: string): void{
        addServer(name);
        shopList.add(name);
    }
    //服务器开启数量
    let serverNum = 0;

    const addServer = function add(name: string): void {
        ++serverNum;
        console.log(`已经开启${serverNum}个服务器`)
        //客户端连接成功后
        socketIO.of(`/${name}`).on('connection', function connection(socket: any){
            
            // console.log(name+'====服务器端开启===')

            //客服进入客服系统时，保存进入的时间到数据库
            socket.on('user_time', function save(data: DataFormat.GoodsConsultingDB){
                if(data !== undefined){
                    
                    DB.InsertData.goodsConsulting(data);
                }
            });
            
            //设置人员进入特定的房间时，判断是否房间已存在
            socket.on('join', function rooms(data: DataFormat.LoginMessage){
                // console.log(`房间号:::${data.roomID}`);
                // console.log(`房间是否存在${roomsList.has(data.roomID)}`)
                //房间是否被建立
                if(!roomsList.has(data.roomID)){
                    //新建房间
                    roomsList.set(data.roomID, new Set());
                    //添加房间的人
                    roomsList.get(data.roomID).add(data.id);
                    // console.log('房间人数：' + roomsList.get(data.roomID).size + '-=');
                    // console.log('房间数：：' + roomsList.size + '-=');

                }
                else{
                    //添加房间的人
                    roomsList.get(data.roomID).add(data.id);
                    // console.log('房间数::' + roomsList.size)
                }
                socket.join(data.roomID);
            });
            
            //接收到人员发送的信息，并发送到特定房间，让特定房间里的人员都接收到消息（除发送者外）
            socket.on('new_message', function message(data: DataFormat.Message, db: DataFormat.MessageDB){
                let rooms: Array<string> = Object.keys(socket.rooms);
               
                //console.log(`socket--rooms--id---${rooms}=======(1)=${socket.rooms[rooms[0]]}=====+++=(length)++++${rooms.length}+====(2)==${socket.rooms[rooms[1]]}========`);
                //console.log(`socket--client-----${socket.client}=======----------=============`)
                //console.log(data.roomID+ '000000000000000000000000000')
                socket.to(data.roomID).emit('new_message', data);
                DB.InsertData.saveMessage(db);
            });
            
            //请求房间号列表，然后发送房间号列表
            socket.on('get_rooms', function getRoomsList(): void{
                const roomsNum: number = roomsList.size;
                // console.log(roomsList.keys()+ '：：房间号');
                // console.log(roomsList.size + '----------------原房间列表总数')
                const roomArray: Array<string> = new Array();
                let listNum: number = 0;
                let keys: IterableIterator<string> = roomsList.keys(); 
                let room: string = '' ;
                while(room = keys.next().value){
                    // console.log(`${room}===========${listNum}`)
                    roomArray[listNum++] = room;
                }
                // console.log(roomArray.length + '房间列表总数')
                socket.emit('show_rooms', roomArray);
            });

            //接收到图片信息，先把图片保存到本地，然后图片地址保存到数据库，并让特定房间里的人员都接收到图片（除发送者外）
            socket.on('img-message', function img(data: DataFormat.IMGMessage): void{

                const base64 = data.img.replace(/^data:image\/\w+;base64,/, '');//去掉图片base64码前面部分data:image/png;base64
                const dataBuffer = new Buffer(base64, 'base64'); //把base64码转成buffer对象，
                
                const nameSuffix: RegExpMatchArray | null = data.name.match('[.](jpg|jpeg|gif|png|bmp)$');
                if(nameSuffix !== null){
                    const fileName: string = data.md5 + Date.now() + nameSuffix[0];
                    fs.writeFile(`img/${fileName}`, dataBuffer, {encoding: 'base64', flag: 'wx'}, function error(err: NodeJS.ErrnoException) {
                        if (err) {
                            return console.error(err);
                        }
                    });
                    const img: DataFormat.IMGDB = {
                        id: data.id,
                        src: fileName,
                        md5: data.md5
                    }
                    DB.InsertData.saveIMG(img);
                }
                
                socket.to(data.roomID).emit('img-message', data);
            });
        });
    }
}

namespace main{
    const shop: Array<string> = [
        '乐速商城1', '乐速商城2', '乐速商城3', '乐速商城4', '乐速商城5', '乐速商城6'
    ]
    shop.forEach(element => {
        SocketIOServer.add(element);
    });
    
}