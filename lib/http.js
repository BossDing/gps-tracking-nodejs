var http = require('http');

function HttpServer(gps_server){
	this.gps_server = gps_server;

    var that = this;
    this.httpPort = "5" + that.gps_server.opts.port;
    http.createServer(function (request, response) {
        response.writeHead(200, {'Content-Type': 'text/html'});
        var now = new Date();
        
        var fs = require('fs');

        try{
            var jsonData = fs.readFileSync(that.gps_server.opts.gpx_log_location + that.gps_server.opts.port + "_" + now.getFullYear() + "-"+ (now.getMonth()+1) + "-" + (now.getDate()) + ".json");
        }catch(e){
            var jsonData = "";
        }
        var bodyStr = fs.readFileSync("./gps-tracking-nodejs/lib/http.html", 'utf8').replace("________GPS_JSON_DATA________", jsonData);
        response.end(bodyStr);
    }).listen(this.httpPort);

    console.log('HTTP Server running at http://127.0.0.1:'+ this.httpPort +'/');
};
exports.HttpServer = HttpServer;
