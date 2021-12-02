const router = require('express').Router();

/* GET home page. */
router.get('/', (req, res, next) => {
    res.render('index', { title: req.baseUrl});
});
router.get('/version', (req, res, next) => {
    const resData = { 
        'url': req.baseUrl + req.path,
        'resStatus': 'Ok',
        'resCode': 0,
        'version' : '1.1.0',
    };
    res.json(resData);
});

router.use('/db', require('./db/db'));




module.exports = router;
