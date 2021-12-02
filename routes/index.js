const router = require('express').Router();
const apiRoot = require('./apiv1/apiRoot');

/* GET home page. */
router.get('/', (req, res, next) => {
  res.render('index', { title: 'Api Server' });
});

router.use('/api', apiRoot);
router.use('/apiv1', apiRoot);

module.exports = router;
