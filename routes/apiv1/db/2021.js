const router = require('express').Router();
const sqlite3 = require('sqlite3').verbose();
const request = require('request');

// ルートの取得
router.get('/', (req, res, next) => {
    res.render('index', { title: req.baseUrl});
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
  const sql = "SELECT status FROM state WHERE macNum=" + macNum;
  const db = new sqlite3.Database('db1.sqlite');
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

  // データベース
  const db = new sqlite3.Database('db1.sqlite');
  db.run(sqlStr, (err) => {
    db.close();
    if (err) return　false;
    return true;
  });
}

// スラックからのステータスセット
router.post('/setStateSlack', (req, res, next) => {
  let macNum = 0;
  // トークンでmacNumの設定
  if(req.body.token == "ir8bwGi3Ipm1W8FlFbMNtoa5") macNum = 201;   // ucro7a1
  if(req.body.token == "WoG9XYuZlgGdcqHe3pA3ftDf") macNum = 202;   // ucro7a2
  if(req.body.token == "QY8S1jfzvLgEsLVY3eFpsWS6") macNum = 203;   // ucro7a3
  if(req.body.token == "N31G7N7iSbCcxtRDDU5d4VZt") macNum = 204;   // ucro7a4
  if(req.body.token == "FT3B3Akx428D11wlr5dlYLUI") macNum = 205;   // ucro7a5
  if(req.body.token == "7GklEkt7jvpeR0iIeqqQWmPY") macNum = 206;   // ucro7a6
  if(req.body.token == "3iYeutGVGAu8XUr2eGu9JiCH") macNum = 207;   // ucro7a7

  // macNumに対応するトークンがない時
  if (macNum==0) {
    res.json({'text': 'エラーです(11)'});
    return;
  }

  // チームIDのチェック
  if(req.body.team_id != "T01B7AXKK6G") {
    res.json({'text': 'エラーです(12)'});
    return;
  }

  // ユーザー名
  const userName = req.body.user_name;
    
  // メッセージの抽出しステータスを確定する
  let slackText = req.body.text;

  // logSlackのテーブルに追加する
  if (logSlackInsert(macNum, slackText, userName)==false) {
    res.json({'text': 'エラーです(31)'});
    db.close();
    return;
  }

  let status = NaN;
  if(slackText.match(/ひまだー/)) {
    status=501;
  }
  else if(slackText.match(/やだわー/)) {
    status=502;
  }
  else if(slackText.match(/眠い/)) {
    status=503;
  }
  else if(slackText.match(/いい感じだね/)) {
    status=504;
  }
  else if(slackText.match(/ありがとう/)) {
    status=505;
  }
  else if(slackText.match(/サンキュー/)) {
    status=505;
  }
  else if(slackText.match(/いいね/)) {
    status=506;
  }
  else if(slackText.match(/こわ/)) {
    status=507;
  }
  else if(slackText.match(/それはないわー/)) {
    status=508;
  }
  else if(slackText.match(/ステータスを教えて/)) {
    console.log(macNum);
    // ステータスを教えての時
    const sql = "SELECT status FROM state WHERE macNum=" + macNum;
    const db = new sqlite3.Database('db1.sqlite');
    db.all(sql, (err, rows) => {
      db.close();
      if (err) {
        // Invalid SQL
        res.json({'text': 'エラーです(41: Invalid SQL)'})
        return;
      }
      if(rows.length==0) {
        // Invalid MacNum
        res.json({'text': 'エラーです(42: Invalid MacNum)'})
        return;
      }
      res.json({'text': '現在のステータスは ' + rows[0]['status'] + ' です'})
      return;
    });
    return;
  }
  else {
    const matchText = slackText.match(/ステータスを\d+にして/);
    if(matchText) {
      status = +matchText[0].match(/\d+/)[0];
    } 
  }

  // 数値チェックと変換
  if(Number.isNaN(status)) {
    res.json({'text': '理解できませんでした(21)'});
    return;
  }

  // データベース
  const sqlStr="UPDATE state SET status=" + status + " WHERE macNum=" + macNum;
  const db = new sqlite3.Database('db1.sqlite');
  db.serialize(() => {
    db.run(sqlStr, (err) => {
      db.close();
      if (err) {
        res.json({'text': 'エラーです(31)'});
        return;
      }
      // res.json({'text': userName + 'さん\n処理しましたよ(' + status + ')'});
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
  let uri = "";
  switch(macNum) {
    case 201: 
      uri="https://hooks.slack.com/services/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"; 
      break;
    case 202:
      uri="https://hooks.slack.com/services/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";
      break;
    case 203:
      uri="https://hooks.slack.com/services/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";
      break;
    case 204:
      uri="https://hooks.slack.com/services/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";
      break;
    case 205:
      uri="https://hooks.slack.com/services/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";
      break;
    case 206:
      uri="https://hooks.slack.com/services/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";
      break;
    case 207:
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
    // エラーがなかった場合、Incoming Webhookの送信
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
