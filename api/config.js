const {endpoint,json} = require('../lib/http');
const {config} = require('../lib/config');
module.exports = endpoint('GET',async(req,res)=>{
  const c = config();
  json(res,200,{enabled:c.ready,test:!c.production});
});
