const router = require('express').Router();
const sqlite3 = require('sqlite3').verbose();
const request = require('request');

// ルートの取得
router.get('/', (req, res, next) => {
    res.render('index', { title: req.baseUrl});
});

// 2021の追加
router.use('/2021', require('./2021'));

// バージョンの取得
router.get('/version', (req, res, next) => {
    // レスポンスの戻り値データ
    const resData = { 
        'url': req.baseUrl + req.path,
        'resStatus': 'Ok',
        'resCode': 0,
        'version' : '',
    };

    // データベース
    const db = new sqlite3.Database('db1.sqlite');
    const sql = 'SELECT version FROM version'; 
    db.all(sql , (err, rows) => {
        db.close();
        if (err) {
            resData.resStatus = 'Invalid SQL';
            resData.resCode = -1;
            res.json(resData);
            return;
        }
        resData.version = rows[0]['version'];
        res.json(resData);
        return;
    });
});

// テーブル一覧の取得
router.get('/tables', (req, res, next) => {
    // レスポンスの戻り値データ
    const resData = { 
        'url': req.baseUrl + req.path,
        'resStatus': 'Ok',
        'resCode': 0,
        'tables' : '',
    };
// データベース
    const db = new sqlite3.Database('db1.sqlite');
    const sql = "SELECT name FROM sqlite_master WHERE type='table'";
    db.all(sql, (err, rows) => {
        db.close();
        if (err) {
            resData.resStatus = 'Invalid SQL';
            resData.resCode = -1;
            res.json(resData);
            return;
        }
        resData.tables = rows;
        res.json(resData);
        return;
    });
});

// ステータスの取得
router.get('/status', (req, res, next) => {
    // レスポンスの戻り値データ
    const resData = { 
        'url': req.baseUrl + req.path,
        'resStatus': 'Ok',
        'resCode': 0,
        'status' : '',
    };

    // マシン番号
    const macNum = +req.query.macNum;
    if(Number.isNaN(macNum)) {
        resData.resStatus = 'Invalid MacNum';
        resData.resCode = -13;
        res.json(resData);
        return;
    }
    
    // データベース
    const db = new sqlite3.Database('db1.sqlite');
    const sql = "SELECT status FROM state WHERE macNum=" + macNum;
    db.all(sql, (err, rows) => {
        db.close();
        if (err) {
            resData.resStatus = 'Invalid SQL';
            resData.resCode = -1;
            res.json(resData);
            return;
        }
        if(rows.length==0) {
            resData.resStatus = 'Invalid MacNum';
            resData.resCode = -13;
            res.json(resData);
            return;
        }
        resData.status = rows[0]['status'];
        res.json(resData);
        return;
    });
});

// ステータスのセット
router.post('/setStatus', (req, res, next) => {
    // レスポンスの戻り値データ
    const resData = { 
        'url': req.baseUrl + req.path,
        'resStatus': 'Ok',
        'resCode': 0,
    };

    // ステータス
    const status = +req.body.status;
    console.log(status)
    if(Number.isNaN(status)) {
        resData.resStatus = 'Invalid status';
        resData.resCode = -12;
        res.json(resData);
        return;
    }

    // マシン番号
    const macNum = +req.body.macNum;
    if(Number.isNaN(macNum)) {
        resData.resStatus = 'Invalid MacNum';
        resData.resCode = -13;
        res.json(resData);
        return;
    }

    // データベース
    const db = new sqlite3.Database('db1.sqlite');
    const sql = "SELECT count(*) AS cnt FROM state WHERE macNum=" + macNum;
    console.log(sql);
    db.all(sql, (err, rows) => {
        if (err) {
            resData.resStatus = 'Invalid SQL';
            resData.resCode = -1;
            res.json(resData);
            db.close();
            return;
        }
        if(rows[0].cnt!=1) {
            resData.resStatus = 'Invalid MacNum';
            resData.resCode = -13;
            res.json(resData);
            db.close();
            return;
        }
        const sqlStr="UPDATE state SET status=" + status + " WHERE macNum=" + macNum;
        console.log(sqlStr);
        db.run(sqlStr, (err) => {
            db.close();
            if (err) {
                resData.resStatus = 'Cannot update state';
                resData.resCode = -15;
                res.json(resData);
                return;
            }
            res.json(resData);
            return;
        });
    });
});


// logSlackへのレコード挿入
const logSlackInsert = (macNum, slackText, userName) => {
    // slackTextの不正な文字の削除
    slackText=slackText.replace("'","");
    slackText=slackText.replace('"','');
    slackText=slackText.replace("¥","");
    slackText=slackText.replace("\\","");
    
    // SQL文の作成
    let sqlStr = ""
    sqlStr += "INSERT INTO logSlack(dateTime,macNum,slackText,userName) VALUES (";
    sqlStr += "'" + getNow() + "'";
    sqlStr += ", " + macNum;
    sqlStr += ", '" + slackText + "'";
    sqlStr += ", '" + userName + "'";
    sqlStr += ")";
    console.log(sqlStr);

    // データベース
    const db = new sqlite3.Database('db1.sqlite');
    db.run(sqlStr, (err) => {
        db.close();
        if (err) return　false;
        return true;
    });
}

// スラックからのステータスのセットのメイン関数
const SetStateSlack = (req, res, macNum) => {
    // ユーザー名
    const userName = req.body.user_name;
    
    // チームIDのチェック
    if(req.body.team_id != "T01B7AXKK6G") {
        res.json({'text': 'エラーです(12)'});
        return;
    }
    // メッセージの抽出しステータスを確定する
    let slackText = req.body.text;

    if (logSlackInsert(macNum, slackText, userName)==false) {
        res.json({'text': 'エラーです(31)'});
        db.close();
        return;
    }

    let status = NaN;
    if(slackText.match(/口を開けて/)) {
        status=11;
    }
    else if(slackText.match(/口を閉じて/)) {
        status=21;
    }
    else if(slackText.match(/フラッピングして/)) {
        status=12;
    }
    else if(slackText.match(/元気かな/)) {
        status=13;
    }
    else if(slackText.match(/大丈夫かな/)) {
        status=14;
    }
    else if(slackText.match(/通常モードにして/)) {
        status=1;
    }
    else if(slackText.match(/開閉モードにして/)) {
        status=2;
    }
    else if(slackText.match(/フラッピングモードにして/)) {
        status=3;
    }
    else if(slackText.match(/外部動作モードにして/)) {
        status=0;
    }
    else {
        slackText = slackText.match(/ステータスを\d+にして/);
        if(slackText) status = +slackText[0].match(/\d+/)[0];
    }
    // 数値チェックと変換
    if(Number.isNaN(status)) {
        res.json({'text': 'エラーです(21)'});
        return;
    }

    // データベース
    const sqlStr="UPDATE state SET status=" + status + " WHERE macNum=" + macNum;
    console.log(sqlStr);
    const db = new sqlite3.Database('db1.sqlite');
    db.serialize(() => {
        db.run(sqlStr, (err) => {
            db.close();
            if (err) {
                res.json({'text': 'エラーです(31)'});
                return;
            }
            res.json({'text': userName + 'さん\n処理しましたよ(' + status + ')'});
        });
    });
}
// スラックからのステータスセット
router.post('/setStateSlackA', (req, res, next) => {
    // トークンのチェック
    if(req.body.token != "Ypr1p1SzdyO5vYvm361tRHAA") {
        res.json({'text': 'エラーです(11)'});
        return;
    }
    SetStateSlack(req, res, 101);
});
router.post('/setStateSlackB', (req, res, next) => {
    // トークンのチェック
    if(req.body.token != "Sqq0Bh5I2rcHA8EIkDKYPgog") {
        res.json({'text': 'エラーです(11)'});
        return;
    }
    SetStateSlack(req, res, 102);
});
router.post('/setStateSlackC', (req, res, next) => {
    // トークンのチェック
    if(req.body.token != "2nPn8vp69nobb7L72eyFNC4a") {
        res.json({'text': 'エラーです(11)'});
        return;
    }
    SetStateSlack(req, res, 103);
});
// Add 20210101
router.post('/setStateSlackD', (req, res, next) => {
    // トークンのチェック
    if(req.body.token != "hlDhvWlQyu84crcPgfdBdgwQ") {
        res.json({'text': 'エラーです(11)'});
        return;
    }
    SetStateSlack(req, res, 104);
});
router.post('/setStateSlackE', (req, res, next) => {
    // トークンのチェック
    if(req.body.token != "fKZo33BBBJ3KKFA9DPkWfvsb") {
        res.json({'text': 'エラーです(11)'});
        return;
    }
    SetStateSlack(req, res, 105);
});
router.post('/setStateSlackF', (req, res, next) => {
    // トークンのチェック
    if(req.body.token != "gWBMoflGFcJOwN823RGv31fv") {
        res.json({'text': 'エラーです(11)'});
        return;
    }
    SetStateSlack(req, res, 106);
});
router.post('/setStateSlackX', (req, res, next) => {
    // トークンのチェック
    if(req.body.token != "pahgKeS3VtYZuixgLq4PENlj") {
        res.json({'text': 'エラーです(11)'});
        return;
    }
    SetStateSlack(req, res, 109);
});

// 現在時刻の取得
const getNow = () => {
    let d = new Date()
    let tmYYYY = d.getFullYear();
    let tmMM = d.getMonth() + 1;
    let tmDD = d.getDate();
    let tmhh = d.getHours();
    let tmmm = d.getMinutes();
    let tmss = d.getSeconds();
    return tmYYYY+'/'+tmMM+'/'+tmDD+' '+tmhh+':'+tmmm+':'+tmss;
};

// logOperationへのレコード挿入
router.post('/logOperationInsert', (req, res, next) => {
    // レスポンスの戻り値データ
    const resData = { 
        'url': req.baseUrl + req.path,
        'resStatus': 'Ok',
        'resCode': 0,
    };

    // 動作種別
    const opeType = +req.body.opeType;
    if(Number.isNaN(opeType) || opeType==0) {
        resData.resStatus = 'Invalid operation type';
        resData.resCode = -14;
        res.json(resData);
        return;
    }
    
    // マシン番号
    const macNum = +req.body.macNum;
    if(Number.isNaN(macNum)) {
        resData.resStatus = 'Invalid MacNum';
        resData.resCode = -13;
        res.json(resData);
        return;
    }
    
    // SQL文の作成
    let sqlStr = ""
    sqlStr += "INSERT INTO logOperation(dateTime,macNum,operationType) VALUES (";
    sqlStr += "'" + getNow() + "'";
    sqlStr += ", " + macNum;
    sqlStr += ", " + opeType;
    sqlStr += ")";
    console.log(sqlStr);

    // データベース
    const db = new sqlite3.Database('db1.sqlite');
    db.serialize(() => {
        db.run(sqlStr, (err) => {
            db.close();
            if (err) {
                resData.resStatus = 'Invalid SQL';
                resData.resCode = -1;
            }
            res.json(resData);
        });
    });
});

// Slack Log の取得
router.get('/logSlack', (req, res, next) => {
    // レスポンスの戻り値データ
    const resData = { 
        'url': req.baseUrl + req.path,
        'resStatus': 'Ok',
        'resCode': 0,
        'rows': ''
    };

    // Limit
    let limit = +req.query.limit;
    if(Number.isNaN(limit)) limit = 200;
    if(limit==0) limit = 200;
    
    // データベース
    const sqlStr="SELECT * FROM logSlack ORDER BY seq DESC LIMIT " + limit;
    console.log(sqlStr);
    const db = new sqlite3.Database('db1.sqlite');
    db.serialize(() => {
        db.all(sqlStr, (err, rows) => {
            db.close();
            if (err) {
                resData.resStatus = 'Invalid SQL';
                resData.resCode = -1;
                res.json(resData);
                return;
            }
            resData.rows = rows;
            res.json(resData);
        });
    });
});

// Operation Log の取得
router.get('/logOperation', (req, res, next) => {
    // レスポンスの戻り値データ
    const resData = { 
        'url': req.baseUrl + req.path,
        'resStatus': 'Ok',
        'resCode': 0,
        'rows': ''
    };

    // Limit
    let limit = +req.query.limit;
    if(Number.isNaN(limit)) limit = 200;
    if(limit==0) limit = 200;
    
    // データベース
    const sqlStr="SELECT * FROM logOperation ORDER BY seq DESC LIMIT " + limit;
    console.log(sqlStr);
    const db = new sqlite3.Database('db1.sqlite');
    db.serialize(() => {
        db.all(sqlStr, (err, rows) => {
            db.close();
            if (err) {
                resData.resStatus = 'Invalid SQL';
                resData.resCode = -1;
                res.json(resData);
                return;
            }
            resData.rows = rows;
            res.json(resData);
        });
    });
});

router.post('/slackMsg', (req, res, next) => {
    console.log('/slackMsg')
    // レスポンスの戻り値データ
    const resData = { 
        'url': req.baseUrl + req.path,
        'resStatus': 'Ok',
        'resCode': 0,
    };

    // マシン番号
    const macNum = +req.body.macNum;
    // if((macNum!=101) && (macNum!=102) && (macNum!=103)) {
    //     resData.resStatus = 'Invalid MacNum';
    //     resData.resCode = -13;
    //     res.json(resData);
    //     return;
    // }
    let uri = "";
    // if(macNum==101) uri="https://hooks.slack.com/services/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";
    // if(macNum==102) uri="https://hooks.slack.com/services/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";
    // if(macNum==103) uri="https://hooks.slack.com/services/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";   
    // if(macNum==104) uri="https://hooks.slack.com/services/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";
    // if(macNum==105) uri="https://hooks.slack.com/services/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";
    // if(macNum==106) uri="https://hooks.slack.com/services/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";
    // if(macNum==109) uri="https://hooks.slack.com/services/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";

    switch(macNum) {
        case 101: 
            uri="https://hooks.slack.com/services/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"; 
            break;
        case 102:
            uri="https://hooks.slack.com/services/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";
            break;
        case 103:
            uri="https://hooks.slack.com/services/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";   
            break;
        case 104:
            uri="https://hooks.slack.com/services/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";
            break;
        case 105:
            uri="https://hooks.slack.com/services/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";
            break;
        case 106:
            uri="https://hooks.slack.com/services/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";
            break;
        case 109:
            uri="https://hooks.slack.com/services/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";
            break;
        default:
            resData.resStatus = 'Invalid MacNum';
            resData.resCode = -13;
            res.json(resData);
            return;
        }

    // 動作種別
    const action = req.body.action;
    if(action===undefined || action=='') {
        resData.resStatus = 'Action is null';
        resData.resCode = -14;
        res.send(resData);
        return;
    }

    // SQL文の作成
    let sqlStr = ""
    sqlStr += "INSERT INTO logOperation(dateTime,macNum,action) VALUES (";
    sqlStr += "'" + getNow() + "'";
    sqlStr += ", " + macNum;
    sqlStr += ", '" + action + "'";
    sqlStr += ")";
    console.log(sqlStr);

    // データベース
    const db = new sqlite3.Database('db1.sqlite');
    db.run(sqlStr, (err) => {
        db.close();
        if (err) {
            resData.resStatus = 'Invalid SQL';
            resData.resCode = -1;
            res.json(resData);
            return;
        }
        // Incoming Webhook の送信
        const options = {
            uri: uri,
            method: 'POST',
            form: {
                "payload": "{'text':'" + action + "'}",
            }        
        };
        request.post(options, (err, response, body) => {
            if(err) {
                resData.resStatus = 'Incoming Webhook error';
                resData.resCode = -21;
                res.send(resData);
                return;
            }
            if(body!='ok') {
                resData.resStatus = body;
                resData.resCode = -22;
                res.send(resData);
                return;
            }
            res.send(resData);
        });
    });
});


module.exports = router;
