const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),publicDir=path.join(root,'public');
if(!fs.existsSync(publicDir))require('./build');
const handlers={};for(const name of ['config','checkout','order','mercadopago-webhook'])handlers['/api/'+name]=require('../api/'+name);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.mp4':'video/mp4'};
const server=http.createServer(async(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(handlers[pathname])return handlers[pathname](req,res);
 const target=path.resolve(publicDir,'.'+(pathname==='/'?'/index.html':pathname));
 if(!target.startsWith(publicDir+path.sep)){res.writeHead(403).end();return;}
 let stat;try{stat=fs.statSync(target);}catch{res.writeHead(404).end();return;}
 if(!stat.isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');
 res.setHeader('Cache-Control','no-store');
 const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
 if(match){const start=Number(match[1]),end=Math.min(Number(match[2]||stat.size-1),stat.size-1);if(start>end){res.writeHead(416).end();return;}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'});fs.createReadStream(target,{start,end}).pipe(res);}
 else{res.setHeader('Content-Length',stat.size);fs.createReadStream(target).pipe(res);}
});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log('Hogarq preview: http://127.0.0.1:'+(process.env.PORT||4173)));
